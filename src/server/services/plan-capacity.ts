import { Prisma } from "@prisma/client";

export const ACTIVE_MEMBER_WINDOW_DAYS = 90;
export const PLAN_MEMBER_CAPS: Readonly<Record<string, number>> = Object.freeze({
  FREE: 5,
  STATION: 25,
  FOUNDING: 75,
  FOUNDING_DEPARTMENT: 75,
});

export function memberCap(plan: string): number | null {
  return PLAN_MEMBER_CAPS[plan] ?? null;
}

/**
 * A member counts only when the department membership is active AND either the
 * member has been assigned a Task Book (including single training assignments)
 * or a successful department sign-in was logged in the preceding 90 days.
 *
 * Historical sign-ins are not currently recorded, so this predicate must not
 * replace legacy enforcement until every login path records USER_LOGIN and
 * existing departments have a safe transition policy.
 */
export function activeMemberFilter(departmentId: string, now = new Date()): Prisma.DepartmentMembershipWhereInput {
  const cutoff = new Date(now.getTime() - ACTIVE_MEMBER_WINDOW_DAYS * 86_400_000);
  return {
    departmentId,
    status: "ACTIVE",
    OR: [
      { assignments: { some: {} } },
      { user: { activityEvents: { some: { departmentId, type: "USER_LOGIN", timestamp: { gte: cutoff } } } } },
    ],
  };
}

export async function countActiveMembers(tx: Pick<Prisma.TransactionClient, "departmentMembership">, departmentId: string, now = new Date()) {
  return tx.departmentMembership.count({ where: activeMemberFilter(departmentId, now) });
}
