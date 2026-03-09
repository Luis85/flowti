---
type: Architecture
domain: CLI
title: Flowti CLI — Architecture Document
version: 16
created: 2026-03-07
updated: 2026-03-09
status: living-document
---

# Flowti CLI — Architecture Document

> Living document. Reflects the current implementation (status quo) and the target architecture derived from PRD v7. Updated as the codebase evolves.

---

## 1. Overview

The Flowti CLI is a **definition-driven project orchestrator** that ships as a self-contained Node.js binary. It manages multi-project development workflows — scaffolding, building, testing, reviewing, publishing, and reporting — from a single interactive menu or via non-interactive commands for AI agent tool use.

**Scale**: 171 source files, 108 test files (1,724 tests, 98 suites), 18 domain modules, 21 infrastructure modules. Zero production dependencies — runs on Node.js built-ins only.

---

## 2. Status Quo

### 2.1 System Context

```
┌───────────────────────────────────────────────────────────────────┐
│                        Vault Root (c:\Projects\flowti\)           │
│                                                                   │
│  ┌──────────────── CLI Binary ──────────────────────────────┐     │
│  │  .flowti/bin/main.js   (self-contained esbuild bundle)   │     │
│  │  .flowti/bin/index.js  (bootstrap launcher)              │     │
│  │                                                           │     │
│  │  Bundled:  Scaffold definitions (JSON)                    │     │
│  │            Component definitions (8 kinds, JSON)          │     │
│  │            Template functions (6 registries)              │     │
│  │            Generator functions (6 report + 4 reference)   │     │
│  │            All infrastructure + domain logic              │     │
│  └────────────┬──────────────────────────────────────────────┘     │
│               │                                                    │
│       ┌───────▼──────────────────────────────────────────┐         │
│       │  01 - Projects/                                   │         │
│       │                                                   │         │
│       │  Flowti CLI/      ← CLI source (dev only)         │         │
│       │  Flowti Plugin/   ← user project                  │         │
│       │  Project B/       ← user project                  │         │
│       │  ...                                              │         │
│       └───────────────────────────────────────────────────┘         │
│                                                                   │
│       .flowti/var/state.json     ← persistent CLI state           │
│       .flowti/config.json        ← vault-level configuration      │
│       .flowti/plugins/           ← vault-level plugin manifests   │
│       .flowti/ai-tools/          ← vault-level AI tool defs       │
│                                                                   │
│       Each project has:                                           │
│       ├── configs/flowti.config.json   (tools, publish, review)   │
│       ├── package.json                 (scripts, dependencies)    │
│       ├── docs/components/             (component documentation)  │
│       ├── docs/events/                 (event catalog)            │
│       └── src/                         (source code)              │
└───────────────────────────────────────────────────────────────────┘
```

### 2.2 Invocation Chain

```
flowti.cmd
  └── node .flowti/bin
        └── index.js (bootstrap)
              ├── Derives vault root from .flowti/bin/ → ../../
              ├── Reads .flowti/config.json for source location
              ├── npm ci (if node_modules missing)
              ├── npm run build (if main.js missing)
              └── node .flowti/bin/main.js (CLI)
                    ├── Non-interactive: parseArgs → resolveCommand → handler
                    └── Interactive: Start Menu → Project Detail → tool action
```

**Bootstrap** (`src/boot/bootstrap.mjs` → deployed as `.flowti/bin/index.js`): The only file outside the bundle. Ensures dependencies and build exist before running the CLI. This is the "zero-install" experience — `node .flowti/bin` always works.

### 2.3 Two-Loop Menu Architecture

```
┌─────────────────── Start Menu ───────────────────────┐
│                                                       │
│  ┌─ Open Project (list from 01 - Projects/)           │
│  ├─ Create Project (bundled scaffold definitions)     │
│  ├─ Plugins (list, validate, create, reference)       │
│  ├─ AI Tools (list, validate, create, reference)      │
│  └─ Quit                                              │
│                                                       │
│  Selection persisted → .flowti/var/state.json         │
│                                                       │
│  ┌────────────── Project Detail Menu ──────────────┐  │
│  │                                                  │  │
│  │  1  Make           (scaffold journey/component)   │  │
│  │  2  Build          (mapped from config)          │  │
│  │  3  Review         (E2E, test vault)             │  │
│  │  4  Publish        (gated pipeline)              │  │
│  │  c  Components     (browse, C4 metadata)         │  │
│  │  e  Events         (event catalog)               │  │
│  │  ─────────────────────────────────────────       │  │
│  │  5  Reports        (submenu, run all/individual) │  │
│  │  6  Npm Scripts    (from package.json)           │  │
│  │  ─────────────────────────────────────────       │  │
│  │  7  Capture Idea                                 │  │
│  │  8  Capture Note                                 │  │
│  │  ─────────────────────────────────────────       │  │
│  │  d  Documentation  (Update All, CLI/Entity Ref.)  │  │
│  │  k  Knowledgebase  (Obsidian opt-in)             │  │
│  │  i  Info           (project diagnostics)         │  │
│  │  ─────────────────────────────────────────       │  │
│  │  b  Back to Start Menu                           │  │
│  │  ?  Help (contextual man-page)                   │  │
│  │  q  Quit                                         │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

### 2.4 Layer Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       Entry Point                            │
│  main.ts — orchestrator (two-loop menu + command dispatch)   │
└───────────┬──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────┐
│                       Domain Layer (18 modules)              │
│                                                              │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐            │
│  │ Project │ │ Scaffold │ │  Make  │ │  Build  │            │
│  └─────────┘ └──────────┘ └────────┘ └─────────┘            │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐            │
│  │ Reports │ │  Review  │ │Publish │ │ Capture │            │
│  └─────────┘ └──────────┘ └────────┘ └─────────┘            │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐            │
│  │ Events  │ │   Help   │ │  Info  │ │   E2E   │            │
│  └─────────┘ └──────────┘ └────────┘ └─────────┘            │
│  ┌───────────┐ ┌──────────┐ ┌──────────────────┐            │
│  │Onboarding │ │ DevTools │ │ Knowledgebase    │            │
│  └───────────┘ └──────────┘ └──────────────────┘            │
│  ┌─────────┐ ┌──────────┐ ┌──────────────────┐              │
│  │ Plugins │ │ AI Tools │ │     Health       │              │
│  └─────────┘ └──────────┘ └──────────────────┘              │
│                                                              │
│  Each domain exports:                                        │
│    commands: Record<string, CommandHandler>  (non-interactive)│
│    menu() or xxxMenu()                      (interactive)    │
└───────────┬──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────┐
│                  Infrastructure Layer (21 modules)            │
│                                                              │
│  ┌────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐ ┌────────┐  │
│  │ config │ │ dispatch │ │  menu  │ │  shell  │ │  state │  │
│  └────────┘ └──────────┘ └────────┘ └─────────┘ └────────┘  │
│  ┌────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐ ┌────────┐  │
│  │document│ │    ui    │ │ input  │ │   fs    │ │filesys.│  │
│  └────────┘ └──────────┘ └────────┘ └─────────┘ └────────┘  │
│  ┌────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐ ┌────────┐  │
│  │ paths  │ │   proc   │ │ clock  │ │ logger  │ │  args  │  │
│  └────────┘ └──────────┘ └────────┘ └─────────┘ └────────┘  │
│  ┌────────────┐ ┌─────────────┐ ┌────────┐ ┌──────────────┐  │
│  │ test-vault │ │ frontmatter │ │ errors │ │cmd-registry  │  │
│  └────────────┘ └─────────────┘ └────────┘ └──────────────┘  │
│  ┌────────┐ ┌────────┐                                       │
│  │ output │ │ types  │                                       │
│  └────────┘ └────────┘                                       │
│                                                              │
│  All I/O behind abstractions: IFileSystem, IShell, IProcess  │
│  All time behind clock abstraction                           │
└──────────────────────────────────────────────────────────────┘
```

