import { prisma } from "@/server/db";
import { writeActivity, writeAudit, HttpError } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";
import { bumpVersion, parseJsonArray, type EvidenceType } from "@/lib/constants";
import { STARTER_TEMPLATES, type StarterTemplate } from "@/server/starters";

export type RequirementInput = {
  id?: string;
  title: string;
  description?: string;
  instructions?: string;
  sortOrder: number;
  isRequired?: boolean;
  dueOffsetDays?: number | null;
  referenceDocument?: string | null;
  referenceUrl?: string | null;
  evidenceType?: EvidenceType | string;
  memberNotesAllowed?: boolean;
  evaluatorNotesEnabled?: boolean;
  supervisorApprovalRequired?: boolean;
  evaluatorSignOffRequired?: boolean;
  repetitionsRequired?: number;
  prerequisites?: string[];
  estimatedMinutes?: number | null;
  tags?: string[];
  internalNotes?: string;
  objectives?: string[];
};

export type SectionInput = {
  id?: string;
  title: string;
  description?: string;
  sortOrder: number;
  requirements: RequirementInput[];
};

async function getTemplateForDept(ctx: AuthContext, templateId: string) {
  const template = await prisma.taskBookTemplate.findFirst({
    where: { id: templateId, departmentId: ctx.departmentId },
    include: {
      owner: true,
      versions: {
        include: {
          sections: { orderBy: { sortOrder: "asc" }, include: { requirements: { orderBy: { sortOrder: "asc" } } } },
          _count: { select: { assignments: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!template) throw new HttpError(404, "Task Book not found.");
  return template;
}

export async function listTaskBooks(ctx: AuthContext) {
  assertPermission(ctx, "taskbooks.read");
  const books = await prisma.taskBookTemplate.findMany({
    where: { departmentId: ctx.departmentId },
    include: {
      owner: true,
      versions: {
        include: { _count: { select: { assignments: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  return books.map((book) => {
    const published = book.versions.find((version) => version.status === "PUBLISHED");
    const latest = published ?? book.versions[0];
    const assigned = book.versions.reduce((sum, version) => sum + version._count.assignments, 0);
    return {
      id: book.id,
      title: book.title,
      description: book.description,
      category: book.category,
      status: book.status,
      version: latest?.version ?? "—",
      assignedMembers: assigned,
      lastUpdated: book.updatedAt,
      ownerName: book.owner.name,
      estimatedDurationDays: book.estimatedDurationDays,
    };
  });
}

export async function getTaskBook(ctx: AuthContext, templateId: string) {
  assertPermission(ctx, "taskbooks.read");
  const template = await getTemplateForDept(ctx, templateId);
  const draft = template.versions.find((version) => version.status === "DRAFT");
  const published = template.versions.find((version) => version.status === "PUBLISHED");
  const working = draft ?? published ?? template.versions[0];
  return {
    ...template,
    workingVersion: working
      ? {
          ...working,
          sections: working.sections.map((section) => ({
            ...section,
            requirements: section.requirements.map((requirement) => ({
              ...requirement,
              objectives: parseJsonArray(requirement.objectivesJson),
              tags: parseJsonArray(requirement.tagsJson),
              prerequisites: parseJsonArray(requirement.prerequisitesJson),
            })),
          })),
        }
      : null,
  };
}

export async function createTaskBook(
  ctx: AuthContext,
  input: {
    title: string;
    description?: string;
    category?: string;
    estimatedDurationDays?: number | null;
    dueDateRule?: string | null;
    starterId?: string;
  },
) {
  assertPermission(ctx, "taskbooks.write");
  const title = input.title.trim();
  if (!title) throw new HttpError(400, "Title is required.");
  const starter = input.starterId ? STARTER_TEMPLATES.find((item) => item.id === input.starterId) : null;
  const template = await prisma.taskBookTemplate.create({
    data: {
      departmentId: ctx.departmentId,
      title,
      description: input.description?.trim() || starter?.description || "",
      category: input.category || starter?.category || "Custom",
      status: "DRAFT",
      ownerId: ctx.userId,
      estimatedDurationDays: input.estimatedDurationDays ?? starter?.estimatedDurationDays ?? null,
      dueDateRule: input.dueDateRule ?? null,
      versions: {
        create: { version: "1.0", status: "DRAFT" },
      },
    },
    include: { versions: true },
  });
  const versionId = template.versions[0].id;
  const structure = starter ?? { sections: [] as StarterTemplate["sections"] };
  if (structure.sections.length) {
    await saveDraftStructure(ctx, template.id, structure.sections, versionId);
  }
  await writeAudit(ctx, "taskbook.created", "TaskBookTemplate", template.id, { title });
  await writeActivity(ctx.departmentId, "TASKBOOK_CREATED", {
    userId: ctx.userId,
    referenceId: template.id,
    metadata: { title, actorName: ctx.name },
  });
  return getTaskBook(ctx, template.id);
}

export async function updateTaskBookMeta(
  ctx: AuthContext,
  templateId: string,
  input: {
    title?: string;
    description?: string;
    category?: string;
    status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
    estimatedDurationDays?: number | null;
    dueDateRule?: string | null;
  },
) {
  assertPermission(ctx, "taskbooks.write");
  const template = await getTemplateForDept(ctx, templateId);
  const updated = await prisma.taskBookTemplate.update({
    where: { id: template.id },
    data: {
      title: input.title?.trim() ?? template.title,
      description: input.description ?? template.description,
      category: input.category ?? template.category,
      status: input.status ?? template.status,
      estimatedDurationDays: input.estimatedDurationDays === undefined ? template.estimatedDurationDays : input.estimatedDurationDays,
      dueDateRule: input.dueDateRule === undefined ? template.dueDateRule : input.dueDateRule,
    },
  });
  return updated;
}

export async function saveDraftStructure(
  ctx: AuthContext,
  templateId: string,
  sections: SectionInput[],
  versionId?: string,
) {
  assertPermission(ctx, "taskbooks.write");
  const template = await getTemplateForDept(ctx, templateId);
  let draft: { id: string; status: string } | undefined = template.versions.find((version) => version.status === "DRAFT");
  if (!draft && versionId) {
    draft = template.versions.find((version) => version.id === versionId);
  }
  if (!draft) {
    const published = template.versions.find((version) => version.status === "PUBLISHED");
    if (!published) throw new HttpError(400, "No draft version is available to edit.");
    draft = await createDraftFromPublished(ctx, templateId);
  }
  if (draft.status === "PUBLISHED") {
    throw new HttpError(409, "Published versions cannot be edited. Start a new version first.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.taskBookSection.deleteMany({ where: { versionId: draft.id } });
    for (const section of sections) {
      await tx.taskBookSection.create({
        data: {
          versionId: draft.id,
          title: section.title.trim() || "Untitled section",
          description: section.description?.trim() || "",
          sortOrder: section.sortOrder,
          requirements: {
            create: section.requirements.map((requirement, index) => ({
              title: requirement.title.trim() || "Untitled requirement",
              description: requirement.description?.trim() || "",
              instructions: requirement.instructions?.trim() || "",
              sortOrder: requirement.sortOrder ?? index,
              isRequired: requirement.isRequired ?? true,
              dueOffsetDays: requirement.dueOffsetDays ?? null,
              referenceDocument: requirement.referenceDocument ?? null,
              referenceUrl: requirement.referenceUrl ?? null,
              evidenceType: requirement.evidenceType ?? "NONE",
              memberNotesAllowed: requirement.memberNotesAllowed ?? true,
              evaluatorNotesEnabled: requirement.evaluatorNotesEnabled ?? true,
              supervisorApprovalRequired: requirement.supervisorApprovalRequired ?? false,
              evaluatorSignOffRequired: requirement.evaluatorSignOffRequired ?? true,
              repetitionsRequired: requirement.repetitionsRequired ?? 1,
              prerequisitesJson: JSON.stringify(requirement.prerequisites ?? []),
              estimatedMinutes: requirement.estimatedMinutes ?? null,
              tagsJson: JSON.stringify(requirement.tags ?? []),
              internalNotes: requirement.internalNotes ?? "",
              objectivesJson: JSON.stringify(requirement.objectives ?? []),
            })),
          },
        },
      });
    }
    await tx.taskBookTemplate.update({ where: { id: template.id }, data: { updatedAt: new Date() } });
  });

  return getTaskBook(ctx, templateId);
}

async function createDraftFromPublished(ctx: AuthContext, templateId: string) {
  const template = await getTemplateForDept(ctx, templateId);
  const published = template.versions.find((version) => version.status === "PUBLISHED");
  if (!published) throw new HttpError(400, "No published version to copy.");
  const existingDraft = template.versions.find((version) => version.status === "DRAFT");
  if (existingDraft) return existingDraft;
  const nextVersion = bumpVersion(published.version);
  const created = await prisma.taskBookVersion.create({
    data: {
      templateId: template.id,
      version: nextVersion,
      status: "DRAFT",
      sections: {
        create: published.sections.map((section) => ({
          title: section.title,
          description: section.description,
          sortOrder: section.sortOrder,
          requirements: {
            create: section.requirements.map((requirement) => ({
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
              prerequisitesJson: requirement.prerequisitesJson,
              estimatedMinutes: requirement.estimatedMinutes,
              tagsJson: requirement.tagsJson,
              internalNotes: requirement.internalNotes,
              objectivesJson: requirement.objectivesJson,
            })),
          },
        })),
      },
    },
    include: { sections: { include: { requirements: true } } },
  });
  return created;
}

export async function startNewVersion(ctx: AuthContext, templateId: string) {
  assertPermission(ctx, "taskbooks.write");
  await createDraftFromPublished(ctx, templateId);
  return getTaskBook(ctx, templateId);
}

export async function publishTaskBook(ctx: AuthContext, templateId: string) {
  assertPermission(ctx, "taskbooks.publish");
  const template = await getTemplateForDept(ctx, templateId);
  const draft = template.versions.find((version) => version.status === "DRAFT");
  if (!draft) throw new HttpError(400, "There is no draft to publish.");
  const requirementCount = draft.sections.reduce((sum, section) => sum + section.requirements.length, 0);
  if (draft.sections.length === 0 || requirementCount === 0) {
    throw new HttpError(400, "Add at least one section and one requirement before publishing.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.taskBookVersion.updateMany({
      where: { templateId: template.id, status: "PUBLISHED" },
      data: { status: "SUPERSEDED" },
    });
    await tx.taskBookVersion.update({
      where: { id: draft.id },
      data: { status: "PUBLISHED", publishedAt: new Date(), publishedById: ctx.userId },
    });
    await tx.taskBookTemplate.update({
      where: { id: template.id },
      data: { status: "ACTIVE" },
    });
  });

  await writeAudit(ctx, "taskbook.published", "TaskBookVersion", draft.id, {
    templateId: template.id,
    version: draft.version,
    title: template.title,
  });
  await writeActivity(ctx.departmentId, "TASKBOOK_PUBLISHED", {
    userId: ctx.userId,
    referenceId: template.id,
    metadata: { title: template.title, version: draft.version, actorName: ctx.name },
  });
  return getTaskBook(ctx, template.id);
}

export function listStarters() {
  return STARTER_TEMPLATES.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category,
    estimatedDurationDays: item.estimatedDurationDays,
    sectionCount: item.sections.length,
    requirementCount: item.sections.reduce((sum, section) => sum + section.requirements.length, 0),
  }));
}
