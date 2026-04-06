export interface GuardedActionResult {
  actionId: string;
  ok: boolean;
  output: string[];
  elapsedMs: number;
  error?: string;
}

export interface GuardedActionOptions {
  onOutput?: (output: string[]) => void;
}

function stringifyArgs(args: unknown[]): string {
  return args.map((arg) => String(arg)).join(" ");
}

function stringifyChunk(chunk: unknown): string {
  if (typeof chunk === "string") {
    return chunk;
  }
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk).toString("utf8");
  }
  return String(chunk);
}

const ANSI_ESCAPE_REGEX = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const MAX_CAPTURE_LINES = 1000;

function normalizeLines(raw: string): string[] {
  return raw
    .replace(ANSI_ESCAPE_REGEX, "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

let captureInFlight = false;

export async function runGuardedAction(
  actionId: string,
  handler: () => Promise<void>,
  options?: GuardedActionOptions,
): Promise<GuardedActionResult> {
  if (captureInFlight) {
    return {
      actionId,
      ok: false,
      output: [],
      elapsedMs: 0,
      error: "executor busy",
    };
  }

  captureInFlight = true;
  const output: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const previousPlainOutputMode = process.env.SYNCTAX_TUI_PLAIN_OUTPUT;
  const startedAt = Date.now();

  process.env.SYNCTAX_TUI_PLAIN_OUTPUT = "1";

  const emitOutput = (raw: string) => {
    const lines = normalizeLines(raw);
    let changed = false;
    for (const line of lines) {
      if (line === output[output.length - 1]) {
        continue;
      }
      output.push(line);
      if (output.length > MAX_CAPTURE_LINES) {
        output.splice(0, output.length - MAX_CAPTURE_LINES);
      }
      changed = true;
    }
    if (changed) {
      options?.onOutput?.([...output]);
    }
  };

  console.log = (...args: unknown[]) => {
    emitOutput(stringifyArgs(args));
  };

  console.error = (...args: unknown[]) => {
    emitOutput(stringifyArgs(args));
  };

  process.stderr.write = ((chunk: unknown, ...args: unknown[]) => {
    emitOutput(stringifyChunk(chunk));

    const maybeCallback = args.find((arg) => typeof arg === "function");
    if (typeof maybeCallback === "function") {
      (maybeCallback as () => void)();
    }

    return true;
  }) as typeof process.stderr.write;

  try {
    await handler();
    return {
      actionId,
      ok: true,
      output,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error: unknown) {
    return {
      actionId,
      ok: false,
      output,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.stderr.write = originalStderrWrite as typeof process.stderr.write;
    if (previousPlainOutputMode === undefined) {
      delete process.env.SYNCTAX_TUI_PLAIN_OUTPUT;
    } else {
      process.env.SYNCTAX_TUI_PLAIN_OUTPUT = previousPlainOutputMode;
    }
    captureInFlight = false;
  }
}
