import React from "react";
import { Box, Text } from "ink";
import { colors, chars } from "../theme.js";
import { Panel } from "./Panel.js";
import type { TuiFrameData } from "../ink-types.js";

function StatRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Box>
      <Text color={colors.textSecondary}>{label.padEnd(14)}</Text>
      <Text color={color ?? colors.text} bold>
        {String(value)}
      </Text>
    </Box>
  );
}

export interface OverviewProps {
  data: TuiFrameData;
  focused?: boolean;
}

export function Overview({ data, focused }: OverviewProps) {
  const driftColor = data.driftClients > 0 ? colors.warning : colors.success;

  return (
    <Panel title="Status" focused={focused}>
      <StatRow label="Clients" value={`${data.enabledClients}/${data.totalClients} enabled`} color={colors.info} />
      <StatRow label="MCPs" value={data.resourceCounts.mcps} color={colors.brand} />
      <StatRow label="Agents" value={data.resourceCounts.agents} color={colors.brandBright} />
      <StatRow label="Skills" value={data.resourceCounts.skills} color={colors.brandBright} />
      <StatRow
        label="Drift"
        value={data.driftClients === 0 ? `${chars.check} in sync` : `${data.driftClients} out of sync`}
        color={driftColor}
      />
      <StatRow label="Last sync" value={data.lastSync} />
    </Panel>
  );
}
