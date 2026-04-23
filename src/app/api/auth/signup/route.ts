import { NextResponse } from "next/server";
import { z } from "zod";
import { dispatchMagicLinkIfReady } from "@/lib/magic-link";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  email: z.string().email(),
  businessName: z.string().trim().min(1).max(256)
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid signup" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  const businessName = parsed.data.businessName;

  // Upsert creates the Business on first signup and is idempotent on retries
  // with the same email — we don't update existing rows here so a re-signup
  // can't rename an already-claimed Business. Owner's first name defaults to
  // "Owner"; they can update it later in Settings (or it gets auto-synced
  // from Google on Place ID save).
  const business = await prisma.business.upsert({
    where: { ownerEmail: email },
    update: {},
    create: {
      name: businessName,
      ownerEmail: email,
      ownerFirstName: "Owner"
    }
  });

  await dispatchMagicLinkIfReady({ businessId: business.id, email });
  return NextResponse.json({ ok: true });
}
