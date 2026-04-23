import { NextResponse } from "next/server";
import { z } from "zod";
import { dispatchMagicLinkIfReady } from "@/lib/magic-link";
import { prisma } from "@/lib/prisma";

const Body = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  // Enumeration protection: respond 200 whether or not a Business exists for
  // this email, so an attacker can't distinguish registered vs unregistered
  // owners by response shape or timing.
  const business = await prisma.business.findUnique({ where: { ownerEmail: email } });
  if (business) {
    await dispatchMagicLinkIfReady({ businessId: business.id, email });
  }
  return NextResponse.json({ ok: true });
}
