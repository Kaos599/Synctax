import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { Select } from "@inkjs/ui";
import { colors, chars } from "../theme.js";

export interface RemoveSelectorProps {
  resourceNames: { mcps: string[]; agents: string[]; skills: string[] };
  onSelect: (domain: string, name: string) => void;
  onCancel: () => void;
}

type Step = "domain" | "name";
type Domain = "mcp" | "agent" | "skill";

const DOMAIN_OPTIONS = [
  { label: "MCP Servers", value: "mcp" as Domain },
  { label: "Agents", value: "agent" as Domain },
  { label: "Skills", value: "skill" as Domain },
];

function getResourceList(resources: RemoveSelectorProps["resourceNames"], domain: Domain): string[] {
  if (domain === "mcp") return resources.mcps;
  if (domain === "agent") return resources.agents;
  return resources.skills;
}

export function RemoveSelector({ resourceNames, onSelect, onCancel }: RemoveSelectorProps) {
  const [step, setStep] = useState<Step>("domain");
  const [selectedDomain, setSelectedDomain] = useState<Domain | undefined>();

  useInput((_input, key) => {
    if (key.escape) {
      if (step === "name") {
        setStep("domain");
        setSelectedDomain(undefined);
      } else {
        onCancel();
      }
    }
  });

  if (step === "domain") {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
        <Box marginBottom={1}>
          <Text color={colors.brand} bold>{chars.diamond} Remove Resource — Step 1/2</Text>
          <Box flexGrow={1} />
          <Text color={colors.textMuted}><Text color={colors.hotkey}>Esc</Text> to cancel</Text>
        </Box>
        <Box marginBottom={1}>
          <Text color={colors.textSecondary}>Select resource type:</Text>
        </Box>
        <Box flexDirection="column" borderStyle="single" borderColor={colors.border} paddingX={1}>
          <Select
            options={DOMAIN_OPTIONS}
            visibleOptionCount={3}
            onChange={(value) => {
              setSelectedDomain(value as Domain);
              setStep("name");
            }}
          />
        </Box>
        <Box marginTop={1}>
          <Text color={colors.textMuted}><Text color={colors.hotkey}>Enter</Text> to select {chars.dot} <Text color={colors.hotkey}>Esc</Text> to cancel</Text>
        </Box>
      </Box>
    );
  }

  // Step 2: pick resource name
  const names = selectedDomain ? getResourceList(resourceNames, selectedDomain) : [];

  if (names.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
        <Box marginBottom={1}>
          <Text color={colors.brand} bold>{chars.diamond} Remove Resource — Step 2/2</Text>
        </Box>
        <Text color={colors.textMuted}>No {selectedDomain}s found in master config. Press Esc to go back.</Text>
      </Box>
    );
  }

  const nameOptions = names.map((n) => ({ label: n, value: n }));

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      <Box marginBottom={1}>
        <Text color={colors.brand} bold>{chars.diamond} Remove Resource — Step 2/2</Text>
        <Box flexGrow={1} />
        <Text color={colors.textMuted}><Text color={colors.hotkey}>Esc</Text> to go back</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color={colors.textSecondary}>Removing {selectedDomain}: select which one</Text>
      </Box>
      <Box flexDirection="column" borderStyle="single" borderColor={colors.border} paddingX={1}>
        <Select
          options={nameOptions}
          visibleOptionCount={10}
          onChange={(value) => {
            if (selectedDomain) onSelect(selectedDomain, value);
          }}
        />
      </Box>
      <Box marginTop={1}>
        <Text color={colors.textMuted}><Text color={colors.hotkey}>Enter</Text> to confirm removal {chars.dot} <Text color={colors.hotkey}>Esc</Text> step back</Text>
      </Box>
    </Box>
  );
}
