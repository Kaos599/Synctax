import { expect } from "vitest";
import type { ClientAdapter, Config, Permissions } from "../src/types.js";

export function expectDefined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  expect(value, message).toBeDefined();
  if (value === undefined || value === null) {
    throw new Error(message);
  }
  return value as NonNullable<T>;
}

export function expectHas<K extends string, T>(
  record: Record<string, T>,
  key: K,
  message?: string,
): asserts record is Record<K, T> & Record<string, T> {
  const value = record[key];
  expect(value, message ?? `Expected key \"${key}\" to exist`).not.toBeNull();
  expect(value, message ?? `Expected key \"${key}\" to exist`).toBeDefined();
  if (value === undefined || value === null) {
    throw new Error(message ?? `Expected key \"${key}\" to exist`);
  }
}

export function createPermissions(overrides: Partial<Permissions> = {}): Permissions {
  return {
    allowedPaths: [],
    deniedPaths: [],
    allowedCommands: [],
    deniedCommands: [],
    networkAllow: false,
    allow: [],
    deny: [],
    ask: [],
    allowedUrls: [],
    deniedUrls: [],
    trustedFolders: [],
    ...overrides,
  };
}

export function createResources(overrides: Partial<Config["resources"]> = {}): Config["resources"] {
  return {
    mcps: overrides.mcps ?? {},
    agents: overrides.agents ?? {},
    skills: overrides.skills ?? {},
    permissions: overrides.permissions ?? createPermissions(),
    models: overrides.models,
    prompts: overrides.prompts,
    credentials: overrides.credentials,
  };
}

export function createConfig(overrides: Partial<Config> = {}): Config {
  return {
    version: overrides.version ?? 1,
    source: overrides.source,
    theme: overrides.theme ?? "rebel",
    activeProfile: overrides.activeProfile ?? "default",
    clients: overrides.clients ?? {},
    profiles: overrides.profiles ?? { default: {} },
    resources: createResources(overrides.resources),
  };
}

type AdapterWriteResources = Parameters<ClientAdapter["write"]>[0];

export function createAdapterWriteResources(
  overrides: Partial<AdapterWriteResources> = {},
): AdapterWriteResources {
  return {
    mcps: overrides.mcps ?? {},
    agents: overrides.agents ?? {},
    skills: overrides.skills ?? {},
    permissions: overrides.permissions,
    models: overrides.models,
    prompts: overrides.prompts,
    credentials: overrides.credentials,
  };
}
