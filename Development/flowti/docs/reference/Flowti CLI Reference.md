---
type: CLIReference
date: "2026-03-07T11:40:36.826Z"
sections: 8
cli_commands: 25
npm_scripts: 38
report_generators: 14
---
# Flowti CLI Reference

> [!info] Summary
> CLI commands: 25 | Help sections: 8 | npm scripts: 38 | Report generators: 14

---

## Quick Start

```bash
npm run flowti              # Interactive menu
npm run flowti -- build     # Non-interactive: fast build
npm run flowti -- help      # Show full help
npm run flowti -- info      # Project stats
```

## Make (Scaffolding)

MAKE — Scaffold boilerplate code from Flowti patterns.

### OPTIONS

  1) New Hub
     Scaffolds a complete hub within the Flowti plugin:
- UI view (BaseHubView subclass with tabs)
- Domain layer (service stub, events, types)
- Hub provider (HubDashboardProvider for cross-hub)
- Test file (vitest + happy-dom setup)
- CSS layer file
- Feature PRD document
- E2E journey stub

     Prompts: hub name, icon, hub type, initial tabs

  2) New Plugin
     Scaffolds a standalone Obsidian plugin following Flowti patterns:
- DDD folder structure (infrastructure, domain, ui)
- EventBus backbone
- BaseHubView base class
- esbuild config with CSS pipeline
- TypeScript, ESLint, Vitest setup
- package.json with focused npm scripts

     Prompts: plugin name, plugin ID, author

### CONFIGURATION

  Output paths are configurable in flowti.config.json under "make":
- `make.hub.ui` — UI source folder (default: src/ui)
- `make.hub.domain` — Domain source folder (default: src/domain)
- `make.hub.tests` — Test folder (default: tests/ui)
- `make.hub.css` — CSS folder (default: css)
- `make.hub.docs` — Feature docs folder (default: docs/features)
- `make.hub.journeys` — E2E journeys folder (default: tests/e2e/journeys)
    make.plugin.output Plugin output folder (default: ../)

## Build

BUILD — Compile the Flowti plugin.

### OPTIONS

  1) Build (fast)
     Runs esbuild in production mode. No tests, no reports.
     Concatenates CSS from css/ sources. Copies assets to output.
     → node esbuild.config.mjs --production --no-reports
     → Typical time: ~2s

  2) Build increment
     Full CI pipeline: lint → tsc → build → vitest (coverage) → E2E →
     TypeDoc → all reports → distribute to endpoints.
     → npm run build:increment
     → Typical time: ~90s

  3) Build full
     Flow tests gate the build, then generates all reports.
     → npm run build:full

  4) Watch mode
     Starts esbuild in watch mode. CSS changes auto-rebuild.
     Add --reload flag to hot-reload the plugin in Obsidian.
     → node esbuild.config.mjs --watch [--reload]

  5) Distribute
     Copies build artifacts to endpoints defined in build-endpoints.json.
     Each endpoint has a name, path, and optional clean flag.
     → node esbuild.config.mjs --production --distribution

### ESBUILD FLAGS

- `--production` — Minify + tree-shake (default for non-watch)
- `--no-reports` — Skip report generation after build
- `--distribution` — Copy to endpoint vaults
- `--increment` — Mark build as increment in reports
- `--publish` — Release mode (distribution + reports)
- `--reload` — Auto-reload plugin after each watch build
- `--watch` — Watch mode (inline sourcemaps, no minify)

## Review (E2E)

REVIEW — E2E testing and vault management.

### OPTIONS

  1) Start test session
     Opens the interactive E2E runner. Select journeys, configure
     step filters, run tests, view results.
     → node scripts/run-e2e.mjs --list

  2) Build the increment
     Full CI pipeline (same as Build → option 2).
     Must pass before publishing is unlocked.

  3) Publish the increment
     Gated — requires a successful increment build in this session.
     Runs the release pipeline.

  4) Teardown test vault
     Resets the E2E test vault to a fresh state:
     deletes content, purges ghost index, resets installer state.

  5) Rebuild
     Full teardown → re-run prerequisites → installer journey.

