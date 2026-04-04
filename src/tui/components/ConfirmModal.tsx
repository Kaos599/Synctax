import React from "react";
import { Box, Text } from "ink";
import { colors, chars, palette } from "../theme.js";
import type { TuiPendingAction } from "../ink-types.js";

export interface ConfirmViewProps {
  action: TuiPendingAction;
  enabledClients: number;
  resourceCounts: { mcps: number; agents: number; skills: number };
}

export function ConfirmView({ action, enabledClients, resourceCounts }: ConfirmViewProps) {
  const riskColor = action.confirmRisk === "medium" ? colors.warning : colors.success;
  const borderColor = action.confirmRisk === "medium" ? colors.warning : colors.success;
  const affectedLabel = action.confirmRisk === "low" ? "will check" : "will update";
  const { mcps, agents, skills } = resourceCounts;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1} justifyContent="center">
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor={borderColor}
        paddingX={3}
        paddingY={1}
        alignSelf="center"
        minWidth={54}
      >
        {/* Title */}
        <Box marginBottom={1}>
          <Text color={colors.warning} bold>
            {chars.warning_sign} Confirm Action
          </Text>
        </Box>

        {/* Question */}
        <Box marginBottom={1}>
          <Text color={colors.text} bold>
            {action.confirmTitle}
          </Text>
        </Box>

        {/* Description */}
        <Box marginBottom={1} flexDirection="row">
          <Text color={colors.border}>│ </Text>
          <Text color={colors.textMuted}>{action.description}</Text>
        </Box>

        {/* Affected preview */}
        <Box marginBottom={1} flexDirection="column">
          <Box flexDirection="row">
            <Text color={colors.textSecondary}>{affectedLabel}  </Text>
            <Text color={colors.brand} bold>{chars.filledCircle} {enabledClients} client{enabledClients !== 1 ? "s" : ""}</Text>
          </Box>
          <Box paddingLeft={12}>
            <Text color={colors.textMuted}>
              {mcps} MCP{mcps !== 1 ? "s" : ""} {chars.dot} {agents} agent{agents !== 1 ? "s" : ""} {chars.dot} {skills} skill{skills !== 1 ? "s" : ""}
            </Text>
          </Box>
        </Box>

        {/* Details */}
        <Box flexDirection="column" marginBottom={1}>
          <Box flexDirection="row">
            <Text color={colors.textSecondary}>command  </Text>
            <Text color={colors.info} bold>{action.commandPreview}</Text>
          </Box>
          <Box flexDirection="row">
            <Text color={colors.textSecondary}>risk     </Text>
            <Text color={riskColor} bold>{action.confirmRisk}</Text>
          </Box>
        </Box>

        {/* Hint */}
        {action.hint ? (
          <Box marginBottom={1}>
            <Text color={colors.textMuted} italic>💡 {action.hint}</Text>
          </Box>
        ) : null}

        {/* Divider */}
        <Box marginBottom={1}>
          <Text color={colors.border} wrap="truncate">{"─".repeat(48)}</Text>
        </Box>

        {/* Actions */}
        <Box gap={3}>
          <Box>
            <Text color={colors.success} bold>[Enter/y]</Text>
            <Text color={colors.textSecondary}> Run</Text>
          </Box>
          <Box>
            <Text color={colors.error} bold>[Esc/n]</Text>
            <Text color={colors.textSecondary}> Cancel</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
