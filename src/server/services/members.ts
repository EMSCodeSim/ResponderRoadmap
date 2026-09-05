import { prisma } from "@/server/db";
import { writeActivity, writeAudit, HttpError } from "@/server/http";
import { assertPermission, hasPermission, type AuthContext } from "@/server/permissions";
import { credentialStatus, worstCredentialHealth, type CredentialHealth } from "@/lib/dates";
import { computeAssignmentProgress } from "@/lib/progress";
import type { Role, MembershipStatus } from "@/lib/constants";

function includeMember() {
  return {
    user: true,
    assignments: {
      include: {
        version: { include: { template: true, sections: { include: { requirements: true } } } },
        completions: true,
      },
    },
    credentials: true,
  } as const;
}

export function summarizeMember(
  membership: {
    id: string;
    role: string;
    status: string;
    rank: string | null;
    position: string | null;
    station: string | null;
    shift: string | null;
    employeeNumber: string | null;
    joinedAt: Date;
    user: { id: string; name: string; email: string; phone: string | null };
    assignments: Array<{
      id: string;
      status: string;
      dueDate: Date | null;
      assignedDate: Date;
      version: {
        version: string;
        template: { id: string; title: string };
        sections: Array<{ requirements: Array<{ id: string; isRequired: boolean; dueOffsetDays: number | null }> }>;
      };
      completions: Array<{ requirementId: string; status: string }>;
    }>;
    credentials: Array<{
      id: string;
      credentialName: string;
      expirationDate: Date | null;
      doesNotExpire: boolean;
      verificationStatus: string;
    }>;
  },
  lastActivity: Date | null,
) {
  const assignmentSummaries = membership.assignments.map((assignment) => {
    const requirements = assignment.version.sections.flatMap((section) => section.requirements);
    const progress = computeAssignmentProgress({
      requirements,
      completions: assignment.completions,
      assignedDate: assignment.assignedDate,
      dueDate: assignment.dueDate,
    });
    return {
      id: assignment.id,
      taskBookTitle: assignment.version.template.title,
      version: assignment.version.version,
      status: progress.status,
      percent: progress.percent,
      pendingApproval: progress.pendingApproval,
      overdue: progress.overdue,
      complete: progress.complete,
      totalRequired: progress.totalRequired,
      dueDate: assignment.dueDate,
    };
  });

  const credentialSummaries = membership.credentials.map((credential) => ({
    ...credential,
    ...credentialStatus(credential.expirationDate, undefined, credential.doesNotExpire),
  }));

  const certHealth = worstCredentialHealth(credentialSummaries);
  const overall =
    assignmentSummaries.length === 0
      ? null
      : Math.round(assignmentSummaries.reduce((sum, item) => sum + item.percent, 0) / assignmentSummaries.length);

  return {
    id: membership.id,
    userId: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
    phone: membership.user.phone,
    role: membership.role,
    status: membership.status,
    rank: membership.rank,
    position: membership.position,
    station: membership.station,
    shift: membership.shift,
    employeeNumber: membership.employeeNumber,
    joinedAt: membership.joinedAt,
    lastActivity,
    overallProgress: overall,
    certificationHealth: certHealth as CredentialHealth,
    activeTaskBooks: assignmentSummaries.filter((item) => item.status !== "COMPLETE"),
    assignments: assignmentSummaries,
    credentials: credentialSummaries,
  };
}

function redactRosterRowForEvaluator<T extends ReturnType<typeof summarizeMember>>(row: T): T {
  return {
    ...row,
    email: "",
    phone: null,
    employeeNumber: null,
    certificationHealth: "restricted" as T["certificationHealth"],
    credentials: [],
  };
}

