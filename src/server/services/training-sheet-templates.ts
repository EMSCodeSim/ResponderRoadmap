import { prisma } from "@/server/db";
import { HttpError, writeAudit } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";
import { approvedEvaluatorWhere } from "@/server/services/evaluators";
import { EMS_CE_CATEGORIES } from "@/lib/ems-ce-categories";

const CLASS_TYPES = new Set(["GENERAL", "FIRE_ACADEMY", "CPR", "EMS"]);
const CATEGORIES = new Set(["COMPANY", "FACILITY", "HAZMAT", "DRIVER", "OFFICER", "EMS", "OTHER"]);
const TOPICS = new Set(["EMS", "FIRE", "HAZMAT", "DRIVER", "CPR", "OFFICER", "FACILITY", "OTHER"]);
const EMS_CE_GROUPS = new Set(Object.keys(EMS_CE_CATEGORIES));

function legacyTopic(trainingCategory: string) {
  if (trainingCategory === "COMPANY") return "FIRE";
  return TOPICS.has(trainingCategory) ? trainingCategory : "OTHER";
}

function normalizeCeCredits(value: unknown) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, "EMS CE credits must be a list of categories and hours.");
  const totals = new Map<string, number>();
  for (const entry of value) {
    const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const category = String(item.category || "").trim();
    const hours = Number(item.hours ?? 0);
    if (!EMS_CE_GROUPS.has(category)) throw new HttpError(400, "Choose a valid EMS CE category.");
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) throw new HttpError(400, "Each CE category must be between 0 and 24 hours.");
    if (hours > 0) totals.set(category, (totals.get(category) || 0) + hours);
  }
  const result = [...totals].map(([category, hours]) => ({ category, hours: Math.round(hours * 100) / 100 }));
  if (result.reduce((sum, item) => sum + item.hours, 0) > 24) throw new HttpError(400, "EMS CE credits cannot exceed 24 hours per training sheet.");
  return result;
}

function parseCeCredits(value: string) {
  try { return normalizeCeCredits(JSON.parse(value || "[]")); } catch { return []; }
}

function normalizeGradingConfig(value: unknown) {
  const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const writtenTestEnabled = item.writtenTestEnabled === true;
  const ccfEnabled = item.ccfEnabled === true;
  const score = (raw: unknown) => {
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw new HttpError(400, "Grade pass marks must be between 0 and 100.");
    return n;
  };
  return {
    writtenTestEnabled,
    writtenTestPassPercent: writtenTestEnabled ? score(item.writtenTestPassPercent) : null,
    ccfEnabled,
    ccfPassPercent: ccfEnabled ? score(item.ccfPassPercent) : null,
    rmsEntryCategories: strings(item.rmsEntryCategories).slice(0, 20).map((category) => category.slice(0, 80)),
    customTopicLabel: String(item.customTopicLabel || "").trim().slice(0, 80),
    customClassTypeLabel: String(item.customClassTypeLabel || "").trim().slice(0, 80),
    customTrainingCategoryLabel: String(item.customTrainingCategoryLabel || "").trim().slice(0, 80),
  };
}

function strings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function parse(value: string) {
  try {
    const parsed = JSON.parse(value);
    return strings(parsed);
  } catch {
    return [];
  }
}

