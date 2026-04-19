function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const env = {
  get AUTH_SECRET() {
    return required("AUTH_SECRET");
  },
  get APP_URL() {
    return process.env.APP_URL ?? "http://localhost:3000";
  },
  get RESEND_API_KEY() {
    return required("RESEND_API_KEY");
  },
  get RESEND_FROM() {
    return process.env.RESEND_FROM ?? "Review MLP <onboarding@resend.dev>";
  }
};