E2E JOURNEYS (6 available)
  getting-started, component-library, canvas-session,
  tool-showcase, tool-reference, journey-builder

### ENVIRONMENT VARIABLES

  E2E_VAULT_DIR       Test vault path (default: ../flowti-e2e)
  E2E_JOURNEY         Comma-separated journey names
  E2E_RUN_INSTALLER   Set "true" to force installer
  E2E_STEPS           Step filter (e.g., journey-name:1,2,5)

## Publish

PUBLISH — Gated release pipeline.

The publish flow tracks pipeline state across three stages.
Each stage must pass before the next unlocks.

### PIPELINE

  ✓/○ Build  →  ✓/○ Test  →  ✓/○ Publish

### OPTIONS

  1) Build the increment
     Runs the full increment build. On success, unlocks testing.

  2) Test the increment (E2E)
     Runs the full E2E suite. Requires a passing build.
     On success, unlocks publishing.

  3) Publish the increment
     Runs the release pipeline (check → build → test → docs → publish).
     Requires passing build AND test.

  a) Run all
     Runs build → test → publish in sequence.
     Stops on first failure.

## Reports

REPORTS — Generate vault report notes.

All reports are written as Obsidian notes with YAML frontmatter,
making them queryable via Dataview or the Flowti query engine.

### OPTIONS

  1) Build all reports
     Runs all 14 report generators in sequence.
     → npm run generate:reports

  2) Build selected report
     Pick one report to generate. Reports are configured
     in flowti.config.json under reports.scripts.

  3) Build audit report
     Collects the latest frontmatter from all report categories
     and writes a consolidated audit note to docs/reports/audits/.

REPORT TYPES (14)
  Test Report          Vitest results + perf summary
  Coverage Report      V8 line/branch/function coverage
  Build Report         Bundle size, duration, warnings
  Codebase Report      TypeDoc metrics (classes, LOC)
  Cycle Report         Cycle metadata + PBIs + test stats
  Trace Report         PRD → PBI → Test → Code linkage
  Command Reference    All plugin commands (~40)
  Event Catalog        All events (~443) by category
  Data Dictionary      18 entity types, 131 fields
  Performance Report   Startup/storage/query metrics
  Complexity Report    Cyclomatic complexity per file
  Tool Reference       30 E2E journey tools
  E2E Report           Journey results + screenshots
  CLI Reference        CLI commands, help sections, npm scripts

### OUTPUT PATHS

  Timestamped:  docs/reports/{type}/YYYY-MM-DD-*.md
  Stable:       docs/reference/{name}.md
  Audits:       docs/reports/audits/{name}.md

## Dev Tools

DEV TOOLS — Developer utilities for the Obsidian plugin.

### OPTIONS

  1) Reload plugin
     Hot-reloads the flowti-ibde plugin via Obsidian CLI.
     Requires Obsidian 1.12+ running with CLI enabled.
     → node scripts/cli-reload.mjs

  2) Dev console
     Opens the Obsidian developer console stream.
     → obsidian dev:console

  3) Dev errors
     Opens the Obsidian error stream.
     → obsidian dev:errors

  4) Fix frontmatter
     Scans docs/ for missing type: and stage: fields (ADR-030).
     Runs in dry-run mode first — confirms before writing.
     → node scripts/fix-frontmatter.mjs [--dry-run]

  5) Generate test data
     Creates 8 CSV files for Analytics Hub dashboard testing.
     Supports --from, --to, --seed, --out flags.
     → node scripts/generate-test-data.mjs

  6) Type check
     Runs ESLint + TypeScript type-check (no tests).
     → npm run check

  7) Lint
     Runs ESLint on src/ only.
     → npm run lint

OBSIDIAN CLI (requires Obsidian 1.12+)
  The Obsidian CLI provides vault management, plugin control,
  and code execution capabilities. The ObsidianCli class
  (src/infrastructure/cli/ObsidianCli.ts) wraps 20 methods:
  file ops, plugin management, eval, DOM queries, screenshots.

