import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/server/db";
import { normalizeGuestRegistration } from "@/lib/class-registration";
import { canViewClassRecord, classListScope } from "@/lib/class-access";
import { EMS_CE_CATEGORIES } from "@/lib/ems-ce-categories";
import { HttpError, writeActivity, writeAudit } from "@/server/http";
import { assertPermission, hasPermission, type AuthContext } from "@/server/permissions";
import { approvedEvaluatorWhere, assertApprovedEvaluator } from "@/server/services/evaluators";

const RESULT_VALUES = new Set(["NOT_EVALUATED", "PASS", "NEEDS_REMEDIATION", "FAIL", "NOT_APPLICABLE"]);
const ATTENDANCE_VALUES = new Set(["REGISTERED", "PRESENT", "ABSENT", "EXCUSED"]);
const CLASS_STATUS_VALUES = new Set(["DRAFT", "ACTIVE", "COMPLETE", "CANCELLED"]);
const CLASS_TYPE_VALUES = new Set(["GENERAL", "FIRE_ACADEMY", "CPR", "EMS"]);
const EMS_CE_GROUPS = new Set(Object.keys(EMS_CE_CATEGORIES));

function normalizeCeCredits(value: unknown) {
  if (!Array.isArray(value)) return [];
  const totals = new Map<string, number>();
  for (const entry of value) {
    const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const category = String(item.category || "").trim();
    const hours = Number(item.hours ?? 0);
    if (!EMS_CE_GROUPS.has(category)) throw new HttpError(400, "Choose a valid EMS CE category.");
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) throw new HttpError(400, "Each CE category must be between 0 and 24 hours.");
    if (hours > 0) totals.set(category, (totals.get(category) || 0) + hours);
  }
  const allocations = [...totals].map(([category, hours]) => ({ category, hours: Math.round(hours * 100) / 100 }));
  if (allocations.reduce((sum, item) => sum + item.hours, 0) > 24) throw new HttpError(400, "EMS CE credits cannot exceed 24 hours per training sheet.");
  return allocations;
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  try { const parsed = JSON.parse(value || "{}"); return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}; } catch { return {}; }
}

function ceCreditNote(allocations: Array<{category: string;hours: number}>) {
  return allocations.length
    ? "EMS CE CREDIT BREAKDOWN\n" + allocations.map((item) => `${item.category}: ${item.hours.toFixed(2)} hours`).join("\n")
    : "";
}
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


