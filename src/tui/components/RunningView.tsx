import React from "react";
import { Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import { colors, chars } from "../theme.js";

export interface RunningViewProps {
  actionLabel: string;
  output: string[];
}

export function RunningView({ actionLabel, output }: RunningViewProps) {
  const visibleOutput = output.slice(-8);

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      <Box gap={1} marginBottom={1}>
        <Spinner type="dots" />
        <Text color={colors.info} bold>
          Running {actionLabel}...
        </Text>
      </Box>

      {visibleOutput.length > 0 && (
        <Box flexDirection="column" borderStyle="single" borderColor={colors.border} paddingX={1}>
          {visibleOutput.map((line, i) => (
            <Text key={i} color={colors.textSecondary} wrap="truncate">
              {line}
            </Text>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={colors.textMuted}>
          Press <Text color={colors.hotkey} bold>q</Text> to quit
        </Text>
      </Box>
    </Box>
  );
}

export interface ResultViewProps {
  actionLabel: string;
  ok: boolean;
  elapsedMs: number;
  error?: string;
  output: string[];
}

export function ResultView({ actionLabel, ok, elapsedMs, error, output }: ResultViewProps) {
  const lastOutput = output.slice(-4);
  const icon = ok ? chars.check : chars.cross_mark;
  const statusColor = ok ? colors.success : colors.error;
  const statusText = ok ? "completed successfully" : "failed";

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      <Box gap={1} marginBottom={1}>
        <Text color={statusColor} bold>
          {icon} {actionLabel} {statusText}
        </Text>
        <Text color={colors.textMuted}>
          ({elapsedMs}ms)
        </Text>
      </Box>

      {error && (
        <Box>
          <Text color={colors.error}>
            {chars.arrow} {error}
          </Text>
        </Box>
      )}

      {lastOutput.length > 0 && (
        <Box flexDirection="column" borderStyle="single" borderColor={colors.border} paddingX={1} marginTop={1}>
          {lastOutput.map((line, i) => (
            <Text key={i} color={colors.textSecondary} wrap="truncate">
              {line}
            </Text>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={colors.textMuted}>
          Press any key to return to dashboard, <Text color={colors.hotkey} bold>q</Text> to quit
        </Text>
      </Box>
    </Box>
  );
}
