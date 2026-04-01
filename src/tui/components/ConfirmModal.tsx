import React from "react";
import { Box, Text } from "ink";
import { colors, chars, palette } from "../theme.js";
import type { TuiPendingAction } from "../ink-types.js";

export interface ConfirmViewProps {
  action: TuiPendingAction;
}

/**
 * Full-screen confirmation view — replaces dashboard content entirely.
 * No overlay, no z-index — just a clean dedicated view.
 */
export function ConfirmView({ action }: ConfirmViewProps) {
  const riskColor = action.confirmRisk === "medium" ? colors.warning : colors.success;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1} justifyContent="center">
      {/* Confirm box */}
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor={colors.warning}
        paddingX={3}
        paddingY={1}
        alignSelf="center"
        minWidth={50}
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

        {/* Details */}
        <Box>
          <Text color={colors.textSecondary}>Command  </Text>
          <Text color={colors.info} bold>{action.commandPreview}</Text>
        </Box>
        <Box marginBottom={1}>
          <Text color={colors.textSecondary}>Risk     </Text>
          <Text color={riskColor} bold>{action.confirmRisk}</Text>
        </Box>

        {/* Divider */}
        <Box marginBottom={1}>
          <Text color={colors.border} wrap="truncate">{"─".repeat(44)}</Text>
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
