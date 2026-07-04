import { ROOMS, isValidRoom } from "./schema.js";
import { state, stateLock, recordDeviceChange } from "./state.js";
import { broadcast } from "./ws/broadcaster.js";

// hardware.js — the bridge between real ESP32 room nodes and the rest of
// the system. A room node is "live" once it has POSTed telemetry at least
// once; it automatically falls back to "simulated" if it goes quiet for
// HARDWARE_TIMEOUT_MS, so a disconnected/unplugged board never freezes the
// dashboard mid-demo.
//
// Design: hardware controls two RELAY BANKS per room, not individual
// bulbs/fans — this matches the BOM (2 ACS712 current sensors: fan bank +
// light bank) and the pin table (2 relay channels: GPIO25 fan bank,
// GPIO26 light bank). No AC relay — the 15-device spec is 2 fans + 3
// lights per room only.
//
//   fanBankDeviceIds   -> `${room}-fan1`, `${room}-fan2`   (driven together)
//   lightBankDeviceIds -> `${room}-light1/2/3`              (driven together)

export const HARDWARE_TIMEOUT_MS = 30_000;

function fanBankIds(room) {
  return [`${room}-fan1`, `${room}-fan2`];
}
function lightBankIds(room) {
  return [`${room}-light1`, `${room}-light2`, `${room}-light3`];
}

export function isHardwareLive(room) {
  const hw = state.hardware[room];
  if (!hw || hw.mode !== "live") return false;
  if (Date.now() - new Date(hw.lastSeenAt).getTime() > HARDWARE_TIMEOUT_MS) {
    hw.mode = "simulated";
    hw.staleSince = new Date().toISOString();
    return false;
  }
  return true;
}

