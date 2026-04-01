import React from "react";
import { Box, Text } from "ink";
import { colors, chars } from "../theme.js";

export interface PanelProps {
  title: string;
  focused?: boolean;
  accent?: string;
  width?: number | string;
  children: React.ReactNode;
}

export function Panel({ title, focused = false, accent, width, children }: PanelProps) {
  const borderColor = focused
    ? colors.borderFocus
    : accent ?? colors.border;

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
    >
      <Box marginBottom={0}>
        <Text color={focused ? colors.brandBright : accent ?? colors.textSecondary} bold={focused}>
          {chars.diamond} {title}
        </Text>
      </Box>
      {children}
    </Box>
  );
}
