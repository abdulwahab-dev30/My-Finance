# My Finance

A personal finance manager focused on NayaPay and Easypaisa wallet tracking.

## Current status
- Responsive React + Vite web dashboard scaffold.
- Supabase PostgreSQL schema with per-user Row Level Security.
- NayaPay and Easypaisa personal-wallet connections are explicitly marked **pending official API approval**.
- Dashboard figures and transaction rows are illustrative demo preview values, never live financial records.
- Expo mobile client scaffold is planned under `apps/mobile`.

## Web app
```bash
npm install
npm run dev
npm run build
```

## Android app (Capacitor)

The web dashboard is configured to build as a native Android app with Capacitor. See [`docs/ANDROID-APP.md`](docs/ANDROID-APP.md) for Android Studio setup, device testing, and signed AAB release steps.

First-time setup: `npm install`, `npx cap add android`, `npm run mobile:build`, then `npm run cap:open:android`.

## Environment
Copy `.env.example` to `.env.local` and configure:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The UI can run in demo preview mode without Supabase credentials. Never put a Supabase service-role key or wallet credentials in frontend environment variables.

## Database
Review and apply `supabase/schema.sql` to a new Supabase project. Private tables have Row Level Security policies.

## Wallet integrations
Personal-wallet read APIs for NayaPay and Easypaisa have not been verified. Public merchant/payment APIs are not equivalent to personal wallet balance/transaction APIs. Enable a provider connector only after written approval and documented read-only access. Do not collect wallet passwords, PINs or OTPs, and do not scrape private endpoints.

See `docs/WALLET-INTEGRATION.md` for the integration acceptance checklist.

## Security
- User-owned rows are scoped by Supabase RLS.
- Amounts use PostgreSQL `numeric`.
- Provider transaction IDs have an idempotency index.
- Provider secrets and service-role keys must remain server-side.
