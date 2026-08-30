import { getRequestSession } from "@/server/session";
import { jsonOk } from "@/server/http";
import { isPlatformAdmin } from "@/server/services/interests";

export async function GET(req: Request) {
  const session = await getRequestSession(req);
  return jsonOk({ interestList: Boolean(session && isPlatformAdmin(session.email)) });
}
