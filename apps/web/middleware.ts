import { type NextMiddleware, NextResponse } from "next/server"
import { authMiddleware } from "@/lib/auth.config"

// Route guard: storage-only users may use the Vault and nothing else.
// The /vault page itself is built in Plan 3; this guard is the security boundary.
const middleware = authMiddleware((req) => {
  const role = req.auth?.user?.role
  const { pathname } = req.nextUrl
  const isAllowed =
    pathname.startsWith("/vault") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/auth")

  if (role === "storage" && !isAllowed) {
    return NextResponse.redirect(new URL("/vault", req.url))
  }
}) as unknown as NextMiddleware

export default middleware

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
