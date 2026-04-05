import type { ConfigScope } from "./platform-paths.js";
import type { ResourceScope } from "./types.js";

export function toConfigScope(scope?: ResourceScope): ConfigScope {
  if (scope === "local") return "local";
  if (scope === "project") return "project";
  if (scope === "user") return "user";
  return "global";
}

export function splitByScope<T extends { scope?: ResourceScope }>(
  records?: Record<string, T> | null
): {
  local: Record<string, T>;
  project: Record<string, T>;
  user: Record<string, T>;
  global: Record<string, T>;
} {
  const local: Record<string, T> = {};
  const project: Record<string, T> = {};
  const user: Record<string, T> = {};
  const global: Record<string, T> = {};
  if (!records) return { local, project, user, global };

  for (const [name, item] of Object.entries(records)) {
    const scope = toConfigScope(item.scope);
    if (scope === "local") {
      local[name] = item;
    } else if (scope === "project") {
      project[name] = item;
    } else if (scope === "user") {
      user[name] = item;
    } else {
      global[name] = item;
    }
  }

  return { local, project, user, global };
}
