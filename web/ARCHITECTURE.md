# Web App Architecture

This document describes the architecture of the Stationboard PWA — a React single-page application that displays Swiss public transport departures and arrivals in real time.

## Overview

The web app is a **Vite + React** PWA that communicates with the backend Express API (documented in the root `ARCHITECTURE.md`). In development, Vite proxies API requests to the local Express server; in production, the built static files are served directly by Express.

```
┌────────────────────────────────────────────────────────┐
│                      Browser                           │
│                                                        │
│  ┌──────────┐   ┌────────────┐   ┌──────────────────┐  │
│  │  Search   │   │  Station   │   │  Journey Detail  │  │
│  │   Page    │   │   Board    │   │      Page        │  │
│  └────┬─────┘   └─────┬──────┘   └────────┬─────────┘  │
│       │               │                    │            │
│       └───────┬───────┴────────────────────┘            │
│               │                                         │
│          App (navigation stack)                         │
│               │                                         │
│          utils/api.js  ──► fetch() ──► /station, etc.   │
│                                                         │
└────────────────────────────────────────────────────────┘
         │                              ▲
         │  HTTP (JSON)                 │
         ▼                              │
┌────────────────────────────────────────┐
│        Express API  (port 3000)        │
└────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Build tool | Vite 8 |
| UI framework | React 19 |
| Language | JavaScript (JSX) |
| Styling | Vanilla CSS (no utility framework) |
| Fonts | Inter, JetBrains Mono (Google Fonts) |
| PWA | Service worker + Web App Manifest |
| Dev proxy | Vite `server.proxy` → Express |
| Linting | ESLint 9 with React hooks plugin |

## Directory Structure

```
web/
├── index.html                 # HTML shell (loads fonts, registers PWA meta)
├── vite.config.js             # Vite config (React plugin, API proxy, build output)
├── package.json
├── public/
│   ├── manifest.json          # PWA manifest (name, icons, display mode)
│   ├── sw.js                  # Service worker (stale-while-revalidate for assets)
│   ├── favicon.svg
│   ├── icon-192.svg
│   ├── icon-512.svg
│   └── icons.svg              # Shared SVG icon sprite
├── src/
│   ├── main.jsx               # Entry point — renders <App />, registers SW
│   ├── index.css              # CSS reset / global base styles
│   ├── App.jsx                # Root component — navigation, state, layout
│   ├── App.css                # App-level styles (header, layout, overflow menu)
│   ├── components/
│   │   ├── StationBoard.jsx   # Scrollable departure/arrival list
│   │   ├── StationBoard.css
│   │   ├── JourneyRow.jsx     # Single journey row (time, badge, destination, platform)
│   │   ├── JourneyRow.css
│   │   ├── JourneyDetail.jsx  # Full stop list for a journey with live train position
│   │   ├── JourneyDetail.css
│   │   ├── Search.jsx         # Station search with text input + geolocation
│   │   ├── Search.css
│   │   ├── Bookmarks.jsx      # Bookmarked stations list with drag-to-reorder
│   │   └── Bookmarks.css
│   ├── hooks/
│   │   └── useStationBoard.js # Custom hook: infinite-scroll data fetching + dedup
│   └── utils/
│       ├── api.js             # API client with rate-limiting, dedup, and caching
│       └── time.js            # Time formatting and delay calculation helpers
└── dist/                      # Production build output (served by Express)
```

## Navigation

The app uses a **stack-based navigation model** implemented entirely in React state — no router library. The navigation stack lives in `App.jsx` as an array of entries, each describing a view:

```
navStack = [
  { view: 'station',   station: { id, name } },   // Station board
  { view: 'journey',   journey: {...}, station },  // Journey detail
  { view: 'bookmarks' },                           // Bookmarks list
  { view: 'search' },                              // Station search
]
```

- The **topmost entry** determines what is rendered.
- **Push** to navigate forward (e.g. tapping a journey pushes a `journey` entry).
- **Pop** to go back (the back button slices the last entry off).
- When the app returns from the background after >1 minute, the stack is reset to a single station entry.

### Navigation Flow

```
Station Board ──► Journey Detail ──► Station Board (different station)
      │                                       │
      ├──► Search ──► Station Board            ├──► Journey Detail ──► ...
      │                                       │
      └──► Bookmarks ──► Station Board         └──► ...
