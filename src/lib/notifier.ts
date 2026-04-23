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

// Production notifier: Twilio for SMS, Resend for email. Called raw HTTP
// rather than pulling in the twilio SDK — Messages.json is a single POST
// with Basic auth and form-encoded body, so the SDK's ~50MB bundle isn't
// worth it yet. Swap to `twilio` npm if we start using inbound webhooks,
// lookups, or other features.
class LiveNotifier implements Notifier {
  private resend: Resend | null = null;

  async send(target: NotifierTarget, body: string) {
    if (target.channel === "sms") {
      return sendTwilioSms(target.toPhoneE164, body);
    }
    if (!this.resend) this.resend = new Resend(env.RESEND_API_KEY);
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

async function sendTwilioSms(
  toE164: string,
  body: string
): Promise<{ providerId: string | null }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(
    `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`
  ).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      From: env.TWILIO_PHONE_NUMBER,
      To: toE164,
      Body: body
    })
  });
  if (!res.ok) {
    // Twilio returns JSON errors like {"code":21211,"message":"The 'To'
    // number ... is not a valid phone number"}. Surface verbatim so cron
    // logs are actionable.
    const errBody = await res.text().catch(() => "");
    throw new Error(`Twilio error ${res.status}: ${errBody}`);
  }
  const data = (await res.json()) as { sid?: string };
  return { providerId: data.sid ?? null };
}

export function getNotifier(): Notifier {
  return env.NOTIFIER_MODE === "email-sms"
    ? new LiveNotifier()
    : new ConsoleNotifier();
}
