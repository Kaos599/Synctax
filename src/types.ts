export type Scope = 'builtin' | 'global' | 'profile' | 'client' | 'workspace' | 'runtime';

export interface Agent {
  id: string;
  systemPrompt: string;
  defaultModel?: string;
  skills?: string[];
  allowedTools?: string[];
  runtimeFlags?: Record<string, string | boolean | number>;
  behaviorTags?: string[];
}

export interface Skill {
  id: string;
  promptTemplate: string;
  requiredTools?: string[];
  inputVariables?: string[];
  outputContract?: string;
  tags?: string[];
  compatibleAgents?: string[];
}

export interface McpServer {
  id: string;
  command?: string;
  url?: string;
  transport?: 'stdio' | 'http' | 'sse';
  authEnv?: string;
  timeoutMs?: number;
  retries?: number;
  tags?: string[];
  healthcheck?: string;
  defaultScope?: Scope;
}

export interface PermissionPolicy {
  id: string;
  shell?: 'allow' | 'deny' | 'confirm';
  fileRead?: 'allow' | 'deny' | 'confirm';
  fileWrite?: 'allow' | 'deny' | 'confirm';
  network?: 'allow' | 'deny' | 'confirm';
  git?: 'allow' | 'deny' | 'confirm';
  browserHttp?: 'allow' | 'deny' | 'confirm';
  secretAccess?: 'allow' | 'deny' | 'confirm';
  processExecution?: 'allow' | 'deny' | 'confirm';
  mcpInvocation?: 'allow' | 'deny' | 'confirm';
  locked?: boolean;
}

export interface CommandEntry {
  id: string;
  prompt?: string;
  agent?: string;
  skills?: string[];
  permissionBundle?: string;
  preRunChecks?: string[];
}

export interface Preset {
  id: string;
  description?: string;
  include?: string[];
}

export interface Profile {
  id: string;
  extends?: string[];
  include?: Partial<Record<EntityKind, string[]>>;
  overrides?: Partial<RegistryEntities>;
}

export interface WorkspaceOverrides {
  overrides?: Partial<RegistryEntities>;
}

export interface RegistryEntities {
  agents: Record<string, Agent>;
  skills: Record<string, Skill>;
  mcps: Record<string, McpServer>;
  permissions: Record<string, PermissionPolicy>;
  commands: Record<string, CommandEntry>;
  profiles: Record<string, Profile>;
  presets: Record<string, Preset>;
  workspaceOverrides: Record<string, WorkspaceOverrides>;
}

export interface Registry extends RegistryEntities {
  version: 1;
}

export type EntityKind = keyof RegistryEntities;

export type DiffAction = 'add' | 'remove' | 'change' | 'warn';

export interface DiffEntry {
  entity: EntityKind;
  id: string;
  action: DiffAction;
  before?: unknown;
  after?: unknown;
  message?: string;
}

export interface AdapterCapabilities {
  name: string;
  supports: EntityKind[];
  scopes: Scope[];
  lossyTranslations?: string[];
}

export interface Adapter {
  name: string;
  discover(targetPath: string): Promise<RegistryEntities>;
  validate(targetPath: string): Promise<string[]>;
  diff(targetPath: string, desired: RegistryEntities): Promise<DiffEntry[]>;
  apply(targetPath: string, desired: RegistryEntities): Promise<void>;
  backup(targetPath: string, backupRoot: string): Promise<string>;
  restore(targetPath: string, backupFile: string): Promise<void>;
  capabilities(): AdapterCapabilities;
}
