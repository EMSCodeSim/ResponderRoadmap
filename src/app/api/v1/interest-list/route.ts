import { getRequestSession } from "@/server/session";
import { handleError, jsonError, jsonOk } from "@/server/http";
import { listInterests } from "@/server/services/interests";

export async function GET(req: Request) {
  try {
    const session = await getRequestSession(req);
    if (!session) return jsonError("Authentication required.", 401);
    const url = new URL(req.url);
    const query = Object.fromEntries(url.searchParams.entries());
    return jsonOk(await listInterests(session.email, query));
  } catch (error) {
    return handleError(error);
  }
}
