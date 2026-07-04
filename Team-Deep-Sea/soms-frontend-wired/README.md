# SOMS — Smart Office Management System
### Frontend Dashboard (2030 Holographic UI)

A single-file, self-contained frontend for the Smart Office Management System, styled as a
near-future (2030) control room: glass panels, a holographic 3D office-layout projection,
and live-simulated data across every panel described in the project brief.

## Run it

No build step required — this is a static, dependency-free HTML file.

```
open dist/index.html
```
or serve it with any static file server:
```
npx serve dist
```

## What's inside

**Overview tab**
- Holographic 3D office layout — 3 rooms, 18 devices, spinning fans, pulsing lights, mouse-parallax hologram tilt
- Live power meter — total + per-room wattage, kWh today, estimated cost
- Alerts feed — after-hours, ventilation, and fire-severity alerts with flashing red banner treatment
- Environment panels — temp / humidity / CO₂ / O₂ gauges per room, occupancy count, CO₂ threshold flagging
- Device status grid — working on/off switches per device, plus PC/workstation monitoring badges for Work Room 1 & 2 (Drawing Room correctly shows no workstations)

**Cost Analytics tab**
- Spend ranked by room (bar chart)
- Cost breakdown by device type (donut chart)
- Top 3 costliest devices, computed live from current wattage × elapsed hours × configured rate

**Automation tab**
- One card per automated rule (AC/fan auto-control, after-hours, fire/smoke, PC monitoring)
- Each card shows the system's current recommendation *before* it acts — human-in-the-loop pattern
- Per-rule enable/disable override, mirrored in Settings

**Settings tab**
- Office hours, kWh rate, CO₂ ventilation threshold, smoke/fire threshold
- Individually labeled toggle per automated rule — no single master switch

## Backend connection (real, not simulated)

On load, the page:
1. `GET`s `/api/v1/snapshot` from `soms-backend` and renders the real device/environment/alert state.
2. Opens `ws://localhost:4000/ws/live` and applies `state:diff` / `alert:new` / `alert:resolved`
   events as they arrive — this is what makes the panel update with no page refresh.
3. Sends device toggle clicks as `PATCH /api/v1/devices/:id` instead of mutating local state.

Connection settings live at the top of the `<script>` block in `dist/index.html`
(`window.SOMS_CONFIG`) — edit `apiBase`, `wsUrl`, and `authToken` there if your backend
isn't on `localhost:4000` or you changed `AUTH_TOKEN` in `soms-backend/.env`.

**If the backend can't be reached** (not running, wrong port, CORS misconfigured), the
topbar badge switches from `LIVE · WS CONNECTED` to `DEMO MODE · BACKEND OFFLINE` and the
page falls back to its original client-side random-walk simulation, so the dashboard is
never blank — it retries the WebSocket connection with backoff in the background.

**Not yet wired to the backend:** the Cost Analytics and Automation tabs still use
client-side simulated numbers. This is out of scope for the brief's minimum requirements
(device panel, power meter, alerts — all wired above), and the backend's `/automation`
route (per-room `autoControlEnabled`) doesn't map 1:1 onto this page's named-rule toggle
list without a small backend change first.

## Design notes

- Palette: near-black base (`#05070d`) with cyan (`#4cf3e0`) and violet (`#8b7cf6`) holographic accents
- Type: Space Grotesk (display), Inter (body), IBM Plex Mono (all data readouts)

## File structure

```
SOMS-frontend/
├── README.md
└── dist/
    └── index.html   ← the entire frontend (HTML + CSS + JS, no external build tooling)
```
