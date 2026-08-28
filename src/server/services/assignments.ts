import { prisma } from "@/server/db";
import { writeActivity, writeAudit, HttpError } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";
import { computeAssignmentProgress } from "@/lib/progress";
import { approvalsSinceSubmission, reviewStageForRequirement } from "@/lib/signoff";
import type { SignOffResult } from "@/lib/constants";

const REVIEWER_ROLES = ["EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"];

async function assignmentWithGraph(id: string, departmentId: string) {
  return prisma.taskBookAssignment.findFirst({
    where: { id, departmentId },
    include: {
      membership: { include: { user: true } },
      assignedBy: true,
      evaluator: true,
      supervisor: true,
      version: {
        include: {
          template: true,
          sections: { include: { requirements: true } },
        },
      },
      completions: {
        include: {
          evidence: true,
          signOffs: { include: { evaluator: true }, orderBy: { signedAt: "asc" } },
        },
      },
    },
  });
}

export async function refreshAssignmentStatus(assignmentId: string) {
  const assignment = await prisma.taskBookAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      version: { include: { sections: { include: { requirements: true } } } },
      completions: true,
    },
  });
  if (!assignment) return null;
  const progress = computeAssignmentProgress({
    requirements: assignment.version.sections.flatMap((section) => section.requirements),
    completions: assignment.completions,
    assignedDate: assignment.assignedDate,
    dueDate: assignment.dueDate,
  });
  return prisma.taskBookAssignment.update({
    where: { id: assignmentId },
    data: { status: progress.status },
  });
}

function toRow(assignment: NonNullable<Awaited<ReturnType<typeof assignmentWithGraph>>>) {
  const requirements = assignment.version.sections.flatMap((section) => section.requirements);
  const progress = computeAssignmentProgress({
    requirements,
    completions: assignment.completions,
    assignedDate: assignment.assignedDate,
    dueDate: assignment.dueDate,
  });
  return {
    id: assignment.id,
    memberId: assignment.membershipId,
    memberName: assignment.membership.user.name,
    rank: assignment.membership.rank,
    station: assignment.membership.station,
    shift: assignment.membership.shift,
    taskBookTitle: assignment.version.template.title,
    templateId: assignment.version.template.id,
    version: assignment.version.version,
    progress: progress.percent,
    pendingApproval: progress.pendingApproval,
    overdue: progress.overdue,
    complete: progress.complete,
    totalRequired: progress.totalRequired,
    dueDate: assignment.dueDate,
    assignedDate: assignment.assignedDate,
    assignedByName: assignment.assignedBy.name,
    evaluatorName: assignment.evaluator?.name ?? null,
    supervisorName: assignment.supervisor?.name ?? null,
    status: progress.status,
    notes: assignment.notes,
  };
}

export async function listAssignments(ctx: AuthContext) {
  assertPermission(ctx, "assignments.read");
  const assignments = await prisma.taskBookAssignment.findMany({
    where: { departmentId: ctx.departmentId },
    include: {
      membership: { include: { user: true } },
      assignedBy: true,
      evaluator: true,
      supervisor: true,
      version: { include: { template: true, sections: { include: { requirements: true } } } },
      completions: true,
    },
    orderBy: { assignedDate: "desc" },
  });
  return assignments.map((assignment) =>
    toRow(assignment as unknown as NonNullable<Awaited<ReturnType<typeof assignmentWithGraph>>>),
  );
}

async function validateReviewer(ctx: AuthContext, userId: string | null | undefined, label: string) {
  if (!userId) return null;
  const membership = await prisma.departmentMembership.findFirst({
    where: {
      departmentId: ctx.departmentId,
      userId,
      status: "ACTIVE",
      role: { in: REVIEWER_ROLES },
    },
    include: { user: true },
  });
  if (!membership) {
    throw new HttpError(400, `${label} must be an active department reviewer.`);
  }
  return membership;
}

