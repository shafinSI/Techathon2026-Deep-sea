# SOMS Project — Setup & Run Commands

All commands used during the session, in order, including navigation attempts, errors, and the final working sequence.

## 1. Initial Navigation (with errors)

```bash
cd path/to/unzipped/soms
```
```
bash: cd: path/to/unzipped/soms: No such file or directory
```

```bash
ls
```
```
SOMS-connected-single-command
```

```bash
cd soms
```
```
bash: cd: soms: No such file or directory
```

```bash
cd SOMS-connected-single-command
```
✅ Success

## 2. Git Initialization

```bash
git init
```
```
Initialized empty Git repository in /workspaces/HC/SOMS-connected-single-command/.git/
```

```bash
git status
```
```
On branch main

No commits yet

Untracked files:
  (use "git add <file>..." to include in what will be committed)
        soms/

nothing added to commit but untracked files present (use "git add" to track)
```

## 3. Staging and Committing Files

```bash
git add .
```

```bash
git commit -m "SOMS project"
```
```
[main (root-commit) 0e70919] SOMS project
 36 files changed, 7069 insertions(+)
 create mode 100644 soms/HARDWARE.md
 create mode 100644 soms/SOMS-README.md
 create mode 100644 soms/diagrams/system-diagram.svg
 create mode 100644 soms/docker-compose.yml
 create mode 100644 soms/hardware/firmware/soms_room_node/soms_room_node.ino
 create mode 100644 soms/hardware/wokwi/README.md
 create mode 100644 soms/hardware/wokwi/diagram.json
 create mode 100644 soms/hardware/wokwi/wokwi.toml
 create mode 100644 soms/package-lock.json
 create mode 100644 soms/package.json
 create mode 100644 soms/scripts/setup-env.js
 create mode 100644 soms/soms-backend/Dockerfile
 create mode 100644 soms/soms-backend/README.md
 create mode 100644 soms/soms-backend/docs/connection-contract.md
 create mode 100644 soms/soms-backend/package.json
 create mode 100644 soms/soms-backend/src/auth.js
 create mode 100644 soms/soms-backend/src/hardware.js
 create mode 100644 soms/soms-backend/src/routes/index.js
 create mode 100644 soms/soms-backend/src/rules/alerts.js
 create mode 100644 soms/soms-backend/src/rules/autoControl.js
 create mode 100644 soms/soms-backend/src/schema.js
 create mode 100644 soms/soms-backend/src/server.js
 create mode 100644 soms/soms-backend/src/simulator.js
 create mode 100644 soms/soms-backend/src/snapshot.js
 create mode 100644 soms/soms-backend/src/state.js
 create mode 100644 soms/soms-backend/src/ws/broadcaster.js
 create mode 100644 soms/soms-discord-bot/README.md
 create mode 100644 soms/soms-discord-bot/package.json
 create mode 100644 soms/soms-discord-bot/src/bot.js
 create mode 100644 soms/soms-discord-bot/src/formatters.js
 create mode 100644 soms/soms-discord-bot/src/llm.js
 create mode 100644 soms/soms-discord-bot/src/rooms.js
 create mode 100644 soms/soms-discord-bot/src/somsClient.js
 create mode 100644 soms/soms-frontend-wired/Dockerfile
 create mode 100644 soms/soms-frontend-wired/README.md
 create mode 100644 soms/soms-frontend-wired/dist/index.html
```

## 4. Branch Rename & Remote Setup

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/asif6767/HC.git
```

## 5. Push to GitHub

```bash
git push -u origin main --force
```
```
Enumerating objects: 55, done.
Counting objects: 100% (55/55), done.
Delta compression using up to 2 threads
Compressing objects: 100% (47/47), done.
Writing objects: 100% (55/55), 90.63 KiB | 3.63 MiB/s, done.
Total 55 (delta 1), reused 0 (delta 0), pack-reused 0 (from 0)
remote: Resolving deltas: 100% (1/1), done.
To https://github.com/asif6767/HC.git
 + 8caab08...0e70919 main -> main (forced update)
branch 'main' set up to track 'origin/main'.
```

⚠️ **Note:** `--force` overwrites the remote branch history. Use with caution on shared repos.

## 6. First `npm run setup` attempt (failed — wrong directory)

```bash
npm run setup
```
```
npm error code ENOENT
npm error syscall open
npm error path /workspaces/HC/SOMS-connected-single-command/package.json
npm error errno -2
npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open '/workspaces/HC/SOMS-connected-single-command/package.json'
npm error enoent This is related to npm not being able to find a file.
```

```bash
ls
```
```
soms
```

```bash
cd folder-name
```
```
bash: cd: folder-name: No such file or directory
```

## 7. Correct Directory & Successful Setup

```bash
cd soms
```

```bash
npm run setup
```
```
> soms@1.0.0 setup
> npm install && npm run setup:env

added 203 packages, and audited 206 packages in 14s

54 packages are looking for funding
  run `npm fund` for details

4 vulnerabilities (3 moderate, 1 high)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.

> soms@1.0.0 setup:env
> node scripts/setup-env.js

[setup] Done. Backend/.env is ready to run as-is for local dev.
[setup] soms-discord-bot/.env still needs DISCORD_TOKEN and ALERTS_CHANNEL_ID filled in manually.
```

⚠️ **Note:** 4 vulnerabilities were flagged (3 moderate, 1 high). Run `npm audit` for details, and `npm audit fix --force` only if you understand the breaking changes it may introduce.

⚠️ **Action needed:** Fill in `DISCORD_TOKEN` and `ALERTS_CHANNEL_ID` manually in `soms-discord-bot/.env`.

## 8. Run the Project

```bash
npm run dev
```
```
> soms@1.0.0 dev
> concurrently -n backend,frontend -c blue,green "npm run dev:backend" "npm run dev:frontend"

[frontend] 
[frontend] > soms@1.0.0 dev:frontend
[frontend] > serve soms-frontend-wired/dist -l 8080
[frontend] 

[backend] 
[backend] > soms@1.0.0 dev:backend
[backend] > npm run start --workspace=soms-backend
[backend] 

[backend] > soms-backend@1.0.0 start
[backend] > node src/server.js

[frontend]  INFO  Accepting connections at http://localhost:8080
[backend] [simulator] tick loop started, interval=6000ms
[backend] [soms-backend] REST + WS listening on http://localhost:4000
[backend] [soms-backend] WebSocket path: ws://localhost:4000/ws/live
[backend] [soms-backend] Auth: DISABLED (dev mode)
[backend] 2026-07-04T08:11:14.109Z GET / -> 404 (11ms)
[backend] 2026-07-04T08:11:14.313Z GET /favicon.ico -> 404 (1ms)
[frontend]  HTTP  7/4/2026 8:11:21 AM ::1 GET /
[frontend]  HTTP  7/4/2026 8:11:21 AM ::1 Returned 200 in 576 ms
[frontend]  HTTP  7/4/2026 8:11:22 AM ::1 GET /favicon.ico
[frontend]  HTTP  7/4/2026 8:11:22 AM ::1 Returned 404 in 2 ms
```

✅ **Result:**
- Backend running at `http://localhost:4000` (REST + WebSocket at `/ws/live`)
- Frontend running at `http://localhost:8080`
- Auth is **DISABLED** in dev mode

---

## Clean Command Summary (no errors)

```bash
cd SOMS-connected-single-command
git init
git add .
git commit -m "SOMS project"
git branch -M main
git remote add origin https://github.com/asif6767/HC.git
git push -u origin main --force
cd soms
npm run setup
npm run dev
```
