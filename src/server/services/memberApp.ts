import { computeAssignmentProgress } from "@/lib/progress";
import { reviewStageForRequirement } from "@/lib/signoff";
import { prisma } from "@/server/db";
import { HttpError, writeActivity, writeAudit } from "@/server/http";
import type { AuthContext } from "@/server/permissions";
import { refreshAssignmentStatus } from "@/server/services/assignments";
import { notifyUser } from "@/server/services/inbox";
import { approvedEvaluatorWhere } from "@/server/services/evaluators";

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseEvaluationSteps(value: string): Array<{ id: string; text: string }> {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (step): step is { id: string; text: string } =>
        Boolean(step) && typeof step.id === "string" && typeof step.text === "string",
    );
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
          evaluationSteps: parseEvaluationSteps(requirement.evaluationStepsJson),
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

export async function listMyEvaluators(ctx: AuthContext) {
  await assertActiveMembership(ctx);
  const people = await prisma.departmentMembership.findMany({
    where: approvedEvaluatorWhere(ctx.departmentId),
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });
  return people.map((item) => ({ id: item.userId, name: item.user.name, role: item.role }));
}

type SharedCertificationInput = {
  id?: unknown;
  name?: unknown;
  issuer?: unknown;
  issueDate?: unknown;
  expirationDate?: unknown;
  doesNotExpire?: unknown;
  updatedAt?: unknown;
};

