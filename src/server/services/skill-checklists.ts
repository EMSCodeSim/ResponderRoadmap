import { prisma } from "@/server/db";
import { HttpError, writeAudit } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";

type ChecklistItem = { id: string; title: string; description: string; instructions: string; evaluationSteps: string[]; required: boolean; criticalFailures: string[] };
type ChecklistSection = { id: string; title: string; items: ChecklistItem[] };

function normalizeSections(value: unknown): ChecklistSection[] {
  if (!Array.isArray(value) || value.length === 0) throw new HttpError(400, "Add at least one checklist section.");
  if (value.length > 40) throw new HttpError(400, "A checklist can have up to 40 sections.");
  const sections = value.map((raw, index) => {
    const section = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const title = String(section.title || "").trim().slice(0, 120);
    if (!title) throw new HttpError(400, `Enter a name for section ${index + 1}.`);
    const rawItems = Array.isArray(section.items) ? section.items : [];
    if (!rawItems.length || rawItems.length > 100) throw new HttpError(400, `${title} needs 1 to 100 checklist items.`);
    const items = rawItems.map((rawItem, itemIndex) => {
      const item = rawItem && typeof rawItem === "object" ? rawItem as Record<string, unknown> : {};
      const itemTitle = String(item.title || "").trim().slice(0, 200);
      if (!itemTitle) throw new HttpError(400, `Enter a name for item ${itemIndex + 1} in ${title}.`);
      const strings = (input: unknown, limit: number, max: number) => Array.isArray(input) ? input.map((entry) => String(entry || "").trim().slice(0, max)).filter(Boolean).slice(0, limit) : [];
      return {
        id: String(item.id || `item-${index + 1}-${itemIndex + 1}`).slice(0, 80), title: itemTitle,
        description: String(item.description || "").trim().slice(0, 500), instructions: String(item.instructions || "").trim().slice(0, 1000),
        evaluationSteps: strings(item.evaluationSteps, 30, 300), required: item.required !== false,
        criticalFailures: strings(item.criticalFailures, 20, 300),
      };
    });
    return { id: String(section.id || `section-${index + 1}`).slice(0, 80), title, items };
  });
  if (sections.reduce((total, section) => total + section.items.length, 0) > 300) throw new HttpError(400, "A checklist can have up to 300 items.");
  return sections;
}

function view(row: { id: string; title: string; description: string; sectionsJson: string; status: string; revision: number; archived: boolean; backingVersionId: string | null; createdAt: Date; updatedAt: Date }) {
  let sections: unknown = [];
  try { sections = JSON.parse(row.sectionsJson); } catch {}
  return { ...row, sections, checklistVersionId: row.backingVersionId };
}

async function publishCompatibilityVersion(ctx: AuthContext, rowId: string, title: string, description: string, sectionsJson: string, revision: number) {
  const sections = JSON.parse(sectionsJson) as ChecklistSection[];
  const version = await prisma.taskBookVersion.create({
    data: {
      template: { create: { departmentId: ctx.departmentId, title: `[Checklist] ${title}`.slice(0, 120), description, category: "Skill Checklist", status: "ACTIVE", ownerId: ctx.userId, templateKind: "SKILL_CHECKLIST" } },
      version: String(revision), status: "PUBLISHED", publishedAt: new Date(), publishedById: ctx.userId,
      sections: { create: sections.map((section, sectionIndex) => ({ title: section.title, description: "", sortOrder: sectionIndex, requirements: { create: section.items.map((item, itemIndex) => ({ title: item.title, description: item.description, instructions: item.instructions, sortOrder: itemIndex, isRequired: item.required, evaluationStepsJson: JSON.stringify(item.evaluationSteps.map((text, index) => ({ id: `${item.id}-${index + 1}`, text }))), criticalFailuresJson: JSON.stringify(item.criticalFailures) })) } })) },
    },
  });
  await prisma.skillChecklist.update({ where: { id: rowId }, data: { backingVersionId: version.id } });
  return version.id;
}

export async function listSkillChecklists(ctx: AuthContext, includeArchived = false) {
  assertPermission(ctx, "classes.write");
  const rows = await prisma.skillChecklist.findMany({ where: { departmentId: ctx.departmentId, ...(includeArchived ? {} : { archived: false }) }, orderBy: [{ updatedAt: "desc" }] });
  return rows.map(view);
}

export async function saveSkillChecklist(ctx: AuthContext, input: Record<string, unknown>, id?: string) {
  assertPermission(ctx, "classes.write");
  const title = String(input.title || "").trim().slice(0, 120);
  if (!title) throw new HttpError(400, "Checklist name is required.");
  const description = String(input.description || "").trim().slice(0, 1000);
  const sectionsJson = JSON.stringify(normalizeSections(input.sections));
  const status = input.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  if (!id) {
    const row = await prisma.skillChecklist.create({ data: { departmentId: ctx.departmentId, title, description, sectionsJson, status, createdById: ctx.userId } });
    if (status === "PUBLISHED") row.backingVersionId = await publishCompatibilityVersion(ctx, row.id, title, description, sectionsJson, row.revision);
    await writeAudit(ctx, "SKILL_CHECKLIST_CREATED", "SkillChecklist", row.id, { title, status });
    return view(row);
  }
  const existing = await prisma.skillChecklist.findFirst({ where: { id, departmentId: ctx.departmentId } });
  if (!existing) throw new HttpError(404, "Skill checklist not found.");
  const row = await prisma.skillChecklist.update({ where: { id }, data: { title, description, sectionsJson, status, archived: input.archived === undefined ? existing.archived : input.archived === true, revision: { increment: 1 } } });
  if (status === "PUBLISHED") row.backingVersionId = await publishCompatibilityVersion(ctx, row.id, title, description, sectionsJson, row.revision);
  await writeAudit(ctx, "SKILL_CHECKLIST_UPDATED", "SkillChecklist", row.id, { title, status, revision: row.revision });
  return view(row);
}

export async function archiveSkillChecklist(ctx: AuthContext, id: string) {
  assertPermission(ctx, "classes.write");
  const existing = await prisma.skillChecklist.findFirst({ where: { id, departmentId: ctx.departmentId } });
  if (!existing) throw new HttpError(404, "Skill checklist not found.");
  const row = await prisma.skillChecklist.update({ where: { id }, data: { archived: true } });
  await writeAudit(ctx, "SKILL_CHECKLIST_ARCHIVED", "SkillChecklist", row.id, { title: row.title });
  return view(row);
}