**Dependency rule**: Domain → Infrastructure. Never Infrastructure → Domain. Never Domain → Domain (cross-domain). `main.ts` is the sole composition root.

### 2.5 Non-Interactive Command Dispatch

```
process.argv → parseArgs() → { command, flags }
                                     │
                              resolveCommand()  ← pure function, no I/O
                                     │
                         ┌───────────┴───────────────┐
                         │  DispatchResult            │
                         │  ├── "help"   → showHelp() │
                         │  ├── "run"    → handler()  │
                         │  ├── "no-project"          │
                         │  ├── "unknown"             │
                         │  └── "none"   → interactive│
                         └───────────────────────────┘

PROJECT_FREE commands: help, project, capture:*, scaffold:*,
  plugin:*, ai:*
All others (reports, report:*, docs, build, review, publish, etc.)
require --project=<name> or a persisted selection.
```

### 2.6 Definition-Driven Scaffolding

The CLI uses a three-tier definition system. All definitions are imported directly (`import ... from "./x.json" with { type: "json" }`) so esbuild inlines them into the bundle.

#### Scaffold Definitions (project creation)

```
ScaffoldDefinition (JSON, bundled)
  ├── id, name, description
  ├── prompts[]           ← user inputs to collect
  ├── files[]             ← file mappings with {{variable}} interpolation
  └── postCreate[]        ← commands to run after creation

Pipeline:  prompts → variables → buildScaffoldPlan() → FileEntry[] → fileWriter
```

Currently 1 bundled definition: `flowti-project.json`.

#### Component Definitions (8 kinds)

```
ComponentDefinition (JSON, bundled)
  ├── id, kind, label, description
  ├── prompts[]           ← user inputs (name, description, technology, etc.)
  ├── files[]             ← templateId + path with {{variable}} interpolation
  ├── properties[]        ← ECS-compatible key-value pairs (typed, defaults)
  ├── metadata            ← kind-specific metadata (c4Level, etc.)
  └── nextSteps[]         ← guidance after creation

Pipeline:  prompts → variables → buildComponentPlan() → FileEntry[] → fileWriter
```

| Kind | C4 Level | Files Generated |
|------|----------|-----------------|
| component | — | docs, test, definition |
| layout | — | docs, test, definition, story |
| page | — | docs, test, definition, story |
| ui-component | — | docs, test, definition, story |
| system | 1 | docs, test, definition |
| container | 2 | docs, test, definition |
| c4-component | 3 | docs, test, definition |
| person | 0 | docs, test, definition |

#### Template Registry

```typescript
type ComponentTemplateFn = (vars: ComponentVariables, def: ComponentDefinition) => string | Document;
```

Separates "what to create" (definitions) from "how to render" (templates). Templates are pure functions. Markdown doc templates (`component-doc`, `c4-doc`) return a `Document` for YAML-safe frontmatter and standardized rendering. Non-markdown templates (test, definition, story) return raw strings. The plan builder calls `.toString()` at the boundary.

### 2.7 Report & Reference Generation Architecture

The CLI separates **reports** (timestamped point-in-time snapshots) from **references** (stable living documents). Both use the same `GeneratorFn` type but different registries and output patterns.

```
┌──────────────────── Report Pipeline ──────────────────────┐
│                                                            │
│  flowti reports  (or interactive Reports menu)             │
│                                                            │
│  flowti.config.json → reports.generators[]                 │
│    ├── { id: "test",       prerequisites: [...] }          │
│    ├── { id: "coverage",   prerequisites: [...] }          │
│    ├── { id: "codebase",   prerequisites: [...] }          │
│    ├── { id: "complexity", prerequisites: [...] }          │
│    ├── { id: "status" }                                    │
│    └── { id: "summary" }                                   │
│                                                            │
│  runAllReports(generators, projectPath)                     │
│    ├── Deduplicate prerequisites                           │
│    ├── For each: prereqs → registry lookup → GeneratorFn   │
│    ├── Collect: success, duration, output, warnings        │
│    └── Never stop on failure → Print Run Summary           │
│                                                            │
│  Report Registry (6 built-in):                             │
│    test, coverage, codebase, complexity, status, summary   │
│                                                            │
│  Output: ReportService.save()                              │
│    ├── reports/{subdir}/{timestamp}-{slug}.md  (archived)  │
│    ├── reports/{Title}.md                      (stable)    │
│    └── reports/{subdir}/{slug}.json            (data copy) │
└────────────────────────────────────────────────────────────┘

┌──────────────────── Reference Pipeline ───────────────────┐
│                                                            │
│  flowti docs  (or interactive Documentation menu)          │
│                                                            │
│  1. Config generators (e.g. TypeDoc → shell command)       │
│  2. Built-in reference generators (via ReferenceRegistry)  │
│                                                            │
│  Reference Registry (2 built-in):                          │
│    cli-reference    → generateCliReference                 │
│    entity-reference → generateEntityReference              │
│                                                            │
│  Domain Reference Generators (2 standalone):               │
│    plugin:reference  → generatePluginReference             │
│    ai:reference      → generateAiToolReference             │
│                                                            │
│  Output: ReportService.saveReference()                     │
│    └── docs/reference/{Title}.md               (stable)   │
│         (configurable via docs.referenceDir)               │
└────────────────────────────────────────────────────────────┘
```

**Resilience**: The report runner never stops on failure. Each generator runs independently. Failed reports are signals captured in the summary, not blockers.

**Warnings**: Generators return `warnings?: string[]` for non-fatal issues (coverage below threshold, lint warnings, TypeDoc warnings, high complexity). The summary displays individual lint issues with file:line detail.

