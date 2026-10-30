import type { AuthContext } from "@/server/permissions";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/server/db";
import * as assignments from "@/server/services/assignments";
import * as classes from "@/server/services/classes";
import * as memberApp from "@/server/services/memberApp";
import * as qualifications from "@/server/services/qualifications";

export type WorkQueueItem = {
  id: string;
  kind: "MEMBER_APPROVAL" | "ROLE_APPROVAL" | "ASSIGNMENT" | "EVALUATION" | "TRAINING_SHEET" | "RMS_ENTRY";
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
  const canReview = reviewRoles.has(ctx.role);
  const canSeeTraining = instructorRoles.has(ctx.role);
  const canApproveMembers = hasPermission(ctx.role, "invitations.write") && hasPermission(ctx.role, "members.write");
  const canApproveRoles = ["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"].includes(ctx.role);
  const [myAssignments, reviewQueue, instructorData, pendingMembers, roleReviews] = await Promise.all([
    memberApp.listMyAssignments(ctx),
    canReview ? assignments.listSignOffQueue(ctx, { view: "needs_me" }) : Promise.resolve(null),
    canSeeTraining
      ? Promise.all([
          classes.listInstructorTrainingAttention(ctx),
          classes.listRmsActionQueue(ctx),
        ] as const)
      : Promise.resolve(null),
    canApproveMembers ? prisma.departmentMembership.findMany({
      where: { departmentId: ctx.departmentId, status: "PENDING" },
      select: { id: true, joinedAt: true, user: { select: { name: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    }) : Promise.resolve([]),
    canApproveRoles ? qualifications.departmentQualificationsForApp(ctx) : Promise.resolve(null),
  ]);

  for (const member of roleReviews?.members ?? []) {
    for (const role of member.qualifications.filter((item) => item.status === "AWAITING_APPROVAL" && item.requirementsMet && item.evidence.length > 0)) {
      items.push({
        id: `role-approval:${member.membershipId}:${role.id}`,
        kind: "ROLE_APPROVAL",
        priority: "HIGH",
        title: role.name,
        reason: `${member.name} · all qualifications complete`,
        owner: "Training Officer",
        actionLabel: "Review role approval",
        href: `/qualifications?member=${encodeURIComponent(member.membershipId)}&role=${encodeURIComponent(role.id)}`,
        targetId: `${member.membershipId}:${role.id}`,
        dueAt: null,
      });
    }
  }

  for (const member of pendingMembers) {
    items.push({
      id: `member-approval:${member.id}`,
      kind: "MEMBER_APPROVAL",
      priority: "HIGH",
      title: `${member.user.name} requested department access`,
      reason: `Join-code request · ${member.user.email}`,
      owner: "Training Officer",
      actionLabel: "Review request",
      href: "/enrollment",
      targetId: member.id,
      dueAt: member.joinedAt,
    });
  }

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

  if (reviewQueue) {
    for (const review of reviewQueue.items) {
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

  if (instructorData) {
    const [training, rms] = instructorData;
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

  if (canSeeTraining) {
    const completedBooks = await prisma.taskBookAssignment.findMany({
      where: { departmentId: ctx.departmentId, status: "COMPLETE", version: { template: { templateKind: { not: "TRAINING_TASK" } } } },
      select: { id: true, updatedAt: true, membership: { select: { user: { select: { name: true } } } }, version: { select: { template: { select: { title: true } } } } },
      orderBy: { updatedAt: "asc" },
    });
    const entered = completedBooks.length ? await prisma.activityEvent.findMany({
      where: { departmentId: ctx.departmentId, type: "TASKBOOK_RMS_ENTERED", referenceId: { in: completedBooks.map((item) => item.id) } },
      select: { referenceId: true },
    }) : [];
    const enteredIds = new Set(entered.map((item) => item.referenceId));
    for (const item of completedBooks.filter((book) => !enteredIds.has(book.id))) {
      items.push({ id: `taskbook-rms:${item.id}`, kind: "RMS_ENTRY", priority: "HIGH", title: item.version.template.title, reason: `${item.membership.user.name} completed Task Book · awaiting RMS entry`, owner: "Training Officer", actionLabel: "Open RMS summary", href: `/assignments/${item.id}`, targetId: item.id, dueAt: item.updatedAt });
    }
  }

  const sorted = sortWorkQueue(items);
  return { items: sorted, count: sorted.length, next: sorted[0] ?? null, serverTime: new Date() };
}
