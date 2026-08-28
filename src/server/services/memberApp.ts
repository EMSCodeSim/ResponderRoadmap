import { computeAssignmentProgress } from "@/lib/progress";
import { prisma } from "@/server/db";
import { HttpError, writeActivity, writeAudit } from "@/server/http";
import type { AuthContext } from "@/server/permissions";
import { refreshAssignmentStatus } from "@/server/services/assignments";

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function loadOwnAssignment(ctx: AuthContext, assignmentId: string) {
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

  return {
    id: assignment.id,
    taskBookTitle: assignment.version.template.title,
    description: assignment.version.template.description,
    category: assignment.version.template.category,
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
          prerequisites: parseStringArray(requirement.prerequisitesJson),
          estimatedMinutes: requirement.estimatedMinutes,
          tags: parseStringArray(requirement.tagsJson),
          objectives: parseStringArray(requirement.objectivesJson),
          completion: completion
            ? {
                id: completion.id,
                status: completion.status,
                memberNotes: completion.memberNotes,
                repetitionCount: completion.repetitionCount,
                submittedAt: completion.submittedAt,
                completedAt: completion.completedAt,
                evidence: completion.evidence,
                signOffs: completion.signOffs.map((signOff) => ({
                  id: signOff.id,
                  result: signOff.result,
                  notes: signOff.notes,
                  signedAt: signOff.signedAt,
                  evaluatorName: signOff.evaluator.name,
                })),
              }
            : null,
        };
      }),
    })),
  };
}

export async function listMyAssignments(ctx: AuthContext) {
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
  },
) {
  const assignment = await loadOwnAssignment(ctx, assignmentId);
  const requirement = assignment.version.sections
    .flatMap((section) => section.requirements)
    .find((item) => item.id === requirementId);
  if (!requirement) throw new HttpError(404, "Requirement not found in this assigned Task Book.");

  const existing = assignment.completions.find((item) => item.requirementId === requirement.id) ?? null;
  if (existing?.status === "APPROVED") {
    throw new HttpError(409, "This requirement is already approved and cannot be overwritten.");
  }

  const prerequisites = parseStringArray(requirement.prerequisitesJson);
  if (prerequisites.length) {
    const approvedIds = new Set(
      assignment.completions
        .filter((completion) => completion.status === "APPROVED")
        .map((completion) => completion.requirementId),
    );
    const blocked = prerequisites.some((id) => !approvedIds.has(id));
    if (blocked) throw new HttpError(409, "Complete the prerequisite requirements before submitting this item.");
  }

  const nextRepetitionCount = Math.min(
    Math.max(1, requirement.repetitionsRequired),
    Math.max(0, existing?.repetitionCount ?? 0) + 1,
  );
  const needsReview = requirement.evaluatorSignOffRequired || requirement.supervisorApprovalRequired;
  const fullyRepeated = nextRepetitionCount >= Math.max(1, requirement.repetitionsRequired);
  const nextStatus = !needsReview && fullyRepeated ? "APPROVED" : "SUBMITTED";
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
      memberNotes: input.memberNotes?.trim() || "",
      submittedAt: now,
      completedAt: nextStatus === "APPROVED" ? now : null,
      repetitionCount: nextRepetitionCount,
    },
    update: {
      status: nextStatus,
      memberNotes: input.memberNotes?.trim() ?? existing?.memberNotes ?? "",
      submittedAt: now,
      completedAt: nextStatus === "APPROVED" ? now : null,
      repetitionCount: nextRepetitionCount,
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
    repetitionCount: nextRepetitionCount,
    status: nextStatus,
  });
  await writeActivity(ctx.departmentId, nextStatus === "APPROVED" ? "REQUIREMENT_COMPLETED" : "REQUIREMENT_SUBMITTED", {
    userId: ctx.userId,
    referenceId: completion.id,
    metadata: {
      actorName: ctx.name,
      memberName: ctx.name,
      requirement: requirement.title,
      taskBook: assignment.version.template.title,
    },
  });

  return getMyAssignment(ctx, assignment.id);
}