function view(row: {
  id: string; name: string; defaultTitle: string; classType: string; trainingCategory: string;
  topic: string; ceCreditsJson: string; gradingConfigJson?: string;
  creditHours: number; checklistVersionId: string | null; location: string; notes: string;
  requiredFieldsJson: string; customFieldsJson: string; selfRegistration: boolean; proctorUserIdsJson: string;
  archived: boolean; revision: number; createdAt: Date; updatedAt: Date;
}) {
  let gradingConfig = {};
  try { gradingConfig = JSON.parse(row.gradingConfigJson || "{}"); } catch {}
  return {
    id: row.id,
    name: row.name,
    defaultTitle: row.defaultTitle,
    classType: row.classType,
    trainingCategory: row.trainingCategory,
    topic: TOPICS.has(row.topic) && row.topic !== "OTHER" ? row.topic : legacyTopic(row.trainingCategory),
    gradingConfig,
    ceCredits: parseCeCredits(row.ceCreditsJson),
    creditHours: row.creditHours,
    checklistVersionId: row.checklistVersionId,
    location: row.location,
    notes: row.notes,
    requiredFields: parse(row.requiredFieldsJson),
    customFields: JSON.parse(row.customFieldsJson || "[]"),
    selfRegistration: row.selfRegistration,
    proctorUserIds: parse(row.proctorUserIdsJson),
    archived: row.archived,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function validate(ctx: AuthContext, input: Record<string, unknown>) {
  const name = String(input.name || "").trim().slice(0, 120);
  if (!name) throw new HttpError(400, "Template name is required.");
  const classType = String(input.classType || "GENERAL").trim().toUpperCase();
  const trainingCategory = String(input.trainingCategory || "COMPANY").trim().toUpperCase();
  const topic = String(input.topic || legacyTopic(trainingCategory)).trim().toUpperCase();
  if (!CLASS_TYPES.has(classType)) throw new HttpError(400, "Invalid class type.");
  if (!CATEGORIES.has(trainingCategory)) throw new HttpError(400, "Invalid training category.");
  if (!TOPICS.has(topic)) throw new HttpError(400, "Invalid template topic.");
  const ceCredits = normalizeCeCredits(input.ceCredits);
  if (ceCredits.length && topic !== "EMS") throw new HttpError(400, "EMS CE allocations can only be saved on EMS templates.");
  const allocatedHours = ceCredits.reduce((sum, item) => sum + item.hours, 0);
  const creditHours = allocatedHours > 0 ? allocatedHours : Number(input.creditHours ?? 0);
  if (!Number.isFinite(creditHours) || creditHours < 0 || creditHours > 24) throw new HttpError(400, "Credit hours must be between 0 and 24.");

  const checklistVersionId = input.checklistVersionId ? String(input.checklistVersionId) : null;
  if (checklistVersionId) {
    const checklist = await prisma.taskBookVersion.findFirst({
      where: { id: checklistVersionId, status: "PUBLISHED", template: { departmentId: ctx.departmentId } },
      select: { id: true },
    });
    if (!checklist) throw new HttpError(404, "Published checklist not found.");
  }

  if (classType === "CPR" && !checklistVersionId) {
    throw new HttpError(400, "A CPR training package must include a published department skills checklist.");
  }

  const proctorUserIds = strings(input.proctorUserIds);
  if (proctorUserIds.length) {
    const valid = await prisma.departmentMembership.count({
      where: { ...approvedEvaluatorWhere(ctx.departmentId), userId: { in: proctorUserIds } },
    });
    if (valid !== proctorUserIds.length) throw new HttpError(400, "One or more default proctors are invalid.");
  }

  return {
    name,
    defaultTitle: String(input.defaultTitle || "").trim().slice(0, 180),
    classType,
    trainingCategory,
    topic,
    gradingConfigJson: JSON.stringify(normalizeGradingConfig(input.gradingConfig)),
    ceCreditsJson: JSON.stringify(ceCredits),
    creditHours,
    checklistVersionId,
    location: String(input.location || "").trim().slice(0, 180),
    notes: String(input.notes || "").trim().slice(0, 4000),
    requiredFieldsJson: JSON.stringify(strings(input.requiredFields)),
    customFieldsJson: JSON.stringify((Array.isArray(input.customFields) ? input.customFields : []).slice(0, 20).map((field: unknown, index: number) => {
      const item = field && typeof field === "object" ? field as Record<string, unknown> : {};
      const label = String(item.label || "").trim().slice(0, 100);
      const type = String(item.type || "TEXT").toUpperCase();
      const appliesTo = String(item.appliesTo || "RESULT").toUpperCase();
      if (!label || !["TEXT", "EMAIL", "STATE", "LAST4", "NUMBER", "PERCENT", "DATE", "PASS_FAIL", "CHECKBOX"].includes(type) || !["ROSTER", "RESULT"].includes(appliesTo)) throw new HttpError(400, `Invalid custom field ${index + 1}.`);
      return { id: /^[a-zA-Z0-9_-]{1,80}$/.test(String(item.id || "")) ? String(item.id) : `custom-${index + 1}`, label, type, required: item.required === true, appliesTo };
    })),
    selfRegistration: input.selfRegistration === true,
    proctorUserIdsJson: JSON.stringify(proctorUserIds),
  };
}

export async function listTrainingSheetTemplates(ctx: AuthContext, includeArchived = false) {
  assertPermission(ctx, "classes.write");
  const rows = await prisma.trainingSheetTemplate.findMany({
    where: { departmentId: ctx.departmentId, ...(includeArchived ? {} : { archived: false }) },
    orderBy: [{ archived: "asc" }, { name: "asc" }],
  });
  return rows.map(view);
}

export async function createTrainingSheetTemplate(ctx: AuthContext, input: Record<string, unknown>) {
  assertPermission(ctx, "classes.write");
  const data = await validate(ctx, input);
  const row = await prisma.trainingSheetTemplate.create({
    data: { departmentId: ctx.departmentId, createdById: ctx.userId, ...data },
  });
  await writeAudit(ctx, "TRAINING_SHEET_TEMPLATE_CREATED", "TrainingSheetTemplate", row.id, { name: row.name });
  return view(row);
}

export async function updateTrainingSheetTemplate(ctx: AuthContext, id: string, input: Record<string, unknown>) {
  assertPermission(ctx, "classes.write");
  const existing = await prisma.trainingSheetTemplate.findFirst({ where: { id, departmentId: ctx.departmentId } });
  if (!existing) throw new HttpError(404, "Training Sheet template not found.");
  const data = await validate(ctx, { ...view(existing), ...input });
  const row = await prisma.trainingSheetTemplate.update({
    where: { id },
    data: { ...data, archived: input.archived === undefined ? existing.archived : input.archived === true, revision: { increment: 1 } },
  });
  await writeAudit(ctx, "TRAINING_SHEET_TEMPLATE_UPDATED", "TrainingSheetTemplate", row.id, { name: row.name, archived: row.archived });
  return view(row);
}

export async function archiveTrainingSheetTemplate(ctx: AuthContext, id: string) {
  assertPermission(ctx, "classes.write");
  const existing = await prisma.trainingSheetTemplate.findFirst({ where: { id, departmentId: ctx.departmentId } });
  if (!existing) throw new HttpError(404, "Training Sheet template not found.");
  const row = await prisma.trainingSheetTemplate.update({ where: { id }, data: { archived: true } });
  await writeAudit(ctx, "TRAINING_SHEET_TEMPLATE_ARCHIVED", "TrainingSheetTemplate", row.id, { name: row.name });
  return view(row);
}
