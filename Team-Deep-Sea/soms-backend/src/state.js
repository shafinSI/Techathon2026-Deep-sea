import { ROOMS, WATTAGE } from "./schema.js";

// ---------- simple async mutex ----------
// Node is single-threaded, but every tick-handler is written as if this
// mattered, per the "guard store/state with a mutex" contract — this keeps
// the discipline explicit and makes the store safe if it's ever backed by
// something genuinely concurrent later.
class Mutex {
  constructor() {
    this._locked = false;
    this._queue = [];
  }
  async lock() {
    if (!this._locked) {
      this._locked = true;
      return;
    }
    await new Promise((resolve) => this._queue.push(resolve));
  }
  unlock() {
    const next = this._queue.shift();
    if (next) next();
    else this._locked = false;
  }
  async withLock(fn) {
    await this.lock();
    try {
      return await fn();
    } finally {
      this.unlock();
    }
  }
}

export const stateLock = new Mutex();

// ---------- seed devices ----------
function makeDevices(roomId) {
  const now = new Date().toISOString();
  return [
    { id: `${roomId}-fan1`, room: roomId, type: "fan", name: "Ceiling Fan A", wattage: WATTAGE.fan, status: Math.random() > 0.4 ? "on" : "off", lastChanged: now },
    { id: `${roomId}-fan2`, room: roomId, type: "fan", name: "Ceiling Fan B", wattage: WATTAGE.fan, status: Math.random() > 0.5 ? "on" : "off", lastChanged: now },
    { id: `${roomId}-light1`, room: roomId, type: "light", name: "Panel Light 1", wattage: WATTAGE.light, status: Math.random() > 0.3 ? "on" : "off", lastChanged: now },
    { id: `${roomId}-light2`, room: roomId, type: "light", name: "Panel Light 2", wattage: WATTAGE.light, status: Math.random() > 0.3 ? "on" : "off", lastChanged: now },
    { id: `${roomId}-light3`, room: roomId, type: "light", name: "Panel Light 3", wattage: WATTAGE.light, status: Math.random() > 0.4 ? "on" : "off", lastChanged: now },
  ];
}

// ---------- store ----------
export const state = {
  devices: ROOMS.flatMap((r) => makeDevices(r.id)),

  // PCs - Work Room 1 & 2 only, per the fixed office layout.
  pcs: [
    { id: "work1-pc-1", room: "work1", on: true, lastActivityAt: new Date(Date.now() - 1000 * 60 * 40).toISOString() },
    { id: "work1-pc-2", room: "work1", on: false, lastActivityAt: new Date(Date.now() - 1000 * 60 * 220).toISOString() },
    { id: "work2-pc-1", room: "work2", on: true, lastActivityAt: new Date(Date.now() - 1000 * 60 * 12).toISOString() },
    { id: "work2-pc-2", room: "work2", on: true, lastActivityAt: new Date(Date.now() - 1000 * 60 * 95).toISOString() },
  ],

  environment: Object.fromEntries(
    ROOMS.map((r) => [
      r.id,
      {
        room: r.id,
        temperatureC: 23 + Math.random() * 3,
        humidityPct: 45 + Math.random() * 10,
        co2Ppm: 550 + Math.random() * 200,
        o2Pct: 20.6 + Math.random() * 0.3,
        lastReadAt: new Date().toISOString(),
      },
    ])
  ),

  occupancy: Object.fromEntries(ROOMS.map((r) => [r.id, Math.floor(Math.random() * 5)])),

  alerts: [],
  nextAlertId: 1,

  settings: {
    officeStart: "09:00",
    officeEnd: "17:00",
    kwhRate: Number(process.env.DEFAULT_KWH_RATE || 0.14),
    co2Threshold: 1000,
    smokeThreshold: 70,
    rules: {
      autoControl: true,
      afterHours: true,
      fireMonitoring: true,
      pcMonitoring: true,
    },
  },

  automation: Object.fromEntries(
    ROOMS.map((r) => [
      r.id,
      { autoControlEnabled: true, lastRecommendation: "No recommendation yet", lastAction: null },
    ])
  ),

  smokeLevel: Object.fromEntries(ROOMS.map((r) => [r.id, Math.random() * 8])),
  fireAlert: Object.fromEntries(ROOMS.map((r) => [r.id, false])),

  // Hardware link status per room. "simulated" until a real ESP32 room
  // node POSTs telemetry at least once; auto-reverts to "simulated" if a
  // live node goes quiet (see hardware.js's HARDWARE_TIMEOUT_MS) so an
  // unplugged board never freezes the demo.
  hardware: Object.fromEntries(
    ROOMS.map((r) => [
      r.id,
      { mode: "simulated", deviceId: null, lastSeenAt: null, staleSince: null, uptimeMs: null, liveWattage: null },
    ])
  ),
};

