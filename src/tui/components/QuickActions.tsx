import React from "react";
import { Box, Text } from "ink";
import { colors, chars } from "../theme.js";
import { Panel } from "./Panel.js";
import { TUI_ACTIONS } from "../actions.js";

function ActionKey({ hotkey, label, pad }: { hotkey: string; label: string; pad: number }) {
  return (
    <Box width={pad}>
      <Text color={colors.hotkey} bold>[{hotkey}]</Text>
      <Text color={colors.actionLabel}> {label}</Text>
    </Box>
  );
}

export interface QuickActionsProps {
  focused?: boolean;
}

export function QuickActions({ focused }: QuickActionsProps) {
  // Show first 10 numeric actions in a grid (1-9, 0)
  const numericActions = TUI_ACTIONS.filter((a) => /^[0-9!@#]$/.test(a.hotkey));
  const cols = 5;
  const colWidth = 18;
  const rows: typeof numericActions[] = [];
  for (let i = 0; i < numericActions.length; i += cols) {
    rows.push(numericActions.slice(i, i + cols));
  }

  return (
    <Panel title="Quick Actions" focused={focused} accent={colors.info}>
      {rows.map((row, ri) => (
        <Box key={`row-${ri}`}>
          {row.map((a) => (
            <ActionKey key={a.id} hotkey={a.hotkey} label={a.label} pad={colWidth} />
          ))}
        </Box>
      ))}
      <Box marginTop={1} flexDirection="column">
        <Text color={colors.textMuted}>
          {chars.arrow} <Text color={colors.hotkey}>/</Text> palette {chars.dot} <Text color={colors.hotkey}>s</Text> source {chars.dot} <Text color={colors.hotkey}>t</Text> theme {chars.dot} <Text color={colors.hotkey}>h</Text> help {chars.dot} <Text color={colors.hotkey}>Tab</Text> navigate
        </Text>
      </Box>
    </Panel>
  );
}
