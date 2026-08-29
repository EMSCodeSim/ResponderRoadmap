import {
  parseJsonArray,
  parseJsonValue,
  type ApprovalLevel,
  type CompletionType,
  type EvidenceType,
  type ScoringMethod,
  type SignOffResult,
} from "@/lib/constants";

export type EvaluationStep = { id: string; text: string };
export type CriticalFailure = { id: string; text: string };
export type StandardReference = {
  id: string;
  organization: string;
  standardName: string;
  edition: string;
  section: string;
  url: string;
  verified: boolean;
};

export type RequirementFields = {
  title: string;
  description?: string;
  instructions?: string;
  sortOrder: number;
  isRequired?: boolean;
  dueOffsetDays?: number | null;
  referenceDocument?: string | null;
  referenceUrl?: string | null;
  evidenceType?: EvidenceType | string;
  memberNotesAllowed?: boolean;
  evaluatorNotesEnabled?: boolean;
  supervisorApprovalRequired?: boolean;
  evaluatorSignOffRequired?: boolean;
  repetitionsRequired?: number;
  prerequisites?: string[];
  estimatedMinutes?: number | null;
  tags?: string[];
  internalNotes?: string;
  objectives?: string[];
  completionType?: CompletionType | string;
  scoringMethod?: ScoringMethod | string;
  evaluationSteps?: EvaluationStep[];
  criticalFailures?: CriticalFailure[];
  evidenceTypes?: string[];
  maxAttempts?: number | null;
  retryWaitHours?: number | null;
  remediationRequired?: boolean;
  supervisorReviewOnFail?: boolean;
  approvalPath?: string[];
  standards?: StandardReference[];
  retryPolicy?: string;
};

export type QualityIssue = {
  severity: "ok" | "warn";
  code: string;
  message: string;
};

const DEFAULT_SKILL = {
  completionType: "SKILL_DEMONSTRATION",
  scoringMethod: "PASS_FAIL",
  evaluatorSignOffRequired: true,
  repetitionsRequired: 1,
  memberNotesAllowed: true,
  evaluatorNotesEnabled: true,
  evidenceType: "SKILL_EVALUATION",
} as const;

export function skillDefaults(): typeof DEFAULT_SKILL {
  return { ...DEFAULT_SKILL };
}

export function defaultCompletionType(evidenceType?: string): CompletionType {
  switch (evidenceType) {
    case "SKILL_EVALUATION":
      return "SKILL_DEMONSTRATION";
    case "WRITTEN_NOTE":
      return "KNOWLEDGE_VERIFICATION";
    case "SUPERVISOR_OBSERVATION":
      return "OBSERVATION";
    case "TRAINING_ATTENDANCE":
      return "TRAINING_ATTENDANCE";
    case "CERTIFICATION_UPLOAD":
      return "CERTIFICATION";
    case "TIME_ENTRY":
      return "DRIVING_TIME";
    case "INCIDENT_RECORD":
      return "CALL_EXPERIENCE";
    case "FILE":
      return "DOCUMENT_UPLOAD";
    default:
      return "SKILL_DEMONSTRATION";
  }
}

export function defaultApprovalPath(supervisorRequired?: boolean, evaluatorRequired = true): ApprovalLevel[] {
  if (!evaluatorRequired && supervisorRequired) return ["SUPERVISOR"];
  if (supervisorRequired) return ["EVALUATOR", "SUPERVISOR"];
  return ["EVALUATOR"];
}

