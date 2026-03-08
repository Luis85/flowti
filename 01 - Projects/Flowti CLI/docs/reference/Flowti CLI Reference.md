---
type: CLIReference
date: "2026-03-08T14:50:37.053Z"
sections: 10
cli_commands: 25
npm_scripts: 37
report_generators: 14
doc_generators: 0
---

# Flowti CLI Reference

> [!info] Summary
> CLI commands: 25 | Help sections: 10 | npm scripts: 37
> Report generators: 14 | Doc generators: 0

---

## Quick Start

```bash
npm run flowti              # Interactive menu (Start → Project → Detail)
npm run flowti -- build     # Non-interactive: fast build
npm run flowti -- help      # Show full help
npm run flowti -- info      # Project stats
```

## Architecture

The CLI is project-centric. On launch you select a project, then work within its context:

```
Start Menu (Load / Create / Import)
  └─ Project Detail Menu
       ├─ 1) Make          Scaffold code from templates
       ├─ 2) Build         Build + Build Report
       ├─ 3) Review        E2E test sessions
       ├─ 4) Publish       Gated release pipeline
       ├─ 5) Reports       Report generators
       ├─ 6) Dev Tools     Plugin utilities
       ├─ 7) Npm Scripts   Browse package.json scripts
       ├─ 8) Capture Idea  Quick-capture to inbox
       ├─ 9) Capture Note  Typed note capture
       ├─ d) Documentation Generate reference docs
       ├─ k) Knowledgebase Vault search (Obsidian CLI)
       └─ i) Info          Project diagnostics
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

  3) New Application
     Scaffolds a full DDD Obsidian plugin project under 01 - Projects/:
- Working EventBus (~80 LOC) with type-safe events
- Infrastructure layer (events, errors, services)
- Vitest + happy-dom + obsidian-stub test setup
- Starter EventBus test (4 tests, passing on first run)
- esbuild config with CSS pipeline
- AppError base class with code + context
- 17 files total, ready to npm install && npm run build

     Prompts: app name, app ID, author

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

REPORTS — Generate project reports.

Reports are written as markdown notes with YAML frontmatter.
Each project configures its reports dir and generators in flowti.config.json.

PROJECT DETAIL MENU (key 5)
  1) Run All Reports
     Runs the project's configured reports command and generates
     a Project Summary with risks, improvements, and state overview.
     → Reads reports.allCommand or tools.reports from flowti.config.json

  2..n) Individual generators
     Run a single report generator from reports.generators config.

NON-INTERACTIVE (plugin)
  1) Build all reports
     → npm run generate:reports (14 generators)

  2) Build selected report
     Pick one by ID from flowti.config.json → reports.scripts.

  3) Build audit report
     Collects latest frontmatter from report categories
     and writes a consolidated audit note.

### OUTPUT PATHS

  Timestamped:  {reports.dir}/{type}/YYYY-MM-DD-*.md + .json
  Stable:       {reports.dir}/{type}/{Name}.md
  Reference:    docs/reference/{name}.md

### CONFIGURATION

- `reports.dir` — Output directory (default: reports)
- `reports.allCommand` — Command to generate all reports
- `reports.scripts` — Array of { id, label, script } generators

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

## Capture

CAPTURE — Quick-capture ideas and notes into the vault.

### OPTIONS

  1) Capture Idea
     Prompts for an idea and creates a markdown note in the vault
     inbox folder. Filename is derived from the idea text (~60 chars).

  2) Capture Note
     Prompts for a type (Task, Bug, Note, Documentation, Idea)
     then a title. Creates a markdown note in the configured folder.

### FILE FORMAT

  Each captured file includes YAML frontmatter with type and date,
  followed by a heading and optional body text.

NON-INTERACTIVE
  npm run flowti -- capture:idea --text "My idea here"
  npm run flowti -- capture:note --type task --title "Fix login"

### CONFIGURATION

  Capture paths are configurable in flowti-cli.config.json:
- `capture.idea` — Idea folder (default: 00 - Connectivity/inbox)
- `capture.task` — Task folder
- `capture.bug` — Bug folder
- `capture.note` — Note folder
- `capture.documentation` — Documentation folder

  All paths are relative to the vault root.

## knowledgebase

KNOWLEDGEBASE — Browse and search vault content.

### NAVIGATION

  The knowledgebase provides an interactive file browser for the
  Obsidian vault. Folders and markdown files are listed with
  numbered entries — type a number to navigate into a folder
  or view a file.

### COMMANDS

  1..n  Select a folder or file by number
  b      Go back to parent folder
  s      Search vault content (filename + full-text)
  ?      Show this help
  q      Return to project menu

### SEARCH

  Type s to enter search mode. Enter a query to search across
  all markdown files in the vault. Results show up to 20 matches.
  Select a result number to view the file.

  Search uses the Obsidian CLI when available, with a filesystem
  fallback that checks filenames and content (capped at 50 results).

### REQUIREMENTS

- Obsidian CLI 1.12+ (obsidian version)
- An initialized vault (.obsidian/ directory exists)

  If either requirement is missing, the knowledgebase menu item
  in the Project Detail Menu will be disabled.

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
|---|---|
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
| `npm run flowti -- reports` | Generate all report notes |
| `npm run flowti -- report:{id}` | Generate a single report by ID (e.g. report:test) |
| `npm run flowti -- dev:reload` | Reload plugin in Obsidian via CLI |
| `npm run flowti -- dev:console` | Open Obsidian developer console stream |
| `npm run flowti -- dev:errors` | Open Obsidian error stream |
| `npm run flowti -- dev:check` | Run lint + tsc (no tests) |
| `npm run flowti -- dev:lint` | Run ESLint on src/ |
| `npm run flowti -- make:hub` | Scaffold a new hub (--name required, --icon, --type, --tabs) |
| `npm run flowti -- make:plugin` | Scaffold a new plugin (--name required, --id, --author) |
| `npm run flowti -- make:app` | Scaffold a new DDD application (--name required, --id, --author) |
| `npm run flowti -- capture:idea` | Capture an idea (--text="...") |
| `npm run flowti -- capture:note` | Capture a typed note (--type, --title="...") |
| `npm run flowti -- info` | Show project stats, version, config |

## npm Scripts (Plugin)

| Script | Command |
|---|---|
| `test` | `npm run check && vitest run` |
| `test:watch` | `npm run check && vitest` |
| `test:ui` | `npm run check && vitest --ui` |
| `test:coverage` | `npm run check && npm run build && vitest run --coverage` |
| `test:flows` | `npm run build && vitest run tests/flows/ --coverage` |
| `test:e2e` | `npm run build && vitest run tests/flows/ && node scripts/run-e2e.mjs` |
| `test:e2e:installer` | `npm run build && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=installer` |
| `test:e2e:getting-started` | `npm run build && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=getting-started` |
| `test:e2e:components` | `npm run build && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=component-library` |
| `test:e2e:canvas-session` | `npm run build && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=canvas-session` |
| `test:e2e:tool-showcase` | `npm run build && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=tool-showcase` |
| `test:e2e:tool-reference` | `npm run build && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=tool-reference` |
| `test:e2e:journey-builder` | `npm run build && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=journey-builder` |
| `test:e2e:developer-onboarding` | `npm run build && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=developer-onboarding` |
| `test:e2e:journeys` | `npm run build && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=getting-started,component-library,canvas-session,tool-showcase,tool-reference,journey-builder,developer-onboarding` |
| `test:e2e:quick` | `npm run build && vitest run tests/flows/ && node scripts/run-e2e.mjs --journey=installer,getting-started` |
| `test:e2e:list` | `npm run build && vitest run tests/flows/ && node scripts/run-e2e.mjs --list` |
| `review` | `npm run test:e2e:list` |
| `report:e2e` | `node scripts/generate-e2e-report.mjs` |
| `build` | `node esbuild.config.mjs --production --no-reports` |
| `build:dev` | `node esbuild.config.mjs --watch` |
| `build:full` | `npm run test:flows && node esbuild.config.mjs --production` |
| `dev:reload` | `node scripts/cli-reload.mjs` |
| `dev:console` | `obsidian dev:console` |
| `dev:errors` | `obsidian dev:errors` |
| `build:release` | `npm run check && npm run build && vitest run --coverage && npm run docs && node esbuild.config.mjs --publish` |
| `build:increment` | `npm run check && npm run build && vitest run --coverage && node scripts/run-e2e.mjs && npm run docs && node esbuild.config.mjs --increment --distribution` |
| `build:distribution` | `npm run check && npm run build && vitest run --coverage && npm run docs && node esbuild.config.mjs --distribution` |
| `check` | `npm run lint && tsc -noEmit -skipLibCheck` |
| `lint` | `eslint ./src/` |
| `docs` | `typedoc` |
| `test:increment` | `npm run check && npm run build && vitest run --coverage` |
| `reports` | `npm run generate:reports` |
| `flowti` | `node "../../01 - Projects/Flowti CLI/bin/main.js"` |
| `generate:testdata` | `node scripts/generate-test-data.mjs` |
| `generate:reports` | `node scripts/generate-test-report.mjs && node scripts/generate-coverage-report.mjs && node scripts/generate-codebase-report.mjs && node scripts/generate-cycle-report.mjs && node scripts/generate-trace-report.mjs && node scripts/generate-command-reference.mjs && node scripts/generate-event-catalog.mjs && node scripts/generate-data-dictionary.mjs && node scripts/generate-performance-report.mjs && node scripts/generate-complexity-report.mjs && node scripts/generate-tool-reference.mjs && node scripts/generate-cli-reference.mjs` |
| `version` | `node version-bump.mjs && git add manifest.json versions.json` |

## Report Generators

14 report generators configured in `flowti.config.json`:

| ID | Label | Script |
|---|---|---|
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
|---|---|
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
|---|---|
| `make.plugin.output` | `../` |

## Configuration Files

| File | Purpose |
|---|---|
| `flowti-cli.config.json` | Global CLI config: projects folder, capture paths, onboarding |
| `flowti.config.json` | Per-project config: tools, build/test/review/publish commands, reports, docs |
| `build-endpoints.json` | Distribution endpoints for multi-vault deploy |
| `manifest.json` | Obsidian plugin metadata (id, version, author) |
| `package.json` | npm scripts, dependencies |
