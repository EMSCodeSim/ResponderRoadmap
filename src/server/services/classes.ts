import { prisma } from "@/server/db";
import { HttpError, writeActivity, writeAudit } from "@/server/http";
import { assertPermission, hasPermission, type AuthContext } from "@/server/permissions";
import { approvedEvaluatorWhere, assertApprovedEvaluator } from "@/server/services/evaluators";

const RESULT_VALUES = new Set(["NOT_EVALUATED", "PASS", "NEEDS_REMEDIATION", "FAIL", "NOT_APPLICABLE"]);
const ATTENDANCE_VALUES = new Set(["REGISTERED", "PRESENT", "ABSENT", "EXCUSED"]);
const CLASS_STATUS_VALUES = new Set(["DRAFT", "ACTIVE", "COMPLETE", "CANCELLED"]);
const CLASS_TYPE_VALUES = new Set(["GENERAL", "FIRE_ACADEMY", "CPR", "EMS"]);

function parseDate(value: unknown, field: string, required = false) {
  if (value == null || value === "") {
    if (required) throw new HttpError(400, `${field} is required.`);
    return null;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `${field} is invalid.`);
  return date;
}

function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function canAccessClass(ctx: AuthContext, classId: string, write = false) {
  const row = await prisma.trainingClass.findFirst({
    where: { id: classId, departmentId: ctx.departmentId },
    include: { proctors: { where: { userId: ctx.userId } } },
  });
  if (!row) throw new HttpError(404, "Class not found.");
  if (write && !hasPermission(ctx.role, "classes.write") && row.proctors.length === 0) {
    throw new HttpError(403, "You are not assigned as a proctor for this class.");
  }
  if (!write && ctx.role === "EVALUATOR" && row.proctors.length === 0) {
    throw new HttpError(403, "You are not assigned to this class.");
  }
  return row;
}

