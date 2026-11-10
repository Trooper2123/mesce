import { NextRequest, NextResponse } from "next/server";
import { auth0, configured } from "@/lib/auth";
export async function proxy(request: NextRequest) {
  if (!configured())
    return request.nextUrl.pathname.startsWith("/auth/")
      ? NextResponse.redirect(new URL("/setup", request.url))
      : NextResponse.next();
  return auth0().middleware(request);
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
