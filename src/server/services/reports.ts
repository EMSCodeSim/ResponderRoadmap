import { prisma } from "@/server/db";
import { assertPermission, type AuthContext } from "@/server/permissions";
import { computeAssignmentProgress } from "@/lib/progress";
import { credentialStatus } from "@/lib/dates";
import { parseMetadata } from "@/server/http";

export async function taskBookProgressReport(
  ctx: AuthContext,
  filters: { templateId?: string; memberId?: string; station?: string; shift?: string; rank?: string; status?: string } = {},
) {
  assertPermission(ctx, "reports.read");
  const assignments = await prisma.taskBookAssignment.findMany({
    where: {
      departmentId: ctx.departmentId,
      ...(filters.templateId ? { version: { templateId: filters.templateId } } : {}),
      ...(filters.memberId ? { membershipId: filters.memberId } : {}),
      membership: {
        ...(filters.station ? { station: filters.station } : {}),
        ...(filters.shift ? { shift: filters.shift } : {}),
        ...(filters.rank ? { rank: filters.rank } : {}),
      },
    },
    include: {
      membership: { include: { user: true } },
      version: { include: { template: true, sections: { include: { requirements: true } } } },
      completions: true,
    },
    orderBy: { assignedDate: "desc" },
  });

  const rows = assignments.map((assignment) => {
    const progress = computeAssignmentProgress({
      requirements: assignment.version.sections.flatMap((section) => section.requirements),
      completions: assignment.completions,
      assignedDate: assignment.assignedDate,
      dueDate: assignment.dueDate,
    });
    return {
      memberName: assignment.membership.user.name,
      memberId: assignment.membershipId,
      rank: assignment.membership.rank,
      station: assignment.membership.station,
      shift: assignment.membership.shift,
      taskBook: assignment.version.template.title,
      version: assignment.version.version,
      percent: progress.percent,
      complete: progress.complete,
      totalRequired: progress.totalRequired,
      pendingApproval: progress.pendingApproval,
      overdue: progress.overdue,
      status: progress.status,
      dueDate: assignment.dueDate,
    };
  });

  return filters.status ? rows.filter((row) => row.status === filters.status) : rows;
}

export async function certificationReport(
  ctx: AuthContext,
  filters: { credential?: string; window?: string; station?: string; shift?: string; memberId?: string } = {},
) {
  assertPermission(ctx, "reports.read");
  const { listCredentials } = await import("@/server/services/credentials");
  const { credentials } = await listCredentials(ctx, filters);
  return credentials;
}

