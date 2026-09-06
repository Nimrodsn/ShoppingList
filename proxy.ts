import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { HOUSEHOLD_COOKIE } from "@/lib/auth/constants";

// Optimistic cookie-presence check only. The real boundary is `requireHousehold()`
// inside every Server Action, which verifies the HMAC and the cookie generation.
export function proxy(request: NextRequest) {
  if (request.cookies.has(HOUSEHOLD_COOKIE)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/staples/:path*", "/history/:path*", "/settings/:path*"],
};
