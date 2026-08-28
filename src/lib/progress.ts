import type { AssignmentStatus, CompletionStatus } from "@/lib/constants";

export type RequirementLike = {
  id: string;
  isRequired: boolean;
  dueOffsetDays?: number | null;
  repetitionsRequired?: number | null;
};

export type CompletionLike = {
  requirementId: string;
  status: CompletionStatus | string;
  repetitionCount?: number | null;
};

export type ProgressSummary = {
  totalRequired: number;
  complete: number;
  pendingApproval: number;
  overdue: number;
  percent: number;
  status: AssignmentStatus;
};

export function requirementIsComplete(requirement: RequirementLike, completion?: CompletionLike | null): boolean {
  if (!completion) return false;
  if (completion.status === "APPROVED") return true;
  const needed = Math.max(1, requirement.repetitionsRequired ?? 1);
  return (completion.repetitionCount ?? 0) >= needed;
}

export function computeAssignmentProgress(input: {
  requirements: RequirementLike[];
  completions: CompletionLike[];
  assignedDate: Date;
  dueDate?: Date | null;
  now?: Date;
}): ProgressSummary {
  const now = input.now ?? new Date();
  const required = input.requirements.filter((req) => req.isRequired);
  const completionByReq = new Map(input.completions.map((item) => [item.requirementId, item]));

  let complete = 0;
  let pendingApproval = 0;
  let overdue = 0;
  let anyStarted = false;

  for (const req of required) {
    const completion = completionByReq.get(req.id);
    const status = completion?.status ?? "NOT_STARTED";
    if (status !== "NOT_STARTED") anyStarted = true;
    if (requirementIsComplete(req, completion)) complete += 1;
    else if (status === "SUBMITTED") pendingApproval += 1;

    const due =
      req.dueOffsetDays != null
        ? new Date(input.assignedDate.getTime() + req.dueOffsetDays * 86_400_000)
        : input.dueDate ?? null;
    if (due && due.getTime() < now.getTime() && !requirementIsComplete(req, completion)) {
      overdue += 1;
    }
  }

  const percent = required.length === 0 ? 0 : Math.round((complete / required.length) * 100);
  const pastAssignmentDue = Boolean(input.dueDate && input.dueDate.getTime() < now.getTime() && percent < 100);

  let status: AssignmentStatus;
  if (percent >= 100) status = "COMPLETE";
  else if (pastAssignmentDue || overdue > 0) status = "OVERDUE";
  else if (pendingApproval > 0) status = "AWAITING_SIGN_OFF";
  else if (anyStarted) status = "IN_PROGRESS";
  else status = "NOT_STARTED";

  return {
    totalRequired: required.length,
    complete,
    pendingApproval,
    overdue,
    percent,
    status,
  };
}

export function assignmentStatusLabel(status: AssignmentStatus | string): string {
  switch (status) {
    case "NOT_STARTED":
      return "Not Started";
    case "IN_PROGRESS":
      return "In Progress";
    case "AWAITING_SIGN_OFF":
      return "Awaiting Sign-Off";
    case "COMPLETE":
      return "Complete";
    case "OVERDUE":
      return "Overdue";
    default:
      return status;
  }
}

export function daysStalled(input: { updatedAt?: Date | string | null; submittedAt?: Date | string | null; assignedDate: Date | string; now?: Date }): number {
  const now = input.now ?? new Date();
  const last = input.updatedAt || input.submittedAt || input.assignedDate;
  const date = last instanceof Date ? last : new Date(last);
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}
