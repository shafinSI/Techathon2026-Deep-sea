# SOMS — Smart Office Management System

Full stack: web dashboard + Discord bot, both reading from one shared
Node.js/Express + WebSocket backend with an in-memory simulator.

```
.
├── package.json                  ← root dev orchestrator (npm workspaces + concurrently)
├── scripts/setup-env.js          ← `npm run setup` — creates .env files from .env.example
├── diagrams/system-diagram.svg   ← high-level system diagram (deliverable #1)
├── hardware/
│   ├── wokwi/                    ← importable Wokwi circuit (deliverable #2)
│   └── firmware/soms_room_node/  ← ESP32 firmware matching that circuit
├── HARDWARE.md                   ← full pin table + wiring rationale +
│                                     Section 8: full copy-paste Wokwi
│                                     firmware/circuit (no backend needed)
├── docker-compose.yml
├── soms-backend/                 ← REST API + WebSocket + simulator (Node.js)
│   ├── src/
│   ├── docs/connection-contract.md
│   ├── .env.example
│   └── README.md
├── soms-discord-bot/             ← !status / !room / !usage bot (deliverable)
│   └── README.md
└── soms-frontend-wired/          ← the dashboard, actually backend-connected now
    └── dist/index.html
```

## A note on device count vs. the brief

The brief states "2 fans and 3 lights... so 6 devices per room, 18
devices total" — but 2+3=5, not 6 (5×3 rooms = **15**, not 18). Per
explicit instruction, this build keeps devices literally as "2 fans and
3 lights" (15 devices total) rather than inventing a 6th device type to
force the stated total; the original zip had added a `Split AC Unit`
device to hit 18, which has been removed for spec fidelity.

## Run everything

**Option A — one command, from the repo root (recommended for local dev):**

```bash
npm run setup   # installs backend + bot deps (npm workspaces) and creates .env files
npm run dev     # runs backend (:4000) + frontend (:8080) together, in one terminal
```

`npm run dev` uses [`concurrently`](https://www.npmjs.com/package/concurrently) to start
both processes in a single terminal window, with color-coded, prefixed log output
(`[backend]` / `[frontend]`) so you can see both at once instead of juggling tabs. Open
`http://localhost:8080` — the dashboard fetches the real snapshot from the backend and
opens a live WebSocket, so what you see is real simulated device state, not a demo.

Want the Discord bot running too?

```bash
# fill in soms-discord-bot/.env first: DISCORD_TOKEN, ALERTS_CHANNEL_ID
npm run dev:all   # backend + frontend + bot, all three in one terminal
```

Stop everything with `Ctrl+C` once — `concurrently` shuts down all child processes together.

**Option B — Docker Compose (backend + frontend only, no Discord bot):**

```bash
docker compose up
```

- Backend: `http://localhost:4000`
- Frontend: `http://localhost:8080`

**Option C — fully manual, one terminal per service (if you want full control):**

```bash
# terminal 1
cd soms-backend
cp .env.example .env
npm install
npm start

# terminal 2 — any static file server works
cd soms-frontend-wired/dist
npx serve .
# or just open index.html directly in a browser — it'll still try to
# reach the backend at http://localhost:4000, just falls back to demo
# mode if it can't.

# terminal 3 — Discord bot (optional but required for the full brief)
cd soms-discord-bot
cp .env.example .env   # fill in DISCORD_TOKEN, ALERTS_CHANNEL_ID
npm install
npm start
```

## How the frontend↔backend connection actually works

This was previously a gap: `soms-frontend-wired` was named as if it were already
connected to the backend, but its JS was still 100% client-side simulated data with no
`fetch()` or `WebSocket` calls anywhere. That's now fixed:

- On load, the dashboard `GET`s `/api/v1/snapshot` and renders real device/room/alert data.
- It opens `ws://localhost:4000/ws/live` and applies `state:diff`, `alert:new`, and
  `alert:resolved` events live — this is the "no manual refresh" requirement from the brief.
- Clicking a device toggle sends `PATCH /api/v1/devices/:id` to the backend (optimistic UI,
  reconciled by the next WS diff); if the request fails, the toggle reverts.
- If the backend is unreachable, the topbar badge shows `DEMO MODE · BACKEND OFFLINE` and
  the page automatically falls back to its original random-walk demo data, retrying the
  WebSocket connection with exponential backoff in the background — the dashboard is never
  left blank.
- Connection settings (`apiBase`, `wsUrl`, `authToken`) are a small config object at the
  top of the `<script>` block in `soms-frontend-wired/dist/index.html` — no build step, so
  editing that block *is* the configuration step.

Not wired (documented, not hidden): the Cost Analytics and Automation tabs still use
client-side simulated numbers — out of scope for the brief's minimum requirements, and the
backend's `/automation` shape doesn't map 1:1 onto that tab's rule list without a small
backend change first.

## How the connection works

The frontend is still a single self-contained HTML file — no build step —
but its JS now:

1. On load, fetches `GET /api/v1/snapshot` + `GET /api/v1/alerts` from the
   backend and renders real state instead of random demo data.
2. Opens `ws://localhost:4000/ws/live` and applies `state:diff` /
   `alert:new` / `alert:resolved` events as they arrive — no polling.
3. Sends device toggles as `PATCH /api/v1/devices/:id`, and Settings/
   Automation changes as `PATCH /api/v1/settings`, optimistically updating
   the UI and reconciling with the next WS diff.
4. If the backend can't be reached at all, it falls back to the original
   local random-walk simulation so the dashboard is never just blank —
   the connection badge in the header turns red and reads "OFFLINE · DEMO
   DATA" in that case.

The default backend URL/token are hardcoded near the top of
`dist/index.html`'s `<script>` block (`SOMS_API_BASE`, `SOMS_WS_URL`,
`SOMS_AUTH_TOKEN`) — change those three lines (or set the matching
`window.SOMS_*` globals before the script runs) to point at a real
deployment. Full contract: `soms-backend/docs/connection-contract.md`.

## What's simulated vs. real

By default every room runs on the backend's tick loop (default every 6s,
see `TICK_INTERVAL_MS`): device on/off random-walks, PC activity,
occupancy, environment drift, and rare fire/smoke spikes. The rule engine
(after-hours, >2h continuous run, poor ventilation, fire, PC-after-hours,
AC/fan auto-control) evaluates against that state every tick.

**A real ESP32 room node can now take over any one room.** See
`HARDWARE.md` for the full wiring diagram (component-to-component, pin by
pin) and `hardware/firmware/soms_room_node/soms_room_node.ino` for the
firmware. Once a board POSTs telemetry, that room automatically switches
from `"simulated"` to `"live"` (`GET /api/v1/hardware`) and the simulator
stops touching that room's devices/environment/smoke level — the rule
engine, dashboard, and (if built) bot keep working completely unchanged,
because both simulated and live rooms write into the exact same `Device`/
`EnvironmentReading` records. If the board disconnects, the room falls
back to simulated automatically after 30s so the demo never freezes.


Team Information

Team Name: Deep-Sea

Team Members:
1.Shafin
2.Shrabonee
3.Asif
4.Umiaya
