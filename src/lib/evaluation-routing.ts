export const DEFAULT_EVALUATION_ESCALATION_HOURS = 7 * 24;

export type EvaluationWorkspaceView = "needs_me" | "waiting" | "follow_up" | "completed";

export type EvaluationOwnership = {
  nextAction: string;
  owner: string;
  currentOwner: string;
  escalationReason: string | null;
};

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

export function normalizeEvaluationView(view?: string | null): EvaluationWorkspaceView {
  const value = (view || "").trim().toLowerCase();
  if (value === "waiting") return "waiting";
  if (value === "follow_up" || value === "follow-up" || value === "escalated") return "follow_up";
  if (value === "completed" || value === "recent") return "completed";
  // Remediation is folded into Waiting / Needs Me by ownership; default the legacy tab to Waiting.
  if (value === "remediation") return "waiting";
  // Legacy mine/queue aliases become Needs Me.
  return "needs_me";
}

export function resolveAssignedReviewerId(input: {
  reviewStage: string;
  requestedEvaluatorId?: string | null;
  assignmentEvaluatorId?: string | null;
  supervisorId?: string | null;
}) {
  if (input.reviewStage === "SUPERVISOR") return input.supervisorId ?? null;
  return input.requestedEvaluatorId || input.assignmentEvaluatorId || null;
}

export function isEvaluatorStage(stage: string) {
  return stage !== "SUPERVISOR" && stage !== "FINAL";
}

/**
 * Whether the viewer can complete the current approval stage under existing rules.
 * Follow-up / escalation never invents an extra required approval stage for Training Officers.
 */
export function evaluationIsActionableForViewer(input: {
  role: string;
  userId: string;
  status: string;
  reviewStage: string;
  assignedReviewerId: string | null | undefined;
}) {
  if (input.status !== "SUBMITTED") return false;

  if (input.reviewStage === "SUPERVISOR") {
    if (input.assignedReviewerId) return input.assignedReviewerId === input.userId;
    return input.role === "TRAINING_OFFICER" || input.role === "DEPARTMENT_ADMINISTRATOR";
  }

  if (!isEvaluatorStage(input.reviewStage)) return false;

  if (input.role === "EVALUATOR") return true;

  if (input.role === "TRAINING_OFFICER" || input.role === "DEPARTMENT_ADMINISTRATOR") {
    // Training Officers act on evaluator-stage work only when they are the assigned reviewer.
    // Unassigned work stays with authorized evaluators; overdue items surface as Follow-Up only.
    return input.assignedReviewerId === input.userId;
  }

  return false;
}

export function evaluationIsFollowUpOnly(input: {
  role: string;
  userId: string;
  status: string;
  reviewStage: string;
  assignedReviewerId: string | null | undefined;
  submittedAt: Date | string | null | undefined;
  escalationHours: number;
  now?: Date;
}) {
  if (input.status !== "SUBMITTED") return false;
  if (input.role !== "TRAINING_OFFICER" && input.role !== "DEPARTMENT_ADMINISTRATOR") return false;
  if (!isEvaluatorStage(input.reviewStage) && input.reviewStage !== "SUPERVISOR") return false;
  if (input.assignedReviewerId === input.userId) return false;
  if (input.reviewStage === "SUPERVISOR" && !input.assignedReviewerId) return false;
  return isEvaluationOverdue({
    status: input.status,
    submittedAt: input.submittedAt,
    escalationHours: input.escalationHours,
    now: input.now,
  });
}

