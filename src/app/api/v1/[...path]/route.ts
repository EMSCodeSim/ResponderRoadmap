import { handleApi } from "@/server/api/router";
import { getRequestSession } from "@/server/session";
import { DEMO_DEPARTMENT_ID, DEMO_READ_ONLY_MESSAGE } from "@/lib/demo-accounts";

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

async function dispatch(req: Request, params: Promise<{ path: string[] }>) {
  const { path } = await params;
  const route = path.join("/");
  const allowedDemoWrites = new Set(["auth/login", "auth/app-login", "auth/logout"]);

  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !allowedDemoWrites.has(route)) {
    const session = await getRequestSession(req);
    if (session?.departmentId === DEMO_DEPARTMENT_ID) {
      return withCors(Response.json({ error: DEMO_READ_ONLY_MESSAGE }, { status: 403 }));
    }
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
