import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { colors, setActiveTheme } from "../theme.js";
import { Header } from "./Header.js";
import { Overview } from "./Overview.js";
import { QuickActions } from "./QuickActions.js";
import { Diagnostics } from "./Diagnostics.js";
import { Features } from "./Features.js";
import { StatusBar } from "./StatusBar.js";
import { ConfirmView } from "./ConfirmModal.js";
import { HelpView } from "./HelpOverlay.js";
import { CommandPalette } from "./CommandPalette.js";
import { RunningView, ResultView, isResultScrollable } from "./RunningView.js";
import { SourceSelector } from "./SourceSelector.js";
import { ThemeSelector } from "./ThemeSelector.js";
import { ProfileSelector } from "./ProfileSelector.js";
import { RemoveSelector } from "./RemoveSelector.js";
import { Toast } from "./Toast.js";
import type { ToastProps } from "./Toast.js";
import { getActionByHotkey, runActionById } from "../actions.js";
import { runGuardedAction } from "../executor.js";
import { ConfigManager } from "../../config.js";
import * as commands from "../../commands.js";
import { getAdapter, type AdapterId } from "../../adapters/index.js";
import type { TuiFrameData, TuiMode, TuiFocus, TuiPendingAction } from "../ink-types.js";
import type { TuiAction } from "../actions.js";
import type { GuardedActionResult } from "../executor.js";

const FOCUS_ORDER: TuiFocus[] = ["overview", "actions", "diagnostics", "features"];

export interface AppProps {
  data: TuiFrameData;
  executeAction?: (action: TuiPendingAction) => Promise<void>;
}

