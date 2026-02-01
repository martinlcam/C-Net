import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  // Allow public portfolio routes
  if (
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/about") ||
    request.nextUrl.pathname.startsWith("/projects") ||
    request.nextUrl.pathname.startsWith("/contact") ||
    request.nextUrl.pathname.startsWith("/api/auth") ||
    request.nextUrl.pathname.startsWith("/auth")
  ) {
    return NextResponse.next()
  }

  // Protect /cnet/* routes - will be handled by auth check in layout
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
