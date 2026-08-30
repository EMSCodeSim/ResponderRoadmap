import { prisma } from "@/server/db";
import { assertPermission, type AuthContext } from "@/server/permissions";
import { computeAssignmentProgress } from "@/lib/progress";
import { credentialStatus } from "@/lib/dates";
import { parseMetadata as parseMeta } from "@/server/http";

export async function getDashboard(ctx: AuthContext) {
  assertPermission(ctx, "dashboard.read");
  if (ctx.role === "MEMBER") {
    return getMemberDashboard(ctx);
  }
  const departmentId = ctx.departmentId;

  const [members, assignments, completions, credentials, events, templates] = await Promise.all([
    prisma.departmentMembership.findMany({
      where: { departmentId, status: "ACTIVE" },
      include: { user: true },
    }),
    prisma.taskBookAssignment.findMany({
      where: { departmentId },
      include: {
        membership: { include: { user: true } },
        version: { include: { template: true, sections: { include: { requirements: true } } } },
        completions: true,
      },
    }),
    prisma.requirementCompletion.findMany({
      where: { status: "SUBMITTED", assignment: { departmentId } },
      include: {
        membership: { include: { user: true } },
        requirement: { include: { section: { include: { version: { include: { template: true } } } } } },
        assignment: true,
      },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.credential.findMany({
      where: { departmentId },
      include: { membership: { include: { user: true } } },
    }),
    prisma.activityEvent.findMany({
      where: { departmentId },
      include: { user: true },
      orderBy: { timestamp: "desc" },
      take: 12,
    }),
    prisma.taskBookTemplate.findMany({
      where: { departmentId, status: "ACTIVE" },
      include: { versions: { include: { _count: { select: { assignments: true } } } } },
    }),
  ]);

  const assignmentRows = assignments.map((assignment) => {
    const progress = computeAssignmentProgress({
      requirements: assignment.version.sections.flatMap((section) => section.requirements),
      completions: assignment.completions,
      assignedDate: assignment.assignedDate,
      dueDate: assignment.dueDate,
    });
    return { assignment, progress };
  });

  const overdueAssignments = assignmentRows.filter((row) => row.progress.status === "OVERDUE");
  const stalled = assignmentRows.filter((row) => {
    if (row.progress.status === "COMPLETE") return false;
    const last = row.assignment.updatedAt || row.assignment.assignedDate;
    return Date.now() - last.getTime() > 30 * 86_400_000;
  });
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const completedThisMonth = assignmentRows.filter(
    (row) => row.progress.status === "COMPLETE" && row.assignment.updatedAt >= monthStart,
  ).length;
  const credentialRows = credentials.map((item) => ({ item, status: credentialStatus(item.expirationDate) }));
  const expiringSoon = credentialRows.filter((row) => row.status.health === "expiring");
  const expired = credentialRows.filter((row) => row.status.health === "expired");

  const attention = [];
  if (expiringSoon.length) {
    attention.push({
      tone: "warn",
      text: `${expiringSoon.length} certification${expiringSoon.length === 1 ? "" : "s"} expire within 60 days`,
      href: "/certifications?window=60",
    });
  }
  if (completions.length) {
    attention.push({
      tone: "info",
      text: `${completions.length} Task Book requirement${completions.length === 1 ? "" : "s"} awaiting evaluator approval`,
      href: "/evaluate",
    });
  }
  const overdueMembers = new Set(overdueAssignments.map((row) => row.assignment.membershipId));
  if (overdueMembers.size) {
    attention.push({
      tone: "danger",
      text: `${overdueMembers.size} member${overdueMembers.size === 1 ? " has" : "s have"} overdue Task Book work`,
      href: "/assignments?status=OVERDUE",
    });
  }
  if (stalled.length) {
    attention.push({
      tone: "warn",
      text: `${stalled.length} assignment${stalled.length === 1 ? " is" : "s are"} stalled more than 30 days`,
      href: "/assignments?stalled=30",
    });
  }
  if (expired.length) {
    attention.push({
      tone: "danger",
      text: `${expired.length} credential${expired.length === 1 ? " is" : "s are"} expired`,
      href: "/certifications?window=expired",
    });
  }

  const taskBookProgress = templates.map((template) => {
    const rows = assignmentRows.filter((row) => row.assignment.version.template.id === template.id);
    const avg = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.progress.percent, 0) / rows.length) : 0;
    return {
      id: template.id,
      title: template.title,
      assignedMembers: rows.length,
      averageProgress: avg,
      complete: rows.filter((row) => row.progress.status === "COMPLETE").length,
      overdue: rows.filter((row) => row.progress.status === "OVERDUE").length,
      waitingSignOff: rows.filter((row) => row.progress.pendingApproval > 0).length,
    };
  });

  const now = Date.now();
  const week = 7 * 86_400_000;
  const followUpSeen = new Set<string>();
  const followUp = [...overdueAssignments, ...stalled]
    .filter((row) => {
      const key = row.assignment.id;
      if (followUpSeen.has(key)) return false;
      followUpSeen.add(key);
      return true;
    })
    .slice(0, 8)
    .map((row) => {
      const last = row.assignment.updatedAt || row.assignment.assignedDate;
      const idleDays = Math.max(0, Math.floor((now - last.getTime()) / 86_400_000));
      const overdueDays =
        row.assignment.dueDate && row.assignment.dueDate.getTime() < now
          ? Math.ceil((now - row.assignment.dueDate.getTime()) / 86_400_000)
          : 0;
      return {
        assignmentId: row.assignment.id,
        memberId: row.assignment.membershipId,
        memberName: row.assignment.membership.user.name,
        station: row.assignment.membership.station,
        shift: row.assignment.membership.shift,
        taskBookTitle: row.assignment.version.template.title,
        percent: row.progress.percent,
        reason:
          overdueDays > 0
            ? `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`
            : `No movement in ${idleDays} days`,
        href: `/members/${row.assignment.membershipId}?tab=task-books`,
      };
    });

  const followUpIds = new Set(followUp.map((item) => item.assignmentId));
  const dueSoon = assignmentRows
    .filter((row) => {
      if (row.progress.status === "COMPLETE") return false;
      if (!row.assignment.dueDate) return false;
      const due = row.assignment.dueDate.getTime();
      return due >= now && due - now <= week && !followUpIds.has(row.assignment.id);
    })
    .sort((a, b) => (a.assignment.dueDate?.getTime() || 0) - (b.assignment.dueDate?.getTime() || 0))
    .slice(0, 6)
    .map((row) => ({
      assignmentId: row.assignment.id,
      memberId: row.assignment.membershipId,
      memberName: row.assignment.membership.user.name,
      station: row.assignment.membership.station,
      shift: row.assignment.membership.shift,
      taskBookTitle: row.assignment.version.template.title,
      percent: row.progress.percent,
      dueDate: row.assignment.dueDate,
      href: `/members/${row.assignment.membershipId}?tab=task-books`,
    }));

  return {
    summary: {
      activeMembers: members.length,
      activeTaskBooks: templates.length,
      awaitingSignOff: completions.length,
      expiringSoon: expiringSoon.length,
      overdueRequirements: overdueAssignments.reduce((sum, row) => sum + row.progress.overdue, 0),
      overdueMembers: overdueMembers.size,
      stalledOver30: stalled.length,
      completedThisMonth,
      membersAssigned: assignmentRows.length,
      averageCompletion: assignmentRows.length
        ? Math.round(assignmentRows.reduce((sum, row) => sum + row.progress.percent, 0) / assignmentRows.length)
        : 0,
    },
    today: {
      signOffs: completions.slice(0, 8).map((item) => ({
        id: item.id,
        assignmentId: item.assignmentId,
        memberId: item.membershipId,
        memberName: item.membership.user.name,
        station: item.membership.station,
        shift: item.membership.shift,
        requirementTitle: item.requirement.title,
        taskBookTitle: item.requirement.section.version.template.title,
        submittedAt: item.submittedAt,
        href: `/evaluate?focus=${item.id}`,
      })),
      signOffTotal: completions.length,
      followUp,
      dueSoon,
    },
    attention,
    taskBookProgress,
    recentActivity: events.map((event) => ({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      actorName: event.user?.name ?? null,
      metadata: parseMeta(event.metadataJson),
    })),
  };
}

