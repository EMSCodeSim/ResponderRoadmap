import { describe, expect, it } from "vitest";
import { approvalsSinceSubmission, nextReviewState, reviewerSeparationConflict, reviewStageForRequirement } from "./signoff";

const submittedAt = new Date("2026-09-21T12:00:00.000Z");
const evaluatorApproval = { evaluatorId: "evaluator-a", approvalLevel: "EVALUATOR", result: "APPROVED", signedAt: new Date("2026-09-21T12:01:00.000Z") };

describe("two-stage approval integrity", () => {
  it("keeps a submitted requirement incomplete after evaluator approval when supervisor sign-off is required", () => {
    expect(reviewStageForRequirement({ evaluatorSignOffRequired: true, supervisorApprovalRequired: true, signOffs: [], submittedAt })).toBe("EVALUATOR");
    expect(nextReviewState({ result: "APPROVED", stage: "EVALUATOR", supervisorApprovalRequired: true, currentApprovedRepetitions: 0, repetitionsRequired: 1 })).toEqual({ status: "SUBMITTED", approvedRepetitions: 0, completed: false, supervisorPending: true });
    expect(reviewStageForRequirement({ evaluatorSignOffRequired: true, supervisorApprovalRequired: true, signOffs: [evaluatorApproval], submittedAt })).toBe("SUPERVISOR");
  });

  it("counts the repetition only after a separate supervisor approves", () => {
    const supervisorApproval = { evaluatorId: "supervisor-b", approvalLevel: "SUPERVISOR", result: "APPROVED", signedAt: new Date("2026-09-21T12:02:00.000Z") };
    expect(reviewerSeparationConflict({ signOffs: [evaluatorApproval], reviewerId: "supervisor-b", approvalLevel: "SUPERVISOR", submittedAt })).toBe(false);
    expect(nextReviewState({ result: "APPROVED", stage: "SUPERVISOR", supervisorApprovalRequired: true, currentApprovedRepetitions: 0, repetitionsRequired: 1 })).toEqual({ status: "APPROVED", approvedRepetitions: 1, completed: true, supervisorPending: false });
    expect(approvalsSinceSubmission([evaluatorApproval, supervisorApproval], submittedAt)).toBe(2);
    expect(reviewStageForRequirement({ evaluatorSignOffRequired: true, supervisorApprovalRequired: true, signOffs: [evaluatorApproval, supervisorApproval], submittedAt })).toBe("FINAL");
  });

  it("rejects the same person signing evaluator and supervisor stages", () => {
    expect(reviewerSeparationConflict({ signOffs: [evaluatorApproval], reviewerId: "evaluator-a", approvalLevel: "SUPERVISOR", submittedAt })).toBe(true);
    expect(reviewerSeparationConflict({ signOffs: [evaluatorApproval], reviewerId: "evaluator-a", approvalLevel: "EVALUATOR", submittedAt })).toBe(false);
  });

  it("does not count an approval from before the current submission or a return", () => {
    const oldApproval = { ...evaluatorApproval, signedAt: new Date("2026-09-21T11:59:00.000Z") };
    const returned = { result: "RETURNED", signedAt: new Date("2026-09-21T12:03:00.000Z") };
    expect(approvalsSinceSubmission([oldApproval, returned], submittedAt)).toBe(0);
    expect(reviewerSeparationConflict({ signOffs: [oldApproval], reviewerId: "evaluator-a", approvalLevel: "SUPERVISOR", submittedAt })).toBe(false);
    expect(reviewStageForRequirement({ evaluatorSignOffRequired: true, supervisorApprovalRequired: true, signOffs: [oldApproval, returned], submittedAt })).toBe("EVALUATOR");
  });

  it("a supervisor return does not mark the requirement complete", () => {
    expect(nextReviewState({ result: "RETURNED", stage: "SUPERVISOR", supervisorApprovalRequired: true, currentApprovedRepetitions: 0, repetitionsRequired: 1 })).toEqual({ status: "RETURNED", approvedRepetitions: 0, completed: false, supervisorPending: false });
  });
});
