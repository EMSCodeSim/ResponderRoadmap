import { prisma } from "@/server/db";
import { writeActivity, writeAudit, HttpError } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";
import { credentialStatus } from "@/lib/dates";
import type { VerificationStatus } from "@/lib/constants";

export async function listCredentials(
  ctx: AuthContext,
  filters: { window?: string; credential?: string; station?: string; shift?: string; memberId?: string } = {},
) {
  assertPermission(ctx, "credentials.read");
  const records = await prisma.credential.findMany({
    where: {
      departmentId: ctx.departmentId,
      ...(filters.memberId ? { membershipId: filters.memberId } : {}),
      ...(filters.credential ? { credentialName: filters.credential } : {}),
      membership: {
        ...(filters.station ? { station: filters.station } : {}),
        ...(filters.shift ? { shift: filters.shift } : {}),
      },
    },
    include: { membership: { include: { user: true } }, credentialType: true },
    orderBy: [{ expirationDate: "asc" }, { credentialName: "asc" }],
  });

  const rows = records.map((record) => {
    const status = credentialStatus(record.expirationDate);
    return {
      id: record.id,
      memberId: record.membershipId,
      memberName: record.membership.user.name,
      rank: record.membership.rank,
      station: record.membership.station,
      shift: record.membership.shift,
      credentialName: record.credentialName,
      issuer: record.issuer,
      credentialNumber: record.credentialNumber,
      issueDate: record.issueDate,
      expirationDate: record.expirationDate,
      verificationStatus: record.verificationStatus,
      attachmentUrl: record.attachmentUrl,
      notes: record.notes,
      isCustom: record.credentialType?.isCustom ?? false,
      ...status,
    };
  });

  const window = filters.window;
  const filtered = window
    ? rows.filter((row) => {
        if (window === "expired") return row.window === "expired";
        if (window === "current") return row.health === "current" && (row.window === "current" || row.window === "180");
        if (window === "missing") return row.window === "missing";
        if (window === "30") return ["7", "14", "30"].includes(row.window);
        if (window === "60") return ["7", "14", "30", "60"].includes(row.window);
        if (window === "90") return ["7", "14", "30", "60", "90"].includes(row.window);
        if (window === "180") return ["7", "14", "30", "60", "90", "180"].includes(row.window);
        if (window === "6months") return ["7", "14", "30", "60", "90", "180"].includes(row.window);
        return row.window === window;
      })
    : rows;

  const types = await prisma.credentialType.findMany({
    where: { departmentId: ctx.departmentId },
    orderBy: [{ isCustom: "asc" }, { name: "asc" }],
  });

  return { credentials: filtered, types };
}

export async function upsertCredential(
  ctx: AuthContext,
  input: {
    id?: string;
    membershipId: string;
    credentialName: string;
    issuer?: string;
    credentialNumber?: string | null;
    issueDate?: string | null;
    expirationDate?: string | null;
    verificationStatus?: VerificationStatus;
    attachmentUrl?: string | null;
    notes?: string;
    credentialTypeId?: string | null;
  },
) {
  assertPermission(ctx, "credentials.write");
  const membership = await prisma.departmentMembership.findFirst({
    where: { id: input.membershipId, departmentId: ctx.departmentId },
    include: { user: true },
  });
  if (!membership) throw new HttpError(404, "Member not found.");
  if (!input.credentialName.trim()) throw new HttpError(400, "Credential name is required.");

  const data = {
    membershipId: membership.id,
    departmentId: ctx.departmentId,
    credentialTypeId: input.credentialTypeId || null,
    credentialName: input.credentialName.trim(),
    issuer: input.issuer?.trim() || "",
    credentialNumber: input.credentialNumber?.trim() || null,
    issueDate: input.issueDate ? new Date(input.issueDate) : null,
    expirationDate: input.expirationDate ? new Date(input.expirationDate) : null,
    verificationStatus: input.verificationStatus || "VERIFIED",
    attachmentUrl: input.attachmentUrl || null,
    notes: input.notes?.trim() || "",
  };

  const record = input.id
    ? await prisma.credential.update({
        where: { id: input.id },
        data,
      })
    : await prisma.credential.create({ data });

  await writeAudit(ctx, input.id ? "credential.updated" : "credential.created", "Credential", record.id, {
    memberId: membership.id,
    name: record.credentialName,
  });
  await writeActivity(ctx.departmentId, input.id ? "CREDENTIAL_UPDATED" : "CREDENTIAL_UPLOADED", {
    userId: membership.userId,
    referenceId: record.id,
    metadata: { memberName: membership.user.name, credential: record.credentialName, actorName: ctx.name },
  });
  return record;
}

export async function createCredentialType(ctx: AuthContext, input: { name: string; issuerDefault?: string }) {
  assertPermission(ctx, "credentials.write");
  const name = input.name.trim();
  if (!name) throw new HttpError(400, "Credential name is required.");
  const existing = await prisma.credentialType.findUnique({
    where: { departmentId_name: { departmentId: ctx.departmentId, name } },
  });
  if (existing) throw new HttpError(409, "That credential type already exists.");
  return prisma.credentialType.create({
    data: {
      departmentId: ctx.departmentId,
      name,
      issuerDefault: input.issuerDefault?.trim() || null,
      isCustom: true,
    },
  });
}

export async function listCredentialTypes(ctx: AuthContext) {
  assertPermission(ctx, "credentials.read");
  return prisma.credentialType.findMany({
    where: { departmentId: ctx.departmentId },
    orderBy: [{ isCustom: "asc" }, { name: "asc" }],
  });
}
