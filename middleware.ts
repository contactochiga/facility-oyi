import { NextRequest, NextResponse } from "next/server";

const PROTECTED = [
  "/overview",
  "/devices",
  "/maintenance",
  "/visitors",
  "/alerts",
  "/cameras",
  "/traffic",
  "/water",
  "/environment",
  "/occupancy",
  "/wallets",
  "/community",
  "/messages",
  "/homes",
  "/services",
  "/account",
  "/digital-twin",
];

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
  matcher: [
    "/overview/:path*",
    "/devices/:path*",
    "/maintenance/:path*",
    "/visitors/:path*",
    "/alerts/:path*",
    "/cameras/:path*",
    "/traffic/:path*",
    "/water/:path*",
    "/environment/:path*",
    "/occupancy/:path*",
    "/wallets/:path*",
    "/community/:path*",
    "/messages/:path*",
    "/homes/:path*",
    "/services/:path*",
    "/account/:path*",
    "/digital-twin/:path*",
  ],
};
