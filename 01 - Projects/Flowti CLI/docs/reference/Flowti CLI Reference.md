---
type: CLIReference
date: "2026-03-09T01:01:21.512Z"
sections: 10
cli_commands: 27
npm_scripts: 10
report_generators: 0
doc_generators: 1
---

# Flowti CLI Reference

> [!info] Summary
> CLI commands: 27 | Help sections: 10 | npm scripts: 10
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
       ├─ 1) Make          Scaffold code from templates
       ├─ 2) Build         Build + Build Report
       ├─ 3) Review        E2E test sessions
       ├─ 4) Publish       Gated release pipeline
       ├─ c) Components    Browse project components
       ├─ e) Events        Event catalog (list, add)
       ├─ 5) Reports       Report generators
       ├─ 6) Npm Scripts   Browse package.json scripts
       ├─ 7) Capture Idea  Quick-capture to inbox
       ├─ 8) Capture Note  Typed note capture
       ├─ d) Documentation Generate reference docs
       ├─ k) Knowledgebase Vault search (Obsidian CLI)
       └─ i) Info          Project diagnostics
```

## Make (Scaffolding)

MAKE — Scaffold in-project boilerplate from Flowti patterns.

Note: To create a new project, use "Create Project" from the Start Menu
or run: flowti scaffold:new

### OPTIONS

  1) New E2E Journey
     Scaffolds a journey definition with test entry and canvas:
- Journey definition (.journey file)
- Test entry point
- Journey canvas (for Obsidian)

     Prompts: journey name, slug, description

  2) Add Component
     Scaffolds a component from a declarative JSON definition.
     8 component kinds available: component, layout, page, ui-component,
     system, container, c4-component, person.

     Generates: documentation, test file, definition JSON,
     and optionally a Storybook story file.

### CONFIGURATION

  Available templates are configurable in flowti.config.json under "make":
- `make.templates` — Array of template IDs (default: ["journey", "component"])

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
  flowti capture:idea --text "My idea here"
  flowti capture:note --type task --title "Fix login"

### CONFIGURATION

  Capture paths are configurable in .flowti/config.json:
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
| `flowti events:list` | List all events in the project event catalog |
| `flowti events:add` | Add an event (--name="user.created" --domain="user") |
| `flowti info` | Show project stats, version, config |

## npm Scripts (Plugin)

| Script | Command |
|---|---|
| `dev` | `node configs/esbuild.config.mjs --watch` |
| `build` | `node configs/esbuild.config.mjs` |
| `test` | `npm run check && vitest run --config configs/vitest.config.ts` |
| `test:watch` | `vitest --config configs/vitest.config.ts` |
| `test:ui` | `vitest --config configs/vitest.config.ts --ui` |
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
