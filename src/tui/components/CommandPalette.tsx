import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput } from "@inkjs/ui";
import { colors, chars } from "../theme.js";
import { getAllActions, type TuiAction } from "../actions.js";

export interface CommandPaletteProps {
  onSelect: (action: TuiAction) => void;
  onCancel: () => void;
}

export function CommandPalette({ onSelect, onCancel }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const allActions = getAllActions();

  const filtered = query.length === 0
    ? allActions
    : allActions.filter((a) =>
      a.label.toLowerCase().includes(query.toLowerCase())
      || a.commandPreview.toLowerCase().includes(query.toLowerCase())
      || a.id.toLowerCase().includes(query.toLowerCase()),
    );

  // Scrolling viewport — show up to MAX_VISIBLE items, scroll to keep selection visible
  const MAX_VISIBLE = 12;
  const maxIndex = Math.max(0, filtered.length - 1);
  const clampedIndex = Math.min(selectedIndex, maxIndex);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Derive the visible window from scrollOffset — kept in sync via arrow handlers
  const visibleStart = scrollOffset;
  const visibleEnd = Math.min(visibleStart + MAX_VISIBLE, filtered.length);
  const visibleActions = filtered.slice(visibleStart, visibleEnd);
  const hasMoreAbove = visibleStart > 0;
  const hasMoreBelow = visibleEnd < filtered.length;

  // Handle Esc, arrow keys, and Enter — must be inside this component since the
  // parent App disables its useInput when palette mode is active.
  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => {
        const next = prev <= 0 ? maxIndex : prev - 1;
        // Wrap to bottom: jump scroll offset to show the last page
        if (prev <= 0) {
          setScrollOffset(Math.max(0, filtered.length - MAX_VISIBLE));
        }
        // Scrolling up past the visible window
        else {
          setScrollOffset((off) => (next < off ? next : off));
        }
        return next;
      });
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => {
        const next = prev >= maxIndex ? 0 : prev + 1;
        // Wrap to top: reset scroll offset
        if (prev >= maxIndex) {
          setScrollOffset(0);
        }
        // Scrolling down past the visible window
        else {
          setScrollOffset((off) => (next >= off + MAX_VISIBLE ? next - MAX_VISIBLE + 1 : off));
        }
        return next;
      });
      return;
    }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      {/* Title */}
      <Box marginBottom={1}>
        <Text color={colors.brand} bold>
          {chars.diamond} Command Palette
        </Text>
        <Box flexGrow={1} />
        <Text color={colors.textMuted}>
          <Text color={colors.hotkey}>Esc</Text> to close
        </Text>
      </Box>

      {/* Search input */}
      <Box marginBottom={1}>
        <Text color={colors.info} bold>{chars.arrow} </Text>
        <TextInput
          placeholder="Search commands..."
          onChange={(value) => {
            setQuery(value);
            setSelectedIndex(0);
            setScrollOffset(0);
          }}
          onSubmit={() => {
            if (filtered.length > 0 && filtered[clampedIndex]) {
              onSelect(filtered[clampedIndex]!);
            }
          }}
        />
      </Box>

      {/* Results */}
      <Box flexDirection="column" borderStyle="single" borderColor={colors.border} paddingX={1}>
        {filtered.length === 0 ? (
          <Text color={colors.textMuted}>No matching commands</Text>
        ) : (
          <>
            {hasMoreAbove && (
              <Text color={colors.textMuted}>  ↑ {visibleStart} more above</Text>
            )}
            {visibleActions.map((action, i) => {
              const isSelected = (i + visibleStart) === clampedIndex;
              return (
                <Box key={action.id}>
                  <Box width={5}>
                    <Text color={isSelected ? colors.info : colors.textMuted}>
                      {isSelected ? chars.arrow : " "}
                    </Text>
                    {action.hotkey
                      ? <Text color={colors.hotkey}>[{action.hotkey}]</Text>
                      : <Text color={colors.textMuted}>   </Text>
                    }
                  </Box>
                  <Box width={20}>
                    <Text color={isSelected ? colors.text : colors.textSecondary} bold={isSelected}>
                      {" "}{action.label}
                    </Text>
                  </Box>
                  <Text color={colors.textMuted}>{action.commandPreview}</Text>
                </Box>
              );
            })}
            {hasMoreBelow && (
              <Text color={colors.textMuted}>  ↓ {filtered.length - visibleEnd} more below</Text>
            )}
          </>
        )}
      </Box>

      <Box marginTop={1}>
        <Text color={colors.textMuted}>
          <Text color={colors.hotkey}>↑↓</Text> to navigate {chars.dot}{" "}
          <Text color={colors.hotkey}>Enter</Text> to confirm {chars.dot}{" "}
          <Text color={colors.hotkey}>Esc</Text> to close
          {filtered.length > 0 && ` ${chars.dot} ${clampedIndex + 1}/${filtered.length}`}
        </Text>
      </Box>
    </Box>
  );
}
