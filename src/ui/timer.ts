export interface Timer {
  /** Returns elapsed time in human-readable form: "45ms", "0.3s", "1.2s" */
  elapsed(): string;
  /** Returns raw milliseconds */
  elapsedMs(): number;
}

export function startTimer(): Timer {
  const start = performance.now();

  return {
    elapsed(): string {
      const ms = performance.now() - start;
      if (ms < 1000) return `${Math.round(ms)}ms`;
      return `${(ms / 1000).toFixed(1)}s`;
    },
    elapsedMs(): number {
      return performance.now() - start;
    },
  };
}
