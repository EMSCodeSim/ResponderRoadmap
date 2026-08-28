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

function effectiveRepetitionCount(completion: { status: string; repetitionCount: number } | null | undefined) {
  if (!completion) return 0;
  return Math.max(0, completion.repetitionCount, completion.status === "APPROVED" ? 1 : 0);
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
                repetitionCount: effectiveRepetitionCount(completion),
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
  const requirements = assignment.version.sections.flatMap((section) => section.requirements);
  const requirement = requirements.find((item) => item.id === requirementId);
  if (!requirement) throw new HttpError(404, "Requirement not found in this assigned Task Book.");

  const existing = assignment.completions.find((item) => item.requirementId === requirement.id) ?? null;
  const repetitionsRequired = Math.max(1, requirement.repetitionsRequired);
  const currentRepetitionCount = effectiveRepetitionCount(existing);
  if (existing?.status === "APPROVED" && currentRepetitionCount >= repetitionsRequired) {
    throw new HttpError(409, "This requirement is fully approved and cannot be overwritten.");
  }
  if (existing?.status === "SUBMITTED") {
    throw new HttpError(409, "This requirement is already awaiting evaluator review.");
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
  // A submission awaiting evaluation is only an attempt. It becomes a counted
  // repetition when the evaluator approves it. Auto-approved requirements can
  // count immediately because no separate review event exists.
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
      memberNotes: input.memberNotes?.trim() || "",
      submittedAt: now,
      completedAt: !needsReview && fullyRepeated ? now : null,
      repetitionCount: storedRepetitionCount,
    },
    update: {
      status: nextStatus,
      memberNotes: input.memberNotes?.trim() ?? existing?.memberNotes ?? "",
      submittedAt: now,
      completedAt: !needsReview && fullyRepeated ? now : null,
      repetitionCount: storedRepetitionCount,
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
  await writeActivity(ctx.departmentId, !needsReview && fullyRepeated ? "REQUIREMENT_COMPLETED" : "REQUIREMENT_SUBMITTED", {
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
  });

  return getMyAssignment(ctx, assignment.id);
}