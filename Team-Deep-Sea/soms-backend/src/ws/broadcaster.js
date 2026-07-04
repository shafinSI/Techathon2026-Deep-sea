import { WebSocketServer } from "ws";
import { state } from "../state.js";
import { onAlertEvent } from "../rules/alerts.js";
import { buildSnapshot } from "../snapshot.js";

let wss = null;
const clients = new Set();

export function initBroadcaster(server, { path = "/ws/live", authToken = "" } = {}) {
  wss = new WebSocketServer({ server, path });

  wss.on("connection", (ws, req) => {
    if (authToken) {
      const url = new URL(req.url, "http://localhost");
      const headerToken = (req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");
      const queryToken = url.searchParams.get("token") || "";
      const token = headerToken || queryToken;
      if (token !== authToken) {
        ws.close(4001, "unauthorized");
        return;
      }
    }

    clients.add(ws);
    // Immediately send full state - lets a freshly-loaded or reconnected
    // client catch up instantly.
    send(ws, "state:snapshot", buildSnapshot());

    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));
  });

  // Relay alert events verbatim - this module is a relay, not the source
  // of truth for alert logic (that's rules/alerts.js).
  onAlertEvent((eventName, alert) => {
    broadcast(eventName, alert);
  });

  return wss;
}

function send(ws, event, payload) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ event, payload, ts: new Date().toISOString() }));
}

export function broadcast(event, payload) {
  const msg = JSON.stringify({ event, payload, ts: new Date().toISOString() });
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

// Compute a diff between two snapshots and broadcast only what changed.
// Never re-send the full state on every tick - that defeats the point of
// a diff protocol.
export function broadcastDiff(prevSnapshot, nextSnapshot) {
  const diff = { devices: [], environment: {}, occupancy: {}, pcs: [], automation: {}, hardware: {} };
  let changed = false;

  for (const d of nextSnapshot.devices) {
    const prev = prevSnapshot.devices.find((p) => p.id === d.id);
    if (!prev || prev.status !== d.status || prev.lastChanged !== d.lastChanged) {
      diff.devices.push(d);
      changed = true;
    }
  }
  for (const roomId of Object.keys(nextSnapshot.environment)) {
    const prev = prevSnapshot.environment[roomId];
    const cur = nextSnapshot.environment[roomId];
    if (!prev || JSON.stringify(prev) !== JSON.stringify(cur)) {
      diff.environment[roomId] = cur;
      changed = true;
    }
  }
  for (const roomId of Object.keys(nextSnapshot.occupancy)) {
    if (prevSnapshot.occupancy[roomId] !== nextSnapshot.occupancy[roomId]) {
      diff.occupancy[roomId] = nextSnapshot.occupancy[roomId];
      changed = true;
    }
  }
  for (const pc of nextSnapshot.pcs) {
    const prev = prevSnapshot.pcs.find((p) => p.id === pc.id);
    if (!prev || prev.on !== pc.on || prev.lastActivityAt !== pc.lastActivityAt) {
      diff.pcs.push(pc);
      changed = true;
    }
  }
  for (const roomId of Object.keys(nextSnapshot.automation)) {
    const prev = prevSnapshot.automation[roomId];
    const cur = nextSnapshot.automation[roomId];
    if (!prev || JSON.stringify(prev) !== JSON.stringify(cur)) {
      diff.automation[roomId] = cur;
      changed = true;
    }
  }

  for (const roomId of Object.keys(nextSnapshot.hardware || {})) {
    const prev = prevSnapshot.hardware?.[roomId];
    const cur = nextSnapshot.hardware[roomId];
    if (!prev || JSON.stringify(prev) !== JSON.stringify(cur)) {
      diff.hardware[roomId] = cur;
      changed = true;
    }
  }

  if (changed) broadcast("state:diff", diff);
}

export function clientCount() {
  return clients.size;
}