export async function createAssignments(
  ctx: AuthContext,
  input: {
    versionId?: string;
    templateId?: string;
    membershipIds?: string[];
    rank?: string;
    station?: string;
    shift?: string;
    dueDate?: string | null;
    evaluatorId?: string | null;
    supervisorId?: string | null;
    notes?: string;
  },
) {
  assertPermission(ctx, "assignments.write");
  let versionId = input.versionId;
  if (!versionId && input.templateId) {
    const version = await prisma.taskBookVersion.findFirst({
      where: {
        templateId: input.templateId,
        template: { departmentId: ctx.departmentId },
        status: "PUBLISHED",
      },
      orderBy: { publishedAt: "desc" },
    });
    if (!version) throw new HttpError(400, "Publish a Task Book version before assigning it.");
    versionId = version.id;
  }
  if (!versionId) throw new HttpError(400, "Select a Task Book to assign.");

  const version = await prisma.taskBookVersion.findFirst({
    where: { id: versionId, template: { departmentId: ctx.departmentId } },
    include: { template: true },
  });
  if (!version) throw new HttpError(404, "Task Book version not found.");
  if (version.status !== "PUBLISHED") {
    throw new HttpError(400, "Only published Task Book versions can be assigned.");
  }

  await validateReviewer(ctx, input.evaluatorId, "Evaluator");
  await validateReviewer(ctx, input.supervisorId, "Supervisor");

  const where: {
    departmentId: string;
    status: string;
    id?: { in: string[] };
    rank?: string;
    station?: string;
    shift?: string;
  } = { departmentId: ctx.departmentId, status: "ACTIVE" };
  if (input.membershipIds?.length) where.id = { in: input.membershipIds };
  if (input.rank) where.rank = input.rank;
  if (input.station) where.station = input.station;
  if (input.shift) where.shift = input.shift;

  const members = await prisma.departmentMembership.findMany({
    where,
    include: { user: true },
  });
  if (members.length === 0) throw new HttpError(400, "No matching members to assign.");

  const dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    throw new HttpError(400, "Due date is invalid.");
  }

  const created = [];
  for (const member of members) {
    const existing = await prisma.taskBookAssignment.findUnique({
      where: { versionId_membershipId: { versionId: version.id, membershipId: member.id } },
    });
    if (existing) continue;
    const assignment = await prisma.taskBookAssignment.create({
      data: {
        departmentId: ctx.departmentId,
        versionId: version.id,
        membershipId: member.id,
        assignedById: ctx.userId,
        assignedDate: new Date(),
        dueDate,
        evaluatorId: input.evaluatorId || null,
        supervisorId: input.supervisorId || null,
        notes: input.notes?.trim() || "",
        status: "NOT_STARTED",
      },
    });
    created.push(assignment);
    await writeActivity(ctx.departmentId, "TASKBOOK_ASSIGNED", {
      userId: member.userId,
      referenceId: assignment.id,
      metadata: {
        title: version.template.title,
        memberName: member.user.name,
        actorName: ctx.name,
      },
    });
  }

  await writeAudit(ctx, "assignment.created", "TaskBookAssignment", version.id, {
    count: created.length,
    template: version.template.title,
    version: version.version,
    evaluatorId: input.evaluatorId || null,
    supervisorId: input.supervisorId || null,
  });
  return { created: created.length, skipped: members.length - created.length };
}

function canReviewStage(
  ctx: AuthContext,
  stage: "EVALUATOR" | "SUPERVISOR" | "FINAL",
  assignment: { evaluatorId: string | null; supervisorId: string | null },
) {
  if (ctx.role === "TRAINING_OFFICER" || ctx.role === "DEPARTMENT_ADMINISTRATOR") return true;
  if (ctx.role !== "EVALUATOR") return false;
  if (stage === "SUPERVISOR") return assignment.supervisorId === ctx.userId;
  if (stage === "EVALUATOR") return !assignment.evaluatorId || assignment.evaluatorId === ctx.userId;
  return !assignment.evaluatorId || assignment.evaluatorId === ctx.userId;
}