export function serializeRequirement(input: RequirementFields) {
  const approvalPath =
    input.approvalPath && input.approvalPath.length
      ? input.approvalPath
      : defaultApprovalPath(input.supervisorApprovalRequired, input.evaluatorSignOffRequired ?? true);
  const evidenceTypes =
    input.evidenceTypes && input.evidenceTypes.length
      ? input.evidenceTypes
      : input.evidenceType && input.evidenceType !== "NONE"
        ? [input.evidenceType]
        : [];
  return {
    title: (input.title || "").trim() || "Untitled requirement",
    description: (input.description || "").trim(),
    instructions: (input.instructions || "").trim(),
    sortOrder: input.sortOrder,
    isRequired: input.isRequired ?? true,
    dueOffsetDays: input.dueOffsetDays ?? null,
    referenceDocument: input.referenceDocument || null,
    referenceUrl: input.referenceUrl || null,
    evidenceType: input.evidenceType || "SKILL_EVALUATION",
    memberNotesAllowed: input.memberNotesAllowed ?? true,
    evaluatorNotesEnabled: input.evaluatorNotesEnabled ?? true,
    supervisorApprovalRequired: input.supervisorApprovalRequired ?? approvalPath.includes("SUPERVISOR"),
    evaluatorSignOffRequired: input.evaluatorSignOffRequired ?? true,
    repetitionsRequired: Math.max(1, input.repetitionsRequired ?? 1),
    prerequisitesJson: JSON.stringify(input.prerequisites ?? []),
    estimatedMinutes: input.estimatedMinutes ?? null,
    tagsJson: JSON.stringify(input.tags ?? []),
    internalNotes: input.internalNotes ?? "",
    objectivesJson: JSON.stringify((input.objectives ?? []).map((item) => item.trim()).filter(Boolean)),
    completionType: input.completionType || defaultCompletionType(input.evidenceType),
    scoringMethod: input.scoringMethod || "PASS_FAIL",
    evaluationStepsJson: JSON.stringify((input.evaluationSteps ?? []).filter((step) => step.text.trim())),
    criticalFailuresJson: JSON.stringify((input.criticalFailures ?? []).filter((item) => item.text.trim())),
    evidenceTypesJson: JSON.stringify(evidenceTypes),
    maxAttempts: input.maxAttempts ?? null,
    retryWaitHours: input.retryWaitHours ?? null,
    remediationRequired: input.remediationRequired ?? false,
    supervisorReviewOnFail: input.supervisorReviewOnFail ?? false,
    approvalPathJson: JSON.stringify(approvalPath),
    standardsJson: JSON.stringify(input.standards ?? []),
    retryPolicy: input.retryPolicy || "UNLIMITED",
  };
}

export function deserializeRequirement<T extends Record<string, unknown>>(requirement: T) {
  const row = requirement as T & {
    objectivesJson?: string;
    tagsJson?: string;
    prerequisitesJson?: string;
    evaluationStepsJson?: string;
    criticalFailuresJson?: string;
    evidenceTypesJson?: string;
    approvalPathJson?: string;
    standardsJson?: string;
    supervisorApprovalRequired?: boolean;
    evaluatorSignOffRequired?: boolean;
    evidenceType?: string;
  };
  const approvalPath = parseJsonArray(row.approvalPathJson);
  return {
    ...requirement,
    objectives: parseJsonArray(row.objectivesJson),
    tags: parseJsonArray(row.tagsJson),
    prerequisites: parseJsonArray(row.prerequisitesJson),
    evaluationSteps: parseJsonValue<EvaluationStep[]>(row.evaluationStepsJson, []),
    criticalFailures: parseJsonValue<CriticalFailure[]>(row.criticalFailuresJson, []),
    evidenceTypes: parseJsonArray(row.evidenceTypesJson),
    approvalPath: approvalPath.length
      ? approvalPath
      : defaultApprovalPath(row.supervisorApprovalRequired, row.evaluatorSignOffRequired ?? true),
    standards: parseJsonValue<StandardReference[]>(row.standardsJson, []),
  };
}

