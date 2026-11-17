import { describe, expect, it } from "vitest";
import { calculateTrainingSheetFinalResult } from "@/server/services/class-result";

const base = {
  attendance: "PRESENT",
  requiredSkillResults: [] as string[],
  customFields: [] as Array<{ id: string; type: string; required?: boolean; appliesTo?: string }>,
  customValues: {} as Record<string, unknown>,
  writtenTestEnabled: false,
  writtenTestPassPercent: null as number | null,
  writtenScore: null as number | null,
  ccfEnabled: false,
  ccfPassPercent: null as number | null,
  ccfScore: null as number | null,
};

describe("training sheet final result", () => {
  it("keeps an explicit custom Pass/Fail failure as FAIL", () => {
    expect(calculateTrainingSheetFinalResult({
      ...base,
      customFields: [{ id: "result", type: "PASS_FAIL", required: true, appliesTo: "RESULT" }],
      customValues: { result: "FAIL" },
    })).toBe("FAIL");
  });

  it("treats an F letter grade and below-threshold percentage scores as FAIL", () => {
    expect(calculateTrainingSheetFinalResult({
      ...base,
      customFields: [{ id: "grade", type: "LETTER_GRADE", required: true }],
      customValues: { grade: "f" },
    })).toBe("FAIL");
    expect(calculateTrainingSheetFinalResult({
      ...base,
      writtenTestEnabled: true,
      writtenTestPassPercent: 80,
      writtenScore: 79,
    })).toBe("FAIL");
  });

  it("does not call a failed roster field a class failure", () => {
    expect(calculateTrainingSheetFinalResult({
      ...base,
      customFields: [{ id: "check", type: "PASS_FAIL", required: true, appliesTo: "ROSTER" }],
      customValues: { check: "FAIL" },
    })).toBe("PASS");
  });

  it("keeps missing required outcomes pending and explicit skill failures failed", () => {
    expect(calculateTrainingSheetFinalResult({
      ...base,
      customFields: [{ id: "result", type: "PASS_FAIL", required: true }],
    })).toBe("PENDING");
    expect(calculateTrainingSheetFinalResult({
      ...base,
      requiredSkillResults: ["PASS", "FAIL"],
    })).toBe("FAIL");
    expect(calculateTrainingSheetFinalResult({
      ...base,
      requiredSkillResults: ["PASS"],
      observedSkillResults: ["PASS", "FAIL"],
    })).toBe("FAIL");
  });

  it("preserves attendance as a prerequisite and passes fully recorded successful results", () => {
    expect(calculateTrainingSheetFinalResult({ ...base, attendance: "ABSENT" })).toBe("PENDING");
    expect(calculateTrainingSheetFinalResult({
      ...base,
      requiredSkillResults: ["PASS", "NOT_APPLICABLE"],
      customFields: [{ id: "result", type: "PASS_FAIL", required: true }],
      customValues: { result: "PASS" },
    })).toBe("PASS");
  });
});
