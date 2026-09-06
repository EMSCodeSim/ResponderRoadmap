import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/http";
import { setSessionCookie, type SessionPayload } from "@/server/session";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { notifyUser } from "@/server/services/inbox";

function toSession(user: {
  id: string;
  email: string;
  name: string;
  memberships: Array<{
    id: string;
    role: string;
    status: string;
    rank: string | null;
    department: { id: string; name: string };
  }>;
}): SessionPayload {
  const membership = user.memberships.find((item) => item.status === "ACTIVE") ?? user.memberships[0] ?? null;
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    departmentId: membership?.department.id ?? null,
    departmentName: membership?.department.name ?? null,
    membershipId: membership?.id ?? null,
    role: (membership?.role as Role) ?? null,
    rank: membership?.rank ?? null,
  };
}

async function loadUser(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      memberships: {
        include: { department: true },
        orderBy: { joinedAt: "desc" },
      },
    },
  });
}

export async function login(email: string, password: string) {
  const user = await loadUser(email);
  if (!user) throw new HttpError(401, "Invalid email or password.");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new HttpError(401, "Invalid email or password.");
  const session = toSession(user);
  if (session.membershipId) {
    const membership = user.memberships.find((item) => item.id === session.membershipId);
    if (membership && membership.status !== "ACTIVE") {
      throw new HttpError(403, membership.status === "PENDING"
        ? "Your department membership is waiting for Training Officer approval."
        : "Your department membership is not active. Contact your Training Officer for help.");
    }
  }
  await setSessionCookie(session);
  return { session, needsDepartment: !session.departmentId };
}

export async function validateDepartmentJoinCode(rawCode: string) {
  const joinCode = rawCode.trim().toUpperCase();
  if (!joinCode) throw new HttpError(400, "Enter the department join code provided by your Training Officer.");
  const department = await prisma.department.findUnique({
    where: { joinCode },
    select: { id: true, name: true },
  });
  if (!department) throw new HttpError(404, "That department join code was not accepted. Check the code with your Training Officer.");
  return { departmentName: department.name, joinCode, approvalRequired: true };
}

export async function register(input: { name: string; email: string; password: string; invitationToken?: string; joinCode?: string }) {
  const email = input.email.trim().toLowerCase();
  const token = input.invitationToken?.trim() || "";
  const joinCode = input.joinCode?.trim().toUpperCase() || "";
  if (!input.name.trim() || !email || input.password.length < 8) {
    throw new HttpError(400, "Name, email, and a password of at least 8 characters are required.");
  }
  if (!token && !joinCode) {
    throw new HttpError(403, "Enter a department join code or use the invitation link sent by your department.");
  }

  const invitation = token
    ? await prisma.invitation.findUnique({ where: { token }, include: { department: true } })
    : null;
  if (token && (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date())) {
    throw new HttpError(400, "This invitation is invalid or has expired.");
  }
  if (invitation?.email && invitation.email !== email) throw new HttpError(403, "This invitation was issued to a different email address.");
  const codeDepartment = joinCode
    ? await prisma.department.findUnique({ where: { joinCode }, select: { id: true, name: true } })
    : null;
  if (joinCode && !codeDepartment) throw new HttpError(404, "That department join code was not accepted. Check the code with your Training Officer.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, "An account with that email already exists. Sign in to accept your invitation.");

  const passwordHash = await bcrypt.hash(input.password, 10);
  const departmentId = invitation?.departmentId || codeDepartment!.id;
  const membershipStatus = invitation ? "ACTIVE" : "PENDING";
  const userId = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name: input.name.trim(), email, passwordHash } });
    await tx.departmentMembership.create({
      data: {
        departmentId,
        userId: user.id,
        role: invitation?.role || "MEMBER",
        status: membershipStatus,
        rank: invitation?.rank,
        station: invitation?.station,
        shift: invitation?.shift,
      },
    });
    if (invitation) await tx.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } });
    return user.id;
  });

  if (!invitation) {
    const officers = await prisma.departmentMembership.findMany({
      where: { departmentId, status: "ACTIVE", role: { in: ["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] } },
      select: { userId: true },
    });
    await Promise.all(officers.map(({ userId: officerId }) => notifyUser({
      departmentId,
      userId: officerId,
      type: "MEMBER_APPROVAL_REQUIRED",
      title: "New member awaiting approval",
      body: `${input.name.trim()} used the department join code and is waiting for approval.`,
      referenceType: "User",
      referenceId: userId,
      actionPath: "/enrollment",
      dedupeKey: `member-approval:${userId}`,
    })));
    return { session: null, needsDepartment: true, approvalPending: true, departmentName: codeDepartment!.name };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: { include: { department: true }, orderBy: { joinedAt: "desc" } } },
  });
  if (!user) throw new HttpError(500, "Account was created but could not be loaded.");
  const session = toSession(user);
  await setSessionCookie(session);
  return { session, needsDepartment: false, approvalPending: false, departmentName: invitation.department.name };
}