export function copyRequirementData(requirement: Record<string, unknown>) {
  const parsed = deserializeRequirement(requirement);
  return serializeRequirement({
    title: String(parsed.title || ""),
    description: String(parsed.description || ""),
    instructions: String(parsed.instructions || ""),
    sortOrder: Number(parsed.sortOrder || 0),
    isRequired: Boolean(parsed.isRequired),
    dueOffsetDays: (parsed.dueOffsetDays as number | null) ?? null,
    referenceDocument: (parsed.referenceDocument as string | null) ?? null,
    referenceUrl: (parsed.referenceUrl as string | null) ?? null,
    evidenceType: String(parsed.evidenceType || "SKILL_EVALUATION"),
    memberNotesAllowed: Boolean(parsed.memberNotesAllowed),
    evaluatorNotesEnabled: Boolean(parsed.evaluatorNotesEnabled),
    supervisorApprovalRequired: Boolean(parsed.supervisorApprovalRequired),
    evaluatorSignOffRequired: Boolean(parsed.evaluatorSignOffRequired),
    repetitionsRequired: Number(parsed.repetitionsRequired || 1),
    prerequisites: parsed.prerequisites,
    estimatedMinutes: (parsed.estimatedMinutes as number | null) ?? null,
    tags: parsed.tags,
    internalNotes: String(parsed.internalNotes || ""),
    objectives: parsed.objectives,
    completionType: String(parsed.completionType || "SKILL_DEMONSTRATION"),
    scoringMethod: String(parsed.scoringMethod || "PASS_FAIL"),
    evaluationSteps: parsed.evaluationSteps,
    criticalFailures: parsed.criticalFailures,
    evidenceTypes: parsed.evidenceTypes,
    maxAttempts: (parsed.maxAttempts as number | null) ?? null,
    retryWaitHours: (parsed.retryWaitHours as number | null) ?? null,
    remediationRequired: Boolean(parsed.remediationRequired),
    supervisorReviewOnFail: Boolean(parsed.supervisorReviewOnFail),
    approvalPath: parsed.approvalPath,
    standards: parsed.standards,
    retryPolicy: String(parsed.retryPolicy || "UNLIMITED"),
  });
}

export type DraftSection = {
  title: string;
  description?: string;
  requirements: Array<{
    title: string;
    description?: string;
    instructions?: string;
    objectives?: string[];
    isRequired?: boolean;
  }>;
};

export function reviewTaskBook(input: {
  title: string;
  sections: Array<{
    title: string;
    requirements: Array<{
      title: string;
      instructions?: string;
      description?: string;
      evaluationSteps?: EvaluationStep[];
      standards?: StandardReference[];
      clientId?: string;
    }>;
  }>;
}): { issues: QualityIssue[]; sectionCount: number; requirementCount: number; ready: boolean } {
  const issues: QualityIssue[] = [];
  const sectionCount = input.sections.length;
  const requirementCount = input.sections.reduce((sum, section) => sum + section.requirements.length, 0);

  if (!input.title.trim()) {
    issues.push({ severity: "warn", code: "title", message: "Task Book needs a name before publishing." });
  }
  if (sectionCount === 0) {
    issues.push({ severity: "warn", code: "sections", message: "Add at least one section." });
  }
  if (requirementCount === 0) {
    issues.push({ severity: "warn", code: "requirements", message: "Add at least one requirement." });
  }

  input.sections.forEach((section, index) => {
    if (!section.requirements.length) {
      issues.push({
        severity: "warn",
        code: "empty-section",
        message: `Section ${index + 1}${section.title ? ` (${section.title})` : ""} has no tasks.`,
      });
    }
  });

  const titles = new Map<string, number>();
  for (const section of input.sections) {
    for (const req of section.requirements) {
      const key = req.title.trim().toLowerCase();
      if (key) titles.set(key, (titles.get(key) || 0) + 1);
      if (!req.instructions && !req.description) {
        issues.push({
          severity: "warn",
          code: "instructions",
          message: `"${req.title || "Untitled task"}" has no instructions.`,
        });
      }
      for (const standard of req.standards ?? []) {
        if (standard.organization || standard.standardName || standard.section) {
          if (!standard.organization || !standard.standardName) {
            issues.push({
              severity: "warn",
              code: "standard-source",
              message: `"${req.title || "Untitled task"}" has a standards reference with no source.`,
            });
          }
        }
      }
    }
  }
  for (const [title, count] of titles) {
    if (count > 1) {
      issues.push({
        severity: "warn",
        code: "duplicate",
        message: `Requirement "${title}" appears ${count} times.`,
      });
    }
  }

  const ready = !issues.some((issue) => issue.code === "sections" || issue.code === "requirements" || issue.code === "title");
  return { issues, sectionCount, requirementCount, ready };
}

