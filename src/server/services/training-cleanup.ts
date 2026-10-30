import { prisma } from "@/server/db";
import { HttpError } from "@/server/http";
import type { AuthContext } from "@/server/permissions";

export type CleanupType = "TASK_BOOK" | "ASSIGNMENT" | "TRAINING_SHEET" | "TEMPLATE";

function assertTrainingChief(ctx: AuthContext) {
  if (ctx.role !== "TRAINING_OFFICER" && ctx.role !== "DEPARTMENT_ADMINISTRATOR") {
    throw new HttpError(403, "Only a Training Officer or Department Administrator can clean up training records.");
  }
}

function parseIds(value: string) {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function listTrainingCleanupItems(ctx: AuthContext) {
  assertTrainingChief(ctx);
  const [templates, expectations, operationalRoles, classes, assignments] = await Promise.all([
    prisma.taskBookTemplate.findMany({
      where: { departmentId: ctx.departmentId },
      orderBy: { updatedAt: "asc" },
      select: { id: true, title: true, templateKind: true, createdAt: true, versions: { select: { id: true, assignments: { select: { id: true } }, trainingClasses: { select: { id: true } }, sections: { select: { requirements: { select: { id: true } } } } } } },
    }),
    prisma.trainingExpectation.findMany({ where: { departmentId: ctx.departmentId }, select: { taskBookTemplateIdsJson: true } }),
    prisma.operationalRole.findMany({ where: { departmentId: ctx.departmentId }, select: { taskBookTemplateIdsJson: true } }),
    prisma.trainingClass.findMany({
      where: { departmentId: ctx.departmentId, status: { in: ["DRAFT", "ACTIVE"] }, rmsStatus: "NOT_READY" },
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, startsAt: true, createdAt: true, status: true, roster: { select: { attendance: true, finalResult: true, writtenScore: true, ccfScore: true, skillResults: { select: { id: true } } } } },
    }),
    prisma.taskBookAssignment.findMany({
      where: { departmentId: ctx.departmentId, status: "NOT_STARTED", completions: { none: {} } },
      orderBy: { assignedDate: "asc" },
      select: { id: true, assignedDate: true, createdAt: true, membership: { select: { user: { select: { name: true } } } }, version: { select: { template: { select: { title: true, templateKind: true } } } } },
    }),
  ]);

  const configuredTemplateIds = new Set([...expectations, ...operationalRoles].flatMap((row) => parseIds(row.taskBookTemplateIdsJson)));
  const requirementIds = templates.flatMap((template) => template.versions.flatMap((version) => version.sections.flatMap((section) => section.requirements.map((requirement) => requirement.id))));
  const equivalencies = requirementIds.length ? await prisma.skillEvidenceEquivalency.findMany({
    where: { departmentId: ctx.departmentId, OR: [{ sourceRequirementId: { in: requirementIds } }, { targetRequirementId: { in: requirementIds } }] },
    select: { sourceRequirementId: true, targetRequirementId: true },
  }) : [];
  const referencedRequirementIds = new Set(equivalencies.flatMap((row) => [row.sourceRequirementId, row.targetRequirementId]));
  const taskBooks = [];
  const assignmentTemplates = [];
  for (const template of templates) {
    const versions = template.versions;
    const hasAssignments = versions.some((version) => version.assignments.length > 0);
    const hasClasses = versions.some((version) => version.trainingClasses.length > 0);
    const templateRequirementIds = versions.flatMap((version) => version.sections.flatMap((section) => section.requirements.map((requirement) => requirement.id)));
    const hasEquivalencies = templateRequirementIds.some((requirementId) => referencedRequirementIds.has(requirementId));
    const isConfigured = configuredTemplateIds.has(template.id);
    if (!hasAssignments && !hasClasses && !hasEquivalencies && !isConfigured) {
      const item = { id: template.id, title: template.title, detail: template.templateKind === "TRAINING_TASK" ? "Unused Assignment template" : "Unused Task Book", createdAt: template.createdAt };
      if (template.templateKind === "TRAINING_TASK") assignmentTemplates.push(item);
      else taskBooks.push(item);
    }
  }

  const trainingSheets = classes.filter((row) => row.roster.every((entry) =>
    entry.attendance === "REGISTERED" && entry.finalResult === "PENDING" && entry.writtenScore == null && entry.ccfScore == null && entry.skillResults.length === 0,
  )).map((row) => ({
    id: row.id,
    title: row.title,
    detail: `${row.status.toLowerCase()} · ${row.roster.length} ungraded roster entries`,
    createdAt: row.createdAt,
  }));

  const trainingSheetTemplates = await prisma.trainingSheetTemplate.findMany({
    where: { departmentId: ctx.departmentId },
    orderBy: { updatedAt: "asc" },
    select: { id: true, name: true, archived: true, createdAt: true },
  });

  return {
    taskBooks,
    assignments: assignmentTemplates,
    unstartedAssignments: assignments.map((row) => ({
      id: row.id,
      title: row.version.template.title,
      detail: `${row.membership.user.name} · assigned ${row.assignedDate.toLocaleDateString()}`,
      createdAt: row.createdAt,
    })),
    trainingSheets,
    templates: trainingSheetTemplates.map((row) => ({ id: row.id, title: row.name, detail: row.archived ? "Archived Training Sheet template" : "Training Sheet template", createdAt: row.createdAt })),
  };
}

