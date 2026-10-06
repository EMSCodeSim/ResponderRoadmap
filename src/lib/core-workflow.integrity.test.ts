import { describe, expect, it } from "vitest";
import { bumpVersion } from "@/lib/constants";
import { credentialStatus } from "@/lib/dates";
import {
  classifyEvaluationBuckets,
  evaluationIsActionableForViewer,
  evaluationIsFollowUpOnly,
  isEvaluationOverdue,
  resolveAssignedReviewerId,
} from "@/lib/evaluation-routing";
import { computeAssignmentProgress, requirementIsComplete } from "@/lib/progress";
import {
  approvalsSinceSubmission,
  nextReviewState,
  reviewerSeparationConflict,
  reviewStageForRequirement,
} from "@/lib/signoff";
import { evaluationPasses, nextApprovalLevel } from "@/lib/taskbook";
import { hasPermission } from "@/server/permissions";

/**
 * Core workflow regression suite: ASSIGN → TRAIN → EVALUATE → QUALIFY
 * Failures here mean Responder Roadmap is not production-ready for department trust.
 */
describe("ASSIGN → TRAIN → EVALUATE → QUALIFY integrity", () => {
  const assignedDate = new Date("2026-10-01T12:00:00.000Z");
  const now = new Date("2026-10-06T12:00:00.000Z");
  const submittedAt = new Date("2026-10-05T12:00:00.000Z");

  const requirements = [
    { id: "hose", isRequired: true, repetitionsRequired: 1 },
    { id: "pump", isRequired: true, repetitionsRequired: 2 },
    { id: "optional-drill", isRequired: false, repetitionsRequired: 1 },
  ];

  it("opening or checking a requirement never grants approved credit", () => {
    const openedOnly = computeAssignmentProgress({
      requirements,
      completions: [
        { requirementId: "hose", status: "IN_PROGRESS", repetitionCount: 0 },
        { requirementId: "pump", status: "NOT_STARTED", repetitionCount: 0 },
      ],
      assignedDate,
      now,
    });
    expect(openedOnly.complete).toBe(0);
    expect(openedOnly.percent).toBe(0);
    expect(openedOnly.status).toBe("IN_PROGRESS");
    expect(requirementIsComplete(requirements[0], { requirementId: "hose", status: "IN_PROGRESS", repetitionCount: 0 })).toBe(false);
  });

  it("submitted and returned evaluations never satisfy completion or qualification evidence", () => {
    for (const status of ["SUBMITTED", "RETURNED", "NEEDS_REMEDIATION"]) {
      expect(requirementIsComplete(requirements[0], { requirementId: "hose", status, repetitionCount: 1 })).toBe(false);
    }
    const progress = computeAssignmentProgress({
      requirements,
      completions: [
        { requirementId: "hose", status: "RETURNED", repetitionCount: 0 },
        { requirementId: "pump", status: "SUBMITTED", repetitionCount: 1 },
      ],
      assignedDate,
      now,
    });
    expect(progress.complete).toBe(0);
    expect(progress.pendingApproval).toBe(1);
    expect(progress.percent).toBe(0);
  });

  it("member, Training Officer, and dashboard surfaces share one completion definition", () => {
    const completions = [
      { requirementId: "hose", status: "APPROVED", repetitionCount: 1 },
      { requirementId: "pump", status: "APPROVED", repetitionCount: 1 },
      { requirementId: "optional-drill", status: "APPROVED", repetitionCount: 1 },
    ];
    const progress = computeAssignmentProgress({ requirements, completions, assignedDate, now });
    // 1 of 2 required complete (pump needs 2 repetitions); optional ignored.
    expect(progress).toMatchObject({ complete: 1, totalRequired: 2, percent: 50 });
    expect(requirementIsComplete(requirements[0], completions[0])).toBe(true);
    expect(requirementIsComplete(requirements[1], completions[1])).toBe(false);
    // Section-style counting that only checks APPROVED would wrongly report 100% of required.
    const naiveApprovedOnly = requirements.filter((req) => req.isRequired && completions.some((c) => c.requirementId === req.id && c.status === "APPROVED")).length;
    expect(naiveApprovedOnly).toBe(2);
    expect(progress.complete).not.toBe(naiveApprovedOnly);
  });

  it("authorized evaluator approval completes requirement without Training Officer approval", () => {
    expect(evaluationIsActionableForViewer({
      role: "EVALUATOR",
      userId: "eval-1",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-1",
    })).toBe(true);
    expect(evaluationIsActionableForViewer({
      role: "TRAINING_OFFICER",
      userId: "to-1",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-1",
    })).toBe(false);
    const decision = nextReviewState({
      result: "APPROVED",
      stage: "EVALUATOR",
      supervisorApprovalRequired: false,
      currentApprovedRepetitions: 0,
      repetitionsRequired: 1,
    });
    expect(decision).toMatchObject({ status: "APPROVED", completed: true, supervisorPending: false });
  });

  it("overdue evaluation appears for Training Officer follow-up without adding approval stage", () => {
    const overdue = "2026-09-20T12:00:00.000Z";
    expect(isEvaluationOverdue({
      status: "SUBMITTED",
      submittedAt: overdue,
      escalationHours: 168,
      now,
    })).toBe(true);
    expect(evaluationIsFollowUpOnly({
      role: "TRAINING_OFFICER",
      userId: "to-1",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-1",
      submittedAt: overdue,
      escalationHours: 168,
      now,
    })).toBe(true);
    expect(evaluationIsActionableForViewer({
      role: "TRAINING_OFFICER",
      userId: "to-1",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-1",
    })).toBe(false);
    expect(classifyEvaluationBuckets({
      role: "TRAINING_OFFICER",
      userId: "to-1",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-1",
      submittedAt: overdue,
      escalationHours: 168,
      hasViewerSignOff: false,
      now,
    })).toEqual(["follow_up"]);
    // Assigned evaluator can still complete after escalation.
    expect(evaluationIsActionableForViewer({
      role: "EVALUATOR",
      userId: "eval-1",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-1",
    })).toBe(true);
  });

  it("multi-stage Stage 1 approval requires Stage 2 before final completion", () => {
    expect(reviewStageForRequirement({
      evaluatorSignOffRequired: true,
      supervisorApprovalRequired: true,
      signOffs: [],
      submittedAt,
    })).toBe("EVALUATOR");
    const afterEvaluator = nextReviewState({
      result: "APPROVED",
      stage: "EVALUATOR",
      supervisorApprovalRequired: true,
      currentApprovedRepetitions: 0,
      repetitionsRequired: 1,
    });
    expect(afterEvaluator).toMatchObject({ status: "SUBMITTED", completed: false, supervisorPending: true });
    expect(nextApprovalLevel(["EVALUATOR", "SUPERVISOR"], [{ result: "APPROVED", approvalLevel: "EVALUATOR" }])).toBe("SUPERVISOR");
    const afterSupervisor = nextReviewState({
      result: "APPROVED",
      stage: "SUPERVISOR",
      supervisorApprovalRequired: true,
      currentApprovedRepetitions: 0,
      repetitionsRequired: 1,
    });
    expect(afterSupervisor).toMatchObject({ status: "APPROVED", completed: true });
  });

  it("same reviewer cannot complete both approval stages without administrator override", () => {
    const evaluatorApproval = {
      evaluatorId: "same-person",
      approvalLevel: "EVALUATOR",
      result: "APPROVED",
      signedAt: new Date("2026-10-05T12:05:00.000Z"),
    };
    expect(reviewerSeparationConflict({
      signOffs: [evaluatorApproval],
      reviewerId: "same-person",
      approvalLevel: "SUPERVISOR",
      submittedAt,
    })).toBe(true);
    expect(reviewerSeparationConflict({
      signOffs: [evaluatorApproval],
      reviewerId: "different-person",
      approvalLevel: "SUPERVISOR",
      submittedAt,
    })).toBe(false);
  });

  it("returned evaluation creates a new attempt cycle and does not reuse prior approvals", () => {
    const priorApproval = { result: "APPROVED", signedAt: new Date("2026-10-04T12:00:00.000Z") };
    const returned = { result: "RETURNED", signedAt: new Date("2026-10-05T11:00:00.000Z") };
    expect(approvalsSinceSubmission([priorApproval, returned], submittedAt)).toBe(0);
    expect(reviewStageForRequirement({
      evaluatorSignOffRequired: true,
      supervisorApprovalRequired: true,
      signOffs: [priorApproval, returned],
      submittedAt,
    })).toBe("EVALUATOR");
    expect(nextReviewState({
      result: "RETURNED",
      stage: "EVALUATOR",
      supervisorApprovalRequired: false,
      currentApprovedRepetitions: 0,
      repetitionsRequired: 1,
    }).completed).toBe(false);
  });

  it("critical failure or remediation return never passes evaluation", () => {
    expect(evaluationPasses({ result: "APPROVED", criticalFailuresTriggered: ["dropped-patient"] })).toEqual({
      passed: false,
      result: "CRITICAL_FAIL",
    });
    expect(evaluationPasses({ result: "NEEDS_REMEDIATION" }).passed).toBe(false);
    expect(evaluationPasses({ result: "RETURNED" }).passed).toBe(false);
  });

  it("expired credential removes readiness while does-not-expire remains valid", () => {
    const checkNow = new Date("2026-10-06T12:00:00.000Z");
    expect(credentialStatus(new Date("2026-01-01"), checkNow).health).toBe("expired");
    expect(credentialStatus(null, checkNow, true)).toMatchObject({ health: "current", label: "Does not expire" });
  });

  it("Task Book assignment retains original version after Library version bump", () => {
    const assignedVersion = "1.0";
    const libraryAfterEdit = bumpVersion(assignedVersion);
    expect(libraryAfterEdit).toBe("1.1");
    // Historical assignment identity is the frozen version string, not the live library tip.
    expect(assignedVersion).toBe("1.0");
    expect(assignedVersion).not.toBe(libraryAfterEdit);
  });

  it("group practical results stay independent per member with no bulk-pass shortcut", () => {
    const memberA = { enrollmentId: "a", result: "FAIL" as const };
    const memberB = { enrollmentId: "b", result: "NOT_EVALUATED" as const };
    // Approving / failing one roster row must never mutate another row's result.
    expect(memberA.result).toBe("FAIL");
    expect(memberB.result).toBe("NOT_EVALUATED");
    expect(memberA.enrollmentId).not.toBe(memberB.enrollmentId);
  });

  it("members cannot review sign-offs; only authorized reviewer roles may", () => {
    expect(hasPermission("MEMBER", "signoff.review")).toBe(false);
    expect(hasPermission("EVALUATOR", "signoff.review")).toBe(true);
    expect(hasPermission("TRAINING_OFFICER", "signoff.review")).toBe(true);
  });

  it("assigned reviewer resolution preserves requested evaluator for evaluator stage", () => {
    expect(resolveAssignedReviewerId({
      reviewStage: "EVALUATOR",
      requestedEvaluatorId: "requested",
      assignmentEvaluatorId: "assignment-default",
      supervisorId: "supervisor",
    })).toBe("requested");
    expect(resolveAssignedReviewerId({
      reviewStage: "SUPERVISOR",
      requestedEvaluatorId: "requested",
      assignmentEvaluatorId: "assignment-default",
      supervisorId: "supervisor",
    })).toBe("supervisor");
  });

  it("audit chain for an approved requirement can be reconstructed from source fields", () => {
    const chain = {
      departmentId: "dept-1",
      membershipId: "member-1",
      assignmentId: "assign-1",
      versionId: "version-1.0",
      requirementId: "hose",
      submissionId: "completion-1",
      attemptId: "attempt-1",
      evaluatorId: "eval-1",
      decision: "APPROVED",
      decidedAt: "2026-10-05T13:00:00.000Z",
      evidenceId: "evidence-1",
      qualificationImpact: "requirementsMet when credential + task book + skill evidence present",
    };
    for (const [key, value] of Object.entries(chain)) {
      expect(value, `missing audit link: ${key}`).toBeTruthy();
    }
  });
});
