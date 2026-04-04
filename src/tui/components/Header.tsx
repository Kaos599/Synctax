import React from "react";
import { Box, Text, useStdout } from "ink";
import { colors, chars, palette } from "../theme.js";
import { REBEL_BANNER_LINES } from "../../banner.js";

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

const WORDMARK_LINES = [
  " ███████╗██╗   ██╗███╗   ██╗ ██████╗████████╗ █████╗ ██╗  ██╗",
  " ██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝╚══██╔══╝██╔══██╗╚██╗██╔╝",
  " ███████╗ ╚████╔╝ ██╔██╗ ██║██║        ██║   ███████║ ╚███╔╝ ",
  " ╚════██║  ╚██╔╝  ██║╚██╗██║██║        ██║   ██╔══██║ ██╔██╗ ",
  " ███████║   ██║   ██║ ╚████║╚██████╗   ██║   ██║  ██║██╔╝ ██╗",
  " ╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝",
];

function getGradient() {
  return [palette.accent, palette.brand, palette.info, palette.accent, palette.brand, palette.info];
}

export function Header({ version, profile, source, health }: HeaderProps) {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 120;
  const rows = stdout?.rows ?? 36;
  const showRebel = cols >= 82 && rows >= 32;

  return (
    <Box flexDirection="column" paddingX={1}>
      {showRebel
        ? REBEL_BANNER_LINES.map((line, i) => (
            <Text key={`rb-${i}`} color={palette.brand} bold>
              {line}
            </Text>
          ))
        : WORDMARK_LINES.map((line, i) => {
            const gradient = getGradient();
            return (
              <Text key={`wm-${i}`} color={gradient[i % gradient.length]} bold>
                {line}
              </Text>
            );
          })}

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
