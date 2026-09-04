import { computeAssignmentProgress } from "@/lib/progress";
import { reviewStageForRequirement } from "@/lib/signoff";
import { prisma } from "@/server/db";
import { HttpError, writeActivity, writeAudit } from "@/server/http";
import type { AuthContext } from "@/server/permissions";
import { refreshAssignmentStatus } from "@/server/services/assignments";
import { notifyUser } from "@/server/services/inbox";

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function effectiveRepetitionCount(completion: { status: string; repetitionCount: number } | null | undefined) {
  if (!completion) return 0;
  return Math.max(0, completion.repetitionCount, completion.status === "APPROVED" ? 1 : 0);
}

async function assertActiveMembership(ctx: AuthContext) {
  const membership = await prisma.departmentMembership.findFirst({
    where: {
      id: ctx.membershipId,
      userId: ctx.userId,
      departmentId: ctx.departmentId,
      status: "ACTIVE",
    },
  });
  if (!membership) throw new HttpError(403, "Your department membership is not active.");
}

async function loadOwnAssignment(ctx: AuthContext, assignmentId: string) {
  await assertActiveMembership(ctx);
  const assignment = await prisma.taskBookAssignment.findFirst({
    where: {
      id: assignmentId,
      departmentId: ctx.departmentId,
      membershipId: ctx.membershipId,
    },
    include: {
      evaluator: true,
      supervisor: true,
      version: {
        include: {
          template: true,
          sections: {
            orderBy: { sortOrder: "asc" },
            include: { requirements: { orderBy: { sortOrder: "asc" } } },
          },
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
  if (!assignment) throw new HttpError(404, "Assigned Task Book not found.");
  return assignment;
}

function serializeAssignment(assignment: Awaited<ReturnType<typeof loadOwnAssignment>>) {
  const requirements = assignment.version.sections.flatMap((section) => section.requirements);
  const progress = computeAssignmentProgress({
    requirements,
    completions: assignment.completions,
    assignedDate: assignment.assignedDate,
    dueDate: assignment.dueDate,
  });
  const completionByRequirement = new Map(
    assignment.completions.map((completion) => [completion.requirementId, completion]),
  );
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));

  function prerequisiteState(requirement: (typeof requirements)[number]) {
    const prerequisiteIds = parseStringArray(requirement.prerequisitesJson);
    const blockedTitles: string[] = [];
    for (const id of prerequisiteIds) {
      const prerequisite = requirementById.get(id);
      const completion = completionByRequirement.get(id);
      const complete = Boolean(
        prerequisite &&
          completion?.status === "APPROVED" &&
          effectiveRepetitionCount(completion) >= Math.max(1, prerequisite.repetitionsRequired),
      );
      if (!complete) blockedTitles.push(prerequisite?.title ?? "Required prerequisite");
    }
    return { prerequisiteIds, blockedTitles };
  }

  return {
    id: assignment.id,
    taskBookTitle: assignment.version.template.title,
    description: assignment.version.template.description,
    category: assignment.version.template.category,
    assignmentKind: assignment.version.template.templateKind === "TRAINING_TASK" ? "TRAINING_TASK" : "TASK_BOOK",
    templateId: assignment.version.template.id,
    versionId: assignment.version.id,
    version: assignment.version.version,
    assignedDate: assignment.assignedDate,
    dueDate: assignment.dueDate,
    status: progress.status,
    progress: progress.percent,
    complete: progress.complete,
    totalRequired: progress.totalRequired,
    pendingApproval: progress.pendingApproval,
    overdue: progress.overdue,
    evaluatorName: assignment.evaluator?.name ?? null,
    supervisorName: assignment.supervisor?.name ?? null,
    notes: assignment.notes,
    sections: assignment.version.sections.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      sortOrder: section.sortOrder,
      requirements: section.requirements.map((requirement) => {
        const completion = completionByRequirement.get(requirement.id);
        const prerequisites = prerequisiteState(requirement);
        const reviewStage =
          completion?.status === "SUBMITTED"
            ? reviewStageForRequirement({
                evaluatorSignOffRequired: requirement.evaluatorSignOffRequired,
                supervisorApprovalRequired: requirement.supervisorApprovalRequired,
                signOffs: completion.signOffs,
                submittedAt: completion.submittedAt,
              })
            : null;
        const reviewHistory = completion?.signOffs.map((signOff) => ({
          id: signOff.id,
          result: signOff.result,
          notes: signOff.notes,
          signedAt: signOff.signedAt,
          evaluatorName: signOff.evaluator.name,
          approvalLevel: signOff.approvalLevel || "EVALUATOR",
        })) ?? [];
        const latestReturn = [...reviewHistory].reverse().find((signOff) => signOff.result === "RETURNED") ?? null;
        return {
          id: requirement.id,
          title: requirement.title,
          description: requirement.description,
          instructions: requirement.instructions,
          sortOrder: requirement.sortOrder,
          isRequired: requirement.isRequired,
          dueOffsetDays: requirement.dueOffsetDays,
          referenceDocument: requirement.referenceDocument,
          referenceUrl: requirement.referenceUrl,
          evidenceType: requirement.evidenceType,
          memberNotesAllowed: requirement.memberNotesAllowed,
          evaluatorNotesEnabled: requirement.evaluatorNotesEnabled,
          supervisorApprovalRequired: requirement.supervisorApprovalRequired,
          evaluatorSignOffRequired: requirement.evaluatorSignOffRequired,
          repetitionsRequired: requirement.repetitionsRequired,
          prerequisites: prerequisites.prerequisiteIds,
          blockedByPrerequisites: prerequisites.blockedTitles.length > 0,
          prerequisiteTitles: prerequisites.blockedTitles,
          reviewStage,
          estimatedMinutes: requirement.estimatedMinutes,
          tags: parseStringArray(requirement.tagsJson),
          objectives: parseStringArray(requirement.objectivesJson),
          completion: completion
            ? {
                id: completion.id,
                status: completion.status,
                memberNotes: completion.memberNotes,
                repetitionCount: effectiveRepetitionCount(completion),
                submittedAt: completion.submittedAt,
                completedAt: completion.completedAt,
                evidence: completion.evidence,
                correction: completion.status === "RETURNED" && latestReturn
                  ? {
                      notes: latestReturn.notes,
                      returnedAt: latestReturn.signedAt,
                      returnedByName: latestReturn.evaluatorName,
                    }
                  : null,
                signOffs: reviewHistory,
              }
            : null,
        };
      }),
    })),
  };
}

