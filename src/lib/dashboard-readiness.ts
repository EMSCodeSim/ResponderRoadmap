export type ReadinessRole = { id: string; configured: boolean };
export type ReadinessAssessment = { roleId: string; status: string; requirementsMet: boolean; reviewDue: boolean };

export function summarizeDepartmentReadiness(roles: ReadinessRole[], assessments: ReadinessAssessment[]) {
  const configuredIds = new Set(roles.filter((role) => role.configured).map((role) => role.id));
  const summary = {
    configuredRoleCount: configuredIds.size,
    unconfiguredRoleCount: roles.length - configuredIds.size,
    ready: 0,
    attention: 0,
    notReady: 0,
    assigned: 0,
  };

  for (const assessment of assessments) {
    if (!configuredIds.has(assessment.roleId)) continue;
    summary.assigned += 1;
    if (assessment.status === "APPROVED" && assessment.requirementsMet && !assessment.reviewDue) summary.ready += 1;
    else if (assessment.status === "AWAITING_APPROVAL" || assessment.status === "RENEWAL_REQUIRED" || (assessment.status === "APPROVED" && assessment.requirementsMet && assessment.reviewDue)) summary.attention += 1;
    else summary.notReady += 1;
  }

  return summary;
}
