import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifyToken } from "./lib/auth";

export const config = {
  matcher: ["/owner/:path*"]
};

export async function middleware(req: NextRequest) {
  // /owner/login is public; everything else under /owner requires a session.
  if (req.nextUrl.pathname === "/owner/login") return NextResponse.next();

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
