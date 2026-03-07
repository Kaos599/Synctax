# Project Brief: synctax

## Overview
synctax is a cross-platform CLI tool that synchronizes the full agentic developer configuration - MCP servers, agents, skills, memory/context files, permission policies, model preferences, API credentials, and system prompts - across every AI-powered IDE and CLI client on a developer's machine.

## Problem Statement
Developers use multiple AI tools (Claude Code, Cursor, Zed, Cline, OpenCode, Antigravity, etc.), each requiring manual configuration in proprietary JSON/MD files. This causes a severe "sync tax" and configuration drift leading to non-reproducible AI behaviors.

## Goals
- Zero-friction sync via a single command across all installed clients.
- Handle multi-domain configurations (MCP, Agents, Skills, Memory, Profiles, Credentials).
- Extensible via simple Adapters.
- Secure by default (merge-conservative on permissions, env variable refs for credentials).
