import { handleError, jsonOk } from "@/server/http";
import { submitInterest } from "@/server/services/interests";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    return jsonOk(await submitInterest(body), 201);
  } catch (error) {
    return handleError(error);
  }
}
