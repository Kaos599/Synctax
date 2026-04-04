import React from "react";
import { Box, Text, useInput } from "ink";
import { Select } from "@inkjs/ui";
import { colors, chars } from "../theme.js";
import { adapters } from "../../adapters/index.js";

export interface SourceSelectorProps {
  currentSource: string;
  onSelect: (id: string) => void;
  onCancel: () => void;
}

export function SourceSelector({ currentSource, onSelect, onCancel }: SourceSelectorProps) {
  const adapterIds = Object.keys(adapters);

  const options = adapterIds.map((id) => ({
    label: id === currentSource ? `${id}  ${chars.check} current` : id,
    value: id,
  }));

  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      {/* Title */}
      <Box marginBottom={1}>
        <Text color={colors.brand} bold>
          {chars.diamond} Select Source Adapter
        </Text>
        <Box flexGrow={1} />
        <Text color={colors.textMuted}>
          <Text color={colors.hotkey}>Esc</Text> to cancel
        </Text>
      </Box>

      {/* Current source info */}
      <Box marginBottom={1}>
        <Text color={colors.textSecondary}>
          Current source: <Text color={colors.info} bold>{currentSource || "none"}</Text>
        </Text>
      </Box>

      {/* Adapter list */}
      <Box flexDirection="column" borderStyle="single" borderColor={colors.border} paddingX={1}>
        <Select
          options={options}
          defaultValue={currentSource}
          visibleOptionCount={12}
          onChange={(value) => {
            onSelect(value);
          }}
        />
      </Box>

      <Box marginTop={1}>
        <Text color={colors.textMuted}>
          <Text color={colors.hotkey}>Enter</Text> to select {chars.dot}{" "}
          <Text color={colors.hotkey}>Esc</Text> to cancel
        </Text>
      </Box>
    </Box>
  );
}
