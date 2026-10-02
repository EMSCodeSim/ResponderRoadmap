import { getRequestSession } from "@/server/session";
import { handleError, jsonError, jsonOk } from "@/server/http";
import { getPlatformAdminDashboard } from "@/server/services/platform-admin";

export async function GET(req: Request) {
  try {
    const session = await getRequestSession(req);
    if (!session) return jsonError("Authentication required.", 401);
    return jsonOk(await getPlatformAdminDashboard(session.email));
  } catch (error) {
    return handleError(error);
  }
}
