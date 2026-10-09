import { describe, expect, it } from "vitest";
import { normalizeClassSkillEvidence } from "./training-evidence";

describe("training evidence normalization", () => {
  const base = {
    classId: "class-1", enrollmentId: "member-1", membershipId: "membership-1",
    trainingTitle: "Ladder drill", skillTitle: "Raise ladder", requirementId: "skill-1",
    evaluatedAt: "2026-10-09T18:00:00Z", evaluatorName: "Instructor",
    result: "PASS", notes: null,
  };
  it("does not convert a recorded pass into verified competency or RMS entry", () => {
    const item = normalizeClassSkillEvidence(base);
    expect(item.source).toBe("TRAINING_SHEET");
    expect(item.state).toBe("RECORDED");
    expect(item.rmsEntered).toBe(false);
    expect(item.sourceRecordId).toBe("class-1:member-1:skill-1");
  });
  it("preserves failed or remediation results as not approved", () => {
    expect(normalizeClassSkillEvidence({ ...base, result: "FAIL" }).state).toBe("RETURNED");
    expect(normalizeClassSkillEvidence({ ...base, result: "NEEDS_REMEDIATION" }).state).toBe("RETURNED");
  });
  it("does not treat an unperformed evaluation as completion", () => {
    expect(normalizeClassSkillEvidence({ ...base, result: "NOT_EVALUATED" }).state).toBe("NOT_EVALUATED");
  });
});