export async function listMembers(
  ctx: AuthContext,
  filters: {
    query?: string;
    rank?: string;
    station?: string;
    shift?: string;
    taskBookId?: string;
    certStatus?: string;
    status?: string;
  } = {},
) {
  assertPermission(ctx, "members.read");
  const memberships = await prisma.departmentMembership.findMany({
    where: { departmentId: ctx.departmentId },
    include: includeMember(),
    orderBy: { user: { name: "asc" } },
  });

  const activity = await prisma.activityEvent.groupBy({
    by: ["userId"],
    where: { departmentId: ctx.departmentId, userId: { not: null } },
    _max: { timestamp: true },
  });
  const lastByUser = new Map(activity.map((item) => [item.userId, item._max.timestamp]));

  let rows = memberships.map((membership) =>
    summarizeMember(membership, lastByUser.get(membership.userId) ?? null),
  );

  if (filters.query) {
    const q = filters.query.toLowerCase();
    rows = rows.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        (ctx.role !== "EVALUATOR" && row.email.toLowerCase().includes(q)) ||
        (row.rank || "").toLowerCase().includes(q) ||
        (row.station || "").toLowerCase().includes(q),
    );
  }
  if (filters.rank) rows = rows.filter((row) => row.rank === filters.rank);
  if (filters.station) rows = rows.filter((row) => row.station === filters.station);
  if (filters.shift) rows = rows.filter((row) => row.shift === filters.shift);
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  if (filters.taskBookId) {
    const allowed = new Set(
      memberships
        .filter((m) => m.assignments.some((a) => a.version.template.id === filters.taskBookId))
        .map((m) => m.id),
    );
    rows = rows.filter((row) => allowed.has(row.id));
  }
  if (filters.certStatus && hasPermission(ctx.role, "credentials.read")) {
    rows = rows.filter((row) => row.certificationHealth === filters.certStatus);
  }

  if (ctx.role === "EVALUATOR") {
    rows = rows.map(redactRosterRowForEvaluator);
  }

  return {
    members: rows,
    facets: {
      ranks: [...new Set(memberships.map((m) => m.rank).filter(Boolean))] as string[],
      stations: [...new Set(memberships.map((m) => m.station).filter(Boolean))] as string[],
      shifts: [...new Set(memberships.map((m) => m.shift).filter(Boolean))] as string[],
    },
  };
}

export async function getMember(ctx: AuthContext, membershipId: string) {
  if (ctx.role === "MEMBER" && ctx.membershipId !== membershipId) {
    throw new HttpError(403, "You can only view your own profile.");
  }
  if (ctx.role !== "MEMBER") assertPermission(ctx, "members.read");

  const membership = await prisma.departmentMembership.findFirst({
    where: { id: membershipId, departmentId: ctx.departmentId },
    include: {
      user: true,
      notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
      assignments: {
        include: {
          assignedBy: true,
          evaluator: true,
          supervisor: true,
          version: { include: { template: true, sections: { orderBy: { sortOrder: "asc" }, include: { requirements: { orderBy: { sortOrder: "asc" } } } } } },
          completions: { include: { evidence: true, signOffs: { include: { evaluator: true }, orderBy: { signedAt: "desc" } } } },
        },
        orderBy: { assignedDate: "desc" },
      },
      credentials: { include: { credentialType: true }, orderBy: { credentialName: "asc" } },
    },
  });
  if (!membership) throw new HttpError(404, "Member not found.");

  const events = await prisma.activityEvent.findMany({
    where: { departmentId: ctx.departmentId, userId: membership.userId },
    include: { user: true },
    orderBy: { timestamp: "desc" },
    take: 50,
  });

  const summary = summarizeMember(
    {
      ...membership,
      assignments: membership.assignments.map((assignment) => ({
        ...assignment,
        version: assignment.version,
        completions: assignment.completions,
      })),
    },
    events[0]?.timestamp ?? null,
  );

  const evidence = membership.assignments.flatMap((assignment) =>
    assignment.completions.flatMap((completion) => {
      const requirement = assignment.version.sections
        .flatMap((section) => section.requirements)
        .find((item) => item.id === completion.requirementId);
      return completion.evidence.map((item) => ({
        ...item,
        requirementTitle: requirement?.title ?? "Requirement",
        taskBookTitle: assignment.version.template.title,
        memberNotes: completion.memberNotes,
      }));
    }),
  );

  const isSelf = ctx.membershipId === membershipId;
  const canSeeCredentials = isSelf || hasPermission(ctx.role, "credentials.read");
  const canSeeDepartmentNotes = hasPermission(ctx.role, "notes.write");
  const canSeeFullActivity = ctx.role === "TRAINING_OFFICER" || ctx.role === "DEPARTMENT_ADMINISTRATOR" || isSelf;
  const restrictedSummary =
    ctx.role === "EVALUATOR" && !isSelf
      ? {
          ...summary,
          email: "",
          phone: null,
          employeeNumber: null,
          certificationHealth: "restricted" as typeof summary.certificationHealth,
          credentials: [],
        }
      : summary;

  return {
    ...restrictedSummary,
    notes: canSeeDepartmentNotes
      ? membership.notes.map((note) => ({
          id: note.id,
          body: note.body,
          createdAt: note.createdAt,
          authorName: note.author.name,
        }))
      : [],
    assignmentDetails: membership.assignments.map((assignment) => {
      const requirements = assignment.version.sections.flatMap((section) => section.requirements);
      const progress = computeAssignmentProgress({
        requirements,
        completions: assignment.completions,
        assignedDate: assignment.assignedDate,
        dueDate: assignment.dueDate,
      });
      return {
        id: assignment.id,
        taskBookTitle: assignment.version.template.title,
        templateId: assignment.version.template.id,
        version: assignment.version.version,
        assignedDate: assignment.assignedDate,
        dueDate: assignment.dueDate,
        assignedByName: assignment.assignedBy.name,
        evaluatorName: assignment.evaluator?.name ?? null,
        supervisorName: assignment.supervisor?.name ?? null,
        notes: ctx.role === "EVALUATOR" && !isSelf ? "" : assignment.notes,
        progress,
        sections: assignment.version.sections.map((section) => ({
          id: section.id,
          title: section.title,
          description: section.description,
          requirements: section.requirements.map((requirement) => {
            const completion = assignment.completions.find((item) => item.requirementId === requirement.id);
            return {
              ...requirement,
              internalNotes: ctx.role === "DEPARTMENT_ADMINISTRATOR" || ctx.role === "TRAINING_OFFICER" ? requirement.internalNotes : "",
              objectives: JSON.parse(requirement.objectivesJson || "[]"),
              completion: completion
                ? {
                    id: completion.id,
                    status: completion.status,
                    memberNotes: completion.memberNotes,
                    submittedAt: completion.submittedAt,
                    completedAt: completion.completedAt,
                    evidence: completion.evidence,
                    signOffs: completion.signOffs.map((sign) => ({
                      id: sign.id,
                      result: sign.result,
                      notes: sign.notes,
                      signedAt: sign.signedAt,
                      evaluatorName: sign.evaluator.name,
                    })),
                  }
                : null,
            };
          }),
        })),
      };
    }),
    credentialDetails: canSeeCredentials
      ? membership.credentials.map((credential) => ({
          ...credential,
          ...credentialStatus(credential.expirationDate, undefined, credential.doesNotExpire),
        }))
      : [],
    evidence,
    activity: canSeeFullActivity
      ? events.map((event) => ({
          id: event.id,
          type: event.type,
          timestamp: event.timestamp,
          metadata: JSON.parse(event.metadataJson || "{}"),
          actorName: event.user?.name ?? null,
        }))
      : [],
  };
}