// ---------- history (time-series log) ----------
// Minimal but real: per-device on/off intervals + periodic env/occupancy
// snapshots. Query helpers below are the exact primitives the >2h rule,
// the 15-minute-occupancy rule, and cost aggregation need.
export const history = {
  deviceIntervals: {}, // deviceId -> [{ start, end }]  end=null means still ongoing
  occupancySnapshots: {}, // roomId -> [{ t, count }]
};

for (const d of state.devices) {
  history.deviceIntervals[d.id] = [
    { start: d.lastChanged, end: d.status === "on" ? null : new Date().toISOString() },
  ];
  if (d.status === "off") {
    // no ongoing interval
    history.deviceIntervals[d.id] = [];
  }
}
for (const r of ROOMS) history.occupancySnapshots[r.id] = [{ t: Date.now(), count: state.occupancy[r.id] }];

export function recordDeviceChange(device) {
  const intervals = history.deviceIntervals[device.id] || (history.deviceIntervals[device.id] = []);
  const last = intervals[intervals.length - 1];
  if (device.status === "on") {
    if (!last || last.end !== null) intervals.push({ start: device.lastChanged, end: null });
  } else {
    if (last && last.end === null) last.end = device.lastChanged;
  }
  // keep history bounded - drop intervals older than 48h
  const cutoff = Date.now() - 48 * 3600 * 1000;
  history.deviceIntervals[device.id] = intervals.filter(
    (iv) => iv.end === null || new Date(iv.end).getTime() > cutoff
  );
}

export function recordOccupancy(roomId, count) {
  const snaps = history.occupancySnapshots[roomId] || (history.occupancySnapshots[roomId] = []);
  snaps.push({ t: Date.now(), count });
  const cutoff = Date.now() - 6 * 3600 * 1000;
  history.occupancySnapshots[roomId] = snaps.filter((s) => s.t > cutoff).slice(-2000);
}

// How long (ms) has a device been continuously "on" right now?
export function continuousOnDurationMs(deviceId) {
  const intervals = history.deviceIntervals[deviceId] || [];
  const ongoing = intervals.find((iv) => iv.end === null);
  if (!ongoing) return 0;
  return Date.now() - new Date(ongoing.start).getTime();
}

// How long (ms) has a room been continuously at zero occupancy?
export function continuousZeroOccupancyMs(roomId) {
  const snaps = history.occupancySnapshots[roomId] || [];
  let ms = 0;
  for (let i = snaps.length - 1; i >= 0; i--) {
    if (snaps[i].count === 0) {
      ms = Date.now() - snaps[i].t;
    } else {
      break;
    }
  }
  // walk back further to find the actual start of the zero streak
  let start = null;
  for (let i = snaps.length - 1; i >= 0; i--) {
    if (snaps[i].count === 0) start = snaps[i].t;
    else break;
  }
  return start ? Date.now() - start : 0;
}

// Sum of on-time (hours) for a device within [sinceMs] ago -> now.
export function onTimeHoursSince(deviceId, sinceMs) {
  const since = Date.now() - sinceMs;
  const intervals = history.deviceIntervals[deviceId] || [];
  let ms = 0;
  for (const iv of intervals) {
    const start = Math.max(new Date(iv.start).getTime(), since);
    const end = iv.end ? new Date(iv.end).getTime() : Date.now();
    if (end > start) ms += end - start;
  }
  return ms / 3600000;
}