**Self-contained**: All generators run in-process via the binary. No npm script indirection — the CLI is the sole orchestrator. `npm run` is only used for tool prerequisites that require external binaries (vitest, typedoc, complexity-report).

### 2.8 E2E Review & Test Vault

```
c:\Projects\
├── flowti\                       ← Vault (git repo)
│   ├── .flowti/bin/              ← CLI build
│   └── 01 - Projects/
│       └── Flowti CLI/           ← CLI source
├── Flowti CLI-e2e\               ← Test vault (outside git)
│   └── .flowti/bin/              ← Copied CLI build
```

The Review tool creates test vaults **outside the git repository**. The current CLI build is copied into the test vault's `.flowti/bin/` so `node .flowti/bin` works identically.

E2E journeys are defined per-project and run via Vitest with the E2EService orchestrator.

### 2.9 Configuration Hierarchy

```
.flowti/config.json                     ← Vault-level (source path, capture, subsystems)
  └── <project>/configs/flowti.config.json  ← Per-project (tools, make, reports, publish, review)
       └── <project>/package.json       ← npm ecosystem (scripts, dependencies)
```

**Path resolution** (`config.ts`):
1. `FLOWTI_VAULT_ROOT` env var (set by bootstrap in production)
2. Walk up from `process.cwd()` looking for `.flowti/config.json` (dev mode)
3. Derive `VAULT_ROOT`, `CLI_PROJECT`, `PROJECTS_DIR`

### 2.10 Bundling Constraints

The CLI is bundled by esbuild into a single `main.js`:

- `import.meta.dirname` resolves to `.flowti/bin/`, not the source tree
- JSON definitions must be imported directly (esbuild inlines them)
- No runtime filesystem reads for definitions
- External tools (TypeDoc, ESLint, complexity) are invoked via `shell.run()` in the project directory

### 2.11 Testing Strategy

```
tests/
├── domain/            ← Unit tests per domain (mirrors src/domain/)
├── infrastructure/    ← Unit tests per infrastructure module
├── integration/       ← Multi-module integration tests
├── e2e/               ← 5 journey E2E tests
├── helpers/           ← Test vault helpers
└── mocks/             ← Mock implementations
    ├── mock-clock.ts  ← Deterministic time
    ├── mock-fs.ts     ← In-memory filesystem
    ├── mock-proc.ts   ← Controlled process
    └── mock-shell.ts  ← Configurable shell (exit codes, output)
```

All I/O is behind abstractions (`IFileSystem`, `IShell`, `IProcess`, `clock`), making every domain function testable without touching the real filesystem.

---

## 3. Core Principles

1. **Self-Contained Binary** — `node .flowti/bin` is the sole runtime. No source tree required.
2. **Definition-Driven** — JSON definitions are the single source of truth for scaffolding. The CLI is a definition processor, not a code generator with magic numbers.
3. **Deterministic** — Same inputs produce same outputs. No hidden state.
4. **Progressive Opt-In** — Projects start minimal. Tests, lint, coverage, complexity, publish pipelines, E2E — all opt-in via config.
5. **Signals, Not Blockers** — Report generation runs resiliently. Only publish pipelines enforce gating.
6. **Obsidian Opt-In** — Knowledgebase and vault features are available but never required.
7. **Testable Infrastructure** — All I/O behind typed abstractions for unit testing.
8. **Zero Dependencies** — Runtime uses Node.js built-ins exclusively. Dev tooling is devDependencies only.

---

## 4. Target Architecture

The target architecture extends the status quo to fulfill all PRD v7 requirements. All functional requirements (FR-01 through FR-14) are complete. Remaining work targets planned improvements (IMP-10 through IMP-18).

### 4.1 Non-Interactive Project Selection (IMP-01) — DONE

`resolveProjectContext()` in `main.ts` validates `--project=<name>` against available projects. Invalid names show available alternatives. `PROJECT_FREE` commands bypass project resolution.

### 4.2 Config Validation (IMP-06) — DONE

`config-schema.ts` provides `validateProjectConfig(raw): ConfigValidationResult` with 45 test cases. `readProjectConfig()` returns `ReadConfigResult { config, warnings }`. Validates: required `name`, tool commands, make templates, report generators, publish endpoints, docs generators, review config, unknown keys.

### 4.3 Report Archive Navigation (IMP-03) — DONE

`report-archive.ts` discovers timestamped `.md` files in report subdirectories. Reports menu has "Browse Archive" (`key: "a"`) that lists categories and lets users view past reports.

### 4.4 Reference Generation System — DONE

The CLI separates **reports** (timestamped snapshots in `reports/`) from **references** (stable living documents in `docs/reference/`). Each has its own registry and service method.

**Reference Registry** (`reference-registry.ts`): 2 built-in generators:
- `entity-reference` — Entity dictionary (9 entities with description, purpose, locations, config keys, commands, artifacts, relationships)
- `cli-reference` — CLI command reference (non-interactive commands, help sections, npm scripts, config files)

**Domain Reference Generators** (standalone, outside registry):
- `plugin:reference` — Plugin Reference listing all installed plugins, commands, versions, and validation status
- `ai:reference` — AI Tool Reference listing all tool definitions, parameters, tags, and validation status

**ReportService.saveReference()**: Writes a single stable file to `docs/reference/` (configurable via `docs.referenceDir`). No timestamps, no archive copies.

**CLI command**: `flowti docs` runs config generators (e.g. TypeDoc) + all built-in reference generators.

**Interactive**: Documentation menu → "Update All" runs config generators + reference generators. Plugin and AI Tool references are generated via their own menus and commands (`plugin:reference`, `ai:reference`).

### 4.5 Developer Onboarding E2E Journey (FR-12) — DONE

`tests/e2e/60-journey-developer-onboarding.test.ts` — 7 tests covering: help, help build, scaffold:list, unknown command handling, invalid `--project` validation, journey JSON validity. Uses `spawnSync` with `tsx` to run CLI directly.

### 4.6 Component Relationships (IMP-04) — DONE

`component-list.ts` provides `enrichComponentRelationships()` which populates `contains[]` by reversing `containedBy` edges. `buildAncestryPath()` builds a "System > Container > Component" breadcrumb with circular reference guard. `findSiblings()` returns components sharing the same parent. The component detail view shows ancestry, children, and siblings. 11 new tests.

### 4.7 Event Catalog Enrichment (IMP-14) — DONE

**Payload field editor** (`event-payload.ts`): Interactive loop prompts for field name, type, required, description. Non-interactive via `--payload="userId:string:required:The user ID,..."`.

**Event versioning** (`event-versioning.ts`): `versionEvent()` updates frontmatter + appends version history. `events:version` CLI command. `renderVersionHistory()` adds a Version History section to event docs.

**Event commands** (`event-commands.ts`): Extracted non-interactive commands (`events:list`, `events:add`, `events:flow`, `events:version`) from `event-catalog.ts` for separation of concerns.

