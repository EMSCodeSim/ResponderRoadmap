import { describe, expect, it } from "vitest";
import { bumpVersion } from "@/lib/constants";
import { credentialStatus, daysUntil, worstCredentialHealth } from "@/lib/dates";
import { computeAssignmentProgress } from "@/lib/progress";
import { computeUpNext, evaluationPasses, reviewTaskBook, serializeRequirement } from "@/lib/taskbook";
import { approvalsSinceSubmission, nextReviewState, reviewStageForRequirement } from "@/lib/signoff";
import { hasPermission } from "@/server/permissions";

describe("bumpVersion", () => {
  it("increments minor version", () => {
    expect(bumpVersion("1.0")).toBe("1.1");
    expect(bumpVersion("1.9")).toBe("1.10");
  });
});

describe("class roster permissions", () => {
  it("lets evaluators proctor assigned classes without creating rosters", () => {
    expect(hasPermission("EVALUATOR", "classes.read")).toBe(true);
    expect(hasPermission("EVALUATOR", "classes.proctor")).toBe(true);
    expect(hasPermission("EVALUATOR", "classes.write")).toBe(false);
  });

  it("lets training officers create rosters and record results", () => {
    expect(hasPermission("TRAINING_OFFICER", "classes.write")).toBe(true);
    expect(hasPermission("TRAINING_OFFICER", "classes.proctor")).toBe(true);
  });
});

describe("credentialStatus", () => {
  const now = new Date("2026-08-28T12:00:00Z");

  it("marks missing expiration", () => {
    expect(credentialStatus(null, now).health).toBe("missing");
  });

  it("treats credentials marked does not expire as current", () => {
    const status = credentialStatus(null, now, true);
    expect(status.health).toBe("current");
    expect(status.label).toBe("Does not expire");
  });

  it("marks expired credentials", () => {
    const status = credentialStatus(new Date("2026-08-01"), now);
    expect(status.health).toBe("expired");
    expect(status.window).toBe("expired");
  });

  it("marks CPR expiring in 48 days as warning", () => {
    const exp = new Date("2026-10-15T12:00:00Z");
    const status = credentialStatus(exp, now);
    expect(daysUntil(exp, now)).toBe(48);
    expect(status.health).toBe("expiring");
    expect(status.label).toContain("48");
  });

  it("treats far-future dates as current", () => {
    expect(credentialStatus(new Date("2028-01-01"), now).health).toBe("current");
  });
});

describe("worstCredentialHealth", () => {
  it("prioritizes expired over expiring", () => {
    expect(
      worstCredentialHealth([
        credentialStatus(new Date("2026-10-01"), new Date("2026-08-28")),
        credentialStatus(new Date("2026-07-01"), new Date("2026-08-28")),
      ]),
    ).toBe("expired");
  });
});

