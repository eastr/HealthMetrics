# Health Metrics

A local-first Progressive Web App to track health metrics on a 1–10 scale, multiple times per day. IndexedDB keeps the app fast and available offline; Supabase syncs data across devices.

## Features

- Log six health metrics with steppers (1–10) and optional notes
- Medication logging with schedules and a “Due today” list on Log
- Metric colors and medication catalog synced via Supabase across devices
- Multiple entries per day
- History view with date navigation
- Analytics: daily averages, trend charts, time-of-day breakdown, medications
- Share read-only links with your doctor (optional; requires Vercel KV)
- Offline support with automatic sync when back online
- Installable PWA on Android and desktop

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A Supabase project
- A Google OAuth client for Supabase Auth

## Supabase Setup

1. Create a Supabase project in a European region.
2. Open its SQL Editor and run `supabase/schema.sql`.
3. In **Authentication → Providers → Google**, enable Google and enter your Google OAuth client ID and secret.
4. In Google Cloud, add the Supabase callback URL shown on that provider page as an authorized redirect URI.
5. In **Authentication → URL Configuration**, set your production Site URL and add `http://localhost:5173/**` as a development redirect URL.
6. Copy the project URL and anon/publishable key from **Project Settings → API**.

## Local Development

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# UI + Supabase sync (no share API)
npm run dev

# Full stack including /api/share (recommended when testing share links)
npx vercel link          # once
npm run env:pull         # pulls KV + other Vercel env into .env.local
npm run dev:full         # runs vercel dev (UI + API)
```

| Command | Use when |
|---------|----------|
| `npm run dev` | Logging, history, analytics, Supabase sync |
| `npm run dev:full` | Share links + anything under `/api` |

Open http://localhost:5173 (or the port `vercel dev` prints) and sign in with Google through Supabase.

Keep changes local until you’re ready; pushing to GitHub will deploy to Vercel if that integration is connected.

## Build & Deploy

```bash
npm run build
npm run preview   # test production build locally
```

Deploy the `dist/` folder to [Vercel](https://vercel.com), [Netlify](https://netlify.com), or any static host with HTTPS.

After deploying:
1. Add your production URL to Supabase Auth's allowed redirect URLs
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` on the host
3. Visit the deployed URL and sign in

### Deploy to Vercel (example)

```bash
npx vercel
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project settings.

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

- **IndexedDB** is the local working store for entries and the offline mutation queue.
- **Supabase Postgres** is the shared source of truth for entries, medication presets, metrics, and check-in schedules.
- Row Level Security restricts every table to the signed-in user.
- Deletes use tombstones for entries so other devices reliably learn about deletions.

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS
- Supabase Auth + Postgres
- Recharts
- IndexedDB (offline cache)
- vite-plugin-pwa

## License

Private / personal use.
