import { describe, expect, it } from "vitest";
import { computeAssignmentProgress, requirementIsComplete } from "./progress";

const assignedDate = new Date("2026-09-01T12:00:00.000Z");
const now = new Date("2026-09-02T12:00:00.000Z");
const requirements = [
  { id: "skill-a", isRequired: true, repetitionsRequired: 1 },
  { id: "skill-b", isRequired: true, repetitionsRequired: 2 },
];

function progress(completions: Array<{ requirementId: string; status: string; repetitionCount: number }>) {
  return computeAssignmentProgress({ requirements, completions, assignedDate, now });
}

describe("official task-book approval integrity", () => {
  it("never counts a submitted requirement as complete even when a prior repetition exists", () => {
    const result = progress([
      { requirementId: "skill-a", status: "SUBMITTED", repetitionCount: 1 },
      { requirementId: "skill-b", status: "SUBMITTED", repetitionCount: 2 },
    ]);
    expect(result.complete).toBe(0);
    expect(result.pendingApproval).toBe(2);
    expect(result.percent).toBe(0);
    expect(result.status).toBe("AWAITING_SIGN_OFF");
  });

  it("does not count returned work or an in-progress requirement as approved", () => {
    const result = progress([
      { requirementId: "skill-a", status: "RETURNED", repetitionCount: 1 },
      { requirementId: "skill-b", status: "IN_PROGRESS", repetitionCount: 2 },
    ]);
    expect(result.complete).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.status).toBe("IN_PROGRESS");
  });

  it("requires every repetition before a requirement contributes to completion", () => {
    const result = progress([
      { requirementId: "skill-a", status: "APPROVED", repetitionCount: 1 },
      { requirementId: "skill-b", status: "APPROVED", repetitionCount: 1 },
    ]);
    expect(result.complete).toBe(1);
    expect(result.percent).toBe(50);
    expect(result.status).not.toBe("COMPLETE");
    expect(requirementIsComplete(requirements[1], { requirementId: "skill-b", status: "APPROVED", repetitionCount: 1 })).toBe(false);
  });

  it("marks the assignment complete only when all required approvals and repetitions are finished", () => {
    const result = progress([
      { requirementId: "skill-a", status: "APPROVED", repetitionCount: 1 },
      { requirementId: "skill-b", status: "APPROVED", repetitionCount: 2 },
    ]);
    expect(result.complete).toBe(2);
    expect(result.percent).toBe(100);
    expect(result.status).toBe("COMPLETE");
  });

  it("does not let optional requirements inflate required progress", () => {
    const result = computeAssignmentProgress({
      requirements: [...requirements, { id: "optional", isRequired: false }],
      completions: [{ requirementId: "optional", status: "APPROVED", repetitionCount: 1 }],
      assignedDate,
      now,
    });
    expect(result.complete).toBe(0);
    expect(result.totalRequired).toBe(2);
    expect(result.percent).toBe(0);
  });
});
