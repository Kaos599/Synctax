# Active Context

## Current Work Focus
The project has completed the fullscreen TUI rewrite using Ink (React for terminals). The TUI replaces the old raw ANSI string-based renderer with a proper React component architecture featuring 15 components, 16 color themes, and a view-switching navigation model. All 433 tests pass across 46 suites.

## Recent Changes
- Replaced raw ANSI TUI with Ink-based React components (15 components in `src/tui/components/`).
- Added 16 color themes: synctax, catppuccin, dracula, nord, tokyo-night, gruvbox, one-dark, solarized, rose-pine, monokai, cyberpunk, sunset, ocean, forest, ember, aurora.
- Added searchable command palette (`/`), inline source selector (`s`), theme picker (`t`).
- Added Tab/Shift+Tab panel focus cycling on dashboard.
- Added fullscreen alternate screen buffer (ANSI `\x1b[?1049h`).
- Added toast notifications with 3s auto-dismiss after action completion.
- Expanded quick actions from 6 to 12 (1-9, 0 hotkeys) covering sync, pull, diff, validate, doctor, backup, profiles, status, memory-sync, watch.
- Implemented view switching architecture — each mode (dashboard, confirm, running, result, help, palette, source, theme) renders a dedicated full-screen view with no broken overlays.
- Consistent navigation: Esc goes back from every sub-view, q quits from anywhere.
- Deleted 8 redundant pre-Ink files (frame.ts, app.ts, types.ts, dashboard.ts + their tests).
- Updated all documentation: fullscreen-tui.md, CLAUDE.md, progress.md, activeContext.md.

## Next Steps
- Env Vault command surface (`env set/list/edit/delete`).
- Remote Profile Registry integration.
- Consider adding responsive panel stacking for narrow terminals.
- Consider live config reload (watch `~/.synctax/config.json` and auto-update dashboard).

## Current Work
TUI implementation is complete. Focus shifting to stabilization and remaining v2.0 features.
