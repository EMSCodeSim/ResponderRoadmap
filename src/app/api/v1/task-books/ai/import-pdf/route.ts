import { DEMO_DEPARTMENT_ID } from "@/lib/demo-accounts";
import { withDemoDatabase } from "@/server/db";
import { handleError, jsonError, jsonOk } from "@/server/http";
import { getRequestSession, requireDepartmentSession } from "@/server/session";
import { pollPdfTaskBookImport, startPdfTaskBookImport } from "@/server/services/taskbook-ai";

export const maxDuration = 60;

async function start(req: Request) {
  try {
    const session = await getRequestSession(req);
    if (!session) return jsonError("Authentication required.", 401);
    const ctx = requireDepartmentSession(session);
    const body = await req.json().catch(() => ({}));
    return jsonOk(await startPdfTaskBookImport(ctx, { filename: body.filename, fileData: body.fileData, notes: body.notes }));
  } catch (error) { return handleError(error); }
}

async function poll(req: Request) {
  try {
    const session = await getRequestSession(req);
    if (!session) return jsonError("Authentication required.", 401);
    const ctx = requireDepartmentSession(session);
    const token = new URL(req.url).searchParams.get("job") || "";
    if (!token) return jsonError("PDF import job is required.", 400);
    return jsonOk(await pollPdfTaskBookImport(ctx, token));
  } catch (error) { return handleError(error); }
}

export async function POST(req: Request) {
  const session = await getRequestSession(req);
  if (session?.departmentId === DEMO_DEPARTMENT_ID) return withDemoDatabase(() => start(req));
  return start(req);
}

export async function GET(req: Request) {
  const session = await getRequestSession(req);
  if (session?.departmentId === DEMO_DEPARTMENT_ID) return withDemoDatabase(() => poll(req));
  return poll(req);
}
