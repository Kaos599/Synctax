import { semantic, symbols } from "./colors.js";

const INDENT = "  ";

export interface OutputOptions {
  indent?: number;
  prefix?: string;
}

/** Format functions — return styled strings without printing */
export const format = {
  success(msg: string, opts?: OutputOptions): string {
    const prefix = opts?.prefix ?? symbols.success;
    const indent = INDENT.repeat(opts?.indent ?? 0);
    return `${indent}${semantic.success(`${prefix} ${msg}`)}`;
  },

  error(msg: string, opts?: OutputOptions): string {
    const prefix = opts?.prefix ?? symbols.error;
    const indent = INDENT.repeat(opts?.indent ?? 0);
    return `${indent}${semantic.error(`${prefix} ${msg}`)}`;
  },

  warn(msg: string, opts?: OutputOptions): string {
    const prefix = opts?.prefix ?? symbols.warning;
    const indent = INDENT.repeat(opts?.indent ?? 0);
    return `${indent}${semantic.warning(`${prefix} ${msg}`)}`;
  },

  info(msg: string, opts?: OutputOptions): string {
    const indent = INDENT.repeat(opts?.indent ?? 0);
    return `${indent}${semantic.info(msg)}`;
  },

  header(msg: string): string {
    return `${semantic.info(msg)}`;
  },

  dim(msg: string, opts?: OutputOptions): string {
    const indent = INDENT.repeat(opts?.indent ?? 0);
    return `${indent}${semantic.muted(msg)}`;
  },

  dryRun(msg: string): string {
    return `${semantic.warning(`[Dry Run] ${msg}`)}`;
  },

  brandHeader(version: string, profile?: string): string {
    const parts = [`${symbols.info} Synctax v${version}`];
    if (profile) parts.push(`${symbols.bullet} Profile: ${profile}`);
    return `\n  ${semantic.muted(parts.join(" "))}\n`;
  },

  summary(elapsed: string, detail: string): string {
    return `\n  Done in ${elapsed} ${symbols.bullet} ${detail}`;
  },
} as const;

/** Print functions — write styled output to stdout via console.log */
export function success(msg: string, opts?: OutputOptions): void {
  console.log(format.success(msg, opts));
}

export function error(msg: string, opts?: OutputOptions): void {
  console.log(format.error(msg, opts));
}

export function warn(msg: string, opts?: OutputOptions): void {
  console.log(format.warn(msg, opts));
}

export function info(msg: string, opts?: OutputOptions): void {
  console.log(format.info(msg, opts));
}

export function header(msg: string): void {
  console.log(format.header(msg));
}

export function dim(msg: string, opts?: OutputOptions): void {
  console.log(format.dim(msg, opts));
}

export function dryRun(msg: string): void {
  console.log(format.dryRun(msg));
}

export function gap(): void {
  console.log();
}