```

## Component Tree

```
<App>
├── <Search />            (when view === 'search')
├── <Bookmarks />         (when view === 'bookmarks')
├── <JourneyDetail />     (when view === 'journey')
│   └── <StopRow /> ×N
│   └── <TrainBetweenIndicator />
└── <header> + <StationBoard />  (when view === 'station')
    └── <JourneyRow /> ×N
```

## Components

### `App.jsx` — Root & Navigation

The central orchestrator. Responsibilities:

- **Navigation stack** — manages push/pop for all views.
- **Board type** — `departure` | `arrival` toggle (persisted across navigation).
- **Bookmarks** — CRUD operations backed by `localStorage`.
- **Last station** — persists the most recent station to `localStorage` for next launch.
- **Background timeout** — resets the stack when the app has been hidden for >1 minute.
- **Overflow menu** — 3-dot menu with refresh, search, and bookmark toggle.

---

### `StationBoard.jsx` — Departure / Arrival List

A scrollable list of `JourneyRow` components with infinite scroll in both directions.

Key behaviours:

- **Initial scroll** — on first load, scrolls to the first journey row (hiding the "Load earlier" button above the fold).
- **Scroll preservation** — when prepending past journeys, adjusts `scrollTop` so the viewport doesn't jump.
- **Load earlier / later buttons** — trigger data fetching via the `useStationBoard` hook.

---

### `JourneyRow.jsx` — Single Journey Row

Renders one departure/arrival with:

- **Time** — planned time + delay badge (`+3`, `-1`, etc.).
- **Service badge** — line name with colour coding by transport type (S-Bahn, IC/IR, Regio, Bus, Tram).
- **Destination / Origin** — depending on departure or arrival mode.
- **Platform** — with smart handling of platform refinements vs. real changes.
- **Cancelled state** — greyed-out row with "Cancelled" badge.

---

### `JourneyDetail.jsx` — Journey Stop List

Fetches the full stop list for a journey and renders a vertical timeline.

Key features:

- **Live train position** — updated every 10 seconds, shows:  
  - Past stops (dimmed).
  - Active stop (highlighted dot).
  - In-transit indicator (red dot positioned proportionally between two stops).
- **Stop interaction** — tapping a stop name navigates to that station's board.
- **Platform changes** — same refinement vs. real-change logic as `JourneyRow`.
- **Cancelled stops** — shown with strikethrough and "Cancelled" badge.

---

### `Search.jsx` — Station Search

Full-page search with two modes:

1. **Text search** — debounced (250ms) queries to `GET /search?text=...` with abort controller for cancellation.
2. **Geolocation** — uses the browser Geolocation API to fetch nearby stations from `GET /search?latlon=...&accuracy=...`.

Results display transport-type icons (train, tram, bus, generic pin) and distance for nearby results.

---

### `Bookmarks.jsx` — Bookmarked Stations

Displays saved stations with:

- **Drag-to-reorder** — pointer-based drag & drop (works on both touch and mouse).
- **Remove** — per-item delete button.
- **Select** — tapping a bookmark navigates to that station's board.

## Custom Hook

### `useStationBoard(type, stationId)` — Infinite-Scroll Data

Manages the station board data lifecycle:

| Returned value | Description |
|---|---|
| `journeys` | Sorted, deduplicated array of journey objects |
| `isLoadingTop` | Loading indicator for earlier connections |
| `isLoadingBottom` | Loading indicator for later connections |
| `error` | Error message string or `null` |
| `loadFuture()` | Fetch next page of later connections |
| `loadPast()` | Fetch earlier connections with smart retry |
| `refresh()` | Clear all data and reload from current time |

**Smart backward scrolling**: when loading past connections, the hook estimates a timestamp offset based on the average gap between existing journeys. If the response doesn't overlap with existing data, it halves the gap and retries (up to 5 attempts) to find the boundary.

**Deduplication**: uses a `Set` of `journeyRef|operatingDayRef` keys to prevent duplicate entries when responses overlap.

## Utility Modules

### `utils/api.js` — API Client

All API calls go through this module, which provides three layers of protection:

1. **Rate limiting** — at most 1 request per second, with sequential queuing.
2. **Request deduplication** — concurrent identical URLs share a single in-flight `fetch()`.
3. **Response caching** — successful responses are cached for 5 seconds.

Exported functions:

| Function | Endpoint |
|---|---|
| `fetchStationBoard(stationId, type, timestamp?)` | `GET /station/:stationId/:type` |
| `fetchJourneyStops(journeyRef, operatingDayRef)` | `GET /journey/:journeyRef/:operatingDayRef` |

---

### `utils/time.js` — Time Helpers

| Function | Purpose |
|---|---|
| `formatTime(iso)` | Format to `HH:MM` (Swiss locale, 24h) |
| `getDelayMinutes(planned, estimated)` | Compute delay in minutes (positive = late) |
| `formatDateHeader(date)` | Format as `"Sat, 29 Mar"` |
| `isSameDay(a, b)` | Check if two timestamps are on the same calendar day |

## Data Flow

### Station Board

```
User opens app
  │
  ▼
