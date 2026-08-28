import { prisma } from "@/server/db";
import { writeActivity, writeAudit, HttpError } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";
import { computeAssignmentProgress } from "@/lib/progress";
import type { SignOffResult } from "@/lib/constants";

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
      completions: { include: { evidence: true, signOffs: { include: { evaluator: true }, orderBy: { signedAt: "asc" } } } },
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
  return assignments.map((assignment) => toRow(assignment as unknown as NonNullable<Awaited<ReturnType<typeof assignmentWithGraph>>>));
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
      where: { templateId: input.templateId, template: { departmentId: ctx.departmentId }, status: "PUBLISHED" },
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
  });
  return { created: created.length, skipped: members.length - created.length };
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
      assignment: { include: { evaluator: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  return completions
    .filter((item) => {
      if (ctx.role === "EVALUATOR" && item.assignment.evaluatorId && item.assignment.evaluatorId !== ctx.userId) {
        return false;
      }
      return true;
    })
    .map((item) => ({
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
  const completion = await prisma.requirementCompletion.findFirst({
    where: { id: completionId, assignment: { departmentId: ctx.departmentId } },
    include: {
      assignment: true,
      membership: { include: { user: true } },
      requirement: { include: { section: { include: { version: { include: { template: true } } } } } },
    },
  });
  if (!completion) throw new HttpError(404, "Submission not found.");
  if (completion.status === "APPROVED") {
    throw new HttpError(409, "This requirement is already approved. History cannot be overwritten.");
  }
  if (ctx.role === "EVALUATOR" && completion.assignment.evaluatorId && completion.assignment.evaluatorId !== ctx.userId) {
    throw new HttpError(403, "This submission is assigned to another evaluator.");
  }

  const signOff = await prisma.signOff.create({
    data: {
      completionId: completion.id,
      evaluatorId: ctx.userId,
      result: input.result,
      notes: input.notes?.trim() || "",
    },
  });

  await prisma.requirementCompletion.update({
    where: { id: completion.id },
    data: {
      status: input.result === "APPROVED" ? "APPROVED" : "RETURNED",
      completedAt: input.result === "APPROVED" ? new Date() : null,
    },
  });

  await refreshAssignmentStatus(completion.assignmentId);
  await writeAudit(ctx, "signoff.recorded", "SignOff", signOff.id, {
    result: input.result,
    requirement: completion.requirement.title,
    memberId: completion.membershipId,
  });
  await writeActivity(ctx.departmentId, input.result === "APPROVED" ? "REQUIREMENT_SIGNED" : "REQUIREMENT_RETURNED", {
    userId: completion.membership.userId,
    referenceId: signOff.id,
    metadata: {
      actorName: ctx.name,
      memberName: completion.membership.user.name,
      requirement: completion.requirement.title,
      taskBook: completion.requirement.section.version.template.title,
    },
  });
  return signOff;
}

export async function getAssignment(ctx: AuthContext, assignmentId: string) {
  assertPermission(ctx, "assignments.read");
  const assignment = await assignmentWithGraph(assignmentId, ctx.departmentId);
  if (!assignment) throw new HttpError(404, "Assignment not found.");
  return { ...toRow(assignment), completions: assignment.completions };
}
