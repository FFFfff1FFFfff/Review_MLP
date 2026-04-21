import { NextResponse } from "next/server";
import { COOKIE_NAME, signToken, verifyToken } from "@/lib/auth";
import { env } from "@/lib/env";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/owner/login?error=missing", env.APP_URL));
  }

  const claims = await verifyToken(token, "magic", env.AUTH_SECRET);
  if (!claims) {
    return NextResponse.redirect(new URL("/owner/login?error=invalid", env.APP_URL));
  }

  const session = await signToken(claims.email, "session", env.AUTH_SECRET);
  const res = NextResponse.redirect(new URL("/owner/dashboard", env.APP_URL));
  res.cookies.set(COOKIE_NAME, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60
  });
  return res;
}
