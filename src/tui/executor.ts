export interface GuardedActionResult {
  actionId: string;
  ok: boolean;
  output: string[];
  elapsedMs: number;
  error?: string;
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

let captureInFlight = false;

export async function runGuardedAction(actionId: string, handler: () => Promise<void>): Promise<GuardedActionResult> {
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
  const startedAt = Date.now();

  console.log = (...args: unknown[]) => {
    output.push(stringifyArgs(args));
  };

  console.error = (...args: unknown[]) => {
    output.push(stringifyArgs(args));
  };

  process.stderr.write = ((chunk: unknown, ...args: unknown[]) => {
    output.push(stringifyChunk(chunk));

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
    captureInFlight = false;
  }
}
