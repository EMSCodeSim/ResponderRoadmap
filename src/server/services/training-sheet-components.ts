import { prisma } from "@/server/db";
import { HttpError, writeAudit } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";
import { EMS_CE_CATEGORIES } from "@/lib/ems-ce-categories";

const KINDS = new Set(["GRADING", "EMS_CE_LIST"]);
const FIELD_TYPES = new Set(["TEXT", "NUMBER", "PERCENT", "PASS_FAIL", "CHECKBOX"]);
const ceCategories = new Set(Object.keys(EMS_CE_CATEGORIES));

function normalizeData(kind: string, value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (kind === "EMS_CE_LIST") {
    if (!Array.isArray(source.ceCredits)) throw new HttpError(400, "Add at least one EMS CE category and hour allocation.");
    const totals = new Map<string, number>();
    for (const raw of source.ceCredits) {
      const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      const category = String(row.category || "").trim();
      const hours = Number(row.hours ?? 0);
      if (!ceCategories.has(category)) throw new HttpError(400, "Choose a valid EMS CE category.");
      if (!Number.isFinite(hours) || hours <= 0 || hours > 24) throw new HttpError(400, "Each EMS CE category must be between 0 and 24 hours.");
      totals.set(category, Math.round(((totals.get(category) || 0) + hours) * 100) / 100);
    }
    const ceCredits = [...totals].map(([category, hours]) => ({ category, hours }));
    if (ceCredits.reduce((sum, row) => sum + row.hours, 0) > 24) throw new HttpError(400, "EMS CE allocations cannot exceed 24 hours.");
    return { ceCredits };
  }

  const rawConfig = source.gradingConfig && typeof source.gradingConfig === "object" ? source.gradingConfig as Record<string, unknown> : {};
  const score = (key: string, enabled: boolean) => {
    const raw = rawConfig[key];
    if (!enabled || raw == null || raw === "") return null;
    const number = Number(raw);
    if (!Number.isFinite(number) || number < 0 || number > 100) throw new HttpError(400, "Grade pass marks must be between 0 and 100.");
    return number;
  };
  const gradingConfig = {
    writtenTestEnabled: rawConfig.writtenTestEnabled === true,
    writtenTestPassPercent: score("writtenTestPassPercent", rawConfig.writtenTestEnabled === true),
    ccfEnabled: rawConfig.ccfEnabled === true,
    ccfPassPercent: score("ccfPassPercent", rawConfig.ccfEnabled === true),
    rmsEntryCategories: Array.isArray(rawConfig.rmsEntryCategories) ? [...new Set(rawConfig.rmsEntryCategories.map((item) => String(item).trim()).filter(Boolean))].slice(0, 20).map((item) => item.slice(0, 80)) : [],
  };
  if (gradingConfig.writtenTestEnabled && gradingConfig.writtenTestPassPercent == null) throw new HttpError(400, "Set the written test passing score.");
  if (gradingConfig.ccfEnabled && gradingConfig.ccfPassPercent == null) throw new HttpError(400, "Set the CCF passing score.");
  const customFields = Array.isArray(source.customFields) ? source.customFields.slice(0, 20).map((raw, index) => {
    const field = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const label = String(field.label || "").trim().slice(0, 100);
    const type = String(field.type || "PASS_FAIL").toUpperCase();
    if (!label || !FIELD_TYPES.has(type)) throw new HttpError(400, `Enter a name and valid grade type for grading item ${index + 1}.`);
    return {
      id: /^[a-zA-Z0-9_-]{1,80}$/.test(String(field.id || "")) ? String(field.id) : `grade-${index + 1}`,
      label,
      type,
      required: field.required !== false,
      appliesTo: "RESULT",
    };
  }) : [];
  return { gradingConfig, customFields };
}

function view(row: { id: string; kind: string; name: string; dataJson: string; archived: boolean; revision: number; createdAt: Date; updatedAt: Date }) {
  let data: unknown = {};
  try { data = JSON.parse(row.dataJson); } catch {}
  return { id: row.id, kind: row.kind, name: row.name, data, archived: row.archived, revision: row.revision, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export async function listTrainingSheetComponents(ctx: AuthContext, includeArchived = false) {
  assertPermission(ctx, "classes.write");
  const rows = await prisma.trainingSheetComponentTemplate.findMany({
    where: { departmentId: ctx.departmentId, ...(includeArchived ? {} : { archived: false }) },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
  return rows.map(view);
}

export async function saveTrainingSheetComponent(ctx: AuthContext, input: Record<string, unknown>, id?: string) {
  assertPermission(ctx, "classes.write");
  const kind = String(input.kind || "").trim().toUpperCase();
  const name = String(input.name || "").trim().slice(0, 120);
  if (!KINDS.has(kind)) throw new HttpError(400, "Choose a grading system or EMS CE category list.");
  if (!name) throw new HttpError(400, "Component name is required.");
  const dataJson = JSON.stringify(normalizeData(kind, input.data));
  if (!id) {
    const row = await prisma.trainingSheetComponentTemplate.create({
      data: { departmentId: ctx.departmentId, kind, name, dataJson, createdById: ctx.userId },
    });
    await writeAudit(ctx, "TRAINING_SHEET_COMPONENT_CREATED", "TrainingSheetComponentTemplate", row.id, { kind, name });
    return view(row);
  }
  const existing = await prisma.trainingSheetComponentTemplate.findFirst({ where: { id, departmentId: ctx.departmentId } });
  if (!existing) throw new HttpError(404, "Reusable training component not found.");
  const row = await prisma.trainingSheetComponentTemplate.update({
    where: { id },
    data: { kind, name, dataJson, archived: input.archived === undefined ? existing.archived : input.archived === true, revision: { increment: 1 } },
  });
  await writeAudit(ctx, "TRAINING_SHEET_COMPONENT_UPDATED", "TrainingSheetComponentTemplate", row.id, { kind, name, archived: row.archived });
  return view(row);
}

export async function archiveTrainingSheetComponent(ctx: AuthContext, id: string) {
  assertPermission(ctx, "classes.write");
  const existing = await prisma.trainingSheetComponentTemplate.findFirst({ where: { id, departmentId: ctx.departmentId } });
  if (!existing) throw new HttpError(404, "Reusable training component not found.");
  const row = await prisma.trainingSheetComponentTemplate.update({ where: { id }, data: { archived: true } });
  await writeAudit(ctx, "TRAINING_SHEET_COMPONENT_ARCHIVED", "TrainingSheetComponentTemplate", row.id, { kind: row.kind, name: row.name });
  return view(row);
}
