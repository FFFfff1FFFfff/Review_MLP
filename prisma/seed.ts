import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Single-pilot MLP: one hardcoded business. This seed is idempotent across
// redeploys — it updates the lone row's ownerEmail to match PILOT_OWNER_EMAIL
// without disturbing fields (e.g. googlePlaceId) that may have been edited
// directly in the DB.
async function main() {
  const ownerEmail = process.env.PILOT_OWNER_EMAIL ?? "owner@example.com";

  const existing = await prisma.business.findFirst();
  if (existing) {
    await prisma.business.update({
      where: { id: existing.id },
      data: { ownerEmail }
    });
    console.log(`updated business ${existing.id} ownerEmail -> ${ownerEmail}`);
  } else {
    const created = await prisma.business.create({
      data: {
        name: "Beauty Revival Barn",
        ownerEmail,
        ownerFirstName: "Cici"
      }
    });
    console.log(`seeded business ${created.id} for ${ownerEmail}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
