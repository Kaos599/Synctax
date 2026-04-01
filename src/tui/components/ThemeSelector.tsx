import React from "react";
import { Box, Text, useInput } from "ink";
import { Select } from "@inkjs/ui";
import { colors, chars, getAvailableThemes } from "../theme.js";

export interface ThemeSelectorProps {
  currentTheme: string;
  onSelect: (name: string) => void;
  onCancel: () => void;
}

const THEME_DESCRIPTIONS: Record<string, string> = {
  synctax:       "Signature purple & cyan",
  catppuccin:    "Catppuccin Mocha — soft pastels",
  dracula:       "Dracula — purple, pink & cyan",
  nord:          "Nord — arctic frost blues",
  "tokyo-night": "Tokyo Night — neon cityscape",
  gruvbox:       "Gruvbox — warm retro earth tones",
  "one-dark":    "One Dark — Atom editor classic",
  solarized:     "Solarized Dark — precision blues",
  "rose-pine":   "Rose Pine — muted elegance",
  monokai:       "Monokai — vivid syntax colors",
  cyberpunk:     "Cyberpunk — neon magenta & cyan",
  sunset:        "Sunset — warm coral & lavender",
  ocean:         "Ocean — deep sea gradients",
  forest:        "Forest — earthy greens & browns",
  ember:         "Ember — smoldering orange & teal",
  aurora:        "Aurora — electric violet & aqua",
};

export function ThemeSelector({ currentTheme, onSelect, onCancel }: ThemeSelectorProps) {
  const themeNames = getAvailableThemes();

  const options = themeNames.map((name) => ({
    label: name === currentTheme
      ? `${name.padEnd(14)} ${chars.check} active   ${THEME_DESCRIPTIONS[name] ?? ""}`
      : `${name.padEnd(14)}            ${THEME_DESCRIPTIONS[name] ?? ""}`,
    value: name,
  }));

  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      <Box marginBottom={1}>
        <Text color={colors.brand} bold>
          {chars.diamond} Select Theme
        </Text>
        <Text color={colors.textMuted}>  ({themeNames.length} available)</Text>
        <Box flexGrow={1} />
        <Text color={colors.textMuted}>
          <Text color={colors.hotkey}>Esc</Text> to cancel
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color={colors.textSecondary}>
          Current: <Text color={colors.info} bold>{currentTheme}</Text>
          <Text color={colors.textMuted}> — {THEME_DESCRIPTIONS[currentTheme] ?? ""}</Text>
        </Text>
      </Box>

      <Box flexDirection="column" borderStyle="single" borderColor={colors.border} paddingX={1}>
        <Select
          options={options}
          defaultValue={currentTheme}
          visibleOptionCount={16}
          onChange={(value) => {
            onSelect(value);
          }}
        />
      </Box>

      <Box marginTop={1}>
        <Text color={colors.textMuted}>
          <Text color={colors.hotkey}>Enter</Text> to apply {chars.dot}{" "}
          <Text color={colors.hotkey}>Esc</Text> to cancel {chars.dot}{" "}
          Theme takes effect immediately
        </Text>
      </Box>
    </Box>
  );
}
