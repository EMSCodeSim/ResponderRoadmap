import { handleError, jsonError, jsonOk } from "@/server/http";
import { getRequestSession, requireDepartmentSession } from "@/server/session";
import { archiveClass, deleteUnusedClass, listClassCleanup, restoreClass } from "@/server/services/class-cleanup";

async function context(req: Request) {
  const session = await getRequestSession(req);
  if (!session) return null;
  return requireDepartmentSession(session);
}

export async function GET(req: Request) {
  try {
    const ctx = await context(req);
    if (!ctx) return jsonError("Authentication required.", 401);
    const archived = new URL(req.url).searchParams.get("archived") === "true";
    return jsonOk(await listClassCleanup(ctx, archived));
  } catch (error) { return handleError(error); }
}

export async function POST(req: Request) {
  try {
    const ctx = await context(req);
    if (!ctx) return jsonError("Authentication required.", 401);
    const body = await req.json().catch(() => ({}));
    const id = String(body.id || "");
    if (body.action === "archive") return jsonOk(await archiveClass(ctx, id));
    if (body.action === "restore") return jsonOk(await restoreClass(ctx, id));
    if (body.action === "delete") return jsonOk(await deleteUnusedClass(ctx, id));
    return jsonError("Invalid cleanup action.", 400);
  } catch (error) { return handleError(error); }
}
