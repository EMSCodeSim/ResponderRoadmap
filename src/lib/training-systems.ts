export const PREBUILT_TRAINING_SYSTEMS = [
  { id: "PASS_FAIL", name: "Pass / Fail", description: "Record a clear pass or fail for each student." },
  { id: "PERCENT", name: "Percentage", description: "Record a score from 0 to 100%." },
  { id: "LETTER_GRADE", name: "Letter Grade", description: "Record A+ through F for each student." },
  { id: "SCORE_1_10", name: "1–10 Score", description: "Record a whole-number score from 1 to 10." },
  { id: "CCF", name: "CCF Score", description: "Record the CCF score with an 80% pass mark." },
] as const;

export type PrebuiltTrainingSystemId = typeof PREBUILT_TRAINING_SYSTEMS[number]["id"];

const blankGradingConfig = {
  writtenTestEnabled: false,
  writtenTestPassPercent: null,
  ccfEnabled: false,
  ccfPassPercent: null,
  rmsEntryCategories: [] as string[],
};

export function getPrebuiltTrainingSystem(id: string) {
  const system = PREBUILT_TRAINING_SYSTEMS.find((item) => item.id === id);
  if (!system) return null;
  if (id === "CCF") {
    return {
      ...system,
      gradingConfig: { ...blankGradingConfig, ccfEnabled: true, ccfPassPercent: 80 },
      customFields: [],
    };
  }
  const field = id === "PASS_FAIL"
    ? { label: "Pass/Fail result", type: "PASS_FAIL" }
    : id === "PERCENT"
      ? { label: "Score (%)", type: "PERCENT" }
      : id === "LETTER_GRADE"
        ? { label: "Letter Grade", type: "LETTER_GRADE" }
        : { label: "Score (1–10)", type: "SCORE_1_10" };
  return {
    ...system,
    gradingConfig: { ...blankGradingConfig },
    customFields: [{ id: `grade-${id.toLowerCase()}`, ...field, required: true, appliesTo: "RESULT" as const }],
  };
}
