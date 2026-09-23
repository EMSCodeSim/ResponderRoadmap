import { DEMO_DEPARTMENT_ID } from "@/lib/demo-accounts";
import { withDemoDatabase } from "@/server/db";
import { handleError, jsonError, jsonOk } from "@/server/http";
import { getRequestSession, requireDepartmentSession } from "@/server/session";
import { answerResponderQuestion } from "@/server/services/responder-ai";

export const maxDuration = 60;

async function run(req: Request) {
  try {
    const session = await getRequestSession(req);
    if (!session) return jsonError("Authentication required.", 401);
    const ctx = requireDepartmentSession(session);
    const body = await req.json().catch(() => ({}));
    return jsonOk(await answerResponderQuestion(ctx, { question: body.question, page: body.page }));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  const session = await getRequestSession(req);
  if (session?.departmentId === DEMO_DEPARTMENT_ID) return withDemoDatabase(() => run(req));
  return run(req);
}
