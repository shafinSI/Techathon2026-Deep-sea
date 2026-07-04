import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import WebSocket from "ws";
import { getSnapshot, getRoom, getPower, getEstimatedKwhToday } from "./somsClient.js";
import { formatStatus, formatRoom, formatUsage, formatAlertPush, formatRoomNotFound } from "./formatters.js";
import { resolveRoom, ROOM_IDS } from "./rooms.js";
import { humanize } from "./llm.js";

// Sends the deterministic template by default. If ANTHROPIC_API_KEY is set
// (see llm.js), tries an LLM rewrite first and only uses it if it succeeds —
// any failure/timeout silently falls back to `templateText`, so a flaky
// network call can never break a command or produce bad data.
async function reply(message, templateText, context) {
  const rewritten = await humanize(templateText, context);
  await message.reply(rewritten || templateText);
}

const PREFIX = "!";
const ALERTS_CHANNEL_ID = process.env.ALERTS_CHANNEL_ID || "";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

// ---------------- commands ----------------
// Every handler pulls live data from the SAME backend the web dashboard
// reads (soms-backend REST API) — no hardcoded or random responses, per
// the brief's "must give real answers from the actual simulated data"
// requirement.

async function handleStatus(message) {
  const { devices } = await getSnapshot();
  await reply(message, formatStatus(devices), "office-wide device status summary");
}

async function handleRoom(message, arg) {
  const roomId = resolveRoom(arg);
  if (!roomId) {
    await message.reply(formatRoomNotFound(arg, ROOM_IDS));
    return;
  }
  const room = await getRoom(roomId);
  await reply(message, formatRoom(roomId, room), `single-room status for ${roomId}`);
}

async function handleUsage(message) {
  const [power, kwhToday] = await Promise.all([getPower(), getEstimatedKwhToday()]);
  await reply(message, formatUsage(power.total, kwhToday, power.perRoom), "power usage summary");
}

async function handleHelp(message) {
  await message.reply(
    [
      "Here's what I can do:",
      "`!status` — quick on/off summary for every room",
      "`!room <name>` — detail for one room (e.g. `!room work1`, `!room drawing`)",
      "`!usage` — total power right now + today's estimated kWh",
    ].join("\n")
  );
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const [cmdRaw, ...rest] = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = cmdRaw.toLowerCase();

  try {
    if (cmd === "status") return await handleStatus(message);
    if (cmd === "room") return await handleRoom(message, rest.join(" "));
    if (cmd === "usage") return await handleUsage(message);
    if (cmd === "help" || cmd === "soms") return await handleHelp(message);
  } catch (err) {
    console.error(`[soms-bot] command '${cmd}' failed:`, err.message);
    await message.reply("⚠️ I couldn't reach the office backend just now — try again in a moment.");
  }
});

// ---------------- bonus: proactive alert push ----------------
// Listens to the SAME WebSocket the web dashboard listens to
// (ws/live -> alert:new), so a new alert (e.g. after-hours devices, >2h
// continuous run, fire) is posted into Discord the instant the backend's
// rule engine raises it — no polling loop needed for this part.

function connectAlertsSocket() {
  if (!ALERTS_CHANNEL_ID) {
    console.warn("[soms-bot] ALERTS_CHANNEL_ID not set — proactive alert push disabled.");
    return;
  }
  const wsUrl = process.env.SOMS_WS_URL || "ws://localhost:4000/ws/live";
  const token = process.env.SOMS_AUTH_TOKEN || "";
  const ws = new WebSocket(token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl);

  ws.on("open", () => console.log("[soms-bot] connected to backend WS for proactive alerts"));

  ws.on("message", async (raw) => {
    let evt;
    try {
      evt = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (evt.event !== "alert:new") return;
    const alert = evt.payload;
    if (!alert) return;
    try {
      const channel = await client.channels.fetch(ALERTS_CHANNEL_ID);
      if (channel) await channel.send(formatAlertPush(alert));
    } catch (err) {
      console.error("[soms-bot] failed to post proactive alert:", err.message);
    }
  });

  ws.on("close", () => {
    console.warn("[soms-bot] backend WS closed — reconnecting in 5s");
    setTimeout(connectAlertsSocket, 5000);
  });
  ws.on("error", (err) => console.error("[soms-bot] backend WS error:", err.message));
}

client.once("ready", () => {
  console.log(`[soms-bot] logged in as ${client.user.tag}`);
  connectAlertsSocket();
});

client.login(process.env.DISCORD_TOKEN);
