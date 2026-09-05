import { prisma } from "@/server/db";
import { writeActivity, writeAudit, HttpError } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";
import { bumpVersion } from "@/lib/constants";
import { STARTER_TEMPLATES, type StarterTemplate } from "@/server/starters";
import {
  copyRequirementData,
  deserializeRequirement,
  reviewTaskBook,
  serializeRequirement,
  type RequirementFields,
} from "@/lib/taskbook";

export type RequirementInput = RequirementFields & { id?: string; clientId?: string };

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

function mapRequirement(requirement: Record<string, unknown>) {
  return deserializeRequirement(requirement);
}

export async function listTaskBooks(ctx: AuthContext, query: { q?: string; category?: string; status?: string } = {}) {
  assertPermission(ctx, "taskbooks.read");
  const books = await prisma.taskBookTemplate.findMany({
    where: {
      departmentId: ctx.departmentId,
      templateKind: { not: "TRAINING_TASK" },
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
    },
    include: {
      owner: true,
      versions: {
        include: { _count: { select: { assignments: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  return books
    .map((book) => {
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
        intendedPosition: book.intendedPosition,
        templateKind: book.templateKind,
      };
    })
    .filter((book) => {
      if (!query.q) return true;
      const q = query.q.toLowerCase();
      return (
        book.title.toLowerCase().includes(q) ||
        book.category.toLowerCase().includes(q) ||
        book.ownerName.toLowerCase().includes(q) ||
        (book.intendedPosition || "").toLowerCase().includes(q)
      );
    });
}

export async function getTaskBook(ctx: AuthContext, templateId: string) {
  assertPermission(ctx, "taskbooks.read");
  const template = await getTemplateForDept(ctx, templateId);
  const draft = template.versions.find((version) => version.status === "DRAFT");
  const published = template.versions.find((version) => version.status === "PUBLISHED");
  const working = draft ?? published ?? template.versions[0];
  const mappedSections = working
    ? working.sections.map((section) => ({
        ...section,
        requirements: section.requirements.map((requirement) => mapRequirement(requirement as unknown as Record<string, unknown>)),
      }))
    : [];
  const review = reviewTaskBook({
    title: template.title,
    sections: mappedSections.map((section) => ({
      title: section.title,
      requirements: section.requirements.map((req) => ({
        title: String(req.title || ""),
        instructions: String(req.instructions || ""),
        description: String(req.description || ""),
        evaluationSteps: (req as { evaluationSteps?: { id: string; text: string }[] }).evaluationSteps,
        standards: (req as { standards?: { organization: string; standardName: string; edition: string; section: string; url: string; verified: boolean; id: string }[] }).standards,
      })),
    })),
  });
  return {
    ...template,
    workingVersion: working
      ? {
          ...working,
          sections: mappedSections,
        }
      : null,
    review,
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
    intendedPosition?: string;
    templateKind?: "DEPARTMENT" | "TRAINING_TASK";
    starterId?: string;
    sections?: SectionInput[];
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
      category: input.category || starter?.category || "Department Custom",
      status: "DRAFT",
      ownerId: ctx.userId,
      estimatedDurationDays: input.estimatedDurationDays ?? starter?.estimatedDurationDays ?? null,
      dueDateRule: input.dueDateRule ?? null,
      intendedPosition: input.intendedPosition?.trim() || "",
      templateKind: input.templateKind ?? "DEPARTMENT",
      versions: {
        create: { version: "1.0", status: "DRAFT" },
      },
    },
    include: { versions: true },
  });
  const versionId = template.versions[0].id;
  const structure = input.sections?.length
    ? { sections: input.sections }
    : starter ?? { sections: [] as StarterTemplate["sections"] };
  if (structure.sections.length) {
    await saveDraftStructure(ctx, template.id, structure.sections as SectionInput[], versionId);
  }
  await writeAudit(ctx, "taskbook.created", "TaskBookTemplate", template.id, { title });
  await writeActivity(ctx.departmentId, "TASKBOOK_CREATED", {
    userId: ctx.userId,
    referenceId: template.id,
    metadata: { title, actorName: ctx.name },
  });
  return getTaskBook(ctx, template.id);
}

export async function duplicateTaskBook(ctx: AuthContext, templateId: string) {
  assertPermission(ctx, "taskbooks.write");
  const source = await getTaskBook(ctx, templateId);
  const working = source.workingVersion;
  if (!working) throw new HttpError(400, "This Task Book has no content to duplicate.");
  return createTaskBook(ctx, {
    title: `${source.title} (copy)`,
    description: source.description,
    category: source.category,
    estimatedDurationDays: source.estimatedDurationDays,
    dueDateRule: source.dueDateRule,
    intendedPosition: source.intendedPosition,
    sections: working.sections.map((section, sIndex) => ({
      title: section.title,
      description: section.description,
      sortOrder: sIndex,
      requirements: section.requirements.map((requirement, rIndex) => ({
        ...(requirement as unknown as RequirementInput),
        sortOrder: rIndex,
      })),
    })),
  });
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
    intendedPosition?: string;
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
      intendedPosition: input.intendedPosition === undefined ? template.intendedPosition : input.intendedPosition.trim(),
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
    const keyToId = new Map<string, string>();
    const createdReqs: Array<{ id: string; keys: string[] }> = [];
    for (const section of sections) {
      const created = await tx.taskBookSection.create({
        data: {
          versionId: draft.id,
          title: section.title.trim() || "Untitled section",
          description: section.description?.trim() || "",
          sortOrder: section.sortOrder,
          requirements: {
            create: section.requirements.map((requirement, index) => {
              const data = serializeRequirement({ ...requirement, sortOrder: requirement.sortOrder ?? index, prerequisites: [] });
              return data;
            }),
          },
        },
        include: { requirements: { orderBy: { sortOrder: "asc" } } },
      });
      created.requirements.forEach((requirement, index) => {
        const source = section.requirements[index];
        const keys = [requirement.id];
        if (source?.id) keys.push(source.id);
        if ((source as { clientId?: string } | undefined)?.clientId) keys.push((source as { clientId?: string }).clientId as string);
        for (const key of keys) keyToId.set(key, requirement.id);
        createdReqs.push({ id: requirement.id, keys: source?.prerequisites ?? [] });
      });
    }
    for (const item of createdReqs) {
      const mapped = item.keys.map((key) => keyToId.get(key) || key).filter(Boolean);
      await tx.taskBookRequirement.update({
        where: { id: item.id },
        data: { prerequisitesJson: JSON.stringify(mapped) },
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
            create: section.requirements.map((requirement) => copyRequirementData(requirement as unknown as Record<string, unknown>)),
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

export function versionDiff(ctx: AuthContext, from: { version: string; sections: Array<{ title: string; requirements: Array<{ title: string }> }> }, to: typeof from) {
  const fromTitles = new Set(from.sections.flatMap((section) => section.requirements.map((req) => req.title)));
  const toTitles = new Set(to.sections.flatMap((section) => section.requirements.map((req) => req.title)));
  const added = [...toTitles].filter((title) => !fromTitles.has(title));
  const removed = [...fromTitles].filter((title) => !toTitles.has(title));
  return { from: from.version, to: to.version, added, removed };
}

export async function publishTaskBook(ctx: AuthContext, templateId: string, opts: { force?: boolean } = {}) {
  assertPermission(ctx, "taskbooks.publish");
  const template = await getTemplateForDept(ctx, templateId);
  const draft = template.versions.find((version) => version.status === "DRAFT");
  if (!draft) throw new HttpError(400, "There is no draft to publish.");
  const review = reviewTaskBook({
    title: template.title,
    sections: draft.sections.map((section) => ({
      title: section.title,
      requirements: section.requirements.map((req) => ({
        title: req.title,
        instructions: req.instructions,
        description: req.description,
      })),
    })),
  });
  if (!review.ready && !opts.force) {
    throw new HttpError(400, review.issues[0]?.message || "Fix Task Book review items before publishing.");
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
    kind: "DEPARTMENT" as const,
  }));
}

export async function getTaskBookReview(ctx: AuthContext, templateId: string) {
  const book = await getTaskBook(ctx, templateId);
  return book.review;
}
