import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";
import { verifySessionToken } from "@/server/session";

const PUBLIC = ["/login", "/register", "/join", "/invite", "/department-interest", "/demo"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const isPublic = PUBLIC.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!session && !isPublic && pathname !== "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session && (pathname === "/login" || pathname === "/register")) {
    const url = req.nextUrl.clone();
    url.pathname = session.departmentId ? "/dashboard" : "/onboarding";
    return NextResponse.redirect(url);
  }

  if (session && !session.departmentId && !isPublic && pathname !== "/onboarding" && pathname !== "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
