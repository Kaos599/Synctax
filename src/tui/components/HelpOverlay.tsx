import React from "react";
import { Box, Text } from "ink";
import { colors, chars, palette } from "../theme.js";
import { TUI_ACTIONS } from "../actions.js";

function HelpRow({ keys, description }: { keys: string; description: string }) {
  return (
    <Box>
      <Box width={16}>
        <Text color={colors.hotkey} bold>
          {keys}
        </Text>
      </Box>
      <Text color={colors.textSecondary}>{description}</Text>
    </Box>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Box marginTop={1} marginBottom={0}>
      <Text color={colors.brand} bold>
        {chars.diamond} {title}
      </Text>
    </Box>
  );
}

export function HelpView() {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      <Box marginBottom={1}>
        <Text color={palette.accent} bold>
          {chars.diamond} Keyboard Reference
        </Text>
        <Box flexGrow={1} />
        <Text color={colors.textMuted}>
          <Text color={colors.hotkey} bold>Esc</Text> to close
        </Text>
      </Box>

      <SectionTitle title="Navigation" />
      <HelpRow keys="Esc" description="Go back from any view to dashboard" />
      <HelpRow keys="/" description="Open command palette — search and run any command" />
      <HelpRow keys="Tab / S-Tab" description="Cycle focus between dashboard panels" />
      <HelpRow keys="h  or  ?" description="Toggle this help view" />
      <HelpRow keys="q  or  Ctrl-C" description="Quit Synctax" />

      <SectionTitle title="Settings" />
      <HelpRow keys="s" description="Change source adapter" />
      <HelpRow keys="t" description="Change color theme" />

      <SectionTitle title="Quick Actions" />
      {TUI_ACTIONS.filter((a) => /^[0-9]$/.test(a.hotkey)).map((a) => (
        <HelpRow key={a.id} keys={a.hotkey} description={`${a.label} — ${a.commandPreview}`} />
      ))}

      <SectionTitle title="Confirmation" />
      <HelpRow keys="Enter  or  y" description="Confirm and execute the selected action" />
      <HelpRow keys="Esc  or  n" description="Cancel — return to dashboard" />

      <SectionTitle title="During Execution" />
      <HelpRow keys="q" description="Quit (action completes in background)" />
      <HelpRow keys="any key" description="After completion, return to dashboard" />
    </Box>
  );
}
