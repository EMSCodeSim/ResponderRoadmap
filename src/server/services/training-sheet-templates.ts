import { prisma } from "@/server/db";
import { HttpError, writeAudit } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";
import { approvedEvaluatorWhere } from "@/server/services/evaluators";

const CLASS_TYPES = new Set(["GENERAL", "SKILLS_TEST", "CPR"]);
const CATEGORIES = new Set(["COMPANY", "EMS", "FIRE", "DRIVER_OPERATOR", "HAZMAT", "TECHNICAL_RESCUE", "WILDLAND", "OTHER"]);

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
  creditHours: number; checklistVersionId: string | null; location: string; notes: string;
  requiredFieldsJson: string; selfRegistration: boolean; proctorUserIdsJson: string;
  archived: boolean; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    defaultTitle: row.defaultTitle,
    classType: row.classType,
    trainingCategory: row.trainingCategory,
    creditHours: row.creditHours,
    checklistVersionId: row.checklistVersionId,
    location: row.location,
    notes: row.notes,
    requiredFields: parse(row.requiredFieldsJson),
    selfRegistration: row.selfRegistration,
    proctorUserIds: parse(row.proctorUserIdsJson),
    archived: row.archived,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function validate(ctx: AuthContext, input: Record<string, unknown>) {
  const name = String(input.name || "").trim().slice(0, 120);
  if (!name) throw new HttpError(400, "Template name is required.");
  const classType = String(input.classType || "GENERAL").trim().toUpperCase();
  const trainingCategory = String(input.trainingCategory || "COMPANY").trim().toUpperCase();
  if (!CLASS_TYPES.has(classType)) throw new HttpError(400, "Invalid class type.");
  if (!CATEGORIES.has(trainingCategory)) throw new HttpError(400, "Invalid training category.");
  const creditHours = Number(input.creditHours ?? 0);
  if (!Number.isFinite(creditHours) || creditHours < 0 || creditHours > 24) throw new HttpError(400, "Credit hours must be between 0 and 24.");

  const checklistVersionId = input.checklistVersionId ? String(input.checklistVersionId) : null;
  if (checklistVersionId) {
    const checklist = await prisma.taskBookVersion.findFirst({
      where: { id: checklistVersionId, status: "PUBLISHED", template: { departmentId: ctx.departmentId } },
      select: { id: true },
    });
    if (!checklist) throw new HttpError(404, "Published checklist not found.");
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
    creditHours,
    checklistVersionId,
    location: String(input.location || "").trim().slice(0, 180),
    notes: String(input.notes || "").trim().slice(0, 4000),
    requiredFieldsJson: JSON.stringify(strings(input.requiredFields)),
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
    data: { ...data, archived: input.archived === undefined ? existing.archived : input.archived === true },
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
