import { handleApi } from "@/server/api/router";
import { getRequestSession } from "@/server/session";
import { handleError, jsonOk } from "@/server/http";
import * as auth from "@/server/services/auth";
import { withDemoDatabase } from "@/server/db";
import { demoPrisma } from "@/server/demo-db";
import { DEMO_DEPARTMENT_ID, DEMO_WALKS, type DemoWalkKey } from "@/lib/demo-accounts";
import { recordPublicMarketingEvent } from "@/server/services/public-events";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function demoLogin(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const walk = String(body.walk || "") as DemoWalkKey;
    const account = DEMO_WALKS[walk];
    if (!account) return Response.json({ error: "Unknown demo perspective." }, { status: 400 });
    const result = await auth.login(account.email, process.env.DEMO_PASSWORD || "demo");
    return jsonOk(result);
  } catch (error) {
    return handleError(error);
  }
}

async function dispatch(req: Request, params: Promise<{ path: string[] }>) {
  const { path } = await params;
  const route = path.join("/");

  if (req.method === "POST" && route === "auth/demo-login") {
    return withCors(await withDemoDatabase(() => demoLogin(req)));
  }

  if (req.method === "POST" && route === "public/events") {
    const body = await req.json().catch(() => ({}));
    const result = recordPublicMarketingEvent({
      event: (body as { event?: unknown }).event,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous",
    });
    if (!result.ok) return withCors(Response.json({ error: result.error }, { status: result.status }));
    return withCors(new Response(null, { status: 204 }));
  }

  // A scanned class QR link is anonymous: there is no demo session cookie to
  // select the correct database. Resolve only well-formed public tokens against
  // the isolated demo schema before falling through to the production schema.
  // Never route by a caller-supplied "demo" flag or expose any roster data.
  if ((req.method === "GET" || req.method === "POST") && path.length === 3 &&
      path[0] === "public" && path[1] === "classes" && /^[a-f0-9]{64}$/.test(path[2]) && demoPrisma) {
    try {
      const demoClass = await demoPrisma.trainingClass.findUnique({
        where: { registrationToken: path[2] },
        select: { id: true },
      });
      if (demoClass) return withCors(await withDemoDatabase(() => handleApi(req, path)));
    } catch (error) {
      // An unavailable optional demo database must not break real registrations.
      console.error("Unable to resolve a public demo registration token", error);
    }
  }

  const session = await getRequestSession(req);
  if (session?.departmentId === DEMO_DEPARTMENT_ID) {
    return withCors(await withDemoDatabase(() => handleApi(req, path)));
  }

  return withCors(await handleApi(req, path));
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return dispatch(req, params);
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return dispatch(req, params);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return dispatch(req, params);
}

export async function PUT(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return dispatch(req, params);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return dispatch(req, params);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
