# Facility Native Release Foundation

Facility uses a hosted Next.js release strategy because authenticated dynamic routes, including home detail pages, are not currently static-export safe.

## Required environment

`CAP_SERVER_URL=https://facility.example.com`

The URL must be the HTTPS production Facility deployment. `http://` is permitted only for an explicitly configured local development run.

## Initial native projects

```bash
npm run cap:add:ios
npm run cap:add:android
```

## Sync

```bash
CAP_SERVER_URL=https://facility.example.com npm run cap:sync:ios
CAP_SERVER_URL=https://facility.example.com npm run cap:sync:android
```

## Remaining release work

- Configure Apple signing, bundle version, icons, launch screen, push permissions, and App Store metadata in Xcode.
- Configure Android signing, version code, adaptive icons, notification permissions, and Play Console metadata.
- Validate login, network loss, API outage, keyboard behavior, and deep-link return on physical devices.
