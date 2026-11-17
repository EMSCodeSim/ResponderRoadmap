export type TrainingSheetResultField = {
  id: string;
  type: string;
  required?: boolean;
  appliesTo?: string;
};

export type TrainingSheetFinalResultInput = {
  attendance: string;
  requiredSkillResults: string[];
  observedSkillResults?: string[];
  customFields: TrainingSheetResultField[];
  customValues: Record<string, unknown>;
  writtenTestEnabled: boolean;
  writtenTestPassPercent: number | null;
  writtenScore: number | null;
  ccfEnabled: boolean;
  ccfPassPercent: number | null;
  ccfScore: number | null;
};

/**
 * Derive a student's class outcome from the saved evaluations. A recorded
 * failure must stay a failure; attendance alone cannot turn a graded result
 * into PASS. Missing required evaluations remain PENDING until recorded.
 */
export function calculateTrainingSheetFinalResult(input: TrainingSheetFinalResultInput) {
  if (input.attendance !== "PRESENT") return "PENDING";

  const skillResults = input.requiredSkillResults.map((value) => value.toUpperCase());
  const observedSkillResults = (input.observedSkillResults || skillResults).map((value) => value.toUpperCase());
  const fields = input.customFields.filter((field) => field.appliesTo !== "ROSTER");
  const failures = observedSkillResults.includes("FAIL") || fields.some((field) => {
    const value = input.customValues[field.id];
    return (field.type === "PASS_FAIL" && String(value || "").toUpperCase() === "FAIL") ||
      (field.type === "LETTER_GRADE" && String(value || "").trim().toUpperCase() === "F");
  }) ||
    (input.writtenTestEnabled && input.writtenScore != null && input.writtenTestPassPercent != null && input.writtenScore < input.writtenTestPassPercent) ||
    (input.ccfEnabled && input.ccfScore != null && input.ccfPassPercent != null && input.ccfScore < input.ccfPassPercent);
  if (failures) return "FAIL";

  if (skillResults.includes("NEEDS_REMEDIATION")) return "REMEDIATION";

  const skillsMissing = skillResults.some((value) => !["PASS", "NOT_APPLICABLE", "FAIL", "NEEDS_REMEDIATION"].includes(value));
  const requiredFieldMissing = fields.some((field) => {
    if (!field.required) return false;
    const value = input.customValues[field.id];
    return value == null || value === "";
  });
  const scoreMissing = (input.writtenTestEnabled && input.writtenScore == null) ||
    (input.ccfEnabled && input.ccfScore == null);

  if (skillsMissing || requiredFieldMissing || scoreMissing) return "PENDING";
  return "PASS";
}
