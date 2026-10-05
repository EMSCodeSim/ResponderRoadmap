import { describe, expect, it } from "vitest";
import {
  DEFAULT_EVALUATION_ESCALATION_HOURS,
  classifyEvaluationBuckets,
  describeEvaluationOwnership,
  evaluationIsActionableForViewer,
  evaluationIsFollowUpOnly,
  isEvaluationOverdue,
  normalizeEvaluationView,
  resolveEvaluationEscalationHours,
  trainingOfficerShouldSeeEvaluation,
} from "@/lib/evaluation-routing";

describe("evaluation routing", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");

  it("uses a seven-calendar-day default when no department setting exists", () => {
    expect(DEFAULT_EVALUATION_ESCALATION_HOURS).toBe(168);
    expect(resolveEvaluationEscalationHours(null)).toBe(168);
    expect(resolveEvaluationEscalationHours(undefined)).toBe(168);
    expect(resolveEvaluationEscalationHours(72)).toBe(72);
  });

  it("shows a Training Officer an assigned evaluation immediately", () => {
    expect(trainingOfficerShouldSeeEvaluation({
      trainingOfficerUserId: "to-1",
      assignedReviewerId: "to-1",
      status: "SUBMITTED",
      submittedAt: "2026-10-10T11:00:00.000Z",
      escalationHours: 168,
      now,
    })).toBe(true);
  });

  it("does not show an unassigned-to-them evaluation before the threshold", () => {
    expect(trainingOfficerShouldSeeEvaluation({
      trainingOfficerUserId: "to-1",
      assignedReviewerId: "eval-1",
      status: "SUBMITTED",
      submittedAt: "2026-10-04T12:00:01.000Z",
      escalationHours: 168,
      now,
    })).toBe(false);
  });

  it("surfaces overdue evaluator sign-offs as Training Officer follow-up", () => {
    expect(trainingOfficerShouldSeeEvaluation({
      trainingOfficerUserId: "to-1",
      assignedReviewerId: "eval-1",
      status: "SUBMITTED",
      submittedAt: "2026-10-03T12:00:00.000Z",
      escalationHours: 168,
      now,
    })).toBe(true);
  });

  it("never treats a closed evaluation as overdue follow-up", () => {
    for (const status of ["APPROVED", "RETURNED", "CANCELLED", "COMPLETE"]) {
      expect(isEvaluationOverdue({
        status,
        submittedAt: "2026-09-01T00:00:00.000Z",
        escalationHours: 24,
        now,
      })).toBe(false);
    }
  });
});