export async function updateMember(
  ctx: AuthContext,
  membershipId: string,
  input: {
    role?: Role;
    status?: MembershipStatus;
    rank?: string | null;
    position?: string | null;
    station?: string | null;
    shift?: string | null;
    employeeNumber?: string | null;
  },
) {
  assertPermission(ctx, "members.write");
  const membership = await prisma.departmentMembership.findFirst({
    where: { id: membershipId, departmentId: ctx.departmentId },
  });
  if (!membership) throw new HttpError(404, "Member not found.");
  if (input.role && input.role !== membership.role) {
    assertPermission(ctx, "roles.write");
  }
  const updated = await prisma.departmentMembership.update({
    where: { id: membership.id },
    data: {
      role: input.role ?? membership.role,
      status: input.status ?? membership.status,
      rank: input.rank === undefined ? membership.rank : input.rank,
      position: input.position === undefined ? membership.position : input.position,
      station: input.station === undefined ? membership.station : input.station,
      shift: input.shift === undefined ? membership.shift : input.shift,
      employeeNumber: input.employeeNumber === undefined ? membership.employeeNumber : input.employeeNumber,
    },
  });
  if (input.role && input.role !== membership.role) {
    await writeAudit(ctx, "membership.role_change", "DepartmentMembership", membership.id, {
      from: membership.role,
      to: input.role,
    });
  }
  if (input.status && input.status !== membership.status) {
    await writeAudit(ctx, "membership.status_change", "DepartmentMembership", membership.id, {
      from: membership.status,
      to: input.status,
    });
  }
  return updated;
}

export async function addMemberNote(ctx: AuthContext, membershipId: string, body: string) {
  assertPermission(ctx, "notes.write");
  const membership = await prisma.departmentMembership.findFirst({
    where: { id: membershipId, departmentId: ctx.departmentId },
  });
  if (!membership) throw new HttpError(404, "Member not found.");
  if (!body.trim()) throw new HttpError(400, "Note text is required.");
  const note = await prisma.memberNote.create({
    data: {
      membershipId,
      departmentId: ctx.departmentId,
      authorId: ctx.userId,
      body: body.trim(),
    },
    include: { author: true },
  });
  await writeActivity(ctx.departmentId, "NOTE_ADDED", {
    userId: membership.userId,
    referenceId: note.id,
    metadata: { authorName: ctx.name },
  });
  return note;
}

export async function approveMembership(ctx: AuthContext, membershipId: string, approve: boolean) {
  assertPermission(ctx, "members.write");
  const membership = await prisma.departmentMembership.findFirst({
    where: { id: membershipId, departmentId: ctx.departmentId },
  });
  if (!membership) throw new HttpError(404, "Member not found.");
  const updated = await prisma.departmentMembership.update({
    where: { id: membership.id },
    data: { status: approve ? "ACTIVE" : "REJECTED" },
  });
  await writeAudit(ctx, approve ? "membership.approved" : "membership.rejected", "DepartmentMembership", membership.id, {});
  return updated;
}
