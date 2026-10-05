export const DEFAULT_EVALUATION_ESCALATION_HOURS = 7 * 24;

export function resolveEvaluationEscalationHours(value: number | null | undefined) {
  return Math.max(1, value ?? DEFAULT_EVALUATION_ESCALATION_HOURS);
}

export function isEvaluationOverdue(input: {
  status: string;
  submittedAt: Date | string | null | undefined;
  escalationHours: number;
  now?: Date;
}) {
  if (input.status !== "SUBMITTED" || !input.submittedAt) return false;
  const submittedAt = input.submittedAt instanceof Date ? input.submittedAt : new Date(input.submittedAt);
  if (Number.isNaN(submittedAt.getTime())) return false;
  const now = input.now ?? new Date();
  return now.getTime() - submittedAt.getTime() >= input.escalationHours * 3_600_000;
}

export function trainingOfficerShouldSeeEvaluation(input: {
  trainingOfficerUserId: string;
  assignedReviewerId: string | null | undefined;
  status: string;
  submittedAt: Date | string | null | undefined;
  escalationHours: number;
  now?: Date;
}) {
  if (input.status !== "SUBMITTED") return false;
  if (input.assignedReviewerId === input.trainingOfficerUserId) return true;
  return isEvaluationOverdue({
    status: input.status,
    submittedAt: input.submittedAt,
    escalationHours: input.escalationHours,
    now: input.now,
  });
}