export async function deleteTrainingCleanupItem(ctx: AuthContext, type: CleanupType, id: string) {
  assertTrainingChief(ctx);
  if (!id || !["TASK_BOOK", "ASSIGNMENT", "TRAINING_SHEET", "TEMPLATE"].includes(type)) throw new HttpError(400, "Choose a valid training item to remove.");

  return prisma.$transaction(async (tx) => {
    if (type === "TASK_BOOK" || (type === "ASSIGNMENT" && await tx.taskBookTemplate.findFirst({ where: { id, departmentId: ctx.departmentId, templateKind: "TRAINING_TASK" }, select: { id: true } }))) {
      const template = await tx.taskBookTemplate.findFirst({
        where: { id, departmentId: ctx.departmentId, ...(type === "ASSIGNMENT" ? { templateKind: "TRAINING_TASK" } : { templateKind: { not: "TRAINING_TASK" } }) },
        select: { id: true, title: true, versions: { select: { id: true, assignments: { select: { id: true } }, trainingClasses: { select: { id: true } }, sections: { select: { requirements: { select: { id: true } } } } } } },
      });
      if (!template) throw new HttpError(404, "Unused training template not found.");
      if (template.versions.some((version) => version.assignments.length || version.trainingClasses.length)) throw new HttpError(409, "This item has assignment or Training Sheet history and cannot be removed here.");
      const requirementIds = template.versions.flatMap((version) => version.sections.flatMap((section) => section.requirements.map((requirement) => requirement.id)));
      const [expectations, operationalRoles, equivalencyCount] = await Promise.all([
        tx.trainingExpectation.findMany({ where: { departmentId: ctx.departmentId }, select: { taskBookTemplateIdsJson: true } }),
        tx.operationalRole.findMany({ where: { departmentId: ctx.departmentId }, select: { taskBookTemplateIdsJson: true } }),
        requirementIds.length ? tx.skillEvidenceEquivalency.count({ where: { departmentId: ctx.departmentId, OR: [{ sourceRequirementId: { in: requirementIds } }, { targetRequirementId: { in: requirementIds } }] } }) : Promise.resolve(0),
      ]);
      const isConfigured = [...expectations, ...operationalRoles].some((row) => parseIds(row.taskBookTemplateIdsJson).includes(template.id));
      if (isConfigured || equivalencyCount) throw new HttpError(409, "This item is still used by department expectations or role qualifications.");
      await tx.auditLog.create({ data: { departmentId: ctx.departmentId, actorId: ctx.userId, action: "training_cleanup.taskbook_deleted", entityType: "TaskBookTemplate", entityId: template.id, detailsJson: JSON.stringify({ title: template.title }) } });
      await tx.activityEvent.deleteMany({ where: { departmentId: ctx.departmentId, referenceId: template.id } });
      await tx.taskBookTemplate.delete({ where: { id: template.id } });
      return { removed: true, type };
    }

    if (type === "ASSIGNMENT") {
      const assignment = await tx.taskBookAssignment.findFirst({ where: { id, departmentId: ctx.departmentId, status: "NOT_STARTED", completions: { none: {} } }, select: { id: true, version: { select: { template: { select: { title: true } } } } } });
      if (!assignment) throw new HttpError(409, "Only unstarted assignments with no submitted work can be removed.");
      await tx.auditLog.create({ data: { departmentId: ctx.departmentId, actorId: ctx.userId, action: "training_cleanup.assignment_deleted", entityType: "TaskBookAssignment", entityId: assignment.id, detailsJson: JSON.stringify({ title: assignment.version.template.title }) } });
      await tx.activityEvent.deleteMany({ where: { departmentId: ctx.departmentId, referenceId: assignment.id } });
      await tx.inboxNotification.deleteMany({ where: { departmentId: ctx.departmentId, referenceId: assignment.id } });
      await tx.taskBookAssignment.delete({ where: { id: assignment.id } });
      return { removed: true, type };
    }

    if (type === "TRAINING_SHEET") {
      const row = await tx.trainingClass.findFirst({
        where: { id, departmentId: ctx.departmentId, status: { in: ["DRAFT", "ACTIVE"] }, rmsStatus: "NOT_READY" },
        select: { id: true, title: true, roster: { select: { attendance: true, finalResult: true, writtenScore: true, ccfScore: true, skillResults: { select: { id: true } } } } },
      });
      if (!row) throw new HttpError(404, "Unfinished Training Sheet not found.");
      const hasTrainingResults = row.roster.some((entry) => entry.attendance !== "REGISTERED" || entry.finalResult !== "PENDING" || entry.writtenScore != null || entry.ccfScore != null || entry.skillResults.length > 0);
      if (hasTrainingResults) throw new HttpError(409, "This Training Sheet has attendance or evaluation data and cannot be removed here.");
      await tx.auditLog.create({ data: { departmentId: ctx.departmentId, actorId: ctx.userId, action: "training_cleanup.training_sheet_deleted", entityType: "TrainingClass", entityId: row.id, detailsJson: JSON.stringify({ title: row.title, rosterEntriesRemoved: row.roster.length }) } });
      await tx.activityEvent.deleteMany({ where: { departmentId: ctx.departmentId, referenceId: row.id } });
      await tx.inboxNotification.deleteMany({ where: { departmentId: ctx.departmentId, referenceId: row.id } });
      await tx.trainingClass.delete({ where: { id: row.id } });
      return { removed: true, type };
    }

    const template = await tx.trainingSheetTemplate.findFirst({ where: { id, departmentId: ctx.departmentId }, select: { id: true, name: true } });
    if (!template) throw new HttpError(404, "Training Sheet template not found.");
    await tx.auditLog.create({ data: { departmentId: ctx.departmentId, actorId: ctx.userId, action: "training_cleanup.training_sheet_template_deleted", entityType: "TrainingSheetTemplate", entityId: template.id, detailsJson: JSON.stringify({ name: template.name }) } });
    await tx.trainingSheetTemplate.delete({ where: { id: template.id } });
    return { removed: true, type };
  });
}
