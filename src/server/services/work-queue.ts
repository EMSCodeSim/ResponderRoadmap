import type { AuthContext } from "@/server/permissions";
import * as assignments from "@/server/services/assignments";
import * as classes from "@/server/services/classes";
import * as memberApp from "@/server/services/memberApp";

export type WorkQueueItem = {
  id: string;
  kind: "ASSIGNMENT" | "EVALUATION" | "TRAINING_SHEET" | "RMS_ENTRY";
  priority: "URGENT" | "HIGH" | "NORMAL";
  title: string;
  reason: string;
  owner: string;
  actionLabel: string;
  href: string;
  targetId: string;
  dueAt: Date | null;
};

const reviewRoles = new Set(["EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"]);
const instructorRoles = new Set(["INSTRUCTOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"]);

export function sortWorkQueue(items: WorkQueueItem[]) {
  const priority = { URGENT: 0, HIGH: 1, NORMAL: 2 };
  return [...items].sort((a, b) =>
    priority[a.priority] - priority[b.priority] ||
    (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
    a.title.localeCompare(b.title),
  );
}

export async function getWorkQueue(ctx: AuthContext) {
  const now = new Date();
  const dueSoonAt = new Date(now.getTime() + 14 * 86_400_000);
  const items: WorkQueueItem[] = [];
  const myAssignments = await memberApp.listMyAssignments(ctx);

  for (const assignment of myAssignments) {
    const returned = assignment.sections.flatMap((section) => section.requirements)
      .some((requirement) => requirement.completion?.status === "RETURNED" && !!requirement.completion.correction?.notes.trim());
    const dueAt = assignment.dueDate ? new Date(assignment.dueDate) : null;
    const overdue = assignment.overdue > 0 || (!!dueAt && dueAt < now && assignment.progress < 100);
    const dueSoon = !!dueAt && dueAt >= now && dueAt <= dueSoonAt && assignment.progress < 100;
    if (!returned && !overdue && !dueSoon) continue;
    items.push({
      id: `assignment:${assignment.id}`,
      kind: "ASSIGNMENT",
      priority: returned || overdue ? "URGENT" : "NORMAL",
      title: assignment.taskBookTitle,
      reason: returned ? "Returned — correction needed" : overdue ? "Overdue training" : "Due within 14 days",
      owner: "You",
      actionLabel: returned ? "Correct and resubmit" : "Continue assignment",
      href: `/my-task-books/${assignment.id}`,
      targetId: assignment.id,
      dueAt,
    });
  }

  if (reviewRoles.has(ctx.role)) {
    const queue = await assignments.listSignOffQueue(ctx, { view: "needs_me" });
    for (const review of queue.items) {
      items.push({
        id: `evaluation:${review.id}`,
        kind: "EVALUATION",
        priority: review.escalated ? "URGENT" : "HIGH",
        title: review.requirementTitle,
        reason: `${review.memberName} · ${review.nextAction}`,
        owner: review.owner || "Assigned evaluator",
        actionLabel: "Review evaluation",
        href: `/evaluate?focus=${review.id}`,
        targetId: review.id,
        dueAt: review.submittedAt ? new Date(review.submittedAt) : null,
      });
    }
  }

  if (instructorRoles.has(ctx.role)) {
    const [training, rms] = await Promise.all([
      classes.listInstructorTrainingAttention(ctx),
      classes.listRmsActionQueue(ctx),
    ]);
    for (const item of training) {
      const complete = item.status === "COMPLETE";
      items.push({
        id: `training:${item.id}`,
        kind: complete && item.rmsStatus === "AWAITING_ENTRY" ? "RMS_ENTRY" : "TRAINING_SHEET",
        priority: complete && item.rmsStatus === "AWAITING_ENTRY" ? "HIGH" : "NORMAL",
        title: item.title,
        reason: !complete ? "Complete roster, grading, and closeout" : item.instructorApprovedAt == null ? "Instructor approval needed" : "Awaiting RMS entry",
        owner: complete && item.rmsStatus === "AWAITING_ENTRY" ? "Training Officer" : "Instructor",
        actionLabel: complete && item.rmsStatus === "AWAITING_ENTRY" ? "Confirm RMS entry" : "Continue Training Sheet",
        href: `/classes/${item.id}`,
        targetId: item.id,
        dueAt: item.startsAt,
      });
    }
    for (const item of rms.filter((row) => !training.some((mine) => mine.id === row.id))) {
      items.push({ id: `rms:${item.id}`, kind: "RMS_ENTRY", priority: "HIGH", title: item.title, reason: "Approved training is awaiting RMS entry", owner: "Training Officer", actionLabel: "Confirm RMS entry", href: `/classes/${item.id}`, targetId: item.id, dueAt: item.startsAt });
    }
  }

  const sorted = sortWorkQueue(items);
  return { items: sorted, count: sorted.length, next: sorted[0] ?? null, serverTime: new Date() };
}