useStationBoard(type, stationId)
  │
  ├─► fetchStationBoard() ──► GET /station/:id/:type ──► JSON array
  │
  ▼
journeys state (sorted, deduped) ──► <StationBoard> renders <JourneyRow> list
  │
  ├── scroll up ──► loadPast()  ──► prepend earlier journeys
  └── scroll down ──► loadFuture() ──► append later journeys
```

### Journey Detail

```
User taps a JourneyRow
  │
  ▼
App pushes { view: 'journey', journey } onto navStack
  │
  ▼
<JourneyDetail> mounts
  │
  ├─► fetchJourneyStops() ──► GET /journey/:ref/:day ──► JSON array of stops
  │
  ▼
stops rendered as timeline with live train position (updated every 10s)
```

## PWA Setup

### Service Worker (`public/sw.js`)

Strategy: **stale-while-revalidate** for static assets, **network-only** for API routes.

- **Install** — precaches the root URL (`/`).
- **Activate** — cleans up old cache versions.
- **Fetch** — for non-API requests, serves cached response immediately while fetching an update in the background. API routes (`/station/*`, `/journey/*`) bypass the cache entirely.

### Web App Manifest (`public/manifest.json`)

- `display: standalone` — full-screen experience without browser chrome.
- Dark theme colour (`#0a0e1a`).
- SVG icons at 192×192 and 512×512.

### iOS PWA Support

- `apple-mobile-web-app-capable` meta tag for home screen installation.
- `black-translucent` status bar style.
- `viewport-fit=cover` for edge-to-edge display with safe area insets.

## Styling Approach

- **Vanilla CSS** — one `.css` file per component, co-located with the `.jsx` file.
- **CSS custom properties** — design tokens for colours, spacing, and typography.
- **Dark-first** — the default theme is dark; light mode is supported via `prefers-color-scheme`.
- **Safe area insets** — `env(safe-area-inset-*)` used for PWA header and scrollable areas.
- **Animations** — staggered entry animations for stop rows, loading dot animations, and smooth transitions.

## Development vs. Production

| Aspect | Development | Production |
|---|---|---|
| Dev server | `npm run dev` → Vite on `:5173` | N/A |
| API proxy | Vite proxies `/station`, `/journey` to `:3000` | Express serves `web/dist/` + API |
| Build | N/A | `npm run build` → `web/dist/` |
| Source maps | Enabled (Vite default) | Disabled (`sourcemap: false`) |

## Dependencies

| Package | Purpose |
|---|---|
| `react` | UI framework |
| `react-dom` | DOM rendering |
| `vite` *(dev)* | Build tool and dev server |
| `@vitejs/plugin-react` *(dev)* | JSX transform and Fast Refresh |
| `eslint` *(dev)* | Linting |
| `eslint-plugin-react-hooks` *(dev)* | Lint rules for React hooks |
| `eslint-plugin-react-refresh` *(dev)* | Lint rules for Fast Refresh compatibility |

> **Zero runtime dependencies** beyond React itself — no router, no state library, no CSS framework.
