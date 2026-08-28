import { prisma } from "@/server/db";
import { writeActivity, writeAudit, HttpError } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";
import { computeAssignmentProgress } from "@/lib/progress";
import { computeUpNext, deserializeRequirement, evaluationPasses, nextApprovalLevel } from "@/lib/taskbook";
import { parseJsonArray, type SignOffResult } from "@/lib/constants";
import type { Role } from "@/lib/constants";

const assignmentInclude = {
  membership: { include: { user: true } },
  assignedBy: true,
  evaluator: true,
  supervisor: true,
  version: {
    include: {
      template: true,
      sections: { orderBy: { sortOrder: "asc" as const }, include: { requirements: { orderBy: { sortOrder: "asc" as const } } } },
    },
  },
  completions: {
    include: {
      evidence: true,
      signOffs: { include: { evaluator: true }, orderBy: { signedAt: "asc" as const } },
      attempts: { include: { evaluator: true }, orderBy: { signedAt: "asc" as const } },
    },
  },
};

async function assignmentWithGraph(id: string, departmentId: string) {
  return prisma.taskBookAssignment.findFirst({
    where: { id, departmentId },
    include: assignmentInclude,
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
  const lastTouch = assignment.completions.reduce((latest, item) => {
    const stamp = item.submittedAt || item.completedAt;
    if (!stamp) return latest;
    return !latest || stamp > latest ? stamp : latest;
  }, null as Date | null);
  const stalledFrom = lastTouch || assignment.assignedDate;
  const stalledDays = Math.floor((Date.now() - stalledFrom.getTime()) / 86_400_000);
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
    evaluatorId: assignment.evaluatorId,
    supervisorName: assignment.supervisor?.name ?? null,
    supervisorId: assignment.supervisorId,
    status: progress.status,
    notes: assignment.notes,
    stalledDays: progress.status === "COMPLETE" ? 0 : stalledDays,
  };
}

function assertCanReadAssignment(ctx: AuthContext, membershipId: string) {
  if (ctx.role === "MEMBER" && ctx.membershipId !== membershipId) {
    throw new HttpError(403, "You can only view your own Task Books.");
  }
}

export async function listAssignments(ctx: AuthContext) {
  assertPermission(ctx, "assignments.read");
  const assignments = await prisma.taskBookAssignment.findMany({
    where: {
      departmentId: ctx.departmentId,
      ...(ctx.role === "MEMBER" ? { membershipId: ctx.membershipId } : {}),
    },
    include: assignmentInclude,
    orderBy: { assignedDate: "desc" },
  });
  return assignments.map((assignment) => toRow(assignment));
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
    assignedDate?: string | null;
  },
) {
  if (ctx.role === "MEMBER") {
    throw new HttpError(403, "Members cannot assign Task Books.");
  }
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
  const assignedDate = input.assignedDate ? new Date(input.assignedDate) : new Date();
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
        assignedDate,
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
        version: version.version,
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

function roleCanSignLevel(role: Role, level: string) {
  if (role === "DEPARTMENT_ADMINISTRATOR") return true;
  if (role === "TRAINING_OFFICER") {
    return ["EVALUATOR", "COMPANY_OFFICER", "SUPERVISOR", "TRAINING_OFFICER", "TRAINING_CHIEF", "FTO"].includes(level);
  }
  if (role === "EVALUATOR") {
    return ["EVALUATOR", "PRECEPTOR", "FTO"].includes(level);
  }
  return false;
}

export async function listSignOffQueue(ctx: AuthContext, filter: { view?: string } = {}) {
  assertPermission(ctx, "signoff.review");
  const completions = await prisma.requirementCompletion.findMany({
    where: {
      assignment: { departmentId: ctx.departmentId },
      ...(filter.view === "recent"
        ? { signOffs: { some: { evaluatorId: ctx.userId } } }
        : filter.view === "remediation"
          ? { status: "RETURNED" }
          : { status: "SUBMITTED" }),
    },
    include: {
      membership: { include: { user: true } },
      requirement: { include: { section: { include: { version: { include: { template: true } } } } } },
      evidence: true,
      signOffs: { include: { evaluator: true }, orderBy: { signedAt: "asc" } },
      attempts: { include: { evaluator: true }, orderBy: { signedAt: "asc" } },
      assignment: { include: { evaluator: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  return completions
    .filter((item) => {
      if (ctx.role === "EVALUATOR" && item.assignment.evaluatorId && item.assignment.evaluatorId !== ctx.userId) {
        return false;
      }
      if (item.requestedEvaluatorId && ctx.role === "EVALUATOR" && item.requestedEvaluatorId !== ctx.userId) {
        return false;
      }
      return true;
    })
    .map((item) => {
      const parsed = deserializeRequirement(item.requirement as unknown as Record<string, unknown>);
      return {
        id: item.id,
        assignmentId: item.assignmentId,
        memberName: item.membership.user.name,
        memberId: item.membershipId,
        taskBookTitle: item.requirement.section.version.template.title,
        templateId: item.requirement.section.version.template.id,
        version: item.requirement.section.version.version,
        sectionTitle: item.requirement.section.title,
        requirementId: item.requirement.id,
        requirementTitle: item.requirement.title,
        requirementDescription: item.requirement.description,
        instructions: item.requirement.instructions,
        objectives: parseJsonArray(item.requirement.objectivesJson),
        evidenceType: item.requirement.evidenceType,
        submittedAt: item.submittedAt,
        memberNotes: item.memberNotes,
        evidence: item.evidence,
        repetitionsRequired: item.requirement.repetitionsRequired,
        repetitionCount: item.repetitionCount,
        evaluationSteps: parsed.evaluationSteps,
        criticalFailures: parsed.criticalFailures,
        scoringMethod: parsed.scoringMethod,
        completionType: parsed.completionType,
        standards: parsed.standards,
        approvalPath: parsed.approvalPath,
        evaluatorNotesEnabled: item.requirement.evaluatorNotesEnabled,
        dueDate: null as string | null,
        history: item.signOffs.map((sign) => ({
          id: sign.id,
          result: sign.result,
          notes: sign.notes,
          signedAt: sign.signedAt,
          evaluatorName: sign.evaluator.name,
          approvalLevel: sign.approvalLevel || "EVALUATOR",
        })),
        attempts: item.attempts.map((attempt) => ({
          id: attempt.id,
          result: attempt.result,
          comments: attempt.comments,
          signedAt: attempt.signedAt,
          repetitionIndex: attempt.repetitionIndex,
          evaluatorName: attempt.evaluator.name,
          stepResults: JSON.parse(attempt.stepResultsJson || "[]"),
          criticalFailures: JSON.parse(attempt.criticalFailuresJson || "[]"),
        })),
      };
    });
}

export async function reviewSignOff(
  ctx: AuthContext,
  completionId: string,
  input: {
    result: SignOffResult | string;
    notes?: string;
    stepResults?: Array<{ id: string; rating: string }>;
    criticalFailuresTriggered?: string[];
    numericScore?: number | null;
    approvalLevel?: string;
  },
) {
  assertPermission(ctx, "signoff.review");
  const completion = await prisma.requirementCompletion.findFirst({
    where: { id: completionId, assignment: { departmentId: ctx.departmentId } },
    include: {
      assignment: true,
      membership: { include: { user: true } },
      requirement: { include: { section: { include: { version: { include: { template: true } } } } } },
      signOffs: { orderBy: { signedAt: "asc" } },
      attempts: true,
    },
  });
  if (!completion) throw new HttpError(404, "Submission not found.");
  if (completion.status === "APPROVED") {
    throw new HttpError(409, "This requirement is already approved. History cannot be overwritten.");
  }
  if (ctx.role === "EVALUATOR" && completion.assignment.evaluatorId && completion.assignment.evaluatorId !== ctx.userId) {
    throw new HttpError(403, "This submission is assigned to another evaluator.");
  }

  const parsed = deserializeRequirement(completion.requirement as unknown as Record<string, unknown>);
  const path = parsed.approvalPath;
  const verdict = evaluationPasses({
    result: input.result,
    criticalFailuresTriggered: input.criticalFailuresTriggered,
  });
  const level = input.approvalLevel || nextApprovalLevel(path, completion.signOffs) || "EVALUATOR";
  if (!roleCanSignLevel(ctx.role, level)) {
    throw new HttpError(403, `Your role cannot sign the ${level.replaceAll("_", " ").toLowerCase()} level.`);
  }

  const nextRepIndex = completion.attempts.length + 1;
  const attempt = await prisma.evaluationAttempt.create({
    data: {
      departmentId: ctx.departmentId,
      completionId: completion.id,
      repetitionIndex: nextRepIndex,
      evaluatorId: ctx.userId,
      result: verdict.result,
      stepResultsJson: JSON.stringify(input.stepResults ?? []),
      criticalFailuresJson: JSON.stringify(input.criticalFailuresTriggered ?? []),
      comments: input.notes?.trim() || "",
      numericScore: input.numericScore ?? null,
    },
  });

  const signOff = await prisma.signOff.create({
    data: {
      completionId: completion.id,
      evaluatorId: ctx.userId,
      result: verdict.result,
      notes: input.notes?.trim() || "",
      approvalLevel: level,
      repetitionIndex: nextRepIndex,
      attemptId: attempt.id,
    },
  });

  let nextStatus = completion.status;
  let repetitionCount = completion.repetitionCount;
  let completedAt = completion.completedAt;
  if (!verdict.passed) {
    nextStatus = verdict.result === "NOT_EVALUATED" ? "SUBMITTED" : "RETURNED";
  } else {
    const remaining = nextApprovalLevel(path, [...completion.signOffs, { result: "APPROVED", approvalLevel: level }]);
    if (remaining) {
      nextStatus = "SUBMITTED";
    } else {
      repetitionCount = completion.repetitionCount + 1;
      const needed = Math.max(1, completion.requirement.repetitionsRequired);
      if (repetitionCount >= needed) {
        nextStatus = "APPROVED";
        completedAt = new Date();
      } else {
        nextStatus = "IN_PROGRESS";
      }
    }
  }

  await prisma.requirementCompletion.update({
    where: { id: completion.id },
    data: { status: nextStatus, completedAt, repetitionCount },
  });

  await refreshAssignmentStatus(completion.assignmentId);
  await writeAudit(ctx, "signoff.recorded", "SignOff", signOff.id, {
    result: verdict.result,
    requirement: completion.requirement.title,
    memberId: completion.membershipId,
    level,
    attemptId: attempt.id,
  });
  await writeActivity(ctx.departmentId, nextStatus === "RETURNED" ? "REQUIREMENT_RETURNED" : "REQUIREMENT_SIGNED", {
    userId: completion.membership.userId,
    referenceId: signOff.id,
    metadata: {
      actorName: ctx.name,
      memberName: completion.membership.user.name,
      requirement: completion.requirement.title,
      taskBook: completion.requirement.section.version.template.title,
      result: verdict.result,
    },
  });
  return { signOff, attempt, status: nextStatus, repetitionCount };
}

export async function submitRequirement(
  ctx: AuthContext,
  assignmentId: string,
  requirementId: string,
  input: {
    notes?: string;
    evidence?: Array<{ type: string; description?: string; fileUrl?: string | null }>;
    hours?: number;
    evaluatorId?: string | null;
  } = {},
) {
  assertPermission(ctx, "assignments.write");
  const assignment = await assignmentWithGraph(assignmentId, ctx.departmentId);
  if (!assignment) throw new HttpError(404, "Assignment not found.");
  assertCanReadAssignment(ctx, assignment.membershipId);
  if (ctx.role === "MEMBER" && ctx.membershipId !== assignment.membershipId) {
    throw new HttpError(403, "You can only submit your own Task Book work.");
  }

  const requirement = assignment.version.sections.flatMap((section) => section.requirements).find((item) => item.id === requirementId);
  if (!requirement) throw new HttpError(404, "Requirement not found on this Task Book version.");
  const parsed = deserializeRequirement(requirement as unknown as Record<string, unknown>);
  const unmet = parsed.prerequisites.filter((id) => {
    const other = assignment.completions.find((item) => item.requirementId === id);
    return other?.status !== "APPROVED";
  });
  if (unmet.length) {
    throw new HttpError(400, "Complete the required prior tasks before submitting this one.");
  }

  if (parsed.maxAttempts) {
    const existing = assignment.completions.find((item) => item.requirementId === requirementId);
    const attempts = existing?.attempts.length ?? 0;
    const maxAttempts = Number(parsed.maxAttempts);
    if (Number.isFinite(maxAttempts) && attempts >= maxAttempts && existing?.status === "RETURNED") {
      throw new HttpError(400, "Maximum evaluation attempts have been reached.");
    }
  }

  const completion = await prisma.requirementCompletion.upsert({
    where: { assignmentId_requirementId: { assignmentId, requirementId } },
    create: {
      assignmentId,
      requirementId,
      membershipId: assignment.membershipId,
      status: requirement.evaluatorSignOffRequired ? "SUBMITTED" : "APPROVED",
      memberNotes: input.notes?.trim() || "",
      submittedAt: new Date(),
      completedAt: requirement.evaluatorSignOffRequired ? null : new Date(),
      repetitionCount: requirement.evaluatorSignOffRequired ? 0 : Math.max(1, requirement.repetitionsRequired),
      hoursLogged: input.hours ?? 0,
      requestedEvaluatorId: input.evaluatorId || assignment.evaluatorId,
    },
    update: {
      status: requirement.evaluatorSignOffRequired ? "SUBMITTED" : "APPROVED",
      memberNotes: input.notes?.trim() || "",
      submittedAt: new Date(),
      completedAt: requirement.evaluatorSignOffRequired ? null : new Date(),
      hoursLogged: input.hours ?? undefined,
      requestedEvaluatorId: input.evaluatorId || assignment.evaluatorId,
    },
  });

  if (input.evidence?.length) {
    await prisma.evidence.createMany({
      data: input.evidence
        .filter((item) => item.description || item.fileUrl)
        .map((item) => ({
          completionId: completion.id,
          type: item.type || "WRITTEN_NOTE",
          description: item.description?.trim() || "",
          fileUrl: item.fileUrl || null,
        })),
    });
  }

  await prisma.signOff.create({
    data: {
      completionId: completion.id,
      evaluatorId: ctx.userId,
      result: requirement.evaluatorSignOffRequired ? "SUBMITTED" : "APPROVED",
      notes: input.notes?.trim() || (requirement.evaluatorSignOffRequired ? "Requested evaluation" : "Completed without evaluator sign-off."),
      approvalLevel: "EVALUATOR",
    },
  });

  await refreshAssignmentStatus(assignmentId);
  await writeActivity(ctx.departmentId, requirement.evaluatorSignOffRequired ? "REQUIREMENT_SUBMITTED" : "REQUIREMENT_COMPLETED", {
    userId: assignment.membership.userId,
    referenceId: completion.id,
    metadata: {
      actorName: ctx.name,
      memberName: assignment.membership.user.name,
      requirement: requirement.title,
      taskBook: assignment.version.template.title,
    },
  });
  return getAssignmentDetail(ctx, assignmentId);
}

export async function getAssignment(ctx: AuthContext, assignmentId: string) {
  assertPermission(ctx, "assignments.read");
  const assignment = await assignmentWithGraph(assignmentId, ctx.departmentId);
  if (!assignment) throw new HttpError(404, "Assignment not found.");
  assertCanReadAssignment(ctx, assignment.membershipId);
  return { ...toRow(assignment), completions: assignment.completions };
}

export async function getAssignmentDetail(ctx: AuthContext, assignmentId: string) {
  assertPermission(ctx, "assignments.read");
  const assignment = await assignmentWithGraph(assignmentId, ctx.departmentId);
  if (!assignment) throw new HttpError(404, "Assignment not found.");
  assertCanReadAssignment(ctx, assignment.membershipId);

  const requirements = assignment.version.sections.flatMap((section) => section.requirements);
  const progress = computeAssignmentProgress({
    requirements,
    completions: assignment.completions,
    assignedDate: assignment.assignedDate,
    dueDate: assignment.dueDate,
  });
  const sections = assignment.version.sections.map((section) => {
    const reqs = section.requirements.map((requirement) => {
      const parsed = deserializeRequirement(requirement as unknown as Record<string, unknown>);
      const completion = assignment.completions.find((item) => item.requirementId === requirement.id);
      const unmet = parsed.prerequisites.filter((id) => {
        const other = assignment.completions.find((item) => item.requirementId === id);
        return other?.status !== "APPROVED";
      });
      const titleById = new Map(requirements.map((item) => [item.id, item.title]));
      return {
        ...requirement,
        ...parsed,
        id: requirement.id,
        title: requirement.title,
        isRequired: requirement.isRequired,
        locked: unmet.length > 0,
        lockReason:
          unmet.length > 0 ? `Must complete: ${unmet.map((id) => titleById.get(id) || "a prior task").join(", ")}` : null,
        completion: completion
          ? {
              id: completion.id,
              status: completion.status,
              memberNotes: completion.memberNotes,
              submittedAt: completion.submittedAt,
              completedAt: completion.completedAt,
              repetitionCount: completion.repetitionCount,
              hoursLogged: completion.hoursLogged,
              evidence: completion.evidence,
              signOffs: completion.signOffs.map((sign) => ({
                id: sign.id,
                result: sign.result,
                notes: sign.notes,
                signedAt: sign.signedAt,
                evaluatorName: sign.evaluator.name,
                approvalLevel: sign.approvalLevel,
                repetitionIndex: sign.repetitionIndex,
              })),
              attempts: completion.attempts.map((attempt) => ({
                id: attempt.id,
                result: attempt.result,
                comments: attempt.comments,
                signedAt: attempt.signedAt,
                evaluatorName: attempt.evaluator.name,
                repetitionIndex: attempt.repetitionIndex,
                stepResults: JSON.parse(attempt.stepResultsJson || "[]"),
                criticalFailures: JSON.parse(attempt.criticalFailuresJson || "[]"),
              })),
            }
          : null,
      };
    });
    const complete = reqs.filter((req) => req.isRequired && req.completion?.status === "APPROVED").length;
    const total = reqs.filter((req) => req.isRequired).length;
    return { id: section.id, title: section.title, description: section.description, complete, total, requirements: reqs };
  });

  const upNext = computeUpNext({
    sections: sections.map((section) => ({
      title: section.title,
      requirements: section.requirements.map((req) => ({
        id: req.id as string,
        title: String(req.title),
        isRequired: Boolean(req.isRequired),
        prerequisites: req.prerequisites,
      })),
    })),
    completions: assignment.completions,
  });

  const evaluators = await prisma.departmentMembership.findMany({
    where: {
      departmentId: ctx.departmentId,
      status: "ACTIVE",
      role: { in: ["EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
    },
    include: { user: true },
  });

  return {
    ...toRow(assignment),
    description: assignment.version.template.description,
    intendedPosition: assignment.version.template.intendedPosition,
    progressDetail: progress,
    sections,
    upNext,
    evaluators: evaluators.map((item) => ({ id: item.userId, name: item.user.name, role: item.role })),
    isComplete: progress.status === "COMPLETE",
  };
}

export async function getPrintRecord(ctx: AuthContext, assignmentId: string) {
  const detail = await getAssignmentDetail(ctx, assignmentId);
  const department = await prisma.department.findUnique({ where: { id: ctx.departmentId } });
  return {
    department: {
      name: department?.name,
      city: department?.city,
      state: department?.state,
    },
    ...detail,
  };
}

export async function listEvaluators(ctx: AuthContext) {
  assertPermission(ctx, "assignments.read");
  const people = await prisma.departmentMembership.findMany({
    where: {
      departmentId: ctx.departmentId,
      status: "ACTIVE",
      role: { in: ["EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] },
    },
    include: { user: true },
  });
  return people.map((item) => ({ id: item.userId, membershipId: item.id, name: item.user.name, role: item.role }));
}
