import { prisma } from "@/server/db";
import { HttpError, writeAudit } from "@/server/http";
import type { AuthContext } from "@/server/permissions";

function assertTrainingOfficer(ctx: AuthContext) {
  if (!["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"].includes(ctx.role)) {
    throw new HttpError(403, "Only a Training Officer or Department Administrator can manage class cleanup.");
  }
}

export async function listClassCleanup(ctx: AuthContext, archived = false) {
  assertTrainingOfficer(ctx);
  const rows = await prisma.trainingClass.findMany({
    where: { departmentId: ctx.departmentId, ...(archived ? { status: "ARCHIVED" } : { status: { not: "ARCHIVED" } }) },
    include: { roster: { include: { skillResults: true } }, proctors: true },
    orderBy: { startsAt: "desc" },
  });
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return rows.map((row) => {
    const hasOfficialRecords = row.roster.some((enrollment) =>
      enrollment.attendance !== "REGISTERED" || enrollment.finalResult !== "PENDING" || enrollment.completedAt != null || enrollment.skillResults.length > 0,
    );
    const canDelete = row.roster.length === 0 && !hasOfficialRecords;
    const staleDraft = row.status === "DRAFT" && row.startsAt.getTime() < cutoff;
    return {
      id: row.id, title: row.title, startsAt: row.startsAt, status: row.status,
      rosterCount: row.roster.length, hasOfficialRecords, canDelete, staleDraft,
      cleanupReason: staleDraft ? "Draft older than 30 days" : row.status === "CANCELLED" ? "Cancelled class" : row.roster.length === 0 ? "No attendees" : null,
    };
  });
}

export async function archiveClass(ctx: AuthContext, classId: string) {
  assertTrainingOfficer(ctx);
  const row = await prisma.trainingClass.findFirst({ where: { id: classId, departmentId: ctx.departmentId } });
  if (!row) throw new HttpError(404, "Class not found.");
  await prisma.trainingClass.update({ where: { id: row.id }, data: { status: "ARCHIVED", registrationEnabled: false } });
  await writeAudit(ctx, "class.archived", "TrainingClass", row.id, { previousStatus: row.status });
  return { ok: true };
}

export async function restoreClass(ctx: AuthContext, classId: string) {
  assertTrainingOfficer(ctx);
  const row = await prisma.trainingClass.findFirst({ where: { id: classId, departmentId: ctx.departmentId, status: "ARCHIVED" } });
  if (!row) throw new HttpError(404, "Archived class not found.");
  await prisma.trainingClass.update({ where: { id: row.id }, data: { status: "CANCELLED", registrationEnabled: false } });
  await writeAudit(ctx, "class.restored", "TrainingClass", row.id, { restoredAs: "CANCELLED" });
  return { ok: true };
}

export async function deleteUnusedClass(ctx: AuthContext, classId: string) {
  assertTrainingOfficer(ctx);
  const row = await prisma.trainingClass.findFirst({
    where: { id: classId, departmentId: ctx.departmentId },
    include: { roster: { include: { skillResults: true } } },
  });
  if (!row) throw new HttpError(404, "Class not found.");
  const hasOfficialRecords = row.roster.some((enrollment) =>
    enrollment.attendance !== "REGISTERED" || enrollment.finalResult !== "PENDING" || enrollment.completedAt != null || enrollment.skillResults.length > 0,
  );
  if (row.roster.length > 0 || hasOfficialRecords) {
    throw new HttpError(409, "This class contains a roster or training records and cannot be deleted. Archive it instead.");
  }
  await writeAudit(ctx, "class.deleted_unused", "TrainingClass", row.id, { title: row.title, status: row.status });
  await prisma.trainingClass.delete({ where: { id: row.id } });
  return { ok: true };
}
