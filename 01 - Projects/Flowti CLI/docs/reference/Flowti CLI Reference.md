---
type: CLIReference
date: "2026-03-10T14:59:57.166Z"
sections: 0
cli_commands: 36
npm_scripts: 10
report_generators: 0
doc_generators: 1
---

# Flowti CLI Reference

> [!info] Summary
> CLI commands: 36 | Help sections: 0 | npm scripts: 10
> Report generators: 0 | Doc generators: 1

---

## Quick Start

```bash
flowti                      # Interactive menu (Start → Project → Detail)
flowti build                # Non-interactive: fast build
flowti help                 # Show full help
flowti info                 # Project stats
```

## Architecture

The CLI is project-centric. On launch you select a project, then work within its context:

```
Start Menu (Load / Create / Import)
  └─ Project Detail Menu
       ├─ 1-3) Capture      Idea, Note, Bug
       ├─ 4) Make           Scaffold code from templates
       ├─ 5) Build          Build + Build Report
       ├─ 6) Review         E2E test sessions
       ├─ 7) Publish        Gated release pipeline
       ├─ 8) Reports        Report generators
       ├─ d) Documentation  Generate reference docs
       ├─ n) Npm Scripts    Browse package.json scripts
       ├─ k) Knowledgebase  Vault search (Obsidian CLI)
       ├─ h) Health         Quality gate, tech debt, trends
       ├─ i) Info           Project diagnostics
       ├─ c) Components     Browse project components
       ├─ e) Events         Event catalog (list, add)
       ├─ s) Scaffold       Definitions & marketplace
       ├─ g) Dependencies   Project dependency graph
       ├─ t) Dev Tools      Type check, lint, reload
       └─ x) Export         Reports to HTML, bundles
```

## Non-Interactive Commands

All commands can be run directly without the interactive menu:

| Command | Description |
|---|---|
| `flowti help` | Show help (optionally for a section) |
| `flowti build` | Fast build (esbuild only, no reports) |
| `flowti build:increment` | Full CI pipeline: check → build → test → e2e → docs → distribute |
| `flowti build:full` | Flow tests → build → all reports |
| `flowti build:watch` | Watch mode with hot-reload (add --reload) |
| `flowti build:distribute` | Build + distribute to endpoints |
| `flowti test` | Type check + lint + vitest |
| `flowti test:increment` | Check + build + vitest with coverage |
| `flowti test:e2e` | Build + flow tests + E2E suite |
| `flowti review` | List E2E journeys (interactive session) |
| `flowti publish` | Build release pipeline |
| `flowti publish:all` | Increment → E2E → release (stops on failure) |
| `flowti reports` | Generate all report notes |
| `flowti report:{id}` | Generate a single report by ID (e.g. report:test) |
| `flowti docs` | Generate all reference documents (CLI Reference, Entity Reference) |
| `flowti dev:reload` | Reload plugin in Obsidian via CLI |
| `flowti dev:console` | Open Obsidian developer console stream |
| `flowti dev:errors` | Open Obsidian error stream |
| `flowti dev:check` | Run lint + tsc (no tests) |
| `flowti dev:lint` | Run ESLint on src/ |
| `flowti make:plugin` | Scaffold a new plugin (--name required, --id, --author) |
| `flowti make:app` | Scaffold a new DDD application (--name required, --id, --author) |
| `flowti capture:idea` | Capture an idea (--text="...") |
| `flowti capture:note` | Capture a typed note (--type, --title="...") |
| `flowti capture:bug` | Capture a bug report (--title="...") |
| `flowti events:list` | List all events in the project event catalog |
| `flowti events:add` | Add an event (--name="user.created" --domain="user") |
| `flowti info` | Show project stats, version, config |
| `flowti build:check` | Check build freshness (source vs dist) |
| `flowti build:auto` | Auto-build if stale |
| `flowti build:record` | Record build manifest |
| `flowti reports:html` | Export all reports to HTML |
| `flowti marketplace:export` | Export marketplace bundle |
| `flowti marketplace:import` | Import definitions from remote registry |
| `flowti health` | Display project health dashboard |
| `flowti deps` | Show project dependency graph |

## npm Scripts (Plugin)

| Script | Command |
|---|---|
| `dev` | `node configs/esbuild.config.mjs --watch` |
| `build` | `node configs/esbuild.config.mjs` |
| `test` | `npm run check && vitest run --config configs/vitest.config.ts` |
| `test:watch` | `vitest --config configs/vitest.config.ts` |
| `test:ui` | `vitest --config configs/vitest.config.ts --ui --coverage.enabled=true` |
| `test:coverage` | `vitest run --config configs/vitest.config.ts --coverage --reporter=json --outputFile=reports/tests/testreport.json` |
| `check` | `npm run lint && tsc --project configs/tsconfig.json --noEmit` |
| `lint` | `eslint --config configs/eslint.config.mjs src/` |
| `typedoc` | `typedoc --options configs/typedoc.json` |
| `analysis` | `tsx src/domain/reports/cli/run-analysis.ts` |

## Documentation Generators

1 documentation generators configured in `flowti.config.json`:

| Label | Command |
|---|---|
| Codebase (TypeDoc) | `npm run typedoc` |

## Make Configuration

Scaffold output paths (`flowti.config.json` → `make`):

## Configuration Files

| File | Purpose |
|---|---|
| `.flowti/config.json` | Global CLI config: projects folder, capture paths, onboarding |
| `flowti.config.json` | Per-project config: tools, build/test/review/publish commands, reports, docs |
| `build-endpoints.json` | Distribution endpoints for multi-vault deploy |
| `manifest.json` | Obsidian plugin metadata (id, version, author) |
| `package.json` | npm scripts, dependencies |
