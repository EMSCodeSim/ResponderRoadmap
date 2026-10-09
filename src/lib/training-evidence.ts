/**
 * Common read-only language for evidence collected by distinct Roadmap workflows.
 * Source records remain authoritative; normalization does not grant approval,
 * duplicate credit, alter provenance, or imply official RMS entry.
 */
export type TrainingEvidenceSource = "TRAINING_SHEET" | "TASK_BOOK" | "ASSIGNMENT" | "CERTIFICATION" | "EVALUATION";
export type TrainingEvidenceState = "RECORDED" | "SUBMITTED" | "VERIFIED" | "RETURNED" | "NOT_EVALUATED";

export type TrainingEvidence = {
  source: TrainingEvidenceSource;
  sourceRecordId: string;
  memberId: string | null;
  activityTitle: string;
  occurredAt: string | null;
  collectedBy: string | null;
  state: TrainingEvidenceState;
  evidenceDescription: string | null;
  evaluatorName: string | null;
  rmsEntered: boolean;
};

/** A recorded class result is evidence, not an automatic qualification sign-off. */
export function normalizeClassSkillEvidence(input: {
  classId: string; enrollmentId: string; membershipId: string | null;
  trainingTitle: string; skillTitle: string; requirementId: string;
  evaluatedAt: string | null; evaluatorName: string | null;
  result: string; notes: string | null;
}): TrainingEvidence {
  return {
    source: "TRAINING_SHEET",
    sourceRecordId: `${input.classId}:${input.enrollmentId}:${input.requirementId}`,
    memberId: input.membershipId,
    activityTitle: `${input.trainingTitle} — ${input.skillTitle}`,
    occurredAt: input.evaluatedAt,
    collectedBy: input.evaluatorName,
    state: input.result === "NEEDS_REMEDIATION" || input.result === "FAIL" ? "RETURNED"
      : input.result === "NOT_EVALUATED" ? "NOT_EVALUATED" : "RECORDED",
    evidenceDescription: input.notes,
    evaluatorName: input.evaluatorName,
    rmsEntered: false,
  };
}
