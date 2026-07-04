// Copies .env.example -> .env for every service that has one, but never
// overwrites an existing .env (so re-running `npm run setup` is safe and
// won't clobber a token you've already filled in).
import { existsSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const targets = ["soms-backend", "soms-discord-bot"];

for (const dir of targets) {
  const example = join(root, dir, ".env.example");
  const dest = join(root, dir, ".env");
  if (!existsSync(example)) continue;
  if (existsSync(dest)) {
    console.log(`[setup] ${dir}/.env already exists — leaving it alone`);
    continue;
  }
  copyFileSync(example, dest);
  console.log(`[setup] created ${dir}/.env from .env.example`);
}

console.log("\n[setup] Done. Backend/.env is ready to run as-is for local dev.");
console.log("[setup] soms-discord-bot/.env still needs DISCORD_TOKEN and ALERTS_CHANNEL_ID filled in manually.");
