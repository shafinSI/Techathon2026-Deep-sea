import { state } from "./state.js";

// Single function both REST (GET /devices etc.) and WS (state:snapshot)
// build from, so the two interfaces can never drift out of shape.
export function buildSnapshot() {
  return {
    devices: state.devices.map((d) => ({ ...d })),
    pcs: state.pcs.map((p) => ({ ...p })),
    environment: JSON.parse(JSON.stringify(state.environment)),
    occupancy: { ...state.occupancy },
    automation: JSON.parse(JSON.stringify(state.automation)),
    smokeLevel: { ...state.smokeLevel },
    fireAlert: { ...state.fireAlert },
    settings: JSON.parse(JSON.stringify(state.settings)),
    hardware: JSON.parse(JSON.stringify(state.hardware)),
  };
}
