# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This is an Obsidian vault and git root containing two projects:

| Project | Path | Purpose |
|---------|------|---------|
| **Flowti CLI** | `01 - Projects/Flowti CLI/` | Definition-driven project orchestrator CLI (zero runtime deps) |
| **Flowti Plugin** | `Development/flowti/` | Obsidian IBDE plugin (EventBus-driven) |

The git root is HERE (`c:\Projects\flowti`), not at either project root. Use full paths for `git mv`, `git add`, etc. On Windows, `git index.lock` can get stale — `rm -f .git/index.lock` if needed.

## Flowti CLI Commands

All commands run from `cd "01 - Projects/Flowti CLI"`:

```bash
# Full check (lint + tsc + tests)
npm test

# Individual steps
npx vitest run --config configs/vitest.config.ts          # Tests
npx tsc --noEmit --project configs/tsconfig.json          # Type check
npx eslint src/ --config configs/eslint.config.mjs        # Lint

# Run a single test file
npx vitest run tests/domain/project/project.test.ts --config configs/vitest.config.ts

# Run tests matching a name pattern
npx vitest run -t "pattern" --config configs/vitest.config.ts

# Watch mode
npx vitest --config configs/vitest.config.ts

# Build (outputs to .flowti/bin/main.js)
node configs/esbuild.config.mjs

# Run CLI interactively (from git root)
.\flowti.cmd
```

## Flowti Plugin Commands

All commands run from `cd "Development/flowti"`:

```bash
npm test                    # Full check (lint + tsc + tests)
npm run build               # Production build
npm run build:dev           # Watch mode with hot-reload
npx vitest run -t "pattern" # Run tests matching a name pattern
```

## Architecture Rules

Detailed patterns, DI examples, controller/test templates, and sitemap-driven UI documentation are in `01 - Projects/Flowti CLI/CLAUDE.md`.

### Layer Direction (STRICT — enforced by ESLint)

```
Infrastructure → Domain → Controller → UI
```

- **Domain is pure** — must NEVER import infrastructure singletons. Receives deps via typed injection (`CliDeps`, `ReportDeps`, `E2EDeps`, `MakeDeps`).
- **Controllers are thin** — parse flags, call domain, return `CliResponse<T>` with typed data + renderer.
- **UI is presentation-only** — renderers take typed data models, produce ANSI output.
- **ESLint enforces this** — `configs/eslint.config.mjs` bans direct `node:fs`, `node:path`, `process.*` imports outside infrastructure. Violations fail lint.

### Zero Runtime Dependencies

The CLI uses Node.js built-ins exclusively. No npm runtime deps.

### Config is the Contract

Projects declare capabilities in `configs/flowti.config.json` — build commands, test presets, lint thresholds (`maxComplexity=10`, `maxLines=350`), report generators, health thresholds, management domains.

### Sitemap Drives the UI

All interactive menus declared in `configs/sitemap.json` (v2 PageObject format, 28 pages). Actions, data sources, forms, conditions, and view handlers are registered in `src/ui/handlers/register-handlers.ts`.

### Test Organization

Tests mirror source: `src/domain/foo/bar.ts` → `tests/domain/foo/bar.test.ts`. Tests use `vi.mock()` to stub infrastructure at the top, then import domain functions. E2E journey suites (5) are `describe.skip()` — intentional, journeys not yet built.

## Conventions

- **File naming**: kebab-case (`my-feature.ts`, `my-feature.test.ts`)
- **Imports**: `.js` extension in all imports (ESM)
- **Indentation**: tabs
- **No `any` types**, no `@ts-ignore`, no `TODO`/`FIXME` comments
- **Coverage target**: 80% statements, 80% lines

## Non-Interactive CLI Commands

Every interactive action has a non-interactive equivalent:

```bash
flowti help                                       # List all commands
flowti info --project="Flowti CLI" --format=json  # Project diagnostics
flowti build --project="Flowti CLI"               # Build project
flowti test --project="Flowti CLI"                # Run tests
flowti health --project="Flowti CLI" --format=json # Health score
flowti reports --project="Flowti CLI"             # Generate reports
flowti events:list --project="Flowti Plugin"      # List events
flowti sitemap:validate                           # Validate sitemap.json
flowti claude:sync                                # Sync agents/tools to .claude/skills/
```

## Claude Code Integration

Agent, tool, and skill definitions are available to Claude Code via:

- **`.claude/rules/`** — Static format descriptions (loaded when editing agent/tool files)
- **`.claude/skills/agents/SKILL.md`** — All agent definitions (invoke with `/agents`)
- **`.claude/skills/tools/SKILL.md`** — All tool definitions (invoke with `/tools`)

Skill files are auto-regenerated when agents/tools are created, edited, or deleted (when `claudeSync: true` in `.flowti/config.json`). Manual sync: `flowti claude:sync`.

## Key Config Files

| File | Purpose |
|------|---------|
| `01 - Projects/Flowti CLI/configs/sitemap.json` | Declarative UI definition (v2 PageObject) |
| `01 - Projects/Flowti CLI/configs/flowti.config.json` | CLI's own project config (thresholds, generators, management) |
| `01 - Projects/Flowti CLI/configs/tsconfig.json` | TypeScript config (ES2022, NodeNext, strict) |
| `01 - Projects/Flowti CLI/configs/vitest.config.ts` | Vitest config (forks pool, 70% coverage thresholds) |
| `01 - Projects/Flowti CLI/configs/eslint.config.mjs` | ESLint config (architecture enforcement rules) |
| `.flowti/config.json` | Vault-level config (source project path) |

## Memory System

Persistent memory files are in `.claude/projects/c--Projects-flowti/memory/`. See `MEMORY.md` there for the index.