export async function getClassSetup(ctx: AuthContext) {
  assertPermission(ctx, "classes.write");
  const [versions, memberships] = await Promise.all([
    prisma.taskBookVersion.findMany({
      where: { template: { departmentId: ctx.departmentId }, status: "PUBLISHED" },
      include: { template: true, sections: { include: { requirements: true } } },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.departmentMembership.findMany({
      where: { departmentId: ctx.departmentId, status: "ACTIVE" },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
  ]);
  return {
    checklists: versions.map((version) => ({
      id: version.id,
      title: version.template.title,
      version: version.version,
      skillCount: version.sections.reduce((sum, section) => sum + section.requirements.length, 0),
    })),
    members: memberships.map((membership) => ({
      id: membership.id,
      userId: membership.userId,
      name: membership.user.name,
      rank: membership.rank,
      role: membership.role,
    })),
    proctors: memberships
      .filter((membership) => ["EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"].includes(membership.role) && membership.evaluatorStatus !== "SUSPENDED")
      .map((membership) => ({ userId: membership.userId, name: membership.user.name, role: membership.role })),
  };
}

export async function listClasses(ctx: AuthContext) {
  assertPermission(ctx, "classes.read");
  const rows = await prisma.trainingClass.findMany({
    where: {
      departmentId: ctx.departmentId,
      ...(ctx.role === "EVALUATOR" ? { proctors: { some: { userId: ctx.userId } } } : {}),
    },
    include: {
      checklistVersion: { include: { template: true } },
      roster: { select: { id: true, finalResult: true, attendance: true } },
      proctors: { include: { user: true } },
    },
    orderBy: { startsAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    classType: row.classType,
    checklistTitle: row.checklistVersion.template.title,
    checklistVersion: row.checklistVersion.version,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    location: row.location,
    status: row.status,
    rosterCount: row.roster.length,
    completeCount: row.roster.filter((item) => item.finalResult !== "PENDING").length,
    proctors: row.proctors.map((item) => item.user.name),
  }));
}

export async function createClass(
  ctx: AuthContext,
  input: {
    title?: string;
    classType?: string;
    checklistVersionId?: string;
    startsAt?: string;
    endsAt?: string | null;
    location?: string;
    notes?: string;
    membershipIds?: string[];
    proctorUserIds?: string[];
  },
) {
  assertPermission(ctx, "classes.write");
  const title = input.title?.trim().slice(0, 180) || "";
  if (!title) throw new HttpError(400, "Class title is required.");
  if (!input.checklistVersionId) throw new HttpError(400, "Choose a published checklist.");
  const classType = input.classType?.trim().toUpperCase() || "GENERAL";
  if (!CLASS_TYPE_VALUES.has(classType)) throw new HttpError(400, "Invalid class type.");
  const version = await prisma.taskBookVersion.findFirst({
    where: { id: input.checklistVersionId, status: "PUBLISHED", template: { departmentId: ctx.departmentId } },
  });
  if (!version) throw new HttpError(404, "Published checklist not found.");
  const memberIds = [...new Set(input.membershipIds || [])];
  const proctorIds = [...new Set(input.proctorUserIds || [])];
  if (memberIds.length === 0) throw new HttpError(400, "Add at least one student to the roster.");
  if (proctorIds.length === 0) throw new HttpError(400, "Assign at least one proctor.");
  const validMembers = await prisma.departmentMembership.findMany({
    where: { id: { in: memberIds }, departmentId: ctx.departmentId, status: "ACTIVE" },
  });
  const validProctors = await prisma.departmentMembership.findMany({
    where: {
      ...approvedEvaluatorWhere(ctx.departmentId),
      userId: { in: proctorIds },
    },
  });
  if (validMembers.length !== memberIds.length) throw new HttpError(400, "One or more roster members are invalid.");
  if (validProctors.length !== proctorIds.length) throw new HttpError(400, "One or more proctors are invalid.");
  const startsAt = parseDate(input.startsAt, "Start date", true)!;
  const endsAt = parseDate(input.endsAt, "End date");
  if (endsAt && endsAt < startsAt) throw new HttpError(400, "End date cannot be before the start date.");

  const created = await prisma.trainingClass.create({
    data: {
      departmentId: ctx.departmentId,
      title,
      classType,
      checklistVersionId: version.id,
      startsAt,
      endsAt,
      location: input.location?.trim().slice(0, 180) || "",
      notes: input.notes?.trim().slice(0, 4000) || "",
      createdById: ctx.userId,
      roster: { create: memberIds.map((membershipId) => ({ membershipId })) },
      proctors: { create: proctorIds.map((userId) => ({ userId })) },
    },
  });
  await writeAudit(ctx, "class.created", "TrainingClass", created.id, {
    title,
    rosterCount: memberIds.length,
    proctorCount: proctorIds.length,
    checklistVersionId: version.id,
  });
  await writeActivity(ctx.departmentId, "CLASS_CREATED", {
    userId: ctx.userId,
    referenceId: created.id,
    metadata: { actorName: ctx.name, title, rosterCount: memberIds.length },
  });
  return getClass(ctx, created.id);
}

export async function getClass(ctx: AuthContext, classId: string) {
  assertPermission(ctx, "classes.read");
  await canAccessClass(ctx, classId);
  const row = await prisma.trainingClass.findUnique({
    where: { id: classId },
    include: {
      checklistVersion: {
        include: {
          template: true,
          sections: { orderBy: { sortOrder: "asc" }, include: { requirements: { orderBy: { sortOrder: "asc" } } } },
        },
      },
      proctors: { include: { user: true } },
      roster: {
        include: {
          membership: { include: { user: true } },
          skillResults: { include: { evaluator: true } },
        },
        orderBy: { membership: { user: { name: "asc" } } },
      },
    },
  });
  if (!row) throw new HttpError(404, "Class not found.");
  return {
    id: row.id,
    title: row.title,
    classType: row.classType,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    location: row.location,
    status: row.status,
    notes: row.notes,
    checklistTitle: row.checklistVersion.template.title,
    checklistVersion: row.checklistVersion.version,
    proctors: row.proctors.map((item) => ({ userId: item.userId, name: item.user.name })),
    sections: row.checklistVersion.sections.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      skills: section.requirements.map((requirement) => ({
        id: requirement.id,
        title: requirement.title,
        description: requirement.description,
        instructions: requirement.instructions,
        required: requirement.isRequired,
        evaluationSteps: parseJsonArray(requirement.evaluationStepsJson),
        criticalFailures: parseJsonArray(requirement.criticalFailuresJson),
      })),
    })),
    roster: row.roster.map((enrollment) => ({
      id: enrollment.id,
      membershipId: enrollment.membershipId,
      name: enrollment.membership.user.name,
      rank: enrollment.membership.rank,
      email: enrollment.membership.user.email,
      attendance: enrollment.attendance,
      writtenScore: enrollment.writtenScore,
      ccfScore: enrollment.ccfScore,
      finalResult: enrollment.finalResult,
      notes: enrollment.notes,
      completedAt: enrollment.completedAt,
      results: enrollment.skillResults.map((result) => ({
        requirementId: result.requirementId,
        result: result.result,
        notes: result.notes,
        stepResults: parseJsonArray(result.stepResultsJson),
        evaluatorName: result.evaluator.name,
        evaluatedAt: result.evaluatedAt,
      })),
    })),
  };
}

async function recalculateEnrollment(enrollmentId: string) {
  const enrollment = await prisma.trainingClassEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      class: { include: { checklistVersion: { include: { sections: { include: { requirements: true } } } } } },
      skillResults: true,
    },
  });
  if (!enrollment) return;
  const required = enrollment.class.checklistVersion.sections.flatMap((section) => section.requirements).filter((item) => item.isRequired);
  const byRequirement = new Map(enrollment.skillResults.map((item) => [item.requirementId, item.result]));
  const values = required.map((item) => byRequirement.get(item.id) || "NOT_EVALUATED");
  const finalResult = values.includes("FAIL")
    ? "FAIL"
    : values.includes("NEEDS_REMEDIATION")
      ? "REMEDIATION"
      : values.every((value) => value === "PASS" || value === "NOT_APPLICABLE")
        ? "PASS"
        : "PENDING";
  await prisma.trainingClassEnrollment.update({
    where: { id: enrollment.id },
    data: { finalResult, completedAt: finalResult === "PENDING" ? null : new Date() },
  });
}

