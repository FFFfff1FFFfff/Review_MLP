import { randomBytes } from "node:crypto";

// Short URL-safe slug for /r/:token. 10 chars of base32-ish entropy is plenty
// for per-business lookups and keeps SMS length under 160 chars.
export function generateShortToken(length = 10): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/1/i/l/o to avoid confusion
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
