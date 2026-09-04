import { randomBytes } from "crypto";
import { prisma } from "@/server/db";
import { writeActivity, writeAudit, HttpError } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";
import type { Role } from "@/lib/constants";
import bcrypt from "bcryptjs";
import { setSessionCookie } from "@/server/session";

export async function getDepartment(ctx: AuthContext) {
  assertPermission(ctx, "department.read");
  return prisma.department.findFirst({
    where: { id: ctx.departmentId },
  });
}

export async function updateDepartment(
  ctx: AuthContext,
  input: {
    name?: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    timezone?: string;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    requireApproval?: boolean;
    logoUrl?: string | null;
    evaluationEscalationHours?: number;
  },
) {
  assertPermission(ctx, "department.write");
  const department = await prisma.department.update({
    where: { id: ctx.departmentId },
    data: {
      name: input.name?.trim() || undefined,
      address: input.address === undefined ? undefined : input.address,
      city: input.city === undefined ? undefined : input.city,
      state: input.state === undefined ? undefined : input.state,
      zip: input.zip === undefined ? undefined : input.zip,
      timezone: input.timezone,
      contactName: input.contactName === undefined ? undefined : input.contactName,
      contactEmail: input.contactEmail === undefined ? undefined : input.contactEmail,
      contactPhone: input.contactPhone === undefined ? undefined : input.contactPhone,
      requireApproval: input.requireApproval,
      logoUrl: input.logoUrl === undefined ? undefined : input.logoUrl,
      evaluationEscalationHours: input.evaluationEscalationHours === undefined
        ? undefined
        : Math.max(1, Math.min(720, Math.round(input.evaluationEscalationHours))),
    },
  });
  await writeAudit(ctx, "department.updated", "Department", department.id, {});
  return department;
}

export async function listInvitations(ctx: AuthContext) {
  assertPermission(ctx, "invitations.write");
  return prisma.invitation.findMany({
    where: { departmentId: ctx.departmentId },
    include: { invitedBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createInvitation(
  ctx: AuthContext,
  input: { email?: string; role?: Role; rank?: string; station?: string; shift?: string },
) {
  assertPermission(ctx, "invitations.write");
  const token = randomBytes(18).toString("hex");
  const invitation = await prisma.invitation.create({
    data: {
      departmentId: ctx.departmentId,
      email: input.email?.trim().toLowerCase() || null,
      token,
      role: input.role || "MEMBER",
      rank: input.rank || null,
      station: input.station || null,
      shift: input.shift || null,
      invitedById: ctx.userId,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 14 * 86_400_000),
    },
  });
  await writeAudit(ctx, "invitation.created", "Invitation", invitation.id, { email: invitation.email, role: invitation.role });
  return invitation;
}

export async function joinByCode(userId: string, joinCode: string) {
  const code = joinCode.trim().toUpperCase();
  const department = await prisma.department.findUnique({ where: { joinCode: code } });
  if (!department) throw new HttpError(404, "That department code was not found.");
  const existing = await prisma.departmentMembership.findUnique({
    where: { departmentId_userId: { departmentId: department.id, userId } },
  });
  if (existing) throw new HttpError(409, "You are already a member of this department.");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, "Authentication required.");
  const membership = await prisma.departmentMembership.create({
    data: {
      departmentId: department.id,
      userId,
      role: "MEMBER",
      status: department.requireApproval ? "PENDING" : "ACTIVE",
    },
  });
  await writeActivity(department.id, "MEMBER_JOINED", {
    userId,
    referenceId: membership.id,
    metadata: { memberName: user.name },
  });
  if (membership.status === "ACTIVE") {
    await setSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
      departmentId: department.id,
      departmentName: department.name,
      membershipId: membership.id,
      role: "MEMBER",
      rank: null,
    });
  }
  return { department, membership };
}

export async function acceptInvitation(userId: string, token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { department: true },
  });
  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
    throw new HttpError(400, "This invitation is invalid or has expired.");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, "Authentication required.");
  if (invitation.email && invitation.email !== user.email) {
    throw new HttpError(403, "This invitation was issued to a different email address.");
  }
  const membership = await prisma.departmentMembership.upsert({
    where: { departmentId_userId: { departmentId: invitation.departmentId, userId } },
    update: {
      role: invitation.role,
      status: "ACTIVE",
      rank: invitation.rank,
      station: invitation.station,
      shift: invitation.shift,
    },
    create: {
      departmentId: invitation.departmentId,
      userId,
      role: invitation.role,
      status: "ACTIVE",
      rank: invitation.rank,
      station: invitation.station,
      shift: invitation.shift,
    },
  });
  await prisma.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } });
  await setSessionCookie({
    userId: user.id,
    email: user.email,
    name: user.name,
    departmentId: invitation.department.id,
    departmentName: invitation.department.name,
    membershipId: membership.id,
    role: invitation.role as Role,
    rank: membership.rank,
  });
  return { department: invitation.department, membership };
}

export async function updateAccount(
  userId: string,
  input: { name?: string; phone?: string | null; currentPassword?: string; newPassword?: string },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, "Authentication required.");
  const data: { name?: string; phone?: string | null; passwordHash?: string } = {};
  if (input.name?.trim()) data.name = input.name.trim();
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.newPassword) {
    if (!input.currentPassword) throw new HttpError(400, "Current password is required.");
    const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!ok) throw new HttpError(400, "Current password is incorrect.");
    if (input.newPassword.length < 8) throw new HttpError(400, "New password must be at least 8 characters.");
    data.passwordHash = await bcrypt.hash(input.newPassword, 10);
  }
  return prisma.user.update({ where: { id: user.id }, data });
}

export async function listActivity(ctx: AuthContext, limit = 40) {
  return prisma.activityEvent.findMany({
    where: { departmentId: ctx.departmentId },
    include: { user: true },
    orderBy: { timestamp: "desc" },
    take: limit,
  });
}
