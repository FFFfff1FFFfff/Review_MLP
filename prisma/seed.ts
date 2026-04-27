import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Bootstrap a single Business on a fresh database so the first owner can log
// in without /owner/signup. This runs on every `prisma db push` (including
// every Vercel deploy) — so it MUST be a pure no-op when any Business row
// already exists. Updating an existing row would stomp on multi-tenant data
// (e.g. rewriting another owner's ownerEmail to PILOT_OWNER_EMAIL and locking
// them out on their next login).
async function main() {
  const existing = await prisma.business.findFirst({ select: { id: true } });
  if (existing) {
    console.log(`seed: ${existing.id} already exists, skipping`);
    return;
  }

  const ownerEmail = process.env.PILOT_OWNER_EMAIL ?? "owner@example.com";
  const created = await prisma.business.create({
    data: {
      name: "Your business",
      ownerEmail,
      ownerFirstName: "Owner"
    }
  });
  console.log(`seed: created ${created.id} for ${ownerEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
