# SOMS Hardware Integration — Full Wiring & Connection Spec

> Companion to `SOMS-README.md`. This document is the single source of
> truth for **physical wiring** (which component connects to which pin)
> and **network wiring** (which service connects to which endpoint) for
> the real-hardware layer that now sits alongside the simulator.
>
> Scope: **one representative room** (default `work1` / "Work Room 1"),
> matching the original spec's Section 7/14 scoping ("one representative
> room wired for real, 3-room scaling figures for the report"). The same
> board design can be duplicated per room by changing `ROOM_ID` in the
> firmware and giving each board its own IP/port on the same network.

---

## 1. What "connected" means here (read this first)

Two separate wiring problems, both covered below:

1. **Component-to-component (physical/electrical)** — Section 2. Sensors
   and relays wired to one ESP32 DevKit v1.
2. **Hardware-to-software (network/protocol)** — Section 3. The ESP32
   talking HTTP to `soms-backend`, which is the same backend the web
   dashboard and (if built) the Discord bot already use. **The hardware
   never talks to the frontend directly** — it only ever talks to the
   backend, exactly like the simulator does. This preserves the existing
   architecture: `Hardware/Simulator → Backend → (Frontend / Bot)`.

---

## 2. Bill of Materials (this room)

| # | Component | Qty | Role |
|---|---|---|---|
| 1 | ESP32 DevKit v1 (30-pin) | 1 | Microcontroller, WiFi client |
| 2 | DHT22 temperature/humidity sensor | 1 | Env: temperature, humidity |
| 3 | MQ-135 air-quality sensor module | 1 | Env: CO₂ proxy (analog) |
| 4 | IR flame sensor module | 1 | Fire/smoke detection (analog) |
| 5 | HC-SR501 PIR motion sensor | 1 | Occupancy proxy (digital) |
| 6 | ACS712 current sensor module ×2 (20A variant) | 2 | Fan-bank current, light-bank current |
| 7 | 4-channel relay module (opto-isolated, 5V coil) | 1 (2 channels used) | Switches fan bank / light bank |
| 8 | Status LED (any color) + 220Ω resistor | 1 | WiFi/link status indicator |
| 9 | Active buzzer | 1 | Local audible fire alarm |
| 10 | External 5V/2A power supply | 1 | Powers relay coils — **not** the ESP32's onboard 3.3V regulator |
| 11 | 10kΩ resistor | 1 | DHT22 data-line pull-up |
| 12 | Breadboard + jumper wires | — | Prototyping |

Optional / documented-but-not-wired: electrochemical O₂ sensor ($25–40) —
skipped per the cost/complexity tradeoff; O₂ remains lightly simulated
even when the room is otherwise "live" (see Section 5).

---

## 3. Pin Table (FINAL — ESP32 DevKit v1)

This is the authoritative table. It uses **two** current sensors (fan
bank + light bank, per the BOM). There is no AC relay channel — the
15-device spec is 2 fans + 3 lights per room only, so GPIO14 (originally
reserved for an AC relay) is a spare, unused pin here.

| GPIO | Function | Direction | Component | Notes |
|---|---|---|---|---|
| **4** | DHT22 DATA | I/O (1-wire) | DHT22 pin 2 | 10kΩ pull-up to 3.3V required |
| **34** | MQ-135 analog out | Input (ADC1_CH6, input-only) | MQ-135 module `AO` pin | Input-only pin — correct choice, cannot drive output |
| **35** | Flame sensor analog out | Input (ADC1_CH7, input-only) | IR flame module `AO` pin | Input-only pin |
| **27** | PIR motion signal | Digital input | HC-SR501 `OUT` pin | HIGH = motion detected |
| **32** | ACS712 #1 analog out (fan bank) | Input (ADC1_CH4) | ACS712 #1 `OUT` pin | Via 2:1 divider — see §6 |
| **33** | ACS712 #2 analog out (light bank) | Input (ADC1_CH5) | ACS712 #2 `OUT` pin | Via 2:1 divider — see §6 |
| **25** | Relay channel 1 | Digital output | Relay module `IN1` | Switches fan-bank contactor |
| **26** | Relay channel 2 | Digital output | Relay module `IN2` | Switches light-bank contactor |
| **2** | Status LED | Digital output | LED anode (via 220Ω to GND) | Blinks while connecting, solid when online |
| **13** | Buzzer signal | Digital output | Active buzzer `+` | Local fire alarm, independent of backend round-trip |

No two functions share a GPIO. Both analog sensors requiring input-only
ADC1 pins (GPIO34/35) got them; both current sensors got ADC1-capable
pins (GPIO32/33); every relay/LED/buzzer output uses a normal
bidirectional GPIO.

---

## 4. Component-to-component wiring ("prompt" form)

Read each line as a literal instruction — this is deliberately written so
it can be pasted straight into a wiring checklist or handed to an AI
assistant/teammate with zero ambiguity about which physical pin goes
where.

### 4.1 Power rails
- Connect the ESP32's `5V` pin (from USB or external 5V) and `GND` to a
  shared breadboard power rail. Call this **Rail A (3.3V/5V logic)**.
