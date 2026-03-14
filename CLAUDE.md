# Flowti Vault — AI Agent Instructions

This is an Obsidian vault containing two major projects. All work happens from this git root.

## Projects

| Project | Path | Purpose |
|---------|------|---------|
| **Flowti CLI** | `01 - Projects/Flowti CLI/` | Definition-driven project orchestrator CLI (zero deps) |
| **Flowti Plugin** | `Development/flowti/` | Obsidian IBDE plugin (EventBus-driven) |

## Git

- **Git root is here** (`c:\Projects\flowti`), NOT at either project root.
- Use full paths for `git mv`, `git add`, etc.
- `git index.lock` can get stale on Windows — `rm -f .git/index.lock` if needed.

## Flowti CLI Quick Reference

```bash
# Build
cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs

# Test (5,920 tests, 317 suites)
cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts

# Type check
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json

# Lint
cd "01 - Projects/Flowti CLI" && npx eslint src/ --config configs/eslint.config.mjs

# Run CLI interactively
.\flowti.cmd
```

## Flowti Plugin Quick Reference

```bash
# Test (7,697 tests, 331 suites)
cd "Development/flowti" && npm test

# Build
cd "Development/flowti" && npm run build

# Dev (watch mode)
cd "Development/flowti" && npm run build:dev
```

## Architecture Rules

1. **Infrastructure -> Domain -> Controller -> UI** — strict dependency direction
2. **Domain is pure** — domain files must NEVER import infrastructure singletons. Use deps injection.
3. **Controllers are thin** — parse flags, call domain, return `CliResponse<T>` with typed data + renderer
4. **UI is presentation-only** — renderers take typed data models, produce ANSI output
5. **Config is the contract** — projects declare capabilities in `configs/flowti.config.json`
6. **Sitemap drives the UI** — all interactive menus defined in `configs/sitemap.json` (v2 PageObject format)
7. **Zero dependencies** — runtime uses Node.js built-ins exclusively

## Key Config Files

| File | Purpose |
|------|---------|
| `01 - Projects/Flowti CLI/configs/sitemap.json` | Declarative UI definition (28 pages, v2 PageObject) |
| `01 - Projects/Flowti CLI/configs/flowti.config.json` | CLI's own project config |
| `01 - Projects/Flowti CLI/configs/tsconfig.json` | TypeScript config |
| `01 - Projects/Flowti CLI/configs/vitest.config.ts` | Vitest config |
| `01 - Projects/Flowti CLI/configs/eslint.config.mjs` | ESLint config |
| `.flowti/config.json` | Vault-level config (source project path) |

## Non-Interactive CLI Commands

Every interactive action has a non-interactive equivalent:

```bash
flowti help                                    # List all commands
flowti info --project="Flowti CLI" --format=json  # Project diagnostics
flowti build --project="Flowti CLI"            # Build project
flowti test --project="Flowti CLI"             # Run tests
flowti health --project="Flowti CLI" --format=json  # Health score
flowti reports --project="Flowti CLI"          # Generate reports
flowti events:list --project="Flowti Plugin"   # List events
flowti sitemap:validate                        # Validate sitemap.json
```

## Memory System

Persistent memory files are in `.claude/projects/c--Projects-flowti/memory/`. See `MEMORY.md` there for the index.
