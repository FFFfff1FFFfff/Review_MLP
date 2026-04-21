import { Resend } from "resend";
import { env } from "./env";

export type SmsTarget = { channel: "sms"; toPhoneE164: string };
export type EmailTarget = {
  channel: "email";
  toEmail: string;
  subject: string;
};
export type NotifierTarget = SmsTarget | EmailTarget;

export interface Notifier {
  send(
    target: NotifierTarget,
    body: string
  ): Promise<{ providerId: string | null }>;
}

class ConsoleNotifier implements Notifier {
  async send(target: NotifierTarget, body: string) {
    if (target.channel === "sms") {
      console.log(`[notifier/console] sms to=${target.toPhoneE164} body=${body}`);
    } else {
      console.log(
        `[notifier/console] email to=${target.toEmail} subject=${target.subject} body=${body}`
      );
    }
    return { providerId: null };
  }
}

// Dual-channel Resend notifier:
//   - SMS path routes through T-Mobile's email-to-SMS gateway (@tmomail.net).
//     Twilio replaces this once A2P 10DLC is approved.
//   - Email path sends directly to the client's inbox.
class ResendNotifier implements Notifier {
  private resend = new Resend(env.RESEND_API_KEY);

  async send(target: NotifierTarget, body: string) {
    if (target.channel === "sms") {
      const digits = target.toPhoneE164.replace(/^\+1/, "");
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
    const { data, error } = await this.resend.emails.send({
      from: env.RESEND_FROM,
      to: target.toEmail,
      subject: target.subject,
      text: body
    });
    if (error) throw new Error(`Resend error: ${error.message}`);
    return { providerId: data?.id ?? null };
  }
}

export function getNotifier(): Notifier {
  return env.NOTIFIER_MODE === "email-sms"
    ? new ResendNotifier()
    : new ConsoleNotifier();
}
