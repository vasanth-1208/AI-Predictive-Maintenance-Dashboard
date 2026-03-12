# AI-Driven Predictive Maintenance System

A multi-machine industrial monitoring platform built with **React + Vite + Tailwind + Convex**.  
It supports real-time telemetry ingestion from ESP32 devices, adaptive MSI-based alerting, relay automation, role-based access sharing, and rich PDF/email reporting.

## Features

- Multi-machine management (admin-controlled creation)
- Per-machine sensor configuration
  - Temperature / Vibration / Current (plus custom sensor names/units/thresholds)
- Real-time telemetry storage and dashboards
- Adaptive Machine Stress Index (MSI)
- Multi-stage alerts:
  - `EARLY` -> `beep_short`
  - `CRITICAL` -> `beep_long`
  - `SHUTDOWN` -> auto `relay_off` (only when relay is ON and mode is AUTO)
- Relay control + Auto/Manual override mode
- Role-based access:
  - Owner / Editor / Viewer
  - Share machine by email
- Authentication:
  - Email/password
  - Google sign-in
- Rich machine reports:
  - Download PDF
  - Email PDF attachment with summary

## Tech Stack

- Frontend: React 19, Vite 6, Tailwind CSS
- Backend: Convex
- Auth: `@convex-dev/auth` + Google provider
- Reports: `pdf-lib`, `nodemailer`

## Project Structure

- `src/` - frontend UI
- `convex/schema.ts` - DB schema
- `convex/machines.ts` - machine CRUD + mode/device updates
- `convex/sensors.ts` - sensor CRUD
- `convex/telemetry.ts` - ingest, MSI, alerts, timelines
- `convex/commands.ts` - relay/buzzer commands
- `convex/shares.ts` - access sharing
- `convex/reports.ts` - report query data
- `convex/reportsNode.ts` - PDF + email generation
- `convex/http.ts` + `convex/router.ts` - HTTP endpoints (`/api/ingest`)

## MSI Logic

Adaptive formula:

```text
MSI =
(0.35 x vibration_stress) +
(0.30 x current_stress) +
(0.20 x temperature_stress) +
(0.15 x working_hours_stress)
```

Alert rules:

- `MSI >= 40` -> `EARLY`
- `MSI >= 70` -> `CRITICAL`
- `MSI >= 80` -> `SHUTDOWN`

## Access Model

- Admin can create machines
- Machine owner can edit/share/delete
- Shared users can be:
  - `owner`
  - `editor`
  - `viewer`

Set admin emails via Convex env:

```bash
npx convex env set ADMIN_EMAILS "adminapmd@gmail.com"
```

For multiple admins:

```bash
npx convex env set ADMIN_EMAILS "admin1@gmail.com,admin2@gmail.com"
```

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Start Convex dev backend

```bash
npx convex dev
```

This provisions deployment and creates `.env.local` with Convex URLs.

### 3) Configure environment variables (Convex)

#### Google Auth

```bash
npx convex env set AUTH_GOOGLE_ID "YOUR_GOOGLE_CLIENT_ID"
npx convex env set AUTH_GOOGLE_SECRET "YOUR_GOOGLE_CLIENT_SECRET"
```

#### Email (for PDF mail dispatch)

```bash
npx convex env set SMTP_USER "adminapmd@gmail.com"
npx convex env set SMTP_PASS "YOUR_APP_PASSWORD"
npx convex env set SMTP_FROM "adminapmd@gmail.com"
```

#### Optional ESP32 ingest key (recommended)

```bash
npx convex env set ESP32_INGEST_KEY "YOUR_SECRET_KEY"
```

### 4) Run frontend + backend together

```bash
npm run dev
```

Or separately:

```bash
npm run dev:backend
npm run dev:frontend
```

## Google Sign-In Setup

In Google Cloud Console (OAuth 2.0 Client ID):

1. Add **Authorized redirect URI**:
   - `https://<your-convex-site-url>/api/auth/callback/google`
2. Add origins as needed (e.g., `http://localhost:5173`).
3. Ensure consent screen is configured and test users are added (if app is in testing mode).

Use the Convex site URL shown in your environment/dashboard.

## ESP32 Ingest API

Endpoint:

```text
POST <VITE_CONVEX_SITE_URL>/api/ingest
```

Example payload:

```json
{
  "deviceId": "14569",
  "temperature": 55.6,
  "vibration": 1.4,
  "current": 2.5,
  "timestamp": 1741770000000,
  "signalStrength": 82,
  "batteryStatus": "N/A",
  "powerStatus": "Mains",
  "ingestKey": "YOUR_SECRET_KEY"
}
```

## Reports

Each machine supports:

- `Download PDF` (rich detailed report)
- `Send Email` (styled email + PDF attachment)

PDF includes:

- Machine profile and status
- Access/sharing info
- Sensor config + latest values
- Telemetry statistics
- Alerts, commands, notification logs
- Telemetry samples in selected time range

## Build / Validation

```bash
npm run build
npm run lint
```

## Troubleshooting

- **Google `redirect_uri_mismatch`**  
  Add exact Convex callback URL in Google OAuth settings.
- **Email not sending**  
  Verify `SMTP_USER`, `SMTP_PASS` (Gmail App Password), `SMTP_FROM`.
- **No telemetry shown**  
  Confirm `deviceId` matches machine and sensors exist for required types.
- **Only admin should add machines**  
  Ensure `ADMIN_EMAILS` contains your account email.
