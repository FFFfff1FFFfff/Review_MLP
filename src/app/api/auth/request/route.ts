import { NextResponse } from "next/server";
import { z } from "zod";
import { signToken } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const Body = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  // Only send magic links to emails registered as a Business owner.
  const business = await prisma.business.findUnique({ where: { ownerEmail: email } });
  if (!business) {
    // Respond 200 to avoid leaking which emails are registered.
    return NextResponse.json({ ok: true });
  }

  const token = await signToken(email, "magic", env.AUTH_SECRET);
  const url = `${env.APP_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;
  await sendMagicLinkEmail(email, url);

  return NextResponse.json({ ok: true });
}
