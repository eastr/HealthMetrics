# Health Metrics

A Progressive Web App to track **Fatigue**, **Mood**, **Nausea**, and **Pain** on a 1–10 scale, multiple times per day. Data syncs to a Google Sheet in your Drive. Works on laptop browsers and Android (install via Add to Home Screen).

## Features

- Log six health metrics with steppers (1–10) and optional notes
- Medication logging with schedules and a “Due today” list on Log
- Metric colors and medication catalog synced via Google Sheets across devices
- Multiple entries per day
- History view with date navigation
- Analytics: daily averages, trend charts, time-of-day breakdown, medications
- Share read-only links with your doctor (optional; requires Vercel KV)
- Offline support with automatic sync when back online
- Installable PWA on Android and desktop

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A Google Cloud project with OAuth credentials

## Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project (e.g. `health-metrics`).

2. Enable these APIs:
   - **Google Sheets API**
   - **Google Drive API**

3. Configure the **OAuth consent screen**:
   - User type: External (or Internal if using Google Workspace)
   - Add your email as a test user during development

4. Create an **OAuth 2.0 Client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `http://localhost:5173` (development)
     - Your production URL (e.g. `https://your-app.vercel.app`)

5. Copy the Client ID.

## Local Development

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local and set VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# UI + Google Sheets only (no share API)
npm run dev

# Full stack including /api/share (recommended when testing share links)
npx vercel link          # once
npm run env:pull         # pulls KV + other Vercel env into .env.local
npm run dev:full         # runs vercel dev (UI + API)
```

| Command | Use when |
|---------|----------|
| `npm run dev` | Logging, history, analytics, sheets sync |
| `npm run dev:full` | Share links + anything under `/api` |

Open http://localhost:5173 (or the port `vercel dev` prints) and sign in with Google.

Add `http://localhost:3000` to Google OAuth origins if `vercel dev` uses that port.

On first sign-in, the app creates/updates a spreadsheet named **HealthMetrics** with tabs:
- **Entries** — symptom and medication logs
- **Medications** — catalog + schedules (synced across devices)
- **Metrics** — metric catalog: labels, colors, 1–10 scale texts (synced)
- **CheckIns** — symptom check-in schedules (synced)
- **Meta** — schema version for migrations (`schemaVersion`, `appVersion`, `updatedAt`)

Schema versioning lives in `src/version.ts` (`SCHEMA_VERSION`) and migrations in
`src/services/schemaMigrations.ts`. Bump the schema version and add a migration when sheet
layouts change; the app runs pending migrations automatically on spreadsheet open.

Keep changes local until you’re ready; pushing to GitHub will deploy to Vercel if that integration is connected.

## Build & Deploy

```bash
npm run build
npm run preview   # test production build locally
```

Deploy the `dist/` folder to [Vercel](https://vercel.com), [Netlify](https://netlify.com), or any static host with HTTPS.

After deploying:
1. Add your production URL to Google OAuth authorized JavaScript origins
2. Visit the deployed URL and sign in

### Deploy to Vercel (example)

```bash
npx vercel
```

Set the `VITE_GOOGLE_CLIENT_ID` environment variable in the Vercel project settings.

### Share links (optional)

To let users create read-only links for their doctor:

1. In the Vercel dashboard, add a **KV** or **Upstash Redis** storage integration to your project
2. Ensure these env vars are set (Vercel usually adds them automatically):
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
3. Redeploy. Share links are created from **Settings → Share with your doctor**

Share links store a point-in-time snapshot (symptoms + medications) with automatic expiry. Anyone with the URL can view the data until it expires or you revoke it. This is intended for personal use — review privacy implications before sharing health data.

## Android Installation

1. Open the app URL in **Chrome** on your Android phone
2. Tap the menu (⋮) → **Add to Home screen** or **Install app**
3. Launch from your home screen like a native app

## Data Storage

Spreadsheet **HealthMetrics** in your Google Drive:

**Entries** — symptom and medication logs  

| id | timestamp | type | fatigue…dizziness | medication | dose | notes |

**Medications** — medication + vitamin catalog and schedules (synced)

| id | name | defaultDose | times | days | active | notes | kind |

`kind` is `medication` or `vitamin`.

**Metrics** — catalog (synced)

| id | key | label | color | active | sortOrder | scaleLabels |

**CheckIns** — symptom capture schedule (synced)

| id | label | times | days | active |

**Meta** — schema version (synced)

| key | value |
| schemaVersion | 1 |
| appVersion | 0.1.0 |
| updatedAt | ISO timestamp |

You can view and export data anytime via Google Sheets (link in Settings).

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS
- Google Identity Services (OAuth)
- Google Sheets API
- Recharts
- IndexedDB (offline cache)
- vite-plugin-pwa

## License

Private / personal use.
