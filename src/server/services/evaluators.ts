import { prisma } from "@/server/db";
import { reviewStageForRequirement } from "@/lib/signoff";
import { HttpError, writeActivity, writeAudit } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";
import { assignmentRecordPath } from "@/lib/routes";
import { notifyUser } from "@/server/services/inbox";

const REVIEWER_ROLES = ["INSTRUCTOR", "EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"];
const EVALUATOR_STATUSES = new Set(["ROLE_DEFAULT", "APPROVED", "SUSPENDED"]);
const APPROVAL_LEVELS = new Set(["EVALUATOR", "COMPANY_OFFICER", "PRECEPTOR", "FTO"]);

export function approvedEvaluatorWhere(departmentId: string) {
  return {
    departmentId,
    status: "ACTIVE",
    role: { in: REVIEWER_ROLES },
    evaluatorStatus: { not: "SUSPENDED" },
  } as const;
}

export async function assertApprovedEvaluator(ctx: AuthContext) {
  const membership = await prisma.departmentMembership.findFirst({
    where: { ...approvedEvaluatorWhere(ctx.departmentId), id: ctx.membershipId, userId: ctx.userId },
    select: { id: true },
  });
  if (!membership) throw new HttpError(403, "Your evaluator authorization is suspended.");
}

async function pendingForEvaluator(departmentId: string, userId: string) {
  const pending = await prisma.requirementCompletion.findMany({
    where: {
      status: "SUBMITTED",
      assignment: { departmentId },
      OR: [
        { requestedEvaluatorId: userId },
        { requestedEvaluatorId: null, assignment: { evaluatorId: userId } },
      ],
    },
    include: {
      membership: { include: { user: true } },
      requirement: true,
      signOffs: true,
      assignment: { include: { version: { include: { template: true } } } },
    },
    orderBy: { submittedAt: "asc" },
  });
  return pending.filter((item) => reviewStageForRequirement({
    evaluatorSignOffRequired: item.requirement.evaluatorSignOffRequired,
    supervisorApprovalRequired: item.requirement.supervisorApprovalRequired,
    signOffs: item.signOffs,
    submittedAt: item.submittedAt,
  }) === "EVALUATOR");
}

export async function listEvaluatorManagement(ctx: AuthContext) {
  assertPermission(ctx, "evaluators.manage");
  const department = await prisma.department.findUnique({
    where: { id: ctx.departmentId },
    select: { evaluationEscalationHours: true },
  });
  const escalationHours = Math.max(1, department?.evaluationEscalationHours || 48);
  const escalationCutoff = new Date(Date.now() - escalationHours * 3_600_000);
  const people = await prisma.departmentMembership.findMany({
    where: {
      departmentId: ctx.departmentId,
      status: "ACTIVE",
      role: { in: REVIEWER_ROLES },
    },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });
  const pending = await prisma.requirementCompletion.findMany({
    where: { status: "SUBMITTED", assignment: { departmentId: ctx.departmentId } },
    select: {
      requestedEvaluatorId: true,
      assignment: { select: { evaluatorId: true } },
      requirement: { select: { evaluatorSignOffRequired: true, supervisorApprovalRequired: true } },
      signOffs: { select: { result: true, signedAt: true } },
      submittedAt: true,
    },
  });
  const workload = new Map<string, { count: number; oldest: Date | null; escalated: number }>();
  for (const item of pending) {
    if (reviewStageForRequirement({
      evaluatorSignOffRequired: item.requirement.evaluatorSignOffRequired,
      supervisorApprovalRequired: item.requirement.supervisorApprovalRequired,
      signOffs: item.signOffs,
      submittedAt: item.submittedAt,
    }) !== "EVALUATOR") continue;
    const userId = item.requestedEvaluatorId || item.assignment.evaluatorId;
    if (!userId) continue;
    const current = workload.get(userId) || { count: 0, oldest: null, escalated: 0 };
    current.count += 1;
    if (item.submittedAt && item.submittedAt <= escalationCutoff) current.escalated += 1;
    if (item.submittedAt && (!current.oldest || item.submittedAt < current.oldest)) current.oldest = item.submittedAt;
    workload.set(userId, current);
  }
  return people.map((item) => ({
    membershipId: item.id,
    userId: item.userId,
    name: item.user.name,
    rank: item.rank,
    role: item.role,
    evaluatorStatus: item.evaluatorStatus,
    approvalLevel: item.evaluatorApprovalLevel,
    approved: item.evaluatorStatus !== "SUSPENDED",
    pendingCount: workload.get(item.userId)?.count || 0,
    escalatedCount: workload.get(item.userId)?.escalated || 0,
    escalationHours,
    oldestPendingAt: workload.get(item.userId)?.oldest || null,
    statusUpdatedAt: item.evaluatorStatusUpdatedAt,
  }));
}

