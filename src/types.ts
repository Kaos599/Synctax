import { z } from "zod";

export const ResourceScopeSchema = z.enum(["global", "user", "project", "local"]);
export type ResourceScope = z.infer<typeof ResourceScopeSchema>;

export const McpServerSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  transport: z.enum(["stdio", "sse", "http"]).optional(),
  scope: ResourceScopeSchema.optional(),
  // v2: Remote MCP support
  url: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  // v2: Operational fields
  cwd: z.string().optional(),
  timeout: z.number().optional(),
  disabled: z.boolean().optional(),
});
export type McpServer = z.infer<typeof McpServerSchema>;

export const AgentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  prompt: z.string(),
  model: z.string().optional(),
  tools: z.array(z.string()).optional(),
  scope: ResourceScopeSchema.optional(),
  // v2: Extended agent capabilities
  disallowedTools: z.array(z.string()).optional(),
  permissionMode: z.string().optional(),
  maxTurns: z.number().optional(),
  mcpServers: z.union([z.array(z.string()), z.record(z.string(), z.unknown())]).optional(),
  hooks: z.record(z.string(), z.unknown()).optional(),
  memory: z.array(z.string()).optional(),
  background: z.boolean().optional(),
  effort: z.string().optional(),
  isolation: z.boolean().optional(),
  userInvocable: z.boolean().optional(),
});
export type Agent = z.infer<typeof AgentSchema>;

export const SkillSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  trigger: z.string().optional(),
  content: z.string(),
  scope: ResourceScopeSchema.optional(),
  // v2: Extended skill capabilities
  argumentHint: z.string().optional(),
  disableModelInvocation: z.boolean().optional(),
  userInvocable: z.boolean().optional(),
  allowedTools: z.array(z.string()).optional(),
  model: z.string().optional(),
  effort: z.string().optional(),
  context: z.array(z.string()).optional(),
  agent: z.string().optional(),
  hooks: z.record(z.string(), z.unknown()).optional(),
});
export type Skill = z.infer<typeof SkillSchema>;

export const PermissionsSchema = z.object({
  // Legacy fields (backward compat with existing configs)
  allowedPaths: z.array(z.string()).default([]),
  deniedPaths: z.array(z.string()).default([]),
  allowedCommands: z.array(z.string()).default([]),
  deniedCommands: z.array(z.string()).default([]),
  networkAllow: z.boolean().default(false),
  // v2: Claude-style unified permissions — Tool(specifier) syntax
  allow: z.array(z.string()).default([]),
  deny: z.array(z.string()).default([]),
  ask: z.array(z.string()).default([]),
  // v2: Copilot CLI-style URL permissions
  allowedUrls: z.array(z.string()).default([]),
  deniedUrls: z.array(z.string()).default([]),
  trustedFolders: z.array(z.string()).default([]),
});
export type Permissions = z.infer<typeof PermissionsSchema>;

export const CredentialsSchema = z.object({
  envRefs: z.record(z.string(), z.string()).default({}),
});
export type Credentials = z.infer<typeof CredentialsSchema>;

export const ModelsSchema = z.object({
  defaultModel: z.string().optional(),
});
export type Models = z.infer<typeof ModelsSchema>;

export const PromptsSchema = z.object({
  globalSystemPrompt: z.string().optional(),
});
export type Prompts = z.infer<typeof PromptsSchema>;

export const ProfileSchema = z.object({
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  extends: z.string().optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ConfigSchema = z.object({
  version: z.number().default(1),
  source: z.string().optional(),
  theme: z.string().default("rebel"),
  activeProfile: z.string().default("default"),
  clients: z.record(z.string(), z.object({
    enabled: z.boolean(),
    configPath: z.string().optional(),
  })).default({}),
  profiles: z.record(z.string(), ProfileSchema).default({
    default: {}
  }),
  resources: z.object({
    mcps: z.record(z.string(), McpServerSchema).default({}),
    agents: z.record(z.string(), AgentSchema).default({}),
    skills: z.record(z.string(), SkillSchema).default({}),
    permissions: PermissionsSchema.default({}),
    models: ModelsSchema.optional(),
    prompts: PromptsSchema.optional(),
    credentials: CredentialsSchema.optional(),
  }).default({}),
});
export type Config = z.infer<typeof ConfigSchema>;

export interface ClientAdapter {
  id: string;
  name: string;
  detect(): Promise<boolean>;
  read(): Promise<{
    mcps: Record<string, McpServer>,
    agents: Record<string, Agent>,
    skills: Record<string, Skill>,
    permissions?: Permissions,
    models?: Models,
    prompts?: Prompts,
    credentials?: Credentials
  }>;
  write(resources: {
    mcps: Record<string, McpServer>,
    agents: Record<string, Agent>,
    skills: Record<string, Skill>,
    permissions?: Permissions,
    models?: Models,
    prompts?: Prompts,
    credentials?: Credentials
  }): Promise<void>;

  // Memory (Context files)
  getMemoryFileName(): string;
  readMemory(projectDir: string): Promise<string | null>;
  writeMemory(projectDir: string, content: string): Promise<void>;
}
