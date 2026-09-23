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
