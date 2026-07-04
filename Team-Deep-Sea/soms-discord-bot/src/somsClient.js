// somsClient.js — the ONE place the bot talks to the backend. Both the web
// dashboard and this bot read from soms-backend's REST API; this file is
// deliberately the single choke point so there is exactly one source of
// truth for "how the bot fetches office state" (Architecture Requirement
// in the brief: Simulated Device Layer -> Backend API -> Web UI && Bot).

const API_BASE = process.env.SOMS_API_BASE || "http://localhost:4000/api/v1";
const AUTH_TOKEN = process.env.SOMS_AUTH_TOKEN || "";

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {},
  });
  if (!res.ok) {
    throw new Error(`SOMS backend ${path} -> HTTP ${res.status}`);
  }
  return res.json();
}

export async function getSnapshot() {
  return get("/snapshot");
}

export async function getRoom(roomId) {
  return get(`/rooms/${roomId}`);
}

export async function getPower() {
  return get("/power");
}

export async function getAlerts() {
  return get("/alerts");
}

export async function getCost() {
  return get("/cost");
}

// Rough "today's estimated usage" figure for !usage — same math as the
// backend's /cost route (device-seconds-on * wattage), just summarized to
// a single kWh number instead of a cost breakdown, so the bot doesn't need
// a second backend endpoint.
export async function getEstimatedKwhToday() {
  const cost = await getCost();
  const kwh = cost.ratePerKwh > 0 ? cost.total / cost.ratePerKwh : 0;
  return kwh;
}
