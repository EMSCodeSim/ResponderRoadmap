import { prisma } from "@/server/db";
import { HttpError, writeAudit } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";

const STATUSES = new Set(["NOT_STARTED", "IN_TRAINING", "AWAITING_APPROVAL", "APPROVED", "RESTRICTED", "RENEWAL_REQUIRED"]);
const parse = (value: string) => { try { const v = JSON.parse(value || "[]"); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } };

async function membership(ctx: AuthContext) {
  return prisma.departmentMembership.findFirst({ where: { id: ctx.membershipId, departmentId: ctx.departmentId }, select: { id: true, role: true, rank: true, position: true } });
}

function officerLookupAllowed(row: { role: string; rank: string | null; position: string | null } | null) {
  if (!row) return false;
  if (["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"].includes(row.role)) return true;
  const title = `${row.position || ""} ${row.rank || ""}`.toUpperCase();
  return /\b(?:ACTING\s+OFFICER|OFFICER|LIEUTENANT|CAPTAIN|CHIEF)\b/.test(title);
}

export async function listRoles(ctx: AuthContext) {
  return prisma.operationalRole.findMany({ where: { departmentId: ctx.departmentId, archived: false }, orderBy: [{ category: "asc" }, { name: "asc" }] });
}

type CreateRoleInput = {
  name?: unknown;
  category?: unknown;
  description?: unknown;
  credentialTypeIds?: unknown[];
  taskBookTemplateIds?: unknown[];
  requirementIds?: unknown[];
  manualApprovalRequired?: boolean;
};

type AuthorizationInput = {
  status?: unknown;
  restriction?: unknown;
  note?: unknown;
  reviewDate?: string | null;
};

type QualificationEvidenceItem = {
  type: "CREDENTIAL" | "TASK_BOOK" | "SKILL";
  id: string;
  label: string;
  complete: boolean;
  detail: string;
  supportId: string | null;
  nextOwner?: string | null;
};

export async function createRole(ctx: AuthContext, input: CreateRoleInput) {
  assertPermission(ctx, "members.write");
  const name = String(input.name || "").trim().slice(0, 180);
  if (!name) throw new HttpError(400, "Role name is required.");
  const cleanIds = (values: unknown[] | undefined, label: string) => {
    if (values !== undefined && !Array.isArray(values)) throw new HttpError(400, `${label} must be a list.`);
    return [...new Set((values || []).map((value) => String(value).trim()).filter(Boolean))];
  };
  const credentialTypeIds = cleanIds(input.credentialTypeIds, "Credential requirements");
  const taskBookTemplateIds = cleanIds(input.taskBookTemplateIds, "Task Book requirements");
  const requirementIds = cleanIds(input.requirementIds, "Skill requirements");
  const [credentialTypes, templates, requirements] = await Promise.all([
    prisma.credentialType.findMany({ where: { id: { in: credentialTypeIds }, departmentId: ctx.departmentId }, select: { id: true } }),
    prisma.taskBookTemplate.findMany({ where: { id: { in: taskBookTemplateIds }, departmentId: ctx.departmentId }, select: { id: true } }),
    prisma.taskBookRequirement.findMany({ where: { id: { in: requirementIds }, section: { version: { template: { departmentId: ctx.departmentId } } } }, select: { id: true } }),
  ]);
  if (credentialTypes.length !== credentialTypeIds.length || templates.length !== taskBookTemplateIds.length || requirements.length !== requirementIds.length) {
    throw new HttpError(400, "Qualification requirements must belong to this department.");
  }
  const row = await prisma.operationalRole.create({ data: {
    departmentId: ctx.departmentId, name, category: String(input.category || "OPERATIONS").trim().toUpperCase().slice(0, 80),
    description: String(input.description || "").trim().slice(0, 2000), credentialTypeIdsJson: JSON.stringify(credentialTypeIds),
    taskBookTemplateIdsJson: JSON.stringify(taskBookTemplateIds), requirementIdsJson: JSON.stringify(requirementIds),
    manualApprovalRequired: input.manualApprovalRequired !== false, createdById: ctx.userId,
  }});
  await writeAudit(ctx, "qualification.role.created", "OperationalRole", row.id, { name });
  return row;
}

