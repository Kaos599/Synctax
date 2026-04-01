# Fullscreen TUI Guide

The Synctax TUI is an Ink-based (React for terminals) fullscreen dashboard for managing your agentic developer stack. It provides a rich, interactive interface with multiple color themes, keyboard-driven navigation, and direct access to all Synctax commands.

## Running the TUI

**Demo mode** (sample data, no real config needed):

```bash
bun ./examples/fullscreen-tui.ts
```

**Normal launch** (reads your real Synctax config):

```bash
bun run synctax
```

**With a specific theme:**

```bash
bun run synctax --theme dracula
bun run synctax --theme cyberpunk
bun run synctax --theme tokyo-night
```

The TUI activates automatically when both stdin/stdout are TTY and the terminal is at least `92x24`. Otherwise, the prompt-based interactive mode is used as a fallback.

## Keyboard Controls

### Dashboard

| Key | Action |
|-----|--------|
| `1`-`9`, `0` | Select quick action (opens confirmation) |
| `/` | Open command palette — search all commands |
| `s` | Open source adapter selector |
| `t` | Open theme selector |
| `h` or `?` | Open keyboard help reference |
| `Tab` | Move focus to next panel |
| `Shift+Tab` | Move focus to previous panel |
| `q` or `Ctrl-C` | Quit |

### All Sub-Views (Confirm, Help, Palette, Source, Theme)

| Key | Action |
|-----|--------|
| `Esc` | Go back to dashboard |
| `q` | Quit |

### Confirmation

| Key | Action |
|-----|--------|
| `Enter` or `y` | Confirm and run the action |
| `Esc` or `n` | Cancel |

### After Action Completes

| Key | Action |
|-----|--------|
| Any key | Return to dashboard |

## Themes

Synctax ships with **16 color themes**. Switch themes with `t` from the dashboard, or via `--theme <name>` on launch. Theme selection is persisted in your Synctax config.

| Theme | Description |
|-------|-------------|
| `synctax` | **Default** — signature purple & cyan |
| `catppuccin` | Catppuccin Mocha — soft pastels |
| `dracula` | Dracula — purple, pink & cyan |
| `nord` | Nord — arctic frost blues |
| `tokyo-night` | Tokyo Night — neon cityscape |
| `gruvbox` | Gruvbox — warm retro earth tones |
| `one-dark` | One Dark — Atom editor classic |
| `solarized` | Solarized Dark — precision blues |
| `rose-pine` | Rose Pine — muted elegance |
| `monokai` | Monokai — vivid syntax colors |
| `cyberpunk` | Cyberpunk — neon magenta & cyan |
| `sunset` | Sunset — warm coral & lavender |
| `ocean` | Ocean — deep sea gradients |
| `forest` | Forest — earthy greens & browns |
| `ember` | Ember — smoldering orange & teal |
| `aurora` | Aurora — electric violet & aqua |

### Theme Architecture

Each theme defines 10 base palette colors (`brand`, `accent`, `info`, `success`, `warning`, `error`, `text`, `gray`, `dim`, `dark`). These are mapped to 17 semantic color roles (`colors.brand`, `colors.success`, `colors.border`, etc.) that components consume.

Themes are Proxy objects — switching themes at runtime immediately updates all component colors without re-importing.

## Quick Actions

| Hotkey | Command | Description |
|--------|---------|-------------|
| `1` | `synctax sync` | Push master config to all enabled clients |
| `2` | `synctax pull` | Pull and merge client config into master |
| `3` | `synctax diff` | Show drift between master and clients |
| `4` | `synctax validate` | Run config validation checks |
| `5` | `synctax doctor --deep` | Deep diagnostic checks |
| `6` | `synctax backup` | Backup all client configs |
| `7` | `synctax profile list` | List all profiles |
| `8` | `synctax status` | Show current sync status |
| `9` | `synctax memory-sync` | Sync memory/context files |
| `0` | `synctax watch` | Start background auto-sync daemon |

## Views

The TUI uses **view switching** — each mode replaces the content area entirely. No overlays.

| View | Trigger | Content |
|------|---------|---------|
| **Dashboard** | Default | Status, Quick Actions, Diagnostics, Feature Map panels |
| **Confirm** | Hotkey or palette selection | Action details + Enter/Esc |
| **Running** | Enter on confirm | Spinner + live output capture |
| **Result** | Action completes | Success/error summary |
| **Help** | `h` or `?` | Full keyboard reference |
| **Palette** | `/` | Searchable command filter with TextInput |
| **Source** | `s` | Adapter selector using @inkjs/ui Select |
| **Theme** | `t` | Theme picker using @inkjs/ui Select |

## Architecture

```
src/tui/
  ink-app.tsx             Ink render entry (fullscreen buffer management)
  ink-types.ts            Shared TypeScript types (TuiMode, TuiFrameData, etc.)
  theme.ts                16-theme design system with Proxy-based runtime switching
  entry.ts                No-arg routing (fullscreen vs fallback)
  data.ts                 Dashboard data hydration from ConfigManager
  actions.ts              12 action definitions + command dispatch
  executor.ts             Guarded output capture for in-TUI execution
  state.ts                Pure key reducer (used by tests)
  runtime-context.ts      Runtime context type for action execution
  components/
    App.tsx               Root component — state, input handling, view switching
    Header.tsx            ASCII art wordmark + version/profile/source/health
    Panel.tsx             Reusable bordered panel with focus highlight
    Overview.tsx          Status panel — clients, MCPs, agents, skills, drift
    QuickActions.tsx      Hotkey action grid
    Diagnostics.tsx       Warning display
    Features.tsx          Feature map by domain
    StatusBar.tsx         Mode indicator, status line, keyboard hints, clock
    ConfirmModal.tsx      Confirmation view with risk indicator
    HelpOverlay.tsx       Keyboard reference view
    CommandPalette.tsx    Searchable command palette with TextInput
    SourceSelector.tsx    Adapter picker with @inkjs/ui Select
    ThemeSelector.tsx     Theme picker with @inkjs/ui Select
    RunningView.tsx       Execution spinner + result summary
    Toast.tsx             Auto-dismissing notification
```

## Testing

```bash
# TUI-specific tests
bunx vitest run tests/tui/*.test.ts

# Full quality gates
bun run typecheck
bun run lint
bun run test
```

Test files cover: actions (dispatch + registry), state (key transitions), executor (output capture), data (config loading), entry (routing logic).

## Troubleshooting

- **TUI doesn't appear:** Ensure terminal is interactive (TTY) and at least 92x24. Run `bun ./examples/fullscreen-tui.ts` to bypass the router.
- **Colors look wrong:** Your terminal may not support true color. Try a modern terminal (iTerm2, WezTerm, Ghostty, Kitty).
- **Esc doesn't work:** Some terminals send different escape sequences. Try `q` to quit, or `Ctrl-C`.
- **Theme not persisting:** Ensure Synctax config is writable at `~/.synctax/config.json`.