export { activityText } from "@/lib/activity";

async function getMemberDashboard(ctx: AuthContext) {
  const [assignments, credentials, events] = await Promise.all([
    prisma.taskBookAssignment.findMany({
      where: { departmentId: ctx.departmentId, membershipId: ctx.membershipId },
      include: {
        version: { include: { template: true, sections: { include: { requirements: true } } } },
        completions: true,
      },
    }),
    prisma.credential.findMany({
      where: { departmentId: ctx.departmentId, membershipId: ctx.membershipId },
    }),
    prisma.activityEvent.findMany({
      where: { departmentId: ctx.departmentId, userId: ctx.userId },
      include: { user: true },
      orderBy: { timestamp: "desc" },
      take: 12,
    }),
  ]);

  const assignmentRows = assignments.map((assignment) => {
    const progress = computeAssignmentProgress({
      requirements: assignment.version.sections.flatMap((section) => section.requirements),
      completions: assignment.completions,
      assignedDate: assignment.assignedDate,
      dueDate: assignment.dueDate,
    });
    return { assignment, progress };
  });
  const credentialRows = credentials.map((item) => ({ item, status: credentialStatus(item.expirationDate) }));

  return {
    personal: true,
    summary: {
      activeMembers: 1,
      activeTaskBooks: assignmentRows.filter((row) => row.progress.status !== "COMPLETE").length,
      awaitingSignOff: assignmentRows.reduce((sum, row) => sum + row.progress.pendingApproval, 0),
      expiringSoon: credentialRows.filter((row) => row.status.health === "expiring").length,
      overdueRequirements: assignmentRows.reduce((sum, row) => sum + row.progress.overdue, 0),
      stalledOver30: 0,
      completedThisMonth: assignmentRows.filter((row) => row.progress.status === "COMPLETE").length,
      membersAssigned: assignmentRows.length,
      averageCompletion: assignmentRows.length
        ? Math.round(assignmentRows.reduce((sum, row) => sum + row.progress.percent, 0) / assignmentRows.length)
        : 0,
    },
    attention: assignmentRows
      .filter((row) => row.progress.status === "OVERDUE" || row.progress.pendingApproval > 0)
      .map((row) => ({
        tone: row.progress.status === "OVERDUE" ? "danger" : "info",
        text: `${row.assignment.version.template.title} — ${row.progress.percent}%`,
        href: `/my-task-books/${row.assignment.id}`,
      })),
    taskBookProgress: assignmentRows.map((row) => ({
      id: row.assignment.id,
      title: row.assignment.version.template.title,
      assignedMembers: 1,
      averageProgress: row.progress.percent,
      complete: row.progress.status === "COMPLETE" ? 1 : 0,
      overdue: row.progress.overdue,
      waitingSignOff: row.progress.pendingApproval,
    })),
    recentActivity: events.map((event) => ({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      actorName: event.user?.name ?? null,
      metadata: parseMeta(event.metadataJson),
    })),
  };
}