describe("evaluation workspace views", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");
  const fresh = "2026-10-10T11:00:00.000Z";
  const overdue = "2026-10-01T12:00:00.000Z";

  it("normalizes legacy and preferred view labels", () => {
    expect(normalizeEvaluationView(undefined)).toBe("needs_me");
    expect(normalizeEvaluationView("mine")).toBe("needs_me");
    expect(normalizeEvaluationView("queue")).toBe("needs_me");
    expect(normalizeEvaluationView("waiting")).toBe("waiting");
    expect(normalizeEvaluationView("follow-up")).toBe("follow_up");
    expect(normalizeEvaluationView("follow_up")).toBe("follow_up");
    expect(normalizeEvaluationView("recent")).toBe("completed");
    expect(normalizeEvaluationView("completed")).toBe("completed");
    expect(normalizeEvaluationView("remediation")).toBe("waiting");
  });

  it("puts an evaluation assigned to Evaluator A in Evaluator A's Needs Me view", () => {
    expect(evaluationIsActionableForViewer({
      role: "EVALUATOR",
      userId: "eval-a",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-a",
    })).toBe(true);
    expect(classifyEvaluationBuckets({
      role: "EVALUATOR",
      userId: "eval-a",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-a",
      submittedAt: fresh,
      escalationHours: 168,
      hasViewerSignOff: false,
      now,
    })).toEqual(["needs_me"]);
  });

  it("does not make an ordinary evaluation a required Training Officer approval", () => {
    expect(evaluationIsActionableForViewer({
      role: "TRAINING_OFFICER",
      userId: "to-1",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-a",
    })).toBe(false);
    expect(evaluationIsFollowUpOnly({
      role: "TRAINING_OFFICER",
      userId: "to-1",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-a",
      submittedAt: fresh,
      escalationHours: 168,
      now,
    })).toBe(false);
    expect(classifyEvaluationBuckets({
      role: "TRAINING_OFFICER",
      userId: "to-1",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-a",
      submittedAt: fresh,
      escalationHours: 168,
      hasViewerSignOff: false,
      now,
    })).toEqual(["waiting"]);
  });

  it("keeps authorized evaluators able to complete evaluator-stage sign-off", () => {
    expect(evaluationIsActionableForViewer({
      role: "EVALUATOR",
      userId: "eval-b",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-a",
    })).toBe(true);
  });

  it("classifies another owner's evaluation as waiting / read-only for Training Officers", () => {
    const buckets = classifyEvaluationBuckets({
      role: "TRAINING_OFFICER",
      userId: "to-1",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-a",
      submittedAt: fresh,
      escalationHours: 168,
      hasViewerSignOff: false,
      now,
    });
    expect(buckets).toContain("waiting");
    expect(buckets).not.toContain("needs_me");
    expect(describeEvaluationOwnership({
      status: "SUBMITTED",
      requirementTitle: "Pump Operations",
      reviewStage: "EVALUATOR",
      approvalPathLength: 1,
      escalated: false,
      followUpOnly: false,
      memberName: "Firefighter Smith",
      assignedReviewerName: "Capt. Jones",
      viewerRole: "TRAINING_OFFICER",
    })).toMatchObject({
      nextAction: "Complete Pump Operations evaluation",
      owner: "Capt. Jones",
    });
  });

  it("surfaces overdue evaluations in Follow-Up without adding an approval stage", () => {
    expect(evaluationIsFollowUpOnly({
      role: "TRAINING_OFFICER",
      userId: "to-1",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-a",
      submittedAt: overdue,
      escalationHours: 168,
      now,
    })).toBe(true);
    expect(evaluationIsActionableForViewer({
      role: "TRAINING_OFFICER",
      userId: "to-1",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-a",
    })).toBe(false);
    const buckets = classifyEvaluationBuckets({
      role: "TRAINING_OFFICER",
      userId: "to-1",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-a",
      submittedAt: overdue,
      escalationHours: 168,
      hasViewerSignOff: false,
      now,
    });
    expect(buckets).toEqual(["follow_up"]);
    expect(describeEvaluationOwnership({
      status: "SUBMITTED",
      requirementTitle: "Pump Operations",
      reviewStage: "EVALUATOR",
      approvalPathLength: 1,
      escalated: true,
      followUpOnly: true,
      memberName: "Firefighter Smith",
      assignedReviewerName: "Capt. Jones",
      viewerRole: "TRAINING_OFFICER",
    })).toMatchObject({
      nextAction: "Follow up on overdue evaluation",
      owner: "Training Officer",
      currentOwner: "Capt. Jones",
      escalationReason: "Exceeded department response target",
    });
  });

  it("keeps the assigned evaluator able to complete an escalated evaluation", () => {
    const buckets = classifyEvaluationBuckets({
      role: "EVALUATOR",
      userId: "eval-a",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-a",
      submittedAt: overdue,
      escalationHours: 168,
      hasViewerSignOff: false,
      now,
    });
    expect(buckets).toContain("needs_me");
    expect(buckets).toContain("follow_up");
  });

  it("puts signed evaluations in Completed with ownership metadata", () => {
    expect(classifyEvaluationBuckets({
      role: "EVALUATOR",
      userId: "eval-a",
      status: "APPROVED",
      reviewStage: "FINAL",
      assignedReviewerId: "eval-a",
      submittedAt: fresh,
      escalationHours: 168,
      hasViewerSignOff: true,
      now,
    })).toEqual(["completed"]);
    expect(describeEvaluationOwnership({
      status: "APPROVED",
      requirementTitle: "Pump Operations",
      reviewStage: "FINAL",
      approvalPathLength: 1,
      escalated: false,
      followUpOnly: false,
      memberName: "Firefighter Smith",
      assignedReviewerName: "Capt. Jones",
      viewerRole: "EVALUATOR",
    }).nextAction).toBe("None — evaluation complete");
  });

  it("keeps remediation ownership on the member and surfaces it in Waiting", () => {
    expect(classifyEvaluationBuckets({
      role: "EVALUATOR",
      userId: "eval-a",
      status: "RETURNED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "eval-a",
      submittedAt: fresh,
      escalationHours: 168,
      hasViewerSignOff: true,
      now,
    })).toEqual(["waiting"]);
    expect(describeEvaluationOwnership({
      status: "RETURNED",
      requirementTitle: "Pump Operations",
      reviewStage: "EVALUATOR",
      approvalPathLength: 1,
      escalated: false,
      followUpOnly: false,
      memberName: "Firefighter Smith",
      assignedReviewerName: "Capt. Jones",
      viewerRole: "EVALUATOR",
    })).toMatchObject({
      nextAction: "Correct deficiencies and request reevaluation",
      owner: "Firefighter Smith",
    });
  });

  it("preserves explicit multi-stage approval ownership", () => {
    expect(evaluationIsActionableForViewer({
      role: "EVALUATOR",
      userId: "eval-a",
      status: "SUBMITTED",
      reviewStage: "SUPERVISOR",
      assignedReviewerId: "supervisor-1",
    })).toBe(false);
    expect(evaluationIsActionableForViewer({
      role: "TRAINING_OFFICER",
      userId: "supervisor-1",
      status: "SUBMITTED",
      reviewStage: "SUPERVISOR",
      assignedReviewerId: "supervisor-1",
    })).toBe(true);
    expect(describeEvaluationOwnership({
      status: "SUBMITTED",
      requirementTitle: "Pump Operations",
      reviewStage: "SUPERVISOR",
      approvalPathLength: 2,
      escalated: false,
      followUpOnly: false,
      memberName: "Firefighter Smith",
      assignedReviewerName: "Chief Adams",
      viewerRole: "EVALUATOR",
    })).toMatchObject({
      nextAction: "Second-stage approval",
      owner: "Chief Adams",
    });
  });

  it("allows Training Officers to act only when they are the assigned evaluator", () => {
    expect(evaluationIsActionableForViewer({
      role: "TRAINING_OFFICER",
      userId: "to-1",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "to-1",
    })).toBe(true);
    expect(classifyEvaluationBuckets({
      role: "TRAINING_OFFICER",
      userId: "to-1",
      status: "SUBMITTED",
      reviewStage: "EVALUATOR",
      assignedReviewerId: "to-1",
      submittedAt: fresh,
      escalationHours: 168,
      hasViewerSignOff: false,
      now,
    })).toEqual(["needs_me"]);
  });
});