## Info

INFO — Project information and diagnostics.

Shows live project statistics gathered from:
- manifest.json (plugin version, min Obsidian version)
- package.json (dependencies, script count)
- Source tree (file counts, test counts)
- Git (branch, commit, status)
- flowti.config.json (report scripts, paths)

Use this to quickly check project health before starting work.

## Non-Interactive Commands

All commands can be run directly without the interactive menu:

| Command | Description |
|---------|-------------|
| `npm run flowti -- help` | Show help (optionally for a section) |
| `npm run flowti -- build` | Fast build (esbuild only, no reports) |
| `npm run flowti -- build:increment` | Full CI pipeline: check → build → test → e2e → docs → distribute |
| `npm run flowti -- build:full` | Flow tests → build → all reports |
| `npm run flowti -- build:watch` | Watch mode with hot-reload (add --reload) |
| `npm run flowti -- build:distribute` | Build + distribute to endpoints |
| `npm run flowti -- test` | Type check + lint + vitest |
| `npm run flowti -- test:increment` | Check + build + vitest with coverage |
| `npm run flowti -- test:e2e` | Build + flow tests + E2E suite |
| `npm run flowti -- review` | List E2E journeys (interactive session) |
| `npm run flowti -- publish` | Build release pipeline |
| `npm run flowti -- publish:all` | Increment → E2E → release (stops on failure) |
| `npm run flowti -- reports` | Generate all 13 report notes |
| `npm run flowti -- reports:audit` | Generate reports for audit review |
| `npm run flowti -- dev:reload` | Reload plugin in Obsidian via CLI |
| `npm run flowti -- dev:console` | Open Obsidian developer console stream |
| `npm run flowti -- dev:errors` | Open Obsidian error stream |
| `npm run flowti -- dev:check` | Run lint + tsc (no tests) |
| `npm run flowti -- dev:lint` | Run ESLint on src/ |
| `npm run flowti -- dev:fix-frontmatter` | Fix missing frontmatter fields (add --dry-run) |
| `npm run flowti -- dev:testdata` | Generate CSV test data for Analytics |
| `npm run flowti -- make:hub` | Scaffold a new hub (--name required, --icon, --type, --tabs) |
| `npm run flowti -- make:plugin` | Scaffold a new plugin (--name required, --id, --author) |
| `npm run flowti -- info` | Show project stats, version, config |
| `npm run flowti -- report:{id}` | Generate a single report by ID (e.g. report:test) |

## npm Scripts