async function readinessFor(ctx: AuthContext, membershipId: string) {
  const [roles, auths, creds, assignments, completions] = await Promise.all([
    listRoles(ctx),
    prisma.memberOperationalAuthorization.findMany({ where: { departmentId: ctx.departmentId, membershipId } }),
    prisma.credential.findMany({ where: { departmentId: ctx.departmentId, membershipId }, select: { id: true, credentialTypeId: true, credentialName: true, expirationDate: true, doesNotExpire: true, verificationStatus: true } }),
    prisma.taskBookAssignment.findMany({ where: { departmentId: ctx.departmentId, membershipId }, include: { version: { select: { templateId: true, template: { select: { title: true } } } } } }),
    prisma.requirementCompletion.findMany({ where: { membershipId }, select: { id: true, requirementId: true, status: true, completedAt: true, requestedEvaluatorId: true, signOffs: { where: { result: "APPROVED" }, orderBy: { signedAt: "desc" }, take: 1, select: { evaluatorId: true, signedAt: true } } } }),
  ]);
  const authByRole = new Map(auths.map(a => [a.roleId, a]));
  const todayUtc = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const validCreds = creds.filter(c => c.credentialTypeId && c.verificationStatus === "VERIFIED" && (c.doesNotExpire || (c.expirationDate && c.expirationDate.getTime() >= todayUtc)));
  const validCredentialIds = new Set(validCreds.map(c => c.credentialTypeId!));
  const completedAssignments = assignments.filter(a => a.status === "COMPLETE");
  const completedTemplates = new Set(completedAssignments.map(a => a.version.templateId));
  const approvedCompletions = completions.filter(c => c.status === "APPROVED");
  const approvedRequirements = new Set(approvedCompletions.map(c => c.requirementId));

  const allCredentialIds = [...new Set(roles.flatMap(role => parse(role.credentialTypeIdsJson)))];
  const allTemplateIds = [...new Set(roles.flatMap(role => parse(role.taskBookTemplateIdsJson)))];
  const allRequirementIds = [...new Set(roles.flatMap(role => parse(role.requirementIdsJson)))];
  const [credentialTypes, templates, requirements] = await Promise.all([
    prisma.credentialType.findMany({ where: { departmentId: ctx.departmentId, id: { in: allCredentialIds } }, select: { id: true, name: true } }),
    prisma.taskBookTemplate.findMany({ where: { departmentId: ctx.departmentId, id: { in: allTemplateIds } }, select: { id: true, title: true } }),
    prisma.taskBookRequirement.findMany({ where: { id: { in: allRequirementIds }, section: { version: { template: { departmentId: ctx.departmentId } } } }, select: { id: true, title: true } }),
  ]);
  const credentialNames = new Map(credentialTypes.map(row => [row.id, row.name]));
  const templateNames = new Map(templates.map(row => [row.id, row.title]));
  const requirementNames = new Map(requirements.map(row => [row.id, row.title]));
  const relevantUserIds = [...new Set([
    ...auths.map(a => a.approvedById).filter((id): id is string => Boolean(id)),
    ...completions.map(c => c.requestedEvaluatorId).filter((id): id is string => Boolean(id)),
    ...approvedCompletions.flatMap(c => c.signOffs.map(s => s.evaluatorId)),
  ])];
  const users = await prisma.user.findMany({ where: { id: { in: relevantUserIds } }, select: { id: true, name: true } });
  const userNames = new Map(users.map(user => [user.id, user.name]));

  return roles.map(role => {
    const credentialIds = parse(role.credentialTypeIdsJson); const taskBookIds = parse(role.taskBookTemplateIdsJson); const requirementIds = parse(role.requirementIdsJson);
    const missingCredentials = credentialIds.filter(id => !validCredentialIds.has(id));
    const missingTaskBooks = taskBookIds.filter(id => !completedTemplates.has(id));
    const missingRequirements = requirementIds.filter(id => !approvedRequirements.has(id));
    const requirementsMet = !missingCredentials.length && !missingTaskBooks.length && !missingRequirements.length;
    const authorization = authByRole.get(role.id);
    const status = authorization?.status === "APPROVED" && requirementsMet ? "APPROVED" : authorization?.status === "APPROVED" ? "RENEWAL_REQUIRED" : authorization?.status || (requirementsMet ? "AWAITING_APPROVAL" : "IN_TRAINING");
    const evidence: QualificationEvidenceItem[] = [
      ...credentialIds.map(id => {
        const credential = validCreds.find(c => c.credentialTypeId === id);
        return { type: "CREDENTIAL" as const, id, label: credentialNames.get(id) || credential?.credentialName || "Credential", complete: Boolean(credential), detail: credential ? (credential.doesNotExpire ? "Verified · does not expire" : `Verified · expires ${credential.expirationDate?.toISOString().slice(0, 10)}`) : "Current verified credential required", supportId: credential?.id || null };
      }),
      ...taskBookIds.map(id => {
        const assignment = completedAssignments.find(a => a.version.templateId === id);
        return { type: "TASK_BOOK" as const, id, label: templateNames.get(id) || assignment?.version.template.title || "Task Book", complete: Boolean(assignment), detail: assignment ? "Task Book complete" : "Task Book completion required", supportId: assignment?.id || null };
      }),
      ...requirementIds.map(id => {
        const completion = approvedCompletions.find(c => c.requirementId === id);
        const signOff = completion?.signOffs[0];
        const pending = completions.find(c => c.requirementId === id);
        const ownerId = pending?.requestedEvaluatorId || null;
        return { type: "SKILL" as const, id, label: requirementNames.get(id) || "Skill requirement", complete: Boolean(completion), detail: signOff ? `Signed off by ${userNames.get(signOff.evaluatorId) || "authorized evaluator"} · ${signOff.signedAt.toISOString().slice(0, 10)}` : completion ? "Approved skill requirement" : "Approved evaluation required", supportId: completion?.id || null, nextOwner: ownerId ? userNames.get(ownerId) || "Assigned evaluator" : null };
      }),
    ];
    const nextAction = !requirementsMet
      ? (() => { const item = evidence.find(item => !item.complete); return { owner: item?.nextOwner || "Member / assigned evaluator", action: item ? `Complete ${item.label}` : "Complete remaining requirements" }; })()
      : status === "AWAITING_APPROVAL"
        ? { owner: "Training Officer / Department Administrator", action: "Record department authorization" }
        : status === "RENEWAL_REQUIRED"
          ? { owner: "Member / Training Officer", action: "Renew missing or expired requirement" }
          : { owner: "None", action: "No action required" };
    return { id: role.id, name: role.name, category: role.category, description: role.description, status, requirementsMet,
      missing: { credentialTypeIds: missingCredentials, taskBookTemplateIds: missingTaskBooks, requirementIds: missingRequirements }, evidence, nextAction,
      authorization: authorization ? { id: authorization.id, restriction: authorization.restriction, note: authorization.note, approvedAt: authorization.approvedAt, approvedById: authorization.approvedById, approvedByName: authorization.approvedById ? userNames.get(authorization.approvedById) || null : null, reviewDate: authorization.reviewDate } : null };
  });
}

