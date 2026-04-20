import React, { useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
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
  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 36;
  // Reserve lines for: status bar header (~3), status line (~1), error (~1 if any),
  // border + padding (~2), scroll hint (~1), nav hint (~1) = ~9 lines of chrome
  const maxVisible = Math.max(4, termHeight - 9);
  const [scrollOffset, setScrollOffset] = useState(0);
  const maxOffset = Math.max(0, output.length - maxVisible);
  const canScrollUp = scrollOffset > 0;
  const canScrollDown = scrollOffset < maxOffset;

  useInput((_input, key) => {
    if (key.upArrow) setScrollOffset((o) => Math.max(0, o - 1));
    if (key.downArrow) setScrollOffset((o) => Math.min(maxOffset, o + 1));
  });

  const visibleOutput = output.slice(scrollOffset, scrollOffset + maxVisible);
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

      {output.length > 0 && (
        <Box flexDirection="column" borderStyle="single" borderColor={colors.border} paddingX={1} marginTop={1}>
          {canScrollUp && (
            <Text color={colors.textMuted} dimColor>
              ↑ {scrollOffset} line{scrollOffset !== 1 ? "s" : ""} above
            </Text>
          )}
          {visibleOutput.map((line, i) => (
            <Text key={i} color={colors.textSecondary} wrap="truncate">
              {line}
            </Text>
          ))}
          {canScrollDown && (
            <Text color={colors.textMuted} dimColor>
              ↓ {maxOffset - scrollOffset} line{maxOffset - scrollOffset !== 1 ? "s" : ""} below
            </Text>
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={colors.textMuted}>
          {output.length > maxVisible
            ? <>Use <Text color={colors.hotkey} bold>↑↓</Text> to scroll · any other key to return · <Text color={colors.hotkey} bold>q</Text> to quit</>
            : <>Press any key to return to dashboard, <Text color={colors.hotkey} bold>q</Text> to quit</>
          }
        </Text>
      </Box>
    </Box>
  );
}
