# Phase 5: Team & Sharing

**Status**: Planned
**Estimated effort**: 10-14 hours
**Depends on**: Phase 4 (env vault for credential bifurcation)

## Vision

Enable two sharing workflows:
1. **Cross-machine personal sync**: Export config from work machine, import on personal machine
2. **Team collaboration**: Team lead publishes a base config, team members pull and overlay their personal secrets

## 5.1 Cross-Machine Sync (Portable Export)

### Problem
Current `synctax export` dumps the entire config including any resolved env values. Importing on another machine may fail because paths, commands, or env vars differ.

### Solution: `synctax export --portable`

Produces a portable bundle that:
- Keeps `$VAR` references (never resolves them)
- Includes env var NAMES but not values
- Lists required tools (npx, bun, python, etc.) for the destination machine to verify
- Optionally includes instruction/memory file content

### Format
```json
{
  "synctax_export": {
    "version": 1,
    "exported_at": "2026-03-24T15:30:00Z",
    "source_machine": "macbook-work"
  },
  "config": { /* full config.json with $VAR references */ },
  "required_env_vars": ["POSTGRES_URL", "API_KEY", "GITHUB_TOKEN"],
  "required_commands": ["npx", "bun", "python3"],
  "instructions": "# Project rules\n..."
}
```

### Import flow
```
$ synctax import portable-config.json

  Importing portable configuration...

  Required env vars:
    ⚠ POSTGRES_URL — not set (run: synctax env set POSTGRES_URL <value>)
    ✓ API_KEY — found in environment
    ⚠ GITHUB_TOKEN — not set

  Required commands:
    ✓ npx — found at /usr/local/bin/npx
    ✓ bun — found at /Users/hd/.bun/bin/bun
    ✗ python3 — not found on PATH

  Import anyway? [y/N]
```

### Implementation
- Modify `src/commands/io.ts` — add `--portable` flag to exportCommand
- Modify importCommand to detect portable format and run checks
- New tests for portable round-trip

## 5.2 Team Config Overlay

### Problem
Teams need to share MCP configs, agent definitions, and skills — but NOT personal API keys, local paths, or machine-specific settings.

### Solution: `.synctax/team.json` in project repository

```json
{
  "synctax_team": {
    "version": 1,
    "name": "acme-backend"
  },
  "resources": {
    "mcps": {
      "postgres": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-postgres"],
        "env": { "DB_URL": "$POSTGRES_URL" }
      },
      "redis": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-redis"],
        "env": { "REDIS_URL": "$REDIS_URL" }
      }
    },
    "agents": {
      "reviewer": {
        "name": "Code Reviewer",
        "prompt": "Review code for the acme-backend project...",
        "model": "claude-sonnet-4-20250514"
      }
    }
  }
}
```

### Merge behavior
When a project has `.synctax/team.json`:
1. Team config provides the base layer
2. Personal master config (`~/.synctax/config.json`) provides overrides
3. Profile env vars resolve `$VAR` references
4. Precedence: personal > team (personal wins on conflicts)

### Commands
- `synctax team init` — create `.synctax/team.json` from current resources
- `synctax team diff` — show what team config adds/overrides
- `synctax sync` — automatically merges team + personal before pushing to clients

### Git workflow
- `.synctax/team.json` is committed to the repo (no secrets, uses `$VAR` references)
- Each developer sets their own env vars via `synctax env set`
- New team members: clone repo → `synctax env set POSTGRES_URL ...` → `synctax sync`

## 5.3 Remote Profile Registry (Future)

### Concept
A hosted endpoint for `synctax profile publish` and `synctax profile pull`.

### Current state
URL-based pull already works: `synctax profile pull https://...`
Profile publish already strips credentials.

### Future work
- Hosted registry (GitHub Gist-based, or dedicated service)
- `synctax profile publish --registry` to push to central registry
- `synctax profile search <query>` to find shared profiles
- Authentication for private profiles

### NOT in scope for v2.0
This is a future consideration. The URL-based publish/pull covers the immediate need.

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Secrets in team.json | `$VAR` references only; never resolved values |
| Secrets in export | Portable export keeps `$VAR` references; lists required vars |
| Credentials in profile publish | Already stripped by `profilePublishCommand` |
| .env files committed to git | .env files live in `~/.synctax/envs/` (home dir), not project |
| Man-in-the-middle on profile pull | Use HTTPS URLs; warn on HTTP |