export async function listSignOffQueue(ctx: AuthContext) {
  assertPermission(ctx, "signoff.review");
  const completions = await prisma.requirementCompletion.findMany({
    where: {
      status: "SUBMITTED",
      assignment: { departmentId: ctx.departmentId },
    },
    include: {
      membership: { include: { user: true } },
      requirement: { include: { section: { include: { version: { include: { template: true } } } } } },
      evidence: true,
      signOffs: { include: { evaluator: true }, orderBy: { signedAt: "asc" } },
      assignment: { include: { evaluator: true, supervisor: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  return completions
    .map((item) => {
      const stage = reviewStageForRequirement({
        evaluatorSignOffRequired: item.requirement.evaluatorSignOffRequired,
        supervisorApprovalRequired: item.requirement.supervisorApprovalRequired,
        signOffs: item.signOffs,
        submittedAt: item.submittedAt,
      });
      const approvedRepetitions = Math.max(
        0,
        item.repetitionCount,
        item.status === "APPROVED" ? 1 : 0,
      );
      return { item, stage, approvedRepetitions };
    })
    .filter(({ item, stage }) => canReviewStage(ctx, stage, item.assignment))
    .map(({ item, stage, approvedRepetitions }) => ({
      id: item.id,
      memberName: item.membership.user.name,
      memberId: item.membershipId,
      taskBookTitle: item.requirement.section.version.template.title,
      sectionTitle: item.requirement.section.title,
      requirementTitle: item.requirement.title,
      requirementDescription: item.requirement.description,
      instructions: item.requirement.instructions,
      objectives: JSON.parse(item.requirement.objectivesJson || "[]"),
      evidenceType: item.requirement.evidenceType,
      submittedAt: item.submittedAt,
      memberNotes: item.memberNotes,
      evidence: item.evidence,
      reviewStage: stage,
      approvedRepetitions,
      repetitionsRequired: Math.max(1, item.requirement.repetitionsRequired),
      nextRepetition: Math.min(
        Math.max(1, item.requirement.repetitionsRequired),
        approvedRepetitions + 1,
      ),
      evaluatorName: item.assignment.evaluator?.name ?? null,
      supervisorName: item.assignment.supervisor?.name ?? null,
      history: item.signOffs.map((sign) => ({
        id: sign.id,
        result: sign.result,
        notes: sign.notes,
        signedAt: sign.signedAt,
        evaluatorName: sign.evaluator.name,
      })),
    }));
}

export async function reviewSignOff(
  ctx: AuthContext,
  completionId: string,
  input: { result: SignOffResult; notes?: string },
) {
  assertPermission(ctx, "signoff.review");
  if (input.result !== "APPROVED" && input.result !== "RETURNED") {
    throw new HttpError(400, "Result must be APPROVED or RETURNED.");
  }
  if (input.result === "RETURNED" && !input.notes?.trim()) {
    throw new HttpError(400, "Add a return note so the member knows what to correct.");
  }

  const completion = await prisma.requirementCompletion.findFirst({
    where: { id: completionId, assignment: { departmentId: ctx.departmentId } },
    include: {
      assignment: true,
      membership: { include: { user: true } },
      signOffs: { orderBy: { signedAt: "asc" } },
      requirement: { include: { section: { include: { version: { include: { template: true } } } } } },
    },
  });
  if (!completion) throw new HttpError(404, "Submission not found.");
  if (completion.status !== "SUBMITTED") {
    throw new HttpError(409, "This submission is no longer waiting for review.");
  }

  const stage = reviewStageForRequirement({
    evaluatorSignOffRequired: completion.requirement.evaluatorSignOffRequired,
    supervisorApprovalRequired: completion.requirement.supervisorApprovalRequired,
    signOffs: completion.signOffs,
    submittedAt: completion.submittedAt,
  });
  if (!canReviewStage(ctx, stage, completion.assignment)) {
    throw new HttpError(
      403,
      stage === "SUPERVISOR"
        ? "This submission is waiting for its assigned supervisor."
        : "This submission is assigned to another evaluator.",
    );
  }

  const signOff = await prisma.signOff.create({
    data: {
      completionId: completion.id,
      evaluatorId: ctx.userId,
      result: input.result,
      notes: input.notes?.trim() || "",
    },
  });

  const repetitionsRequired = Math.max(1, completion.requirement.repetitionsRequired);
  const currentRepetitions = Math.max(0, completion.repetitionCount);
  const evaluatorApprovedButSupervisorPending =
    input.result === "APPROVED" &&
    stage === "EVALUATOR" &&
    completion.requirement.supervisorApprovalRequired;

  let approvedRepetitions = currentRepetitions;
  let nextStatus = "SUBMITTED";
  let completedAt: Date | null = null;

  if (input.result === "RETURNED") {
    nextStatus = "RETURNED";
  } else if (evaluatorApprovedButSupervisorPending) {
    nextStatus = "SUBMITTED";
  } else {
    approvedRepetitions = Math.min(repetitionsRequired, currentRepetitions + 1);
    nextStatus = "APPROVED";
    if (approvedRepetitions >= repetitionsRequired) completedAt = new Date();
  }

  await prisma.requirementCompletion.update({
    where: { id: completion.id },
    data: {
      status: nextStatus,
      repetitionCount: approvedRepetitions,
      completedAt,
    },
  });

  await refreshAssignmentStatus(completion.assignmentId);
  await writeAudit(ctx, "signoff.recorded", "SignOff", signOff.id, {
    result: input.result,
    stage,
    requirement: completion.requirement.title,
    memberId: completion.membershipId,
    approvedRepetitions,
    repetitionsRequired,
  });

  const activityType =
    input.result === "RETURNED"
      ? "REQUIREMENT_RETURNED"
      : evaluatorApprovedButSupervisorPending
        ? "REQUIREMENT_EVALUATOR_APPROVED"
        : "REQUIREMENT_SIGNED";
  await writeActivity(ctx.departmentId, activityType, {
    userId: completion.membership.userId,
    referenceId: signOff.id,
    metadata: {
      actorName: ctx.name,
      memberName: completion.membership.user.name,
      requirement: completion.requirement.title,
      taskBook: completion.requirement.section.version.template.title,
      reviewStage: stage,
      approvedRepetitions,
      repetitionsRequired,
    },
  });
  return {
    ...signOff,
    reviewStage: stage,
    supervisorPending: evaluatorApprovedButSupervisorPending,
    approvedRepetitions,
    repetitionsRequired,
  };
}

export async function getAssignment(ctx: AuthContext, assignmentId: string) {
  assertPermission(ctx, "assignments.read");
  const assignment = await assignmentWithGraph(assignmentId, ctx.departmentId);
  if (!assignment) throw new HttpError(404, "Assignment not found.");
  return { ...toRow(assignment), completions: assignment.completions };
}
