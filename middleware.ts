import { NextRequest, NextResponse } from "next/server";

const PROTECTED = [
  "/overview",
  "/live-infrastructure",
  "/estate-structure",
  "/hardware-devices",
  "/security-access",
  "/facility-intelligence",
  "/facility-administration",
  "/utilities",
  "/security",
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
  "/super-admin",
];

function isExpiredOrMalformed(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    ) as { exp?: number };
    return typeof decoded.exp === "number"
      ? Date.now() >= decoded.exp * 1000
      : true;
  } catch {
    return true;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get("oyi_facility_token")?.value;
  if (!token || isExpiredOrMalformed(token)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
    const response = NextResponse.redirect(url);
    response.cookies.delete("oyi_facility_token");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/overview/:path*",
    "/live-infrastructure/:path*",
    "/estate-structure/:path*",
    "/hardware-devices/:path*",
    "/security-access/:path*",
    "/facility-intelligence/:path*",
    "/facility-administration/:path*",
    "/utilities/:path*",
    "/security/:path*",
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
    "/super-admin/:path*",
  ],
};
