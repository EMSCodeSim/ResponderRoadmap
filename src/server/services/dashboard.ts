import { prisma } from "@/server/db";
import { assertPermission, hasPermission, type AuthContext } from "@/server/permissions";
import { computeAssignmentProgress, daysStalled, requirementIsComplete } from "@/lib/progress";
import { memberOperationalStatus } from "@/lib/member-status";
import { assignmentRecordPath, createAssignmentPath, memberProgressPath } from "@/lib/routes";
import { credentialStatus } from "@/lib/dates";
import { parseMetadata as parseMeta } from "@/server/http";
import type { Role } from "@/lib/constants";
import { approvedEvaluatorWhere } from "@/server/services/evaluators";
import { reviewStageForRequirement } from "@/lib/signoff";
import { summarizeDepartmentReadiness } from "@/lib/dashboard-readiness";
import { isEvaluationOverdue, resolveEvaluationEscalationHours, trainingOfficerShouldSeeEvaluation } from "@/lib/evaluation-routing";

export function canManagePendingMemberApprovals(role: Role) {
  return hasPermission(role, "invitations.write") && hasPermission(role, "members.write");
}

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function getDashboard(ctx: AuthContext) {
  assertPermission(ctx, "dashboard.read");
  if (ctx.role === "MEMBER") {
    return getMemberDashboard(ctx);
  }
  if (ctx.role === "INSTRUCTOR") {
    return getInstructorDashboard(ctx);
  }
  const departmentId = ctx.departmentId;

  const [members, assignments, completions, credentials, events, templates, credentialTypes, expectations, pendingJoinRequests, qualificationRoles, authorizations, evaluatorMembers, pendingEvaluations, department] = await Promise.all([
    prisma.departmentMembership.findMany({
      where: { departmentId, status: "ACTIVE" },
      include: { user: true },
    }),
    prisma.taskBookAssignment.findMany({
      where: { departmentId },
      include: {
        membership: { include: { user: true } },
        version: { include: { template: true, sections: { include: { requirements: true } } } },
        completions: { include: { attempts: { orderBy: { signedAt: "desc" }, take: 1 } } },
      },
    }),
    prisma.requirementCompletion.findMany({
      where: { status: "SUBMITTED", assignment: { departmentId } },
      include: {
        membership: { include: { user: true } },
        requirement: { include: { section: { include: { version: { include: { template: true } } } } } },
        assignment: true,
        signOffs: { select: { result: true, signedAt: true } },
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
    prisma.credentialType.findMany({ where: { departmentId } }),
    prisma.trainingExpectation.findMany({ where: { departmentId, active: true } }),
    canManagePendingMemberApprovals(ctx.role)
      ? prisma.departmentMembership.findMany({
          where: { departmentId, status: "PENDING" },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { joinedAt: "asc" },
        })
      : Promise.resolve([]),
    prisma.operationalRole.findMany({ where: { departmentId, archived: false } }),
    prisma.memberOperationalAuthorization.findMany({
      where: { departmentId, membership: { status: "ACTIVE" }, role: { archived: false } },
      include: { role: true },
    }),
    prisma.departmentMembership.findMany({ where: approvedEvaluatorWhere(departmentId), select: { id: true } }),
    prisma.requirementCompletion.findMany({
      where: { status: "SUBMITTED", assignment: { departmentId } },
      select: {
        membershipId: true,
        submittedAt: true,
        requestedEvaluatorId: true,
        assignment: { select: { evaluatorId: true } },
        requirement: { select: { evaluatorSignOffRequired: true, supervisorApprovalRequired: true } },
        signOffs: { select: { result: true, signedAt: true } },
      },
    }),
    prisma.department.findUnique({ where: { id: departmentId }, select: { evaluationEscalationHours: true, skillProficiencyThreshold: true } }),
  ]);

  const readinessRoles = qualificationRoles.map((role) => ({
    id: role.id,
    configured: parseStringArray(role.credentialTypeIdsJson).length + parseStringArray(role.taskBookTemplateIdsJson).length + parseStringArray(role.requirementIdsJson).length > 0,
  }));
  const configuredRoleIds = new Set(readinessRoles.filter((role) => role.configured).map((role) => role.id));
  const readinessAssessments: Array<{ roleId: string; status: string; requirementsMet: boolean; reviewDue: boolean }> = [];
  const qualificationIssueByMember = new Map<string, string>();
  const todayUtc = new Date(new Date().toISOString().slice(0, 10)).getTime();
  for (const auth of authorizations) {
    if (!configuredRoleIds.has(auth.roleId)) continue;
    const memberCredentials = new Set(credentials.filter((credential) => credential.membershipId === auth.membershipId && credential.credentialTypeId && credential.verificationStatus === "VERIFIED" && (credential.doesNotExpire || (credential.expirationDate && credential.expirationDate.getTime() >= todayUtc))).map((credential) => credential.credentialTypeId));
    const memberAssignments = assignments.filter((assignment) => assignment.membershipId === auth.membershipId);
    const memberCompletedTemplates = new Set(memberAssignments.filter((assignment) => assignment.status === "COMPLETE").map((assignment) => assignment.version.templateId));
    const memberApprovedRequirements = new Set(memberAssignments.flatMap((assignment) => assignment.completions.filter((completion) => completion.status === "APPROVED").map((completion) => completion.requirementId)));
    const missingCredential = parseStringArray(auth.role.credentialTypeIdsJson).some((id) => !memberCredentials.has(id));
    const missingTemplate = parseStringArray(auth.role.taskBookTemplateIdsJson).some((id) => !memberCompletedTemplates.has(id));
    const missingRequirement = parseStringArray(auth.role.requirementIdsJson).some((id) => !memberApprovedRequirements.has(id));
    const evidenceComplete = !missingCredential && !missingTemplate && !missingRequirement;
    const reviewDue = !!auth.reviewDate && auth.reviewDate.getTime() < todayUtc;
    readinessAssessments.push({ roleId: auth.roleId, status: auth.status, requirementsMet: evidenceComplete, reviewDue });
    if (auth.status !== "APPROVED" || !evidenceComplete || reviewDue) {
      const missing = [missingCredential ? "required credential" : "", missingTemplate ? "required Task Book" : "", missingRequirement ? "required competency" : ""].filter(Boolean);
      const reason = `${auth.role.name}: ${missing.length ? `missing ${missing.join(", ")}` : reviewDue ? "authorization review is due" : auth.status.toLowerCase().replaceAll("_", " ")}`;
      if (!qualificationIssueByMember.has(auth.membershipId)) qualificationIssueByMember.set(auth.membershipId, reason);
    }
  }
  const readiness = summarizeDepartmentReadiness(readinessRoles, readinessAssessments);

  const escalationHours = resolveEvaluationEscalationHours(department?.evaluationEscalationHours);
  const evaluatorPending = pendingEvaluations.filter((item) => reviewStageForRequirement({
    evaluatorSignOffRequired: item.requirement.evaluatorSignOffRequired,
    supervisorApprovalRequired: item.requirement.supervisorApprovalRequired,
    signOffs: item.signOffs,
    submittedAt: item.submittedAt,
  }) === "EVALUATOR");
  const escalatedEvaluations = evaluatorPending.filter((item) => isEvaluationOverdue({ status: "SUBMITTED", submittedAt: item.submittedAt, escalationHours }));
  const actionableEvaluations = completions.filter((item) => {
    const stage = reviewStageForRequirement({
      evaluatorSignOffRequired: item.requirement.evaluatorSignOffRequired,
      supervisorApprovalRequired: item.requirement.supervisorApprovalRequired,
      signOffs: item.signOffs,
      submittedAt: item.submittedAt,
    });
    const assignedReviewerId = stage === "SUPERVISOR"
      ? item.assignment.supervisorId
      : item.requestedEvaluatorId || item.assignment.evaluatorId;
    return trainingOfficerShouldSeeEvaluation({
      trainingOfficerUserId: ctx.userId,
      assignedReviewerId,
      status: "SUBMITTED",
      submittedAt: item.submittedAt,
      escalationHours,
    });
  });
  const oldestPendingEvaluation = evaluatorPending.reduce<Date | null>((oldest, item) => item.submittedAt && (!oldest || item.submittedAt < oldest) ? item.submittedAt : oldest, null);
  const escalatedByMember = new Map<string, Date>();
  for (const item of escalatedEvaluations) {
    if (item.submittedAt && (!escalatedByMember.has(item.membershipId) || item.submittedAt < escalatedByMember.get(item.membershipId)!)) {
      escalatedByMember.set(item.membershipId, item.submittedAt);
    }
  }
  const weakEvaluationByMember = new Map<string, string>();
  const proficiencyThreshold = department?.skillProficiencyThreshold ?? 80;
  for (const assignment of assignments) {
    for (const completion of assignment.completions) {
      const latest = completion.attempts[0];
      if (!latest || !(latest.result === "NEEDS_REMEDIATION" || latest.result === "FAIL" || latest.result === "RETURNED" || (latest.numericScore !== null && latest.numericScore < proficiencyThreshold))) continue;
      if (!weakEvaluationByMember.has(assignment.membershipId)) {
        const signal = latest.numericScore !== null && latest.numericScore < proficiencyThreshold
          ? `Latest ${completion.requirementId ? "evaluation" : "skill check"} score ${latest.numericScore}% is below the ${proficiencyThreshold}% threshold`
          : `Latest evaluation needs remediation`;
        const requirement = assignment.version.sections.flatMap((section) => section.requirements).find((item) => item.id === completion.requirementId);
        weakEvaluationByMember.set(assignment.membershipId, `${signal}: ${requirement?.title ?? "training requirement"} · ${assignment.version.template.title}`);
      }
    }
  }

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
  const credentialRows = credentials.map((item) => ({ item, status: credentialStatus(item.expirationDate, undefined, item.doesNotExpire) }));
  const expiringSoon = credentialRows.filter((row) => row.status.health === "expiring");
  const expired = credentialRows.filter((row) => row.status.health === "expired");

  const expectationProfiles = expectations.map((profile) => ({
    matchRanks: parseStringArray(profile.matchRanksJson),
    matchPositions: parseStringArray(profile.matchPositionsJson),
    credentialTypeIds: parseStringArray(profile.credentialTypeIdsJson),
  }));
  const credentialRequirements = credentialTypes.map((type) => ({
    ...type,
    requiredRanks: parseStringArray(type.requiredRanksJson),
    requiredPositions: parseStringArray(type.requiredPositionsJson),
  }));
  const certificateAttention: Array<{
    memberId: string;
    memberName: string;
    taskBookTitle: string;
    reason: string;
    dueDate: Date | null;
    href: string;
    severity: number;
  }> = [];
  const certificateKeys = new Set<string>();
  const addCertificateAttention = (item: (typeof certificateAttention)[number], key: string) => {
    if (certificateKeys.has(key)) return;
    certificateKeys.add(key);
    certificateAttention.push(item);
  };

  const credentialGroups = new Map<string, typeof credentials>();
  for (const credential of credentials) {
    const key = `${credential.membershipId}:${credential.credentialTypeId || credential.credentialName.toLowerCase()}`;
    const group = credentialGroups.get(key) ?? [];
    group.push(credential);
    credentialGroups.set(key, group);
  }
  for (const [key, group] of credentialGroups) {
    const rows = group.map((credential) => ({ credential, status: credentialStatus(credential.expirationDate, undefined, credential.doesNotExpire) }));
    if (rows.some((row) => row.status.health === "current")) continue;
    const issue = rows.find((row) => row.status.health === "expired")
      ?? rows.find((row) => !row.credential.doesNotExpire && !row.credential.expirationDate)
      ?? rows.find((row) => row.status.health === "expiring");
    if (!issue) continue;
    const reason = issue.status.health === "expired"
      ? issue.status.label
      : !issue.credential.expirationDate
        ? "Expiration date missing"
        : issue.status.label;
    addCertificateAttention({
      memberId: issue.credential.membershipId,
      memberName: issue.credential.membership.user.name,
      taskBookTitle: issue.credential.credentialName,
      reason,
      dueDate: issue.credential.expirationDate,
      href: `/members/${issue.credential.membershipId}?tab=certifications`,
      severity: issue.status.health === "expired" ? 0 : !issue.credential.expirationDate ? 1 : 2,
    }, key);
  }

  for (const member of members) {
    const profileCredentialIds = new Set(expectationProfiles
      .filter((profile) =>
        (member.rank ? profile.matchRanks.includes(member.rank) : false) ||
        (member.position ? profile.matchPositions.includes(member.position) : false),
      )
      .flatMap((profile) => profile.credentialTypeIds));
    const applicable = credentialRequirements.filter((type) =>
      profileCredentialIds.has(type.id) || type.requiredForAll ||
      (member.rank ? type.requiredRanks.includes(member.rank) : false) ||
      (member.position ? type.requiredPositions.includes(member.position) : false));
    for (const type of applicable) {
      const matching = credentials.some((credential) =>
        credential.membershipId === member.id &&
        (credential.credentialTypeId === type.id || credential.credentialName.toLowerCase() === type.name.toLowerCase()));
      if (matching) continue;
      addCertificateAttention({
        memberId: member.id,
        memberName: member.user.name,
        taskBookTitle: type.name,
        reason: "Required certificate missing",
        dueDate: null,
        href: `/members/${member.id}?tab=certifications`,
        severity: 0,
      }, `${member.id}:${type.id}`);
    }
  }
  certificateAttention.sort((a, b) => a.severity - b.severity || a.memberName.localeCompare(b.memberName) || a.taskBookTitle.localeCompare(b.taskBookTitle));

  const attention = [];
  if (pendingJoinRequests.length) {
    attention.push({
      tone: "info",
      text: `${pendingJoinRequests.length} member join request${pendingJoinRequests.length === 1 ? "" : "s"} awaiting approval`,
      href: "/enrollment",
    });
  }
  if (expiringSoon.length) {
    attention.push({
      tone: "warn",
      text: `${expiringSoon.length} certification${expiringSoon.length === 1 ? "" : "s"} expire within 60 days`,
      href: "/certifications?window=60",
    });
  }
  if (actionableEvaluations.length) {
    attention.push({
      tone: "info",
      text: `${actionableEvaluations.length} evaluation${actionableEvaluations.length === 1 ? "" : "s"} need your action or overdue follow-up`,
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
  const followUpAll = [...overdueAssignments, ...stalled]
    .filter((row) => {
      const key = row.assignment.id;
      if (followUpSeen.has(key)) return false;
      followUpSeen.add(key);
      return true;
    })
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
        dueDate: row.assignment.dueDate,
        reason:
          overdueDays > 0
            ? `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`
            : `No movement in ${idleDays} days`,
        href: `/members/${row.assignment.membershipId}?tab=task-books`,
      };
    });

  const followUp = followUpAll.slice(0, 8);

  const followUpIds = new Set(followUpAll.map((item) => item.assignmentId));
  const dueSoonAll = assignmentRows
    .filter((row) => {
      if (row.progress.status === "COMPLETE") return false;
      if (!row.assignment.dueDate) return false;
      const due = row.assignment.dueDate.getTime();
      return due >= now && due - now <= week && !followUpIds.has(row.assignment.id);
    })
    .sort((a, b) => (a.assignment.dueDate?.getTime() || 0) - (b.assignment.dueDate?.getTime() || 0))
    .map((row) => ({
      assignmentId: row.assignment.id,
      memberId: row.assignment.membershipId,
      memberName: row.assignment.membership.user.name,
      station: row.assignment.membership.station,
      shift: row.assignment.membership.shift,
      taskBookTitle: row.assignment.version.template.title,
      percent: row.progress.percent,
      dueDate: row.assignment.dueDate,
      reason: `${Math.max(0, Math.ceil(((row.assignment.dueDate?.getTime() ?? now) - now) / 86_400_000))} day${Math.max(0, Math.ceil(((row.assignment.dueDate?.getTime() ?? now) - now) / 86_400_000)) === 1 ? "" : "s"} remaining · ${row.progress.percent}% complete`,
      href: `/members/${row.assignment.membershipId}?tab=task-books`,
    }));
  const dueSoon = dueSoonAll.slice(0, 8);

  const memberProgressMap = new Map<string, {
    id: string;
    name: string;
    currentWork: string[];
    percent: number;
    complete: number;
    totalRequired: number;
    pendingApproval: number;
    overdue: number;
    lastActivity: Date | null;
    dueDate: Date | null;
    activeAssignments: number;
    nextRequirement: string | null;
    nextAssignmentId: string | null;
    maxStalledDays: number;
    assignments: Array<{ status: string; pendingApproval: number; overdue: number; percent: number; stalledDays: number }>;
  }>();

  // Seed every active department member so the Training Captain can see the
  // entire roster, including people who do not currently have training assigned.
  for (const member of members) {
    memberProgressMap.set(member.id, {
      id: member.id,
      name: member.user.name,
      currentWork: [],
      percent: 0,
      complete: 0,
      totalRequired: 0,
      pendingApproval: 0,
      overdue: 0,
      lastActivity: null,
      dueDate: null,
      activeAssignments: 0,
      nextRequirement: null,
      nextAssignmentId: null,
      maxStalledDays: 0,
      assignments: [],
    });
  }

  for (const row of assignmentRows) {
    const memberId = row.assignment.membershipId;
    const stalledDays = daysStalled({ updatedAt: row.assignment.updatedAt, assignedDate: row.assignment.assignedDate });
    const existing = memberProgressMap.get(memberId);
    if (!existing) continue;

    const active = row.progress.status !== "COMPLETE";
    if (active) {
      existing.currentWork.push(`${row.assignment.version.template.title} (${row.progress.percent}%)`);
      existing.activeAssignments += 1;
      existing.complete += row.progress.complete;
      existing.totalRequired += row.progress.totalRequired;
      existing.pendingApproval += row.progress.pendingApproval;
      existing.overdue += row.progress.overdue;
      existing.maxStalledDays = Math.max(existing.maxStalledDays, stalledDays);

      if (!existing.nextRequirement && row.progress.pendingApproval === 0) {
        const completionByRequirement = new Map(row.assignment.completions.map((item) => [item.requirementId, item]));
        const next = row.assignment.version.sections
          .flatMap((section) => section.requirements)
          .find((requirement) => requirement.isRequired && !requirementIsComplete(requirement, completionByRequirement.get(requirement.id)));
        if (next) {
          existing.nextRequirement = next.title;
          existing.nextAssignmentId = row.assignment.id;
        }
      }

      if (row.assignment.dueDate && (!existing.dueDate || row.assignment.dueDate < existing.dueDate)) {
        existing.dueDate = row.assignment.dueDate;
      }
    }

    if (row.assignment.updatedAt && (!existing.lastActivity || row.assignment.updatedAt > existing.lastActivity)) {
      existing.lastActivity = row.assignment.updatedAt;
    }
    existing.assignments.push({
      status: row.progress.status,
      pendingApproval: row.progress.pendingApproval,
      overdue: row.progress.overdue,
      percent: row.progress.percent,
      stalledDays,
    });
  }

  const certificateAttentionByMember = new Map<string, (typeof certificateAttention)[number]>();
  for (const issue of certificateAttention) {
    if (!certificateAttentionByMember.has(issue.memberId)) certificateAttentionByMember.set(issue.memberId, issue);
  }

  const memberProgress = [...memberProgressMap.values()]
    .map((row) => {
      const certificateIssue = certificateAttentionByMember.get(row.id);
      const qualificationIssue = qualificationIssueByMember.get(row.id);
      const competencyIssue = weakEvaluationByMember.get(row.id);
      const escalatedSubmission = escalatedByMember.get(row.id);
      const assignmentStatus = memberOperationalStatus(row.assignments);
      const status = (certificateIssue || qualificationIssue || competencyIssue) && assignmentStatus !== "Awaiting Evaluation" ? "Needs Attention" : assignmentStatus;
      const percent = row.activeAssignments > 0 && row.totalRequired
        ? Math.round((row.complete / row.totalRequired) * 100)
        : row.assignments.length > 0 && row.assignments.every((item) => item.status === "COMPLETE")
          ? 100
          : 0;
      const attentionReason =
        row.pendingApproval > 0
          ? escalatedSubmission
            ? `Evaluation overdue target · waiting since ${escalatedSubmission.toLocaleDateString()}`
            : `${row.pendingApproval} awaiting evaluation`
          : row.overdue > 0
            ? `${row.overdue} overdue requirement${row.overdue === 1 ? "" : "s"}`
            : certificateIssue
              ? `${certificateIssue.taskBookTitle}: ${certificateIssue.reason}`
              : qualificationIssue
                ? qualificationIssue
                : competencyIssue
                  ? competencyIssue
                : escalatedSubmission
                  ? `Evaluation waiting since ${escalatedSubmission.toLocaleDateString()}`
            : row.activeAssignments > 0 && row.maxStalledDays >= 14
              ? `No recorded activity for ${row.maxStalledDays} days`
              : row.activeAssignments === 0
                ? "No active work"
                : "On track";
      const memberPending = completions.find((item) => item.membershipId === row.id);
      const nextAction =
        row.pendingApproval > 0
          ? { label: "Review evaluation", href: memberPending ? `/evaluate?focus=${memberPending.id}` : "/evaluate" }
          : row.overdue > 0
            ? { label: "Open overdue work", href: memberProgressPath(row.id) }
            : certificateIssue
              ? { label: "Review certificate", href: certificateIssue.href }
            : qualificationIssue
              ? { label: "Review qualification", href: "/qualifications" }
              : competencyIssue
                ? { label: "Review member training", href: memberProgressPath(row.id) }
              : escalatedSubmission
                ? { label: "Review evaluation", href: "/evaluate" }
            : row.activeAssignments > 0 && row.maxStalledDays >= 14
              ? { label: "Follow up", href: memberProgressPath(row.id) }
              : row.activeAssignments === 0
                ? { label: "Assign training", href: createAssignmentPath() }
                : row.nextRequirement && row.nextAssignmentId
                  ? { label: "Open next requirement", href: assignmentRecordPath(row.nextAssignmentId) }
                  : { label: "View member", href: memberProgressPath(row.id) };

      return {
        id: row.id,
        name: row.name,
        currentWork: row.currentWork.length ? row.currentWork.join("; ") : "No active Task Books or Assignments",
        percent,
        lastActivity: row.lastActivity,
        dueDate: row.dueDate,
        status,
        activeAssignments: row.activeAssignments,
        pendingApproval: row.pendingApproval,
        overdue: row.overdue,
        stalledDays: row.maxStalledDays,
        evaluationEscalated: !!escalatedSubmission,
        nextRequirement: row.nextRequirement,
        attentionReason,
        nextActionLabel: nextAction.label,
        nextActionHref: nextAction.href,
        href: memberProgressPath(row.id),
      };
    })
    .sort((a, b) => {
      const rank = { "Needs Attention": 0, "Awaiting Evaluation": 1, "On Track": 2, Completed: 3 };
      if (a.activeAssignments === 0 && b.activeAssignments > 0) return 1;
      if (b.activeAssignments === 0 && a.activeAssignments > 0) return -1;
      return (rank[a.status] ?? 4) - (rank[b.status] ?? 4) || a.name.localeCompare(b.name);
    });

  return {
    summary: {
      activeMembers: members.length,
      activeTaskBooks: templates.length,
      activeAssignments: assignmentRows.filter((row) => row.progress.status !== "COMPLETE").length,
      awaitingSignOff: completions.length,
      awaitingEvaluation: completions.length,
      expiringSoon: expiringSoon.length,
      certificateIssues: certificateAttention.length,
      overdueRequirements: overdueAssignments.reduce((sum, row) => sum + row.progress.overdue, 0),
      overdueMembers: overdueMembers.size,
      needsAttention: new Set([
        ...overdueMembers,
        ...stalled.map((row) => row.assignment.membershipId),
        ...actionableEvaluations.map((item) => item.membershipId),
        ...expiringSoon.map((row) => row.item.membershipId),
        ...expired.map((row) => row.item.membershipId),
        ...certificateAttention.map((item) => item.memberId),
      ]).size + pendingJoinRequests.length,
      currentMembers: memberProgress.filter((row) => row.activeAssignments > 0 && row.status === "On Track").length,
      readinessPercent: members.length
        ? Math.round((memberProgress.filter((row) => row.activeAssignments > 0 && row.status === "On Track").length / members.length) * 100)
        : 0,
      stalledOver30: stalled.length,
      completedThisMonth,
      membersAssigned: assignmentRows.length,
      pendingJoinRequests: pendingJoinRequests.length,
      averageCompletion: assignmentRows.length
        ? Math.round(assignmentRows.reduce((sum, row) => sum + row.progress.percent, 0) / assignmentRows.length)
        : 0,
    },
    departmentReadiness: readiness,
    evaluatorCoverage: {
      approvedEvaluatorCount: evaluatorMembers.length,
      pendingCount: evaluatorPending.length,
      escalatedCount: escalatedEvaluations.length,
      escalationHours,
      oldestPendingAt: oldestPendingEvaluation,
    },
    memberProgress,
    today: {
      joinRequests: pendingJoinRequests.slice(0, 8).map((membership) => ({
        id: membership.id,
        memberId: membership.id,
        memberName: membership.user.name,
        taskBookTitle: "Department membership",
        reason: `Join-code request · ${membership.user.email}`,
        submittedAt: membership.joinedAt,
        href: "/enrollment",
      })),
      joinRequestTotal: pendingJoinRequests.length,
      signOffs: actionableEvaluations.slice(0, 8).map((item) => ({
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
        recordHref: assignmentRecordPath(item.assignmentId),
      })),
      signOffTotal: actionableEvaluations.length,
      followUp,
      followUpTotal: followUpAll.length,
      dueSoon,
      dueSoonTotal: dueSoonAll.length,
      certificates: certificateAttention.slice(0, 8),
      certificateTotal: certificateAttention.length,
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
  const [assignments, credentials, events, returned] = await Promise.all([
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
    prisma.requirementCompletion.findMany({
      where: { membershipId: ctx.membershipId, status: "RETURNED" },
      include: { requirement: { include: { section: { include: { version: { include: { template: true } } } } } } },
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
  const credentialRows = credentials.map((item) => ({ item, status: credentialStatus(item.expirationDate, undefined, item.doesNotExpire) }));

  const workItem = (row: (typeof assignmentRows)[number], extra?: string) => ({
    id: row.assignment.id,
    title: row.assignment.version.template.title,
    percent: row.progress.percent,
    status: row.progress.status,
    dueDate: row.assignment.dueDate,
    href: row.assignment.version.template.templateKind === "TRAINING_TASK" ? `/my-assignments/${row.assignment.id}` : `/my-task-books/${row.assignment.id}`,
    detail: extra || `${row.progress.complete} of ${row.progress.totalRequired} approved`,
  });

  const returnedItems = returned.map((item) => ({
    id: item.id,
    title: item.requirement.title,
    percent: 0,
    status: "RETURNED",
    dueDate: null as Date | null,
    href: `/my-task-books/${item.assignmentId}`,
    detail: `Returned — correction needed · ${item.requirement.section.version.template.title}`,
  }));
  const overdueItems = assignmentRows.filter((row) => row.progress.status === "OVERDUE" || (row.progress.status === "NOT_STARTED" && row.progress.overdue > 0)).map((row) => workItem(row, "Overdue — needs action"));
  const normalItems = assignmentRows.filter((row) => row.progress.status === "IN_PROGRESS" || row.progress.status === "NOT_STARTED").map((row) => workItem(row, "Ready to do"));
  const doThisNext = returnedItems[0] || overdueItems[0] || normalItems[0] || null;

  return {
    personal: true,
    doThisNext,
    summary: {
      activeMembers: 1,
      activeTaskBooks: assignmentRows.filter((row) => row.progress.status !== "COMPLETE" && row.assignment.version.template.templateKind !== "TRAINING_TASK").length,
      activeAssignments: assignmentRows.filter((row) => row.progress.status !== "COMPLETE").length,
      awaitingSignOff: assignmentRows.reduce((sum, row) => sum + row.progress.pendingApproval, 0),
      awaitingEvaluation: assignmentRows.reduce((sum, row) => sum + row.progress.pendingApproval, 0),
      expiringSoon: credentialRows.filter((row) => row.status.health === "expiring").length,
      overdueRequirements: assignmentRows.reduce((sum, row) => sum + row.progress.overdue, 0),
      needsAttention: assignmentRows.filter((row) => row.progress.status === "OVERDUE" || row.progress.overdue > 0).length + returned.length,
      stalledOver30: 0,
      completedThisMonth: assignmentRows.filter((row) => row.progress.status === "COMPLETE").length,
      membersAssigned: assignmentRows.length,
      averageCompletion: assignmentRows.length
        ? Math.round(assignmentRows.reduce((sum, row) => sum + row.progress.percent, 0) / assignmentRows.length)
        : 0,
    },
    work: {
      needsAction: [...returnedItems, ...overdueItems],
      inProgress: normalItems,
      waiting: assignmentRows.filter((row) => row.progress.status === "AWAITING_SIGN_OFF").map((row) => workItem(row, "Waiting for evaluator")),
      completed: assignmentRows.filter((row) => row.progress.status === "COMPLETE").map((row) => workItem(row, "Complete")),
    },
    attention: [
      ...returned.map((item) => ({
        tone: "danger",
        text: `Returned: ${item.requirement.title}`,
        href: assignmentRecordPath(item.assignmentId),
      })),
      ...assignmentRows
        .filter((row) => row.progress.status === "OVERDUE" || row.progress.pendingApproval > 0)
        .map((row) => ({
          tone: row.progress.status === "OVERDUE" ? "danger" : "info",
          text: `${row.assignment.version.template.title} — ${row.progress.percent}%`,
          href: `/my-task-books/${row.assignment.id}`,
        })),
    ],
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


async function getInstructorDashboard(ctx: AuthContext) {
  const now = new Date();
  const classes = await prisma.trainingClass.findMany({
    where: {
      departmentId: ctx.departmentId,
      OR: [
        { createdById: ctx.userId },
        { proctors: { some: { userId: ctx.userId } } },
      ],
    },
    include: {
      roster: { select: { id: true, finalResult: true, attendance: true } },
      proctors: { select: { userId: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  const rows = classes.map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    location: row.location,
    status: row.status,
    rosterCount: row.roster.length,
    presentCount: row.roster.filter((item) => item.attendance === "PRESENT").length,
    completeCount: row.roster.filter((item) => item.finalResult !== "PENDING").length,
    href: `/classes/${row.id}`,
  }));
  const upcoming = rows.filter((row) => row.status !== "COMPLETE" && row.status !== "CANCELLED" && row.startsAt >= now);
  const inProgress = rows.filter((row) => row.status === "ACTIVE" && row.startsAt < now);
  const recentlyCompleted = rows.filter((row) => row.status === "COMPLETE").sort((a,b) => b.startsAt.getTime() - a.startsAt.getTime()).slice(0,5);
  const nextClass = upcoming[0] || inProgress[0] || null;

  return {
    instructor: true,
    instructorHome: { nextClass, upcoming: upcoming.slice(0,8), inProgress: inProgress.slice(0,8), recentlyCompleted },
    summary: {
      activeMembers: 0, activeTaskBooks: 0, awaitingSignOff: 0, awaitingEvaluation: 0,
      expiringSoon: 0, overdueRequirements: 0, needsAttention: 0,
    },
    attention: [],
    taskBookProgress: [],
    recentActivity: [],
  };
}
