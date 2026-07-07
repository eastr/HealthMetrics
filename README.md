# Health Metrics

A Progressive Web App to track **Fatigue**, **Mood**, **Nausea**, and **Pain** on a 1–10 scale, multiple times per day. Data syncs to a Google Sheet in your Drive. Works on laptop browsers and Android (install via Add to Home Screen).

## Features

- Log six health metrics with sliders (1–10) and optional notes
- Multiple entries per day
- History view with date navigation
- Analytics: daily averages, trend charts, time-of-day breakdown
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

# Start dev server
npm run dev
```

Open http://localhost:5173 and sign in with Google.

On first sign-in, the app creates a spreadsheet named **HealthMetrics** in your Google Drive with an `Entries` sheet.

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

## Android Installation

1. Open the app URL in **Chrome** on your Android phone
2. Tap the menu (⋮) → **Add to Home screen** or **Install app**
3. Launch from your home screen like a native app

## Data Storage

Each entry is stored as a row in your Google Sheet:

| id | timestamp | fatigue | mood | nausea | pain | stiffness | dizziness | notes |
|----|-----------|---------|------|--------|------|-------|

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
