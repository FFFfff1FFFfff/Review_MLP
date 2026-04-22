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
  },
  // Per-business send cap per rolling 24h enforced by the cron. Production
  // default is 3 to protect SMB customers from over-messaging. Override in
  // dev/preview via env (e.g. VELOCITY_CAP=50) so testing isn't blocked.
  get VELOCITY_CAP() {
    const raw = process.env.VELOCITY_CAP;
    if (!raw) return 3;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`Invalid VELOCITY_CAP: "${raw}". Expected non-negative integer.`);
    }
    return n;
  }
};
