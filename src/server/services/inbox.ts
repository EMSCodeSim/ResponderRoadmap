import { GoogleAuth } from "google-auth-library";
import { reviewStageForRequirement } from "@/lib/signoff";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/http";
import type { AuthContext } from "@/server/permissions";

type NotificationInput = {
  departmentId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  referenceType?: string;
  referenceId?: string;
  actionPath?: string;
  dedupeKey?: string;
};

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function sendPush(notification: { id: string; userId: string; title: string; body: string; type: string; referenceId: string | null; actionPath: string | null }) {
  const account = serviceAccount();
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || String(account?.project_id || "");
  if (!account || !projectId) {
    await prisma.inboxNotification.update({ where: { id: notification.id }, data: { pushStatus: "NOT_CONFIGURED" } });
    return;
  }
  const devices = await prisma.pushDevice.findMany({ where: { userId: notification.userId, enabled: true } });
  if (!devices.length) {
    await prisma.inboxNotification.update({ where: { id: notification.id }, data: { pushStatus: "NO_DEVICE" } });
    return;
  }
  try {
    const auth = new GoogleAuth({ credentials: account, scopes: ["https://www.googleapis.com/auth/firebase.messaging"] });
    const client = await auth.getClient();
    const access = await client.getAccessToken();
    const token = typeof access === "string" ? access : access.token;
    if (!token) throw new Error("Firebase access token was unavailable.");
    const failures: string[] = [];
    for (const device of devices) {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: device.token,
            notification: { title: notification.title, body: notification.body },
            data: {
              notificationId: notification.id,
              type: notification.type,
              referenceId: notification.referenceId || "",
              actionPath: notification.actionPath || "",
            },
            android: { priority: "high" },
            apns: { payload: { aps: { sound: "default", badge: 1 } } },
          },
        }),
      });
      if (!response.ok) failures.push(`${device.platform}:${response.status}`);
    }
    await prisma.inboxNotification.update({
      where: { id: notification.id },
      data: {
        pushStatus: failures.length === devices.length ? "FAILED" : failures.length ? "PARTIAL" : "SENT",
        pushAttemptedAt: new Date(),
        pushError: failures.length ? failures.join(", ") : null,
      },
    });
  } catch (error) {
    await prisma.inboxNotification.update({
      where: { id: notification.id },
      data: { pushStatus: "FAILED", pushAttemptedAt: new Date(), pushError: error instanceof Error ? error.message.slice(0, 500) : "Push failed" },
    });
  }
}

export async function notifyUser(input: NotificationInput) {
  const notification = await prisma.inboxNotification.upsert({
    where: { userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey || `event:${crypto.randomUUID()}` } },
    create: { ...input, dedupeKey: input.dedupeKey || null },
    update: {},
  });
  if (notification.pushStatus === "PENDING") await sendPush(notification);
  return notification;
}

export async function registerDevice(ctx: AuthContext, input: { token?: string; platform?: string }) {
  const token = input.token?.trim();
  if (!token) throw new HttpError(400, "Push token is required.");
  const platform = input.platform === "ios" ? "ios" : input.platform === "android" ? "android" : "unknown";
  return prisma.pushDevice.upsert({
    where: { token },
    create: { token, platform, userId: ctx.userId, departmentId: ctx.departmentId },
    update: { platform, userId: ctx.userId, departmentId: ctx.departmentId, enabled: true, lastSeenAt: new Date() },
    select: { id: true, platform: true, enabled: true, lastSeenAt: true },
  });
}

export async function unregisterDevice(ctx: AuthContext, tokenValue: string) {
  const token = tokenValue.trim();
  if (!token) return { ok: true };
  await prisma.pushDevice.updateMany({ where: { token, userId: ctx.userId }, data: { enabled: false, lastSeenAt: new Date() } });
  return { ok: true };
}

