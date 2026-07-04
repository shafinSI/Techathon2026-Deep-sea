# SOMS Connection Contract

The single page every part of this system (frontend, bot, and anyone's AI
assistant) should check before inventing a port number or field name.

## Base URLs (local dev defaults)

| Surface       | URL                                |
|---------------|-------------------------------------|
| REST API      | `http://localhost:4000/api/v1`      |
| WebSocket     | `ws://localhost:4000/ws/live`       |
| Health check  | `http://localhost:4000/health`      |

Change `PORT` in `.env` to move the backend; update the three lines at the
top of the frontend's `<script>` (`SOMS_API_BASE`, `SOMS_WS_URL`,
`SOMS_AUTH_TOKEN`) to match wherever it's actually deployed.

## Auth

Every REST route and the WS handshake require a shared bearer token:

```
Authorization: Bearer <AUTH_TOKEN>
```

The WebSocket accepts the token either as that header (if your client
supports custom headers on the handshake) or as a `?token=` query param —
the browser's native `WebSocket` object can't set headers, so the frontend
uses the query param.

Set `AUTH_TOKEN` in the backend's `.env`. Leave it blank to disable auth
entirely (local dev only — never do this on a public deploy).

## REST routes

| Method | Path                        | Notes                                            |
|--------|------------------------------|---------------------------------------------------|
| GET    | `/devices`                  | All 18 devices + state                             |
| PATCH  | `/devices/:id`               | Body: `{ "status": "on"\|"off" }`                  |
| GET    | `/rooms/:room`               | devices + environment + occupancy for one room     |
| GET    | `/environment/:room`         | temp/humidity/CO2/O2 for one room                  |
| GET    | `/power`                     | total + per-room live wattage                      |
| GET    | `/alerts`                    | active + recent alerts                             |
| GET    | `/cost`                      | cost per room, per device type, top 3 devices      |
| GET    | `/settings`                  | current AdminSettings                              |
| PATCH  | `/settings`                  | partial update, takes effect next tick             |
| GET    | `/automation`                | per-room auto-control state                        |
| PATCH  | `/automation/:room`          | Body: `{ "autoControlEnabled": boolean }`          |
| GET    | `/snapshot`                  | everything at once — used by the frontend on load  |
| GET    | `/hardware`                  | per-room hardware link status (live/simulated)     |
| POST   | `/hardware/:room/telemetry`  | ESP32 room node pushes sensor readings (see `HARDWARE.md`) |
| GET    | `/hardware/:room/commands`   | ESP32 room node polls desired relay state          |

Valid `:room` values: `drawing`, `work1`, `work2`. Anything else returns a
404 with a JSON error body: `{ "error": "not_found", "message": "..." }`.

## WebSocket events

| Event             | When                                             |
|--------------------|---------------------------------------------------|
| `state:snapshot`   | Sent once, immediately on connect                  |
| `state:diff`       | Sent every simulator tick (only what changed)      |
| `alert:new`        | Relayed from the alert engine                      |
| `alert:resolved`   | Relayed from the alert engine                      |

Every message has the shape `{ event, payload, ts }`.

## Reconnect policy

On WS close, the client should back off (the frontend starts at 1s and
grows to a 15s ceiling), re-fetch a full snapshot via `GET /snapshot`, then
reopen the socket and resume applying diffs. This avoids ever rendering a
stale device state after a dropped connection.

## CORS

`CORS_ORIGIN` in the backend's `.env` controls allowed origins. Use `*`
only for local development. Set it to your actual deployed frontend origin
before sharing a public demo URL.

## Env vars referenced across the three services

**Backend** (`soms-backend/.env`): `PORT`, `AUTH_TOKEN`, `CORS_ORIGIN`,
`TICK_INTERVAL_MS`, `DEFAULT_KWH_RATE`.

**Frontend**: no build-time env vars (single static HTML file) — instead,
set `window.SOMS_API_BASE`, `window.SOMS_WS_URL`, `window.SOMS_AUTH_TOKEN`
in a small `<script>` before the main one, or edit the three constants at
the top of `dist/index.html` directly.

**Bot** (not included in this delivery): would need `SOMS_API_BASE`,
`SOMS_AUTH_TOKEN`, plus its own `DISCORD_TOKEN`.

**Hardware** (ESP32 room node, `hardware/firmware/soms_room_node/`):
`BACKEND_HOST`, `AUTH_TOKEN`, `ROOM_ID`, `DEVICE_ID` — set as constants at
the top of the `.ino` file (no `.env` mechanism on the microcontroller
itself). Full wiring + protocol spec: `../../HARDWARE.md`.
