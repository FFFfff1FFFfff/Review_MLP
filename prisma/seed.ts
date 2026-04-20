import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Single-pilot MLP: one hardcoded business. Real pilot data is swapped in later.
async function main() {
  const ownerEmail = process.env.PILOT_OWNER_EMAIL ?? "owner@example.com";

  // Upsert by shortLinkSlug (the stable per-business identity) so that
  // changing PILOT_OWNER_EMAIL across deploys updates the owner instead of
  // colliding on the unique shortLinkSlug.
  await prisma.business.upsert({
    where: { shortLinkSlug: "brb" },
    update: { ownerEmail },
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