export function nextApprovalLevel(
  path: string[],
  signOffs: Array<{ result: string; approvalLevel?: string | null }>,
): string | null {
  const levels = path.length ? path : ["EVALUATOR"];
  for (const level of levels) {
    const approved = signOffs.some(
      (sign) => (sign.approvalLevel || "EVALUATOR") === level && (sign.result === "APPROVED" || sign.result === "PASS"),
    );
    if (!approved) return level;
  }
  return null;
}

export function evaluationPasses(input: {
  result: SignOffResult | string;
  criticalFailuresTriggered?: string[];
}): { passed: boolean; result: string } {
  if ((input.criticalFailuresTriggered || []).length > 0) {
    return { passed: false, result: "CRITICAL_FAIL" };
  }
  if (input.result === "APPROVED" || input.result === "PASS") {
    return { passed: true, result: input.result === "PASS" ? "APPROVED" : input.result };
  }
  if (input.result === "NOT_EVALUATED") {
    return { passed: false, result: "NOT_EVALUATED" };
  }
  if (input.result === "NEEDS_REMEDIATION" || input.result === "RETURNED" || input.result === "FAIL") {
    return { passed: false, result: input.result === "FAIL" ? "RETURNED" : input.result };
  }
  if (input.result === "CRITICAL_FAIL") {
    return { passed: false, result: "CRITICAL_FAIL" };
  }
  return { passed: false, result: input.result };
}

export type UpNextItem = {
  requirementId: string;
  title: string;
  sectionTitle: string;
  reason: string;
  locked: boolean;
  lockReason?: string;
};

export function computeUpNext(input: {
  sections: Array<{
    title: string;
    requirements: Array<{
      id: string;
      title: string;
      isRequired: boolean;
      prerequisites?: string[];
    }>;
  }>;
  completions: Array<{ requirementId: string; status: string }>;
  limit?: number;
}): UpNextItem[] {
  const statusById = new Map(input.completions.map((item) => [item.requirementId, item.status]));
  const titleById = new Map<string, string>();
  for (const section of input.sections) {
    for (const req of section.requirements) titleById.set(req.id, req.title);
  }
  const items: UpNextItem[] = [];
  for (const section of input.sections) {
    for (const req of section.requirements) {
      const status = statusById.get(req.id) ?? "NOT_STARTED";
      if (status === "APPROVED") continue;
      const unmet = (req.prerequisites || []).filter((id) => statusById.get(id) !== "APPROVED");
      const locked = unmet.length > 0;
      items.push({
        requirementId: req.id,
        title: req.title,
        sectionTitle: section.title,
        locked,
        lockReason: locked
          ? `Complete ${unmet.map((id) => titleById.get(id) || "a prior task").join(", ")} first.`
          : undefined,
        reason:
          status === "SUBMITTED"
            ? "Waiting on evaluator sign-off"
            : status === "RETURNED"
              ? "Needs remediation"
              : locked
                ? "Locked until prerequisites are complete"
                : "Ready to work",
      });
    }
  }
  const unlocked = items.filter((item) => !item.locked);
  const locked = items.filter((item) => item.locked);
  return [...unlocked, ...locked].slice(0, input.limit ?? 3);
}

export function requirementStateLabel(status: string, overdue = false, locked = false) {
  if (locked) return "Locked";
  if (overdue && status !== "APPROVED") return "Overdue";
  switch (status) {
    case "NOT_STARTED":
      return "Not started";
    case "IN_PROGRESS":
      return "In progress";
    case "SUBMITTED":
      return "Ready for evaluation";
    case "RETURNED":
      return "Needs remediation";
    case "APPROVED":
      return "Approved";
    default:
      return status.replaceAll("_", " ").toLowerCase();
  }
}
