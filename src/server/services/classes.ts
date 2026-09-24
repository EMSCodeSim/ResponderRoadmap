import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/server/db";
import { normalizeGuestRegistration } from "@/lib/class-registration";
import { canViewClassRecord, classListScope } from "@/lib/class-access";
import { HttpError, writeActivity, writeAudit } from "@/server/http";
import { assertPermission, hasPermission, type AuthContext } from "@/server/permissions";
import { approvedEvaluatorWhere, assertApprovedEvaluator } from "@/server/services/evaluators";

const RESULT_VALUES = new Set(["NOT_EVALUATED", "PASS", "NEEDS_REMEDIATION", "FAIL", "NOT_APPLICABLE"]);
const ATTENDANCE_VALUES = new Set(["REGISTERED", "PRESENT", "ABSENT", "EXCUSED"]);
const CLASS_STATUS_VALUES = new Set(["DRAFT", "ACTIVE", "COMPLETE", "CANCELLED"]);
const CLASS_TYPE_VALUES = new Set(["GENERAL", "FIRE_ACADEMY", "CPR", "EMS"]);
const TRAINING_CATEGORY_VALUES = new Set(["COMPANY", "FACILITY", "HAZMAT", "DRIVER", "OFFICER", "EMS", "OTHER"]);

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
  if (!canViewClassRecord(ctx.role, ctx.userId, row.createdById, row.proctors.map((item) => item.userId))) {
    throw new HttpError(403, "You are not assigned to this class.");
  }
  if (write && !hasPermission(ctx.role, "classes.write") && row.proctors.length === 0) {
    throw new HttpError(403, "You are not assigned as a proctor for this class.");
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
      .filter((membership) => ["INSTRUCTOR", "EVALUATOR", "TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"].includes(membership.role) && membership.evaluatorStatus !== "SUSPENDED")
      .map((membership) => ({ userId: membership.userId, name: membership.user.name, role: membership.role })),
  };
}