// Called by every simulator tick-handler that would otherwise mutate a
// room's environment/devices — lets a live room opt out of being
// overwritten by random-walk simulation while its ESP32 is reporting.
export function isRoomSimulated(room) {
  return !isHardwareLive(room);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ---- POST /api/v1/hardware/:room/telemetry ----
// Body sent by the ESP32 room node every TELEMETRY_INTERVAL_MS (firmware
// default 3000ms). All fields optional except `deviceId`/`uptimeMs`, so a
// partially-wired board (e.g. flame sensor not yet connected) still reports
// what it has instead of failing the whole payload.
export async function ingestTelemetry(req, res) {
  const { room } = req.params;
  if (!isValidRoom(room)) {
    return res.status(404).json({ error: "not_found", message: `Unknown room '${room}'.` });
  }

  const {
    deviceId,
    temperatureC,
    humidityPct,
    mq135Raw, // 0-4095 ADC counts from GPIO34
    flameRaw, // 0-4095 ADC counts from GPIO35 (lower = more flame, per typical IR flame sensor modules)
    motion, // boolean, PIR GPIO27
    currentFanBankAmps, // ACS712 #1, GPIO32-A
    currentLightBankAmps, // ACS712 #2, GPIO32-B (second ADC channel/mux, see HARDWARE.md)
    relayFanBank, // "on" | "off" — echoed actual physical relay state
    relayLightBank,
    uptimeMs,
  } = req.body || {};

  if (typeof mq135Raw !== "number" && typeof temperatureC !== "number" && typeof flameRaw !== "number") {
    return res.status(400).json({
      error: "bad_request",
      message: "Telemetry body must include at least one sensor reading.",
    });
  }

  await stateLock.withLock(async () => {
    const hw = state.hardware[room];
    hw.mode = "live";
    hw.lastSeenAt = new Date().toISOString();
    hw.deviceId = deviceId || hw.deviceId;
    hw.uptimeMs = uptimeMs ?? hw.uptimeMs;

    const env = state.environment[room];
    if (typeof temperatureC === "number") env.temperatureC = clamp(temperatureC, -10, 60);
    if (typeof humidityPct === "number") env.humidityPct = clamp(humidityPct, 0, 100);
    // MQ-135 gives a relative air-quality voltage, not calibrated ppm.
    // Linear-map raw ADC counts (400-4095 realistic indoor range) onto the
    // documented 400-1200ppm CO2 band the rest of the system expects —
    // see HARDWARE.md "Calibration & Mapping Notes" for the exact formula.
    if (typeof mq135Raw === "number") {
      const ppm = 400 + (clamp(mq135Raw, 400, 4095) - 400) * (800 / (4095 - 400));
      env.co2Ppm = clamp(ppm, 400, 1200);
    }
    // O2 has no physical sensor in this build (Section 14's documented
    // cost/complexity tradeoff) — keep it lightly simulated even in live
    // mode so the field is never blank.
    env.o2Pct = clamp(env.o2Pct + (Math.random() - 0.5) * 0.01, 19, 21);
    env.lastReadAt = new Date().toISOString();

    if (typeof flameRaw === "number") {
      // Most IR flame modules pull the analog line LOW as flame intensity
      // increases. Invert + scale onto the existing 0-100 smokeLevel scale
      // so the fire rule (rules/alerts.js) needs zero changes to consume it.
      const inverted = clamp(4095 - flameRaw, 0, 4095);
      state.smokeLevel[room] = clamp((inverted / 4095) * 100, 0, 100);
    }

    if (typeof motion === "boolean") {
      // PIR is a motion proxy, not a headcount (explicitly documented —
      // see HARDWARE.md). We fold it into occupancyCount as a 0/1 signal
      // so downstream rules (auto-control's 15-min zero-occupancy check)
      // keep working unmodified; a real deployment with per-desk sensors
      // could refine this later without changing the rule engine.
      state.occupancy[room] = motion ? Math.max(1, state.occupancy[room]) : 0;
    }

    if (typeof currentFanBankAmps === "number" || typeof currentLightBankAmps === "number") {
      const MAINS_VOLTAGE = 220;
      hw.liveWattage = hw.liveWattage || {};
      if (typeof currentFanBankAmps === "number") {
        hw.liveWattage.fanBank = clamp(currentFanBankAmps, 0, 30) * MAINS_VOLTAGE;
      }
      if (typeof currentLightBankAmps === "number") {
        hw.liveWattage.lightBank = clamp(currentLightBankAmps, 0, 30) * MAINS_VOLTAGE;
      }
    }

    // Echo actual relay state back into device records so the dashboard
    // reflects reality even if a relay was manually flipped at the panel.
    applyRelayEcho(relayFanBank, fanBankIds(room));
    applyRelayEcho(relayLightBank, lightBankIds(room));
  });

  broadcast("hardware:telemetry", { room, hardware: state.hardware[room] });
  res.json({ ok: true, mode: state.hardware[room].mode, receivedAt: state.hardware[room].lastSeenAt });
}

function applyRelayEcho(reportedStatus, deviceIds) {
  if (reportedStatus !== "on" && reportedStatus !== "off") return;
  for (const id of deviceIds) {
    const d = state.devices.find((x) => x.id === id);
    if (d && d.status !== reportedStatus) {
      d.status = reportedStatus;
      d.lastChanged = new Date().toISOString();
      recordDeviceChange(d);
    }
  }
}

// ---- GET /api/v1/hardware/:room/commands ----
// Polled by the ESP32 every COMMAND_POLL_INTERVAL_MS (firmware default
// 2000ms). Tells the board what the backend currently wants each relay
// bank to be — this is how a toggle flipped on the web dashboard or via
// the auto-control rule physically reaches the hardware.
export function getCommands(req, res) {
  const { room } = req.params;
  if (!isValidRoom(room)) {
    return res.status(404).json({ error: "not_found", message: `Unknown room '${room}'.` });
  }
  const fanOn = state.devices.find((d) => d.id === fanBankIds(room)[0])?.status === "on";
  const lightOn = state.devices.find((d) => d.id === lightBankIds(room)[0])?.status === "on";
  res.json({
    room,
    relayFanBank: fanOn ? "on" : "off",
    relayLightBank: lightOn ? "on" : "off",
    settings: {
      co2Threshold: state.settings.co2Threshold,
      smokeThreshold: state.settings.smokeThreshold,
    },
    serverTime: new Date().toISOString(),
  });
}

// ---- GET /api/v1/hardware ----
// Dashboard-facing status of every room's hardware link (live/simulated,
// last-seen, reported live wattage) — feeds an optional "Hardware" badge
// on the frontend without requiring a schema change to Device/Room.
export function getHardwareStatus(req, res) {
  res.json({ rooms: ROOMS.map((r) => ({ room: r.id, ...state.hardware[r.id] })) });
}