function optionalDate(value: unknown, field: string): Date | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new HttpError(400, `${field} must be a date.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new HttpError(400, `${field} is not a valid date.`);
  return parsed;
}

function serializeSharedCredential(record: {
  id: string;
  sourceExternalId: string | null;
  credentialName: string;
  issuer: string;
  issueDate: Date | null;
  expirationDate: Date | null;
  doesNotExpire: boolean;
  verificationStatus: string;
  sourceUpdatedAt: Date | null;
  sharedByMemberAt: Date | null;
}) {
  return {
    id: record.id,
    sourceId: record.sourceExternalId,
    name: record.credentialName,
    issuer: record.issuer,
    issueDate: record.issueDate,
    expirationDate: record.expirationDate,
    doesNotExpire: record.doesNotExpire,
    verificationStatus: record.verificationStatus,
    sourceUpdatedAt: record.sourceUpdatedAt,
    sharedAt: record.sharedByMemberAt,
  };
}

export async function listMySharedCertifications(ctx: AuthContext) {
  await assertActiveMembership(ctx);
  const records = await prisma.credential.findMany({
    where: { membershipId: ctx.membershipId, departmentId: ctx.departmentId, source: "APP_SHARED" },
    orderBy: { credentialName: "asc" },
  });
  return {
    sharedSourceIds: records.flatMap((record) => record.sourceExternalId ? [record.sourceExternalId] : []),
    certifications: records.map(serializeSharedCredential),
    serverTime: new Date(),
  };
}

export async function syncMySharedCertifications(ctx: AuthContext, raw: unknown) {
  await assertActiveMembership(ctx);
  if (!Array.isArray(raw)) throw new HttpError(400, "certifications must be a list.");
  if (raw.length > 200) throw new HttpError(400, "No more than 200 certifications can be shared.");

  const desired = raw.map((item, index) => {
    if (!item || typeof item !== "object") throw new HttpError(400, `Certification ${index + 1} is invalid.`);
    const input = item as SharedCertificationInput;
    const sourceId = typeof input.id === "string" ? input.id.trim().slice(0, 160) : "";
    const name = typeof input.name === "string" ? input.name.trim().slice(0, 160) : "";
    if (!sourceId || !name) throw new HttpError(400, `Certification ${index + 1} requires an id and name.`);
    const doesNotExpire = input.doesNotExpire === true;
    return {
      sourceId,
      name,
      issuer: typeof input.issuer === "string" ? input.issuer.trim().slice(0, 160) : "",
      issueDate: optionalDate(input.issueDate, "issueDate"),
      expirationDate: doesNotExpire ? null : optionalDate(input.expirationDate, "expirationDate"),
      doesNotExpire,
      sourceUpdatedAt: optionalDate(input.updatedAt, "updatedAt") ?? new Date(),
    };
  });
  if (new Set(desired.map((item) => item.sourceId)).size !== desired.length) {
    throw new HttpError(400, "Each shared certification must have a unique id.");
  }

  const existing = await prisma.credential.findMany({
    where: { membershipId: ctx.membershipId, departmentId: ctx.departmentId, source: "APP_SHARED" },
  });
  const existingBySourceId = new Map(existing.map((record) => [record.sourceExternalId, record]));
  const desiredIds = new Set(desired.map((item) => item.sourceId));
  const removed = existing.filter((record) => !record.sourceExternalId || !desiredIds.has(record.sourceExternalId));
  const newlyShared: string[] = [];

  await prisma.$transaction(async (tx) => {
    if (removed.length > 0) {
      await tx.credential.deleteMany({ where: { id: { in: removed.map((record) => record.id) } } });
    }
    for (const item of desired) {
      const prior = existingBySourceId.get(item.sourceId);
      const changed = !prior || prior.sourceUpdatedAt?.getTime() !== item.sourceUpdatedAt.getTime();
      if (!prior) newlyShared.push(item.name);
      await tx.credential.upsert({
        where: {
          membershipId_source_sourceExternalId: {
            membershipId: ctx.membershipId,
            source: "APP_SHARED",
            sourceExternalId: item.sourceId,
          },
        },
        create: {
          membershipId: ctx.membershipId,
          departmentId: ctx.departmentId,
          credentialName: item.name,
          issuer: item.issuer,
          issueDate: item.issueDate,
          expirationDate: item.expirationDate,
          doesNotExpire: item.doesNotExpire,
          verificationStatus: "UNVERIFIED",
          source: "APP_SHARED",
          sourceExternalId: item.sourceId,
          sourceUpdatedAt: item.sourceUpdatedAt,
          sharedByMemberAt: new Date(),
        },
        update: {
          credentialName: item.name,
          issuer: item.issuer,
          issueDate: item.issueDate,
          expirationDate: item.expirationDate,
          doesNotExpire: item.doesNotExpire,
          sourceUpdatedAt: item.sourceUpdatedAt,
          ...(changed ? { verificationStatus: "UNVERIFIED" } : {}),
        },
      });
    }
  });

  await writeAudit(ctx, "member.certifications.sharing_synced", "DepartmentMembership", ctx.membershipId, {
    sharedSourceIds: [...desiredIds],
    newlyShared: newlyShared.length,
    revoked: removed.length,
  });
  for (const name of newlyShared) {
    await writeActivity(ctx.departmentId, "CREDENTIAL_SHARED", {
      userId: ctx.userId,
      metadata: { actorName: ctx.name, memberName: ctx.name, credential: name },
    });
  }
  for (const record of removed) {
    await writeActivity(ctx.departmentId, "CREDENTIAL_SHARING_REVOKED", {
      userId: ctx.userId,
      metadata: { actorName: ctx.name, memberName: ctx.name, credential: record.credentialName },
    });
  }
  return listMySharedCertifications(ctx);
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
    evaluatorId?: string;
    checkedStepIds?: string[];
    memberAttested?: boolean;
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
  const evaluationSteps = parseEvaluationSteps(requirement.evaluationStepsJson);
  if (input.memberAttested !== true) {
    throw new HttpError(400, "Confirm that you completed this requirement before requesting evaluation.");
  }
  const checkedStepIds = new Set(Array.isArray(input.checkedStepIds) ? input.checkedStepIds : []);
  if (evaluationSteps.some((step) => !checkedStepIds.has(step.id))) {
    throw new HttpError(400, "Check off every task step before requesting evaluation.");
  }
  let requestedEvaluatorId: string | null = null;
  if (requirement.evaluatorSignOffRequired) {
    requestedEvaluatorId = input.evaluatorId?.trim() || "";
    if (!requestedEvaluatorId) throw new HttpError(400, "Choose an approved evaluator.");
    const approved = await prisma.departmentMembership.findFirst({
      where: {
        ...approvedEvaluatorWhere(ctx.departmentId),
        userId: requestedEvaluatorId,
      },
    });
    if (!approved) throw new HttpError(400, "The selected evaluator is not approved for this department.");
  }
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
      requestedEvaluatorId,
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
      requestedEvaluatorId,
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
    requestedEvaluatorId,
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
    const assignedReviewerId = requirement.evaluatorSignOffRequired ? requestedEvaluatorId : assignment.supervisorId;
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
