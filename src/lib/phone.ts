import { parsePhoneNumberFromString } from "libphonenumber-js";
import { createHash } from "node:crypto";

export interface NormalizedPhone {
  e164: string;
  hash: string;
}

// Parse user-entered phone (default region US) into E.164 + SHA-256 hash.
// Returns null if the number is invalid.
export function normalizePhone(input: string): NormalizedPhone | null {
  const parsed = parsePhoneNumberFromString(input, "US");
  if (!parsed || !parsed.isValid()) return null;
  const e164 = parsed.number;
  const hash = createHash("sha256").update(e164).digest("hex");
  return { e164, hash };
}
