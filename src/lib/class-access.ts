import type { Role } from "@/lib/constants";

export function classListScope(role: Role, userId: string, view?: string) {
  if (role === "EVALUATOR") {
    return { proctors: { some: { userId } } };
  }
  if (role === "INSTRUCTOR" || view === "mine") {
    return {
      OR: [
        { createdById: userId },
        { proctors: { some: { userId } } },
      ],
    };
  }
  return {};
}

export function canViewClassRecord(
  role: Role,
  userId: string,
  createdById: string,
  assignedProctorUserIds: string[],
) {
  if (role === "INSTRUCTOR") {
    return createdById === userId || assignedProctorUserIds.includes(userId);
  }
  if (role === "EVALUATOR") {
    return assignedProctorUserIds.includes(userId);
  }
  return true;
}