async function createEscalationsForDepartment(departmentId: string) {
  const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { evaluationEscalationHours: true } });
  const hours = Math.max(1, department?.evaluationEscalationHours ?? 48);
  const cutoff = new Date(Date.now() - hours * 3_600_000);
  const pending = await prisma.requirementCompletion.findMany({
    where: { status: "SUBMITTED", submittedAt: { lte: cutoff }, assignment: { departmentId } },
    include: {
      signOffs: true,
      membership: { include: { user: true } },
      requirement: { include: { section: { include: { version: { include: { template: true } } } } } },
      assignment: true,
    },
    take: 100,
  });
  for (const item of pending) {
    const stage = reviewStageForRequirement({
      evaluatorSignOffRequired: item.requirement.evaluatorSignOffRequired,
      supervisorApprovalRequired: item.requirement.supervisorApprovalRequired,
      signOffs: item.signOffs,
      submittedAt: item.submittedAt,
    });
    const assignedReviewer = stage === "SUPERVISOR" ? item.assignment.supervisorId : item.requestedEvaluatorId || item.assignment.evaluatorId;
    const recipients = assignedReviewer
      ? [{ userId: assignedReviewer }]
      : await prisma.departmentMembership.findMany({
          where: { departmentId, status: "ACTIVE", role: { in: ["TRAINING_OFFICER", "DEPARTMENT_ADMINISTRATOR"] } },
          select: { userId: true },
        });
    for (const recipient of recipients) {
      await notifyUser({
        departmentId,
        userId: recipient.userId,
        type: "EVALUATION_ESCALATED",
        title: "Evaluation overdue",
        body: `${item.membership.user.name} has waited more than ${hours} hours for ${item.requirement.title}.`,
        referenceType: "RequirementCompletion",
        referenceId: item.id,
        actionPath: "/evaluate",
        dedupeKey: `evaluation-escalation:${item.id}:${item.submittedAt?.toISOString() || "unknown"}`,
      });
    }
  }
}

export async function getInbox(ctx: AuthContext) {
  await createEscalationsForDepartment(ctx.departmentId);
  const [items, unreadCount, memberActions, evaluatorActions] = await Promise.all([
    prisma.inboxNotification.findMany({ where: { userId: ctx.userId, departmentId: ctx.departmentId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.inboxNotification.count({ where: { userId: ctx.userId, departmentId: ctx.departmentId, readAt: null } }),
    prisma.requirementCompletion.findMany({
      where: { membershipId: ctx.membershipId, status: "RETURNED" },
      include: { requirement: { include: { section: { include: { version: { include: { template: true } } } } } } },
      orderBy: { submittedAt: "desc" }, take: 50,
    }),
    ctx.role === "MEMBER" ? Promise.resolve([]) : prisma.requirementCompletion.findMany({
      where: { status: "SUBMITTED", assignment: { departmentId: ctx.departmentId } },
      include: { membership: { include: { user: true } }, requirement: true, assignment: true, signOffs: true },
      orderBy: { submittedAt: "asc" }, take: 100,
    }),
  ]);
  const reviewerItems = evaluatorActions.filter((item) => {
    if (ctx.role !== "EVALUATOR") return true;
    const stage = reviewStageForRequirement({
      evaluatorSignOffRequired: item.requirement.evaluatorSignOffRequired,
      supervisorApprovalRequired: item.requirement.supervisorApprovalRequired,
      signOffs: item.signOffs,
      submittedAt: item.submittedAt,
    });
    if (stage !== "EVALUATOR") return false;
    const owner = item.requestedEvaluatorId || item.assignment.evaluatorId;
    return !owner || owner === ctx.userId;
  });
  return {
    serverTime: new Date(),
    unreadCount,
    items,
    needsAction: [
      ...memberActions.map((item) => ({ id: item.id, kind: "MEMBER_CORRECTION", title: item.requirement.title, subtitle: item.requirement.section.version.template.title, submittedAt: item.submittedAt, actionPath: `/department/assignments/${item.assignmentId}` })),
      ...reviewerItems.map((item) => ({ id: item.id, kind: "EVALUATOR_REVIEW", title: item.requirement.title, subtitle: item.membership.user.name, submittedAt: item.submittedAt, actionPath: "/evaluate" })),
    ],
  };
}

export async function runEvaluationEscalations() {
  const departments = await prisma.department.findMany({ select: { id: true } });
  for (const department of departments) await createEscalationsForDepartment(department.id);
  return { departmentsChecked: departments.length, completedAt: new Date() };
}

export async function markRead(ctx: AuthContext, id: string) {
  const result = await prisma.inboxNotification.updateMany({ where: { id, userId: ctx.userId, departmentId: ctx.departmentId }, data: { readAt: new Date() } });
  if (!result.count) throw new HttpError(404, "Inbox item not found.");
  return { id, readAt: new Date() };
}

export async function markAllRead(ctx: AuthContext) {
  await prisma.inboxNotification.updateMany({ where: { userId: ctx.userId, departmentId: ctx.departmentId, readAt: null }, data: { readAt: new Date() } });
  return { ok: true };
}
