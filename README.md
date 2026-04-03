# Tennis Live Scores

Real-time tennis match scoring for clubs. Umpires score matches from their phone, spectators follow along on a clubhouse TV — all synced instantly via Firebase.

## How It Works

- **Umpire mode** (phone): Create a match, then tap the point winner. Full tennis scoring logic (deuce, advantage, tiebreaks, server rotation) is handled automatically.
- **Spectator mode** (TV): Displays a live-updating grid of all active matches. Tap any match to expand full-screen. Finished matches show briefly with a "Final" badge.
- **Sync**: Firebase Realtime Database pushes updates instantly — no polling, no page refresh needed.

## Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project** → name it (e.g. `tennis-live-scores`) → create
3. In the left sidebar, go to **Build → Realtime Database**
4. Click **Create Database**
5. Choose a location (e.g. `europe-west1` for UK)
6. Start in **test mode** for now (you can tighten rules later)

### 2. Register a Web App

1. In Firebase Console → **Project Settings** (gear icon) → **General**
2. Under "Your apps", click the web icon (`</>`)
3. Register with a nickname (e.g. `tennis-web`) — no hosting needed
4. Copy the `firebaseConfig` object values

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Fill in your Firebase config values from step 2:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=tennis-live-scores.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://tennis-live-scores-default-rtdb.europe-west1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=tennis-live-scores
VITE_FIREBASE_STORAGE_BUCKET=tennis-live-scores.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 4. Install & Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in two tabs — one as Umpire, one as Spectator.

## Deploy to Vercel

1. Push to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → Import → select the repo
3. Add your environment variables in Vercel's dashboard (Settings → Environment Variables) — same keys as `.env`
4. Deploy

Optionally add a custom subdomain like `scores.social-climbing.com` in Vercel's domain settings.

## Firebase Security Rules

The test-mode rules expire after 30 days. For production, update your Realtime Database rules to:

```json
{
  "rules": {
    "matches": {
      "$matchId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

This allows anyone to read and write matches (appropriate for a club tool). If you want to lock it down later, you can add Firebase Anonymous Auth and restrict writes to authenticated users.

## PWA (Add to Home Screen)

The app includes a web manifest so umpires can add it to their phone home screen for a full-screen, app-like experience. Just visit the URL in mobile Safari/Chrome → tap Share → Add to Home Screen.

**Note**: You'll need to add two icon files to `public/`:
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)

Use your club logo or a tennis ball icon.

## Project Structure

```
src/
  main.jsx          → Entry point
  App.jsx           → Mode selector + routing
  scoring.js        → Pure tennis scoring engine (no dependencies)
  firebase.js       → Firebase init + real-time CRUD helpers
  UmpireMode.jsx    → Match setup + point-by-point scoring UI
  SpectatorMode.jsx → Live scoreboard grid + expanded match view
  ScoreTable.jsx    → Shared score display component
  styles.js         → Design tokens (colours, constants)
  index.css         → Global reset + base styles
```

## Features

- Full tennis scoring: love/15/30/40, deuce/advantage, tiebreaks at 6-6
- Correct tiebreak service rotation (switch after 1st point, then every 2)
- Match Point / Set Point / Break Point / Tiebreak alerts
- Pulsing match-point highlight on the TV view
- 6 colour-coded courts for visual distinction
- Undo button for umpire misclicks
- Server indicator (gold dot) throughout
- Tap-to-expand any match on the spectator view
- Responsive grid: 1 match = full width, 2+ = auto grid
- PWA-ready for Add to Home Screen
- Best-of-3 or best-of-5 format support