describe("assignment progress", () => {
  const requirements = [
    { id: "a", isRequired: true },
    { id: "b", isRequired: true },
    { id: "c", isRequired: true },
    { id: "d", isRequired: false },
  ];

  it("computes percent from required approved items only", () => {
    const summary = computeAssignmentProgress({
      requirements,
      completions: [
        { requirementId: "a", status: "APPROVED" },
        { requirementId: "b", status: "SUBMITTED" },
      ],
      assignedDate: new Date("2026-01-01"),
    });
    expect(summary.percent).toBe(33);
    expect(summary.pendingApproval).toBe(1);
    expect(summary.status).toBe("AWAITING_SIGN_OFF");
  });

  it("marks complete at 100%", () => {
    const summary = computeAssignmentProgress({
      requirements,
      completions: [
        { requirementId: "a", status: "APPROVED" },
        { requirementId: "b", status: "APPROVED" },
        { requirementId: "c", status: "APPROVED" },
      ],
      assignedDate: new Date("2026-01-01"),
    });
    expect(summary.status).toBe("COMPLETE");
  });

  it("does not complete a repeated skill after the first approved repetition", () => {
    const summary = computeAssignmentProgress({
      requirements: [{ id: "drive", isRequired: true, repetitionsRequired: 5 }],
      completions: [{ requirementId: "drive", status: "APPROVED", repetitionCount: 1 }],
      assignedDate: new Date("2026-01-01"),
    });
    expect(summary.percent).toBe(0);
    expect(summary.status).toBe("IN_PROGRESS");
  });

  it("completes a repeated skill only when all repetitions are approved", () => {
    const summary = computeAssignmentProgress({
      requirements: [{ id: "drive", isRequired: true, repetitionsRequired: 5 }],
      completions: [{ requirementId: "drive", status: "APPROVED", repetitionCount: 5 }],
      assignedDate: new Date("2026-01-01"),
    });
    expect(summary.percent).toBe(100);
    expect(summary.status).toBe("COMPLETE");
  });

  it("marks overdue when due date has passed", () => {
    const summary = computeAssignmentProgress({
      requirements,
      completions: [{ requirementId: "a", status: "APPROVED" }],
      assignedDate: new Date("2026-01-01"),
      dueDate: new Date("2026-02-01"),
      now: new Date("2026-08-28"),
    });
    expect(summary.status).toBe("OVERDUE");
  });

  it("counts a requirement complete only after required repetitions", () => {
    const summary = computeAssignmentProgress({
      requirements: [{ id: "a", isRequired: true, repetitionsRequired: 3 }],
      completions: [{ requirementId: "a", status: "IN_PROGRESS", repetitionCount: 2 }],
      assignedDate: new Date("2026-01-01"),
    });
    expect(summary.complete).toBe(0);
    expect(summary.percent).toBe(0);
  });
});

describe("task book quality and evaluation", () => {
  it("warns about empty sections and missing instructions", () => {
    const review = reviewTaskBook({
      title: "Driver/Operator Pumper",
      sections: [
        { title: "Pump Operations", requirements: [] },
        { title: "Driving", requirements: [{ title: "Spot apparatus", instructions: "Use a spotter." }] },
      ],
    });
    expect(review.sectionCount).toBe(2);
    expect(review.requirementCount).toBe(1);
    expect(review.issues.some((issue) => issue.code === "empty-section")).toBe(true);
  });

  it("fails an attempt when a critical failure is marked", () => {
    expect(evaluationPasses({ result: "APPROVED", criticalFailuresTriggered: ["ppe"] })).toEqual({
      passed: false,
      result: "CRITICAL_FAIL",
    });
    expect(evaluationPasses({ result: "APPROVED" }).passed).toBe(true);
  });

  it("surfaces the next unlocked requirement", () => {
    const next = computeUpNext({
      sections: [
        {
          title: "Apparatus",
          requirements: [
            { id: "a", title: "Orientation", isRequired: true, prerequisites: [] },
            { id: "b", title: "Emergency driving", isRequired: true, prerequisites: ["a"] },
          ],
        },
      ],
      completions: [],
    });
    expect(next[0].title).toBe("Orientation");
    expect(next[1].locked).toBe(true);
    expect(next[1].lockReason).toContain("Orientation");
  });

  it("keeps spaces in objectives and drops blank rows only when saving", () => {
    const saved = serializeRequirement({
      title: "Pump panel",
      sortOrder: 0,
      objectives: ["Identify tank-to-pump", "  ", "Identify discharges"],
    });
    expect(JSON.parse(saved.objectivesJson)).toEqual(["Identify tank-to-pump", "Identify discharges"]);
  });
});

