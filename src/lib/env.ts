function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const NOTIFIER_MODES = ["console", "email-sms"] as const;
export type NotifierMode = (typeof NOTIFIER_MODES)[number];

function notifierMode(): NotifierMode {
  const raw = process.env.NOTIFIER_MODE ?? "console";
  if (!NOTIFIER_MODES.includes(raw as NotifierMode)) {
    throw new Error(
      `Invalid NOTIFIER_MODE: "${raw}". Expected one of: ${NOTIFIER_MODES.join(", ")}`
    );
  }
  return raw as NotifierMode;
}

export const env = {
  get AUTH_SECRET() {
    return required("AUTH_SECRET");
  },
  get APP_URL() {
    // Strip any trailing slash so `${APP_URL}/r/...` never produces `//r/...`.
    return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  },
  get RESEND_API_KEY() {
    return required("RESEND_API_KEY");
  },
  get RESEND_FROM() {
    return process.env.RESEND_FROM ?? "Review MLP <onboarding@resend.dev>";
  },
  get CRON_SECRET() {
    return required("CRON_SECRET");
  },
  get NOTIFIER_MODE() {
    return notifierMode();
  },
  get ANTHROPIC_API_KEY() {
    return required("ANTHROPIC_API_KEY");
  },
  get GOOGLE_PLACES_API_KEY() {
    return required("GOOGLE_PLACES_API_KEY");
  }
};
