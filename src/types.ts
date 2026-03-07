import { z } from "zod";

export const McpServerSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  transport: z.enum(["stdio", "sse", "http"]).optional(),
  scope: z.enum(["global", "local"]).optional(),
});

export type McpServer = z.infer<typeof McpServerSchema>;

export const AgentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  prompt: z.string(),
  model: z.string().optional(),
  tools: z.array(z.string()).optional(),
  scope: z.enum(["global", "local"]).optional(),
});

export type Agent = z.infer<typeof AgentSchema>;

export const ProfileSchema = z.object({
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  extends: z.string().optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const ConfigSchema = z.object({
  version: z.number().default(1),
  source: z.string().optional(),
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
  }).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface ClientAdapter {
  id: string;
  name: string;
  detect(): Promise<boolean>;
  read(): Promise<{ mcps: Record<string, McpServer>, agents: Record<string, Agent> }>;
  write(resources: { mcps: Record<string, McpServer>, agents: Record<string, Agent> }): Promise<void>;

  // Memory (Context files)
  getMemoryFileName(): string;
  readMemory(projectDir: string): Promise<string | null>;
  writeMemory(projectDir: string, content: string): Promise<void>;
}