export async function memberTrainingRecord(ctx: AuthContext, membershipId: string) {
  assertPermission(ctx, "reports.read");
  const membership = await prisma.departmentMembership.findFirst({
    where: { id: membershipId, departmentId: ctx.departmentId },
    include: { user: true },
  });
  if (!membership) return [];
  const events = await prisma.activityEvent.findMany({
    where: { departmentId: ctx.departmentId, userId: membership.userId },
    include: { user: true },
    orderBy: { timestamp: "desc" },
  });
  const signOffs = await prisma.signOff.findMany({
    where: { completion: { membershipId, assignment: { departmentId: ctx.departmentId } } },
    include: { evaluator: true, completion: { include: { requirement: true } } },
    orderBy: { signedAt: "desc" },
  });
  const credentials = await prisma.credential.findMany({
    where: { membershipId, departmentId: ctx.departmentId },
  });

  const timeline = [
    ...events.map((event) => ({
      at: event.timestamp,
      kind: "activity" as const,
      title: event.type,
      detail: JSON.stringify(parseMetadata(event.metadataJson)),
      metadata: parseMetadata(event.metadataJson),
    })),
    ...signOffs.map((sign) => ({
      at: sign.signedAt,
      kind: "signoff" as const,
      title: `${sign.result === "APPROVED" ? "Signed" : "Returned"} ${sign.completion.requirement.title}`,
      detail: sign.notes,
      metadata: { evaluator: sign.evaluator.name, result: sign.result },
    })),
    ...credentials.map((credential) => ({
      at: credential.updatedAt,
      kind: "credential" as const,
      title: credential.credentialName,
      detail: credential.issuer,
      metadata: { expirationDate: credential.expirationDate },
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return { memberName: membership.user.name, timeline };
}

export async function complianceSnapshot(ctx: AuthContext) {
  assertPermission(ctx, "reports.read");
  const members = await prisma.departmentMembership.count({
    where: { departmentId: ctx.departmentId, status: "ACTIVE" },
  });
  const types = ["EMT", "CPR", "ACLS", "Firefighter I", "HazMat Operations"];
  const credentials = await prisma.credential.findMany({
    where: { departmentId: ctx.departmentId, membership: { status: "ACTIVE" } },
  });
  const byName = (name: string) => {
    const records = credentials.filter((item) => item.credentialName === name);
    const current = records.filter((item) => credentialStatus(item.expirationDate, undefined, item.doesNotExpire).health === "current").length;
    return { name, current, total: members };
  };
  const expiring = credentials.filter((item) => credentialStatus(item.expirationDate, undefined, item.doesNotExpire).health === "expiring").length;
  const expired = credentials.filter((item) => credentialStatus(item.expirationDate, undefined, item.doesNotExpire).health === "expired").length;
  return {
    members,
    credentials: types.map(byName),
    expiringWithin60: expiring,
    expired,
  };
}


function trainingBatchKey(input: { versionId: string; assignedById: string; assignedDate: Date; dueDate: Date | null }) {
  return [
    input.versionId,
    input.assignedById,
    input.assignedDate.toISOString(),
    input.dueDate?.toISOString() || "no-due-date",
  ].join("|");
}

export async function listTrainingSheetBatches(ctx: AuthContext) {
  assertPermission(ctx, "reports.read");
  const assignments = await prisma.taskBookAssignment.findMany({
    where: {
      departmentId: ctx.departmentId,
      version: { template: { templateKind: "TRAINING_TASK" } },
    },
    include: {
      assignedBy: true,
      membership: { include: { user: true } },
      version: { include: { template: true, sections: { include: { requirements: true } } } },
      completions: true,
    },
    orderBy: { assignedDate: "desc" },
  });

  const groups = new Map<string, {
    id: string;
    title: string;
    assignedDate: Date;
    dueDate: Date | null;
    assignedByName: string;
    assigned: number;
    completed: number;
    awaitingEvaluation: number;
    incomplete: number;
    reportReady: boolean;
  }>();

  for (const assignment of assignments) {
    const progress = computeAssignmentProgress({
      requirements: assignment.version.sections.flatMap((section) => section.requirements),
      completions: assignment.completions,
      assignedDate: assignment.assignedDate,
      dueDate: assignment.dueDate,
    });
    const key = trainingBatchKey(assignment);
    const existing = groups.get(key);
    const complete = progress.status === "COMPLETE";
    if (!existing) {
      groups.set(key, {
        id: assignment.id,
        title: assignment.version.template.title,
        assignedDate: assignment.assignedDate,
        dueDate: assignment.dueDate,
        assignedByName: assignment.assignedBy.name,
        assigned: 1,
        completed: complete ? 1 : 0,
        awaitingEvaluation: progress.pendingApproval > 0 ? 1 : 0,
        incomplete: complete ? 0 : 1,
        reportReady: complete || Boolean(assignment.dueDate && assignment.dueDate.getTime() <= Date.now()),
      });
    } else {
      existing.assigned += 1;
      existing.completed += complete ? 1 : 0;
      existing.awaitingEvaluation += progress.pendingApproval > 0 ? 1 : 0;
      existing.incomplete += complete ? 0 : 1;
      existing.reportReady =
        existing.reportReady ||
        complete ||
        Boolean(assignment.dueDate && assignment.dueDate.getTime() <= Date.now());
    }
  }

  return [...groups.values()].sort((a, b) => b.assignedDate.getTime() - a.assignedDate.getTime());
}

export async function trainingSheetReport(ctx: AuthContext, assignmentId: string) {
  assertPermission(ctx, "reports.read");
  const anchor = await prisma.taskBookAssignment.findFirst({
    where: { id: assignmentId, departmentId: ctx.departmentId },
    include: {
      department: true,
      assignedBy: true,
      version: { include: { template: true } },
    },
  });
  if (!anchor) throw new Error("Training assignment not found.");

  const assignments = await prisma.taskBookAssignment.findMany({
    where: {
      departmentId: ctx.departmentId,
      versionId: anchor.versionId,
      assignedById: anchor.assignedById,
      assignedDate: anchor.assignedDate,
      dueDate: anchor.dueDate,
    },
    include: {
      membership: { include: { user: true } },
      evaluator: true,
      supervisor: true,
      version: { include: { template: true, sections: { include: { requirements: true } } } },
      completions: {
        include: {
          signOffs: { include: { evaluator: true }, orderBy: { signedAt: "asc" } },
        },
      },
    },
    orderBy: { membership: { user: { name: "asc" } } },
  });

  const rows = assignments.map((assignment) => {
    const requirements = assignment.version.sections.flatMap((section) => section.requirements);
    const progress = computeAssignmentProgress({
      requirements,
      completions: assignment.completions,
      assignedDate: assignment.assignedDate,
      dueDate: assignment.dueDate,
    });
    const completedAtCandidates = assignment.completions.flatMap((completion) => [
      completion.completedAt,
      ...completion.signOffs.filter((sign) => sign.result === "APPROVED").map((sign) => sign.signedAt),
    ]).filter((value): value is Date => Boolean(value));
    const completedAt =
      progress.status === "COMPLETE" && completedAtCandidates.length
        ? new Date(Math.max(...completedAtCandidates.map((value) => value.getTime())))
        : null;
    const approvers = [...new Set(
      assignment.completions.flatMap((completion) =>
        completion.signOffs
          .filter((sign) => sign.result === "APPROVED")
          .map((sign) => sign.evaluator.name),
      ),
    )];
    const hours = assignment.completions.reduce((sum, completion) => sum + completion.hoursLogged, 0);
    const ready = progress.status === "COMPLETE";
    const statusLabel = ready
      ? "Ready for RMS"
      : progress.pendingApproval > 0
        ? "Evaluation pending"
        : progress.status === "OVERDUE"
          ? "Incomplete — overdue"
          : "Incomplete";

    return {
      assignmentId: assignment.id,
      memberId: assignment.membershipId,
      memberName: assignment.membership.user.name,
      rank: assignment.membership.rank,
      station: assignment.membership.station,
      shift: assignment.membership.shift,
      status: progress.status,
      statusLabel,
      readyForRms: ready,
      percent: progress.percent,
      complete: progress.complete,
      totalRequired: progress.totalRequired,
      pendingApproval: progress.pendingApproval,
      overdue: progress.overdue,
      completedAt,
      hours,
      approvedBy: approvers,
      evaluatorName: assignment.evaluator?.name ?? null,
      supervisorName: assignment.supervisor?.name ?? null,
      notes: assignment.notes,
    };
  });

  const completed = rows.filter((row) => row.readyForRms).length;
  const reportReady = rows.every((row) => row.readyForRms) || Boolean(anchor.dueDate && anchor.dueDate.getTime() <= Date.now());

  return {
    generatedAt: new Date(),
    reportReady,
    windowStatus: reportReady ? "Training window closed or all members complete" : "Training window still open",
    department: {
      name: anchor.department.name,
      city: anchor.department.city,
      state: anchor.department.state,
    },
    training: {
      title: anchor.version.template.title,
      version: anchor.version.version,
      assignedDate: anchor.assignedDate,
      dueDate: anchor.dueDate,
      assignedByName: anchor.assignedBy.name,
      notes: anchor.notes,
    },
    summary: {
      assigned: rows.length,
      completed,
      incomplete: rows.length - completed,
      awaitingEvaluation: rows.filter((row) => row.pendingApproval > 0).length,
    },
    rows,
  };
}


const TRAINING_HOUR_CATEGORIES = ["COMPANY", "FACILITY", "HAZMAT", "DRIVER", "OFFICER", "EMS", "OTHER"] as const;

export async function trainingHoursReport(ctx: AuthContext, rawYear?: string) {
  assertPermission(ctx, "reports.read");
  const now = new Date();
  const parsedYear = Number(rawYear || now.getFullYear());
  const year = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : now.getFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const classes = await prisma.trainingClass.findMany({
    where: {
      departmentId: ctx.departmentId,
      status: "COMPLETE",
      startsAt: { gte: start, lt: end },
    },
    include: {
      createdBy: true,
      proctors: { include: { user: true } },
      roster: {
        where: { attendance: "PRESENT", membershipId: { not: null } },
        include: { membership: { include: { user: true } } },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  const categoryTotals: Record<string, number> = Object.fromEntries(TRAINING_HOUR_CATEGORIES.map((category) => [category, 0]));
  const members = new Map<string, {
    memberId: string;
    memberName: string;
    rank: string | null;
    station: string | null;
    shift: string | null;
    totalHours: number;
    categories: Record<string, number>;
  }>();
  const records: Array<{
    classId: string;
    date: Date;
    title: string;
    category: string;
    hours: number;
    memberId: string;
    memberName: string;
    instructor: string;
  }> = [];

  for (const training of classes) {
    const fallbackHours = training.endsAt
      ? Math.max(0, (training.endsAt.getTime() - training.startsAt.getTime()) / 3_600_000)
      : 0;
    const hours = training.creditHours > 0 ? training.creditHours : Math.round(fallbackHours * 100) / 100;
    if (hours <= 0) continue;
    const category = TRAINING_HOUR_CATEGORIES.includes(training.trainingCategory as typeof TRAINING_HOUR_CATEGORIES[number])
      ? training.trainingCategory
      : "OTHER";
    const instructor = training.proctors.map((item) => item.user.name).join(", ") || training.createdBy.name;

    for (const enrollment of training.roster) {
      if (!enrollment.membership) continue;
      categoryTotals[category] = (categoryTotals[category] || 0) + hours;
      const current = members.get(enrollment.membershipId!) || {
        memberId: enrollment.membershipId!,
        memberName: enrollment.membership.user.name,
        rank: enrollment.membership.rank,
        station: enrollment.membership.station,
        shift: enrollment.membership.shift,
        totalHours: 0,
        categories: Object.fromEntries(TRAINING_HOUR_CATEGORIES.map((item) => [item, 0])),
      };
      current.totalHours += hours;
      current.categories[category] = (current.categories[category] || 0) + hours;
      members.set(current.memberId, current);
      records.push({
        classId: training.id,
        date: training.startsAt,
        title: training.title,
        category,
        hours,
        memberId: current.memberId,
        memberName: current.memberName,
        instructor,
      });
    }
  }

  const round = (value: number) => Math.round(value * 100) / 100;
  const roundedCategories = Object.fromEntries(Object.entries(categoryTotals).map(([key, value]) => [key, round(value)]));
  const memberRows = [...members.values()]
    .map((member) => ({
      ...member,
      totalHours: round(member.totalHours),
      categories: Object.fromEntries(Object.entries(member.categories).map(([key, value]) => [key, round(value)])),
    }))
    .sort((a, b) => a.memberName.localeCompare(b.memberName));

  return {
    year,
    departmentTotalHours: round(memberRows.reduce((sum, member) => sum + member.totalHours, 0)),
    categoryTotals: roundedCategories,
    members: memberRows,
    records,
  };
}


function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function trainingGapsReport(ctx: AuthContext) {
  assertPermission(ctx, "reports.read");
  const [members, types] = await Promise.all([
    prisma.departmentMembership.findMany({
      where: { departmentId: ctx.departmentId, status: "ACTIVE" },
      include: { user: true, credentials: true, assignments: { include: { version: { include: { template: true, sections: { include: { requirements: true } } } }, completions: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.credentialType.findMany({ where: { departmentId: ctx.departmentId }, orderBy: { name: "asc" } }),
  ]);

  const requiredTypes = types.map((type) => ({
    ...type,
    requiredRanks: parseStringArray(type.requiredRanksJson),
    requiredPositions: parseStringArray(type.requiredPositionsJson),
  }));

  const rows = members.map((member) => {
    const applicable = requiredTypes.filter((type) =>
      type.requiredForAll ||
      (member.rank ? type.requiredRanks.includes(member.rank) : false) ||
      (member.position ? type.requiredPositions.includes(member.position) : false),
    );
    const credentialGaps = applicable.flatMap((type) => {
      const matching = member.credentials.filter((credential) =>
        credential.credentialTypeId === type.id || credential.credentialName.toLowerCase() === type.name.toLowerCase(),
      );
      if (!matching.length) return [{ kind: "MISSING" as const, name: type.name, detail: "Required credential not on file" }];
      const best = matching
        .map((credential) => ({ credential, status: credentialStatus(credential.expirationDate, undefined, credential.doesNotExpire) }))
        .sort((a, b) => (a.status.health === "current" ? -1 : b.status.health === "current" ? 1 : 0))[0];
      if (!best) return [];
      if (best.status.health === "expired") return [{ kind: "EXPIRED" as const, name: type.name, detail: best.status.label }];
      if (best.status.health === "expiring") return [{ kind: "EXPIRING" as const, name: type.name, detail: best.status.label }];
      return [];
    });

    const taskBookGaps = member.assignments.flatMap((assignment) => {
      const progress = computeAssignmentProgress({
        requirements: assignment.version.sections.flatMap((section) => section.requirements),
        completions: assignment.completions,
        assignedDate: assignment.assignedDate,
        dueDate: assignment.dueDate,
      });
      if (progress.status === "COMPLETE") return [];
      return [{
        kind: progress.status === "OVERDUE" ? "OVERDUE_TASK_BOOK" as const : "INCOMPLETE_TASK_BOOK" as const,
        name: assignment.version.template.title,
        detail: `${progress.percent}% complete`,
      }];
    });

    return {
      memberId: member.id,
      memberName: member.user.name,
      rank: member.rank,
      position: member.position,
      station: member.station,
      shift: member.shift,
      gaps: [...credentialGaps, ...taskBookGaps],
      gapCount: credentialGaps.length + taskBookGaps.length,
    };
  });

  const withGaps = rows.filter((row) => row.gapCount > 0);
  return {
    members: rows.length,
    membersWithGaps: withGaps.length,
    totalGaps: withGaps.reduce((sum, row) => sum + row.gapCount, 0),
    missingCredentials: withGaps.reduce((sum, row) => sum + row.gaps.filter((gap) => gap.kind === "MISSING").length, 0),
    expiredCredentials: withGaps.reduce((sum, row) => sum + row.gaps.filter((gap) => gap.kind === "EXPIRED").length, 0),
    expiringCredentials: withGaps.reduce((sum, row) => sum + row.gaps.filter((gap) => gap.kind === "EXPIRING").length, 0),
    rows: withGaps,
  };
}


export async function classTrainingSheetReport(ctx: AuthContext, classId: string) {
  assertPermission(ctx, "reports.read");
  const training = await prisma.trainingClass.findFirst({
    where: { id: classId, departmentId: ctx.departmentId },
    include: {
      department: true,
      createdBy: true,
      proctors: { include: { user: true } },
      roster: {
        include: { membership: { include: { user: true } } },
        orderBy: { enrolledAt: "asc" },
      },
    },
  });
  if (!training) throw new Error("Training record not found.");

  const fallbackHours = training.endsAt
    ? Math.max(0, (training.endsAt.getTime() - training.startsAt.getTime()) / 3_600_000)
    : 0;
  const creditHours = training.creditHours > 0
    ? training.creditHours
    : Math.round(fallbackHours * 100) / 100;
  const instructors = training.proctors.map((item) => item.user.name);
  const instructor = instructors.length ? instructors.join(", ") : training.createdBy.name;

  const rows = training.roster.map((enrollment) => ({
    enrollmentId: enrollment.id,
    membershipId: enrollment.membershipId,
    memberName: enrollment.membership?.user.name || enrollment.guestName || "Unknown student",
    rank: enrollment.membership?.rank || null,
    station: enrollment.membership?.station || null,
    shift: enrollment.membership?.shift || null,
    isGuest: enrollment.membershipId == null,
    organization: enrollment.guestOrganization,
    attendance: enrollment.attendance,
    finalResult: enrollment.finalResult,
    completedAt: enrollment.completedAt,
    creditHours: enrollment.attendance === "PRESENT" && enrollment.membershipId ? creditHours : 0,
    notes: enrollment.notes,
  }));

  return {
    generatedAt: new Date(),
    department: {
      name: training.department.name,
      city: training.department.city,
      state: training.department.state,
    },
    training: {
      id: training.id,
      title: training.title,
      date: training.startsAt,
      endsAt: training.endsAt,
      location: training.location,
      category: training.trainingCategory,
      classType: training.classType,
      status: training.status,
      notes: training.notes,
      creditHours,
      instructor,
    },
    summary: {
      roster: rows.length,
      present: rows.filter((row) => row.attendance === "PRESENT").length,
      absent: rows.filter((row) => row.attendance === "ABSENT").length,
      excused: rows.filter((row) => row.attendance === "EXCUSED").length,
      unmarked: rows.filter((row) => row.attendance === "REGISTERED").length,
      departmentMemberHours: rows.reduce((sum, row) => sum + row.creditHours, 0),
    },
    rows,
  };
}
