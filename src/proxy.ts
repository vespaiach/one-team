import { type NextRequest, NextResponse } from "next/server";
import { db } from "./server/db.ts";
import { clearSessionCookie, readSessionToken, validateSession } from "./server/session.ts";

export const config = {
  matcher: ["/((?!api(?:/|$)|health$|_next/static|_next/image|favicon.ico).*)"],
};

function decide(request: NextRequest, signedIn: boolean): NextResponse {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/sign-in" && searchParams.has("token")) {
    return NextResponse.next();
  }
  if (signedIn) {
    return pathname === "/" || pathname === "/sign-in"
      ? NextResponse.redirect(new URL("/my-issues", request.url))
      : NextResponse.next();
  }
  if (pathname === "/sign-in") {
    return NextResponse.next();
  }
  const signIn = new URL("/sign-in", request.url);
  if (pathname !== "/") {
    const kept = new URLSearchParams(searchParams);
    kept.delete("_rsc");
    const query = kept.toString();
    signIn.searchParams.set("next", query === "" ? pathname : `${pathname}?${query}`);
  }
  return NextResponse.redirect(signIn);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const token = readSessionToken(request);
  const member = token === null ? null : await validateSession(db(), token);
  const response = decide(request, member !== null);
  if (token !== null && member === null) {
    response.headers.append("set-cookie", clearSessionCookie());
  }
  return response;
}