# Review MLP

SMS-driven review request tool for small businesses. The owner submits a client's phone number; the system schedules and sends an SMS inviting the client to rate their visit. 4-5 star ratings are routed to Google Reviews (with a clipboard helper); 1-3 star ratings are captured as private feedback to the owner.

Single-pilot MLP — v1 hardcodes one business and generalizes in v2.

## Status

**Done**

- [x] **Day 1** — Prisma schema, owner magic-link auth, scheduled review-request creation (E.164 normalize, 30-day dedup, 20/hr rate limit, 9am-9pm CT send window with 60-180 min jitter).
- [x] **Day 2.2** — SMS template, `Notifier` abstraction (`ConsoleNotifier` + `EmailToSmsNotifier` via Resend → `@tmomail.net` as a pre-Twilio channel), and a Vercel Cron (`/api/cron/send-reviews`) that scans due rows, re-validates the Google URL, enforces a 3/day per-business velocity cap, claims rows optimistically, and rolls back on send failure.
- [x] **Day 2.4** — `/r/:token` rating page (click tracking, 7-day expiry, already-rated state) plus idempotent `POST /api/r/:token/rate` that sets `routedTo` (`>=4 → google`, `<4 → private`).

**Not yet**

- [ ] **Day 2.3** — STOP / HELP inbound webhook. Deferred: the interim email-to-SMS gateway is one-way, so end-to-end validation requires Twilio.
- [ ] **Day 3** — Google / private feedback routing UX, clipboard helper, owner dashboard funnel, PostHog events.
- [ ] **Day 4** — Real-device QA, Twilio cutover, pilot go-live.

## Stack

- **Framework** — Next.js 14 (App Router, TypeScript)
- **ORM / DB** — Prisma · Postgres (Neon via Vercel)
- **UI** — Tailwind CSS
- **Auth** — `jose` (JWT magic link + session cookie)
- **Email** — Resend
- **Phone / Time** — `libphonenumber-js`, `date-fns-tz`
- **Validation** — `zod`
- **Scheduler** — Vercel Cron (every minute, Pro plan)

## Code structure

```
.
├── prisma/
│   ├── schema.prisma              Business + ReviewRequest models
│   └── seed.ts                    Idempotent single-pilot seed
├── src/
│   ├── app/
│   │   ├── owner/
│   │   │   ├── login/             Magic-link request form
│   │   │   ├── dashboard/         Recent requests list
│   │   │   └── new/               Submit a client phone number
│   │   ├── r/[token]/             Client-facing rating page
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── request/       POST: email a magic link
│   │       │   └── verify/        GET:  exchange token for session cookie
│   │       ├── review-request/    POST: owner schedules a request
│   │       ├── r/[token]/rate/    POST: client submits rating (idempotent)
│   │       └── cron/send-reviews/ Vercel Cron: scan due rows and send
│   ├── components/
│   │   └── RatingForm.tsx         Stars + optional text + submit
│   ├── lib/
│   │   ├── auth.ts                JWT sign/verify (magic + session)
│   │   ├── email.ts               Resend wrapper for magic link
│   │   ├── env.ts                 Env accessors with fail-fast checks
│   │   ├── google.ts              resolveGoogleReviewUrl(business)
│   │   ├── notifier.ts            Notifier interface + Console / EmailToSms
│   │   ├── phone.ts               E.164 normalize + SHA-256 hash
│   │   ├── prisma.ts              Shared Prisma client
│   │   ├── scheduling.ts          9am-9pm CT window + jitter
│   │   ├── session.ts             Resolve current Business from cookie
│   │   ├── sms-template.ts        Template interpolation
│   │   └── token.ts               Short URL-safe slug generator
│   └── middleware.ts              Guards /owner/*
└── vercel.json                    Cron schedule (every minute)
```

## Environment

See `.env.example` for the full list. Vercel Postgres (Neon) injects database URLs automatically; the rest are set manually.

**Auto-injected by Vercel Postgres**

- `POSTGRES_PRISMA_URL` — pooled connection used at runtime
- `POSTGRES_URL_NON_POOLING` — direct connection used by `prisma db push`

**Set manually**

- `AUTH_SECRET` — 32+ byte random; signs magic link + session JWTs
- `APP_URL` — deployment URL; used in magic link and SMS short link
- `RESEND_API_KEY` — Resend API key
- `RESEND_FROM` — sender address (needs verified domain for non-own recipients)
- `CRON_SECRET` — shared secret Vercel Cron sends as bearer token
- `NOTIFIER_MODE` — `console` (log only) or `email-sms` (real send via gateway)
- `PILOT_OWNER_EMAIL` — email tied to the seeded Business; used at seed time
