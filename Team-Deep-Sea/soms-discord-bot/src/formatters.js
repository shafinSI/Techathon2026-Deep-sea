// formatters.js — turns real backend data into the friendly, non-robotic
// sentences the brief asks for ("the boss hates robotic data dumps").
// Deliberately template-based (no external LLM API key required to run),
// but every number below comes straight from the live snapshot — nothing
// here is hardcoded or random. See llm.js for the optional drop-in LLM
// rewrite hook if you want even more natural phrasing.

const ROOM_LABEL = { drawing: "Drawing Room", work1: "Work Room 1", work2: "Work Room 2" };

function roomSummary(devices) {
  const fansOn = devices.filter((d) => d.type === "fan" && d.status === "on").length;
  const lightsOn = devices.filter((d) => d.type === "light" && d.status === "on").length;
  if (fansOn === 0 && lightsOn === 0) return "all off";
  const parts = [];
  if (fansOn > 0) parts.push(`${fansOn} fan${fansOn === 1 ? "" : "s"} ON`);
  if (lightsOn > 0) parts.push(`${lightsOn} light${lightsOn === 1 ? "" : "s"} ON`);
  return parts.join(", ");
}

// !status — one line per room, matches the brief's example format exactly:
// "Drawing Room: 1 fan ON, 2 lights ON. Work Room 1: all off. ..."
export function formatStatus(devices) {
  const byRoom = ["drawing", "work1", "work2"].map((roomId) => {
    const roomDevices = devices.filter((d) => d.room === roomId);
    return `${ROOM_LABEL[roomId]}: ${roomSummary(roomDevices)}.`;
  });
  return `🏢 **Office status right now**\n${byRoom.join(" ")}`;
}

// !room <name> — a friendlier, per-device breakdown for one room.
export function formatRoom(roomId, room) {
  const label = ROOM_LABEL[roomId];
  const lines = room.devices.map((d) => `${d.status === "on" ? "🟢" : "⚪"} ${d.name} — ${d.status.toUpperCase()}`);
  const watts = room.devices.filter((d) => d.status === "on").reduce((s, d) => s + d.wattage, 0);
  return [
    `📍 **${label}**`,
    ...lines,
    "",
    `Drawing **${watts}W** right now.`,
  ].join("\n");
}

// !usage — total live power + a rough estimate for today.
export function formatUsage(totalWatts, kwhToday, perRoom) {
  const roomLine = perRoom.map((r) => `${ROOM_LABEL[r.room]}: ${r.wattage}W`).join(" · ");
  return [
    `⚡ **Total power right now: ${totalWatts}W**`,
    `Today's estimated usage so far: **${kwhToday.toFixed(1)} kWh**`,
    roomLine,
  ].join("\n");
}

// Bonus: proactive alert push into the designated channel.
export function formatAlertPush(alert) {
  const icon = alert.severity === "critical" ? "🔴" : alert.severity === "warning" ? "⚠️" : "ℹ️";
  const roomLabel = ROOM_LABEL[alert.roomId] || alert.roomId;
  return `${icon} Hey! ${roomLabel} — ${alert.message}`;
}

export function formatRoomNotFound(input, validRooms) {
  return `I don't know a room called "${input}". Try one of: ${validRooms.join(", ")} (or their names, like "work room 1").`;
}
