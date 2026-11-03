# My Finance Mobile (Expo)

The mobile client is planned to use Expo / React Native and the same Supabase project and normalized schema as the web app.

## Planned screens
- Overview and combined wallet balance
- NayaPay / Easypaisa connection status
- Transaction activity and filters
- Spending insights and budgets
- Secure sign-in and device biometrics

## Important
Do not ship until a mobile authentication flow, secure token storage, and provider authorization are implemented and reviewed. Store session material using platform-secure storage (for example, Expo SecureStore); never store wallet passwords, PINs or OTPs.

Personal-wallet API access for NayaPay and Easypaisa is not verified. The mobile UI must continue to label wallet connections as pending until an officially approved read-only integration exists.