import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { colors, chars } from "../theme.js";
import type { TuiMode } from "../ink-types.js";

export interface StatusBarProps {
  mode: TuiMode;
  statusLine: string;
}

function ModeIndicator({ mode }: { mode: TuiMode }) {
  const modeConfig: Record<TuiMode, { label: string; color: string }> = {
    dashboard: { label: "READY", color: colors.success },
    confirm: { label: "CONFIRM", color: colors.warning },
    running: { label: "RUNNING", color: colors.info },
    result: { label: "DONE", color: colors.success },
    help: { label: "HELP", color: colors.brand },
    palette: { label: "SEARCH", color: colors.info },
    source: { label: "SOURCE", color: colors.brand },
    theme: { label: "THEME", color: colors.brandBright },
    "profile-pick": { label: "PROFILE", color: colors.brand },
    "remove-pick": { label: "REMOVE", color: colors.warning },
  };

  const cfg = modeConfig[mode];
  return (
    <Text color={cfg.color} bold>
      {chars.filledCircle} {cfg.label}
    </Text>
  );
}

export function StatusBar({ mode, statusLine }: StatusBarProps) {
  const isSubView = mode !== "dashboard";
  const [time, setTime] = useState("");

  useEffect(() => {
    if (process.platform === "win32") {
      setTime("");
      return;
    }

    setTime(new Date().toLocaleTimeString());
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Box paddingX={1} justifyContent="space-between">
      <Box>
        <ModeIndicator mode={mode} />
        <Text color={colors.textMuted}> {chars.vertical} </Text>
        <Text color={colors.textSecondary}>{statusLine}</Text>
      </Box>
      <Box gap={1}>
        {mode === "dashboard" && (
          <>
            <Text color={colors.textMuted}>
              <Text color={colors.hotkey}>[/]</Text> palette
            </Text>
            <Text color={colors.textMuted}>
              <Text color={colors.hotkey}>[h]</Text> help
            </Text>
          </>
        )}
        {isSubView && mode !== "running" && (
          <Text color={colors.textMuted}>
            <Text color={colors.hotkey}>[Esc]</Text> back
          </Text>
        )}
        <Text color={colors.textMuted}>
          <Text color={colors.hotkey}>[q]</Text> quit
        </Text>
        {!!time && <Text color={colors.textMuted}>{time}</Text>}
      </Box>
    </Box>
  );
}
