import { prisma } from "@/server/db";
import { HttpError, writeAudit } from "@/server/http";
import { assertPermission, type AuthContext } from "@/server/permissions";

export async function listSkillEvidenceEquivalencies(ctx: AuthContext) {
  assertPermission(ctx, "taskbooks.read");
  return prisma.skillEvidenceEquivalency.findMany({
    where: { departmentId: ctx.departmentId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function listEligibleSkillRequirements(ctx: AuthContext) {
  assertPermission(ctx, "taskbooks.read");
  const rows = await prisma.taskBookRequirement.findMany({
    where: { section: { version: { status: "PUBLISHED", template: { departmentId: ctx.departmentId } } } },
    select: { id: true, title: true, section: { select: { version: { select: { template: { select: { title: true } } } } } } } },
    orderBy: { title: "asc" },
    take: 1000,
  });
  return rows.map((item) => ({ id: item.id, title: item.title, taskBook: item.section.version.template.title }));
}

export async function approveSkillEvidenceEquivalency(
  ctx: AuthContext,
  input: { sourceRequirementId?: string; targetRequirementId?: string; reason?: string },
) {
  assertPermission(ctx, "taskbooks.publish");
  const sourceRequirementId = input.sourceRequirementId?.trim() || "";
  const targetRequirementId = input.targetRequirementId?.trim() || "";
  const reason = input.reason?.trim() || "";
  if (!sourceRequirementId || !targetRequirementId || sourceRequirementId === targetRequirementId) {
    throw new HttpError(400, "Choose two different existing skills.");
  }
  if (reason.length < 10 || reason.length > 2000) {
    throw new HttpError(400, "Document the equivalency rationale (10–2000 characters).");
  }
  const requirements = await prisma.taskBookRequirement.findMany({
    where: {
      id: { in: [sourceRequirementId, targetRequirementId] },
      section: { version: { template: { departmentId: ctx.departmentId } } },
    },
    include: { section: { include: { version: true } } },
  });
  if (requirements.length !== 2 || requirements.some((item) => item.section.version.status !== "PUBLISHED")) {
    throw new HttpError(400, "Both skills must belong to published Task Books in this department.");
  }
  const record = await prisma.skillEvidenceEquivalency.upsert({
    where: { departmentId_sourceRequirementId_targetRequirementId: { departmentId: ctx.departmentId, sourceRequirementId, targetRequirementId } },
    create: { departmentId: ctx.departmentId, sourceRequirementId, targetRequirementId, reason, approvedById: ctx.userId },
    update: { reason, approvedById: ctx.userId, approvedAt: new Date(), revokedAt: null, revokedById: null },
  });
  await writeAudit(ctx, "skill_equivalency.approved", "SkillEvidenceEquivalency", record.id, { sourceRequirementId, targetRequirementId, reason });
  return record;
}

export async function revokeSkillEvidenceEquivalency(ctx: AuthContext, id: string) {
  assertPermission(ctx, "taskbooks.publish");
  const existing = await prisma.skillEvidenceEquivalency.findFirst({ where: { id, departmentId: ctx.departmentId, revokedAt: null } });
  if (!existing) throw new HttpError(404, "Approved equivalency not found.");
  const record = await prisma.skillEvidenceEquivalency.update({
    where: { id }, data: { revokedAt: new Date(), revokedById: ctx.userId },
  });
  await writeAudit(ctx, "skill_equivalency.revoked", "SkillEvidenceEquivalency", record.id, { sourceRequirementId: record.sourceRequirementId, targetRequirementId: record.targetRequirementId });
  return record;
}
