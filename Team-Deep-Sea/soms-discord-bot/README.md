# SOMS Discord Bot

The boss's "quick-access remote control." Reads from the exact same
`soms-backend` REST API + WebSocket that the web dashboard reads — there
is one backend, one source of truth, two front doors.

```
[Simulated Device Layer] → [Backend API] → [ Web UI ] && [ Discord Bot ]
```

## Commands

| Command | What it does |
|---|---|
| `!status` | On/off summary for every room, in the exact format the brief specifies |
| `!room <name>` | Detail for one room — accepts `work1`, `work 1`, `work room 1`, `drawing`, etc. |
| `!usage` | Total power right now (W) + today's estimated usage (kWh) |
| `!help` | Lists the above |

All three pull live numbers from `GET /api/v1/snapshot`, `/rooms/:room`,
`/power`, and `/cost` — nothing here is hardcoded or randomly generated in
the bot itself; the *only* randomness anywhere is in the backend's
simulator tick loop, same as what the dashboard shows.

## Bonus: proactive alert push

If `ALERTS_CHANNEL_ID` is set, the bot opens the same `ws://.../ws/live`
socket the dashboard uses and posts a friendly message into that channel
the instant the backend's rule engine raises an `alert:new` event
(after-hours device, >2h continuous run, etc.) — no polling needed for
this part.

## Setup

```bash
cp .env.example .env
# fill in DISCORD_TOKEN (Discord Developer Portal → your app → Bot → Token)
# fill in ALERTS_CHANNEL_ID if you want the bonus proactive push
npm install
npm start
```

Requires `soms-backend` to already be running (see the repo root README)
— the bot has no data of its own.

### Getting a bot token / inviting it to a server
1. https://discord.com/developers/applications → New Application → Bot →
   Reset Token → copy into `.env` as `DISCORD_TOKEN`.
2. Under **Bot**, enable **Message Content Intent** (required — the bot
   reads `!status` etc. from plain message text).
3. **OAuth2 → URL Generator**: scope `bot`, permissions `Send Messages` +
   `Read Message History`. Open the generated URL, pick your server.

## Why message commands (`!status`) instead of slash commands?

The brief's example table uses a literal `!status` / `!room <name>` /
`!usage` prefix syntax, so this bot implements that directly via
`messageCreate`, matching the spec exactly. Discord slash commands are a
one-line swap later (`interactionCreate` + the same handler functions in
`bot.js`) if you'd rather have autocomplete — not needed to meet the
brief.
