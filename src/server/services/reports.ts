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
