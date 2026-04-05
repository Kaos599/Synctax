import React from "react";
import { Box, Text } from "ink";
import { colors, chars } from "../theme.js";
import { Panel } from "./Panel.js";

interface FeatureGroup {
  label: string;
  commands: string;
  color: string;
}

const FEATURE_GROUPS: FeatureGroup[] = [
  { label: "Sync", commands: "sync, pull, memory-sync, watch", color: colors.info },
  { label: "Profiles", commands: "create, use, list, diff, publish", color: colors.brand },
  { label: "Safety", commands: "doctor, validate, backup, restore", color: colors.success },
  { label: "Export", commands: "export, import, link, unlink", color: colors.brandBright },
];

export interface FeaturesProps {
  focused?: boolean;
}

export function Features({ focused }: FeaturesProps) {
  return (
    <Panel title="Feature Map" focused={focused}>
      {FEATURE_GROUPS.map((group) => (
        <Box key={group.label} gap={1}>
          <Text color={group.color} bold>
            {chars.arrow} {group.label.padEnd(10)}
          </Text>
          <Text color={colors.textMuted} wrap="truncate">{group.commands}</Text>
        </Box>
      ))}
    </Panel>
  );
}
