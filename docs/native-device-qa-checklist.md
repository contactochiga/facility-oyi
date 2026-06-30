# Facility Native Device QA Checklist

## Session and auth

- Fresh install opens the hosted shell correctly.
- Login succeeds.
- Logout clears session cleanly.
- Relaunch preserves session when expected.

## Shell and navigation

- Safe area is respected on iPhone notch and Android gesture devices.
- Bottom navigation remains visible and tappable.
- Assistant sheet opens without route changes or page jumps.
- Notifications screen opens without layout shift.

## Keyboard and sheets

- Keyboard does not cover form fields or the assistant composer.
- Drawer and assistant scrolling remain stable while typing.
- Rotation does not leave extra bottom spacing.

## Core product flows

- Visitor queue and visitor detail flows load correctly.
- Device control and infrastructure detail flows reflect realtime state.
- Wallet and financial posture flows load without clipped actions.
- Activity and runtime feed remain readable on slow connections.

## Network resilience

- Offline state is understandable and recoverable.
- Slow-network loading states remain compact.
- Reconnect restores session and realtime data without duplicate UI state.
