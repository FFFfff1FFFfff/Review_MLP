import { Resend } from "resend";
import { env } from "./env";

export interface Notifier {
  send(
    toPhoneE164: string,
    body: string
  ): Promise<{ providerId: string | null }>;
}

class ConsoleNotifier implements Notifier {
  async send(to: string, body: string) {
    console.log(`[notifier/console] to=${to} body=${body}`);
    return { providerId: null };
  }
}

// Dev-only: routes SMS through a carrier's email-to-SMS gateway via Resend.
// Currently hardcoded to T-Mobile (serves Mint Mobile) at @tmomail.net.
// Replace with TwilioNotifier once A2P 10DLC is approved.
class EmailToSmsNotifier implements Notifier {
  private resend = new Resend(env.RESEND_API_KEY);

  async send(toPhoneE164: string, body: string) {
    const digits = toPhoneE164.replace(/^\+1/, "");
    const to = `${digits}@tmomail.net`;
    const { data, error } = await this.resend.emails.send({
      from: env.RESEND_FROM,
      to,
      subject: " ",
      text: body
    });
    if (error) throw new Error(`Resend error: ${error.message}`);
    return { providerId: data?.id ?? null };
  }
}

export function getNotifier(): Notifier {
  return env.NOTIFIER_MODE === "email-sms"
    ? new EmailToSmsNotifier()
    : new ConsoleNotifier();
}
