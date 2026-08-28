import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE, type Role } from "@/lib/constants";
import type { AuthContext } from "@/server/permissions";

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  departmentId: string | null;
  departmentName: string | null;
  membershipId: string | null;
  role: Role | null;
  rank: string | null;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET || "responder-roadmap-dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Returns the authenticated session for either the browser portal or the
 * companion Roadmap app. Browser requests continue to use the HttpOnly
 * session cookie. Native/web companion clients can send the same signed JWT
 * as an Authorization: Bearer token without changing the portal auth model.
 */
export async function getRequestSession(req: Request): Promise<SessionPayload | null> {
  const authorization = req.headers.get("authorization")?.trim() ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim();
    if (token) {
      const session = await verifySessionToken(token);
      if (session) return session;
    }
  }
  return getSession();
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export function requireDepartmentSession(session: SessionPayload | null): AuthContext {
  if (!session?.userId) {
    const error = new Error("Authentication required.");
    (error as Error & { status: number }).status = 401;
    throw error;
  }
  if (!session.departmentId || !session.membershipId || !session.role) {
    const error = new Error("No department membership is active.");
    (error as Error & { status: number }).status = 403;
    throw error;
  }
  return {
    userId: session.userId,
    email: session.email,
    name: session.name,
    departmentId: session.departmentId,
    departmentName: session.departmentName || "",
    membershipId: session.membershipId,
    role: session.role,
    rank: session.rank,
  };
}