export async function updateEvaluator(
  ctx: AuthContext,
  membershipId: string,
  input: { status?: string; approvalLevel?: string },
) {
  assertPermission(ctx, "evaluators.manage");
  const membership = await prisma.departmentMembership.findFirst({
    where: { id: membershipId, departmentId: ctx.departmentId, role: { in: REVIEWER_ROLES } },
    include: { user: true },
  });
  if (!membership) throw new HttpError(404, "Evaluator not found.");
  const status = String(input.status || membership.evaluatorStatus).trim().toUpperCase();
  const approvalLevel = String(input.approvalLevel || membership.evaluatorApprovalLevel).trim().toUpperCase();
  if (!EVALUATOR_STATUSES.has(status)) throw new HttpError(400, "Invalid evaluator status.");
  if (!APPROVAL_LEVELS.has(approvalLevel)) throw new HttpError(400, "Invalid approval level.");
  if (status === "SUSPENDED") {
    const pending = await pendingForEvaluator(ctx.departmentId, membership.userId);
    if (pending.length) {
      throw new HttpError(409, `Reassign ${pending.length} pending evaluation${pending.length === 1 ? "" : "s"} before suspending this evaluator.`);
    }
  }
  await prisma.departmentMembership.update({
    where: { id: membership.id },
    data: {
      evaluatorStatus: status,
      evaluatorApprovalLevel: approvalLevel,
      evaluatorStatusUpdatedAt: new Date(),
      evaluatorStatusUpdatedById: ctx.userId,
    },
  });
  await writeAudit(ctx, "evaluator.status.updated", "DepartmentMembership", membership.id, {
    userId: membership.userId,
    fromStatus: membership.evaluatorStatus,
    status,
    approvalLevel,
  });
  await writeActivity(ctx.departmentId, "EVALUATOR_STATUS_UPDATED", {
    userId: membership.userId,
    metadata: { actorName: ctx.name, evaluatorName: membership.user.name, status, approvalLevel },
  });
  return listEvaluatorManagement(ctx);
}

export async function reassignEvaluator(
  ctx: AuthContext,
  fromUserId: string,
  newEvaluatorIdValue: unknown,
) {
  assertPermission(ctx, "evaluators.manage");
  const newEvaluatorId = String(newEvaluatorIdValue || "").trim();
  if (!newEvaluatorId || newEvaluatorId === fromUserId) throw new HttpError(400, "Choose a different approved evaluator.");
  const [from, target, pending] = await Promise.all([
    prisma.departmentMembership.findFirst({ where: { departmentId: ctx.departmentId, userId: fromUserId }, include: { user: true } }),
    prisma.departmentMembership.findFirst({ where: { ...approvedEvaluatorWhere(ctx.departmentId), userId: newEvaluatorId }, include: { user: true } }),
    pendingForEvaluator(ctx.departmentId, fromUserId),
  ]);
  if (!from) throw new HttpError(404, "Current evaluator not found.");
  if (!target) throw new HttpError(400, "Choose an active, approved evaluator.");
  if (!pending.length) return { reassigned: 0, evaluators: await listEvaluatorManagement(ctx) };

  await prisma.$transaction(
    pending.map((item) => prisma.requirementCompletion.update({
      where: { id: item.id },
      data: { requestedEvaluatorId: target.userId },
    })),
  );
  for (const item of pending) {
    await notifyUser({
      departmentId: ctx.departmentId,
      userId: target.userId,
      type: "EVALUATION_REASSIGNED",
      title: "Evaluation reassigned to you",
      body: `${item.membership.user.name}'s ${item.requirement.title} is ready for review.`,
      referenceType: "RequirementCompletion",
      referenceId: item.id,
      actionPath: "/evaluate",
      dedupeKey: `evaluation-reassigned:${item.id}:${target.userId}`,
    });
    await notifyUser({
      departmentId: ctx.departmentId,
      userId: item.membership.userId,
      type: "EVALUATOR_CHANGED",
      title: "Evaluator updated",
      body: `${target.user.name} is now reviewing ${item.requirement.title}.`,
      referenceType: "RequirementCompletion",
      referenceId: item.id,
      actionPath: assignmentRecordPath(item.assignmentId),
      dedupeKey: `evaluator-changed:${item.id}:${target.userId}`,
    });
  }
  await writeAudit(ctx, "evaluations.reassigned", "User", fromUserId, {
    fromEvaluatorName: from.user.name,
    toEvaluatorId: target.userId,
    toEvaluatorName: target.user.name,
    completionIds: pending.map((item) => item.id),
    count: pending.length,
  });
  await writeActivity(ctx.departmentId, "EVALUATIONS_REASSIGNED", {
    userId: target.userId,
    metadata: { actorName: ctx.name, fromEvaluator: from.user.name, toEvaluator: target.user.name, count: pending.length },
  });
  return { reassigned: pending.length, evaluators: await listEvaluatorManagement(ctx) };
}