### 4.8 Component Property Editor (IMP-15) — DONE

`component-makers.ts` prompts for property values during interactive scaffolding via `collectPropertyValues()`. Properties rendered in frontmatter and Properties table by Document-based templates.

`component-edit.ts` provides `edit:component --name=X --prop.key=value` for post-creation property editing. Uses shared `splitFrontmatter()`/`joinFrontmatter()` from `infrastructure/frontmatter.ts` and local `extractPropFlags()`. 15 new tests.

### 4.9 Event Flow Visualization (IMP-16) — DONE

`event-flow.ts` builds a directed graph from event producer/consumer metadata. Three renderers:
- `renderMermaidFlowchart()` — full Mermaid `graph LR` diagram
- `renderMermaidByDomain()` — per-domain Mermaid diagrams
- `generateEventFlowDoc()` — complete Document with all flow diagrams

`saveEventFlowDoc()` writes to `docs/events/Event Flow.md`. Interactive menu item + `events:flow` command with optional `--domain` filter. 27 new tests.

### 4.10 Document Service as Template Foundation (D-19) — DONE

Markdown doc templates (`component-doc.ts`, `c4-doc.ts`) refactored from raw string concatenation to the fluent `Document` builder. Gains YAML-safe frontmatter escaping via `yamlEscape()` and standardized rendering. `ComponentTemplateFn` return type widened to `string | Document`. Plan builders call `.toString()` at the boundary.

`Document` extended with `toLines(): string[]` for array output. Four output modes: `Document` (compose further), `toString()` (string), `toLines()` (array), `save()` (write to disk).

### 4.11 Frontmatter Consolidation (D-22) — DONE

Consolidated 7 duplicate frontmatter parsers into `infrastructure/frontmatter.ts` — the single source of truth for all frontmatter operations. Four exports:

| Function | Signature | Purpose |
|---|---|---|
| `parseFrontmatterContent` | `(content) → Record<string, unknown> \| null` | Typed scalars + arrays |
| `parseFrontmatterStrings` | `(content) → Record<string, string>` | String-only values |
| `splitFrontmatter` | `(content) → { frontmatter, body } \| null` | Parse + body separation |
| `joinFrontmatter` | `(fm, body) → string` | Serialize back to markdown |

**Replaced duplicates in**: `event-catalog.ts`, `event-flow.ts`, `component-list.ts`, `component-edit.ts`, `summary-loaders.ts`, `generate-status-report.ts`, `fs.ts`. The specialized `devtools/frontmatter-utils.ts` (field insertion/replacement for fix-frontmatter) remains separate. 11 new tests.

### 4.12 Structured Error Handling (D-26) — DONE

Two error classes in `infrastructure/errors.ts`:

| Class | Use Case | Display |
|-------|----------|---------|
| `CliError(message, guidance)` | User-facing: missing config, invalid input, failed prerequisites | Message + guidance, no stack trace |
| `InternalError(message)` | Developer bug: broken invariants, missing registry entries | Full stack trace |

`formatError(err)` formats any error for display. `isCliError(err)` type guard for catch blocks. The global catch in `main()` routes `CliError` to clean output and everything else to debug output.

**Throw site classification:**
- `config.ts` (vault root not found) → `CliError` with recovery guidance
- `command-registry.ts` (key collision) → `InternalError` (programming bug)
- `scaffold-plan.ts` / `component-plan.ts` (unknown template) → `InternalError` (broken definition)
- `report-runner.ts` (prerequisite failed) → kept as `Error` (caught internally by resilient runner)

### 4.13 Input Consolidation (D-28) — DONE

Two overlapping input modules (`readline.ts` with manual `createRL()`/`rl.close()` lifecycle, and `input.ts` with auto-managed `ask()`) consolidated into a single `input.ts` abstraction. Added `askYesNo(question, defaultNo?)` to the `IInput` interface. E2E domain (5 files) migrated from passing readline interfaces through function parameters to using `input.ask()` / `input.askYesNo()` directly. Duplicate `ask()`/`askYesNo()` removed from `e2e-helpers.ts`. ESLint config updated. `readline.ts` deleted. 11 new tests.

### 4.14 Storybook Integration (IMP-17) — DONE

Storybook v10 (`@storybook/html` + `@storybook/html-vite`) becomes an **opt-in, per-project component library** managed entirely from the Components menu (`c`).

**Design:**

```
Components Menu (key "c")
  ├── Browse components          (existing)
  ├── Add component (Make)       (existing — generates .stories.ts)
  ├── Edit component             (existing)
  ├── ─────────────
  ├── s) Storybook dev           (dynamic — enabled when installed)
  ├── k) Storybook build         (dynamic — enabled when installed)
  └── i) Install Storybook       (dynamic — disabled when installed)
```

Menu items use **dynamic `disabled` functions** re-evaluated each loop iteration, so installing Storybook immediately enables dev/build without restarting.

**Opt-in flow:**
1. User selects "Install Storybook" from the Components menu
2. CLI scaffolds `<project>/component-library/` with Storybook v10 config, `package.json`, and starter structure
3. Runs `npm install` in `component-library/`
4. Sets `components.storybook: true` in `flowti.config.json`
5. Subsequent `make:*` commands generate `.stories.ts` files targeting the installed instance

**Config addition** (`flowti.config.json`):
```json
{
  "components": {
    "storybook": true,
    "storybookDir": "component-library"
  }
}
```

**Storybook v10 specifics:**
- No `react`/`react-dom` dependencies (pure HTML framework)
- Autodocs via `tags: ["autodocs"]` in preview (not `docs.autodocs` in main)
- Actions imported from `storybook/actions` (not `@storybook/addon-actions`)
- Stories path: `../../src/components/**/*.stories.@(ts|tsx)` (relative to `.storybook/`)
- Stories excluded from `tsconfig.json` and `typedoc.json` to prevent TS compilation errors

**Story template — render function pattern**: Stories are **self-contained** — they do not import component modules. Instead, each story's `render: (args) => { ... }` creates DOM elements directly:
- Properties mapped to `el.dataset.*` attributes and `el.textContent`
- Actions wired as `el.addEventListener()` handlers
- No component class import needed — stories work even before the component module exists

**Component data model** (`ComponentDefinition`): Expanded for full Storybook compatibility. Each component definition now carries:
- `properties` — configurable attributes (type, default, description) → Storybook controls
- `actions` — event handlers (onClick, onFocus, etc.) → Storybook action loggers via `storybook/actions`
- `variants` — named presets of prop combinations (Primary, Secondary, etc.) → individual named story exports
- `states` — interactive states with prop overrides (hover, loading, disabled, etc.) → individual named story exports
- `icon` — component icon identifier → Storybook parameters
- `heroImage` — hero image path → Storybook parameters
- `images[]` — additional image assets → documentation
- `domain` — business domain classification → Storybook parameters and documentation

