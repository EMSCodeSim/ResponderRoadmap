import { getRequestSession } from "@/server/session";
import { handleError, jsonError, jsonOk } from "@/server/http";
import { deleteTestAccount } from "@/server/services/platform-admin";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getRequestSession(req);
    if (!session) return jsonError("Authentication required.", 401);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    return jsonOk(await deleteTestAccount(session.email, id, typeof body.confirmEmail === "string" ? body.confirmEmail : ""));
  } catch (error) {
    return handleError(error);
  }
}
