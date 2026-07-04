// rooms.js — accepts whatever a human is likely to type after "!room "
// (work1, work 1, "work room 1", drawing, "the drawing room", ...) and
// maps it onto the backend's canonical room ids: drawing | work1 | work2.

const ROOM_IDS = ["drawing", "work1", "work2"];

const ALIASES = {
  drawing: "drawing",
  drawingroom: "drawing",
  waiting: "drawing",
  waitingroom: "drawing",
  work1: "work1",
  workroom1: "work1",
  work2: "work2",
  workroom2: "work2",
};

export function resolveRoom(input) {
  const key = String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return ALIASES[key] || (ROOM_IDS.includes(key) ? key : null);
}

export { ROOM_IDS };
