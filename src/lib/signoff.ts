export type ReviewStage = "EVALUATOR" | "SUPERVISOR" | "FINAL";

export type SignOffLike = {
  result: string;
  signedAt: Date | string;
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

export function reviewStageForRequirement(input: {
  evaluatorSignOffRequired: boolean;
  supervisorApprovalRequired: boolean;
  signOffs: SignOffLike[];
  submittedAt?: Date | string | null;
}): ReviewStage {
  const approvals = approvalsSinceSubmission(input.signOffs, input.submittedAt);

  if (input.evaluatorSignOffRequired && approvals === 0) return "EVALUATOR";
  if (input.supervisorApprovalRequired) {
    const evaluatorDone = !input.evaluatorSignOffRequired || approvals >= 1;
    if (evaluatorDone) return "SUPERVISOR";
  }
  return "FINAL";
}

export function reviewStageLabel(stage: ReviewStage) {
  if (stage === "EVALUATOR") return "Evaluator review";
  if (stage === "SUPERVISOR") return "Supervisor approval";
  return "Final approval";
}
