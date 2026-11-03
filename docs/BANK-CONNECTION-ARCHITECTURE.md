# My Finance — official bank connection architecture

## Current availability (checked 4 November 2026)

- SBP published draft Open Banking Regulations 2026 for consultation on 31 October 2026. The draft proposes customer-consented data sharing and payment initiation through authorised third-party providers, but it is not a live universal API. Consultation closes 30 November 2026.
- Easypaisa's publicly reported developer gateway use cases focus on merchant services, bill payments, transfers and wallet disbursements. This does not establish a personal-wallet account-information API.
- NayaPay Business exposes account and transaction views within its own business portal. A public third-party read API for a personal NayaPay wallet has not been verified.
- A UBL UK Open Banking developer portal exists, but it is not evidence of API availability for UBL Pakistan.
- No public, approved personal-account aggregation API was verified for HBL, Meezan, Bank Alfalah, MCB, Allied Bank or Faysal Bank in this research.

## What this release implements

- A user-scoped provider access tracker in `bank_connection_requests`.
- Bank readiness catalogue in `src/lib/bankConnections.ts`.
- RLS ensures a user can only see and manage their own tracker entries.
- The tracker stores institution identifiers and onboarding status only. It does not store account numbers, credentials, OTPs, access tokens or balances.
- The UI explicitly distinguishes tracked providers from connected accounts.

## Production connection architecture (activate only after provider approval)

1. Provider onboarding: obtain written approval, production API documentation, scopes, sandbox credentials, data-processing terms and security requirements from each institution or authorised open-banking aggregator.
2. Consent: show the legal institution name, requested read-only scopes (accounts, balances, transactions), purpose, duration and revocation route. Do not ask for bank passwords, PINs or OTPs.
3. Authorisation: use the provider's approved OAuth 2.0 Authorization Code + PKCE flow (or the provider-mandated equivalent), exact redirect URI allow-list, one-time state, nonce where OIDC is used, and strict issuer/audience validation.
4. Backend callback: handle the redirect in a Supabase Edge Function. Verify state, exchange the code server-side, validate tokens, and never return provider refresh/access tokens to the browser or mobile app.
5. Token storage: encrypt provider tokens at rest using a managed secrets/key service with rotation and access auditing. Keep token material out of public tables, logs, analytics, source control and client storage. Do not add a token column to `bank_connection_requests`.
6. Data sync: call provider APIs only from server-side Edge Functions. Validate provider signatures for webhooks, verify account ownership, use idempotent provider transaction IDs, paginate and checkpoint sync, and write only the minimum permitted data to the user's RLS-protected records.
7. Revocation: revoke with the provider, delete token material, mark the connection revoked and apply the provider/SBP retention and deletion requirements.
8. Monitoring: audit consent creation/revocation, sync status and provider errors without logging credentials or full financial payloads.

## Important release boundary

There is no real bank connection in this release. A bank card marked “Tracked” is only a reminder to prioritise official API onboarding. The app must not claim live balances or automatic transaction sync until provider approval, credentials, sandbox tests and production certification are complete.

## Security rules

- Never scrape consumer internet banking or automate login with user credentials.
- Never collect passwords, PINs, OTPs, card CVV or full card data.
- Never place secret keys or provider tokens in Vite variables, browser code, Expo bundles or GitHub.
- Keep all provider access server-side, authenticated, least-privilege and consent-bound.
