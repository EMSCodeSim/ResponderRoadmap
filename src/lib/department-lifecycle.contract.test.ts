import { describe, expect, it } from "vitest";
import { normalizeClassSkillEvidence } from "./training-evidence";
import { computeAssignmentProgress } from "./progress";
import { nextReviewState } from "./signoff";
import { evaluationIsActionableForViewer } from "./evaluation-routing";

/**
 * Phase 1 department lifecycle contract.
 * A class result is a reusable source record, never an implicit Task Book
 * sign-off, official RMS entry, or department qualification authorization.
 * These tests cover cross-workflow invariants; isolated HTTP smoke tests cover
 * persistence and permissions, and manual mobile testing remains necessary.
 */
describe("instructor-to-qualification lifecycle boundaries", () => {
  const requirements = [{ id: "hose", isRequired: true, repetitionsRequired: 1 }];
  const assignedDate = new Date("2026-10-01T12:00:00Z");
  const now = new Date("2026-10-10T12:00:00Z");
  const skill = {
    classId: "class-1",
    enrollmentId: "enrollment-a",
    membershipId: "member-a",
    trainingTitle: "Hose operations",
    skillTitle: "Advance a charged line",
    requirementId: "hose",
    evaluatedAt: "2026-10-09T18:00:00Z",
    evaluatorName: "Instructor A",
    result: "PASS",
    notes: "Observed in company drill",
  };

  it("preserves class, enrollment and requirement provenance per member", () => {
    const a = normalizeClassSkillEvidence(skill);
    const b = normalizeClassSkillEvidence({
      ...skill, enrollmentId: "enrollment-b", membershipId: "member-b", result: "FAIL",
    });
    expect(a.sourceRecordId).toBe("class-1:enrollment-a:hose");
    expect(b.sourceRecordId).toBe("class-1:enrollment-b:hose");
    expect(a.sourceRecordId).not.toBe(b.sourceRecordId);
    expect(a.memberId).toBe("member-a");
    expect(b.memberId).toBe("member-b");
    expect(a.state).toBe("RECORDED");
    expect(b.state).toBe("RETURNED");
    expect(a.rmsEntered).toBe(false);
    expect(b.rmsEntered).toBe(false);
  });

  it("does not grant Task Book completion for a passing class result alone", () => {
    const evidence = normalizeClassSkillEvidence(skill);
    expect(evidence.state).toBe("RECORDED");
    const progress = computeAssignmentProgress({
      requirements,
      completions: [],
      assignedDate,
      now,
    });
    expect(progress.complete).toBe(0);
    expect(progress.percent).toBe(0);
  });

  it("keeps submitted and returned sign-offs out of approved credit", () => {
    for (const status of ["SUBMITTED", "RETURNED"]) {
      const progress = computeAssignmentProgress({
        requirements,
        completions: [{ requirementId: "hose", status, repetitionCount: 1 }],
        assignedDate,
        now,
      });
      expect(progress.complete).toBe(0);
    }
  });

  it("lets the assigned authorized evaluator approve without mandatory officer review", () => {
    expect(evaluationIsActionableForViewer({
      role: "EVALUATOR", userId: "evaluator-a", status: "SUBMITTED",
      reviewStage: "EVALUATOR", assignedReviewerId: "evaluator-a",
    })).toBe(true);
    expect(evaluationIsActionableForViewer({
      role: "TRAINING_OFFICER", userId: "officer-a", status: "SUBMITTED",
      reviewStage: "EVALUATOR", assignedReviewerId: "evaluator-a",
    })).toBe(false);
    const decision = nextReviewState({
      result: "APPROVED", stage: "EVALUATOR", supervisorApprovalRequired: false,
      currentApprovedRepetitions: 0, repetitionsRequired: 1,
    });
    expect(decision).toMatchObject({ completed: true, status: "APPROVED" });
  });

  it("requires a second approval when the requirement explicitly specifies it", () => {
    const decision = nextReviewState({
      result: "APPROVED", stage: "EVALUATOR", supervisorApprovalRequired: true,
      currentApprovedRepetitions: 0, repetitionsRequired: 1,
    });
    expect(decision).toMatchObject({
      completed: false, status: "SUBMITTED", supervisorPending: true,
    });
  });
});
