# Facility Environment Variable Checklist

## Required for web runtime

- `NEXT_PUBLIC_API_URL`: Facility API base URL.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL for auth and realtime.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase public anon key.

## Required for hosted native shell sync

- `CAP_SERVER_URL`: HTTPS Facility deployment loaded by the Capacitor shell.

## Optional public integrations

- `NEXT_PUBLIC_GOOGLE_MAPS_KEY`: Maps and place rendering.
- `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`: Wallet and payment surfaces where enabled.

## Native packaging assumptions

- Facility remains a hosted shell. The native app redirects to the deployed HTTPS Facility origin.
- Auth/session persistence depends on the deployed backend cookie/session configuration matching the Facility origin loaded by `CAP_SERVER_URL`.
- Realtime and socket flows must target the same backend environment as `NEXT_PUBLIC_API_URL`.

## Pre-sync checklist

- Confirm `CAP_SERVER_URL` points to the intended hosted environment.
- Confirm the backend supports mobile WebView auth/session persistence for that origin.
- Confirm TLS is valid. Only use `http://` for explicit local-device testing.
