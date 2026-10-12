import { prisma } from "@/server/db";
import { HttpError, writeAudit } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";
import { createAssignments } from "@/server/services/assignments";

export async function assignClassTaskBook(
  ctx: AuthContext,
  classId: string,
  input: { templateId?: string; membershipIds?: string[]; dueDate?: string | null },
) {
  assertPermission(ctx, "assignments.write");
  assertPermission(ctx, "classes.read");
  const klass = await prisma.trainingClass.findFirst({ where: { id: classId, departmentId: ctx.departmentId } });
  if (!klass) throw new HttpError(404, "Class not found.");
  if (!input || typeof input.templateId !== "string" || !input.templateId.trim()) throw new HttpError(400, "Choose a published Task Book.");
  if (!Array.isArray(input.membershipIds) || input.membershipIds.length < 1 || input.membershipIds.length > 200 ||
    input.membershipIds.some((id) => typeof id !== "string")) throw new HttpError(400, "Select 1–200 department members.");
  const selected = [...new Set(input.membershipIds)];
  const enrollments = await prisma.trainingClassEnrollment.findMany({
    where: { classId, membershipId: { in: selected }, membership: { departmentId: ctx.departmentId, status: "ACTIVE" } },
    select: { membershipId: true },
  });
  if (enrollments.length !== selected.length) throw new HttpError(400, "Selected members must be active department members on the roster.");
  const result = await createAssignments(ctx, {
    templateId: input.templateId,
    membershipIds: selected,
    dueDate: input.dueDate || null,
    notes: `Assigned from class ${classId}. Attendance alone does not satisfy requirements.`,
  });
  await writeAudit(ctx, "class.taskbook.assigned", "TrainingClass", classId, {
    templateId: input.templateId, selected: selected.length, created: result.created, skipped: result.skipped,
  });
  return { ...result, selected: selected.length };
}

/** Group attendance is a single audited event, not a blanket competency pass. */
export async function confirmClassAttendance(ctx: AuthContext, classId: string, input: { enrollmentIds?: string[] }) {
  assertPermission(ctx, "classes.write");
  const klass = await prisma.trainingClass.findFirst({ where: { id: classId, departmentId: ctx.departmentId } });
  if (!klass) throw new HttpError(404, "Class not found.");
  if (klass.status === "COMPLETE" || klass.status === "CANCELLED") throw new HttpError(409, "Closed classes cannot be changed.");
  if (!Array.isArray(input?.enrollmentIds) || input.enrollmentIds.length < 1 || input.enrollmentIds.length > 200 ||
    input.enrollmentIds.some((id) => typeof id !== "string")) throw new HttpError(400, "Select 1–200 roster entries.");
  const ids = [...new Set(input.enrollmentIds)];
  const found = await prisma.trainingClassEnrollment.count({ where: { classId, id: { in: ids } } });
  if (found !== ids.length) throw new HttpError(400, "Every selected student must be on the class roster.");
  const updated = await prisma.trainingClassEnrollment.updateMany({
    where: { classId, id: { in: ids }, attendance: "REGISTERED" },
    data: { attendance: "PRESENT" },
  });
  await writeAudit(ctx, "class.attendance.group_confirmed", "TrainingClass", classId, { selected: ids.length, updated: updated.count });
  return { updated: updated.count, unchanged: ids.length - updated.count };
}
