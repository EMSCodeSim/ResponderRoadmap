import { blsCprClassPreset } from "@/lib/bls-cpr-class-preset";
import { firefighterOneClassPreset } from "@/lib/firefighter-one-class-preset";

export type TrainingSheetStarter = {
  id: string;
  label: string;
  description: string;
  checklistPattern?: RegExp;
  checklistStarterId?: string;
  values: {
    name: string;
    defaultTitle: string;
    classType: string;
    trainingCategory: string;
    topic: string;
    creditHours: number;
    location: string;
    notes: string;
    selfRegistration: boolean;
    customFields: Array<{ id: string; label: string; type: string; required: boolean; appliesTo: "ROSTER" | "RESULT" }>;
    ceCredits: Array<{ category: string; hours: number }>;
    gradingConfig?: {
      writtenTestEnabled: boolean;
      writtenTestPassPercent: number | null;
      ccfEnabled: boolean;
      ccfPassPercent: number | null;
      rmsEntryCategories: string[];
      customTopicLabel: string;
      customClassTypeLabel: string;
      customTrainingCategoryLabel: string;
    };
  };
};

const notes = {
  ems: "PURPOSE: Recurring EMS skills training and competency review.\nOBJECTIVES: Practice patient assessment, airway/ventilation, resuscitation, medical, and trauma skills selected for this session.\nDOCUMENTATION: Record the stations completed, evaluator findings, remediation, and final disposition for each student. Update objectives and CE allocations to match the actual lesson plan and local medical direction.",
  fire: "PURPOSE: Company-level fire training or multi-company drill.\nOBJECTIVES: Review safety, accountability, communications, and the fireground skills selected in the lesson plan.\nDOCUMENTATION: Record participating personnel, evolutions completed, safety issues, equipment issues, and after-action items. Replace these example objectives with the specific drill plan before use.",
  hazmat: "PURPOSE: HazMat operations refresher and practical exercise.\nOBJECTIVES: Recognize hazards, establish isolation and control zones, select protective actions, perform defensive operations, and establish emergency decontamination within local scope.\nDOCUMENTATION: Record the scenario, PPE, monitoring, actions, exposures, remediation, and after-action findings. Verify content against current local policy and applicable standards.",
};

export const TRAINING_SHEET_STARTERS: TrainingSheetStarter[] = [
  {
    id: "ems-training",
    label: "EMS skills training",
    description: "QR roster, EMS CE examples, and an optional multi-station practical checklist.",
    checklistPattern: /EMS Skills Lab/i,
    checklistStarterId: "ems-skills-lab",
    values: {
      name: "EMS Skills Training",
      defaultTitle: "EMS Skills Training",
      classType: "EMS",
      trainingCategory: "EMS",
      topic: "EMS",
      creditHours: 2,
      location: "",
      notes: notes.ems,
      selfRegistration: true,
      customFields: [{ id: "ems-remediation", label: "Remediation / follow-up", type: "TEXT", required: false, appliesTo: "RESULT" }],
      ceCredits: [{ category: "Medical", hours: 1 }, { category: "Airway", hours: 1 }],
    },
  },
  {
    id: "fire-training",
    label: "Fire company training",
    description: "A general drill sheet with attendance, QR enrollment, after-action notes, and an optional company checklist.",
    checklistPattern: /Company Fire Training/i,
    checklistStarterId: "company-fire-drill",
    values: {
      name: "Fire Company Training",
      defaultTitle: "Fire Company Training",
      classType: "GENERAL",
      trainingCategory: "COMPANY",
      topic: "FIRE",
      creditHours: 2,
      location: "",
      notes: notes.fire,
      selfRegistration: true,
      customFields: [{ id: "fire-assignment", label: "Company / apparatus assignment", type: "TEXT", required: false, appliesTo: "ROSTER" }],
      ceCredits: [],
    },
  },
  {
    id: "bls-cpr",
    label: "BLS CPR class",
    description: "Adult and infant CPR/AED skills, written score, remediation, instructor sign-off, and QR registration.",
    checklistPattern: /BLS CPR Adult.*Infant|BLS.*Adult.*Infant|CPR.*Adult.*Infant/i,
    checklistStarterId: "bls-cpr-adult-infant",
    values: {
      ...blsCprClassPreset,
      topic: "CPR",
      creditHours: 4,
      customFields: [
        { id: "cpr-instructor-id", label: "Instructor ID", type: "TEXT", required: false, appliesTo: "RESULT" },
        { id: "cpr-remediation", label: "Remediation completed", type: "BOOLEAN", required: false, appliesTo: "RESULT" },
      ],
      ceCredits: [],
      gradingConfig: {
        writtenTestEnabled: true,
        writtenTestPassPercent: 84,
        ccfEnabled: false,
        ccfPassPercent: null,
        rmsEntryCategories: ["CPR / BLS"],
        customTopicLabel: "",
        customClassTypeLabel: "",
        customTrainingCategoryLabel: "",
      },
    },
  },
  {
    id: "firefighter-i",
    label: "Firefighter I practice",
    description: "Practical stations, evaluator results, remediation, and a Firefighter I checklist example.",
    checklistPattern: /Firefighter I Practice Stations/i,
    checklistStarterId: "firefighter-i-practice",
    values: {
      ...firefighterOneClassPreset,
      topic: "FIRE",
      classType: "FIRE_ACADEMY",
      creditHours: 4,
      customFields: [{ id: "ff1-remediation", label: "Remediation / retest notes", type: "TEXT", required: false, appliesTo: "RESULT" }],
      ceCredits: [],
    },
  },
  {
    id: "hazmat",
    label: "HazMat operations",
    description: "Operations refresher with practical stations, exposure documentation, and after-action review.",
    checklistPattern: /HazMat Operations Refresher/i,
    checklistStarterId: "hazmat-operations-refresher",
    values: {
      name: "HazMat Operations Refresher",
      defaultTitle: "HazMat Operations Refresher",
      classType: "GENERAL",
      trainingCategory: "HAZMAT",
      topic: "HAZMAT",
      creditHours: 4,
      location: "",
      notes: notes.hazmat,
      selfRegistration: true,
      customFields: [
        { id: "hazmat-role", label: "Team / assignment", type: "TEXT", required: false, appliesTo: "ROSTER" },
        { id: "hazmat-exposure", label: "Exposure or medical follow-up", type: "TEXT", required: false, appliesTo: "RESULT" },
      ],
      ceCredits: [],
    },
  },
];