async function getAttendanceOnlyVersion(ctx: AuthContext) {
  const existing = await prisma.taskBookTemplate.findFirst({
    where: {
      departmentId: ctx.departmentId,
      templateKind: "TRAINING_TASK",
      category: "System Attendance",
      title: "Attendance-only training",
    },
    include: { versions: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" } } },
  });
  if (existing?.versions[0]) return existing.versions[0];

  if (existing) {
    return prisma.taskBookVersion.create({
      data: {
        templateId: existing.id,
        version: "1.0",
        status: "PUBLISHED",
        publishedAt: new Date(),
        publishedById: ctx.userId,
      },
    });
  }

  const created = await prisma.taskBookTemplate.create({
    data: {
      departmentId: ctx.departmentId,
      title: "Attendance-only training",
      description: "System record used for digital training sheets without a skills checklist.",
      category: "System Attendance",
      status: "ACTIVE",
      ownerId: ctx.userId,
      intendedPosition: "",
      templateKind: "TRAINING_TASK",
      versions: {
        create: {
          version: "1.0",
          status: "PUBLISHED",
          publishedAt: new Date(),
          publishedById: ctx.userId,
        },
      },
    },
    include: { versions: true },
  });
  const version = created.versions[0];
  if (!version) throw new HttpError(500, "Unable to initialize attendance training record.");
  return version;
}

export async function getClassSetup(ctx: AuthContext) {
  assertPermission(ctx, "classes.write");
  const [versions, memberships, department] = await Promise.all([
    prisma.taskBookVersion.findMany({
      where: { template: { departmentId: ctx.departmentId, templateKind: { not: "TRAINING_TASK" } }, status: "PUBLISHED" },
      include: { template: true, sections: { include: { requirements: true } } },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.departmentMembership.findMany({
      where: { departmentId: ctx.departmentId, status: "ACTIVE" },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.department.findUniqueOrThrow({ where: { id: ctx.departmentId }, select: { trainingSheetRequiredFieldsJson: true } }),
  ]);
  return {
    requiredFields: parseJsonArray(department.trainingSheetRequiredFieldsJson),
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
      email: membership.user.email,
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
    rmsStatus: row.rmsStatus,
    instructorApprovedAt: row.instructorApprovedAt,
    rmsEnteredAt: row.rmsEnteredAt,
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
    trainingSheetTemplateId?: string;
    ceCredits?: Array<{ category: string; hours: number }>;
  },
) {
  assertPermission(ctx, "classes.write");
  const title = input.title?.trim().slice(0, 180) || "";
  if (!title) throw new HttpError(400, "Class title is required.");
  const classType = input.classType?.trim().toUpperCase() || "GENERAL";
  if (!CLASS_TYPE_VALUES.has(classType)) throw new HttpError(400, "Invalid class type.");
  const trainingCategory = input.trainingCategory?.trim().toUpperCase() || "COMPANY";
  if (!TRAINING_CATEGORY_VALUES.has(trainingCategory)) throw new HttpError(400, "Invalid training category.");
  const requestedCreditHours = Number(input.creditHours ?? 0);
  if (!Number.isFinite(requestedCreditHours) || requestedCreditHours < 0 || requestedCreditHours > 24) throw new HttpError(400, "Credit hours must be between 0 and 24.");
  const selectedVersion = input.checklistVersionId
    ? await prisma.taskBookVersion.findFirst({
        where: { id: input.checklistVersionId, status: "PUBLISHED", template: { departmentId: ctx.departmentId } },
      })
    : null;
  if (input.checklistVersionId && !selectedVersion) throw new HttpError(404, "Published checklist not found.");
  const version = selectedVersion || await getAttendanceOnlyVersion(ctx);
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
  // Department RMS fields are verified at instructor closeout, not at class creation.
  // Instructors must be able to start a training sheet before teaching has finished.
  const startsAt = parseDate(input.startsAt, "Start date", true)!;
  const endsAt = parseDate(input.endsAt, "End date");
  if (endsAt && endsAt < startsAt) throw new HttpError(400, "End date cannot be before the start date.");

  const template = input.trainingSheetTemplateId ? await prisma.trainingSheetTemplate.findFirst({ where: { id: input.trainingSheetTemplateId, departmentId: ctx.departmentId, archived: false } }) : null;
  if (input.trainingSheetTemplateId && !template) throw new HttpError(404, "Training sheet template not found.");
  const ceCredits = input.ceCredits === undefined
    ? normalizeCeCredits(JSON.parse(template?.ceCreditsJson || "[]"))
    : normalizeCeCredits(input.ceCredits);
  if (ceCredits.length && trainingCategory !== "EMS") throw new HttpError(400, "EMS CE allocations require the EMS training-hours category.");
  const allocatedHours = ceCredits.reduce((sum, item) => sum + item.hours, 0);
  const creditHours = allocatedHours > 0 ? allocatedHours : requestedCreditHours || template?.creditHours || 0;
  if (!Number.isFinite(creditHours) || creditHours < 0 || creditHours > 24) throw new HttpError(400, "Credit hours must be between 0 and 24.");
  const gradingConfig = parseJsonObject(template?.gradingConfigJson);
  const suppliedNotes = input.notes?.trim().slice(0, 3600) || "";
  const creditNote = ceCreditNote(ceCredits);
  const notes = creditNote && !suppliedNotes.includes("EMS CE CREDIT BREAKDOWN")
    ? [suppliedNotes, creditNote].filter(Boolean).join("\n\n").slice(0, 4000)
    : suppliedNotes;
  const created = await prisma.trainingClass.create({
    data: {
      departmentId: ctx.departmentId,
      title,
      classType,
      trainingCategory,
      creditHours,
      ceCreditsJson: JSON.stringify(ceCredits),
      gradingConfigJson: JSON.stringify(gradingConfig),
      templateName: template?.name || "",
      templateRevision: template?.revision || null,
      checklistVersionId: version.id,
      startsAt,
      endsAt,
      location: input.location?.trim().slice(0, 180) || "",
      notes,
      registrationToken: input.selfRegistration ? randomBytes(32).toString("hex") : null,
      registrationEnabled: input.selfRegistration === true,
      customFieldsJson: template?.customFieldsJson || "[]",
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
    trainingCategory,
    creditHours,
    ceCredits,
  });
  await writeActivity(ctx.departmentId, "CLASS_CREATED", {
    userId: ctx.userId,
    referenceId: created.id,
    metadata: { actorName: ctx.name, title, rosterCount: memberIds.length },
  });
  return getClass(ctx, created.id);
}

/** Add reviewed, existing department members to a class; never create identities from a file. */
export async function importClassRoster(ctx: AuthContext, classId: string, rawIds: unknown) {
  assertPermission(ctx, "classes.write");
  const row = await canAccessClass(ctx, classId, true);
  if (!["DRAFT", "ACTIVE"].includes(row.status)) throw new HttpError(409, "A closed class cannot accept roster imports.");
  if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.length > 200 || rawIds.some((id) => typeof id !== "string"))
    throw new HttpError(400, "Select between 1 and 200 existing department members.");
  const membershipIds = [...new Set(rawIds as string[])];
  const valid = await prisma.departmentMembership.findMany({
    where: { id: { in: membershipIds }, departmentId: ctx.departmentId, status: "ACTIVE" },
    select: { id: true },
  });
  if (valid.length !== membershipIds.length) throw new HttpError(400, "Roster contains an invalid or inactive department member.");
  const result = await prisma.trainingClassEnrollment.createMany({
    data: membershipIds.map((membershipId) => ({ classId, membershipId })),
    skipDuplicates: true,
  });
  await writeAudit(ctx, "class.roster.imported", "TrainingClass", classId, { added: result.count, requested: membershipIds.length });
  return { added: result.count, alreadyEnrolled: membershipIds.length - result.count, classId };
}

/** Instructor-entered guests never become verified department members. */
export async function addManualGuestToClass(ctx: AuthContext, classId: string, input: Record<string, unknown>) {
  assertPermission(ctx, "classes.write");
  const row = await canAccessClass(ctx, classId, true);
  if (!["DRAFT", "ACTIVE"].includes(row.status)) throw new HttpError(409, "Closed training cannot accept students.");
  const name = String(input.name || "").trim().slice(0, 160);
  const email = String(input.email || "").trim().toLowerCase().slice(0, 254);
  const organization = String(input.organization || "").trim().slice(0, 180);
  if (name.length < 2) throw new HttpError(400, "Enter the student's name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid student email.");
  const existing = await prisma.trainingClassEnrollment.findFirst({
    where: { classId, OR: [{ guestEmail: email }, { membership: { user: { email } } }] },
    select: { id: true },
  });
  if (existing) throw new HttpError(409, "This email is already on the class roster.");
  const count = await prisma.trainingClassEnrollment.count({ where: { classId } });
  if (count >= 250) throw new HttpError(409, "Class roster is full.");
  const member = await prisma.departmentMembership.findFirst({
    where: { departmentId: ctx.departmentId, status: "ACTIVE", user: { email } },
    select: { id: true },
  });
  const enrolled = await prisma.trainingClassEnrollment.create({
    data: member ? { classId, membershipId: member.id } : { classId, guestName: name, guestEmail: email, guestOrganization: organization },
  });
  await writeAudit(ctx, "class.roster.manual_added", "TrainingClass", classId,
    { enrollmentId: enrolled.id, existingMember: Boolean(member) });
  return { added: true, matchedMember: Boolean(member) };
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
    ceCredits: normalizeCeCredits(JSON.parse(row.ceCreditsJson || "[]")),
    gradingConfig: parseJsonObject(row.gradingConfigJson),
    templateName: row.templateName,
    templateRevision: row.templateRevision,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    location: row.location,
    status: row.status,
    rmsStatus: row.rmsStatus,
    instructorApprovedAt: row.instructorApprovedAt,
    rmsReference: row.rmsReference,
    rmsEntryNote: row.rmsEntryNote,
    instructorApprovedById: row.instructorApprovedById,
    rmsEnteredAt: row.rmsEnteredAt,
    rmsEnteredById: row.rmsEnteredById,
    notes: row.notes,
    customFields: JSON.parse(row.customFieldsJson || "[]"),
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
      customValues: JSON.parse(enrollment.customValuesJson || "{}"),
      finalResult: enrollment.finalResult,
      notes: enrollment.notes,
      completedAt: enrollment.completedAt,
      results: enrollment.skillResults.map((result) => ({
        id: result.id,
        requirementId: result.requirementId,
        result: result.result,
        notes: result.notes,
        numericScore: result.numericScore,
        stepResults: parseJsonArray(result.stepResultsJson),
        evaluatorName: result.evaluator.name,
        evaluatedAt: result.evaluatedAt,
        updatedAt: result.updatedAt,
      })),
    })),
  };
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function getClassCsvExport(ctx: AuthContext, classId: string) {
  assertPermission(ctx, "classes.read");
  const detail = await getClass(ctx, classId);
  if (detail.status !== "COMPLETE") throw new HttpError(409, "Close Training before exporting the official record.");
  const headers = [
    "Department","Training ID","Training Title","Category","Start","End","Hours","Location",
    "Proctors","Member","Rank","Email","Attendance","Final Result","Completed At",
    "Checklist","Skill","Skill Required","Skill Result","Skill Score","Evaluator","Evaluated At","Skill Notes","Training Notes",
  ];
  const department = await prisma.department.findUnique({ where: { id: ctx.departmentId }, select: { name: true } });
  const rows: string[][] = [];
  for (const member of detail.roster) {
    const results = member.results.length ? member.results : [{ requirementId: "", result: "", numericScore: null, notes: "", evaluatorName: "", evaluatedAt: null }];
    for (const result of results) {
      const skill = detail.sections.flatMap((section) => section.skills).find((item) => item.id === result.requirementId);
      rows.push([
        department?.name || "", detail.id, detail.title, detail.trainingCategory,
        detail.startsAt?.toISOString() || "", detail.endsAt?.toISOString() || "",
        String(detail.creditHours || ""), detail.location || "",
        detail.proctors.map((item) => item.name).join("; "),
        member.name, member.rank || "", member.email, member.attendance, member.finalResult,
        member.completedAt?.toISOString() || "", detail.checklistTitle,
        skill?.title || "", skill?.required ? "YES" : "", result.result || "", result.numericScore == null ? "" : String(result.numericScore),
        result.evaluatorName || "", result.evaluatedAt?.toISOString() || "", result.notes || "", detail.notes || "",
      ]);
    }
  }
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export async function getClassExportRecord(ctx: AuthContext, classId: string) {
  assertPermission(ctx, "classes.read");
  const detail = await getClass(ctx, classId);
  if (detail.status !== "COMPLETE") throw new HttpError(409, "Close Training before exporting the official record.");
  const department = await prisma.department.findUnique({ where: { id: ctx.departmentId }, select: { name: true } });
  return {
    exportVersion: 1,
    generatedAt: new Date().toISOString(),
    department: { name: department?.name || "" },
    training: detail,
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
    const departmentMember = await tx.departmentMembership.findFirst({
      where: { departmentId: row.departmentId, status: "ACTIVE", user: { email: input.email } },
      select: { id: true },
    });
    const created = await tx.trainingClassEnrollment.create({
      data: departmentMember
        ? { classId: row.id, membershipId: departmentMember.id }
        : { classId: row.id, guestName: input.name, guestEmail: input.email, guestOrganization: input.organization },
    });
    return { id: created.id, classId: row.id, departmentId: row.departmentId, matchedMember: Boolean(departmentMember) };
  }).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new HttpError(409, "This email is already on the class roster.");
    throw error;
  });
  await writeActivity(enrollment.departmentId, "CLASS_GUEST_REGISTERED", { referenceId: enrollment.classId, metadata: { enrollmentId: enrollment.id, source: "CLASS_QR", accountCreated: false, matchedDepartmentMember: enrollment.matchedMember } });
  return { registered: true };
}

