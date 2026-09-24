import { prisma } from "@/server/db";
import { assertPermission, type AuthContext } from "@/server/permissions";
import { HttpError, writeAudit } from "@/server/http";

function strings(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.map((item) => String(item).trim()).filter(Boolean))] : [];
}

function hours(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const amount = Number(raw);
    if (key.trim() && Number.isFinite(amount) && amount > 0) result[key.trim().toUpperCase()] = Math.min(1000, amount);
  }
  return result;
}

function parse<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export async function listTrainingExpectations(ctx: AuthContext) {
  assertPermission(ctx, "department.read");
  const [profiles, credentialTypes, taskBooks] = await Promise.all([
    prisma.trainingExpectation.findMany({ where: { departmentId: ctx.departmentId }, orderBy: { name: "asc" } }),
    prisma.credentialType.findMany({ where: { departmentId: ctx.departmentId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.taskBookTemplate.findMany({
      where: { departmentId: ctx.departmentId, status: "ACTIVE", templateKind: { not: "TRAINING_TASK" } },
      select: { id: true, title: true, intendedPosition: true },
      orderBy: { title: "asc" },
    }),
  ]);
  return {
    profiles: profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      matchRanks: parse<string[]>(profile.matchRanksJson, []),
      matchPositions: parse<string[]>(profile.matchPositionsJson, []),
      credentialTypeIds: parse<string[]>(profile.credentialTypeIdsJson, []),
      taskBookTemplateIds: parse<string[]>(profile.taskBookTemplateIdsJson, []),
      annualHours: parse<Record<string, number>>(profile.annualHoursJson, {}),
      active: profile.active,
    })),
    credentialTypes,
    taskBooks,
  };
}

export async function createTrainingExpectation(ctx: AuthContext, input: Record<string, unknown>) {
  assertPermission(ctx, "department.write");
  const name = String(input.name || "").trim();
  if (!name) throw new HttpError(400, "Expectation profile name is required.");
  const profile = await prisma.trainingExpectation.create({
    data: {
      departmentId: ctx.departmentId,
      name,
      matchRanksJson: JSON.stringify(strings(input.matchRanks)),
      matchPositionsJson: JSON.stringify(strings(input.matchPositions)),
      credentialTypeIdsJson: JSON.stringify(strings(input.credentialTypeIds)),
      taskBookTemplateIdsJson: JSON.stringify(strings(input.taskBookTemplateIds)),
      annualHoursJson: JSON.stringify(hours(input.annualHours)),
      active: input.active !== false,
    },
  });
  await writeAudit(ctx, "training_expectation.created", "TrainingExpectation", profile.id, { name });
  return profile;
}

export async function updateTrainingExpectation(ctx: AuthContext, id: string, input: Record<string, unknown>) {
  assertPermission(ctx, "department.write");
  const existing = await prisma.trainingExpectation.findFirst({ where: { id, departmentId: ctx.departmentId } });
  if (!existing) throw new HttpError(404, "Training expectation not found.");
  const name = input.name === undefined ? existing.name : String(input.name).trim();
  if (!name) throw new HttpError(400, "Expectation profile name is required.");
  const profile = await prisma.trainingExpectation.update({
    where: { id },
    data: {
      name,
      matchRanksJson: input.matchRanks === undefined ? undefined : JSON.stringify(strings(input.matchRanks)),
      matchPositionsJson: input.matchPositions === undefined ? undefined : JSON.stringify(strings(input.matchPositions)),
      credentialTypeIdsJson: input.credentialTypeIds === undefined ? undefined : JSON.stringify(strings(input.credentialTypeIds)),
      taskBookTemplateIdsJson: input.taskBookTemplateIds === undefined ? undefined : JSON.stringify(strings(input.taskBookTemplateIds)),
      annualHoursJson: input.annualHours === undefined ? undefined : JSON.stringify(hours(input.annualHours)),
      active: input.active === undefined ? undefined : Boolean(input.active),
    },
  });
  await writeAudit(ctx, "training_expectation.updated", "TrainingExpectation", profile.id, { name });
  return profile;
}

export async function deleteTrainingExpectation(ctx: AuthContext, id: string) {
  assertPermission(ctx, "department.write");
  const existing = await prisma.trainingExpectation.findFirst({ where: { id, departmentId: ctx.departmentId } });
  if (!existing) throw new HttpError(404, "Training expectation not found.");
  await prisma.trainingExpectation.delete({ where: { id } });
  await writeAudit(ctx, "training_expectation.deleted", "TrainingExpectation", id, { name: existing.name });
  return { ok: true };
}
