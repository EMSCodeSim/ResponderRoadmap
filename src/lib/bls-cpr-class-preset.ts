/** 2025 BLS multi-student checkoff preset, transcribed from user-provided checklists. */
export const blsCprClassPreset = {
  name: "BLS CPR — Adult & Infant (2025 Skills)",
  defaultTitle: "BLS Provider — Adult & Infant CPR/AED Skills",
  classType: "CPR",
  trainingCategory: "EMS",
  creditHours: 0,
  checklistVersionId: "",
  location: "",
  notes: "SOURCE: Uploaded BLS Multi Student Checklist — Adult Skills Testing 2025 Guidelines and Infant Skills Testing 2025 Guidelines. Verify current approved AHA materials with your Training Center before instruction and card issuance.\nCOURSE: BLS Provider CPR/AED — Adult and Infant Skills.\nOBJECTIVES: Assess responsiveness, activate emergency response, check breathing and pulse; perform high-quality adult CPR (30:2), use AED safely and resume compressions; perform infant CPR (30:2 and two-rescuer 15:2) and effective bag-mask breaths.\nCLASS SETUP: Record start/stop, physical location, Training Center/Site, lead instructor, instructor ID, class delivery method, and course date. Collect each student's first name, last name, and email for Atlas preparation.\nSKILL EVALUATIONS: Record P (Pass) or NR (Needs Remediation) for each student and adult/infant checklist item; include separate student-specific remediation paperwork for any NR. Do not mark attendance as passing.\nADULT: Assessment/activation; Cycle 1 high-quality compressions and barrier breaths; Cycle 2 repeat; AED power/pads/clear analysis/clear shock/deliver; resume compressions immediately.\nINFANT: Assessment/activation; Cycles 1–2 single-rescuer compressions/breaths; Cycle 3 two-thumb-encircling compressions; Cycle 4 bag-mask breaths.\nGROUP SIZE: Source form says BLS checkoff testing maximum of 6 students per session even though the printed grid has 9 student columns; schedule separate checkoff sessions when needed.\nSIGNOFF: Instructor affirms testing performed according to AHA guidelines; record name, signature, date, remediation and final pass status. Instructor/Training Center authorizes eCards separately.\nATLAS: Use the class's Atlas roster preparation export to review student information, then populate the official Atlas Student List Template; never submit NR, absent, or incomplete students as passed.",
  selfRegistration: true,
  proctorUserIds: [] as string[],
};

export const blsCprSkillGroups = {
  adult: [
    "Assessment and activation",
    "Cycle 1 — compressions (30:2)",
    "Cycle 1 — barrier breaths and resume compressions",
    "Cycle 2 — compressions, breaths, resume",
    "AED — power on, pads, clear analysis, clear shock, shock",
    "Immediately resume compressions after shock",
  ],
  infant: [
    "Assessment and activation",
    "Cycle 1 — compressions (30:2), breaths, resume",
    "Cycle 2 — compressions, breaths, resume",
    "Cycle 3 — two-rescuer compressions (15:2)",
    "Cycle 4 — bag-mask breaths, resume",
  ],
} as const;
