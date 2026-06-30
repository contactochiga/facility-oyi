# Facility Performance and Load Testing Plan

## Web and WebView checks

- Run Lighthouse against the hosted Facility shell for mobile and desktop baselines.
- Capture Core Web Vitals for Overview, Infrastructure Registry, and Operational Intelligence.
- Verify mobile WebView startup time, drawer latency, and assistant open latency on real devices.

## Backend dependency checks

- Run backend API load tests with k6 or Artillery against auth, registries, runtime read APIs, and notifications.
- Measure socket connect time, reconnect behavior, and event burst handling under poor network conditions.

## Runtime and device responsiveness

- Measure command-to-UI latency for visitor actions, device detail refresh, and assistant responses.
- Record slowest screens after cold launch and after background resume.

## Stability checks

- Watch memory growth during prolonged navigation, drawer usage, and assistant conversations.
- Confirm no repeated redirect loops occur in the hosted shell.
