# Facility Release Gates

## Before Staging

- lint, typecheck, build
- backend compatibility verified
- `npm run validate:release`

## Before Production

- staging smoke complete
- authenticated shell verified
- core operational pages verified

## Blockers

- failing build or typecheck
- broken middleware or auth flow
- broken backend compatibility or runtime consumption
