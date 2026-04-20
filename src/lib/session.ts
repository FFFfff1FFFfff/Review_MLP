import { cookies } from "next/headers";
import { COOKIE_NAME, verifyToken } from "./auth";
import { env } from "./env";
import { prisma } from "./prisma";

// Resolve the logged-in owner's Business. Returns null if not authenticated
// or if the email has no associated Business row.
export async function getSessionBusiness() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const claims = await verifyToken(token, "session", env.AUTH_SECRET);
  if (!claims) return null;
  return prisma.business.findUnique({ where: { ownerEmail: claims.email } });
}
