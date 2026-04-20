# Review MLP

SMS-driven review request tool for small businesses. The owner submits a client's
phone number; the system schedules and sends an SMS inviting the client to rate
their visit. 4-5 star ratings are routed to Google Reviews (with a clipboard
helper); 1-3 star ratings are captured as private feedback to the owner.

Single-pilot MLP — v1 hardcodes one business and generalizes in v2.

## Status

- [x] **Day 1** — Prisma schema, owner magic-link auth, scheduled review-request
      creation (E.164 normalize, 30-day dedup, per-business 20/hr rate limit,
      9am-9pm America/Chicago send window with 60-180 min jitter).
- [x] **Day 2.2** — SMS template interpolation, `Notifier` abstraction
      (`ConsoleNotifier` for dev logs; `EmailToSmsNotifier` that routes through
      Resend to the T-Mobile `@tmomail.net` gateway as a pre-Twilio channel),
      and a Vercel Cron (`/api/cron/send-reviews`) that scans due rows,
      re-validates the Google URL, enforces a 3/day per-business velocity cap,
      claims rows optimistically, and rolls back on send failure.
- [x] **Day 2.4** — `/r/:token` rating page with click tracking, 7-day expiry,
      already-rated state, and an idempotent `POST /api/r/:token/rate`
      endpoint that computes `routedTo` (>=4 -> `google`, <4 -> `private`).

Not yet:

- [ ] **Day 2.3** — STOP / HELP inbound webhook. Deferred: the interim
      email-to-SMS gateway is one-way, so end-to-end validation requires Twilio.
- [ ] **Day 3** — Google / private feedback routing UX, clipboard helper, owner
      dashboard funnel, PostHog events.
- [ ] **Day 4** — Real-device QA, Twilio cutover, pilot go-live.

## Stack

Next.js 14 (App Router, TS) · Prisma · Postgres (Neon via Vercel) · Tailwind ·
jose (JWT) · Resend · libphonenumber-js · date-fns-tz · Vercel Cron.

## Code structure

```
prisma/
  schema.prisma             # Business + ReviewRequest models
  seed.ts                   # Single-pilot seed, idempotent findFirst+upsert
src/
  app/
    owner/
      login/                # Magic-link request form
      dashboard/            # Recent requests list
      new/                  # Submit a client phone number
    r/[token]/              # Client-facing rating page
    api/
      auth/request/         # POST: email a magic link
      auth/verify/          # GET:  exchange token for session cookie
      review-request/       # POST: owner schedules a request
      r/[token]/rate/       # POST: client submits rating (idempotent)
      cron/send-reviews/    # Vercel Cron: scan due rows and send
  components/
    RatingForm.tsx          # Stars + optional text + submit
  lib/
    auth.ts                 # JWT sign/verify for magic + session tokens
    email.ts                # Resend wrapper for the magic link
    env.ts                  # Env accessors with fail-fast checks
    google.ts               # resolveGoogleReviewUrl(business)
    notifier.ts             # Notifier interface + Console / EmailToSms
    phone.ts                # E.164 normalize + SHA-256 hash
    prisma.ts               # Shared Prisma client
    scheduling.ts           # 9am-9pm America/Chicago window + jitter
    session.ts              # Resolve current Business from cookie
    sms-template.ts         # Template interpolation + 160-char warning
    token.ts                # Short URL-safe slug generator
  middleware.ts             # Guard /owner/*
vercel.json                 # Cron schedule (every minute)
```

## Environment

See `.env.example`. Vercel Postgres (Neon) injects `POSTGRES_PRISMA_URL` and
`POSTGRES_URL_NON_POOLING` automatically. Manual vars: `AUTH_SECRET`, `APP_URL`,
`RESEND_API_KEY`, `RESEND_FROM`, `CRON_SECRET`, `NOTIFIER_MODE`,
`PILOT_OWNER_EMAIL`.
