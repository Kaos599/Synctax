import { runInkTui } from "../src/tui/ink-app.js";

await runInkTui({
  data: {
    version: "2.0.0",
    profile: "default",
    source: "cursor",
    theme: "synctax",
    health: "WARN",
    enabledClients: 4,
    totalClients: 9,
    resourceCounts: { mcps: 12, agents: 3, skills: 8 },
    driftClients: 2,
    lastSync: "2m ago",
    warnings: [
      "zed is enabled but not detected",
      "2 clients are out-of-sync",
      "backup is older than 3 days",
    ],
  },
  executeAction: async (action) => {
    console.log(`[demo] confirmed: ${action.commandPreview}`);
  },
});