export async function listClasses(ctx: AuthContext, filter: { view?: string } = {}) {
  assertPermission(ctx, "classes.read");
  const rows = await prisma.trainingClass.findMany({
    where: {
      departmentId: ctx.departmentId,
      ...classListScope(ctx.role, ctx.userId, filter.view),
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
    trainingCategory: row.trainingCategory,
    creditHours: row.creditHours,
    checklistTitle: row.checklistVersion?.template.title || "Attendance-only training",
    checklistVersion: row.checklistVersion?.version || "",
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
    trainingCategory?: string;
    creditHours?: number;
    startsAt?: string;
    endsAt?: string | null;
    location?: string;
    notes?: string;
    membershipIds?: string[];
    proctorUserIds?: string[];
    selfRegistration?: boolean;
  },
) {
  assertPermission(ctx, "classes.write");
  const title = input.title?.trim().slice(0, 180) || "";
  if (!title) throw new HttpError(400, "Class title is required.");
  const classType = input.classType?.trim().toUpperCase() || "GENERAL";
  if (!CLASS_TYPE_VALUES.has(classType)) throw new HttpError(400, "Invalid class type.");
  const trainingCategory = input.trainingCategory?.trim().toUpperCase() || "COMPANY";
  if (!TRAINING_CATEGORY_VALUES.has(trainingCategory)) throw new HttpError(400, "Invalid training category.");
  const creditHours = Number(input.creditHours ?? 0);
  if (!Number.isFinite(creditHours) || creditHours < 0 || creditHours > 24) throw new HttpError(400, "Credit hours must be between 0 and 24.");
  const version = input.checklistVersionId
    ? await prisma.taskBookVersion.findFirst({
        where: { id: input.checklistVersionId, status: "PUBLISHED", template: { departmentId: ctx.departmentId } },
      })
    : null;
  if (input.checklistVersionId && !version) throw new HttpError(404, "Published checklist not found.");
  const memberIds = [...new Set(input.membershipIds || [])];
  const proctorIds = [...new Set(input.proctorUserIds || [])];
  if (memberIds.length === 0 && input.selfRegistration !== true) throw new HttpError(400, "Add at least one student or enable QR self-registration.");
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
      trainingCategory,
      creditHours,
      checklistVersionId: version?.id || null,
      startsAt,
      endsAt,
      location: input.location?.trim().slice(0, 180) || "",
      notes: input.notes?.trim().slice(0, 4000) || "",
      registrationToken: input.selfRegistration ? randomBytes(32).toString("hex") : null,
      registrationEnabled: input.selfRegistration === true,
      createdById: ctx.userId,
      roster: { create: memberIds.map((membershipId) => ({ membershipId })) },
      proctors: { create: proctorIds.map((userId) => ({ userId })) },
    },
  });
  await writeAudit(ctx, "class.created", "TrainingClass", created.id, {
    title,
    rosterCount: memberIds.length,
    proctorCount: proctorIds.length,
    checklistVersionId: version?.id || null,
    trainingCategory,
    creditHours,
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
        orderBy: { enrolledAt: "asc" },
      },
    },
  });
  if (!row) throw new HttpError(404, "Class not found.");
  return {
    id: row.id,
    title: row.title,
    classType: row.classType,
    trainingCategory: row.trainingCategory,
    creditHours: row.creditHours,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    location: row.location,
    status: row.status,
    notes: row.notes,
    registrationEnabled: row.registrationEnabled,
    registrationToken: hasPermission(ctx.role, "classes.write") ? row.registrationToken : null,
    checklistTitle: row.checklistVersion?.template.title || "Attendance-only training",
    checklistVersion: row.checklistVersion?.version || "",
    proctors: row.proctors.map((item) => ({ userId: item.userId, name: item.user.name })),
    sections: (row.checklistVersion?.sections || []).map((section) => ({
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
      name: enrollment.membership?.user.name || enrollment.guestName || "Unknown student",
      rank: enrollment.membership?.rank || null,
      email: enrollment.membership?.user.email || enrollment.guestEmail || "",
      isGuest: enrollment.membershipId == null,
      organization: enrollment.guestOrganization,
      registeredAt: enrollment.enrolledAt,
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

export async function manageClassRegistration(ctx: AuthContext, classId: string, rawAction: unknown) {
  assertPermission(ctx, "classes.write");
  const row = await canAccessClass(ctx, classId);
  const action = String(rawAction || "").toUpperCase();
  if (!new Set(["OPEN", "CLOSE", "ROTATE"]).has(action)) throw new HttpError(400, "Invalid registration action.");
  if (action !== "CLOSE" && !["DRAFT", "ACTIVE"].includes(row.status)) throw new HttpError(409, "A completed or cancelled class cannot accept registrations.");
  const updated = await prisma.trainingClass.update({
    where: { id: row.id },
    data: action === "CLOSE"
      ? { registrationEnabled: false }
      : { registrationEnabled: true, registrationToken: action === "ROTATE" || !row.registrationToken ? randomBytes(32).toString("hex") : row.registrationToken },
  });
  await writeAudit(ctx, `class.registration.${action.toLowerCase()}`, "TrainingClass", row.id, { enabled: updated.registrationEnabled });
  return getClass(ctx, row.id);
}

async function findRegistrationClass(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HttpError(404, "Registration link not found.");
  const row = await prisma.trainingClass.findUnique({
    where: { registrationToken: token },
    select: { id: true, departmentId: true, title: true, startsAt: true, location: true, status: true, registrationEnabled: true },
  });
  if (!row) throw new HttpError(404, "Registration link not found.");
  return row;
}

export async function getPublicClassRegistration(token: string) {
  const row = await findRegistrationClass(token);
  return { title: row.title, startsAt: row.startsAt, location: row.location, open: row.registrationEnabled && ["DRAFT", "ACTIVE"].includes(row.status) };
}

async function enforceRegistrationRateLimit(token: string, source: string) {
  const windowMs = 15 * 60 * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const key = createHash("sha256").update(`${token}:${source || "unknown"}:${windowStart.toISOString()}`).digest("hex");
  const counter = await prisma.registrationRateLimit.upsert({
    where: { key }, create: { key, windowStart, count: 1 }, update: { count: { increment: 1 } }, select: { count: true },
  });
  if (counter.count > 8) throw new HttpError(429, "Too many registration attempts. Wait a few minutes and try again.");
}

export async function registerGuestStudent(token: string, raw: unknown, source = "unknown") {
  await enforceRegistrationRateLimit(token, source);
  const input = normalizeGuestRegistration(raw);
  const enrollment = await prisma.$transaction(async (tx) => {
    const row = await tx.trainingClass.findUnique({ where: { registrationToken: token }, select: { id: true, departmentId: true, status: true, registrationEnabled: true } });
    if (!row || !/^[a-f0-9]{64}$/.test(token)) throw new HttpError(404, "Registration link not found.");
    if (!row.registrationEnabled || !["DRAFT", "ACTIVE"].includes(row.status)) throw new HttpError(409, "Registration is closed for this class.");
    const rosterCount = await tx.trainingClassEnrollment.count({ where: { classId: row.id } });
    if (rosterCount >= 250) throw new HttpError(409, "Registration is full. Contact the instructor.");
    const existing = await tx.trainingClassEnrollment.findFirst({
      where: { classId: row.id, OR: [{ guestEmail: input.email }, { membership: { user: { email: input.email } } }] }, select: { id: true },
    });
    if (existing) throw new HttpError(409, "This email is already on the class roster.");
    const created = await tx.trainingClassEnrollment.create({ data: { classId: row.id, guestName: input.name, guestEmail: input.email, guestOrganization: input.organization } });
    return { id: created.id, classId: row.id, departmentId: row.departmentId };
  }).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new HttpError(409, "This email is already on the class roster.");
    throw error;
  });
  await writeActivity(enrollment.departmentId, "CLASS_GUEST_REGISTERED", { referenceId: enrollment.classId, metadata: { enrollmentId: enrollment.id, source: "CLASS_QR", accountCreated: false } });
  return { registered: true };
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
  if (!enrollment.class.checklistVersion) {
    await prisma.trainingClassEnrollment.update({ where: { id: enrollment.id }, data: { finalResult: enrollment.attendance === "PRESENT" ? "PASS" : "PENDING", completedAt: enrollment.attendance === "PRESENT" ? new Date() : null } });
    return;
  }
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
  if (!classRow.checklistVersionId) throw new HttpError(409, "This training record does not use a skills checklist.");
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
  await prisma.trainingClass.update({ where: { id: classId }, data: { status, ...(["COMPLETE", "CANCELLED"].includes(status) ? { registrationEnabled: false } : {}) } });
  await writeAudit(ctx, "class.status.updated", "TrainingClass", classId, { status });
  return getClass(ctx, classId);
}