function makeJoinCode(name: string) {
  const letters = name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${letters}-${digits}`;
}

function makePublicId(name: string) {
  const letters = name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  return `${letters}-${String(Math.floor(100 + Math.random() * 900))}`;
}

export async function createDepartment(
  userId: string,
  input: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    timezone?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
  },
) {
  const name = input.name.trim();
  if (!name) throw new HttpError(400, "Department name is required.");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, "Authentication required.");

  let joinCode = makeJoinCode(name);
  while (await prisma.department.findUnique({ where: { joinCode } })) joinCode = makeJoinCode(name);
  let publicId = makePublicId(name);
  while (await prisma.department.findUnique({ where: { publicId } })) publicId = makePublicId(name);

  const department = await prisma.department.create({
    data: {
      name,
      publicId,
      joinCode,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      zip: input.zip?.trim() || null,
      timezone: input.timezone || "America/Chicago",
      contactName: input.contactName?.trim() || user.name,
      contactEmail: input.contactEmail?.trim() || user.email,
      contactPhone: input.contactPhone?.trim() || null,
      createdById: user.id,
      memberships: { create: { userId: user.id, role: "DEPARTMENT_ADMINISTRATOR", status: "ACTIVE", rank: "Fire Chief" } },
      credentialTypes: {
        create: [
          { name: "EMT", issuerDefault: "State EMS Office" },
          { name: "AEMT", issuerDefault: "State EMS Office" },
          { name: "Paramedic", issuerDefault: "State EMS Office" },
          { name: "CPR", issuerDefault: "American Heart Association" },
          { name: "ACLS", issuerDefault: "American Heart Association" },
          { name: "PALS", issuerDefault: "American Heart Association" },
          { name: "Firefighter I", issuerDefault: "State Fire Marshal" },
          { name: "Firefighter II", issuerDefault: "State Fire Marshal" },
          { name: "HazMat Awareness", issuerDefault: "State Fire Marshal" },
          { name: "HazMat Operations", issuerDefault: "State Fire Marshal" },
          { name: "Driver / Operator – Pumper", issuerDefault: "State Fire Marshal" },
          { name: "Fire Officer I", issuerDefault: "State Fire Marshal" },
          { name: "Fire Officer II", issuerDefault: "State Fire Marshal" },
          { name: "Fire Instructor I", issuerDefault: "State Fire Marshal" },
        ],
      },
    },
    include: { memberships: true },
  });

  const membership = department.memberships[0];
  await setSessionCookie({
    userId: user.id,
    email: user.email,
    name: user.name,
    departmentId: department.id,
    departmentName: department.name,
    membershipId: membership.id,
    role: "DEPARTMENT_ADMINISTRATOR",
    rank: membership.rank,
  });
  return department;
}

export function roleLabel(role: Role | string) {
  return ROLE_LABELS[role as Role] ?? role;
}
