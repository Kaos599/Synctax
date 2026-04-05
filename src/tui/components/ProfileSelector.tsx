import React from "react";
import { Box, Text, useInput } from "ink";
import { Select } from "@inkjs/ui";
import { colors, chars } from "../theme.js";

export interface ProfileSelectorProps {
  profiles: string[];
  activeProfile: string;
  actionLabel: string; // "Switch profile" or "Preview profile diff"
  onSelect: (profileName: string) => void;
  onCancel: () => void;
}

export function ProfileSelector({ profiles, activeProfile, actionLabel, onSelect, onCancel }: ProfileSelectorProps) {
  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  if (profiles.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
        <Box marginBottom={1}>
          <Text color={colors.brand} bold>{chars.diamond} {actionLabel}</Text>
        </Box>
        <Text color={colors.textMuted}>No profiles found. Create one first: synctax profile create &lt;name&gt;</Text>
      </Box>
    );
  }

  const options = profiles.map((name) => ({
    label: name === activeProfile ? `${name}  ${chars.check} active` : name,
    value: name,
  }));

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      <Box marginBottom={1}>
        <Text color={colors.brand} bold>{chars.diamond} {actionLabel}</Text>
        <Box flexGrow={1} />
        <Text color={colors.textMuted}><Text color={colors.hotkey}>Esc</Text> to cancel</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color={colors.textSecondary}>Active profile: <Text color={colors.info} bold>{activeProfile}</Text></Text>
      </Box>
      <Box flexDirection="column" borderStyle="single" borderColor={colors.border} paddingX={1}>
        <Select options={options} defaultValue={activeProfile} visibleOptionCount={10} onChange={(value) => onSelect(value)} />
      </Box>
      <Box marginTop={1}>
        <Text color={colors.textMuted}><Text color={colors.hotkey}>Enter</Text> to select {chars.dot} <Text color={colors.hotkey}>Esc</Text> to cancel</Text>
      </Box>
    </Box>
  );
}
