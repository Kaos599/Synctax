import * as ui from "../ui/index.js";
import { adapters } from "../adapters/index.js";
import { getConfigManager } from "./_shared.js";
import { getVersion } from "../version.js";

type DomainKey = "mcps" | "agents" | "skills";

type DomainDiff = {
  add: string[];
  remove: string[];
  modify: string[];
};

type ClientDiff = {
  id: string;
  name: string;
  domains: Record<DomainKey, DomainDiff>;
};

function normalizeComparable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeComparable(item));
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};

    for (const key of Object.keys(obj).sort()) {
      if (key === "scope") continue;
      normalized[key] = normalizeComparable(obj[key]);
    }

    return normalized;
  }

  return value;
}

function isEqualResource(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeComparable(a)) === JSON.stringify(normalizeComparable(b));
}

function sortedKeys(record: Record<string, unknown> | undefined): string[] {
  return Object.keys(record || {}).sort((a, b) => a.localeCompare(b));
}

function compareDomain(master: Record<string, unknown>, client: Record<string, unknown>): DomainDiff {
  const add: string[] = [];
  const remove: string[] = [];
  const modify: string[] = [];

  const masterKeys = sortedKeys(master);
  const clientKeys = sortedKeys(client);
  const clientKeySet = new Set(clientKeys);
  const masterKeySet = new Set(masterKeys);

  for (const key of masterKeys) {
    if (!clientKeySet.has(key)) {
      add.push(key);
      continue;
    }

    if (!isEqualResource(master[key], client[key])) {
      modify.push(key);
    }
  }

  for (const key of clientKeys) {
    if (!masterKeySet.has(key)) {
      remove.push(key);
    }
  }

  return { add, remove, modify };
}

function renderClientDiff(diff: ClientDiff): void {
  const domains: Array<{ key: DomainKey; label: string }> = [
    { key: "mcps", label: "MCPs" },
    { key: "agents", label: "Agents" },
    { key: "skills", label: "Skills" },
  ];

  console.log(`\n${diff.name} (${diff.id})`);

  for (const { key, label } of domains) {
    const domainDiff = diff.domains[key];
    console.log(`  ${label}: +${domainDiff.add.length} -${domainDiff.remove.length} ~${domainDiff.modify.length}`);
    if (domainDiff.add.length > 0) {
      console.log(`    + ${domainDiff.add.join(", ")}`);
    }
    if (domainDiff.remove.length > 0) {
      console.log(`    - ${domainDiff.remove.join(", ")}`);
    }
    if (domainDiff.modify.length > 0) {
      console.log(`    ~ ${domainDiff.modify.join(", ")}`);
    }
  }
}

export async function diffCommand(clientId?: string, options?: { json?: boolean }) {
  const timer = ui.startTimer();
  const configManager = getConfigManager();
  const config = await configManager.read();

  const targetClientIds = clientId
    ? [clientId]
    : Object.keys(config.clients)
        .filter((id) => config.clients[id]?.enabled)
        .sort((a, b) => a.localeCompare(b));

  if (!options?.json) {
    console.log(ui.format.brandHeader(getVersion(), config.activeProfile));
    ui.header("Comparing master config with client configs...");
  }

  const clientDiffs: ClientDiff[] = [];
  const readErrors: Array<{ id: string; message: string }> = [];

  for (const id of targetClientIds) {
    const adapter = adapters[id];
    if (!adapter) {
      readErrors.push({ id, message: `Unknown client: ${id}` });
      continue;
    }

    try {
      const data = await adapter.read();
      clientDiffs.push({
        id,
        name: adapter.name,
        domains: {
          mcps: compareDomain(config.resources.mcps || {}, data.mcps || {}),
          agents: compareDomain(config.resources.agents || {}, data.agents || {}),
          skills: compareDomain(config.resources.skills || {}, data.skills || {}),
        },
      });
    } catch (error: any) {
      readErrors.push({ id, message: error?.message || String(error) });
    }
  }

  clientDiffs.sort((a, b) => a.id.localeCompare(b.id));

  if (options?.json) {
    console.log(
      JSON.stringify(
        {
          activeProfile: config.activeProfile,
          clients: clientDiffs,
          errors: readErrors,
        },
        null,
        2,
      ),
    );
    if (readErrors.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (targetClientIds.length === 0) {
    ui.warn("No enabled clients to diff.");
    console.log(ui.format.summary(timer.elapsed(), "0 clients compared"));
    return;
  }

  for (const diff of clientDiffs) {
    renderClientDiff(diff);
  }

  if (readErrors.length > 0) {
    for (const issue of readErrors) {
      ui.error(`${issue.id}: ${issue.message}`);
    }
    process.exitCode = 1;
  }

  console.log(ui.format.summary(timer.elapsed(), `${clientDiffs.length} client${clientDiffs.length === 1 ? "" : "s"} compared`));
}
