import { prisma } from "@/server/db";
import { HttpError } from "@/server/http";
import { isPlatformAdmin, listInterests } from "@/server/services/interests";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const deletedEmailSuffix = "@deleted.responderroadmap.invalid";
const visibleAccountWhere = { NOT: { email: { endsWith: deletedEmailSuffix } } };

export async function getPlatformAdminDashboard(email: string) {
  if (!isPlatformAdmin(email)) throw new HttpError(403, "Platform administrator access is required.");
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 86_400_000);
  const thirtyDaysAgo = new Date(now - 30 * 86_400_000);
  const [
    totalUsers, totalDepartments, usersLast7Days, usersLast30Days,
    membershipGroups, recentUsers, departments, interests,
  ] = await Promise.all([
    prisma.user.count({ where: visibleAccountWhere }),
    prisma.department.count(),
    prisma.user.count({ where: { ...visibleAccountWhere, createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { ...visibleAccountWhere, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.departmentMembership.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.findMany({
      where: visibleAccountWhere,
      orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, name: true, email: true, createdAt: true, memberships: { select: { role: true, status: true, department: { select: { id: true, name: true } } } } },
    }),
    prisma.department.findMany({
      orderBy: { createdAt: "desc" }, take: 50,
      select: { id: true, name: true, plan: true, createdAt: true, _count: { select: { memberships: true } }, memberships: { where: { status: "ACTIVE" }, select: { id: true } } },
    }),
    listInterests(email, {}),
  ]);
  const accounts = recentUsers.map((user) => ({
    ...user,
    canDelete: user.email.toLowerCase() !== email.trim().toLowerCase() && !isPlatformAdmin(user.email),
  }));
  const memberships = Object.fromEntries(membershipGroups.map((row) => [row.status, row._count._all]));
  return {
    summary: {
      totalUsers, totalDepartments, usersLast7Days, usersLast30Days,
      activeMemberships: memberships.ACTIVE || 0,
      pendingMemberships: memberships.PENDING || 0,
      inactiveMemberships: memberships.INACTIVE || 0,
      interestTotal: interests.summary.total,
      newInterests: interests.summary.statusCounts.NEW || 0,
      demoRequests: interests.summary.statusCounts.DEMO_REQUESTED || 0,
    },
    recentUsers: accounts,
    departments: departments.map((department) => ({
      id: department.id, name: department.name, plan: department.plan, createdAt: department.createdAt,
      totalMemberships: department._count.memberships, activeMemberships: department.memberships.length,
    })),
    recentInterests: interests.records.slice(0, 10),
  };
}

export async function deleteTestAccount(email: string, targetUserId: string, confirmationEmail: string) {
  if (!isPlatformAdmin(email)) throw new HttpError(403, "Platform administrator access is required.");
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true, memberships: { select: { id: true, departmentId: true } } },
  });
  if (!target || target.email.endsWith(deletedEmailSuffix)) throw new HttpError(404, "Account not found.");
  const normalizedConfirmation = confirmationEmail.trim().toLowerCase();
  if (normalizedConfirmation !== target.email.toLowerCase()) throw new HttpError(400, "Enter the account email exactly to confirm removal.");
  if (target.email.toLowerCase() === email.trim().toLowerCase()) throw new HttpError(400, "You cannot remove the account you are currently using as Master Admin.");
  if (isPlatformAdmin(target.email)) throw new HttpError(400, "Master Admin accounts are protected from account cleanup.");
  const administrator = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
  if (!administrator) throw new HttpError(401, "Master Admin account could not be verified.");

  const deletedAt = Date.now();
  const replacementEmail = `deleted-${target.id}-${deletedAt}${deletedEmailSuffix}`;
  const replacementPasswordHash = await bcrypt.hash(randomBytes(48).toString("base64url"), 10);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.departmentMembership.updateMany({
      where: { userId: target.id },
      data: { status: "INACTIVE", evaluatorStatus: "SUSPENDED", updatedAt: now },
    });
    await tx.personalCredential.deleteMany({ where: { userId: target.id } });
    await tx.personalCareerLog.deleteMany({ where: { userId: target.id } });
    await tx.inboxNotification.deleteMany({ where: { userId: target.id } });
    await tx.pushDevice.deleteMany({ where: { userId: target.id } });
    await tx.notificationPreference.deleteMany({ where: { userId: target.id } });
    await tx.webSignInRequest.updateMany({ where: { approvedUserId: target.id }, data: { approvedUserId: null, status: "REVOKED" } });
    await tx.user.update({
      where: { id: target.id },
      data: { email: replacementEmail, name: "Deleted test account", phone: null, passwordHash: replacementPasswordHash },
    });
    for (const departmentId of [...new Set(target.memberships.map((membership) => membership.departmentId))]) {
      await tx.auditLog.create({
        data: {
          departmentId,
          actorId: administrator.id,
          action: "platform.test_account_removed",
          entityType: "User",
          entityId: target.id,
          detailsJson: JSON.stringify({ membershipIds: target.memberships.filter((membership) => membership.departmentId === departmentId).map((membership) => membership.id), accountEmailReleased: true, preservedTrainingHistory: true }),
        },
      });
    }
  });

  return { id: target.id, removed: true, emailReleased: target.email, preservedDepartmentRecords: true };
}
