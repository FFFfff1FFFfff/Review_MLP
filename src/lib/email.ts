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
    subject: "Your Review MLP login link",
    text: `Click to log in (expires in 15 minutes):\n\n${url}\n\nIf you didn't request this, ignore this email.`
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