This means a single `ComponentDefinition` carries everything needed to generate a complete, multi-story Storybook file with controls, actions, variant stories, and state stories — all from the JSON blueprint.

**Files:**
- New: `domain/make/component/storybook-service.ts` — install, detect, wrap npm scripts (Storybook v10)
- Modify: `component-types.ts` — added `ComponentAction`, `ComponentVariant`, `ComponentState`, `icon`, `heroImage`, `images[]`, `domain`
- Modify: `component-story.ts` — self-contained render function (DOM creation), kind-aware folder organization, `storybook/actions` import, parameters block (icon, heroImage, domain)
- Modify: `component-doc.ts` — renders Actions, Variants, States, Images tables and domain in documentation
- Modify: `component-definition.ts` — includes all expanded fields in generated JSON
- Modify: `component-list.ts` — dynamic Storybook menu items (disabled functions for state-aware gating)
- Modify: `config-schema.ts` — validate `components.storybook` and `components.storybookDir`
- Modify: all 8 JSON definitions — added `actions`, `variants`, `states` arrays (meaningful defaults for UI kinds, empty for C4)

### 4.15 Npm Scripts Submenu Persistence — DONE

Running an npm script from the project detail menu's "Npm Scripts" submenu now **returns to the submenu** instead of the project main menu. Script actions return `undefined` (stay in menu loop) instead of `"main"`. This matches user expectations — after running a script, you typically want to run another or review options, not navigate back to the top.

### 4.16 TypeDoc Error Parsing Enhancement — DONE

`parseTypedocOutput()` in `summary-loaders.ts` now captures **two error formats**:
1. TypeDoc's own messages: `[warning] ...` / `[error] ...`
2. TypeScript compilation errors emitted by TypeDoc: `file.ts:line:col - error TSxxxx: ...`

Previously only format 1 was captured, causing TS compilation errors during TypeDoc runs to be silently lost. The summary report now surfaces both.

### ~~4.17 E2E Onboarding Journey (FR-12)~~ — moved to 4.5 (DONE)

---

## 5. Development Roadmap

### Phase 1: Foundation Hardening — COMPLETE

All items delivered. 45 new tests for config validation, `--project` flag with invalid-name handling, report archive browser, Entity Reference generator with Documentation menu redesign.

| # | Task | Status | Files |
|---|------|--------|-------|
| 1.1 | **Config validation** (IMP-06) | DONE | `project/config-schema.ts`, `project-config.ts` (ReadConfigResult) |
| 1.2 | **Non-interactive project selection** (IMP-01) | DONE | `main.ts` (resolveProjectContext), `project.ts` (listProjects) |
| 1.3 | **Developer onboarding E2E journey** (FR-12) | DONE | `tests/e2e/60-journey-developer-onboarding.test.ts` (7 tests) |
| 1.4 | **Report archive browsing** (IMP-03) | DONE | `reports/report-archive.ts`, `mainMenu.ts` |
| 1.5 | **Entity Reference generator** | DONE | `reports/generators/entity-reference.ts`, `reference-registry.ts` |
| 1.6 | **Documentation menu redesign** | DONE | `mainMenu.ts` (Update All + built-in generators) |
| 1.7 | **Report/Reference separation** | DONE | `reference-registry.ts`, `report-service.ts` (saveReference), `generator-registry.ts` (6 reports) |
| 1.8 | **CLI Reference as reference generator** | DONE | `generators/cli-reference.ts` (GeneratorFn pattern), `reference-registry.ts` |
| 1.9 | **`flowti docs` command** | DONE | `reports/reports.ts` (docs command: config generators + built-in references) |
| 1.10 | **npm script cleanup** | DONE | `package.json` (17→10 scripts), `flowti.config.json` (remove npm indirections) |

**Milestone**: All PRD v4 acceptance criteria passing. 1,256 tests, 78 suites. 0 lint errors, 0 warnings.

### Phase 2: Component & Event Enrichment — COMPLETE

All items delivered plus Document service refactor, frontmatter consolidation, structured errors, and structured output. 104 new tests. 0 lint warnings (down from 19).

| # | Task | Status | Files |
|---|------|--------|-------|
| 2.1 | **Component relationships** (IMP-04) | DONE | `component-list.ts` (enrichment, ancestry, siblings), `component-types.ts` (contains[]) |
| 2.2 | **Component property editor** (IMP-15) | DONE | `component-makers.ts` (collectPropertyValues), `component-edit.ts` (new), `make-commands.ts` |
| 2.3 | **Event payload field editor** (IMP-14) | DONE | `event-payload.ts` (new), `event-catalog.ts` |
| 2.4 | **Event versioning** (IMP-14) | DONE | `event-versioning.ts` (new), `event-commands.ts` (new) |
| 2.5 | **Event flow visualization** (IMP-16) | DONE | `event-flow.ts` (new), `event-catalog.ts` (menu) |
| 2.6 | **Document-based templates** (D-19) | DONE | `component-doc.ts`, `c4-doc.ts` (refactored), `document.ts` (toLines), `component-types.ts` |
| 2.7 | **Lint cleanup** (19 warnings → 0) | DONE | 13 files split/refactored for complexity and max-lines |
| 2.8 | **Frontmatter consolidation** (D-22) | DONE | `infrastructure/frontmatter.ts` (4 exports), 7 domain files refactored |
| 2.9 | **Local type alias audit** (6.12) | DONE | No remaining duplicates — all domain files use shared `infrastructure/types.ts` |
| 2.10 | **Report label fix** ("Tests" → "Test") | DONE | `summary-loaders.ts`, `summary-details.ts`, `summary-promotion.ts`, `summary-analyzers-ext.ts`, `report-archive.ts` |
| 2.11 | **Events domain facade** (6.1) | DONE | `domain/events/events.ts` (re-exports commands + eventCatalogMenu) |
| 2.12 | **Typed CommandRegistry** (6.2) | DONE | `infrastructure/command-registry.ts` (new), `main.ts` (refactored to registerDomain) |
| 2.13 | **Menu builder extraction** (6.3) | DONE | `domain/menu-builders.ts` (new), `mainMenu.ts` (350→190 LOC) |
| 2.14 | **Structured error handling** (6.6) | DONE | `infrastructure/errors.ts` (new), `main.ts`, `config.ts`, `command-registry.ts`, `scaffold-plan.ts`, `component-plan.ts` |
| 2.15 | **Structured CLI output** (6.4) | DONE | `infrastructure/output.ts` (new), `info.ts` (collectProjectInfo), `event-commands.ts` (events:list --format=json) |
| 2.16 | **Input consolidation** (D-28) | DONE | `infrastructure/input.ts` (askYesNo), `readline.ts` (deleted), `e2e-helpers.ts`, `e2e-interactive.ts`, `e2e-session.ts`, `e2e-audit.ts`, `e2e-teardown.ts` |
| 2.17 | **Complexity extraction** (collectProjectInfo) | DONE | `info.ts` (19→3 helpers: collectSourceInfo, collectDependencyInfo, collectGitInfo) |

