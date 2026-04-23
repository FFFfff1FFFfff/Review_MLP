import { Resend } from "resend";
import { env } from "./env";

let client: Resend | null = null;

function getClient(): Resend {
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

export async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  const { error } = await getClient().emails.send({
    from: env.RESEND_FROM,
    to,
    subject: "Your Alauda Review login link",
    text: `Click to log in (expires in 15 minutes):\n\n${url}\n\nIf you didn't request this, ignore this email.`
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

export interface PrivateFeedbackEmailParams {
  toOwner: string;
  businessName: string;
  rating: number;
  text: string;
  clientContact: string; // phone or email of the client (for follow-up)
}

export async function sendPrivateFeedbackEmail(
  p: PrivateFeedbackEmailParams
): Promise<void> {
  const body = [
    `A client just left you private feedback on ${p.businessName}.`,
    ``,
    `Rating: ${p.rating} / 5`,
    `From:   ${p.clientContact}`,
    ``,
    `Feedback:`,
    p.text,
    ``,
    `— Alauda Review`
  ].join("\n");
  const { error } = await getClient().emails.send({
    from: env.RESEND_FROM,
    to: p.toOwner,
    subject: `New private feedback (${p.rating}★) — ${p.businessName}`,
    text: body
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
