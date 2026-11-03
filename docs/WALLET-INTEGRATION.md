# Wallet integration readiness

## Provider scope
Only NayaPay and Easypaisa personal wallets are in scope.

## Important status
Personal-wallet APIs for reading balances and transaction histories have not been verified. Public merchant/payment APIs must not be treated as personal-account data APIs.

## Acceptance requirements before enabling a connector
- Written provider approval for personal account read access.
- Documented OAuth/consent or other approved authorization flow.
- Documented balance and transaction endpoints.
- Token expiry, revocation, rate limits and webhook semantics documented.
- Security and privacy review completed.

## Prohibited
- Asking users for wallet passwords, PINs or OTPs.
- Storing credentials or automating consumer-app login.
- Scraping private endpoints or bypassing app protections.
- Presenting sample data as live financial data.

## Connector interface (planned)
Implement provider-specific server-side adapters only after approval. Normalize provider data to:
- provider_transaction_id
- occurred_at
- amount + currency
- direction
- title / description
- status
- available balance (if officially supported)

Use idempotent upserts keyed by user, wallet and provider transaction ID. Keep provider secrets server-side; never expose service-role keys to web or mobile clients.

## Fallback
A future statement-import flow may accept user-selected CSV/PDF statements, clearly explain retention, and require user confirmation before importing parsed transactions.