- Connect the external 5V/2A power supply's `+` and `-` to a **second,
  separate** breadboard rail. Call this **Rail B (relay coil power)**.
- Connect Rail A `GND` and Rail B `GND` together at exactly one point
  (common ground) — this is required for the ACS712 and relay
  opto-isolator to read/switch correctly relative to the ESP32's logic
  levels, even though the coil supply itself is separate.
- Do **not** power the relay module's coil rail (`VCC`) from the ESP32's
  onboard 3.3V/5V regulator — connect the relay module's `VCC` to Rail B
  instead. The ESP32's regulator is not rated for 4 relay coils switching
  simultaneously.

### 4.2 DHT22 (temperature/humidity)
- Connect DHT22 pin 1 (`VCC`) to Rail A `3.3V`.
- Connect DHT22 pin 2 (`DATA`) to ESP32 **GPIO4**.
- Connect a 10kΩ resistor between DHT22 pin 2 (`DATA`) and Rail A `3.3V`
  (pull-up).
- Connect DHT22 pin 4 (`GND`) to Rail A `GND`.

### 4.3 MQ-135 (air quality / CO₂ proxy)
- Connect MQ-135 module `VCC` to Rail A `5V` (most MQ-135 breakout boards
  need 5V for the heater element, even though the analog output itself is
  safe for the ESP32's 3.3V ADC input range).
- Connect MQ-135 module `GND` to Rail A `GND`.
- Connect MQ-135 module `AO` (analog out) directly to ESP32 **GPIO34**.
- Leave `DO` (digital out) unconnected — the firmware only reads the
  analog line.

### 4.4 IR flame sensor
- Connect flame sensor `VCC` to Rail A `3.3V` (or `5V` if your module's
  silkscreen specifies 5V — check before powering).
- Connect flame sensor `GND` to Rail A `GND`.
- Connect flame sensor `AO` to ESP32 **GPIO35**.

### 4.5 PIR motion sensor (HC-SR501)
- Connect PIR `VCC` to Rail A `5V`.
- Connect PIR `GND` to Rail A `GND`.
- Connect PIR `OUT` to ESP32 **GPIO27**.
- Set the PIR module's onboard sensitivity/time-delay trimmers to their
  lowest delay setting for demo responsiveness (long default delays make
  the occupancy-off rule slow to demonstrate).

### 4.6 ACS712 current sensors ×2 (fan bank + light bank)
Each ACS712 module sits **in series with the load it measures**, never
in parallel — the load's actual current must physically pass through the
sensor's IP+/IP- terminals.

**ACS712 #1 (fan bank):**
- Wire the fan bank's live/hot conductor **through** ACS712 #1's `IP+`
  and `IP-` terminals (i.e. cut the conductor and route it through the
  sensor) — this sensor is on the switched (relay-controlled) side, after
  relay channel 1.
- Connect ACS712 #1 `VCC` to Rail A `5V`.
- Connect ACS712 #1 `GND` to Rail A `GND`.
- Connect ACS712 #1 `OUT` to a 2-resistor divider (see §6), then to ESP32
  **GPIO32**.

**ACS712 #2 (light bank):**
- Wire the light bank's live/hot conductor through ACS712 #2's `IP+`/`IP-`
  terminals, after relay channel 2.
- Connect ACS712 #2 `VCC`/`GND` to Rail A `5V`/`GND`.
- Connect ACS712 #2 `OUT` through its own divider, then to ESP32
  **GPIO33**.

> ⚠️ Mains-voltage caveat: if the fan/light bank is ever wired to real
> 220V mains (not required for this simulation-grade build), the
> IP+/IP-side wiring above involves live mains current. Use rated
> wiring, a proper enclosure, and have an electrician review the mains
> side before energizing. This submission's demo build treats the
> "load" as a low-voltage bench substitute (e.g. a 12V fan/LED strip) so
> the same wiring logic can be demonstrated safely.

### 4.7 4-channel relay module (2 channels used)
- Connect relay module `VCC` to **Rail B** (external 5V supply) — not
  Rail A. Connect relay module `GND` to the common ground point
  described in §4.1.
- Connect relay module `IN1` to ESP32 **GPIO25** (fan bank).
- Connect relay module `IN2` to ESP32 **GPIO26** (light bank).
- Leave `IN3`/`IN4` unconnected (spare channels — no AC relay in the
  15-device spec: 2 fans + 3 lights per room only).
- On each used channel's output side: wire `COM` to the load's live
  feed, and `NO` (normally-open) to the load itself, so the relay is
  OFF by default when de-energized.
- Confirm the relay module has onboard flyback diodes across each coil
  (nearly all pre-built modules do); if using bare relays instead of a
  module, add a 1N4007 diode across each coil, cathode to the positive
  side.

### 4.8 Status LED
- Connect LED anode through a 220Ω resistor to ESP32 **GPIO2**.
- Connect LED cathode to Rail A `GND`.

### 4.9 Buzzer
- Connect buzzer `+` to ESP32 **GPIO13**.
- Connect buzzer `-` to Rail A `GND`.

---

## 5. Hardware ↔ Backend connection (network wiring)

The ESP32 is a third client of `soms-backend`, alongside the frontend and
bot — it uses the **same** bearer-token-authenticated REST API, on two
new routes added specifically for this bridge (`src/hardware.js`,
mounted in `src/routes/index.js`):

| Direction | Method | Path | Purpose | Called by |
|---|---|---|---|---|
| Hardware → Backend | `POST` | `/api/v1/hardware/:room/telemetry` | Push sensor readings + relay echo | ESP32, every 3s |
| Backend → Hardware | `GET` | `/api/v1/hardware/:room/commands` | Poll desired relay state | ESP32, every 2s |
| Anyone → Backend | `GET` | `/api/v1/hardware` | Per-room live/simulated status, last-seen, live wattage | Frontend (optional badge) |

Both hardware routes require the same `Authorization: Bearer <AUTH_TOKEN>`
header as every other route (`src/auth.js`) — set the identical value in
the firmware's `AUTH_TOKEN` constant and the backend's `.env`.

**Telemetry payload (ESP32 → backend):**
```json
{
  "deviceId": "esp32-work1-01",
  "temperatureC": 26.4,
  "humidityPct": 48.0,
  "mq135Raw": 2200,
  "flameRaw": 4000,
  "motion": true,
  "currentFanBankAmps": 0.62,
  "currentLightBankAmps": 0.31,
  "relayFanBank": "on",
  "relayLightBank": "off",
  "relayAc": "off",
  "uptimeMs": 123456
}
```

**Commands response (backend → ESP32):**
```json
{
  "room": "work1",
  "relayFanBank": "on",
  "relayLightBank": "off",
  "relayAc": "off",
  "settings": { "co2Threshold": 1000, "smokeThreshold": 70 },
  "serverTime": "2026-07-04T04:00:25.646Z"
}
```

**What the backend does with telemetry** (`src/hardware.js`):
- Marks the room's `hardware.mode` as `"live"` and records `lastSeenAt`.
- Maps `temperatureC`/`humidityPct` straight into `EnvironmentReading`.
- Maps `mq135Raw` (0–4095 ADC counts) onto the existing 400–1200ppm CO₂
  band the rest of the system already expects — zero changes needed
  downstream in `rules/alerts.js`'s ventilation check.
- Maps `flameRaw` onto the existing 0–100 `smokeLevel` scale (inverted,
  since lower ADC = more flame on most IR flame modules) — the fire rule
  in `rules/alerts.js` consumes this identically whether the number came
  from the simulator or a real sensor.
- Maps `motion` (PIR) onto `occupancyCount` as a 0/1 signal — explicitly
  documented as a motion **proxy**, not a headcount, matching the
  limitation called out for the PIR sensor.
- Converts each ACS712's amps into watts (`amps × 220V`) for a
  `hardware.liveWattage` figure exposed via `GET /api/v1/hardware`.
- Echoes reported relay state back onto the matching `Device` records, so
  a manual physical override at the relay panel is reflected on the
  dashboard.

**Auto-fallback:** if a room's ESP32 goes quiet for more than 30s
(`HARDWARE_TIMEOUT_MS` in `src/hardware.js`), the backend automatically
reverts that room to `"simulated"` mode and the existing random-walk
tick-handlers resume — an unplugged or crashed board never freezes the
dashboard mid-demo. Every simulator tick-handler (`src/simulator.js`)
checks `isRoomSimulated(roomId)` before mutating a room's devices,
environment, or smoke level, so live and simulated rooms never fight
over the same state.

**What the backend does with commands:** `GET /commands` simply reads the
current `Device.status` for that room's fan-bank/light-bank entries —
the exact same records the web dashboard's toggle switches and the
auto-control rule (`rules/autoControl.js`) already write to (the
auto-control rule now drives the fan bank directly, since there's no AC
device in the 15-device spec). Flipping a switch on the dashboard
reaches the physical relay within one ESP32 poll cycle (≤2s) with **no
new code path** — the hardware bridge simply reads the same `Device`
records everything else does.

---

## 6. Calibration & Mapping Notes

- **MQ-135 → ppm:** MQ-135 modules output a relative voltage, not a
  calibrated ppm figure, without a proper burn-in + reference-gas
  calibration curve. This build uses a documented linear approximation
  (raw ADC 400–4095 → 400–1200ppm) purely so the number lands in the
  same band the rest of the system already validates against. Treat the
  absolute ppm value as illustrative, not laboratory-accurate — this is
  stated here rather than presented as more precise than it is.
- **ACS712 zero-current offset:** the sensor outputs **2.5V at 0A**. The
  firmware's `readAcsAmps()` subtracts this offset explicitly — if your
  specific module's true zero-offset drifts (common with cheap boards),
  measure it with no load connected and update the `2.5` constant in
  `soms_room_node.ino`.
- **ACS712 sensitivity:** `0.100 V/A` assumes the **20A** ACS712 variant.
  If using the 5A variant, change to `0.185`; for 30A, use `0.066` — check
  the exact part number silkscreened on your module.
- **5V→3.3V divider:** the ESP32's ADC is **not 5V-tolerant**. Both
  ACS712 outputs and the MQ-135/flame analog outputs, if genuinely
  5V-referenced on your specific modules, must go through a resistor
  divider (e.g. 10kΩ + 10kΩ for a 2:1 ratio) before reaching GPIO32-35.
  The firmware's `DIVIDER_MULTIPLIER = 2.0` assumes exactly this 2:1
  ratio — adjust both the physical resistors and this constant together
  if you use a different ratio.

---

## 7. Deployment checklist (do this in order)

1. Wire everything per §4, double-checking against the pin table in §3
   before applying power.
2. Flash `hardware/firmware/soms_room_node/soms_room_node.ino` after
   editing its top-of-file constants: `WIFI_SSID`, `WIFI_PASSWORD`,
   `BACKEND_HOST` (the machine running `soms-backend`, reachable on your
   local network — not `localhost`, since that would resolve to the ESP32
   itself), `AUTH_TOKEN` (must match the backend's `.env`), `ROOM_ID`.
3. Start the backend (`docker compose up` or `npm start` in
   `soms-backend/`) and confirm `GET /api/v1/hardware` shows the target
   room as `"mode": "simulated"` with `"lastSeenAt": null`.
4. Power on the ESP32. Watch its serial monitor (115200 baud) for
   `[wifi] connected` — the status LED goes solid once online.
5. Within ~3s, `GET /api/v1/hardware` should show that room flip to
   `"mode": "live"` with a real `lastSeenAt` timestamp and populated
   `liveWattage`.
6. Toggle a fan/light for that room from the web dashboard — confirm the
   corresponding relay physically clicks within ~2s.
7. Trigger the flame sensor (briefly, safely — e.g. a lighter held a
   short distance away per the module's datasheet test procedure) and
   confirm both the local buzzer sounds immediately and a `critical`
   fire alert appears on the dashboard within one backend tick.
8. Unplug the ESP32 mid-demo and confirm the room automatically falls
   back to `"mode": "simulated"` within 30s, with the dashboard
   continuing to show live-looking data instead of freezing.


---

## 8. Wokwi Virtual Simulation — full copy-paste code

This section is self-contained: everything needed to *see* the circuit
above run, with no backend, no WiFi, and no real parts, lives here. It
covers the same one representative room (`work1`) and the same pin table
from Section 3 — nothing in this section introduces new pins or new
wiring decisions, it only makes them runnable.

### 8.1 What's simulated vs. what it stands in for

Wokwi doesn't ship a DHT22-accurate-but-fake-gas-sensor part library, so
non-digital/analog sensors are represented with parts that produce the
same *shape* of signal an ESP32 would actually read, each labelled in
the diagram itself:

| Wokwi part | Pin | Stands in for | Real part (Section 2 BOM) |
|---|---|---|---|
| `wokwi-dht22` | GPIO4 | Temp/humidity — this one is a real, accurate Wokwi part | DHT22 |
| `mq135_sim` potentiometer | GPIO34 | Sweep to change the "air quality" analog reading | MQ-135 module |
| `flame_sim` potentiometer | GPIO35 | Turn past the firmware's threshold to trip the buzzer | IR flame sensor module |
| `pir_sim` pushbutton | GPIO27 | Press and hold = "motion detected" | HC-SR501 PIR |
| `acs712_fan_sim` potentiometer | GPIO32 | Sweep to change the fan bank's "sensed current" | ACS712 #1 |
| `acs712_light_sim` potentiometer | GPIO33 | Sweep to change the light bank's "sensed current" | ACS712 #2 |
| `fan1_led` / `fan2_led` (cyan) | GPIO25 (via relay, simplified to direct GPIO drive here) | Fan bank on/off | Relay ch.1 → 2 ceiling fans |
| `light1_led` / `light2_led` / `light3_led` (yellow) | GPIO26 | Light bank on/off | Relay ch.2 → 3 panel lights |
| `status_led` (green) | GPIO2 | WiFi/link status | Same status LED |
| `buzzer` | GPIO13 | Local fire alarm | Same buzzer |

The firmware in §8.3 ships with `SIMULATION_MODE 1`, which means the fan
and light banks toggle themselves on a fixed timer (10s / 7s) so you see
the LEDs change without needing a backend to command them — this is
purely a demo convenience switch; the exact same relay-driving code path
(`applyRelay()`) is what production mode (`SIMULATION_MODE 0`) drives
from real backend commands (Section 5).

### 8.2 How to run it in Wokwi (step by step)

1. Go to **https://wokwi.com/projects/new/esp32**.
2. In the left file list, click the **`sketch.ino`** tab and delete its
   contents. Paste in the full firmware from §8.3 below.
3. Click the **`diagram.json`** tab, delete its contents, and paste in
   the full circuit from §8.4 below. Wokwi re-renders the circuit
   immediately — you should see the ESP32, DHT22, four potentiometers,
   one pushbutton, five LEDs, and a buzzer.
4. Open **Library Manager** (or the `libraries.txt`/`Add Library`
   search box) and add: `DHT sensor library` (Adafruit) and its
   dependency `Adafruit Unified Sensor`, plus `ArduinoJson`. Wokwi's
   default ESP32 starter project usually has ArduinoJson already; DHT
   needs adding explicitly.
5. Click **▶ Start simulation**. Open the Serial Monitor (it opens
   automatically in Wokwi) — within ~2 seconds you'll see the
   `SIMULATION MODE` banner and then a status block printing every 2s.
6. Drag the `pir_sim` pushbutton and click-hold it — `PIR/motion` in the
   Serial output flips to `OCCUPIED` and the status LED starts blinking.
7. Drag any potentiometer's knob — the corresponding raw ADC value in
   the Serial output changes live. Turn `flame_sim` far enough and the
   buzzer (visible speaker icon) activates and the log prints
   `<< FIRE THRESHOLD`.
8. Watch the fan/light LEDs — they'll flip on/off automatically every
   10s / 7s, proving the relay-drive pins (GPIO25/26) are wired
   correctly, exactly as they would when a real backend command arrives
   in production mode.

To see the **production** (real backend) code path instead, change line
`#define SIMULATION_MODE 1` to `0` in the sketch, fill in `WIFI_SSID`
and set `BACKEND_HOST` to a network address the Wokwi simulator's
virtual network can actually reach (Wokwi's ESP32 has real internet
access via the `Wokwi-GUEST` network, so this only works if
`soms-backend` is deployed somewhere publicly reachable over
HTTP/HTTPS — not `localhost` or a private LAN IP).

### 8.3 Firmware — `soms_room_node.ino` (full, copy-paste ready)

Identical to `hardware/firmware/soms_room_node/soms_room_node.ino` in
this repo — kept in sync; if you edit one, edit both, or better, just
reference the repo file directly.

```cpp
/*
 * SOMS Room Node — ESP32 firmware
 * ---------------------------------------------------------------
 * One board per "representative room" (default: Work Room 1 / "work1").
 * Reads DHT22 + MQ-135 + IR flame sensor + PIR, drives 2 relay channels
 * (fan bank / light bank), reads 2x ACS712 current sensors, and
 * talks to the SOMS backend over plain HTTP.
 *
 * Wiring reference: /HARDWARE.md in the repo root, Section 3 (Pin Table)
 * and Section 8 (Wokwi circuit) — this file's pin #define's below are the
 * literal, final values from that document. Do not change a pin here
 * without updating HARDWARE.md to match.
 *
 * -----------------------------------------------------------------
 * TWO MODES, ONE FILE — flip a single line, nothing else changes:
 *
 *   SIMULATION_MODE 1  (default)
 *     - No WiFi / no backend required.
 *     - Runs standalone inside the Wokwi simulator (or on a real board
 *       with no network) so you can *see* the wiring work immediately:
 *       fan bank + light bank cycle on/off on their own timers, sensor
 *       values are read from the pots/button/DHT22 in diagram.json and
 *       printed to Serial every cycle, and the buzzer/status LED react
 *       to the simulated flame/PIR inputs in real time.
 *     - This is what "no real hardware needed" in the brief maps to —
 *       it proves the pin wiring and sensing logic without a backend.
 *
 *   SIMULATION_MODE 0  (real deployment)
 *     - Connects to WIFI_SSID, POSTs telemetry to soms-backend every
 *       TELEMETRY_INTERVAL_MS, and polls relay commands every
 *       COMMAND_POLL_INTERVAL_MS — this is the production path described
 *       in HARDWARE.md Section 5 ("Hardware <-> Backend connection").
 *
 * Libraries required (Arduino Library Manager) — needed in BOTH modes,
 * since the code for both lives in this one file:
 *   - "DHT sensor library" by Adafruit  (+ "Adafruit Unified Sensor")
 *   - "ArduinoJson" by Benoit Blanchon (v6.x)
 * Board package: "esp32" by Espressif Systems (Arduino-ESP32 core)
 * (Wokwi's default ESP32 project already bundles all of the above.)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ============ 0. MODE SWITCH ============
#define SIMULATION_MODE 1   // 1 = standalone Wokwi demo, 0 = real backend-connected deployment

// ============ 1. NETWORK / BACKEND CONFIG (used when SIMULATION_MODE==0) ============
const char* WIFI_SSID      = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";
const char* BACKEND_HOST   = "http://192.168.1.50:4000";   // soms-backend REST base, no trailing slash
const char* AUTH_TOKEN     = "soms-dev-token";               // must match backend .env AUTH_TOKEN
const char* ROOM_ID        = "work1";                        // one of: drawing | work1 | work2
const char* DEVICE_ID      = "esp32-work1-01";

const unsigned long TELEMETRY_INTERVAL_MS    = 3000;
const unsigned long COMMAND_POLL_INTERVAL_MS = 2000;
const unsigned long WIFI_RETRY_INTERVAL_MS   = 5000;

// ============ 2. PIN MAP (from HARDWARE.md Section 3, "Pin Table") ============
#define PIN_DHT22            4
#define PIN_MQ135_AO         34
#define PIN_FLAME_AO         35
#define PIN_PIR              27
#define PIN_ACS712_FANBANK   32
#define PIN_ACS712_LIGHTBANK 33
#define PIN_RELAY_FANBANK    25
#define PIN_RELAY_LIGHTBANK  26
#define PIN_STATUS_LED       2
#define PIN_BUZZER           13

DHT dht(PIN_DHT22, DHT22);

bool relayFanBank   = false;
bool relayLightBank = false;

unsigned long lastTelemetryAt   = 0;
unsigned long lastCommandPollAt = 0;

unsigned long lastSimPrintAt    = 0;
unsigned long lastFanToggleAt   = 0;
unsigned long lastLightToggleAt = 0;
const unsigned long SIM_PRINT_INTERVAL_MS = 2000;
const unsigned long SIM_FAN_PERIOD_MS     = 10000;
const unsigned long SIM_LIGHT_PERIOD_MS   = 7000;

void setup() {
  Serial.begin(115200);
  pinMode(PIN_RELAY_FANBANK, OUTPUT);
  pinMode(PIN_RELAY_LIGHTBANK, OUTPUT);
  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_PIR, INPUT);

  digitalWrite(PIN_RELAY_FANBANK, LOW);
  digitalWrite(PIN_RELAY_LIGHTBANK, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  dht.begin();

#if SIMULATION_MODE
  Serial.println("=== SOMS Room Node — SIMULATION MODE ===");
  Serial.println("No WiFi/backend needed. Turn the pots and press the");
  Serial.println("button in the Wokwi diagram to see sensor readings and");
  Serial.println("the fan/light banks change below.");
  digitalWrite(PIN_STATUS_LED, HIGH);
#else
  Serial.println("=== SOMS Room Node — PRODUCTION MODE ===");
  connectWiFi();
#endif
}

void loop() {
#if SIMULATION_MODE
  runSimulationLoop();
#else
  runProductionLoop();
#endif
}

// ================================================================
// PRODUCTION PATH (SIMULATION_MODE 0) — talks to soms-backend
// ================================================================
void runProductionLoop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  unsigned long now = millis();

  if (now - lastTelemetryAt >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryAt = now;
    sendTelemetry();
  }

  if (now - lastCommandPollAt >= COMMAND_POLL_INTERVAL_MS) {
    lastCommandPollAt = now;
    pollCommands();
  }
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("[wifi] connecting to %s...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_RETRY_INTERVAL_MS) {
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    delay(250);
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] connected, IP=%s\n", WiFi.localIP().toString().c_str());
    digitalWrite(PIN_STATUS_LED, HIGH);
  } else {
    Serial.println("[wifi] retry...");
    digitalWrite(PIN_STATUS_LED, LOW);
  }
}

float readAcsAmps(int pin) {
  const float ACS712_SENSITIVITY_V_PER_A = 0.100;
  const float ADC_VREF = 3.3;
  const int ADC_MAX = 4095;
  const float DIVIDER_MULTIPLIER = 2.0;

  int raw = analogRead(pin);
  float voltageAtPin = (raw / (float)ADC_MAX) * ADC_VREF;
  float trueVoltage = voltageAtPin * DIVIDER_MULTIPLIER;
  float amps = (trueVoltage - 2.5) / ACS712_SENSITIVITY_V_PER_A;
  return amps < 0 ? 0 : amps;
}

void sendTelemetry() {
  float tempC = dht.readTemperature();
  float humidity = dht.readHumidity();
  int mq135Raw = analogRead(PIN_MQ135_AO);
  int flameRaw = analogRead(PIN_FLAME_AO);
  bool motion = digitalRead(PIN_PIR) == HIGH;
  float fanAmps = readAcsAmps(PIN_ACS712_FANBANK);
  float lightAmps = readAcsAmps(PIN_ACS712_LIGHTBANK);

  StaticJsonDocument<512> doc;
  doc["deviceId"] = DEVICE_ID;
  if (!isnan(tempC)) doc["temperatureC"] = tempC;
  if (!isnan(humidity)) doc["humidityPct"] = humidity;
  doc["mq135Raw"] = mq135Raw;
  doc["flameRaw"] = flameRaw;
  doc["motion"] = motion;
  doc["currentFanBankAmps"] = fanAmps;
  doc["currentLightBankAmps"] = lightAmps;
  doc["relayFanBank"] = relayFanBank ? "on" : "off";
  doc["relayLightBank"] = relayLightBank ? "on" : "off";
  doc["uptimeMs"] = millis();

  String body;
  serializeJson(doc, body);

  String url = String(BACKEND_HOST) + "/api/v1/hardware/" + ROOM_ID + "/telemetry";
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + AUTH_TOKEN);
  int code = http.POST(body);
  if (code != 200) {
    Serial.printf("[telemetry] POST failed, code=%d\n", code);
  }
  http.end();

  bool localFire = (4095 - flameRaw) / 4095.0 * 100.0 >= 70;
  digitalWrite(PIN_BUZZER, localFire ? HIGH : LOW);
}

void pollCommands() {
  String url = String(BACKEND_HOST) + "/api/v1/hardware/" + ROOM_ID + "/commands";
  HTTPClient http;
  http.begin(url);
  http.addHeader("Authorization", String("Bearer ") + AUTH_TOKEN);
  int code = http.GET();
  if (code == 200) {
    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, http.getString());
    if (!err) {
      applyRelay(PIN_RELAY_FANBANK, relayFanBank, String(doc["relayFanBank"] | "off") == "on");
      applyRelay(PIN_RELAY_LIGHTBANK, relayLightBank, String(doc["relayLightBank"] | "off") == "on");
    }
  } else {
    Serial.printf("[commands] GET failed, code=%d\n", code);
  }
  http.end();
}

void applyRelay(int pin, bool &currentState, bool desiredOn) {
  if (currentState == desiredOn) return;
  currentState = desiredOn;
  digitalWrite(pin, desiredOn ? HIGH : LOW);
}

// ================================================================
// SIMULATION PATH (SIMULATION_MODE 1) — no network, runs in Wokwi
// ================================================================
void runSimulationLoop() {
  unsigned long now = millis();

  float tempC = dht.readTemperature();
  float humidity = dht.readHumidity();
  int mq135Raw = analogRead(PIN_MQ135_AO);
  int flameRaw = analogRead(PIN_FLAME_AO);
  bool motion = digitalRead(PIN_PIR) == HIGH;
  float fanAmps = readAcsAmps(PIN_ACS712_FANBANK);
  float lightAmps = readAcsAmps(PIN_ACS712_LIGHTBANK);

  if (now - lastFanToggleAt >= SIM_FAN_PERIOD_MS) {
    lastFanToggleAt = now;
    applyRelay(PIN_RELAY_FANBANK, relayFanBank, !relayFanBank);
  }
  if (now - lastLightToggleAt >= SIM_LIGHT_PERIOD_MS) {
    lastLightToggleAt = now;
    applyRelay(PIN_RELAY_LIGHTBANK, relayLightBank, !relayLightBank);
  }

  bool localFire = (4095 - flameRaw) / 4095.0 * 100.0 >= 70;
  digitalWrite(PIN_BUZZER, localFire ? HIGH : LOW);

  digitalWrite(PIN_STATUS_LED, motion ? ((now / 150) % 2) : HIGH);

  if (now - lastSimPrintAt >= SIM_PRINT_INTERVAL_MS) {
    lastSimPrintAt = now;
    Serial.println("----------------------------------------------------");
    Serial.printf("Room: %s | uptime: %lus\n", ROOM_ID, now / 1000);
    Serial.printf("Temp: %.1f C | Humidity: %.1f %%\n",
                  isnan(tempC) ? -1.0f : tempC, isnan(humidity) ? -1.0f : humidity);
    Serial.printf("MQ135 raw: %d | Flame raw: %d %s\n",
                  mq135Raw, flameRaw, localFire ? "<< FIRE THRESHOLD" : "");
    Serial.printf("PIR/motion: %s\n", motion ? "OCCUPIED" : "empty");
    Serial.printf("Fan bank:   %s | sensed current: %.2f A\n",
                  relayFanBank ? "ON " : "OFF", fanAmps);
    Serial.printf("Light bank: %s | sensed current: %.2f A\n",
                  relayLightBank ? "ON " : "OFF", lightAmps);
  }
}
```

### 8.4 Circuit — `diagram.json` (full, copy-paste ready)

Identical to `hardware/wokwi/diagram.json` in this repo.

```json
{
  "version": 1,
  "author": "SOMS project",
  "editor": "wokwi",
  "parts": [
    { "type": "wokwi-esp32-devkit-v1", "id": "esp", "top": 0, "left": 100, "attrs": {} },

    { "type": "wokwi-dht22", "id": "dht22", "top": -220, "left": -260, "attrs": {} },
    { "type": "wokwi-resistor", "id": "r_dht_pullup", "top": -220, "left": -180, "attrs": { "value": "10000" } },

    { "type": "wokwi-potentiometer", "id": "mq135_sim", "top": -160, "left": -260, "attrs": { "label": "MQ-135 stand-in (air quality)" } },
    { "type": "wokwi-potentiometer", "id": "flame_sim", "top": -100, "left": -260, "attrs": { "label": "IR flame stand-in" } },

    { "type": "wokwi-pushbutton", "id": "pir_sim", "top": -40, "left": -260, "attrs": { "color": "blue", "label": "PIR motion (press = occupied)" } },
    { "type": "wokwi-resistor", "id": "r_pir_pulldown", "top": -40, "left": -190, "attrs": { "value": "10000" } },

    { "type": "wokwi-potentiometer", "id": "acs712_fan_sim", "top": 20, "left": -260, "attrs": { "label": "ACS712 #1 stand-in (fan bank amps)" } },
    { "type": "wokwi-potentiometer", "id": "acs712_light_sim", "top": 80, "left": -260, "attrs": { "label": "ACS712 #2 stand-in (light bank amps)" } },

    { "type": "wokwi-led", "id": "fan1_led", "top": -180, "left": 420, "attrs": { "color": "cyan", "label": "Fan 1" } },
    { "type": "wokwi-resistor", "id": "r_fan1", "top": -180, "left": 370, "attrs": { "value": "220" } },

    { "type": "wokwi-led", "id": "fan2_led", "top": -140, "left": 420, "attrs": { "color": "cyan", "label": "Fan 2" } },
    { "type": "wokwi-resistor", "id": "r_fan2", "top": -140, "left": 370, "attrs": { "value": "220" } },

    { "type": "wokwi-led", "id": "light1_led", "top": -100, "left": 420, "attrs": { "color": "yellow", "label": "Light 1" } },
    { "type": "wokwi-resistor", "id": "r_light1", "top": -100, "left": 370, "attrs": { "value": "220" } },

    { "type": "wokwi-led", "id": "light2_led", "top": -60, "left": 420, "attrs": { "color": "yellow", "label": "Light 2" } },
    { "type": "wokwi-resistor", "id": "r_light2", "top": -60, "left": 370, "attrs": { "value": "220" } },

    { "type": "wokwi-led", "id": "light3_led", "top": -20, "left": 420, "attrs": { "color": "yellow", "label": "Light 3" } },
    { "type": "wokwi-resistor", "id": "r_light3", "top": -20, "left": 370, "attrs": { "value": "220" } },

    { "type": "wokwi-led", "id": "status_led", "top": 60, "left": 420, "attrs": { "color": "green", "label": "Link status" } },
    { "type": "wokwi-resistor", "id": "r_status", "top": 60, "left": 370, "attrs": { "value": "220" } },

    { "type": "wokwi-buzzer", "id": "buzzer", "top": 120, "left": 420, "attrs": {} }
  ],
  "connections": [
    ["dht22:VCC", "esp:3V3", "red", ["v0"]],
    ["dht22:GND", "esp:GND.1", "black", ["v0"]],
    ["dht22:SDA", "esp:4", "green", ["v0"]],
    ["dht22:SDA", "r_dht_pullup:1", "green", ["v0"]],
    ["r_dht_pullup:2", "esp:3V3", "red", ["v0"]],

    ["mq135_sim:VCC", "esp:3V3", "red", ["v0"]],
    ["mq135_sim:GND", "esp:GND.1", "black", ["v0"]],
    ["mq135_sim:SIG", "esp:34", "orange", ["v0"]],

    ["flame_sim:VCC", "esp:3V3", "red", ["v0"]],
    ["flame_sim:GND", "esp:GND.1", "black", ["v0"]],
    ["flame_sim:SIG", "esp:35", "orange", ["v0"]],

    ["pir_sim:1.l", "esp:3V3", "red", ["v0"]],
    ["pir_sim:2.l", "esp:27", "blue", ["v0"]],
    ["pir_sim:2.l", "r_pir_pulldown:1", "blue", ["v0"]],
    ["r_pir_pulldown:2", "esp:GND.1", "black", ["v0"]],

    ["acs712_fan_sim:VCC", "esp:3V3", "red", ["v0"]],
    ["acs712_fan_sim:GND", "esp:GND.2", "black", ["v0"]],
    ["acs712_fan_sim:SIG", "esp:32", "orange", ["v0"]],

    ["acs712_light_sim:VCC", "esp:3V3", "red", ["v0"]],
    ["acs712_light_sim:GND", "esp:GND.2", "black", ["v0"]],
    ["acs712_light_sim:SIG", "esp:33", "orange", ["v0"]],

    ["esp:25", "r_fan1:1", "green", ["v0"]],
    ["r_fan1:2", "fan1_led:A", "green", ["v0"]],
    ["fan1_led:C", "esp:GND.1", "black", ["v0"]],

    ["esp:25", "r_fan2:1", "green", ["v0"]],
    ["r_fan2:2", "fan2_led:A", "green", ["v0"]],
    ["fan2_led:C", "esp:GND.1", "black", ["v0"]],

    ["esp:26", "r_light1:1", "yellow", ["v0"]],
    ["r_light1:2", "light1_led:A", "yellow", ["v0"]],
    ["light1_led:C", "esp:GND.1", "black", ["v0"]],

    ["esp:26", "r_light2:1", "yellow", ["v0"]],
    ["r_light2:2", "light2_led:A", "yellow", ["v0"]],
    ["light2_led:C", "esp:GND.1", "black", ["v0"]],

    ["esp:26", "r_light3:1", "yellow", ["v0"]],
    ["r_light3:2", "light3_led:A", "yellow", ["v0"]],
    ["light3_led:C", "esp:GND.1", "black", ["v0"]],

    ["esp:2", "r_status:1", "green", ["v0"]],
    ["r_status:2", "status_led:A", "green", ["v0"]],
    ["status_led:C", "esp:GND.1", "black", ["v0"]],

    ["esp:13", "buzzer:1", "purple", ["v0"]],
    ["buzzer:2", "esp:GND.1", "black", ["v0"]]
  ]
}
```
