import React from "react";
import { Box, Text } from "ink";
import { colors, chars } from "../theme.js";

export interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
}

export function Toast({ message, type }: ToastProps) {
  const color = type === "success" ? colors.success : type === "error" ? colors.error : colors.info;
  const icon = type === "success" ? chars.check : type === "error" ? chars.cross_mark : chars.filledCircle;
  return (
    <Box paddingX={2} marginBottom={0}>
      <Text color={color} bold>{icon} {message}</Text>
    </Box>
  );
}
