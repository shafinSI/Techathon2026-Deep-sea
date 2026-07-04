// contracts/schema.js
// Canonical data shapes. Every route and every simulator tick-handler must
// use these literal field names — nothing here gets renamed downstream.

export const ROOMS = [
  { id: "drawing", name: "Drawing Room" },
  { id: "work1", name: "Work Room 1" },
  { id: "work2", name: "Work Room 2" },
];

export const ROOM_IDS = ROOMS.map((r) => r.id);

export function isValidRoom(roomId) {
  return ROOM_IDS.includes(roomId);
}

// Device wattage baselines (documented so cost figures are explainable,
// not a black box - matches the fixture wattages already used by the
// frontend's client-side demo data).
export const WATTAGE = {
  fan: 65,
  light: 18,
};

/**
 * Device shape:
 * { id, room, type: 'fan'|'light', name, wattage, status: 'on'|'off', lastChanged }
 *
 * Room shape (as returned by GET /api/v1/rooms/:room):
 * { id, name, devices: Device[], environment: EnvironmentReading, occupancyCount, pcs?: PC[] }
 *
 * EnvironmentReading shape:
 * { room, temperatureC, humidityPct, co2Ppm, o2Pct, lastReadAt }
 *
 * Alert shape:
 * { id, type, severity: 'info'|'warning'|'critical', roomId, deviceId?, title, message, createdAt, resolvedAt }
 *
 * PC shape:
 * { id, room, on, lastActivityAt }
 *
 * AdminSettings shape:
 * { officeStart, officeEnd, kwhRate, co2Threshold, smokeThreshold, rules: { [ruleId]: boolean } }
 */
