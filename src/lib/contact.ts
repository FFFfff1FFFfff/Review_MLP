import { createHash } from "node:crypto";
import { z } from "zod";
import { normalizePhone } from "./phone";

export type DeliveryChannel = "sms" | "email";

export interface NormalizedSms {
  channel: "sms";
  phoneE164: string;
  phoneHash: string;
}

export interface NormalizedEmail {
  channel: "email";
  email: string;
  emailHash: string;
}

export type NormalizedContact = NormalizedSms | NormalizedEmail;

const emailSchema = z.string().trim().toLowerCase().email();

export function normalizeEmail(input: string): NormalizedEmail | null {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return null;
  const email = parsed.data;
  const emailHash = createHash("sha256").update(email).digest("hex");
  return { channel: "email", email, emailHash };
}

// Resolve a channel-tagged contact from (phone?, email?) input. Exactly one
// of the two must be non-empty — owner picks the channel explicitly in UI.
export function normalizeContact(input: {
  channel: DeliveryChannel;
  phone?: string;
  email?: string;
}): NormalizedContact | null {
  if (input.channel === "sms") {
    if (!input.phone) return null;
    const p = normalizePhone(input.phone);
    if (!p) return null;
    return { channel: "sms", phoneE164: p.e164, phoneHash: p.hash };
  }
  if (input.channel === "email") {
    if (!input.email) return null;
    return normalizeEmail(input.email);
  }
  return null;
}