export async function recordSkillResult(
  ctx: AuthContext,
  classId: string,
  enrollmentId: string,
  requirementId: string,
  input: { result?: string; notes?: string; stepResults?: unknown[] },
) {
  assertPermission(ctx, "classes.proctor");
  await assertApprovedEvaluator(ctx);
  const classRow = await canAccessClass(ctx, classId, true);
  if (classRow.status === "COMPLETE" || classRow.status === "CANCELLED") {
    throw new HttpError(409, "This class is closed for check-off.");
  }
  const enrollment = await prisma.trainingClassEnrollment.findFirst({ where: { id: enrollmentId, classId } });
  if (!enrollment) throw new HttpError(404, "Student is not on this class roster.");
  const requirement = await prisma.taskBookRequirement.findFirst({
    where: { id: requirementId, section: { versionId: classRow.checklistVersionId } },
  });
  if (!requirement) throw new HttpError(404, "Skill is not part of this class checklist.");
  const result = input.result?.trim().toUpperCase() || "NOT_EVALUATED";
  if (!RESULT_VALUES.has(result)) throw new HttpError(400, "Invalid skill result.");
  if ((result === "NEEDS_REMEDIATION" || result === "FAIL") && !input.notes?.trim()) {
    throw new HttpError(400, "Explain what the student must correct.");
  }
  const recorded = await prisma.trainingClassSkillResult.upsert({
    where: { enrollmentId_requirementId: { enrollmentId, requirementId } },
    create: {
      enrollmentId,
      requirementId,
      result,
      notes: input.notes?.trim().slice(0, 4000) || "",
      stepResultsJson: JSON.stringify(Array.isArray(input.stepResults) ? input.stepResults : []),
      evaluatorId: ctx.userId,
    },
    update: {
      result,
      notes: input.notes?.trim().slice(0, 4000) || "",
      stepResultsJson: JSON.stringify(Array.isArray(input.stepResults) ? input.stepResults : []),
      evaluatorId: ctx.userId,
      evaluatedAt: new Date(),
    },
  });
  await recalculateEnrollment(enrollment.id);
  await writeAudit(ctx, "class.skill_result.recorded", "TrainingClassSkillResult", recorded.id, {
    classId,
    enrollmentId,
    requirementId,
    result,
  });
  return getClass(ctx, classId);
}

export async function updateEnrollment(
  ctx: AuthContext,
  classId: string,
  enrollmentId: string,
  input: { attendance?: string; writtenScore?: number | null; ccfScore?: number | null; notes?: string },
) {
  assertPermission(ctx, "classes.proctor");
  await assertApprovedEvaluator(ctx);
  await canAccessClass(ctx, classId, true);
  const enrollment = await prisma.trainingClassEnrollment.findFirst({ where: { id: enrollmentId, classId } });
  if (!enrollment) throw new HttpError(404, "Student is not on this class roster.");
  const attendance = input.attendance?.trim().toUpperCase();
  if (attendance && !ATTENDANCE_VALUES.has(attendance)) throw new HttpError(400, "Invalid attendance value.");
  for (const [label, value] of [["Written score", input.writtenScore], ["CCF score", input.ccfScore]] as const) {
    if (value != null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      throw new HttpError(400, `${label} must be between 0 and 100.`);
    }
  }
  await prisma.trainingClassEnrollment.update({
    where: { id: enrollment.id },
    data: {
      ...(attendance ? { attendance } : {}),
      ...(input.writtenScore !== undefined ? { writtenScore: input.writtenScore } : {}),
      ...(input.ccfScore !== undefined ? { ccfScore: input.ccfScore } : {}),
      ...(input.notes !== undefined ? { notes: input.notes.trim().slice(0, 4000) } : {}),
    },
  });
  await writeAudit(ctx, "class.enrollment.updated", "TrainingClassEnrollment", enrollment.id, {
    classId,
    attendance,
    writtenScore: input.writtenScore,
    ccfScore: input.ccfScore,
    notesUpdated: input.notes !== undefined,
  });
  return getClass(ctx, classId);
}

export async function updateClassStatus(ctx: AuthContext, classId: string, statusInput: unknown) {
  assertPermission(ctx, "classes.write");
  await canAccessClass(ctx, classId);
  const status = String(statusInput || "").trim().toUpperCase();
  if (!CLASS_STATUS_VALUES.has(status)) throw new HttpError(400, "Invalid class status.");
  await prisma.trainingClass.update({ where: { id: classId }, data: { status } });
  await writeAudit(ctx, "class.status.updated", "TrainingClass", classId, { status });
  return getClass(ctx, classId);
}
