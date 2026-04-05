export type DomainKey = "mcps" | "agents" | "skills";

export type DomainDiff = {
  add: string[];
  remove: string[];
  modify: string[];
};

export type ClientDiff = {
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

export function compareDomain(master: Record<string, unknown>, client: Record<string, unknown>): DomainDiff {
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

export function renderClientDiff(diff: ClientDiff): void {
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

export function hasDiffChanges(diff: ClientDiff): boolean {
  return Object.values(diff.domains).some(
    d => d.add.length > 0 || d.remove.length > 0 || d.modify.length > 0
  );
}

export function diffSummaryLine(diff: ClientDiff): string {
  const parts: string[] = [];
  for (const [, d] of Object.entries(diff.domains)) {
    if (d.add.length > 0) parts.push(`+${d.add.length}`);
    if (d.remove.length > 0) parts.push(`-${d.remove.length}`);
    if (d.modify.length > 0) parts.push(`~${d.modify.length}`);
  }
  return parts.length > 0 ? parts.join(" ") : "no changes";
}
