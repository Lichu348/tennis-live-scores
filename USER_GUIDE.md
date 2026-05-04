# Tennis Live Scores - Complete User Guide

A real-time tennis scoring system for clubs, allowing umpires to score matches from their phones while spectators watch live updates on TV displays.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [System Overview](#system-overview)
3. [Umpire Guide](#umpire-guide)
4. [TV Display Setup](#tv-display-setup)
5. [Admin Mode](#admin-mode)
6. [Multiple Umpires](#multiple-umpires)
7. [Understanding the Scoring Display](#understanding-the-scoring-display)
8. [Troubleshooting](#troubleshooting)
9. [Technical Setup (Admin)](#technical-setup-admin)

---

## Quick Start

### For Umpires (Scoring a Match)
1. Open the app URL on your phone
2. Tap **"Umpire Mode"**
3. Enter the PIN (if one has been set up)
4. Enter player names, select court, choose format
5. Tap **"Start Match"**
6. Tap the player name button each time they win a point

### For TV Display (Spectator View)
1. Open the app URL on the TV browser
2. Tap **"Spectator Mode"**
3. All live matches appear automatically
4. Tap any match to expand to full screen

### For Administrators
1. Open the app URL
2. Tap **"Admin"**
3. Enter the PIN
4. Manage matches (delete old/finished matches)

---

## System Overview

### How It Works

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Umpire Phone  │ ──────► │  Firebase Cloud │ ──────► │   TV Display    │
│   (Scores)      │         │  (Syncs Data)   │         │   (Shows Live)  │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

- **Umpires** create matches and tap to record points
- **Firebase** instantly syncs all data (under 200ms)
- **Spectators** see live updates on any connected screen
- **Multiple matches** can run simultaneously on different courts

### Three Modes

| Mode | Who Uses It | What It Does |
|------|-------------|--------------|
| **Umpire Mode** | Match officials | Create matches, score points, undo mistakes, adjust scores |
| **Spectator Mode** | TV displays, audience | View all live matches, see scores update in real-time |
| **Admin Mode** | Tournament managers | Delete matches, clear old data, manage the system |

### Security Features

- **PIN Protection**: Umpire and Admin modes can be protected with a PIN code
- **Match Locking**: Prevents two umpires from accidentally editing the same match
- **Session Management**: PIN sessions last 8 hours before requiring re-entry

---

## Umpire Guide

### Accessing Umpire Mode

1. **Open the App** and tap **"Umpire Mode"**
2. **Enter PIN** (if configured)
   - First-time setup: You'll be prompted to create a PIN
   - Subsequent access: Enter your PIN
   - Sessions last 8 hours

### Starting a New Match

1. **Set Up the Match**

   | Field | What to Enter |
   |-------|---------------|
   | **Player 1** | Name of first player (will serve first) |
   | **Player 2** | Name of second player |
   | **Court** | Select from 6 color-coded courts |
   | **Format** | Best of 3 or Best of 5 sets |

2. **Start the Match**
   - Tap **"Start Match"**
   - You'll see the scoring interface

### Resuming an Existing Match

If you have a match in progress (e.g., your phone died or you refreshed):

1. Select **"Resume"** instead of creating a new match
2. Your active match will be listed
3. If another device is scoring that match, you'll see a warning
4. You can **"Take Over"** if needed (use with caution)

### Match Locking

The system prevents scoring conflicts:

- When you resume a match, it's **locked** to your device
- If someone else tries to resume, they see **"Match is being scored by another device"**
- Locks expire after 5 minutes of inactivity
- You can force **"Take Over"** if the other device is actually inactive

### Scoring Points

**To record a point:**
- Tap the button of the player who **WON** the point
- The score updates instantly
- All connected spectator screens update automatically

**The app automatically handles:**
- Love → 15 → 30 → 40 → Game progression
- Deuce and Advantage
- Tiebreaks at 6-6
- Service rotation (including tiebreak rules)
- Set and match completion

### Understanding the Umpire Screen

```
┌─────────────────────────────────────┐
│  Centre Court     [History] [Back]  │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │      PLAYER 1 NAME          │    │  ← Tap when Player 1 wins point
│  │      (Server: •)            │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │      PLAYER 2 NAME          │    │  ← Tap when Player 2 wins point
│  └─────────────────────────────┘    │
│                                     │
├─────────────────────────────────────┤
│           15 - 30                   │  ← Current game points
├─────────────────────────────────────┤
│  Player 1    │ S1 │ S2 │ Pts │      │
│  Player 2    │  6 │  3 │     │      │  ← Full scoreboard
├─────────────────────────────────────┤
│  [Undo]         [Adjust Score]      │  ← Action buttons
└─────────────────────────────────────┘
```

### Undo Mistakes

Made a scoring error? No problem:
- Tap **"Undo"** at the bottom of the screen
- The previous state is restored
- You can undo multiple times if needed

**Undo now persists across page refreshes!** Your undo history is saved to the cloud, so even if you refresh or your phone restarts, you can still undo previous points.

### Point History & Rewind

For correcting errors from earlier in the match:

1. Tap **"History"** button
2. See a complete list of every point scored
3. Each entry shows: point number, who won, resulting score
4. **Tap any point** to rewind to that exact state
5. Continue scoring from there (later points are discarded)

This is much faster than repeatedly pressing Undo!

### Adjust Score (Jump to Score)

If you need to set an exact score (e.g., resuming after phone death):

1. Tap **"Adjust Score"** button
2. Enter the target score:
   - **Sets**: e.g., "6-4, 3-2" for player 1 won first set 6-4, leading 3-2 in second
   - **Game Points**: Current game score (0-0 for start of game)
   - **Server**: Who is currently serving
3. Tap **"Apply"**
4. The match jumps to that exact state
5. Continue scoring normally

**Validation**: The system validates that your score is reachable (e.g., you can't have 7-5 without a tiebreak).

### Alerts & Notifications

The app displays visual alerts for key moments:

| Alert | Color | Meaning |
|-------|-------|---------|
| **Match Point** | Red (pulsing) | Player is one point from winning the match |
| **Set Point** | Orange | Player is one point from winning the set |
| **Break Point** | Purple | Receiver is one point from breaking serve |
| **Tiebreak** | Court color | Currently playing a tiebreak |

### When the Match Ends

- The match automatically detects when a player wins
- A **"Final"** badge appears
- The match remains visible to spectators with a trophy icon next to the winner
- To start a new match, tap **"Back to Home"** and begin again

### Installing as an App (Recommended)

For the best umpiring experience, install the app to your home screen:

**iPhone/iPad:**
1. Open the URL in Safari
2. Tap the Share button (box with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"**

**Android:**
1. Open the URL in Chrome
2. Tap the three-dot menu
3. Tap **"Install app"** or **"Add to Home Screen"**
4. Confirm installation

This gives you:
- Full-screen mode (no browser bar)
- Quick access from home screen
- App-like experience

---

## TV Display Setup

### Basic Setup

1. **Connect a device to your TV**
   - Smart TV with web browser
   - Laptop/PC connected via HDMI
   - Streaming stick (Fire TV, Chromecast, etc.) with browser capability
   - Tablet connected to TV

2. **Open the App**
   - Navigate to the app URL
   - Tap **"Spectator Mode"**

3. **Position and Lock**
   - Arrange the browser window to fill the screen
   - Enable full-screen mode (usually F11 on PC, or use browser menu)
   - Disable screen saver / sleep mode

### Recommended TV Setup

**Hardware Options (Best to Good):**

| Option | Pros | Cons |
|--------|------|------|
| **Laptop + HDMI** | Reliable, easy to control | Need a spare laptop |
| **Smart TV Browser** | No extra hardware | Browser may be limited |
| **Fire TV Stick + Silk Browser** | Cheap, dedicated | May need to refresh occasionally |
| **Raspberry Pi + Chromium** | Cheap, always-on | Requires technical setup |
| **Chromecast + Cast Tab** | Easy from any laptop | Requires casting device nearby |

**Display Settings:**
- Set TV to 16:9 aspect ratio
- Disable any "motion smoothing" effects
- Set brightness appropriately for ambient light
- Consider using "Game Mode" for lowest latency

### What Spectators See

**Grid View (Multiple Matches):**
```
┌─────────────────────────────────────────────────────────┐
│  🟢 Live                             Tennis Live Scores │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐       │
│  │ ● Centre Court      │  │ ● Court 1           │       │
│  │                     │  │                     │       │
│  │ Player 1   6  3  40 │  │ Player 3   4  6  15 │       │
│  │ Player 2   4  5  30 │  │ Player 4   6  4  30 │       │
│  │                     │  │                     │       │
│  └─────────────────────┘  └─────────────────────┘       │
│                                                         │
│  ┌─────────────────────┐                                │
│  │ ● Court 2    Final  │                                │
│  │                     │                                │
│  │ Player 5 🏆 6  6    │                                │
│  │ Player 6    3  4    │                                │
│  │                     │                                │
│  └─────────────────────┘                                │
└─────────────────────────────────────────────────────────┘
```

**Expanded View (Single Match):**
- Tap any match card to expand it full-screen
- Shows large, easy-to-read scores
- Tap anywhere or the minimize button to return to grid

### Connection Status & Auto-Reconnect

The TV display includes automatic connection monitoring:

**Connection Indicator (top-left):**
- **🟢 Live** - Connected and receiving updates
- **🟡 Last update: Xs ago** - Data may be stale (30+ seconds)
- **🔴 Reconnecting...** - Connection lost, attempting to reconnect

**Auto-Reconnect Features:**
- Automatically detects lost connections
- Reconnects with exponential backoff (1s, 2s, 4s, 8s... up to 30s)
- Shows reconnection attempt status
- **No manual refresh needed** - the display handles connection recovery automatically

**Staleness Warnings:**
- 30+ seconds: Yellow warning appears
- 60+ seconds: Orange alert
- 5+ minutes: Red critical warning

For all-day tournaments, the TV display will maintain itself without intervention.

---

## Admin Mode

Admin mode allows tournament managers to manage matches without accessing the Firebase console.

### Accessing Admin Mode

1. Tap **"Admin"** on the home screen
2. Enter the PIN (same as Umpire PIN)
3. You'll see a list of all matches

### Managing Matches

**Stats Bar:**
- Shows count of **Live** matches and **Finished** matches

**Individual Match Actions:**
- Each match shows: Court, Players, Score, Time ago
- **Delete** button removes that match
- Live matches show **"Delete LIVE?"** confirmation to prevent accidents

**Bulk Actions:**
- **Clear Finished**: Delete all finished matches at once
- **Delete 24h+ Old**: Remove matches older than 24 hours

### Match List

Matches are sorted:
1. Live matches first
2. Then by finish time (newest first)

Each match shows:
- 🟢 Green dot = Live
- ⚫ Gray dot = Finished
- Court name and color
- Player names
- Current/final score
- Time since last update

---

## Multiple Umpires

### How It Works

The system fully supports multiple umpires scoring different matches simultaneously:

```
Umpire A (Court 1)  ──┐
                      ├──► Firebase ──► All Spectator Screens
Umpire B (Court 2)  ──┤
                      │
Umpire C (Court 3)  ──┘
```

**Key Points:**
- Each umpire creates and manages their own match
- Each match has a unique ID (no conflicts)
- All matches appear on spectator screens automatically
- Updates from all umpires merge seamlessly

### Setting Up Multiple Umpires

1. **Each Umpire:**
   - Opens the app on their own phone
   - Enters Umpire Mode (with PIN)
   - Creates their assigned match
   - Selects the correct court (important for spectator clarity)

2. **On the TV:**
   - All active matches appear in the grid
   - Each match shows its court name and color
   - Matches update independently and simultaneously

### Best Practices for Tournaments

| Practice | Why |
|----------|-----|
| **Assign courts clearly** | Each umpire selects their designated court color |
| **Use consistent naming** | "J. Smith" not "John" on one court and "Smith, J" on another |
| **Test before matches** | Have each umpire score a test point to verify connection |
| **Designate a TV manager** | Someone to handle display issues if they arise |
| **Have backup devices** | Spare phone/tablet in case of battery/connection issues |
| **Share the PIN** | All umpires need the PIN - share it at tournament briefing |

### Match Locking Prevents Conflicts

If two umpires accidentally try to score the same match:

1. First umpire to resume **locks** the match
2. Second umpire sees: **"Match is being scored by another device"**
3. Options:
   - Wait for the other umpire to finish
   - **"Take Over"** if the other device is inactive

Locks automatically expire after 5 minutes of no activity.

---

## Understanding the Scoring Display

### Score Table Layout

```
          │ S1 │ S2 │ S3 │ Pts │
──────────┼────┼────┼────┼─────┤
Player 1  │  6 │  4 │  2 │  30 │
Player 2  │  3 │  6 │  1 │  15 │
```

| Column | Meaning |
|--------|---------|
| **S1, S2, S3...** | Games won in each set |
| **Pts** | Current game points (Love, 15, 30, 40, Ad) |

### Special Displays

| Display | Meaning |
|---------|---------|
| **40 - 40** | Deuce |
| **Ad** | Advantage (that player needs one more point to win game) |
| **• (dot)** | Current server |
| **🏆** | Match winner |
| **7-6** | Set won via tiebreak |

### Court Colors

The system uses 6 distinct court colors for easy identification:

| Court | Color | Use Case |
|-------|-------|----------|
| **Centre Court** | Green | Main/showcase court |
| **Court 1** | Blue | Secondary court |
| **Court 2** | Orange | Additional court |
| **Court 3** | Purple | Additional court |
| **Court 4** | Red/Pink | Additional court |
| **Court 5** | Cyan | Additional court |

---

## Troubleshooting

### Common Issues

#### "Connecting..." Won't Turn to "Live"

**Cause:** Network connectivity issue

**Solutions:**
1. Check WiFi/mobile data connection
2. Refresh the page
3. Try a different network
4. Check if Firebase is accessible (firewall issues in some venues)

#### Scores Not Updating on TV

**Cause:** Connection lost or page stale

**Solutions:**
1. Check the connection indicator (should show "Live")
2. Wait for auto-reconnect (the TV handles this automatically now)
3. If stuck for 5+ minutes, manual refresh as last resort
4. Check both devices are on working networks

#### Undo History Missing

**Previous issue:** Undo history was lost on page refresh.

**Now fixed!** Undo history persists across refreshes. If you still have issues:
- Use the **History** button to see all points
- Tap any point to rewind to that state

#### Wrong Score After Phone Death

**Solution - Jump to Score:**
1. Resume or create the match
2. Tap **"Adjust Score"**
3. Enter the correct score
4. Continue scoring

No more tapping through hundreds of points!

#### Match Disappeared from TV

**Cause:** Match may have been deleted or page needs refresh

**Solutions:**
1. The TV should auto-reconnect - wait 30 seconds
2. Check Admin mode to see if match exists
3. If deleted, umpire needs to recreate the match

#### "Match is being scored by another device"

**Cause:** Match locking is working correctly

**Solutions:**
1. Coordinate with the other umpire
2. If the other device is actually inactive, tap **"Take Over"**
3. Locks expire after 5 minutes of inactivity

#### Wrong Player Shown as Server

**Cause:** Points scored for wrong player

**Solutions:**
- Use **Undo** to go back
- Or use **History** to rewind to the correct state
- Or use **Adjust Score** to set the correct state with correct server

#### Phone Screen Keeps Turning Off

**Solutions:**
1. Increase screen timeout in phone settings
2. Install the app to home screen (some phones keep PWAs awake longer)
3. Keep the phone plugged in while umpiring
4. Tap the screen periodically

### Emergency Procedures

#### Umpire Phone Dies Mid-Match

**New easy solution:**
1. Get a replacement phone
2. Open the app, enter Umpire Mode
3. Resume the match (or create new if needed)
4. Tap **"Adjust Score"**
5. Enter the current score from the TV display
6. Continue scoring

No more tedious point-by-point recreation!

#### Internet Goes Down

- **Umpire:** Scoring will be blocked (shows error)
- **Spectator:** Display shows staleness warning, attempts reconnect
- **Solution:** Wait for connection to restore; scores will sync automatically

#### Need to Correct a Score from Earlier

**New easy solution:**
1. Tap **"History"** button
2. Find the point where the error occurred
3. Tap that point to rewind
4. Score correctly from there

Much faster than repeatedly pressing Undo!

#### Forgot the PIN

The PIN is stored in Firebase. To reset:
1. Access Firebase Console
2. Go to Realtime Database
3. Delete the `settings/umpirePin` node
4. Next app access will prompt for new PIN setup

---

## Technical Setup (Admin)

### Initial Deployment

See the main `README.md` for full deployment instructions. Summary:

1. **Clone Repository**
   ```bash
   git clone <repo-url>
   cd tennis-live-scores/tennis-live
   npm install
   ```

2. **Configure Firebase**
   - Create a Firebase project at console.firebase.google.com
   - Enable Realtime Database
   - Copy credentials to `.env` file

3. **Deploy to Vercel**
   - Connect repo to Vercel
   - Add environment variables
   - Deploy

### Firebase Security

**Current:** Test mode (anyone can read/write)

**Production Recommendation:**
```json
{
  "rules": {
    "matches": {
      "$matchId": {
        ".read": true,
        ".write": true
      }
    },
    "settings": {
      ".read": true,
      ".write": true
    }
  }
}
```

For added security, consider:
- Firebase Anonymous Authentication
- IP-based restrictions
- Time-limited write access

### PIN Security Notes

The PIN system provides **client-side protection** against accidental access:

- PIN is hashed with PBKDF2 (100,000 iterations) before storage
- Protects against casual/accidental umpire access
- Does NOT protect against determined technical attackers
- For true security, implement Firebase Security Rules with authentication

### Clearing Old Matches

**In-app (recommended):**
1. Open Admin mode
2. Use **"Clear Finished"** or **"Delete 24h+ Old"** buttons

**Firebase Console (if needed):**
1. Go to Firebase Console
2. Navigate to Realtime Database
3. Expand the `matches` node
4. Delete individual matches or clear all

### Data Structure

Matches now include:
- **events**: Array of scoring events for history/undo
- **lockedBy**: Session ID of current umpire (for conflict prevention)
- **lockedAt**: Timestamp of last lock refresh

This enables persistent undo, history viewing, and match locking features.

### Monitoring Usage

Firebase Console provides:
- Real-time connection count
- Database usage/bandwidth
- Error logs

Monitor during tournaments to ensure you're within free tier limits.

---

## Quick Reference Card

Print this for umpires:

```
┌─────────────────────────────────────────────────────┐
│           TENNIS LIVE SCORES - QUICK REFERENCE      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  SETUP:                                             │
│  1. Open app → Tap "Umpire Mode" → Enter PIN        │
│  2. Enter names, select court, choose format        │
│  3. Tap "Start Match"                               │
│                                                     │
│  SCORING:                                           │
│  • Tap player button when they WIN the point        │
│  • Score updates automatically                      │
│  • Use "Undo" for recent mistakes                   │
│  • Use "History" to rewind to any point             │
│  • Use "Adjust Score" to jump to exact score        │
│                                                     │
│  ALERTS:                                            │
│  🔴 RED    = Match Point                            │
│  🟠 ORANGE = Set Point                              │
│  🟣 PURPLE = Break Point                            │
│                                                     │
│  IF PHONE DIES:                                     │
│  1. Get new phone, open app                         │
│  2. Resume match or create new                      │
│  3. Tap "Adjust Score" → enter current score        │
│  4. Continue scoring!                               │
│                                                     │
│  PROBLEMS?                                          │
│  • Check WiFi connection                            │
│  • Use History to fix scoring errors                │
│  • Ask the tournament desk                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## FAQ

**Q: Can I use this without internet?**
A: No. The app requires an active internet connection to sync with Firebase.

**Q: How many matches can run at once?**
A: Unlimited. The system handles as many simultaneous matches as you need.

**Q: Can spectators interfere with scoring?**
A: No. Umpire and Admin modes are now protected by a PIN code. Only people with the PIN can score or delete matches.

**Q: What if two umpires try to score the same match?**
A: The system prevents this with match locking. The second umpire sees a warning and must explicitly "Take Over" if needed.

**Q: Does it work on iPhone and Android?**
A: Yes. It's a web app that works on any modern smartphone browser.

**Q: Can I customize the court names/colors?**
A: This requires code changes. The 6 courts are defined in `styles.js`.

**Q: Is there match history?**
A: Yes! Tap the "History" button while scoring to see every point. You can also rewind to any point in the match.

**Q: What if my phone dies mid-match?**
A: Use the "Adjust Score" feature on a new device to jump directly to the current score. No need to tap through every point.

**Q: Does undo work after refreshing the page?**
A: Yes! Undo history is now saved to the cloud and persists across page refreshes.

**Q: What tennis rules does it follow?**
A: Standard professional rules: deuce/advantage, tiebreak at 6-6, sets to 6 with 2-game lead.

**Q: How do I delete old matches?**
A: Use Admin mode to delete individual matches or clear all finished matches. No Firebase console access needed.

**Q: Does the TV need manual refresh?**
A: No. The TV display automatically detects connection issues and reconnects. It shows staleness warnings if data is delayed.

---

## What's New (May 2026)

### PIN Protection
- Umpire and Admin modes now require a PIN
- Sessions last 8 hours
- Prevents accidental access by spectators

### Match Locking
- Prevents two umpires from editing the same match
- Clear warnings when a match is already being scored
- Locks expire after 5 minutes of inactivity

### Persistent Undo
- Undo history survives page refresh
- Cloud-synced event log

### Point History & Rewind
- View complete point-by-point history
- Tap any point to rewind to that state
- Much faster than repeated undo

### Adjust Score (Jump to Score)
- Set exact score instantly
- Perfect for resuming after phone death
- Validates that score is reachable

### Admin Mode
- Delete matches from within the app
- Clear all finished matches
- Remove old matches (24h+)
- No Firebase console access needed

### TV Auto-Reconnect
- Automatic connection monitoring
- Reconnects with exponential backoff
- Staleness warnings
- No manual refresh required

---

## Support

For technical issues or feature requests, contact your system administrator or refer to the project repository.

---

*Last updated: May 2026*
