import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/overview", "/devices", "/maintenance", "/visitors", "/alerts"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get("oyi_facility_token")?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/overview/:path*", "/devices/:path*", "/maintenance/:path*", "/visitors/:path*", "/alerts/:path*"],
};
