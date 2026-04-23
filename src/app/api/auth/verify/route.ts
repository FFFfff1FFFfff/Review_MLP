import { NextResponse } from "next/server";
import { COOKIE_NAME, signToken, verifyToken } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

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

  // Land new owners (and anyone who hasn't finished onboarding) on Settings
  // so they complete the Place ID setup before seeing an empty dashboard.
  // Existing configured owners go straight to the dashboard as before.
  const business = await prisma.business.findUnique({
    where: { ownerEmail: claims.email },
    select: { googlePlaceId: true, googleReviewUrl: true }
  });
  const needsSetup =
    !business || (!business.googlePlaceId && !business.googleReviewUrl);
  const destination = needsSetup ? "/owner/settings" : "/owner/dashboard";

  const session = await signToken(claims.email, "session", env.AUTH_SECRET);
  const res = NextResponse.redirect(new URL(destination, env.APP_URL));
  res.cookies.set(COOKIE_NAME, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60
  });
  return res;
}
