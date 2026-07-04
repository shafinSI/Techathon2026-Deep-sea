import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import { router } from "./routes/index.js";
import { requireAuth } from "./auth.js";
import { initBroadcaster, clientCount } from "./ws/broadcaster.js";
import { startSimulator } from "./simulator.js";

const PORT = Number(process.env.PORT || 4000);
const AUTH_TOKEN = process.env.AUTH_TOKEN || "";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const TICK_INTERVAL_MS = Number(process.env.TICK_INTERVAL_MS || 6000);

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: CORS_ORIGIN === "*" ? "*" : CORS_ORIGIN.split(",").map((s) => s.trim()),
  })
);

// ---- structured request logging (M10.A) ----
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", wsClients: clientCount(), uptimeSec: Math.round(process.uptime()) });
});

app.use("/api/v1", requireAuth(AUTH_TOKEN), router);

// ---- consistent error shape for the whole API (M10.A) ----
app.use((req, res) => {
  res.status(404).json({ error: "not_found", message: `No route for ${req.method} ${req.originalUrl}` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal_error", message: "Something went wrong." });
});

const server = http.createServer(app);
initBroadcaster(server, { path: "/ws/live", authToken: AUTH_TOKEN });
startSimulator({ intervalMs: TICK_INTERVAL_MS });

server.listen(PORT, () => {
  console.log(`[soms-backend] REST + WS listening on http://localhost:${PORT}`);
  console.log(`[soms-backend] WebSocket path: ws://localhost:${PORT}/ws/live`);
  console.log(`[soms-backend] Auth: ${AUTH_TOKEN ? "enabled (bearer token required)" : "DISABLED (dev mode)"}`);
});
