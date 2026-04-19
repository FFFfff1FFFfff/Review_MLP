import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Single-pilot MLP: one hardcoded business. Real pilot data is swapped in later.
async function main() {
  const ownerEmail = process.env.PILOT_OWNER_EMAIL ?? "owner@example.com";

  await prisma.business.upsert({
    where: { ownerEmail },
    update: {},
    create: {
      name: "Beauty Revival Barn",
      ownerEmail,
      ownerFirstName: "Cici",
      shortLinkSlug: "brb",
      googlePlaceId: null,
      googleReviewUrl: null
    }
  });

  console.log(`seeded business for ${ownerEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