**Milestone**: C4 entities form a navigable hierarchy. Components are editable post-creation. Event catalog supports full lifecycle. Document service is the sole markdown renderer for doc templates. Frontmatter parsing consolidated to single infrastructure module. Command registration typed with collision detection. Menu construction extracted into pure builder functions. Structured error handling established. `--format=json` output pattern established. Single input abstraction for all interactive prompts. 1,451 tests, 88 suites → grew to 1,724 tests, 98 suites after Phase 3. 0 lint errors, 0 warnings.

### Phase 3: Project Health & Storybook Integration

Aggregate project metrics and integrate with the broader development ecosystem.

| # | Task | Effort | Impact | Files |
|---|------|--------|--------|-------|
| 3.1 | **Project health dashboard** (IMP-05) | DONE | High | New: `domain/health/health.ts` (`collectHealth`, `displayHealth`, `HealthSnapshot`), Modify: `mainMenu.ts` (health menu item), 20 new tests |
| 3.2 | **Review pipeline gating** (IMP-07) | DONE | Medium | `review/project-review.ts` (build→test→E2E gating), `review/review.ts` (review:all command), 15 new tests |
| 3.3 | **Storybook v10 integration** (IMP-17) | DONE | High | New: `storybook-service.ts` (install, detect, dev/build), Modify: `component-list.ts` (dynamic disabled menu gating), `config-schema.ts` (components validation), `types.ts` (ComponentsConfig), component data model expanded with `actions`, `variants`, `states`, `icon`, `heroImage`, `images[]`, `domain` for full Storybook v10 compatibility, self-contained render function pattern in stories, stories excluded from tsconfig/typedoc, TypeDoc TS error parsing, npm scripts submenu persistence, 37 new tests |
| 3.4 | **Definition marketplace** (IMP-09) | L | Medium | New: `domain/scaffold/marketplace.ts` |

**Milestone**: Projects have a health score. Review enforces quality gates. Storybook v10 is a first-class, opt-in component library tool managed from the Components menu with dynamic state-aware gating. Component data model expanded with icon, heroImage, images, domain for rich documentation and Storybook parameters. TypeDoc error parsing captures both native and TS compilation errors. 1,724 tests, 98 suites. 0 lint errors, 0 warnings.

### Phase 3.5: Plugin System & AI Tools — COMPLETE

Vault-level extensibility via plugins and AI tool definitions. Both managed from the Start Menu with full CRUD and reference document generation.

| # | Task | Status | Files |
|---|------|--------|-------|
| 3.5.1 | **Plugin system** (IMP-13, FR-13) | DONE | New: `domain/plugins/` (plugin-loader.ts, plugin-commands.ts, plugin-reference.ts, plugin-types.ts, plugins.ts facade), 32 tests |
| 3.5.2 | **AI Tool management** (IMP-19, FR-14) | DONE | New: `domain/ai-tools/` (ai-tool-loader.ts, ai-tool-commands.ts, ai-tool-reference.ts, ai-tool-types.ts, ai-tools.ts facade), 30 tests |
| 3.5.3 | **Start Menu extension** | DONE | Modify: `project.ts` (Plugins `p`, AI Tools `a` entries), `main.ts` (register domains + project-free commands) |
| 3.5.4 | **Reference generation** | DONE | Plugin and AI Tool Reference documents generated via Document service to `docs/reference/` |
| 3.5.5 | **Health dashboard fix** | DONE | Modify: `health.ts` (frontmatter key fallbacks for coverage, tests, lint metrics) |

**Milestone**: CLI extensibility via vault-level plugins and AI tools. Start Menu has 5 entries (Open, Create, Plugins, AI Tools, Quit). Plugin commands auto-registered with collision detection. 1,724 tests, 98 suites. 0 lint errors, 0 warnings.

### Phase 4: Cross-Project & Automation

Long-term vision for multi-project management and CI/CD integration.

| # | Task | Effort | Impact | Files |
|---|------|--------|--------|-------|
| 4.1 | **Cross-project dependencies** (IMP-10) | L | High | New: `domain/project/dependencies.ts` |
| 4.2 | **CI/CD workflow generation** (IMP-11) | L | Medium | New: `domain/build/ci-generator.ts` |
| 4.3 | **Self-update mechanism** (IMP-12) | M | Medium | Modify: `boot/bootstrap.mjs` |
| ~~4.4~~ | ~~**Plugin system** (IMP-13)~~ | ~~XL~~ | ~~High~~ | Done — Phase 3.5 |
| 4.5 | **Event contract testing** (IMP-18) | M | Medium | New: `domain/events/contract-testing.ts` |

**Milestone**: CLI manages inter-project relationships. CI/CD is generated from config. Plugin extensibility.

### Effort Legend

| Size | Scope |
|------|-------|
| S | ≤ 3 files, ≤ 200 LOC, 1 domain |
| M | 4–8 files, ≤ 500 LOC, 1–2 domains |
| L | 9–15 files, ≤ 1000 LOC, may introduce new domain |
| XL | 15+ files, new architectural pattern |

---

## 6. Improvement Opportunities

Structural improvements to address as the codebase grows:

### ~~6.1 Domain Module Consistency~~ — PARTIALLY RESOLVED

Events domain now has a facade file (`events.ts`) re-exporting `commands` and `eventCatalogMenu`. Other domains (make, scaffold) already had facades. Remaining domains can adopt the pattern as they grow. See D-23.

### ~~6.2 Command Registry Typing~~ — RESOLVED

`CommandRegistry` class (`infrastructure/command-registry.ts`) replaces spread-based command merging. Detects key collisions at registration time, tracks domain metadata, derives project-free set. `main.ts` uses `registry.registerDomain()` with explicit domain names and project-free lists. 12 new tests. See D-24.

### ~~6.3 Menu Builder Abstraction~~ — RESOLVED

Submenu construction extracted from `mainMenu.ts` into `menu-builders.ts`. Three pure builder functions (`buildReportsSubmenu`, `buildDocsSubmenu`, `buildNpmScriptsSubmenu`) reduce mainMenu.ts from ~350 to ~190 lines. Each builder returns `MenuEntry[]` and is independently testable. See D-25.

### ~~6.4 Structured CLI Output~~ — PARTIALLY RESOLVED

`infrastructure/output.ts` provides `resolveFormat(flags)` and `printOutput(format, data, renderer)`. Pattern established and applied to `info` (with `collectProjectInfo()` data extraction) and `events:list`. Remaining commands can adopt the pattern incrementally — each needs a data-collection function separating pure data from display. 7 new tests in `output.test.ts`. See D-27.

