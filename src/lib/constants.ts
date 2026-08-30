export const ROLES = [
  "MEMBER",
  "EVALUATOR",
  "TRAINING_OFFICER",
  "DEPARTMENT_ADMINISTRATOR",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  MEMBER: "Member — Complete assigned Task Books",
  EVALUATOR: "Evaluator — Skills check-off / sign-off",
  TRAINING_OFFICER: "Training Officer — Check-off, create & assign Task Books",
  DEPARTMENT_ADMINISTRATOR: "Department Administrator — Full department access",
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
  "VIDEO",
  "FILE",
  "SUPERVISOR_OBSERVATION",
  "SKILL_EVALUATION",
  "TRAINING_ATTENDANCE",
  "CERTIFICATION_UPLOAD",
  "EXTERNAL_LINK",
  "TIME_ENTRY",
  "INCIDENT_RECORD",
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  NONE: "No evidence",
  WRITTEN_NOTE: "Member notes",
  PHOTO: "Photo",
  VIDEO: "Video",
  FILE: "Document",
  SUPERVISOR_OBSERVATION: "Evaluator observation",
  SKILL_EVALUATION: "Skill evaluation",
  TRAINING_ATTENDANCE: "Training record",
  CERTIFICATION_UPLOAD: "Certificate",
  EXTERNAL_LINK: "External link",
  TIME_ENTRY: "Time / hours",
  INCIDENT_RECORD: "Incident / call record",
};

export const COMPLETION_TYPES = [
  "SKILL_DEMONSTRATION",
  "KNOWLEDGE_VERIFICATION",
  "OBSERVATION",
  "TRAINING_ATTENDANCE",
  "COURSE_COMPLETION",
  "CERTIFICATION",
  "DRIVING_TIME",
  "APPARATUS_OPERATION",
  "CALL_EXPERIENCE",
  "REPETITION",
  "DOCUMENT_UPLOAD",
  "SUPERVISOR_VERIFICATION",
  "CUSTOM",
] as const;
export type CompletionType = (typeof COMPLETION_TYPES)[number];

export const COMPLETION_TYPE_LABELS: Record<CompletionType, string> = {
  SKILL_DEMONSTRATION: "Skill demonstration",
  KNOWLEDGE_VERIFICATION: "Knowledge verification",
  OBSERVATION: "Observation",
  TRAINING_ATTENDANCE: "Training attendance",
  COURSE_COMPLETION: "Course completion",
  CERTIFICATION: "Certification",
  DRIVING_TIME: "Driving time",
  APPARATUS_OPERATION: "Apparatus operation",
  CALL_EXPERIENCE: "Call / incident experience",
  REPETITION: "Repetition requirement",
  DOCUMENT_UPLOAD: "Document upload",
  SUPERVISOR_VERIFICATION: "Supervisor verification",
  CUSTOM: "Custom",
};

export const SCORING_METHODS = [
  "COMPLETE_INCOMPLETE",
  "PASS_FAIL",
  "MEETS_NEEDS_IMPROVEMENT",
  "NUMERIC",
  "RUBRIC",
  "CHECKLIST",
  "EVALUATOR_JUDGMENT",
] as const;
export type ScoringMethod = (typeof SCORING_METHODS)[number];

export const SCORING_METHOD_LABELS: Record<ScoringMethod, string> = {
  COMPLETE_INCOMPLETE: "Complete / Incomplete",
  PASS_FAIL: "Pass / Fail",
  MEETS_NEEDS_IMPROVEMENT: "Meets / Needs Improvement",
  NUMERIC: "Numeric score",
  RUBRIC: "Rubric",
  CHECKLIST: "Checklist",
  EVALUATOR_JUDGMENT: "Evaluator judgment",
};

export const STEP_RATINGS = ["MEETS", "NEEDS_IMPROVEMENT", "NOT_PERFORMED"] as const;
export type StepRating = (typeof STEP_RATINGS)[number];

export const STEP_RATING_LABELS: Record<StepRating, string> = {
  MEETS: "Meets Standard",
  NEEDS_IMPROVEMENT: "Needs Improvement",
  NOT_PERFORMED: "Not Performed",
};

export const EVALUATION_RESULTS = [
  "APPROVED",
  "RETURNED",
  "PASS",
  "FAIL",
  "NEEDS_REMEDIATION",
  "CRITICAL_FAIL",
  "NOT_EVALUATED",
] as const;
export type EvaluationResult = (typeof EVALUATION_RESULTS)[number];

export const SIGNOFF_RESULTS = ["APPROVED", "RETURNED", "NEEDS_REMEDIATION", "CRITICAL_FAIL", "NOT_EVALUATED"] as const;
export type SignOffResult = (typeof SIGNOFF_RESULTS)[number];

export const APPROVAL_LEVELS = [
  "EVALUATOR",
  "COMPANY_OFFICER",
  "SUPERVISOR",
  "TRAINING_OFFICER",
  "TRAINING_CHIEF",
  "PRECEPTOR",
  "FTO",
  "MEDICAL_DIRECTOR",
] as const;
export type ApprovalLevel = (typeof APPROVAL_LEVELS)[number];

export const APPROVAL_LEVEL_LABELS: Record<ApprovalLevel, string> = {
  EVALUATOR: "Evaluator",
  COMPANY_OFFICER: "Company Officer",
  SUPERVISOR: "Supervisor",
  TRAINING_OFFICER: "Training Officer",
  TRAINING_CHIEF: "Training Chief",
  PRECEPTOR: "Preceptor",
  FTO: "FTO",
  MEDICAL_DIRECTOR: "Medical Director",
};

export const RETRY_POLICIES = ["UNLIMITED", "MAX_ATTEMPTS", "REMEDIATION", "SUPERVISOR_REVIEW", "WAIT"] as const;
export type RetryPolicy = (typeof RETRY_POLICIES)[number];

export const RETRY_POLICY_LABELS: Record<RetryPolicy, string> = {
  UNLIMITED: "Unlimited attempts",
  MAX_ATTEMPTS: "Maximum attempts",
  REMEDIATION: "Remediation required before retry",
  SUPERVISOR_REVIEW: "Supervisor review after failure",
  WAIT: "Minimum waiting period",
};

export const REQUIREMENT_STATES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "READY_FOR_EVALUATION",
  "SUBMITTED",
  "NEEDS_REMEDIATION",
  "APPROVED",
  "LOCKED",
  "OVERDUE",
] as const;
export type RequirementState = (typeof REQUIREMENT_STATES)[number];

export const VERIFICATION_STATUSES = ["UNVERIFIED", "VERIFIED", "REJECTED", "MISSING_INFO"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ALERT_THRESHOLDS = [180, 90, 60, 30, 14, 7, 0] as const;

export const TASK_BOOK_CATEGORIES = [
  "Firefighter",
  "Driver / Operator",
  "Officer",
  "Instructor",
  "HazMat",
  "EMS",
  "Leadership",
  "Probation",
  "Promotion",
  "Department Custom",
  "Standards Based",
  "Probationary",
  "Officer Development",
  "Special Operations",
  "Department Orientation",
  "Annual Competency",
  "Custom",
] as const;

export const TASK_BOOK_POSITIONS = [
  "Firefighter I",
  "Firefighter II",
  "Driver/Operator Pumper",
  "Fire Officer I",
  "Paramedic Field Training",
  "Probationary Firefighter",
  "Engineer Promotional Book",
  "Lieutenant Promotional Book",
  "Custom Department Task Book",
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

export function parseJsonValue<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
