---
title: Synctax Changelog & Progress
description: Historical tracking of the Synctax project, detailing completed milestones and future roadmaps.
contents:
  - Completed Milestones: v1.5 features (Watch Daemon, Matrix UI, Advanced Parsing).
  - Current Active Context: 9/9 Client Adapters natively supported.
  - V2.0 Roadmap: Future intelligent features (Conflict Resolution, Audit Logging).
glossary:
  - v1.5: The recent milestone that solidified the core sync engine and UI.
  - v2.0: The planned future milestone focusing on AI-assisted capabilities and remote profiling.
  - Matrix Dashboard: The 'synctax info' command displaying tabular client data.
  - Watch Daemon: The 'synctax watch' background process.
---

# Synctax Changelog & Progress

This document tracks the historical development of Synctax, highlighting major milestones achieved and outlining the roadmap for future versions.

## 1. Completed Milestones (v1.5)

The **v1.5 Milestone** marked the completion of the core operational functionality of Synctax. The following key features were fully implemented, verified via strict Red-Green TDD, and merged into the main codebase:

### 1.1 Watch Daemon Mode (`synctax watch`)
- A background daemon was successfully implemented using `chokidar`.
- It continuously monitors `~/.synctax/config.json`. On file save, it triggers a `syncCommand` to automatically push changes to the client files.
- Uses a robust 500ms debounce mechanism to prevent I/O spam and returns the watcher instance to prevent hanging tests.

### 1.2 Terminal UI ASCII Banner
- The CLI now displays a gorgeous `synctax` banner using the exact DOS Rebel font format.
- The `--theme` flag is implemented and supports "dull-neon" colored output using `chalk.hex()`. Supported themes:
  - `default`: `["#362F4F", "#5B23FF", "#008BFF", "#E4FF30"]`
  - `cyber`: `["#FF2DD1", "#FDFFB8", "#4DFFBE", "#63C8FF"]`
  - `rebel`: `["#000000", "#CF0F47", "#FF0B55", "#FFDEDE"]`

### 1.3 Tabular Matrix Dashboard (`synctax info`)
- Upgraded the UX drastically. When a user runs `info` (or `init`), the terminal prints a beautiful tabular structure using `cli-table3`.
- It details the installed clients on the system and dynamically styles the exact counts of their resources (e.g., "Cursor | Yes | 3 MCPs | 2 Agents | 1 Skill" instead of raw numbers).

### 1.4 Advanced File Extension Parsing
- AI clients use varying formats for skills/agents. The regex in our adapters (specifically `ClaudeAdapter`) was updated to comprehensively scrape not just `*.md`, but also `*.agent`, `*.agents`, and `*.claude` files inside their respective directories.
- Tests are in place to guarantee this scaling parsing logic.

---

## 2. Current Active Context (What Works)

As of the latest release, Synctax is 100% functional for core operations:
- **Master Config Engine:** Built with Zod schemas and Node `fs` operations.
- **Client Adapters (9/9 Natively Supported):** Claude Code, Cursor, Zed, OpenCode, Cline, Github Copilot, Github Copilot CLI, Gemini CLI, Antigravity.
- **CLI Utilities:**
  - Lifecycle: `init`, `doctor`, `restore`
  - Management: `add`, `remove`, `move`, `pull`
  - Syncing: `sync`, `memory-sync`
  - Visibility: `info`, `list`, `status`
- **Automation:** `watch` daemon running silently in the background detecting master config drift.
- **Testing:** An air-tight 49-suite Vitest architecture safely leveraging `SYNCTAX_HOME` over `process.cwd()`.

---

## 3. The v2.0 Roadmap (What's Next)

The next major iteration of Synctax (v2.0) will shift focus from raw configuration synchronization to intelligent, AI-assisted operations and remote team collaboration.

### 3.1 AI-Assisted Conflict Resolution
- Currently, Synctax relies on a merge-conservative approach (deny-lists win).
- v2.0 will introduce LLM calls to intelligently resolve clashing instructions during file merges (e.g., if one config says "Use Python 3.9" and another says "Use Python 3.11").

### 3.2 Action Audit Logging
- Implementing a full JSON audit log tracking historical configuration overrides. This will allow developers to see exactly *when* and *why* a specific `.cursorrules` line was modified by Synctax.

### 3.3 Remote Profile Registry
- A hosted endpoint integration for `profile publish` and `profile pull` commands.
- This will allow entire development teams to securely share their Synctax configurations, ensuring everyone on the team has the identical AI context, MCPs, and skills installed.

### 3.4 Shared UI Terminal Companion
- Moving beyond basic CLI outputs, v2.0 aims to build a comprehensive Terminal User Interface (TUI) built on Ink/Blessed.
