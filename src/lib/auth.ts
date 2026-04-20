import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const SESSION_COOKIE = "auth";
const MAGIC_TTL = 15 * 60; // 15 min
const SESSION_TTL = 30 * 24 * 60 * 60; // 30 days

type Purpose = "magic" | "session";

interface Claims extends JWTPayload {
  email: string;
  purpose: Purpose;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signToken(
  email: string,
  purpose: Purpose,
  secret: string
): Promise<string> {
  const ttl = purpose === "magic" ? MAGIC_TTL : SESSION_TTL;
  return new SignJWT({ email, purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secretKey(secret));
}

export async function verifyToken(
  token: string,
  purpose: Purpose,
  secret: string
): Promise<Claims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret));
    if ((payload as Claims).purpose !== purpose) return null;
    return payload as Claims;
  } catch {
    return null;
  }
}

export const COOKIE_NAME = SESSION_COOKIE;
