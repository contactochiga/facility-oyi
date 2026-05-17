# Oyi Facility OS - Current System Documentation

Last updated: 2026-05-17
Repository: https://github.com/contactochiga/facility-oyi

## 1. What Oyi Facility OS Is

Oyi Facility OS is the estate and facility management control plane inside the Ochiga / Oyi ecosystem. It is built for estate operators, facility managers, security teams, maintenance teams, and infrastructure administrators who need to supervise a physical estate as an operational system.

It is not currently positioned as a pricing or commercial packaging surface. The pricing layer has been removed from the active Facility OS flow for now. The system is focused on operations first: estates, homes, utilities, hardware devices, access, security, maintenance, community, messages, service operations, and live supervision.

## 2. Strategic Role In The Ochiga / Oyi Ecosystem

Ochiga is the company and infrastructure governance layer.

Oyi is the operating system product family.

Oyi Facility OS sits between Ochiga Office OS and Oyi Consumer OS:

- Ochiga Office OS supervises all estates, buildings, users, support, AI agents, documents, and operational intelligence globally.
- Oyi Facility OS manages estate-level operations for a specific estate or facility cluster.
- Oyi Consumer OS manages residents, homes, wallets, community interactions, devices, support, and personal smart-home experiences.
- Oyi Edge Agent connects local hardware, cameras, site infrastructure, and edge-level telemetry.

Facility OS is therefore the site-level operations console. It is where an estate is run every day.

## 3. Current Technology Stack

Frontend:

- Next.js 15.5.9
- React 19
- TypeScript
- Tailwind CSS
- Zustand for session state
- Axios for API communication
- Recharts for charts
- TanStack Table for data tables
- Lucide / React Icons / Heroicons for UI iconography
- HLS.js for camera streaming support
- Vercel Analytics
- Capacitor dependencies included for future mobile-shell support

Backend dependency:

- Oyi / Ochiga backend API at `NEXT_PUBLIC_API_URL`, currently pointing to the Render-hosted backend in local env.