export async function listMyAssignments(ctx: AuthContext) {
  await assertActiveMembership(ctx);
  const rows = await prisma.taskBookAssignment.findMany({
    where: {
      departmentId: ctx.departmentId,
      membershipId: ctx.membershipId,
    },
    select: { id: true },
    orderBy: { assignedDate: "desc" },
  });
  const assignments = [];
  for (const row of rows) {
    assignments.push(serializeAssignment(await loadOwnAssignment(ctx, row.id)));
  }
  return assignments;
}

export async function getMyAssignment(ctx: AuthContext, assignmentId: string) {
  return serializeAssignment(await loadOwnAssignment(ctx, assignmentId));
}

export async function submitRequirement(
  ctx: AuthContext,
  assignmentId: string,
  requirementId: string,
  input: {
    memberNotes?: string;
    evidenceDescription?: string;
    evidenceType?: string;
    clientRequestId?: string;
  },
) {
  const assignment = await loadOwnAssignment(ctx, assignmentId);
  const requirements = assignment.version.sections.flatMap((section) => section.requirements);
  const requirement = requirements.find((item) => item.id === requirementId);
  if (!requirement) throw new HttpError(404, "Requirement not found in this assigned Task Book.");

  const existing = assignment.completions.find((item) => item.requirementId === requirement.id) ?? null;
  const clientRequestId = input.clientRequestId?.trim().slice(0, 120) || null;
  if (clientRequestId && existing?.lastSubmissionRequestId === clientRequestId) {
    return {
      assignment: await getMyAssignment(ctx, assignment.id),
      receipt: {
        receiptId: existing.id,
        clientRequestId,
        assignmentId: assignment.id,
        requirementId: requirement.id,
        status: existing.status,
        recordedAt: existing.submittedAt,
        recordedByUserId: ctx.userId,
        recordedByName: ctx.name,
      },
    };
  }
  const repetitionsRequired = Math.max(1, requirement.repetitionsRequired);
  const currentRepetitionCount = effectiveRepetitionCount(existing);
  if (existing?.status === "APPROVED" && currentRepetitionCount >= repetitionsRequired) {
    throw new HttpError(409, "This requirement is fully approved and cannot be overwritten.");
  }
  if (existing?.status === "SUBMITTED") {
    throw new HttpError(409, "This requirement is already waiting for department review.");
  }

  const completionByRequirement = new Map(
    assignment.completions.map((completion) => [completion.requirementId, completion]),
  );
  const requirementById = new Map(requirements.map((item) => [item.id, item]));
  const prerequisites = parseStringArray(requirement.prerequisitesJson);
  if (prerequisites.length) {
    const blocked = prerequisites.some((id) => {
      const prerequisite = requirementById.get(id);
      const completion = completionByRequirement.get(id);
      if (!prerequisite || !completion || completion.status !== "APPROVED") return true;
      return effectiveRepetitionCount(completion) < Math.max(1, prerequisite.repetitionsRequired);
    });
    if (blocked) throw new HttpError(409, "Complete the prerequisite requirements before submitting this item.");
  }

  const submittedRepetition = Math.min(repetitionsRequired, currentRepetitionCount + 1);
  const needsReview = requirement.evaluatorSignOffRequired || requirement.supervisorApprovalRequired;
  const storedRepetitionCount = needsReview ? currentRepetitionCount : submittedRepetition;
  const nextStatus = needsReview ? "SUBMITTED" : "APPROVED";
  const fullyRepeated = storedRepetitionCount >= repetitionsRequired;
  const now = new Date();

  const completion = await prisma.requirementCompletion.upsert({
    where: {
      assignmentId_requirementId: {
        assignmentId: assignment.id,
        requirementId: requirement.id,
      },
    },
    create: {
      assignmentId: assignment.id,
      requirementId: requirement.id,
      membershipId: ctx.membershipId,
      status: nextStatus,
      memberNotes: requirement.memberNotesAllowed ? input.memberNotes?.trim() || "" : "",
      submittedAt: now,
      completedAt: !needsReview && fullyRepeated ? now : null,
      repetitionCount: storedRepetitionCount,
      lastSubmissionRequestId: clientRequestId,
    },
    update: {
      status: nextStatus,
      memberNotes: requirement.memberNotesAllowed
        ? input.memberNotes?.trim() ?? existing?.memberNotes ?? ""
        : existing?.memberNotes ?? "",
      submittedAt: now,
      completedAt: !needsReview && fullyRepeated ? now : null,
      repetitionCount: storedRepetitionCount,
      lastSubmissionRequestId: clientRequestId,
    },
  });

  const evidenceDescription = input.evidenceDescription?.trim();
  if (evidenceDescription) {
    await prisma.evidence.create({
      data: {
        completionId: completion.id,
        type: input.evidenceType?.trim() || requirement.evidenceType || "NOTE",
        description: evidenceDescription,
      },
    });
  }

  await refreshAssignmentStatus(assignment.id);
  await writeAudit(ctx, "member.requirement.submitted", "RequirementCompletion", completion.id, {
    assignmentId: assignment.id,
    requirementId: requirement.id,
    submittedRepetition,
    approvedRepetitions: storedRepetitionCount,
    repetitionsRequired,
    status: nextStatus,
  });
  await writeActivity(
    ctx.departmentId,
    !needsReview && fullyRepeated ? "REQUIREMENT_COMPLETED" : "REQUIREMENT_SUBMITTED",
    {
      userId: ctx.userId,
      referenceId: completion.id,
      metadata: {
        actorName: ctx.name,
        memberName: ctx.name,
        requirement: requirement.title,
        taskBook: assignment.version.template.title,
        submittedRepetition,
        approvedRepetitions: storedRepetitionCount,
        repetitionsRequired,
      },
    },
  );
  if (needsReview) {
    const assignedReviewerId = requirement.evaluatorSignOffRequired ? assignment.evaluatorId : assignment.supervisorId;
    const recipients = assignedReviewerId
      ? [{ userId: assignedReviewerId }]
      : await prisma.departmentMembership.findMany({
          where: { departmentId: ctx.departmentId, status: "ACTIVE", role: { in: ["EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] } },
          select: { userId: true },
        });
    for (const recipient of recipients) {
      await notifyUser({
        departmentId: ctx.departmentId,
        userId: recipient.userId,
        type: "EVALUATION_REQUESTED",
        title: "Evaluation requested",
        body: `${ctx.name} submitted ${requirement.title} for review.`,
        referenceType: "RequirementCompletion",
        referenceId: completion.id,
        actionPath: "/evaluate",
        dedupeKey: `evaluation-requested:${completion.id}:${now.toISOString()}`,
      });
    }
  }

  return {
    assignment: await getMyAssignment(ctx, assignment.id),
    receipt: {
      receiptId: completion.id,
      clientRequestId,
      assignmentId: assignment.id,
      requirementId: requirement.id,
      status: nextStatus,
      recordedAt: now,
      recordedByUserId: ctx.userId,
      recordedByName: ctx.name,
    },
  };
}
