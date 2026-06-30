# Facility Deployment Checklist

## Validation

- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build`
- `npm run validate:release`
- `git diff --check`

## Hosted shell deployment

- Confirm `NEXT_PUBLIC_API_URL` targets the intended backend.
- Confirm `CAP_SERVER_URL` targets the intended HTTPS Facility deployment.
- Confirm auth cookies and session persistence work from mobile WebView.
- Confirm realtime subscriptions, notifications, and assistant flows connect to the same backend/runtime environment.

## Native test-build readiness

- Run `CAP_SERVER_URL=https://facility.example.com npm run cap:sync:ios`.
- Run `CAP_SERVER_URL=https://facility.example.com npm run cap:sync:android`.
- Open Xcode or Android Studio only after sync succeeds without asset or config drift.

## Post-deploy smoke

- Login and logout.
- Open Overview, Visitors, Infrastructure Registry, Operational Intelligence, Notifications, and assistant sheet.
- Verify drawer interactions, keyboard behavior, safe-area handling, and bottom navigation on a physical device.
