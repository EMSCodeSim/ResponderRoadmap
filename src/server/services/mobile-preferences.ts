import { prisma } from "@/server/db";
import { HttpError, writeAudit } from "@/server/http";
import type { AuthContext } from "@/server/permissions";

const PREFERENCE_KEYS = [
  "credentialExpiryPush",
  "assignmentPush",
  "evaluationPush",
  "dueDatePush",
] as const;

type PreferenceKey = (typeof PREFERENCE_KEYS)[number];
type PreferenceInput = Partial<Record<PreferenceKey, unknown>>;

function pickPreferences(input: PreferenceInput) {
  const values: Partial<Record<PreferenceKey, boolean>> = {};
  for (const key of PREFERENCE_KEYS) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== "boolean") throw new HttpError(400, `${key} must be true or false.`);
    values[key] = input[key];
  }
  return values;
}

export async function getNotificationPreferences(ctx: AuthContext) {
  return prisma.notificationPreference.upsert({
    where: { departmentId_userId: { departmentId: ctx.departmentId, userId: ctx.userId } },
    create: { departmentId: ctx.departmentId, userId: ctx.userId },
    update: {},
    select: Object.fromEntries(["credentialExpiryPush", "assignmentPush", "evaluationPush", "dueDatePush"].map((key) => [key, true])) as {
      credentialExpiryPush: true;
      assignmentPush: true;
      evaluationPush: true;
      dueDatePush: true;
    },
  });
}

export async function updateNotificationPreferences(ctx: AuthContext, input: PreferenceInput) {
  const values = pickPreferences(input);
  if (Object.keys(values).length === 0) throw new HttpError(400, "Choose at least one notification preference to update.");
  const record = await prisma.notificationPreference.upsert({
    where: { departmentId_userId: { departmentId: ctx.departmentId, userId: ctx.userId } },
    create: { departmentId: ctx.departmentId, userId: ctx.userId, ...values },
    update: values,
    select: {
      credentialExpiryPush: true,
      assignmentPush: true,
      evaluationPush: true,
      dueDatePush: true,
    },
  });
  await writeAudit(ctx, "app.notification_preferences.updated", "NotificationPreference", `${ctx.departmentId}:${ctx.userId}`, values);
  return record;
}