Core environment variables:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_API_BASE_URL` fallback where used

## 4. Authentication And Session

Facility OS uses operator authentication through the backend `/auth/login` route.

Current behavior:

- Login page: `/login`
- Signup page: `/signup`
- Protected pages require `oyi_facility_token` cookie.
- Client API requests read `oyi_facility_token` from local storage.
- Session decoding uses `jwt-decode`.
- Auth now supports permission enrichment through `lib/oyiFoundation.ts`.
- Logout clears Facility and related Oyi tokens.

Recent production fix:

- Backend CORS now allows `X-Ochiga-Surface` and `X-Oyi-Contract-Version` headers.
- Live login was tested with the provided operator account and returned a valid token.
- Signup OTP CORS preflight was also confirmed working.

## 5. Current Navigation Structure

The active Facility OS sidebar currently exposes:

- Overview
- Power & Utilities
- Hardware Devices
- Security
- Maintenance
- Visitors & Access
- Traffic
- Water
- Environment
- Occupancy
- Cameras
- Digital Twin
- Community
- Alerts & Incidents

Pricing and active billing navigation have been removed from the main operational sidebar.

## 6. Major Modules And Capabilities

### 6.1 Overview

Route: `/overview`

Purpose:

The overview is the operational command summary for the estate.

Current capabilities:

- Shows linked estate/site context.
- Falls back to estate membership if `/facility/overview` does not return `estate_id`.
- Shows homes under management.
- Shows active device count.
- Shows open maintenance count.
- Shows visitor activity today.
- Shows security/access snapshot.
- Shows alerts and operational trend cards.
- Shows wallet summary from facility overview data.
- Loads visitor activity and community previews when estate context exists.

Live backend routes used:

- `GET /facility/overview`
- `GET /facility/estates`
- `GET /facility/visitors`
- Community service endpoints through `communityService`

Current verified live values from the test account:

- Estate ID resolved successfully.
- Homes count loaded.
- Maintenance count loaded.
- Visitor count loaded.

### 6.2 Power & Utilities

Route: `/utilities`

Purpose:

A national-grade utility supervision layer for estate infrastructure.

Current capabilities:

- Presents power, water, network, and sensor domains.
- Derives utility intelligence from live Facility data instead of hardcoded placeholders.
- Pulls Facility overview, hardware devices, maintenance requests, and notifications.
- Classifies infrastructure by keywords such as power, energy, meter, water, pump, network, edge, sensor, smoke, motion, climate, occupancy, and environment.
- Shows per-domain device count, online count, and issue count.
- Links operators back to Hardware Devices and Alerts & Incidents.

Live backend routes used indirectly:

- `GET /facility/overview`
- `GET /facility/devices`
- `GET /facility/maintenance`
- `GET /notifications?unread=true`

Current status:

- Operationally wired to live backend data.
- Dedicated utility backend endpoints are not yet separate; the current version derives utility state from existing operational records.

### 6.3 Hardware Devices

Route: `/devices`

Purpose:

Hardware registry, discovery, and device operations.

Current capabilities:

- Lists registered facility devices using the facility-scoped route.
- Supports device discovery flows.
- Supports adapter options such as Tuya, SSDP, and ONVIF through `facilityService`.
- Supports selected-device registration from discovered results.
- Supports device command hooks.
- Categorizes device systems in the UI, including energy, access, security, utilities, and other device classes.
- Includes operational charts and device distribution summaries.

Live backend routes used:

- `GET /facility/devices`
- `GET /facility/devices/discover`
- `POST /facility/devices/register`
- `POST /facility/devices/:deviceId/command`

Current status:

- Connected to facility-scoped backend routes.
- Current test account showed zero registered devices, so the page is structurally working but awaiting live hardware records.

### 6.4 Security

Route: `/security`

Purpose:

Security command surface for camera intelligence and operational monitoring.

Current capabilities:

- Security page exists as a dedicated operational module.
- Camera intelligence has been moved out of a generic camera-only menu into Security workflow.
- Pulls camera-like devices from the device registry.
- Pulls unread incidents/notifications.
- Shows AI-style camera preview cards, event labels, confidence, object model, and response state.
- Links to Hardware Devices for registry-level work.

Live backend routes used indirectly:

- Device registry service
- Notification service
- Camera service where camera pages are used

Current status:

- UI and workflow are active.
- Real camera feeds depend on registered camera devices and backend camera stream availability.

### 6.5 Cameras

Route: `/cameras`

Purpose:

Dedicated camera operations surface for scanning, binding, playback, HLS streams, analytics, and camera wall views.

Current capabilities:

- Camera service supports backend camera capabilities.
- Camera player component supports HLS playback through HLS.js.
- Multi-camera wall component exists.
- Camera routes and analytics hooks are present.

Live backend routes used:

- `/cameras/...` routes through `cameraService`

Current status:

- Requires backend camera sources and registered streams for full production usage.

### 6.6 Homes & Units

Route: `/homes`

Purpose:

Manage homes, units, rooms, and resident-linked infrastructure inside an estate.

Current capabilities:

- Loads the operator estate from membership.
- Lists homes under the estate.
- Creates homes with fields for name, unit, block, type, description, resident, meters, internet ID, gate code, and coordinates.
- Supports operational summary cards for homes.
- Links into home-specific rooms and users pages.

Live backend routes used:

- `GET /facility/estates`
- `GET /facility/estates/:estateId/homes`
- `POST /facility/homes`
- `GET /facility/homes/:homeId/rooms`
- Home user routes under `/facility/homes`

Current status:

- Connected to live estate-scoped backend data.

### 6.7 Maintenance

Route: `/maintenance`

Purpose:

Facility maintenance request and work-order supervision.

Current capabilities:

- Lists facility maintenance requests.
- Uses facility-scoped backend route.
- Supports operational table view.
- Backend supports maintenance update routes.

Live backend routes used:

- `GET /facility/maintenance`

Current verified data:

- Live backend returned maintenance requests for the test account.

### 6.8 Visitors & Access

Route: `/visitors`

Purpose:

Gate flow, visitor approvals, access verification, entry and exit management.

Current capabilities:

- Lists facility visitor records.
- Supports today/status filtering via service method.
- Supports visitor verification by code.
- Supports visitor status update.
- Supports timeline loading.
- Supports lockdown action.
- Supports report export.

Live backend routes used:

- `GET /facility/visitors`
- `POST /facility/visitors/verify`
- `PATCH /facility/visitors/:id`
- `GET /facility/visitors/:id/timeline`
- `POST /facility/visitors/actions/lockdown`
- `GET /facility/visitors/reports/export`

Current status:

- Connected to facility-scoped visitor backend.

### 6.9 Alerts & Incidents

Route: `/alerts`

Purpose:

Unread notifications, incidents, and operational alerts.

Current capabilities:

- Pulls unread notifications from the backend.
- Shows operational alerts and incident state.
- Used by Security and Utility workflows as an issue signal.

Live backend routes used:

- `GET /notifications?unread=true`

Current status:

- Connected to backend notifications.

### 6.10 Community

Route: `/community`

Purpose:

Estate community communication, posts, discussions, announcements, and resident-to-estate updates.

Current capabilities:

- Community feed surface exists.
- Media rendering support has been added in previous updates.
- Discussion flow exists.
- Community previews are used in Overview when estate context exists.

Live backend dependency:

- Community service routes through `communityService`.

Current status:

- Active surface, dependent on estate-linked community records.

### 6.11 Messages

Route: `/messages`

Purpose:

Facility messaging and conversation management.

Current capabilities:

- Message service exists.
- Messages page exists.
- Supports operational communication workflows through backend message routes.

Current status:

- Active page, still needs deeper UI/UX harmonization to match the latest Office-level command design.

### 6.12 Traffic

Route: `/traffic`

Purpose:

Traffic, mobility, vehicle and movement analytics within the estate.

Current status:

- Page exists as an operational surface.
- Requires live traffic/vehicle integration for full production intelligence.

### 6.13 Water

Route: `/water`

Purpose:

Water utility supervision.

Current status:

- Page exists.
- Utility layer also summarizes water issues through `/utilities`.
- Requires dedicated water meter/pump telemetry for full production mode.

### 6.14 Environment

Route: `/environment`

Purpose:

Environmental monitoring such as climate, air, noise, smoke, and safety sensors.

Current status:

- Page exists.
- Requires sensor records and telemetry to become fully live.

### 6.15 Occupancy

Route: `/occupancy`

Purpose:

Occupancy analytics and estate/housing utilization.

Current status:

- Page exists.
- Requires populated homes/resident occupancy data for full insight.

### 6.16 Digital Twin

Route: `/digital-twin`

Purpose:

Facility-side digital twin interface for estate infrastructure visualization.

Current status:

- Page exists.
- Full production digital twin live binding is still future-phase work.

### 6.17 Services

Route: `/services`

Purpose:

Operational service configuration and wallet-service rules.

Current change:

- Pricing language has been removed/reworded from this active surface.
- It is now positioned as service rules and wallet operations rather than a pricing layer.

Current status:

- Active, but should be treated as operational service configuration, not commercial pricing packaging.

### 6.18 Wallet Operations

Route: `/wallets`

Purpose:

Estate and facility wallet flows.

Current change:

- Former billing-facing wording has been softened into wallet operations.

Current capabilities:

- Shows finance/wallet signals from backend.
- Supports wallet-related service operations through wallet service.

Current status:

- Active wallet operations surface remains available, but pricing/commercial plan packaging is removed.

### 6.19 Account

Route: `/account`

Purpose:

Operator account/profile settings.

Current capabilities:

- Operator account area exists.
- Sidebar profile/logout system routes correctly.

### 6.20 Super Admin

Route: `/super-admin`

Purpose:

Higher-level administrative functions.

Current status:

- Page exists.
- Should be permission-controlled through backend authorization.

## 7. Shared Services Layer

Facility OS currently includes service modules for:

- `api.ts` - Axios API client with Facility headers and contract version.
- `authService.ts` - Login/signup.
- `facilityService.ts` - Overview, estates, homes, rooms, device discovery, device registration, estate users, home users.
- `deviceService.ts` - Facility device listing through `/facility/devices`.
- `utilityService.ts` - Derived utility intelligence from overview, devices, maintenance, notifications.
- `maintenanceService.ts` - Facility maintenance requests through `/facility/maintenance`.
- `visitorService.ts` - Facility visitors and access workflows.
- `notificationService.ts` - Unread notifications.
- `cameraService.ts` - Camera capabilities and stream helpers.
- `communityService.ts` - Estate community flows.
- `messagesService.ts` - Messaging flows.
- `walletsService.ts` - Wallet operations.
- `serviceConfigService.ts` - Estate service configuration.
- `superAdminService.ts` - Super admin operations.

## 8. Backend Integration State

Confirmed working:

- `POST /auth/login`
- CORS preflight for `/auth/login`
- CORS preflight for `/auth/otp/send`
- `GET /facility/overview`
- `GET /facility/estates`
- `GET /facility/devices`
- `GET /facility/maintenance`
- `GET /facility/visitors`
- `GET /notifications?unread=true`

Recent backend deployment:

- Backend CORS fix was pushed and confirmed live on Render.
- The backend now allows the Facility headers required by the frontend.

## 9. Current Production Readiness

Approximate readiness by area:

- Auth/login: high
- Signup CORS path: high, OTP still depends on email provider behavior
- Overview: high
- Estate membership fallback: high
- Homes/units: medium-high
- Hardware devices: medium, awaiting real registered hardware for richer validation
- Maintenance: high for list/read, medium for full assignment/update UX
- Visitors/access: medium-high
- Alerts/notifications: medium-high
- Power & Utilities: medium, derived live intelligence exists but dedicated utility endpoints are still pending
- Security: medium, UI workflow exists; live camera/device data required for full operational strength
- Cameras: medium, player and service exist; needs live camera fleet
- Community: medium-high
- Messages: medium
- Traffic/water/environment/occupancy: medium, surfaces exist but need deeper live telemetry
- Digital Twin: early/medium, surface exists but live binding is not complete
- Wallet operations: medium
- Super Admin: medium, should be reviewed with backend permissions

Overall Facility OS production foundation: approximately 65-70% for operational control-plane usage, higher for authenticated estate overview and maintenance flows, lower for live hardware-heavy modules until devices/cameras/utility telemetry are populated.

## 10. What Was Recently Completed

- Confirmed repo is `contactochiga/facility-oyi`.
- Removed active pricing/commercial plan layer.
- Restored infrastructure-first sidebar direction.
- Added Power & Utilities module.
- Added Security module.
- Moved camera intelligence direction into Security.
- Wired Facility services to facility-scoped backend routes.
- Fixed backend CORS issue on Render.
- Confirmed live login works.
- Fixed Overview estate fallback when overview has no direct `estate_id` but membership exists.
- Confirmed local production build passes.

## 11. What Still Needs To Be Completed

Priority next work:

1. Add dedicated backend utility endpoints for power, water, network, and sensors instead of deriving everything from generic devices/tickets.
2. Register real hardware devices into `/facility/devices` so Hardware Devices, Security, Cameras, Utilities, Environment, Occupancy, and Water can become fully live.
3. Connect camera streams and camera health to Security and Cameras modules.
4. Add deeper action handling for maintenance assignment, closure, SLA status, and escalation from Facility UI.
5. Add visitor approval/entry/exit controls directly in the Visitors UI where not already exposed.
6. Harmonize Messages, Wallet Operations, Services, Super Admin, and Digital Twin UI with the latest Facility design language.
7. Add role-based UI gating so menu/actions change based on operator permission.
8. Add realtime updates from backend socket/SSE into Overview, Utilities, Security, Alerts, Devices, and Visitors.
9. Add audit visibility for facility actions.
10. Add deployment verification for the Facility frontend production host after each push.

## 12. Summary

Oyi Facility OS is now a real estate/facility operations control plane. It has authenticated access, estate context, operational overview, homes/units management, maintenance supervision, visitor/access workflows, hardware device registry, security surface, camera support, community, messaging, wallet operations, utility supervision, and multiple infrastructure pages for traffic, water, environment, occupancy, and digital twin.

The system is no longer centered around pricing. It is now shaped around operational infrastructure management.

The strongest current areas are authentication, overview, estate membership, maintenance listing, visitor data, notifications, and the module structure. The next major jump is to feed it with real hardware devices, cameras, utility telemetry, and realtime events so every module becomes fully alive.
