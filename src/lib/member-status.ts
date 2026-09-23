export const OPERATIONAL_STATUSES = ["On Track", "Needs Attention", "Awaiting Evaluation", "Completed"] as const;
export type OperationalStatus = (typeof OPERATIONAL_STATUSES)[number];

export type OperationalAssignment = {
  status: string;
  pendingApproval: number;
  overdue: number;
  percent: number;
  stalledDays?: number;
};

/**
 * Operational awareness only — never a performance score or ranking.
 * Completed requires every assigned item to be fully approved.
 */
export function memberOperationalStatus(
  assignments: OperationalAssignment[],
  stalledThresholdDays = 14,
): OperationalStatus {
  if (assignments.length === 0) return "On Track";
  if (assignments.every((item) => item.status === "COMPLETE")) return "Completed";
  if (
    assignments.some(
      (item) => item.pendingApproval > 0 || item.status === "AWAITING_SIGN_OFF",
    )
  ) {
    return "Awaiting Evaluation";
  }
  if (
    assignments.some(
      (item) =>
        item.status === "OVERDUE" ||
        item.overdue > 0 ||
        (item.stalledDays ?? 0) >= stalledThresholdDays,
    )
  ) {
    return "Needs Attention";
  }
  return "On Track";
}

export function operationalStatusTone(status: OperationalStatus): "current" | "warn" | "danger" | "neutral" {
  if (status === "Completed" || status === "On Track") return "current";
  if (status === "Awaiting Evaluation") return "warn";
  if (status === "Needs Attention") return "danger";
  return "neutral";
}
