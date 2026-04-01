# Phase 2: Premium CLI Experience

**Status**: DONE (follow-up hardening in Phase 3/4)
**Estimated effort**: 8-12 hours
**Depends on**: Phase 1 (DONE)

## Vision

Transform the CLI output from functional-but-plain to polished-and-premium, matching the feel of pnpm, bun, and Claude Code's terminal experience. Every command should have consistent styling, spinners for async operations, timing, and a brand header.

## 2.1 Output Overhaul

### Target output style

```
$ synctax sync

  ○ Synctax v2.0 · Profile: work

  Syncing 12 MCPs, 4 agents, 8 skills...

  ✓ Claude Code     12 MCPs  4 agents  synced
  ✓ Cursor          12 MCPs  4 agents  synced
  ✓ Zed              8 MCPs            synced
  ✗ Cline           failed: ENOENT
  ✓ OpenCode        12 MCPs  4 agents  synced

  Done in 0.3s · 4/5 clients synced
  ⚠ 1 failure — run synctax doctor
```

### Per-command upgrades

| Command | Current | Target |
|---------|---------|--------|
| `init` | Static text with banner | Animated client detection with live checkmarks, progress spinner |
| `sync` | One line per client | Brand header → spinner → per-client result table → timing summary |
| `pull` | Inline text | Show diff preview before confirming, spinner during read |
| `info` | Plain table | Brand header → richer table with color-coded status badges |
| `status` | Text blocks | Health dashboard with env var validation, drift indicators |
| `doctor` | Simple pass/fail | Categorized checks with progress, deep mode spinner |
| `watch` | One-time message | Live dashboard with last-sync time, change counter |
| All | No timing | `Done in 0.3s` footer on every command |

### Implementation

1. Add `const timer = ui.startTimer()` at the top of each command
2. Add `ui.format.brandHeader(version, profile)` as the first output line
3. Wrap async adapter operations with `ui.spinner()`
4. Add `ui.format.summary(timer.elapsed(), detail)` at the end
5. Use `ui.gap()` for consistent vertical spacing

### Files to modify
- Every file in `src/commands/` (add timer, brand header, summary)
- `src/ui/spinner.ts` (may need enhancement for per-line updates)

## 2.2 Banner Redesign

### Current state
The rebel FIGlet banner is 12 lines tall and visually heavy. The pixel wordmark is an alternative but still large.

### Target
A cleaner, modern banner that:
- Uses gradient text effects (chalk truecolor support)
- Is 3-4 lines max (compact)
- Shows version + active profile + client count inline
- Feels premium without dominating the terminal

### Example concepts

**Concept A: Minimal gradient wordmark**
```
  ▸ synctax v2.0
  5 clients · 12 MCPs · work profile
```

**Concept B: Slim block letters with accent**
```
  ███ synctax ███
  v2.0 · 5 clients · Profile: work
```

**Concept C: Subtle box**
```
  ┌─ Synctax v2.0 ─────────────────┐
  │ 5 clients · 12 MCPs · work     │
  └─────────────────────────────────┘
```

### Decision needed
User preference on banner style. Can be A/B tested during implementation.

### Files to modify
- `src/banner.ts` — redesign printBanner()
- `src/theme.ts` — add gradient/modern palette options

## 2.3 Interactive Mode Polish

### Improvements
- Show active profile, resource counts, and last sync time above the search palette
- Clear screen between commands for cleaner transitions
- Add `q` keybinding to quit from any prompt
- Consistent spacing and alignment

### Files to modify
- `src/interactive.ts`

## Verification

- All existing tests pass (output changes are cosmetic, test spies check content not styling)
- Manual visual verification of every command's output
- Non-TTY environments (CI, piped output) degrade gracefully (no spinners, static output)

## Post-Phase Hardening Notes (2026-03-26)

- Spinner rendering now routes transient animation to `stderr` for better cross-terminal behavior.
- Non-interactive/CI output uses concise static progress lines instead of animation frames.
- Symbol rendering supports ASCII fallback (`SYNCTAX_ASCII=1` or `TERM=dumb`).
- Pull failures now set non-zero exit codes, and sync failure paths no longer report "Sync complete!".

## Fullscreen TUI Follow-up Notes (2026-03-30)

- No-arg launch now routes to the fullscreen TUI when both stdin/stdout are TTY and viewport is at least `92x24`; otherwise it falls back to the prompt-based interactive mode.
- Quick actions now require explicit confirmation (`Enter`/`y` to run, `Esc`/`n` to cancel) before command execution.
- Confirmed actions move through `confirm -> running -> result` states so execution feedback remains in-app without breaking fullscreen redraw behavior.