describe("sign-off stages", () => {
  const submittedAt = new Date("2026-08-28T12:00:00Z");

  it("starts with evaluator review when both levels are required", () => {
    expect(reviewStageForRequirement({
      evaluatorSignOffRequired: true,
      supervisorApprovalRequired: true,
      signOffs: [],
      submittedAt,
    })).toBe("EVALUATOR");
  });

  it("moves to supervisor after evaluator approval", () => {
    expect(reviewStageForRequirement({
      evaluatorSignOffRequired: true,
      supervisorApprovalRequired: true,
      signOffs: [{ result: "APPROVED", signedAt: new Date("2026-08-28T12:05:00Z") }],
      submittedAt,
    })).toBe("SUPERVISOR");
  });

  it("ignores approvals from an earlier submission attempt", () => {
    const signOffs = [{ result: "APPROVED", signedAt: new Date("2026-08-28T11:00:00Z") }];
    expect(approvalsSinceSubmission(signOffs, submittedAt)).toBe(0);
    expect(reviewStageForRequirement({
      evaluatorSignOffRequired: true,
      supervisorApprovalRequired: true,
      signOffs,
      submittedAt,
    })).toBe("EVALUATOR");
  });

  it("goes directly to supervisor when evaluator sign-off is not required", () => {
    expect(reviewStageForRequirement({
      evaluatorSignOffRequired: false,
      supervisorApprovalRequired: true,
      signOffs: [],
      submittedAt,
    })).toBe("SUPERVISOR");
  });

  it("is final when only one evaluator approval is required", () => {
    expect(reviewStageForRequirement({
      evaluatorSignOffRequired: true,
      supervisorApprovalRequired: false,
      signOffs: [{ result: "APPROVED", signedAt: new Date("2026-08-28T12:05:00Z") }],
      submittedAt,
    })).toBe("FINAL");
  });
});

describe("sign-off transitions", () => {
  it("keeps a repetition pending after evaluator approval when supervisor approval is required", () => {
    expect(nextReviewState({
      result: "APPROVED",
      stage: "EVALUATOR",
      supervisorApprovalRequired: true,
      currentApprovedRepetitions: 2,
      repetitionsRequired: 5,
    })).toEqual({
      status: "SUBMITTED",
      approvedRepetitions: 2,
      completed: false,
      supervisorPending: true,
    });
  });

  it("increments the approved repetition at supervisor approval", () => {
    expect(nextReviewState({
      result: "APPROVED",
      stage: "SUPERVISOR",
      supervisorApprovalRequired: true,
      currentApprovedRepetitions: 2,
      repetitionsRequired: 5,
    })).toEqual({
      status: "APPROVED",
      approvedRepetitions: 3,
      completed: false,
      supervisorPending: false,
    });
  });

  it("does not increment repetitions when an attempt is returned", () => {
    expect(nextReviewState({
      result: "RETURNED",
      stage: "EVALUATOR",
      supervisorApprovalRequired: true,
      currentApprovedRepetitions: 2,
      repetitionsRequired: 5,
    })).toEqual({
      status: "RETURNED",
      approvedRepetitions: 2,
      completed: false,
      supervisorPending: false,
    });
  });

  it("marks the final required repetition complete", () => {
    expect(nextReviewState({
      result: "APPROVED",
      stage: "SUPERVISOR",
      supervisorApprovalRequired: true,
      currentApprovedRepetitions: 4,
      repetitionsRequired: 5,
    })).toEqual({
      status: "APPROVED",
      approvedRepetitions: 5,
      completed: true,
      supervisorPending: false,
    });
  });
});

describe("permissions", () => {
  it("does not let members manage task books", () => {
    expect(hasPermission("MEMBER", "taskbooks.write")).toBe(false);
    expect(hasPermission("MEMBER", "assignments.write")).toBe(true);
    expect(hasPermission("TRAINING_OFFICER", "taskbooks.write")).toBe(true);
    expect(hasPermission("EVALUATOR", "signoff.review")).toBe(true);
    expect(hasPermission("TRAINING_OFFICER", "roles.write")).toBe(false);
    expect(hasPermission("DEPARTMENT_ADMINISTRATOR", "roles.write")).toBe(true);
  });
});
