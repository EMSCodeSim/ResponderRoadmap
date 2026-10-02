import { prisma } from "@/server/db";
import { HttpError } from "@/server/http";
import { isPlatformAdmin, listInterests } from "@/server/services/interests";

export async function getPlatformAdminDashboard(email: string) {
  if (!isPlatformAdmin(email)) throw new HttpError(403, "Platform administrator access is required.");
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 86_400_000);
  const thirtyDaysAgo = new Date(now - 30 * 86_400_000);
  const [
    totalUsers, totalDepartments, usersLast7Days, usersLast30Days,
    membershipGroups, recentUsers, departments, interests,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.department.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.departmentMembership.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, name: true, email: true, createdAt: true, memberships: { select: { role: true, status: true, department: { select: { id: true, name: true } } } } },
    }),
    prisma.department.findMany({
      orderBy: { createdAt: "desc" }, take: 50,
      select: { id: true, name: true, plan: true, createdAt: true, _count: { select: { memberships: true } }, memberships: { where: { status: "ACTIVE" }, select: { id: true } } },
    }),
    listInterests(email, {}),
  ]);
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
    recentUsers,
    departments: departments.map((department) => ({
      id: department.id, name: department.name, plan: department.plan, createdAt: department.createdAt,
      totalMemberships: department._count.memberships, activeMemberships: department.memberships.length,
    })),
    recentInterests: interests.records.slice(0, 10),
  };
}