### ~~6.5 Report Generator Plugin Pattern~~ — DEFERRED

External commands already work via the `command` field in `flowti.config.json`. True plugin-style self-registration would be over-engineering — the current registry pattern is explicit, testable, and only modified when adding new built-in generators (rare). Revisit if external generator count grows significantly.

### ~~6.6 Error Handling Consistency~~ — RESOLVED

`CliError` (user-facing, with guidance) and `InternalError` (developer bug, with stack trace) in `infrastructure/errors.ts`. The top-level catch in `main()` formats them differently via `formatError()`. Existing throw sites refactored: `config.ts` → `CliError`, `command-registry.ts`/`scaffold-plan.ts`/`component-plan.ts` → `InternalError`. `isCliError()` type guard available for catch blocks. 12 new tests. See D-26.

### ~~6.7 State Expansion~~ — DEFERRED

Feature work, not refactoring. The current single-field state (`selectedProject`) is sufficient. Recent projects, generator timestamps, and persisted publish state are Phase 3+ features that should be driven by concrete user needs.

### ~~6.8 Document Service Adoption Gap~~ — RESOLVED

100% adoption confirmed. All 38 markdown-generating files use the `Document` builder. Non-markdown templates (TypeScript, JSON, config) correctly use raw strings — `Document` is markdown-only by design. No gap remains.

### ~~6.9 Event Catalog Frontmatter Parsing~~ — RESOLVED (4.11)

Consolidated 7 duplicate parsers into `infrastructure/frontmatter.ts`. See section 4.11.

### ~~6.10 Coverage Gap~~ — ACCEPTABLE

Pure functions are well-covered (1,724 tests). Remaining low-coverage files are: (1) report generators — I/O-heavy, tested via output shape; (2) interactive flows — thin wrappers over tested `menu.ts` infrastructure; (3) E2E orchestration — covered by integration tests. Adding unit tests for these yields diminishing returns. Coverage will grow organically as new features add tests.

### ~~6.11 Complexity Hotspots~~ — ACCEPTABLE

Top 10 complex files are mostly E2E report generators (stable, rarely modified) and `config-schema.ts` (already well-structured with extracted validator functions). Phase 2 lint cleanup already reduced actively-modified files. Remaining complexity is intrinsic to the problem domain (many conditional report sections). Low ROI for further splitting.

### ~~6.12 Local Type Aliases~~ — RESOLVED

Audit complete. All domain files correctly import shared types from `infrastructure/types.ts`. No remaining duplicates found. Domain-specific types (e.g. `KBChoice`, `AnalyzerFn`, `LineRule`) are appropriately local.

---

## 7. Key File Reference

### Entry Points

| File | Purpose |
|------|---------|
| `src/main.ts` | Interactive CLI orchestrator, command dispatch |
| `src/boot/bootstrap.mjs` | Zero-install launcher (deployed to `.flowti/bin/index.js`) |
| `src/domain/mainMenu.ts` | Project detail menu builder (delegates submenus to `menu-builders.ts`) |
| `src/domain/menu-builders.ts` | Pure submenu builders — Reports, Documentation, Npm Scripts |
| `src/infrastructure/dispatch.ts` | Pure command resolution (no I/O) |

### Infrastructure

| File | Purpose |
|------|---------|
| `infrastructure/types.ts` | All cross-cutting type definitions |
| `infrastructure/config.ts` | Vault root + CLI project path resolution |
| `infrastructure/filesystem.ts` | `IFileSystem` abstraction (`disk` singleton) |
| `infrastructure/shell.ts` | Shell execution (`run`, `runSilent`, `runCaptureStatus`) |
| `infrastructure/state.ts` | Persistent state (`.flowti/var/state.json`) |
| `infrastructure/document.ts` | Fluent Markdown builder — 4 output modes: `Document` (compose), `toString()`, `toLines()`, `save()` |
| `infrastructure/frontmatter.ts` | Single source of truth for YAML frontmatter — parse (typed/string/split) + serialize (`joinFrontmatter`) |
| `infrastructure/errors.ts` | Structured error types — `CliError` (user-facing + guidance), `InternalError` (developer bug), `formatError()`, `isCliError()` |
| `infrastructure/output.ts` | Structured output — `resolveFormat()`, `printOutput()` for `--format=json` support |
| `infrastructure/command-registry.ts` | Typed command registry — collision detection, domain metadata, derived project-free set |
| `infrastructure/menu.ts` | Generic data-driven menu loop |
| `infrastructure/ui.ts` | ANSI colors, `printBanner()`, `printMenu()` |
| `infrastructure/input.ts` | Interactive input — `ask()`, `askYesNo()` (sole input abstraction, replaces readline.ts) |
| `infrastructure/clock.ts` | Time abstraction (ISO timestamps) |
| `infrastructure/proc.ts` | Process abstraction (exit, argv, cwd, env) |
| `infrastructure/paths.ts` | Path utilities |
| `infrastructure/logger.ts` | `log()`, `error()` |
| `infrastructure/args.ts` | CLI argument parser |
| `infrastructure/test-vault.ts` | Test vault scaffold/teardown |

### Domains

| Domain | Key Files | Responsibility |
|--------|-----------|----------------|
| Project | `project.ts`, `project-config.ts` | Project selection, initialization, auto-scaffolding |
| Scaffold | `scaffold-service.ts`, `scaffold-plan.ts`, `scaffold-schema.ts` | Project creation from JSON definitions |
| Make | `MakeService.ts`, `makers.ts`, `make-commands.ts` | In-project scaffolding (journey, component) |
| Component | `component-registry.ts`, `component-plan.ts`, `component-types.ts`, `component-list.ts`, `component-edit.ts`, `storybook-service.ts` | 8-kind component system with properties, actions, variants, states (Storybook-compatible), C4 hierarchy, post-creation editing, opt-in Storybook |
| Reports | `report-runner.ts`, `generator-registry.ts` (6 reports), `reference-registry.ts` (2 refs), `report-archive.ts` | Resilient report generation, reference documents, archive browsing |
| Review | `project-review.ts`, `E2EService.ts` | E2E test execution, test vault management |
| Publish | `project-publish.ts` | Gated build → test → distribute pipeline |
| Events | `event-catalog.ts`, `event-commands.ts`, `event-payload.ts`, `event-versioning.ts`, `event-flow.ts` | Event documentation, payload editing, versioning, flow visualization |
| Build | `build.ts` | Build command dispatch |
| Capture | `capture.ts` | Quick-capture ideas and typed notes |
| Help | `help.ts` | 8-section man-page system |
| Info | `info.ts` | Project diagnostics display |
| DevTools | `devtools.ts`, `cli-reload.ts`, `fix-frontmatter.ts` | Development utilities |
| Onboarding | `onboarding.ts` | Node.js version check, prerequisite validation |
| Knowledgebase | `knowledgebase.ts`, `vault-service.ts` | Obsidian vault interaction (opt-in) |
| Plugins | `plugin-loader.ts`, `plugin-commands.ts`, `plugin-reference.ts`, `plugin-types.ts` | Vault-level plugin discovery, validation, scaffolding, reference generation |
| AI Tools | `ai-tool-loader.ts`, `ai-tool-commands.ts`, `ai-tool-reference.ts`, `ai-tool-types.ts` | Vault-level AI tool definition management, validation, scaffolding, reference generation |
| Health | `health.ts` | Project health dashboard — aggregates test/coverage/lint/git metrics |

