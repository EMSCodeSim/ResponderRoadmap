import { randomBytes } from "crypto";
import { prisma } from "@/server/db";
import { writeActivity, writeAudit, HttpError } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/constants";
import {
  invitationEmailConfigured,
  sendInvitationEmail,
  sendInvitationEmailBatch,
} from "@/server/services/invitation-email";
import bcrypt from "bcryptjs";
import { setSessionCookie } from "@/server/session";
import { notifyUser } from "@/server/services/inbox";

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

type InvitationInput = {
  email?: string;
  role?: Role;
  rank?: string;
  station?: string;
  shift?: string;
};

function cleanInvitationInput(input: InvitationInput, row?: number) {
  const email = input.email?.trim().toLowerCase() || "";
  const prefix = row ? `Row ${row}: ` : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, `${prefix}a valid email address is required.`);
  }
  const role = input.role || "MEMBER";
  if (!ROLES.includes(role)) throw new HttpError(400, `${prefix}the selected role is not valid.`);
  return {
    email,
    role,
    rank: input.rank?.trim().slice(0, 100) || null,
    station: input.station?.trim().slice(0, 100) || null,
    shift: input.shift?.trim().slice(0, 100) || null,
  };
}

async function savePendingInvitation(ctx: AuthContext, input: ReturnType<typeof cleanInvitationInput>) {
  const token = randomBytes(18).toString("hex");
  const expiresAt = new Date(Date.now() + 14 * 86_400_000);
  const existing = await prisma.invitation.findFirst({
    where: { departmentId: ctx.departmentId, email: input.email, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return prisma.invitation.update({
      where: { id: existing.id },
      data: { ...input, token, expiresAt },
    });
  }
  return prisma.invitation.create({
    data: {
      departmentId: ctx.departmentId,
      ...input,
      token,
      invitedById: ctx.userId,
      status: "PENDING",
      expiresAt,
    },
  });
}

function invitationEmailDetails(ctx: AuthContext, invitation: Awaited<ReturnType<typeof savePendingInvitation>>) {
  return {
    id: invitation.id,
    token: invitation.token,
    email: invitation.email,
    departmentName: ctx.departmentName,
    roleLabel: ROLE_LABELS[invitation.role as Role] || invitation.role,
    invitedByName: ctx.name,
  };
}

export async function getEnrollment(ctx: AuthContext) {
  assertPermission(ctx, "invitations.write");
  const [department, invitations, pendingMembers] = await Promise.all([
    prisma.department.findUniqueOrThrow({
      where: { id: ctx.departmentId },
      select: { id: true, name: true, joinCode: true, requireApproval: true },
    }),
    prisma.invitation.findMany({
      where: { departmentId: ctx.departmentId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { invitedBy: { select: { name: true } } },
    }),
    prisma.departmentMembership.findMany({
      where: { departmentId: ctx.departmentId, status: "PENDING" },
      orderBy: { joinedAt: "asc" },
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);
  return {
    department,
    emailDeliveryConfigured: invitationEmailConfigured(),
    invitations: invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      token: invitation.token,
      role: invitation.role,
      rank: invitation.rank,
      station: invitation.station,
      shift: invitation.shift,
      status: invitation.status,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      invitedByName: invitation.invitedBy.name,
    })),
    pendingMembers: pendingMembers.map((membership) => ({
      id: membership.id,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role,
      rank: membership.rank,
      station: membership.station,
      shift: membership.shift,
      joinedAt: membership.joinedAt,
    })),
  };
}

export async function createInvitation(
  ctx: AuthContext,
  raw: InvitationInput,
) {
  assertPermission(ctx, "invitations.write");
  const invitation = await savePendingInvitation(ctx, cleanInvitationInput(raw));
  const delivery = await sendInvitationEmail(invitationEmailDetails(ctx, invitation));
  await writeAudit(ctx, "invitation.created", "Invitation", invitation.id, {
    email: invitation.email,
    role: invitation.role,
    deliveryStatus: delivery.status,
  });
  return { ...invitation, delivery };
}

export async function resendInvitation(ctx: AuthContext, invitationId: string) {
  assertPermission(ctx, "invitations.write");
  const existing = await prisma.invitation.findFirst({
    where: { id: invitationId, departmentId: ctx.departmentId },
  });
  if (!existing) throw new HttpError(404, "Invitation not found.");
  if (existing.status !== "PENDING") throw new HttpError(409, "Only pending invitations can be resent.");
  const invitation = await prisma.invitation.update({
    where: { id: existing.id },
    data: {
      token: randomBytes(18).toString("hex"),
      expiresAt: new Date(Date.now() + 14 * 86_400_000),
    },
  });
  const delivery = await sendInvitationEmail(invitationEmailDetails(ctx, invitation));
  await writeAudit(ctx, "invitation.resent", "Invitation", invitation.id, { deliveryStatus: delivery.status });
  return { ...invitation, delivery };
}

export async function revokeInvitation(ctx: AuthContext, invitationId: string) {
  assertPermission(ctx, "invitations.write");
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, departmentId: ctx.departmentId },
  });
  if (!invitation) throw new HttpError(404, "Invitation not found.");
  if (invitation.status !== "PENDING") throw new HttpError(409, "Only pending invitations can be revoked.");
  const updated = await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: "REVOKED" },
  });
  await writeAudit(ctx, "invitation.revoked", "Invitation", invitation.id, {});
  return updated;
}

export async function bulkCreateInvitations(ctx: AuthContext, raw: unknown) {
  assertPermission(ctx, "invitations.write");
  if (!Array.isArray(raw) || raw.length === 0) throw new HttpError(400, "Add at least one CSV roster row.");
  if (raw.length > 250) throw new HttpError(400, "Import no more than 250 members at one time.");
  const inputs = raw.map((item, index) => cleanInvitationInput((item || {}) as InvitationInput, index + 2));
  const emails = new Set<string>();
  for (const input of inputs) {
    if (emails.has(input.email)) throw new HttpError(400, `The CSV includes ${input.email} more than once.`);
    emails.add(input.email);
  }
  const invitations = [];
  for (const input of inputs) invitations.push(await savePendingInvitation(ctx, input));
  const delivery = await sendInvitationEmailBatch(
    invitations.map((invitation) => invitationEmailDetails(ctx, invitation)),
  );
  await writeAudit(ctx, "invitation.bulk_created", "Department", ctx.departmentId, {
    count: invitations.length,
    deliveryStatus: delivery.status,
  });
  return { count: invitations.length, delivery, invitations };
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
      status: "PENDING",
    },
  });
  await writeActivity(department.id, "MEMBER_JOINED", {
    userId,
    referenceId: membership.id,
    metadata: { memberName: user.name },
  });
  const officers = await prisma.departmentMembership.findMany({
    where: { departmentId: department.id, status: "ACTIVE", role: { in: ["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] } },
    select: { userId: true },
  });
  await Promise.all(officers.map(({ userId: officerId }) => notifyUser({
    departmentId: department.id,
    userId: officerId,
    type: "MEMBER_APPROVAL_REQUIRED",
    title: "New member awaiting approval",
    body: `${user.name} used the department join code and is waiting for approval.`,
    referenceType: "DepartmentMembership",
    referenceId: membership.id,
    actionPath: "/enrollment",
    dedupeKey: `member-approval:${membership.id}`,
  })));
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
