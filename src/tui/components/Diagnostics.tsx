import React from "react";
import { Box, Text } from "ink";
import { colors, chars } from "../theme.js";
import { Panel } from "./Panel.js";

export interface DiagnosticsProps {
  warnings: string[];
  focused?: boolean;
}

export function Diagnostics({ warnings, focused }: DiagnosticsProps) {
  if (warnings.length === 0) {
    return (
      <Panel title="Diagnostics" focused={focused}>
        <Box>
          <Text color={colors.success}>
            {chars.check} No blocking alerts
          </Text>
        </Box>
        <Box>
          <Text color={colors.textMuted}>
            Run <Text color={colors.info}>doctor --deep</Text> for full checks
          </Text>
        </Box>
      </Panel>
    );
  }

  return (
    <Panel title="Diagnostics" focused={focused} accent={colors.warning}>
      {warnings.slice(0, 5).map((w, i) => (
        <Box key={i}>
          <Text color={colors.warning}>{chars.warning_sign} </Text>
          <Text color={colors.text}>{w}</Text>
        </Box>
      ))}
      {warnings.length > 5 && (
        <Text color={colors.textMuted}>
          +{warnings.length - 5} more...
        </Text>
      )}
    </Panel>
  );
}