export function App({ data, executeAction }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [mode, setMode] = useState<TuiMode>("dashboard");
  const [focus, setFocus] = useState<TuiFocus>("overview");
  const [statusLine, setStatusLine] = useState("Ready. Press / for commands, h for help, t for themes.");
  const [pendingAction, setPendingAction] = useState<TuiPendingAction | undefined>();
  const [runOutput, setRunOutput] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<GuardedActionResult | undefined>();
  const [lastActionLabel, setLastActionLabel] = useState("");
  const [toast, setToast] = useState<ToastProps | null>(null);
  const [currentSource, setCurrentSource] = useState(data.source);
  const [currentTheme, setCurrentTheme] = useState(data.theme || "synctax");
  const [profilePickAction, setProfilePickAction] = useState<"profile-use" | "profile-diff" | undefined>();

  const resolvedSource = getAdapter(currentSource) ? (currentSource as AdapterId) : undefined;
  const invalidSource = currentSource && !resolvedSource ? currentSource : undefined;

  const defaultExecutor = useCallback(
    async (action: TuiPendingAction) => {
      await runActionById(action.id, { source: resolvedSource, invalidSource });
    },
    [resolvedSource, invalidSource],
  );

  const executor = executeAction ?? defaultExecutor;

  const goHome = useCallback(() => {
    setMode("dashboard");
    setStatusLine("Ready. Press / for commands, h for help, t for themes.");
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const executeConfirmedAction = useCallback(
    async (action: TuiPendingAction) => {
      setMode("running");
      setLastActionLabel(action.label);
      setRunOutput([]);
      setStatusLine(`Running ${action.label}...`);
      setPendingAction(undefined);

      const result = await runGuardedAction(action.id, async () => {
        await executor(action);
      }, {
        onOutput: (nextOutput) => {
          setRunOutput(nextOutput.slice(-200));
        },
      });

      setRunOutput(result.output);
      setLastResult(result);
      setMode("result");

      const tail = result.output[result.output.length - 1];
      const statusMsg = result.ok
        ? `Completed ${action.label} in ${result.elapsedMs}ms${tail ? ` | ${tail}` : ""}`
        : `Failed ${action.label}: ${result.error ?? "unknown error"}`;
      setStatusLine(statusMsg);
      setToast({ message: statusMsg, type: result.ok ? "success" : "error" });
    },
    [executor],
  );

  const selectAction = useCallback((action: TuiAction | TuiPendingAction) => {
    // CLI-only actions: skip confirm, show guidance directly
    if (action.cliOnly) {
      setLastActionLabel(action.label);
      setLastResult({
        actionId: action.id,
        ok: true,
        output: [action.hint || `Run from CLI: ${action.commandPreview}`],
        elapsedMs: 0,
      });
      setMode("result");
      setStatusLine(`${action.label} requires CLI arguments`);
      return;
    }

    // Profile picker actions: go to profile selector
    if (action.id === "profile-use" || action.id === "profile-diff") {
      setProfilePickAction(action.id);
      setMode("profile-pick");
      setStatusLine("Select a profile — Esc to cancel");
      return;
    }

    // Remove action: go to resource picker
    if (action.id === "remove") {
      setMode("remove-pick");
      setStatusLine("Select resource to remove — Esc to cancel");
      return;
    }

    // Standard confirm flow
    const source = currentSource || "claude";
    const interpolate = (s: string) => s.replace(/<client>/g, source);
    const preview = interpolate(action.commandPreview);
    setPendingAction({
      id: action.id,
      hotkey: action.hotkey,
      label: action.label,
      commandPreview: preview,
      confirmTitle: interpolate(action.confirmTitle),
      confirmRisk: action.confirmRisk,
      description: action.description,
      hint: action.hint,
      cliOnly: action.cliOnly,
    });
    setMode("confirm");
    setStatusLine(`Would run: ${preview}`);
  }, [currentSource]);

  // ── Main input handler (disabled for modes that handle their own input) ──
  useInput((input, key) => {
    // ── Global: q or Ctrl-C always quits ──
    if (input === "q" || (key.ctrl && input === "c")) {
      exit();
      return;
    }

    // ── Global: Esc goes back from any sub-view to dashboard ──
    if (key.escape) {
      if (mode === "confirm") {
        setPendingAction(undefined);
        setStatusLine("Cancelled.");
      }
      if (mode !== "dashboard" && mode !== "running") {
        goHome();
      }
      return;
    }

    // Running mode — ignore other keys
    if (mode === "running") {
      return;
    }

    // Result mode — arrow keys are handled by ResultView for scrolling; any other key exits
    if (mode === "result") {
      const lineCount = lastResult?.output.length ?? 0;
      const canScroll = isResultScrollable(lineCount, stdout?.rows ?? 36);
      if (canScroll && (key.upArrow || key.downArrow)) return;
      goHome();
      setLastResult(undefined);
      setRunOutput([]);
      return;
    }

    // Help mode — h/? also closes
    if (mode === "help") {
      if (input === "h" || input === "?") {
        goHome();
      }
      return;
    }

    // Confirm mode
    if (mode === "confirm" && pendingAction) {
      if (key.return || input === "y") {
        void executeConfirmedAction(pendingAction);
        return;
      }
      if (input === "n") {
        setPendingAction(undefined);
        setStatusLine("Cancelled.");
        goHome();
        return;
      }
      return;
    }

    // Dashboard mode
    if (mode === "dashboard") {
      // Tab navigation
      if (key.tab) {
        setFocus((prev) => {
          const idx = FOCUS_ORDER.indexOf(prev);
          return key.shift
            ? FOCUS_ORDER[(idx - 1 + FOCUS_ORDER.length) % FOCUS_ORDER.length]!
            : FOCUS_ORDER[(idx + 1) % FOCUS_ORDER.length]!;
        });
        return;
      }

      if (input === "h" || input === "?") {
        setMode("help");
        setStatusLine("Keyboard reference — Esc to close");
        return;
      }

      if (input === "s") {
        setMode("source");
        setStatusLine("Select source adapter — Esc to cancel");
        return;
      }

      if (input === "t") {
        setMode("theme");
        setStatusLine("Select theme — Esc to cancel");
        return;
      }

      if (input === "/") {
        setMode("palette");
        setStatusLine("Search commands — Esc to close");
        return;
      }

      const action = getActionByHotkey(input);
      if (action) {
        selectAction(action);
        return;
      }
    }
  }, { isActive: mode !== "palette" && mode !== "source" && mode !== "theme" && mode !== "profile-pick" && mode !== "remove-pick" });

  const termWidth = stdout?.columns ?? 120;
  const termHeight = stdout?.rows ?? 36;

  // ═══════════════════════════════════════════════════════════
  // VIEW SWITCHING — each mode replaces the content area entirely
  // ═══════════════════════════════════════════════════════════

  if (mode === "running") {
    return (
      <Shell w={termWidth} h={termHeight} data={data} source={currentSource} mode={mode} status={statusLine}>
        <RunningView actionLabel={lastActionLabel} output={runOutput} />
      </Shell>
    );
  }

  if (mode === "result" && lastResult) {
    return (
      <Shell w={termWidth} h={termHeight} data={data} source={currentSource} mode={mode} status={statusLine}>
        {toast && <Toast message={toast.message} type={toast.type} />}
        <ResultView
          actionLabel={lastActionLabel}
          ok={lastResult.ok}
          elapsedMs={lastResult.elapsedMs}
          error={lastResult.error}
          output={lastResult.output}
        />
      </Shell>
    );
  }

  if (mode === "confirm" && pendingAction) {
    return (
      <Shell w={termWidth} h={termHeight} data={data} source={currentSource} mode={mode} status={statusLine}>
        <ConfirmView
          action={pendingAction}
          enabledClients={data.enabledClients}
          resourceCounts={data.resourceCounts}
        />
      </Shell>
    );
  }

  if (mode === "help") {
    return (
      <Shell w={termWidth} h={termHeight} data={data} source={currentSource} mode={mode} status={statusLine}>
        <HelpView />
      </Shell>
    );
  }

  if (mode === "palette") {
    return (
      <Shell w={termWidth} h={termHeight} data={data} source={currentSource} mode={mode} status={statusLine}>
        <CommandPalette onSelect={selectAction} onCancel={goHome} />
      </Shell>
    );
  }

  if (mode === "source") {
    return (
      <Shell w={termWidth} h={termHeight} data={data} source={currentSource} mode={mode} status={statusLine}>
        <SourceSelector
          currentSource={currentSource}
          onSelect={(selectedId) => {
            void (async () => {
              try {
                const manager = new ConfigManager();
                const config = await manager.read();
                config.source = selectedId;
                await manager.write(config);
                setCurrentSource(selectedId);
                setStatusLine(`Source changed to ${selectedId}`);
                setToast({ message: `Source set to ${selectedId}`, type: "success" });
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "unknown error";
                setStatusLine(`Failed: ${msg}`);
                setToast({ message: `Failed: ${msg}`, type: "error" });
              }
              goHome();
            })();
          }}
          onCancel={goHome}
        />
      </Shell>
    );
  }

  if (mode === "theme") {
    return (
      <Shell w={termWidth} h={termHeight} data={data} source={currentSource} mode={mode} status={statusLine}>
        <ThemeSelector
          currentTheme={currentTheme}
          onSelect={(name) => {
            void (async () => {
              try {
                setActiveTheme(name);
                setCurrentTheme(name);
                const manager = new ConfigManager();
                const config = await manager.read();
                config.theme = name;
                await manager.write(config);
                setStatusLine(`Theme changed to ${name}`);
                setToast({ message: `Theme: ${name}`, type: "success" });
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "unknown error";
                setStatusLine(`Failed: ${msg}`);
                setToast({ message: `Failed: ${msg}`, type: "error" });
              }
              goHome();
            })();
          }}
          onCancel={goHome}
        />
      </Shell>
    );
  }

  if (mode === "profile-pick") {
    return (
      <Shell w={termWidth} h={termHeight} data={data} source={currentSource} mode={mode} status={statusLine}>
        <ProfileSelector
          profiles={data.profileNames}
          activeProfile={data.profile}
          actionLabel={profilePickAction === "profile-use" ? "Switch Profile" : "Preview Profile Diff"}
          onSelect={(name) => {
            void (async () => {
              setMode("running");
              const label = profilePickAction === "profile-use" ? "profile use" : "profile diff";
              setLastActionLabel(label);
              setRunOutput([]);
              setStatusLine(`Running ${label}...`);

              const result = await runGuardedAction(profilePickAction ?? "profile-use", async () => {
                if (profilePickAction === "profile-use") {
                  await commands.profileUseCommand(name, { yes: true });
                } else {
                  await commands.profileDiffCommand(name, {});
                }
              });

              setRunOutput(result.output);
              setLastResult(result);
              setMode("result");
              const statusMsg = result.ok
                ? `Completed ${label}`
                : `Failed ${label}: ${result.error ?? "unknown error"}`;
              setStatusLine(statusMsg);
              setToast({ message: statusMsg, type: result.ok ? "success" : "error" });
            })();
          }}
          onCancel={goHome}
        />
      </Shell>
    );
  }

  if (mode === "remove-pick") {
    return (
      <Shell w={termWidth} h={termHeight} data={data} source={currentSource} mode={mode} status={statusLine}>
        <RemoveSelector
          resourceNames={data.resourceNames}
          onSelect={(domain, name) => {
            void (async () => {
              setMode("running");
              setLastActionLabel(`remove ${domain}`);
              setRunOutput([]);
              setStatusLine(`Removing ${domain} "${name}"...`);

              const result = await runGuardedAction("remove", async () => {
                await commands.removeCommand(domain, name, {});
              });

              setRunOutput(result.output);
              setLastResult(result);
              setMode("result");
              const statusMsg = result.ok
                ? `Removed ${domain} "${name}"`
                : `Failed: ${result.error ?? "unknown error"}`;
              setStatusLine(statusMsg);
              setToast({ message: statusMsg, type: result.ok ? "success" : "error" });
            })();
          }}
          onCancel={goHome}
        />
      </Shell>
    );
  }

  // ── Dashboard (default) ──
  return (
    <Box flexDirection="column" width={termWidth} height={termHeight}>
      <Header version={data.version} profile={data.profile} source={currentSource} health={data.health} />
      <Separator />
      {toast && <Toast message={toast.message} type={toast.type} />}

      <Box flexGrow={1} flexDirection="row" paddingX={1} gap={1}>
        {/* Left column — fills height */}
        <Box flexDirection="column" flexGrow={1}>
          <Overview data={data} focused={focus === "overview"} />
          <QuickActions focused={focus === "actions"} />
          {/* Spacer pushes panels to top, fills remaining space */}
          <Box flexGrow={1} />
        </Box>

        {/* Right column — fills height */}
        <Box flexDirection="column" width="40%">
          <Diagnostics warnings={data.warnings} focused={focus === "diagnostics"} />
          <Features focused={focus === "features"} />
          <Box flexGrow={1} />
        </Box>
      </Box>

      <Separator />
      <StatusBar mode={mode} statusLine={statusLine} />
    </Box>
  );
}

// ── Shell: common layout wrapper for all sub-views ──
interface ShellProps {
  w: number;
  h: number;
  data: TuiFrameData;
  source: string;
  mode: TuiMode;
  status: string;
  children: React.ReactNode;
}

function Shell({ w, h, data, source, mode, status, children }: ShellProps) {
  return (
    <Box flexDirection="column" width={w} height={h}>
      <Header version={data.version} profile={data.profile} source={source} health={data.health} />
      <Separator />
      <Box flexGrow={1} flexDirection="column">
        {children}
      </Box>
      <Separator />
      <StatusBar mode={mode} statusLine={status} />
    </Box>
  );
}

function Separator() {
  return (
    <Box paddingX={0}>
      <Text color={colors.border} wrap="truncate">
        {"─".repeat(200)}
      </Text>
    </Box>
  );
}