export async function registerDepartmentMember(ctx: AuthContext, token: string) {
  const row = await findRegistrationClass(token);
  if (row.departmentId !== ctx.departmentId) {
    throw new HttpError(403, "This class belongs to another department.");
  }
  if (!row.registrationEnabled || !["DRAFT", "ACTIVE"].includes(row.status)) {
    throw new HttpError(409, "Registration is closed for this class.");
  }

  const enrollment = await prisma.$transaction(async (tx) => {
    const membership = await tx.departmentMembership.findFirst({
      where: { id: ctx.membershipId, userId: ctx.userId, departmentId: ctx.departmentId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!membership) throw new HttpError(403, "Your active department membership could not be verified.");

    const existing = await tx.trainingClassEnrollment.findFirst({
      where: { classId: row.id, membershipId: membership.id },
      select: { id: true },
    });
    if (existing) return { id: existing.id, alreadyRegistered: true };

    const rosterCount = await tx.trainingClassEnrollment.count({ where: { classId: row.id } });
    if (rosterCount >= 250) throw new HttpError(409, "Registration is full. Contact the instructor.");

    const created = await tx.trainingClassEnrollment.create({
      data: { classId: row.id, membershipId: membership.id },
      select: { id: true },
    });
    return { id: created.id, alreadyRegistered: false };
  }).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return { id: "", alreadyRegistered: true };
    }
    throw error;
  });

  if (!enrollment.alreadyRegistered) {
    await writeActivity(ctx.departmentId, "CLASS_MEMBER_REGISTERED", {
      referenceId: row.id,
      userId: ctx.userId,
      metadata: { enrollmentId: enrollment.id, source: "CLASS_QR_APP", membershipId: ctx.membershipId, memberName: ctx.name },
    });
  }
  return {
    registered: true,
    alreadyRegistered: enrollment.alreadyRegistered,
    classId: row.id,
    title: row.title,
    startsAt: row.startsAt,
    location: row.location,
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
  if (required.length === 0) {
    const attended = enrollment.attendance === "PRESENT";
    await prisma.trainingClassEnrollment.update({
      where: { id: enrollment.id },
      data: { finalResult: attended ? "PASS" : "PENDING", completedAt: attended ? new Date() : null },
    });
    return;
  }
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
  input: { result?: string; notes?: string; stepResults?: unknown[]; numericScore?: number | null },
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
  if (input.numericScore != null && (!Number.isFinite(input.numericScore) || input.numericScore < 0 || input.numericScore > 100)) {
    throw new HttpError(400, "Skill score must be between 0 and 100.");
  }
  const recorded = await prisma.trainingClassSkillResult.upsert({
    where: { enrollmentId_requirementId: { enrollmentId, requirementId } },
    create: {
      enrollmentId,
      requirementId,
      result,
      notes: input.notes?.trim().slice(0, 4000) || "",
      numericScore: input.numericScore ?? null,
      stepResultsJson: JSON.stringify(Array.isArray(input.stepResults) ? input.stepResults : []),
      evaluatorId: ctx.userId,
    },
    update: {
      result,
      notes: input.notes?.trim().slice(0, 4000) || "",
      numericScore: input.numericScore ?? null,
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
    numericScore: input.numericScore ?? null,
  });
  return getClass(ctx, classId);
}

/** Record individually selected results for one skill in a single class-roster submission. */
export async function recordSkillResultsBatch(
  ctx: AuthContext,
  classId: string,
  input: { requirementId?: string; results?: Array<{ enrollmentId?: string; requirementId?: string; result?: string; notes?: string; expectedUpdatedAt?: string | null }> },
) {
  assertPermission(ctx, "classes.proctor");
  await assertApprovedEvaluator(ctx);
  const classRow = await canAccessClass(ctx, classId, true);
  if (classRow.status === "COMPLETE" || classRow.status === "CANCELLED") {
    throw new HttpError(409, "This class is closed for check-off.");
  }
  if (!classRow.checklistVersionId) throw new HttpError(400, "This training record does not use a skills checklist.");
  const results = Array.isArray(input.results) ? input.results : [];
  if (results.length < 1 || results.length > 200) throw new HttpError(400, "Submit between 1 and 200 individual results.");
  const rows = results.map((item) => {
    const enrollmentId = String(item.enrollmentId || "");
    const requirementId = String(item.requirementId || input.requirementId || "");
    const result = String(item.result || "").trim().toUpperCase();
    const notes = String(item.notes || "").trim().slice(0, 4000);
    if (!enrollmentId || !requirementId) throw new HttpError(400, "Each result needs a student and skill.");
    if (!["PASS", "FAIL", "NEEDS_REMEDIATION"].includes(result)) throw new HttpError(400, "Choose a valid observed result for each selected skill.");
    if ((result === "FAIL" || result === "NEEDS_REMEDIATION") && !notes) throw new HttpError(400, "Add correction notes for each failed or remediation result.");
    const expectedUpdatedAt = item.expectedUpdatedAt;
    if (expectedUpdatedAt !== undefined && expectedUpdatedAt !== null &&
        (!Number.isFinite(Date.parse(expectedUpdatedAt)) || new Date(expectedUpdatedAt).toISOString() !== expectedUpdatedAt)) {
      throw new HttpError(400, "Invalid expectedUpdatedAt revision timestamp.");
    }
    return { enrollmentId, requirementId, result, notes, expectedUpdatedAt };
  });
  const resultKeys = rows.map((item) => `${item.enrollmentId}:${item.requirementId}`);
  if (new Set(resultKeys).size !== resultKeys.length) throw new HttpError(400, "A student and skill can appear only once in this submission.");
  const enrollmentIds = [...new Set(rows.map((item) => item.enrollmentId))];
  const requirementIds = [...new Set(rows.map((item) => item.requirementId))];
  const requirements = await prisma.taskBookRequirement.findMany({
    where: { id: { in: requirementIds }, section: { versionId: classRow.checklistVersionId } },
    select: { id: true },
  });
  if (requirements.length !== requirementIds.length) throw new HttpError(404, "One or more skills are not part of this class checklist.");
  const enrollments = await prisma.trainingClassEnrollment.findMany({
    where: { id: { in: enrollmentIds }, classId },
    select: { id: true, attendance: true },
  });
  if (enrollments.length !== enrollmentIds.length) throw new HttpError(404, "One or more students are not on this class roster.");
  if (enrollments.some((item) => item.attendance !== "PRESENT")) {
    throw new HttpError(400, "Confirm each selected student as present before recording skill results.");
  }
  // When a client supplies an observed revision, enforce it atomically in the
  // same transaction as the other students. One conflict rejects the entire batch.
  // Legacy callers without a revision remain compatible during migration.
  await prisma.$transaction(async (tx) => {
    for (const item of rows) {
      const where = { enrollmentId_requirementId: { enrollmentId: item.enrollmentId, requirementId: item.requirementId } };
      const update = {
        result: item.result, notes: item.notes, numericScore: null,
        stepResultsJson: "[]", evaluatorId: ctx.userId, evaluatedAt: new Date(),
      };
      if (item.expectedUpdatedAt !== undefined) {
        const existing = await tx.trainingClassSkillResult.findUnique({
          where, select: { id: true, updatedAt: true },
        });
        if (item.expectedUpdatedAt === null) {
          if (existing) throw new HttpError(409, "Skill result changed. Refresh the roster before submitting.");
          await tx.trainingClassSkillResult.create({
            data: { enrollmentId: item.enrollmentId, requirementId: item.requirementId,
              result: item.result, notes: item.notes, evaluatorId: ctx.userId },
          });
        } else {
          if (!existing) throw new HttpError(409, "Skill result changed. Refresh the roster before submitting.");
          const changed = await tx.trainingClassSkillResult.updateMany({
            where: { id: existing.id, updatedAt: new Date(item.expectedUpdatedAt) },
            data: update,
          });
          if (changed.count !== 1) throw new HttpError(409, "Skill result changed. Refresh the roster before submitting.");
        }
      } else {
        // Older clients cannot provide a revision. Permit first-time grading,
        // but never allow an unversioned batch to replace recorded evidence.
        const existing = await tx.trainingClassSkillResult.findUnique({
          where, select: { id: true },
        });
        if (existing) throw new HttpError(409, "This skill already has an evaluation. Refresh and resubmit with its revision.");
        await tx.trainingClassSkillResult.create({
          data: { enrollmentId: item.enrollmentId, requirementId: item.requirementId,
            result: item.result, notes: item.notes, evaluatorId: ctx.userId },
        });
      }
    }
  });
  await Promise.all([...new Set(enrollmentIds)].map((id) => recalculateEnrollment(id)));
  await writeAudit(ctx, "class.skill_result.batch_recorded", "TrainingClass", classId, {
    resultCount: rows.length,
    passedCount: rows.filter((item) => item.result === "PASS").length,
    failedCount: rows.filter((item) => item.result === "FAIL").length,
    remediationCount: rows.filter((item) => item.result === "NEEDS_REMEDIATION").length,
    results: rows.map(({ enrollmentId, requirementId, result }) => ({ enrollmentId, requirementId, result })),
  });
  return getClass(ctx, classId);
}

export async function updateEnrollment(
  ctx: AuthContext,
  classId: string,
  enrollmentId: string,
  input: { attendance?: string; writtenScore?: number | null; ccfScore?: number | null; notes?: string; customValues?: Record<string, unknown> },
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
  const classRow = await prisma.trainingClass.findUniqueOrThrow({ where: { id: classId }, select: { customFieldsJson: true } });
  const fields = JSON.parse(classRow.customFieldsJson || "[]") as Array<{ id: string; type: string }>;
  const values: Record<string, string | number | boolean | null> = {};
  if (input.customValues !== undefined) {
    if (!input.customValues || typeof input.customValues !== "object" || Array.isArray(input.customValues)) throw new HttpError(400, "Invalid custom values.");
    for (const field of fields) {
      const value = input.customValues[field.id];
      if (value == null || value === "") { values[field.id] = null; continue; }
      if (field.type === "NUMBER" || field.type === "PERCENT") {
        const number = Number(value);
        if (!Number.isFinite(number) || (field.type === "PERCENT" && (number < 0 || number > 100))) throw new HttpError(400, "Invalid numeric field value.");
        values[field.id] = number;
      } else if (field.type === "CHECKBOX") values[field.id] = value === true;
      else values[field.id] = String(value).slice(0, 500);
    }
  }
  await prisma.trainingClassEnrollment.update({
    where: { id: enrollment.id },
    data: {
      ...(attendance ? { attendance } : {}),
      ...(input.writtenScore !== undefined ? { writtenScore: input.writtenScore } : {}),
      ...(input.ccfScore !== undefined ? { ccfScore: input.ccfScore } : {}),
      ...(input.notes !== undefined ? { notes: input.notes.trim().slice(0, 4000) } : {}),
      ...(input.customValues !== undefined ? { customValuesJson: JSON.stringify(values) } : {}),
    },
  });
  await writeAudit(ctx, "class.enrollment.updated", "TrainingClassEnrollment", enrollment.id, {
    classId,
    attendance,
    writtenScore: input.writtenScore,
    ccfScore: input.ccfScore,
    notesUpdated: input.notes !== undefined,
  });
  await recalculateEnrollment(enrollment.id);
  return getClass(ctx, classId);
}

export async function validateClassClosure(ctx: AuthContext, classId: string) {
  assertPermission(ctx, "classes.write");
  await canAccessClass(ctx, classId);
  const row = await prisma.trainingClass.findUnique({
    where: { id: classId },
    include: {
      department: { select: { trainingSheetRequiredFieldsJson: true } },
      checklistVersion: { include: { sections: { include: { requirements: true } } } },
      roster: { include: { skillResults: true } },
      proctors: true,
    },
  });
  if (!row) throw new HttpError(404, "Class not found.");

  const requiredFields = new Set(parseJsonArray(row.department.trainingSheetRequiredFieldsJson).map((item) => String(item).toUpperCase()));
  const missing: Array<{ code: string; message: string; action: string }> = [];
  const gradingConfig = parseJsonObject(row.gradingConfigJson);
  const add = (code: string, message: string, action: string) => missing.push({ code, message, action });

  if (requiredFields.has("TITLE") && !row.title.trim()) add("TITLE", "Training title is missing.", "Edit the training title.");
  if (requiredFields.has("DATE") && !row.startsAt) add("DATE", "Training date/time is missing.", "Set the training date and time.");
  if (requiredFields.has("END_TIME") && !row.endsAt) add("END_TIME", "Training end time is missing.", "Set the training end time.");
  if (requiredFields.has("INSTRUCTOR") && row.proctors.length === 0) add("INSTRUCTOR", "No instructor/proctor is assigned.", "Assign at least one approved instructor or proctor.");
  if (requiredFields.has("CATEGORY") && !row.trainingCategory.trim()) add("CATEGORY", "Training category is missing.", "Choose a training category.");
  if (requiredFields.has("LOCATION") && !row.location.trim()) add("LOCATION", "Training location is missing.", "Enter the training location.");
  if (requiredFields.has("DESCRIPTION") && !row.notes.trim()) add("DESCRIPTION", "Training description / notes are missing.", "Enter the required training description or notes.");
  if (requiredFields.has("HOURS") && !(row.creditHours > 0 || (row.startsAt && row.endsAt))) {
    add("HOURS", "Training hours are missing.", "Enter credit hours or both start and end times.");
  }
  const customFields = JSON.parse(row.customFieldsJson || "[]") as Array<{ id: string; label: string; required: boolean }>;
  for (const field of customFields.filter((item) => item.required)) {
    for (const enrollment of row.roster.filter((item) => item.attendance === "PRESENT")) {
      const values = JSON.parse(enrollment.customValuesJson || "{}") as Record<string, unknown>;
      if (values[field.id] === undefined || values[field.id] === null || values[field.id] === "") {
        add("CUSTOM_FIELD", `Required field "${field.label}" is missing for a student.`, "Enter the required student result before finalizing.");
      }
    }
  }
  if (row.roster.length === 0) add("ROSTER", "The roster is empty.", "Add at least one person to the training roster.");

  const unresolvedAttendance = row.roster.filter((item) => item.attendance === "REGISTERED");
  if (unresolvedAttendance.length) {
    add("ATTENDANCE", `${unresolvedAttendance.length} roster member${unresolvedAttendance.length === 1 ? "" : "s"} still need attendance confirmed.`, "Mark each roster member Present, Absent, or Excused.");
  }

  for (const enrollment of row.roster.filter((item) => item.attendance === "PRESENT")) {
    if (gradingConfig.writtenTestEnabled === true) {
      if (enrollment.writtenScore == null) add("WRITTEN_TEST", "A written test score is missing for a present student.", "Record the written test score before closing.");
      else if (gradingConfig.writtenTestPassPercent != null && enrollment.writtenScore < Number(gradingConfig.writtenTestPassPercent)) add("WRITTEN_TEST", "A written test score is below the template pass mark.", "Review the result and complete remediation or record a passing score.");
    }
    if (gradingConfig.ccfEnabled === true) {
      if (enrollment.ccfScore == null) add("CCF_SCORE", "A CCF score is missing for a present student.", "Record the CCF score before closing.");
      else if (gradingConfig.ccfPassPercent != null && enrollment.ccfScore < Number(gradingConfig.ccfPassPercent)) add("CCF_SCORE", "A CCF score is below the template pass mark.", "Review the result and complete remediation or record a passing score.");
    }
  }

  const requiredIds = row.checklistVersion?.sections.flatMap((section) =>
    section.requirements.filter((item) => item.isRequired).map((item) => item.id),
  ) || [];
  const incompleteSkills = row.roster.filter((item) =>
    item.attendance === "PRESENT" &&
    requiredIds.some((id) => !item.skillResults.some((result) => result.requirementId === id && result.result !== "NOT_EVALUATED")),
  );
  if (incompleteSkills.length) {
    add("REQUIRED_SKILLS", `${incompleteSkills.length} present member${incompleteSkills.length === 1 ? "" : "s"} still need required skill results.`, "Finish required skill evaluations for each present member.");
  }

  return { canClose: missing.length === 0, missing };
}

/**
 * Save the final instructor narrative, actual times and RMS-ready metadata.
 * Department-required fields are checked by validateClassClosure at approval,
 * not when the instructor starts the sheet.
 */
export async function updateClassDocumentation(
  ctx: AuthContext,
  classId: string,
  input: { startsAt?: string; endsAt?: string | null; notes?: string; location?: string; creditHours?: number },
) {
  assertPermission(ctx, "classes.write");
  const row = await canAccessClass(ctx, classId, true);
  if (row.status === "COMPLETE" || row.status === "CANCELLED" || row.rmsStatus !== "NOT_READY") {
    throw new HttpError(409, "This Training Sheet is already closed. Use the authorized correction process.");
  }
  const startsAt = input.startsAt === undefined ? row.startsAt : parseDate(input.startsAt, "Training start time", true)!;
  const endsAt = input.endsAt === undefined ? row.endsAt : parseDate(input.endsAt, "Training end time");
  if (endsAt && endsAt < startsAt) throw new HttpError(400, "Training end time cannot be before the start time.");
  const creditHours = input.creditHours === undefined ? row.creditHours : Number(input.creditHours);
  if (!Number.isFinite(creditHours) || creditHours < 0 || creditHours > 24) {
    throw new HttpError(400, "Credit hours must be between 0 and 24.");
  }
  await prisma.trainingClass.update({
    where: { id: classId },
    data: {
      startsAt, endsAt, creditHours,
      ...(input.location === undefined ? {} : { location: String(input.location).trim().slice(0, 180) }),
      ...(input.notes === undefined ? {} : { notes: String(input.notes).trim().slice(0, 4000) }),
    },
  });
  await writeAudit(ctx, "training_sheet.documentation.updated", "TrainingClass", classId, {
    hasEndTime: Boolean(endsAt), hasNarrative: Boolean(input.notes === undefined ? row.notes : input.notes?.trim()),
  });
  return getClass(ctx, classId);
}

export async function updateClassStatus(ctx: AuthContext, classId: string, statusInput: unknown) {
  assertPermission(ctx, "classes.write");
  await canAccessClass(ctx, classId);
  const status = String(statusInput || "").trim().toUpperCase();
  if (!CLASS_STATUS_VALUES.has(status)) throw new HttpError(400, "Invalid class status.");
  if (status === "COMPLETE") {
    const validation = await validateClassClosure(ctx, classId);
    if (!validation.canClose) {
      throw new HttpError(409, validation.missing.map((item) => item.message).join(" "));
    }
  }
  await prisma.trainingClass.update({ where: { id: classId }, data: { status, ...(["COMPLETE", "CANCELLED"].includes(status) ? { registrationEnabled: false } : {}) } });
  await writeAudit(ctx, "class.status.updated", "TrainingClass", classId, { status });
  return getClass(ctx, classId);
}


export async function approveTrainingSheet(ctx: AuthContext, classId: string) {
  assertPermission(ctx, "classes.write");
  const row = await canAccessClass(ctx, classId, true);
  if (row.status === "CANCELLED" || row.rmsStatus === "RMS_ENTERED") throw new HttpError(409, "This Training Sheet cannot be approved for RMS entry.");
  if (row.rmsStatus === "AWAITING_ENTRY") return getClass(ctx, classId);
  const validation = await validateClassClosure(ctx, classId);
  if (!validation.canClose) throw new HttpError(409, validation.missing.map((item) => item.message).join(" "));
  await prisma.trainingClass.update({ where: { id: classId }, data: { status: "COMPLETE", rmsStatus: "AWAITING_ENTRY", instructorApprovedAt: new Date(), instructorApprovedById: ctx.userId, registrationEnabled: false } });
  await writeAudit(ctx, "training_sheet.instructor_approved", "TrainingClass", classId, { status: "COMPLETE", rmsStatus: "AWAITING_ENTRY" });
  return getClass(ctx, classId);
}

export async function markClassEnteredIntoRms(ctx: AuthContext, classId: string, input: { reference?: string; note?: string }) {
  assertPermission(ctx, "classes.write");
  const row = await canAccessClass(ctx, classId, true);
  if (row.rmsStatus === "RMS_ENTERED") return getClass(ctx, classId);
  if (row.rmsStatus !== "AWAITING_ENTRY") throw new HttpError(409, "Training Sheet is not awaiting RMS entry.");
  const reference = input.reference?.trim().slice(0, 180) || null;
  const note = input.note?.trim().slice(0, 4000) || "";
  await prisma.trainingClass.update({ where: { id: classId }, data: { rmsStatus: "RMS_ENTERED", rmsEnteredAt: new Date(), rmsEnteredById: ctx.userId, rmsReference: reference, rmsEntryNote: note } });
  await writeAudit(ctx, "training_sheet.rms_entered", "TrainingClass", classId, { reference });
  return getClass(ctx, classId);
}

/** The creating instructor owns follow-up until RMS entry is confirmed.
 * This deliberately includes draft, active, closed and approved training sheets.
 * The existing RMS action queue remains a distinct officer workflow.
 */
export async function listInstructorTrainingAttention(ctx: AuthContext) {
  assertPermission(ctx, "classes.read");
  const rows = await prisma.trainingClass.findMany({
    where: {
      departmentId: ctx.departmentId,
      OR: [{ createdById: ctx.userId }, { proctors: { some: { userId: ctx.userId } } }],
      rmsStatus: { not: "RMS_ENTERED" },
      status: { not: "CANCELLED" },
    },
    orderBy: { startsAt: "desc" },
    select: {
      id: true, title: true, status: true, rmsStatus: true,
      startsAt: true, instructorApprovedAt: true,
    },
  });
  return rows;
}

export async function listRmsActionQueue(ctx: AuthContext) {
  assertPermission(ctx, "classes.read");
  return prisma.trainingClass.findMany({ where: { departmentId: ctx.departmentId, status: "COMPLETE", rmsStatus: "AWAITING_ENTRY" }, orderBy: { startsAt: "desc" }, select: { id: true, title: true, startsAt: true, trainingCategory: true, creditHours: true, status: true, rmsStatus: true, instructorApprovedAt: true } });
}
