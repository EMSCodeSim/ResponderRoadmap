export const ROLES = [
  "MEMBER",
  "EVALUATOR",
  "TRAINING_OFFICER",
  "DEPARTMENT_ADMINISTRATOR",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  MEMBER: "Member",
  EVALUATOR: "Evaluator",
  TRAINING_OFFICER: "Training Officer",
  DEPARTMENT_ADMINISTRATOR: "Department Administrator",
};

export const MEMBERSHIP_STATUSES = ["PENDING", "ACTIVE", "INACTIVE", "REJECTED"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const TASK_BOOK_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type TaskBookStatus = (typeof TASK_BOOK_STATUSES)[number];

export const VERSION_STATUSES = ["DRAFT", "PUBLISHED", "SUPERSEDED"] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

export const ASSIGNMENT_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "AWAITING_SIGN_OFF",
  "COMPLETE",
  "OVERDUE",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const COMPLETION_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "APPROVED",
  "RETURNED",
] as const;
export type CompletionStatus = (typeof COMPLETION_STATUSES)[number];

export const EVIDENCE_TYPES = [
  "NONE",
  "WRITTEN_NOTE",
  "PHOTO",
  "FILE",
  "SUPERVISOR_OBSERVATION",
  "SKILL_EVALUATION",
  "TRAINING_ATTENDANCE",
  "CERTIFICATION_UPLOAD",
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  NONE: "No evidence required",
  WRITTEN_NOTE: "Written note",
  PHOTO: "Photo",
  FILE: "File",
  SUPERVISOR_OBSERVATION: "Supervisor observation",
  SKILL_EVALUATION: "Skill evaluation",
  TRAINING_ATTENDANCE: "Training attendance",
  CERTIFICATION_UPLOAD: "Certification upload",
};

export const SIGNOFF_RESULTS = ["APPROVED", "RETURNED"] as const;
export type SignOffResult = (typeof SIGNOFF_RESULTS)[number];

export const VERIFICATION_STATUSES = ["UNVERIFIED", "VERIFIED", "REJECTED", "MISSING_INFO"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ALERT_THRESHOLDS = [180, 90, 60, 30, 14, 7, 0] as const;

export const TASK_BOOK_CATEGORIES = [
  "Probationary",
  "Driver / Operator",
  "Officer Development",
  "EMS",
  "Special Operations",
  "Department Orientation",
  "Annual Competency",
  "Custom",
] as const;

export const STANDARD_CREDENTIALS = [
  "EMT",
  "AEMT",
  "Paramedic",
  "CPR",
  "ACLS",
  "PALS",
  "Firefighter I",
  "Firefighter II",
  "HazMat Awareness",
  "HazMat Operations",
  "Driver / Operator – Pumper",
  "Fire Officer I",
  "Fire Officer II",
  "Fire Instructor I",
] as const;

export const CUSTOM_CREDENTIAL_EXAMPLES = [
  "Department Driver Authorization",
  "Engine Operator",
  "Wildland Red Card",
  "Annual Fit Test",
  "SCBA Qualification",
  "Annual EMS Competency",
] as const;

export const RANKS = [
  "Recruit",
  "Firefighter",
  "Firefighter/EMT",
  "Firefighter/Paramedic",
  "Engineer",
  "Paramedic",
  "Lieutenant",
  "Captain",
  "Training Captain",
  "Battalion Chief",
  "Deputy Chief",
  "Fire Chief",
] as const;

export const SHIFTS = ["A", "B", "C"] as const;

export const SESSION_COOKIE = "rr_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14;

export function bumpVersion(current: string): string {
  const parts = current.split(".");
  const major = Number(parts[0] || 1);
  const minor = Number(parts[1] || 0);
  if (Number.isNaN(major) || Number.isNaN(minor)) return "1.1";
  return `${major}.${minor + 1}`;
}

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
