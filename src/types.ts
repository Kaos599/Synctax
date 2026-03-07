import { z } from "zod";

export const McpServerSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  transport: z.enum(["stdio", "sse", "http"]).optional(),
  scope: z.enum(["global", "local"]).optional(),
});

export type McpServer = z.infer<typeof McpServerSchema>;

export const ConfigSchema = z.object({
  version: z.number().default(1),
  source: z.string().optional(),
  clients: z.record(z.string(), z.object({
    enabled: z.boolean(),
    configPath: z.string().optional(),
  })).default({}),
  resources: z.object({
    mcps: z.record(z.string(), McpServerSchema).default({}),
  }).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface ClientAdapter {
  id: string;
  name: string;
  detect(): Promise<boolean>;
  read(): Promise<Record<string, McpServer>>;
  write(mcps: Record<string, McpServer>): Promise<void>;
}
