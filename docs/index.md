---
title: Synctax Documentation Index
description: Master entry point for all Synctax documentation. This document serves as the root index for human developers and AI agents navigating the repository's knowledge base.
contents:
  - index.md: This root index.
  - instructions.md: Guidelines and navigation instructions specifically for AI agents operating in this repository.
  - architecture.md: Extremely detailed Product Requirements Document (PRD), covering product context, use cases, core architecture, and in-depth client-specific parsing handling.
  - tech_context.md: Technical stack details, testing constraints, architectural patterns, and known environment "gotchas".
  - changelog_and_progress.md: Historical tracking, completed milestones (v1.5), current status, and v2.0 roadmap.
glossary:
  - Synctax: The cross-platform CLI tool designed to eliminate configuration drift for AI developer environments.
  - Client: Target AI-powered IDEs or CLI tools (e.g., Claude Code, Cursor, Zed, Cline).
  - Adapter: Code components (src/adapters/*) responsible for translating the master config into client-specific schemas.
  - Master Config: The single source of truth located at ~/.synctax/config.json.
  - MCP: Model Context Protocol servers configured within clients.
  - Memory: Client-specific context rule files (e.g., .cursorrules, CLAUDE.md).
  - Daemon: The background process (synctax watch) maintaining real-time synchronization.
---

# Synctax Documentation

Welcome to the Synctax documentation. Synctax is a cross-platform CLI tool built with Bun and TypeScript that synchronizes agentic developer configurations (MCPs, agents, skills, memory, permissions) across multiple AI clients.

## Table of Contents

- [Agent Instructions (instructions.md)](./instructions.md)
  Guidelines for AI assistants working within this repository.
- [Architecture & Use Cases (architecture.md)](./architecture.md)
  Detailed PRD, core architecture patterns, and extreme deep dives into how each AI client adapter parses and writes data.
- [Technical Context (tech_context.md)](./tech_context.md)
  The tech stack, testing constraints (TDD), mocking requirements, and environment quirks.
- [Changelog & Progress (changelog_and_progress.md)](./changelog_and_progress.md)
  Completed milestones, current active context, and future v2.0 roadmap.

Please navigate to the specific documents to learn more about the internals of Synctax.
