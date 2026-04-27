import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifyToken } from "./lib/auth";

export const config = {
  matcher: ["/owner/:path*"]
};

// Public routes under /owner that don't need a session cookie. Forgetting
// to add a new public page here silently 307s new visitors to /owner/login
// and the new page becomes unreachable.
const PUBLIC_OWNER_PATHS = new Set(["/owner/login", "/owner/signup"]);

export async function middleware(req: NextRequest) {
  if (PUBLIC_OWNER_PATHS.has(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.redirect(new URL("/owner/login", req.url));

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.redirect(new URL("/owner/login", req.url));

  const claims = await verifyToken(token, "session", secret);
  if (!claims) {
    const res = NextResponse.redirect(new URL("/owner/login", req.url));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }
  return NextResponse.next();
}
