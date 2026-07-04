# SOMS Backend

REST API + WebSocket broadcaster + simulator for the Smart Office
Management System. Node.js (Express + `ws`), in-memory state, no database
required.

## What's here

- **`src/schema.js`** — canonical data shapes (rooms, wattage baselines).
- **`src/state.js`** — in-memory store + a lightweight history log (device
  on/off intervals, occupancy snapshots) used to answer "how long has this
  been happening" queries.
- **`src/simulator.js`** — the tick loop (heartbeat). Registers
  tick-handlers for device random-walk, PC random-walk, occupancy,
  environment drift, and fire/smoke simulation. New simulated features
  register a handler here instead of editing the loop itself.
- **`src/rules/alerts.js`** — the alert rule registry: after-hours, >2h
  continuous run, poor ventilation (CO2), fire/smoke, PC-after-hours. Every
  check creates/resolves `Alert` objects and the WS broadcaster relays
  `alert:new` / `alert:resolved` from here.
- **`src/rules/autoControl.js`** — explainable, rule-based (not ML)
  AC/fan automation. Always computes and reports a recommendation; only
  writes device state when the room's override toggle is enabled.
- **`src/ws/broadcaster.js`** — sends `state:snapshot` on connect,
  `state:diff` on every tick (only what changed), relays alert events.
- **`src/routes/index.js`** — all REST routes (see
  `docs/connection-contract.md` for the full table).
- **`src/auth.js`** — shared bearer token middleware for REST + WS.
- **`src/hardware.js`** — bridge for a real ESP32 room node: ingests
  telemetry, serves relay commands, and gates `simulator.js` per room so
  live sensor data and random-walk simulation never fight over the same
  state. Full wiring + protocol spec: `../HARDWARE.md`.
- **`src/server.js`** — wires it all together, plus structured request
  logging and a consistent JSON error shape across every route.

## Run it

```bash
cp .env.example .env      # edit AUTH_TOKEN etc. if you want
npm install
npm start
```

The server listens on `http://localhost:4000` by default, with the
WebSocket at `ws://localhost:4000/ws/live`. `GET /health` reports basic
liveness and current WS client count.

## Stack decision

Node.js + Express + `ws`, no framework beyond that, no database — the spec
calls for in-memory state with periodic snapshotting, and a hackathon-scale
demo (18 devices, a handful of rules) doesn't need anything heavier. If
this needed to survive process restarts, the `history` module is the one
place a real time-series DB (or SQLite) would slot in.

## Full docs

See `docs/connection-contract.md` for the REST/WS contract the frontend
(and any future Discord bot) build against.