// Only active department members are eligible to be added. This does not invite outsiders.
export async function listEvaluatorCandidates(ctx: AuthContext) {
  assertPermission(ctx, "evaluators.manage");
  const members = await prisma.departmentMembership.findMany({
    where: { departmentId: ctx.departmentId, status: "ACTIVE", role: "MEMBER" },
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return members.map((member) => ({ membershipId: member.id, name: member.user.name, rank: member.rank }));
}

export async function addEvaluator(ctx: AuthContext, membershipIdValue: unknown, levelValue: unknown) {
  assertPermission(ctx, "evaluators.manage");
  const membershipId = String(membershipIdValue || "").trim();
  const approvalLevel = String(levelValue || "EVALUATOR").trim().toUpperCase();
  if (!membershipId) throw new HttpError(400, "Select a department member.");
  if (!APPROVAL_LEVELS.has(approvalLevel)) throw new HttpError(400, "Invalid approval level.");
  const member = await prisma.departmentMembership.findFirst({
    where: { id: membershipId, departmentId: ctx.departmentId, role: "MEMBER", status: "ACTIVE" },
    include: { user: { select: { name: true } } },
  });
  if (!member) throw new HttpError(404, "Active department member not found or already authorized.");
  await prisma.departmentMembership.update({
    where: { id: member.id },
    data: {
      role: "EVALUATOR", evaluatorStatus: "APPROVED", evaluatorApprovalLevel: approvalLevel,
      evaluatorStatusUpdatedAt: new Date(), evaluatorStatusUpdatedById: ctx.userId,
    },
  });
  await writeAudit(ctx, "evaluator.added", "DepartmentMembership", member.id, {
    userId: member.userId, previousRole: member.role, approvalLevel,
  });
  await writeActivity(ctx.departmentId, "EVALUATOR_STATUS_UPDATED", {
    userId: member.userId,
    metadata: { actorName: ctx.name, evaluatorName: member.user.name, status: "APPROVED", approvalLevel },
  });
  return listEvaluatorManagement(ctx);
}

// Demote an evaluator without deleting their department account, training records, or signed evaluations.
export async function removeEvaluator(ctx: AuthContext, membershipId: string) {
  assertPermission(ctx, "evaluators.manage");
  const member = await prisma.departmentMembership.findFirst({
    where: { id: membershipId, departmentId: ctx.departmentId, role: "EVALUATOR", status: "ACTIVE" },
    include: { user: { select: { name: true } } },
  });
  if (!member) throw new HttpError(404, "Active evaluator not found. Officers can be suspended, but their department roles cannot be removed here.");
  if (member.id === ctx.membershipId) throw new HttpError(400, "You cannot remove your own evaluator role.");
  const [pendingCount, assignmentCount, supervisorCount] = await Promise.all([
    prisma.requirementCompletion.count({
      where: { status: "SUBMITTED", assignment: { departmentId: ctx.departmentId }, requestedEvaluatorId: member.userId },
    }),
    prisma.taskBookAssignment.count({
      where: { departmentId: ctx.departmentId, evaluatorId: member.userId, status: { not: "COMPLETE" } },
    }),
    prisma.taskBookAssignment.count({
      where: { departmentId: ctx.departmentId, supervisorId: member.userId, status: { not: "COMPLETE" } },
    }),
  ]);
  if (pendingCount || assignmentCount || supervisorCount) {
    throw new HttpError(409, `Reassign this evaluator's ${pendingCount} pending requests and ${assignmentCount + supervisorCount} active task-book responsibilities before removal.`);
  }
  await prisma.departmentMembership.update({
    where: { id: member.id },
    data: {
      role: "MEMBER", evaluatorStatus: "SUSPENDED",
      evaluatorStatusUpdatedAt: new Date(), evaluatorStatusUpdatedById: ctx.userId,
    },
  });
  await writeAudit(ctx, "evaluator.removed", "DepartmentMembership", member.id, {
    userId: member.userId, previousRole: member.role,
  });
  await writeActivity(ctx.departmentId, "EVALUATOR_STATUS_UPDATED", {
    userId: member.userId,
    metadata: { actorName: ctx.name, evaluatorName: member.user.name, status: "REMOVED" },
  });
  return listEvaluatorManagement(ctx);
}
