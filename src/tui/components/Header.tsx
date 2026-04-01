import React from "react";
import { Box, Text } from "ink";
import { colors, chars, palette } from "../theme.js";

export interface HeaderProps {
  version: string;
  profile: string;
  source: string;
  health: "OK" | "WARN" | "FAIL";
}

function HealthBadge({ health }: { health: "OK" | "WARN" | "FAIL" }) {
  const color = health === "OK" ? colors.success : health === "WARN" ? colors.warning : colors.error;
  const icon = health === "OK" ? chars.filledCircle : health === "WARN" ? chars.warning_sign : chars.cross_mark;
  return (
    <Text color={color} bold>
      {icon} {health}
    </Text>
  );
}

/**
 * Compact ASCII art wordmark — 3 lines tall, gradient colored.
 * Uses block characters for a chunky, modern look.
 */
const WORDMARK_LINES = [
  " ███████╗██╗   ██╗███╗   ██╗ ██████╗████████╗ █████╗ ██╗  ██╗",
  " ██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝╚══██╔══╝██╔══██╗╚██╗██╔╝",
  " ███████╗ ╚████╔╝ ██╔██╗ ██║██║        ██║   ███████║ ╚███╔╝ ",
  " ╚════██║  ╚██╔╝  ██║╚██╗██║██║        ██║   ██╔══██║ ██╔██╗ ",
  " ███████║   ██║   ██║ ╚████║╚██████╗   ██║   ██║  ██║██╔╝ ██╗",
  " ╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝",
];

function getGradient() {
  return [
    palette.accent,
    palette.brand,
    palette.info,
    palette.accent,
    palette.brand,
    palette.info,
  ];
}

export function Header({ version, profile, source, health }: HeaderProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      {/* ASCII art wordmark */}
      {WORDMARK_LINES.map((line, i) => {
        const gradient = getGradient();
        return (
          <Text key={`wm-${i}`} color={gradient[i % gradient.length]} bold>
            {line}
          </Text>
        );
      })}

      {/* Info line below wordmark */}
      <Box marginTop={0}>
        <Text color={colors.textMuted}>  v{version}</Text>
        <Text color={colors.textMuted}> {chars.dot} </Text>
        <Text color={colors.textSecondary}>Profile </Text>
        <Text color={colors.brand} bold>{profile}</Text>
        <Text color={colors.textMuted}> {chars.dot} </Text>
        <Text color={colors.textSecondary}>Source </Text>
        <Text color={colors.info} bold>{source}</Text>
        <Box flexGrow={1} />
        <HealthBadge health={health} />
      </Box>
    </Box>
  );
}
