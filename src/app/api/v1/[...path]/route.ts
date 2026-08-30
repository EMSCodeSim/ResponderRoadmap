import { handleApi } from "@/server/api/router";
import { getRequestSession } from "@/server/session";
import { handleError, jsonOk } from "@/server/http";
import * as auth from "@/server/services/auth";
import { withDemoDatabase } from "@/server/db";
import { DEMO_DEPARTMENT_ID, DEMO_WALKS, type DemoWalkKey } from "@/lib/demo-accounts";

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