| Script | Command |
|--------|---------|
| `test` | `npm run check && vitest run` |
| `test:watch` | `npm run check && vitest` |
| `test:ui` | `npm run check && vitest --ui` |
| `test:coverage` | `npm run check && npm run build:only && vitest run --coverage` |
| `test:flows` | `npm run build:only && vitest run tests/flows/ --coverage` |
| `test:e2e` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs` |
| `test:e2e:installer` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=installer` |
| `test:e2e:getting-started` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=getting-started` |
| `test:e2e:components` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=component-library` |
| `test:e2e:canvas-session` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=canvas-session` |
| `test:e2e:tool-showcase` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=tool-showcase` |
| `test:e2e:tool-reference` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=tool-reference` |
| `test:e2e:journey-builder` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=journey-builder` |
| `test:e2e:developer-onboarding` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=developer-onboarding` |
| `test:e2e:journeys` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=getting-started,component-library,canvas-session,tool-showcase,tool-reference,journey-builder,developer-onboarding` |
| `test:e2e:quick` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=installer,getting-started` |
| `test:e2e:list` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --list` |
| `review` | `npm run build:only && vitest run tests/flows/ && node scripts/run-e2e.mjs --list` |
| `report:e2e` | `node scripts/generate-e2e-report.mjs` |
| `build` | `node esbuild.config.mjs --production --no-reports` |
| `build:only` | `node esbuild.config.mjs --production --no-reports` |
| `build:dev` | `node esbuild.config.mjs --watch` |
| `build:full` | `npm run test:flows && node esbuild.config.mjs --production` |
| `dev:reload` | `node scripts/cli-reload.mjs` |
| `dev:console` | `obsidian dev:console` |
| `dev:errors` | `obsidian dev:errors` |
| `build:release` | `npm run check && npm run build:only && vitest run --coverage && npm run docs && node esbuild.config.mjs --publish` |
| `build:increment` | `npm run check && npm run build:only && vitest run --coverage && node scripts/run-e2e.mjs && npm run docs && node esbuild.config.mjs --increment --distribution` |
| `build:distribution` | `npm run check && npm run build:only && vitest run --coverage && npm run docs && node esbuild.config.mjs --distribution` |
| `check` | `npm run lint && tsc -noEmit -skipLibCheck` |
| `lint` | `eslint ./src/` |
| `docs` | `typedoc` |
| `test:increment` | `npm run check && npm run build:only && vitest run --coverage` |
| `reports` | `npm run generate:reports` |
| `flowti` | `node "../../01 - Projects/Flowti CLI/src/flowti-cli.mjs"` |
| `generate:testdata` | `node scripts/generate-test-data.mjs` |
| `generate:reports` | `node scripts/generate-test-report.mjs && node scripts/generate-coverage-report.mjs && node scripts/generate-codebase-report.mjs && node scripts/generate-cycle-report.mjs && node scripts/generate-trace-report.mjs && node scripts/generate-command-reference.mjs && node scripts/generate-event-catalog.mjs && node scripts/generate-data-dictionary.mjs && node scripts/generate-performance-report.mjs && node scripts/generate-complexity-report.mjs && node scripts/generate-tool-reference.mjs && node scripts/generate-cli-reference.mjs` |
| `version` | `node version-bump.mjs && git add manifest.json versions.json` |

## Report Generators

14 report generators are configured in `flowti.config.json`:

| ID | Label | Script |
|----|-------|--------|
| test | Test Report | `generate-test-report.mjs` |
| coverage | Coverage Report | `generate-coverage-report.mjs` |
| build | Build Report | `generate-build-report.mjs` |
| codebase | Codebase Report | `generate-codebase-report.mjs` |
| cycle | Cycle Report | `generate-cycle-report.mjs` |
| trace | Trace Report | `generate-trace-report.mjs` |
| command-ref | Command Reference | `generate-command-reference.mjs` |
| event-catalog | Event Catalog | `generate-event-catalog.mjs` |
| dictionary | Data Dictionary | `generate-data-dictionary.mjs` |
| performance | Performance Report | `generate-performance-report.mjs` |
| complexity | Complexity Report | `generate-complexity-report.mjs` |
| tool-ref | Tool Reference | `generate-tool-reference.mjs` |
| e2e | E2E Report | `generate-e2e-report.mjs` |
| cli-ref | CLI Reference | `generate-cli-reference.mjs` |

## Make Configuration

Scaffold output paths (`flowti.config.json` → `make`):

### Hub Paths

| Key | Path |
|-----|------|
| `make.hub.src` | `src` |
| `make.hub.ui` | `src/ui` |
| `make.hub.domain` | `src/domain` |
| `make.hub.hubDomain` | `src/domain/hub` |
| `make.hub.tests` | `tests/ui` |
| `make.hub.css` | `css` |
| `make.hub.docs` | `docs/features` |
| `make.hub.journeys` | `tests/e2e/journeys` |
| `make.hub.components` | `src/ui/components` |

### Plugin Paths

| Key | Path |
|-----|------|
| `make.plugin.output` | `../` |

## Configuration Files

| File | Purpose |
|------|---------|
| `flowti.config.json` | CLI config: paths, build settings, report scripts, make paths |
| `build-endpoints.json` | Distribution endpoints for multi-vault deploy |
| `manifest.json` | Obsidian plugin metadata (id, version, author) |
| `package.json` | npm scripts, dependencies |
