import { getRequestSession } from "@/server/session";
import { handleError, jsonError, jsonOk } from "@/server/http";
import { updateInterest } from "@/server/services/interests";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getRequestSession(req);
    if (!session) return jsonError("Authentication required.", 401);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    return jsonOk(await updateInterest(session.email, id, body));
  } catch (error) {
    return handleError(error);
  }
}
