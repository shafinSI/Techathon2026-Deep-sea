import { state, continuousZeroOccupancyMs } from "../state.js";
import { ROOMS } from "../schema.js";

// rules/autoControl.js — explainable, rule-based (not ML) climate automation.
// With no AC device in the 18-device spec (2 fans + 3 lights per room only),
// the fans are the only coolant-side devices available, so this rule now
// drives the fan bank instead of an AC unit:
// temp > 27C & occupied -> recommend fans ON
// temp < 22C -> recommend fans OFF
// occupancy == 0 for > 15 min -> recommend all climate devices (fans) OFF
//
// Always computes + reports lastRecommendation. Only WRITES device state
// when the room's autoControlEnabled flag (and the global rule toggle) are
// both true — this is the manual-override contract (Section 3.7).

const ZERO_OCC_THRESHOLD_MS = 15 * 60 * 1000;

function fansFor(roomId) {
  return state.devices.filter((d) => d.room === roomId && d.type === "fan");
}

export function runAutoControl(setDeviceStatus) {
  if (!state.settings.rules.autoControl) return;

  for (const room of ROOMS) {
    const env = state.environment[room.id];
    const occupancy = state.occupancy[room.id];
    const fans = fansFor(room.id);
    const auto = state.automation[room.id];

    let recommendation;
    let desiredStatus = null; // null = no change recommended

    if (occupancy === 0 && continuousZeroOccupancyMs(room.id) > ZERO_OCC_THRESHOLD_MS) {
      recommendation = `${room.name}: unoccupied 15min+ — recommend all fans OFF`;
      desiredStatus = "off";
    } else if (env.temperatureC > 27 && occupancy > 0) {
      recommendation = `${room.name}: recommend fans ON (temp ${env.temperatureC.toFixed(1)}\u00b0C, occupied)`;
      desiredStatus = "on";
    } else if (env.temperatureC < 22) {
      recommendation = `${room.name}: recommend fans OFF (temp ${env.temperatureC.toFixed(1)}\u00b0C)`;
      desiredStatus = "off";
    } else {
      recommendation = `${room.name}: conditions nominal — no change recommended`;
    }

    auto.lastRecommendation = recommendation;

    if (auto.autoControlEnabled && desiredStatus) {
      for (const fan of fans) {
        if (fan.status !== desiredStatus) {
          setDeviceStatus(fan.id, desiredStatus);
        }
      }
      auto.lastAction = `${desiredStatus === "on" ? "Turned ON" : "Turned OFF"} fan bank at ${new Date().toLocaleTimeString()}`;
    }
  }
}