### Configuration

| File | Scope | Purpose |
|------|-------|---------|
| `.flowti/config.json` | Vault | CLI source path, projects folder, subsystems, capture dirs |
| `<project>/configs/flowti.config.json` | Per-project | Tools, make, reports, docs, publish, review |
| `<project>/package.json` | Per-project | npm scripts, dependencies |

---

## 8. Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| D-01 | esbuild bundle (not tsc output) | Single-file deployment, tree-shaking, fast builds (< 200ms) |
| D-02 | JSON definitions imported directly | esbuild inlines them; no runtime fs reads; self-contained binary |
| D-03 | Separate bootstrap file | Bootstrap must work without dependencies; it installs them |
| D-04 | I/O abstractions everywhere | Every domain function testable without real filesystem |
| D-05 | Generator registry (not shell spawning) | Report generators run in-process; faster, testable, no npx overhead |
| D-06 | Prerequisite deduplication | `npm run test:coverage` shared by test + coverage generators; run once |
| D-07 | Warnings separate from success | Generators succeed with warnings; three-state display (pass/warn/fail) |
| D-08 | Test vaults outside git | Prevent E2E artifacts from polluting the vault repository |
| D-09 | Zero production dependencies | Minimizes supply chain risk; Node.js built-ins are sufficient |
| D-10 | Component properties as ECS | Aligns with game-engine entity-component-system patterns; composable |
| D-11 | Entity Reference as built-in generator | Self-documenting ecosystem; entities tracked in code, not wiki |
| D-12 | Documentation menu always available | Built-in generators (Entity Reference) ensure "Update All" is never empty |
| D-13 | ReadConfigResult wrapper | Config loading returns `{ config, warnings }` for structured error reporting |
| D-14 | Separate report/reference registries | Reports (timestamped snapshots) vs references (stable living docs) have fundamentally different output patterns |
| D-15 | `saveReference()` method | Single file to `docs/reference/` — no timestamps, no JSON copies, configurable via `docs.referenceDir` |
| D-16 | `flowti docs` as first-class command | CLI binary owns documentation generation; eliminates npm script indirection for reference docs |
| D-17 | Lean package.json (10 scripts) | Heavy lifting done by CLI binary; npm scripts only for external tool invocation (vitest, typedoc, eslint) |
| D-18 | No standalone entry points in generators | Generators are callable via registry only; eliminates `process.argv` lint violations and dead code |
| D-19 | Document-based doc templates | Markdown doc templates return `Document` (not raw strings); gains YAML escaping, standardized rendering, 4 output modes |
| D-20 | `CommandHandler` from shared types | Domain modules import `CommandHandler` from `infrastructure/types.ts`; eliminates local type aliases, resolves TypeDoc warnings |
| D-21 | Event domain split into 5 files | `event-catalog.ts` (interactive), `event-commands.ts` (non-interactive), `event-payload.ts`, `event-versioning.ts`, `event-flow.ts`; each under 300 LOC |
| D-22 | Frontmatter consolidation | 7 duplicate parsers replaced by 4 shared functions in `infrastructure/frontmatter.ts`; single source of truth for parse + serialize |
| D-23 | Domain facade pattern | Multi-file domains expose a facade (`events.ts`) re-exporting public API; `main.ts` imports from facade, not internals |
| D-24 | Typed CommandRegistry | Class-based registry replaces spread-merge; collision detection at registration time; domain metadata preserved |
| D-25 | Submenu builder extraction | Pure `MenuEntry[]` builder functions in `menu-builders.ts`; mainMenu.ts delegates submenu construction; builders are independently testable |
| D-26 | Structured error types | `CliError` (message + guidance, clean display) vs `InternalError` (stack trace for debugging); `formatError()` routes display; global catch boundary in main.ts |
| D-27 | Structured CLI output | `resolveFormat(flags)` + `printOutput(format, data, renderer)` in `output.ts`; commands extract pure data (e.g. `collectProjectInfo()`), then format at the boundary; `--format=json` for AI agent consumption |
| D-28 | Input consolidation | `readline.ts` deleted; `input.ts` is the sole input abstraction (`ask`, `askYesNo`); E2E domain migrated from manual `createRL()`/`rl.close()` to `input.*`; duplicate `ask`/`askYesNo` removed from `e2e-helpers.ts` |
| D-29 | Storybook v10 (not v8) | v10 removes react/react-dom peer deps, moves actions to `storybook/actions`, uses `tags: ["autodocs"]` in preview; pure HTML framework aligns with CLI's zero-dependency philosophy |
| D-30 | Self-contained story render functions | Stories create DOM elements directly in `render: (args) => { ... }` instead of importing component modules; stories work before components exist; no broken imports |
| D-31 | Dynamic menu disabled functions | `MenuItem.disabled` accepts `() => boolean` re-evaluated each menu loop iteration; enables state-aware gating (e.g. Storybook install status changes mid-session) |
| D-32 | Stories excluded from tsconfig + typedoc | Story files import from `storybook/actions` which isn't in the project's node_modules; TypeDoc's `exclude` only filters output, not TS compilation; tsconfig exclude prevents compilation errors |
| D-33 | Npm scripts submenu persistence | Script actions return `undefined` (stay in loop) not `"main"` (exit to parent); users typically run multiple scripts in sequence |
| D-34 | Vault-level plugins (not project-level) | Plugins extend the CLI itself, not individual projects; `.flowti/plugins/` is vault-scoped, discoverable from any project context |
| D-35 | Subdirectory-based plugin manifests | Each plugin gets `<name>/manifest.json` (not flat `<name>.json`); enables future assets, scripts, or config per-plugin |
| D-36 | Flat-file AI tool definitions | AI tools are simple JSON documents (`<name>.json` in `.flowti/ai-tools/`); no subdirectory needed — tools are self-contained metadata |
| D-37 | Domain reference generators (not registry) | Plugin and AI Tool references use standalone generators invoked from their own commands, not the central ReferenceRegistry; decouples vault-level domains from per-project report pipeline |
| D-38 | Plugin command namespacing | Plugin commands registered as `plugin:<pluginName>:<cmdName>` to avoid collisions with built-in commands; collision detection at registration time |