export function describeEvaluationOwnership(input: {
  status: string;
  requirementTitle: string;
  reviewStage: string;
  approvalPathLength: number;
  escalated: boolean;
  followUpOnly: boolean;
  memberName: string;
  assignedReviewerName: string | null;
  viewerRole: string;
}): EvaluationOwnership {
  const reviewer = input.assignedReviewerName?.trim() || null;
  const escalationReason = input.escalated ? "Exceeded department response target" : null;

  if (input.status === "RETURNED" || input.status === "NEEDS_REMEDIATION") {
    return {
      nextAction: "Correct deficiencies and request reevaluation",
      owner: input.memberName,
      currentOwner: input.memberName,
      escalationReason,
    };
  }

  if (input.status === "APPROVED") {
    return {
      nextAction: "None — evaluation complete",
      owner: reviewer || "—",
      currentOwner: reviewer || "—",
      escalationReason: null,
    };
  }

  if (input.followUpOnly) {
    return {
      nextAction: "Follow up on overdue evaluation",
      owner: input.viewerRole === "DEPARTMENT_ADMINISTRATOR" ? "Department Administrator" : "Training Officer",
      currentOwner: reviewer || "Assigned / authorized evaluator",
      escalationReason: escalationReason || "Exceeded department response target",
    };
  }

  if (input.reviewStage === "SUPERVISOR" || (input.approvalPathLength > 1 && !isEvaluatorStage(input.reviewStage) && input.reviewStage !== "FINAL")) {
    return {
      nextAction: "Second-stage approval",
      owner: reviewer || "Authorized evaluator required by configured approval path",
      currentOwner: reviewer || "Authorized evaluator required by configured approval path",
      escalationReason,
    };
  }

  if (input.approvalPathLength > 1 && input.reviewStage !== "EVALUATOR" && input.reviewStage !== "FINAL") {
    const stageLabel = input.reviewStage.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
    return {
      nextAction: `${stageLabel} approval`,
      owner: reviewer || "Authorized evaluator required by configured approval path",
      currentOwner: reviewer || "Authorized evaluator required by configured approval path",
      escalationReason,
    };
  }

  return {
    nextAction: `Complete ${input.requirementTitle} evaluation`,
    owner: reviewer || "Authorized evaluator",
    currentOwner: reviewer || "Authorized evaluator",
    escalationReason,
  };
}

/**
 * Classify an evaluation into workspace buckets for the current viewer.
 * An item may appear in both Needs Me and Follow-Up when the viewer is the actionable owner and it is overdue.
 */
export function classifyEvaluationBuckets(input: {
  role: string;
  userId: string;
  status: string;
  reviewStage: string;
  assignedReviewerId: string | null | undefined;
  submittedAt: Date | string | null | undefined;
  escalationHours: number;
  hasViewerSignOff: boolean;
  now?: Date;
}): EvaluationWorkspaceView[] {
  const buckets: EvaluationWorkspaceView[] = [];
  const escalated = isEvaluationOverdue({
    status: input.status,
    submittedAt: input.submittedAt,
    escalationHours: input.escalationHours,
    now: input.now,
  });
  const actionable = evaluationIsActionableForViewer({
    role: input.role,
    userId: input.userId,
    status: input.status,
    reviewStage: input.reviewStage,
    assignedReviewerId: input.assignedReviewerId,
  });
  const followUpOnly = evaluationIsFollowUpOnly({
    role: input.role,
    userId: input.userId,
    status: input.status,
    reviewStage: input.reviewStage,
    assignedReviewerId: input.assignedReviewerId,
    submittedAt: input.submittedAt,
    escalationHours: input.escalationHours,
    now: input.now,
  });

  if (input.status === "APPROVED") {
    buckets.push("completed");
  } else if (input.hasViewerSignOff && input.status !== "RETURNED") {
    // Keep prior signed stages visible in Completed while multi-stage work continues elsewhere.
    buckets.push("completed");
  }

  if (input.status === "RETURNED") {
    buckets.push("waiting");
    return buckets;
  }

  if (input.status !== "SUBMITTED") return buckets;

  if (actionable) buckets.push("needs_me");

  if (!actionable && !followUpOnly) {
    // Visible waiting: another owner holds the next evaluation action.
    if (input.role === "TRAINING_OFFICER" || input.role === "DEPARTMENT_ADMINISTRATOR" || input.role === "EVALUATOR") {
      buckets.push("waiting");
    }
  }

  if (escalated && (actionable || followUpOnly || input.assignedReviewerId === input.userId || input.role === "TRAINING_OFFICER" || input.role === "DEPARTMENT_ADMINISTRATOR")) {
    buckets.push("follow_up");
  }

  return buckets;
}

export function evaluationAppearsInView(
  view: EvaluationWorkspaceView,
  buckets: EvaluationWorkspaceView[],
) {
  return buckets.includes(view);
}
