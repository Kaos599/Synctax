import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput } from "@inkjs/ui";
import { colors, chars } from "../theme.js";
import { getAllActions, type TuiAction } from "../actions.js";

export interface CommandPaletteProps {
  onSelect: (action: TuiAction) => void;
  onCancel: () => void;
}

export function CommandPalette({ onSelect, onCancel }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const allActions = getAllActions();

  const filtered = query.length === 0
    ? allActions
    : allActions.filter((a) =>
      a.label.toLowerCase().includes(query.toLowerCase())
      || a.commandPreview.toLowerCase().includes(query.toLowerCase())
      || a.id.toLowerCase().includes(query.toLowerCase()),
    );

  // Handle Esc/q to close — must be inside this component since the
  // parent App disables its useInput when palette mode is active.
  useInput((input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      {/* Title */}
      <Box marginBottom={1}>
        <Text color={colors.brand} bold>
          {chars.diamond} Command Palette
        </Text>
        <Box flexGrow={1} />
        <Text color={colors.textMuted}>
          <Text color={colors.hotkey}>Esc</Text> to close
        </Text>
      </Box>

      {/* Search input */}
      <Box marginBottom={1}>
        <Text color={colors.info} bold>{chars.arrow} </Text>
        <TextInput
          placeholder="Search commands..."
          onChange={setQuery}
          onSubmit={() => {
            if (filtered.length > 0 && filtered[0]) {
              onSelect(filtered[0]);
            }
          }}
        />
      </Box>

      {/* Results */}
      <Box flexDirection="column" borderStyle="single" borderColor={colors.border} paddingX={1}>
        {filtered.length === 0 ? (
          <Text color={colors.textMuted}>No matching commands</Text>
        ) : (
          filtered.slice(0, 12).map((action, i) => (
            <Box key={action.id}>
              <Box width={4}>
                <Text color={i === 0 ? colors.info : colors.textMuted}>
                  {i === 0 ? chars.arrow : " "}
                </Text>
                <Text color={colors.hotkey}>[{action.hotkey}]</Text>
              </Box>
              <Box width={14}>
                <Text color={i === 0 ? colors.text : colors.textSecondary} bold={i === 0}>
                  {" "}{action.label}
                </Text>
              </Box>
              <Text color={colors.textMuted}>{action.commandPreview}</Text>
            </Box>
          ))
        )}
      </Box>

      <Box marginTop={1}>
        <Text color={colors.textMuted}>
          <Text color={colors.hotkey}>Enter</Text> to confirm first match {chars.dot}{" "}
          <Text color={colors.hotkey}>Esc</Text> to close
        </Text>
      </Box>
    </Box>
  );
}
