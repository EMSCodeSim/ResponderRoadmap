import { getSession, clearSessionCookie, requireDepartmentSession } from "@/server/session";
import { handleError, jsonError, jsonOk } from "@/server/http";
import * as auth from "@/server/services/auth";
import * as members from "@/server/services/members";
import * as taskbooks from "@/server/services/taskbooks";
import * as assignments from "@/server/services/assignments";
import * as credentials from "@/server/services/credentials";
import * as dashboard from "@/server/services/dashboard";
import * as reports from "@/server/services/reports";
import * as department from "@/server/services/department";
import { activityText } from "@/lib/activity";
import { parseMetadata } from "@/server/http";
import { navItemsForRole } from "@/server/permissions";
import type { Role } from "@/lib/constants";

function match(path: string[], pattern: string) {
  const parts = pattern.split("/").filter(Boolean);
  if (parts.length !== path.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith(":")) params[parts[i].slice(1)] = decodeURIComponent(path[i]);
    else if (parts[i] !== path[i]) return null;
  }
  return params;
}

async function readBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function handleApi(req: Request, path: string[]) {
  try {
    const method = req.method;
    const url = new URL(req.url);
    const q = Object.fromEntries(url.searchParams.entries());

    if (method === "POST" && match(path, "auth/login")) {
      const body = await readBody(req);
      const result = await auth.login(body.email || "", body.password || "");
      return jsonOk(result);
    }
    if (method === "POST" && match(path, "auth/register")) {
      const body = await readBody(req);
      const result = await auth.register(body);
      return jsonOk(result);
    }
    if (method === "POST" && match(path, "auth/logout")) {
      await clearSessionCookie();
      return jsonOk({ ok: true });
    }
    if (method === "GET" && match(path, "auth/me")) {
      const session = await getSession();
      if (!session) return jsonError("Authentication required.", 401);
      return jsonOk({
        ...session,
        nav: session.role ? navItemsForRole(session.role) : ["dashboard", "settings"],
      });
    }

    const session = await getSession();
    if (!session) return jsonError("Authentication required.", 401);

    if (method === "POST" && match(path, "departments")) {
      const body = await readBody(req);
      const created = await auth.createDepartment(session.userId, body);
      return jsonOk(created, 201);
    }
    if (method === "POST" && match(path, "join")) {
      const body = await readBody(req);
      const result = await department.joinByCode(session.userId, body.joinCode || "");
      return jsonOk(result);
    }
    if (method === "POST" && match(path, "invitations/accept")) {
      const body = await readBody(req);
      const result = await department.acceptInvitation(session.userId, body.token || "");
      return jsonOk(result);
    }
    if (method === "PATCH" && match(path, "account")) {
      const body = await readBody(req);
      const updated = await department.updateAccount(session.userId, body);
      return jsonOk({ id: updated.id, name: updated.name, email: updated.email, phone: updated.phone });
    }

    const ctx = requireDepartmentSession(session);

    if (method === "GET" && match(path, "dashboard")) return jsonOk(await dashboard.getDashboard(ctx));

    if (method === "GET" && match(path, "members")) return jsonOk(await members.listMembers(ctx, q));
    const memberId = match(path, "members/:id");
    if (method === "GET" && memberId) return jsonOk(await members.getMember(ctx, memberId.id));
    if (method === "PATCH" && memberId) {
      const body = await readBody(req);
      return jsonOk(await members.updateMember(ctx, memberId.id, body));
    }
    if (method === "POST" && match(path, `members/${memberId?.id}/notes`)) {
      /* handled below */
    }
    const memberNotes = match(path, "members/:id/notes");
    if (method === "POST" && memberNotes) {
      const body = await readBody(req);
      return jsonOk(await members.addMemberNote(ctx, memberNotes.id, body.body || ""), 201);
    }
    const memberApprove = match(path, "members/:id/approve");
    if (method === "POST" && memberApprove) {
      const body = await readBody(req);
      return jsonOk(await members.approveMembership(ctx, memberApprove.id, body.approve !== false));
    }

    if (method === "GET" && match(path, "task-books")) return jsonOk(await taskbooks.listTaskBooks(ctx, q));
    if (method === "GET" && match(path, "task-books/starters")) return jsonOk(taskbooks.listStarters());
    if (method === "POST" && match(path, "task-books")) {
      const body = await readBody(req);
      return jsonOk(await taskbooks.createTaskBook(ctx, body), 201);
    }
    const tbDup = match(path, "task-books/:id/duplicate");
    if (method === "POST" && tbDup) return jsonOk(await taskbooks.duplicateTaskBook(ctx, tbDup.id), 201);
    const tbReview = match(path, "task-books/:id/review");
    if (method === "GET" && tbReview) return jsonOk(await taskbooks.getTaskBookReview(ctx, tbReview.id));
    const tb = match(path, "task-books/:id");
    if (method === "GET" && tb) return jsonOk(await taskbooks.getTaskBook(ctx, tb.id));
    if (method === "PATCH" && tb) {
      const body = await readBody(req);
      return jsonOk(await taskbooks.updateTaskBookMeta(ctx, tb.id, body));
    }
    const tbDraft = match(path, "task-books/:id/draft");
    if (method === "PUT" && tbDraft) {
      const body = await readBody(req);
      return jsonOk(await taskbooks.saveDraftStructure(ctx, tbDraft.id, body.sections || []));
    }
    const tbPublish = match(path, "task-books/:id/publish");
    if (method === "POST" && tbPublish) {
      const body = await readBody(req);
      return jsonOk(await taskbooks.publishTaskBook(ctx, tbPublish.id, { force: Boolean(body.force) }));
    }
    const tbVersion = match(path, "task-books/:id/new-version");
    if (method === "POST" && tbVersion) return jsonOk(await taskbooks.startNewVersion(ctx, tbVersion.id));

    if (method === "GET" && match(path, "assignments")) return jsonOk(await assignments.listAssignments(ctx));
    if (method === "POST" && match(path, "assignments")) {
      const body = await readBody(req);
      return jsonOk(await assignments.createAssignments(ctx, body), 201);
    }
    if (method === "GET" && match(path, "evaluators")) return jsonOk(await assignments.listEvaluators(ctx));
    const asgPrint = match(path, "assignments/:id/print");
    if (method === "GET" && asgPrint) return jsonOk(await assignments.getPrintRecord(ctx, asgPrint.id));
    const asgDetail = match(path, "assignments/:id/detail");
    if (method === "GET" && asgDetail) return jsonOk(await assignments.getAssignmentDetail(ctx, asgDetail.id));
    const asgSubmit = match(path, "assignments/:id/requirements/:reqId/submit");
    if (method === "POST" && asgSubmit) {
      const body = await readBody(req);
      return jsonOk(await assignments.submitRequirement(ctx, asgSubmit.id, asgSubmit.reqId, body));
    }
    const asg = match(path, "assignments/:id");
    if (method === "GET" && asg) return jsonOk(await assignments.getAssignmentDetail(ctx, asg.id));

    if (method === "GET" && match(path, "sign-offs")) return jsonOk(await assignments.listSignOffQueue(ctx, q));
    const so = match(path, "sign-offs/:id");
    if (method === "POST" && so) {
      const body = await readBody(req);
      return jsonOk(await assignments.reviewSignOff(ctx, so.id, body));
    }

    if (method === "GET" && match(path, "credentials")) return jsonOk(await credentials.listCredentials(ctx, q));
    if (method === "POST" && match(path, "credentials")) {
      const body = await readBody(req);
      return jsonOk(await credentials.upsertCredential(ctx, body), 201);
    }
    if (method === "GET" && match(path, "credential-types")) return jsonOk(await credentials.listCredentialTypes(ctx));
    if (method === "POST" && match(path, "credential-types")) {
      const body = await readBody(req);
      return jsonOk(await credentials.createCredentialType(ctx, body), 201);
    }

    if (method === "GET" && match(path, "department")) return jsonOk(await department.getDepartment(ctx));
    if (method === "PATCH" && match(path, "department")) {
      const body = await readBody(req);
      return jsonOk(await department.updateDepartment(ctx, body));
    }
    if (method === "GET" && match(path, "invitations")) return jsonOk(await department.listInvitations(ctx));
    if (method === "POST" && match(path, "invitations")) {
      const body = await readBody(req);
      return jsonOk(await department.createInvitation(ctx, body), 201);
    }

    if (method === "GET" && match(path, "activity")) {
      const events = await department.listActivity(ctx);
      return jsonOk(
        events.map((event) => ({
          id: event.id,
          type: event.type,
          timestamp: event.timestamp,
          text: activityText(event.type, parseMetadata(event.metadataJson), event.user?.name ?? null),
          metadata: parseMetadata(event.metadataJson),
        })),
      );
    }

    if (method === "GET" && match(path, "reports/task-book-progress")) {
      return jsonOk(await reports.taskBookProgressReport(ctx, q));
    }
    if (method === "GET" && match(path, "reports/certifications")) {
      return jsonOk(await reports.certificationReport(ctx, q));
    }
    const training = match(path, "reports/training-record/:id");
    if (method === "GET" && training) return jsonOk(await reports.memberTrainingRecord(ctx, training.id));
    if (method === "GET" && match(path, "reports/compliance")) return jsonOk(await reports.complianceSnapshot(ctx));

    return jsonError("Not found.", 404);
  } catch (error) {
    return handleError(error);
  }
}

export type { Role };
