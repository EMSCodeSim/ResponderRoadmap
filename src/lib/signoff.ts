export type ReviewStage = "EVALUATOR" | "SUPERVISOR" | "FINAL";
export type ReviewResult = "APPROVED" | "RETURNED";

export type SignOffLike = {
  result: string;
  signedAt: Date | string;
};

export type ReviewerSignOffLike = SignOffLike & {
  evaluatorId: string;
  approvalLevel?: string | null;
};

function asTime(value: Date | string) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function approvalsSinceSubmission(
  signOffs: SignOffLike[],
  submittedAt?: Date | string | null,
) {
  const submitted = submittedAt ? asTime(submittedAt) : Number.NEGATIVE_INFINITY;
  return signOffs.filter(
    (signOff) => signOff.result === "APPROVED" && asTime(signOff.signedAt) >= submitted,
  ).length;
}

export function reviewerSeparationConflict(input: {
  signOffs: ReviewerSignOffLike[];
  reviewerId: string;
  approvalLevel: string;
  submittedAt?: Date | string | null;
}) {
  const submitted = input.submittedAt ? asTime(input.submittedAt) : Number.NEGATIVE_INFINITY;
  return input.signOffs.some(
    (signOff) =>
      signOff.evaluatorId === input.reviewerId &&
      signOff.approvalLevel !== input.approvalLevel &&
      (signOff.result === "APPROVED" || signOff.result === "PASS") &&
      asTime(signOff.signedAt) >= submitted,
  );
}

export function reviewStageForRequirement(input: {
  evaluatorSignOffRequired: boolean;
  supervisorApprovalRequired: boolean;
  signOffs: SignOffLike[];
  submittedAt?: Date | string | null;
}): ReviewStage {
  const approvals = approvalsSinceSubmission(input.signOffs, input.submittedAt);

  if (input.evaluatorSignOffRequired && approvals === 0) return "EVALUATOR";
  if (input.supervisorApprovalRequired) {
    const requiredApprovals = input.evaluatorSignOffRequired ? 2 : 1;
    if (approvals < requiredApprovals) return "SUPERVISOR";
  }
  return "FINAL";
}

export function nextReviewState(input: {
  result: ReviewResult;
  stage: ReviewStage;
  supervisorApprovalRequired: boolean;
  currentApprovedRepetitions: number;
  repetitionsRequired: number;
}) {
  const repetitionsRequired = Math.max(1, input.repetitionsRequired);
  const currentApprovedRepetitions = Math.max(0, input.currentApprovedRepetitions);

  if (input.result === "RETURNED") {
    return {
      status: "RETURNED" as const,
      approvedRepetitions: currentApprovedRepetitions,
      completed: false,
      supervisorPending: false,
    };
  }

  const supervisorPending = input.stage === "EVALUATOR" && input.supervisorApprovalRequired;
  if (supervisorPending) {
    return {
      status: "SUBMITTED" as const,
      approvedRepetitions: currentApprovedRepetitions,
      completed: false,
      supervisorPending: true,
    };
  }

  const approvedRepetitions = Math.min(repetitionsRequired, currentApprovedRepetitions + 1);
  return {
    status: "APPROVED" as const,
    approvedRepetitions,
    completed: approvedRepetitions >= repetitionsRequired,
    supervisorPending: false,
  };
}

export function reviewStageLabel(stage: ReviewStage) {
  if (stage === "EVALUATOR") return "Evaluator review";
  if (stage === "SUPERVISOR") return "Supervisor approval";
  return "Final approval";
}