export async function myQualifications(ctx: AuthContext) { return { roles: await readinessFor(ctx, ctx.membershipId) }; }

export async function departmentQualificationsForApp(ctx: AuthContext) {
  const me = await membership(ctx);
  if (!officerLookupAllowed(me)) throw new HttpError(403, "Acting Officer or higher access is required.");
  const members = await prisma.departmentMembership.findMany({ where: { departmentId: ctx.departmentId, status: "ACTIVE" }, include: { user: true }, orderBy: { user: { name: "asc" } } });
  const rows = [];
  for (const member of members) rows.push({ membershipId: member.id, name: member.user.name, rank: member.rank, position: member.position, qualifications: await readinessFor(ctx, member.id) });
  return { members: rows };
}

export async function setAuthorization(ctx: AuthContext, membershipId: string, roleId: string, input: AuthorizationInput) {
  assertPermission(ctx, "members.write");
  const status = String(input.status || "").toUpperCase();
  if (!STATUSES.has(status)) throw new HttpError(400, "Invalid qualification status.");
  const [member, role] = await Promise.all([
    prisma.departmentMembership.findFirst({ where: { id: membershipId, departmentId: ctx.departmentId } }),
    prisma.operationalRole.findFirst({ where: { id: roleId, departmentId: ctx.departmentId } }),
  ]);
  if (!member || !role) throw new HttpError(404, "Member or qualification role not found.");
  if (input.reviewDate && Number.isNaN(new Date(input.reviewDate).getTime())) throw new HttpError(400, "Review date is invalid.");
  if (status === "APPROVED") {
    const readiness = await readinessFor(ctx, membershipId);
    const target = readiness.find((item) => item.id === roleId);
    if (!target?.requirementsMet) throw new HttpError(409, "Required credentials, Task Books, and approved skills must be current before this authorization can be approved.");
  }
  const previous = await prisma.memberOperationalAuthorization.findUnique({ where: { membershipId_roleId: { membershipId, roleId } } });
  const row = await prisma.memberOperationalAuthorization.upsert({ where: { membershipId_roleId: { membershipId, roleId } }, create: {
    departmentId: ctx.departmentId, membershipId, roleId, status, restriction: String(input.restriction || "").trim().slice(0, 180), note: String(input.note || "").trim().slice(0, 2000),
    approvedById: status === "APPROVED" ? ctx.userId : null, approvedAt: status === "APPROVED" ? new Date() : null,
    reviewDate: input.reviewDate ? new Date(input.reviewDate) : null, updatedById: ctx.userId,
  }, update: { status, restriction: String(input.restriction || "").trim().slice(0, 180), note: String(input.note || "").trim().slice(0, 2000), approvedById: status === "APPROVED" ? ctx.userId : previous?.approvedById,
    approvedAt: status === "APPROVED" ? new Date() : previous?.approvedAt, reviewDate: input.reviewDate ? new Date(input.reviewDate) : null, updatedById: ctx.userId } });
  await writeAudit(ctx, "qualification.authorization.changed", "MemberOperationalAuthorization", row.id, { membershipId, roleId, priorStatus: previous?.status || null, status, reason: row.note });
  return row;
}
