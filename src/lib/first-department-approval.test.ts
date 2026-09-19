import { describe, expect, it } from "vitest";
import { computeAssignmentProgress } from "@/lib/progress";
import { nextReviewState, reviewStageForRequirement } from "@/lib/signoff";

describe("first department: evaluator to final approval", () => {
  const requirement = { id: "first-skill", isRequired: true, repetitionsRequired: 1 };
  const assignedDate = new Date("2026-09-18T09:00:00Z");
  const submittedAt = new Date("2026-09-18T10:00:00Z");

  function progress(status: string, repetitionCount: number) {
    return computeAssignmentProgress({
      requirements: [requirement],
      completions: [{ requirementId: requirement.id, status, repetitionCount }],
      assignedDate,
      now: submittedAt,
    });
  }

  it("never counts an evaluator approval until final supervisor approval", () => {
    const evaluatorStage = reviewStageForRequirement({
      evaluatorSignOffRequired: true,
      supervisorApprovalRequired: true,
      signOffs: [],
      submittedAt,
    });
    expect(evaluatorStage).toBe("EVALUATOR");
    expect(progress("SUBMITTED", 0)).toMatchObject({ complete: 0, pendingApproval: 1, percent: 0, status: "AWAITING_SIGN_OFF" });

    const evaluatorDecision = nextReviewState({
      result: "APPROVED",
      stage: evaluatorStage,
      supervisorApprovalRequired: true,
      currentApprovedRepetitions: 0,
      repetitionsRequired: 1,
    });
    expect(evaluatorDecision).toMatchObject({ status: "SUBMITTED", approvedRepetitions: 0, completed: false, supervisorPending: true });
    expect(progress(evaluatorDecision.status, evaluatorDecision.approvedRepetitions)).toMatchObject({
      complete: 0, pendingApproval: 1, percent: 0, status: "AWAITING_SIGN_OFF",
    });

    const supervisorStage = reviewStageForRequirement({
      evaluatorSignOffRequired: true,
      supervisorApprovalRequired: true,
      signOffs: [{ result: "APPROVED", signedAt: new Date("2026-09-18T10:05:00Z") }],
      submittedAt,
    });
    expect(supervisorStage).toBe("SUPERVISOR");
    const finalDecision = nextReviewState({
      result: "APPROVED",
      stage: supervisorStage,
      supervisorApprovalRequired: true,
      currentApprovedRepetitions: evaluatorDecision.approvedRepetitions,
      repetitionsRequired: 1,
    });
    expect(finalDecision).toMatchObject({ status: "APPROVED", approvedRepetitions: 1, completed: true, supervisorPending: false });
    expect(progress(finalDecision.status, finalDecision.approvedRepetitions)).toMatchObject({
      complete: 1, pendingApproval: 0, percent: 100, status: "COMPLETE",
    });
  });

  it("a returned final review never increments completed progress", () => {
    const decision = nextReviewState({
      result: "RETURNED", stage: "SUPERVISOR", supervisorApprovalRequired: true,
      currentApprovedRepetitions: 0, repetitionsRequired: 1,
    });
    expect(decision.completed).toBe(false);
    expect(progress(decision.status, decision.approvedRepetitions)).toMatchObject({ complete: 0, percent: 0 });
  });
});
