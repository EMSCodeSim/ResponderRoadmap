import { describe, expect, it } from "vitest";
import {
  DEFAULT_EVALUATION_ESCALATION_HOURS,
  isEvaluationOverdue,
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
