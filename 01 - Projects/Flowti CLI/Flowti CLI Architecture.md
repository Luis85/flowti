---
type: Architecture
domain: CLI
title: Flowti CLI — Architecture Document
version: 25
created: 2026-03-07
updated: 2026-03-13
status: living-document
---

# Flowti CLI — Architecture Document

> Living document. Reflects the current implementation (status quo) and the target architecture derived from PRD v15. Updated as the codebase evolves.

---

## 1. Overview

The Flowti CLI is a **definition-driven project orchestrator** that ships as a self-contained Node.js binary. It manages multi-project development workflows — scaffolding, building, testing, reviewing, publishing, and reporting — from a single interactive menu or via non-interactive commands for AI agent tool use.

**Scale**: 372 source files, 279 test files (4,599 tests, 279 suites), 26 domain modules, 41 infrastructure modules, 23 controllers, 71 UI view files, 4 scaffold definitions, 8 component definitions. Zero production dependencies — runs on Node.js built-ins only.

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
│       │  Flowti CLI/      ← CLI source (dev only)         │         │
│       │  Flowti Plugin/   ← user project                  │         │
│       │  Project B/       ← user project                  │         │
│       └───────────────────────────────────────────────────┘         │
│       ┌─────────────────────────────────────────────────┐           │
│       │  02 - Products/     ← standalone product folders  │           │
│       │  03 - Features/     ← standalone feature folders  │           │
│       └─────────────────────────────────────────────────┘           │
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
│       ├── docs/requirements/           (IREB requirements)        │
│       ├── docs/resources/              (resource management)      │
│       ├── docs/deliverables/           (deliverable tracking)     │
│       ├── docs/raid/                   (RAID log)                 │
│       ├── docs/capa/                   (CAPA items)               │
│       ├── docs/timelog/                (time tracking)            │
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
│  │  m  Project Management (submenu)                 │  │
│  │  k  Knowledgebase  (Obsidian opt-in)             │  │
│  │  i  Info           (project diagnostics)         │  │
│  │  ─────────────────────────────────────────       │  │
│  │  b  Back to Start Menu                           │  │
│  │  ?  Help (contextual man-page)                   │  │
│  │  q  Quit                                         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                       │
│  ┌──────── Project Management Submenu ────────────┐   │
│  │  1  Resources        5  CAPA                   │   │
│  │  2  Time-Log         6  Lifecycle              │   │
│  │  3  Deliverables     7  Health                 │   │
│  │  4  RAID Log                                   │   │
│  └────────────────────────────────────────────────┘   │
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
│                  Controller Layer (22 controllers)            │
│                                                              │
│  ┌───────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐          │
│  │ ai-tools  │ │  build   │ │capture │ │  capa   │          │
│  └───────────┘ └──────────┘ └────────┘ └─────────┘          │
│  ┌───────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐          │
│  │deliverables│ │devtools  │ │ events │ │ health  │          │
│  └───────────┘ └──────────┘ └────────┘ └─────────┘          │
│  ┌───────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐          │
│  │   help    │ │  info    │ │lifecycl│ │  make   │          │
│  └───────────┘ └──────────┘ └────────┘ └─────────┘          │
│  ┌───────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐          │
│  │  plugins  │ │ project  │ │publish │ │  raid   │          │
│  └───────────┘ └──────────┘ └────────┘ └─────────┘          │
│  ┌───────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐          │
│  │ reports   │ │requiremts│ │resource│ │ review  │          │
│  └───────────┘ └──────────┘ └────────┘ └─────────┘          │
│  ┌───────────┐ ┌──────────┐                                  │
│  │ scaffold  │ │ timelog  │                                  │
│  └───────────┘ └──────────┘                                  │
│                                                              │
│  Thin handlers: CliRequest → domain service → CliResponse    │
│  No log() calls, no ANSI — returns dataResponse(model, fn)  │
└───────────┬──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────┐
│                     UI / View Layer (71 files)                │
│                                                              │
│  Display renderers:       Typed data models:                 │
│  ┌──────────────────┐     ┌───────────────────────┐          │
│  │ health-display   │     │ HealthViewModel       │          │
│  │ build-display    │     │ BuildAutoModel        │          │
│  │ reports-display  │     │ AuditResultModel      │          │
│  │ scaffold-display │     │ ScaffoldResultModel   │          │
│  │ plugins-display  │     │ PluginListItem[]      │          │
│  │ events-display   │     │ EventListModel        │          │
│  │ capture-display  │     │ CaptureResultModel    │          │
│  │ ...10 more       │     │ ...                   │          │
│  └──────────────────┘     └───────────────────────┘          │
│  common-renderers.ts — shared: renderError, renderSuccess    │
│  Interactive menus remain in ui/ (mainMenu, help, reports)   │
└───────────┬──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────┐
│                       Domain Layer (25 modules)              │
│                                                              │
│  Core:                                                       │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐            │
│  │ Project │ │ Scaffold │ │  Make  │ │  Build  │            │
│  └─────────┘ └──────────┘ └────────┘ └─────────┘            │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐            │
│  │ Reports │ │  Review  │ │Publish │ │ Capture │            │
│  └─────────┘ └──────────┘ └────────┘ └─────────┘            │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐            │
│  │ Events  │ │   E2E    │ │  Info  │ │ Health  │            │
│  └─────────┘ └──────────┘ └────────┘ └─────────┘            │
│  ┌───────────┐ ┌──────────┐ ┌──────────────────┐            │
│  │Onboarding │ │ DevTools │ │ Knowledgebase    │            │
│  └───────────┘ └──────────┘ └──────────────────┘            │
│  ┌─────────┐ ┌──────────┐ ┌──────────────────┐              │
│  │ Plugins │ │ AI Tools │ │   Templates      │              │
│  └─────────┘ └──────────┘ └──────────────────┘              │
│                                                              │
│  Project Management:                                         │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐      │
│  │Resources │ │ Time-Log │ │Deliverables│ │   RAID   │      │
│  └──────────┘ └──────────┘ └────────────┘ └──────────┘      │
│  ┌──────────────┐ ┌──────┐ ┌────────────────┐               │
│  │ Requirements │ │ CAPA │ │   Lifecycle    │               │
│  └──────────────┘ └──────┘ └────────────────┘               │
│                                                              │
│  Pure business logic only — no log(), no ANSI, no I/O       │
│  Exports: services, pure functions, types                    │
│  Interactive menus delegated to ui/ layer                    │
└───────────┬──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────┐
│                  Infrastructure Layer (33 modules)            │
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
│  ┌────────┐ ┌────────┐ ┌──────────────────┐                  │
│  │ output │ │ types  │ │request-response  │                  │
│  └────────┘ └────────┘ └──────────────────┘                  │
│                                                              │
│  All I/O behind abstractions: IFileSystem, IShell, IProcess  │
│  All time behind clock abstraction                           │
│  request-response.ts: CliRequest, CliResponse, adapt()       │
│                                                              │
│  ┌─────────────────────┐ ┌──────────────────┐                │
│  │ pipeline/           │ │ event-bus.ts      │                │
│  │ pipeline-runner.ts  │ │ cli-events.ts     │                │
│  │ pipeline-context.ts │ │ (ICliBus factory) │                │
│  │ pipeline-types.ts   │ │                   │                │
│  └─────────────────────┘ └──────────────────┘                │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    Scripts Layer (4 files)                    │
│                                                              │
│  src/scripts/ — standalone CLI entry points with main()      │
│  ┌──────────────┐ ┌───────────────┐ ┌──────────────────────┐ │
│  │ cli-reload   │ │fix-frontmatter│ │ generate-test-data   │ │
│  └──────────────┘ └───────────────┘ └──────────────────────┘ │
│  ┌──────────────┐                                            │
│  │ run-analysis │  May import from infrastructure/ directly  │
│  └──────────────┘                                            │
└──────────────────────────────────────────────────────────────┘
```

**Dependency rule**: Controller → Domain → Infrastructure. Controller → UI (renderers). Never Infrastructure → Domain. Never Domain → Domain (cross-domain). Scripts → Infrastructure + Domain (they are entry points, not domain logic). `main.ts` is the sole composition root.

### 2.5 Non-Interactive Command Dispatch (MVC)

```
process.argv → parseArgs() → { command, flags, rawArgs }
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
                         └────────────┬──────────────┘
                                      │ "run"
                                      ▼
                              CommandHandler(flags, rawArgs, command, project)
                                      │
                              adapt() bridges ControllerAction → CommandHandler
                                      │
                              ┌───────▼───────────────┐
                              │  CliRequest            │
                              │  ├── command: string   │
                              │  ├── flags: Record     │
                              │  ├── rawArgs: string[] │
                              │  ├── project?: ctx     │
                              │  └── format: OutputFmt │
                              └───────┬───────────────┘
                                      │
                              Controller action(req)
                              ├── Calls domain services
                              ├── Returns CliResponse<T>
                              │   ├── data: T (typed model)
                              │   ├── render: (T) → void
                              │   └── exitCode?: number
                              └── Or returns void (fire-and-forget)
                                      │
                              handleResponse(response, format)
                              ├── format=json → JSON.stringify(data)
                              ├── format=text → render(data)
                              └── exitCode ≠ 0 → proc.exit()
```

**Request/Response pattern** (Symfony-inspired MVC):
- Controllers are thin: parse flags → call domain → return `dataResponse(model, renderer)`
- Renderers live in `ui/*-display.ts` — pure functions that take typed models and call `log()` with ANSI
- `handleResponse()` at the edge dispatches JSON vs human-readable output
- Fire-and-forget commands (e.g. `build`, `test`) call `shell.run()` and return void

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

4 bundled definitions: `flowti-project.json` (TypeScript project), `flowti-bare.json` (minimal TypeScript library), `flowti-cli.json` (CLI tool with esbuild + arg parser), `flowti-obsidian-plugin.json` (Obsidian plugin with manifest, styles, CJS externals). 5 template registries: shared (7), project (2), bare (2), cli (2), plugin (6).

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
├── controller/        ← Controller tests (request → response assertions)
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

### 2.12 Project Management Domain

The CLI provides a full project management suite under the "Project Management" submenu. Each subdomain follows the store pattern: pure functions with injected deps, markdown files with YAML frontmatter.

```
┌──────────── Project Management ──────────────────┐
│                                                    │
│  Resources      — human, material, role, budget    │
│  Time-Log       — hours per person/task/category   │
│  Deliverables   — tracked outputs with progress    │
│  RAID Log       — risks, assumptions, issues, deps │
│  CAPA           — corrective/preventive actions    │
│  Lifecycle      — state machine for entities       │
│  Health         — quality gate dashboard           │
│                                                    │
│  Config: management.{resources,timelog,...}         │
│  Storage: docs/{domain}/{name}.md (YAML FM)        │
│  Pattern: {domain}-store.ts + {domain}-types.ts    │
└────────────────────────────────────────────────────┘
```

### 2.13 Lifecycle Engine

The lifecycle engine is a generic state machine for projects, products, and features. It manages entity lifecycles with validated transitions and history tracking.

```
┌──────────── Lifecycle Templates ─────────────────┐
│                                                    │
│  Project:                                          │
│    inception → planning → execution → monitoring   │
│    → closing → archived                            │
│                                                    │
│  Product:                                          │
│    concept → development → launch → growth         │
│    → maturity → decline → sunset                   │
│                                                    │
│  Feature:                                          │
│    ideation → specification → development          │
│    → testing → release → deprecated                │
│                                                    │
└────────────────────────────────────────────────────┘

Domain Layer:
  lifecycle-engine.ts  — pure state machine (no deps)
  lifecycle-store.ts   — CRUD with markdown + YAML FM
  lifecycle-types.ts   — LifecycleTemplate, LifecycleRecord
  discovery.ts         — product/feature folder scanning

Storage: {item}/lifecycle.md with transition history table.
Standalone items: 02 - Products/{name}/, 03 - Features/{name}/
Nested items: docs/features/{name}/ within a project
```

### 2.14 Configurable Lint Thresholds

ESLint thresholds are configurable per-project via `flowti.config.json`:

```json
{
  "devtools": {
    "thresholds": {
      "maxComplexity": 10,
      "maxLines": 350
    }
  }
}
```

`eslint.config.mjs` reads these at startup with fallback defaults. This allows projects to tune code quality gates without modifying the ESLint config directly.

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

## 4. Architecture Evolution

This section documents completed architectural work (4.1–4.16) and the target architecture vision (4.17+) derived from PRD v8. All core functional requirements (FR-01 through FR-14) are complete. FR-15 through FR-19 are partially implemented. The target architecture addresses gaps identified in the PRD Feature Maturity Assessment (Section 14) and the Feature Development Roadmap (Section 16).

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

### 4.18 MVC Refactoring — Controller / UI / Domain Separation (TD-24) — DONE

Symfony-inspired MVC refactoring that separates command handling, business logic, and presentation into distinct layers. All 84 non-interactive commands now flow through the Controller → Domain → UI pattern.

**New layers:**

| Layer | Directory | Files | Responsibility |
|-------|-----------|-------|----------------|
| **Controller** | `src/controller/` | 15 | Thin handlers: parse flags, call domain, return `CliResponse<T>` |
| **UI / View** | `src/ui/*-display.ts` | 11 | Typed renderer functions: take data models, produce ANSI output |
| **Domain** | `src/domain/` | 183 | Pure business logic: services, scoring, validation, generation |
| **Infrastructure** | `src/infrastructure/` | 29 | I/O abstractions, request-response types, command registry |

**Request-Response abstraction** (`infrastructure/request-response.ts`):

```typescript
interface CliRequest {
  command: string;
  flags: Record<string, unknown>;
  rawArgs: string[];
  project?: ProjectContext;
  format: OutputFormat;
}

interface CliResponse<T> {
  data: T;
  render: (data: T) => void;
  exitCode?: number;
}

// Factory: dataResponse(model, renderer) → CliResponse<T>
// Bridge: adapt(action) → CommandHandler (for CommandRegistry)
// Edge:  handleResponse(response, format) → JSON or rendered output
```

**Controller pattern** (exemplar: `health.controller.ts`):

```typescript
const actions: Record<string, ControllerAction> = {
  health: (req) => {
    const snapshot = collectHealth(req.project!);
    const score = scoreHealth(snapshot);
    const model: HealthViewModel = { snapshot, score, trend };
    return dataResponse(model, renderHealthDashboard);
  },
};

export const commands = Object.fromEntries(
  Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
```

**Command categories:**

| Pattern | Count | Behavior |
|---------|-------|----------|
| Data + Render | ~50 | Returns `dataResponse(model, renderer)` — supports `--format=json` |
| Fire-and-forget | ~25 | Calls `shell.run()`, returns void |
| Interactive menu | ~9 | Stays in `ui/` layer (menus, prompts) |

**Files created**: 15 controllers, 11 display renderers (`ui/*-display.ts`), `ui/common-renderers.ts` (shared ErrorModel, SuccessModel, NoProjectModel), `infrastructure/request-response.ts`.

**Files deleted**: 8 empty domain files after command extraction (build.ts, devtools.ts, review.ts, reports.ts, publish.ts, scaffold-commands.ts, event-commands.ts, make-commands.ts).

**Impact**: Domain files no longer import ANSI color codes or call `log()`. Controllers have no display logic. Renderers are typed and testable. `--format=json` works uniformly via `handleResponse()`.

---

### 4.19 Domain Layer Purification — Injectable Log Pattern (Phase 7.6) — DONE

Strict enforcement of the DDD boundary rule: **domain files must never import `logger.js` or `ui.js`**. All 24 violating domain files were purified using an injectable callback pattern instead of a full EventBus (deferred to Phase 8).

**Pattern — injectable `log` callback:**

Domain functions that need to emit progress messages accept an optional `log` parameter:

```typescript
// Generator signature — extracts log from pipeline context
export function generateTestReport(
  projectPath: string,
  ctx?: PipelineContext,
): GeneratorOutput {
  const log = (msg: string) => ctx?.log(msg);
  // ... pure logic, uses log() for progress
}
```

**Pipeline context wiring:**

```
Controller (passes log from logger.js)
  → report-runner.ts (RunOptions.log)
    → report-pipeline.ts (options.log)
      → pipeline-context.ts (ctx.log)
        → generator functions (ctx?.log)
```

**New architectural layer — `src/scripts/`:**

Standalone CLI scripts with `main()` entry points are **not domain logic** — they are executable entry points that wire infrastructure to domain services. Moved out of domain:

| Original Location | New Location |
|---|---|
| `domain/devtools/cli-reload.ts` | `scripts/cli-reload.ts` |
| `domain/devtools/fix-frontmatter.ts` | `scripts/fix-frontmatter.ts` |
| `domain/devtools/generate-test-data.ts` | `scripts/generate-test-data.ts` |
| `domain/reports/cli/run-analysis.ts` | `scripts/run-analysis.ts` |

Scripts are allowed to import from `infrastructure/` (they sit outside the domain layer).

**E2E domain cleanup:**

- `e2e-interactive.ts` moved from `domain/e2e/` to `ui/e2e/` (it's a view-controller with menus and prompts)
- `journey-test-runner.ts` default logger changed from `console.log` to no-op `() => {}`
- Pipeline step files (`build-step.ts`, `session-note-step.ts`, `report-step.ts`) use `ctx.log()` instead of imported `log()`

**EventBus infrastructure (created, not yet wired):**

- `infrastructure/event-bus.ts` — synchronous, factory-based `createCliBus()`, error-isolated handlers
- `infrastructure/cli-events.ts` — composed `CliEventMap` from domain event maps
- `domain/reports/report-events.ts` — `ReportEventMap` (progress, warning, written)
- `domain/e2e/e2e-events.ts` — `E2EEventMap` (step progress, prereq result, build progress, teardown, session)
- `ui/cli-event-renderer.ts` — ANSI renderer that subscribes to bus events

The EventBus is ready for Phase 8 when the Plugin integration requires cross-domain communication. Currently all progress flows through the simpler injectable `log` callback.

**Verification:**
- `grep -rl "from.*infrastructure/logger" src/domain/` → zero files
- `grep -rl "from.*infrastructure/ui" src/domain/` → zero files
- `grep -rl "console\.log" src/domain/` → zero files (except template strings in `make/templates/`)

**Updated layer diagram** (§2.4): The layer architecture now includes 5 layers:

```
Entry Point (main.ts)
  → Controller Layer (15 controllers)
    → UI / View Layer (30 display renderers)
      → Domain Layer (18 modules — pure, no I/O, no presentation)
        → Infrastructure Layer (29 modules + pipeline/ + event-bus)
Scripts Layer (4 standalone scripts — outside domain, uses infrastructure directly)
```

### 4.20 Target Architecture: Future State

The target architecture evolves the CLI from a **tool orchestrator** into a **project intelligence platform**. The core principles (self-contained binary, definition-driven, zero dependencies, progressive opt-in) remain unchanged. The evolution adds three architectural capabilities:

1. **Execution Engine** — AI Tools and Plugins gain runtime execution with parameter substitution, output capture, and exit code propagation
2. **Health Intelligence** — Health metrics become actionable through scoring, trends, and non-interactive access
3. **Contract System** — Event contracts become a test-time validation layer, bridging documentation and runtime

#### 4.19.1 Target Layer Architecture

> **Note**: The MVC layer separation (Controller / UI / Domain) described in §4.18 is now complete. The diagram below shows the remaining target subsystems that sit within the domain and infrastructure layers.

```
┌──────────────────────────────────────────────────────────────┐
│                       Entry Point                            │
│  main.ts — orchestrator (two-loop menu + command dispatch)   │
└───────────┬──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────┐
│  Controller Layer (15) → UI/View Layer (30) — see §2.4      │
└───────────┬──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────┐
│                       Domain Layer (18+ modules)             │
│                                                              │
│  ── Core (stable, Deep maturity) ──────────────────────────  │
│  Project │ Scaffold │ Make │ Build │ Reports │ Events        │
│  Review  │ Publish  │ Help │ Info  │ Capture │ Onboarding    │
│  DevTools│ Knowledgebase                                     │
│                                                              │
│  ── Extensibility (Functional → Deep) ─────────────────────  │
│  Plugins │ AI Tools │ Health                                 │
│                                                              │
│  ── New Subsystems (target) ───────────────────────────────  │
│  ┌──────────────────┐ ┌────────────────┐ ┌───────────────┐  │
│  │ Execution Engine │ │ Health Pipeline│ │Contract System│  │
│  │ (IMP-21, IMP-24) │ │ (IMP-20, 26)  │ │ (IMP-18)      │  │
│  │                  │ │                │ │               │  │
│  │ Plugin runner    │ │ CLI command    │ │ Payload       │  │
│  │ with exit codes  │ │ health scoring │ │ validation    │  │
│  │                  │ │                │ │               │  │
│  │ AI Tool executor │ │ Snapshot       │ │ TypeScript    │  │
│  │ with param subst.│ │ persistence   │ │ codegen       │  │
│  │                  │ │                │ │               │  │
│  │ Output capture   │ │ Trend analysis │ │ CI gate       │  │
│  │ + error routing  │ │ + regression  │ │ integration   │  │
│  └──────────────────┘ └────────────────┘ └───────────────┘  │
│                                                              │
└───────────┬──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────┐
│                  Infrastructure Layer (21+ modules)           │
│                                                              │
│  ── Existing (unchanged) ──────────────────────────────────  │
│  config │ dispatch │ menu │ shell │ state │ document │ ui    │
│  input  │ fs │ filesystem │ paths │ proc │ clock │ logger   │
│  args   │ frontmatter │ errors │ output │ cmd-registry      │
│  test-vault │ types                                          │
│                                                              │
│  ── Extended (target) ─────────────────────────────────────  │
│  ┌──────────────────┐ ┌────────────────┐                     │
│  │ shell.ts         │ │ state.ts       │                     │
│  │ + runCapture()   │ │ + health[]     │                     │
│  │   returns stdout │ │ + trends       │                     │
│  │   stderr, code   │ │ + timestamps   │                     │
│  └──────────────────┘ └────────────────┘                     │
│                                                              │
│  ┌──────────────────┐                                        │
│  │ config-schema.ts │                                        │
│  │ + path checks    │                                        │
│  │ + command exists  │                                        │
│  │ + cross-field    │                                        │
│  └──────────────────┘                                        │
└──────────────────────────────────────────────────────────────┘
```

#### 4.19.2 Execution Engine Architecture

The Execution Engine unifies plugin and AI tool runtime into a shared subsystem. Plugins now propagate exit codes via `process.exitCode` (Phase 4.2). AI Tools are metadata-only.

**Target design:**

```
┌──────────────── Execution Engine ──────────────────────┐
│                                                         │
│  ExecutionRequest                                       │
│  ├── command: string          (shell command template)  │
│  ├── params: Record<string, string>  (substitutions)   │
│  ├── cwd?: string             (working directory)       │
│  ├── timeout?: number         (max execution ms)        │
│  └── source: "plugin" | "ai-tool"                       │
│                                                         │
│  ExecutionResult                                        │
│  ├── exitCode: number                                   │
│  ├── stdout: string                                     │
│  ├── stderr: string                                     │
│  ├── duration: number                                   │
│  └── success: boolean                                   │
│                                                         │
│  execute(request): ExecutionResult                       │
│    1. Substitute {{param}} in command string             │
│    2. shell.runCapture(command, cwd)                     │
│    3. Return structured result with exit code            │
│    4. Route errors to CliError (user) or log (internal)  │
│                                                         │
│  Plugin commands:                                       │
│    Done:   shell.run(cmd)  → process.exitCode (Phase 4) │
│    Target: execute(req)    → result (full capture)       │
│                                                         │
│  AI Tool execution (new):                               │
│    ai:run --tool=X --param1=val1                         │
│    → Build ExecutionRequest from tool definition         │
│    → Substitute params into run command                  │
│    → execute(req) → display result                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key decisions:**
- Shared `ExecutionRequest`/`ExecutionResult` types for plugins and AI tools
- `shell.runCapture()` added to infrastructure (returns stdout + stderr + exitCode)
- Parameter substitution uses `{{paramName}}` syntax (same as scaffold definitions)
- Timeout defaults to 60s, configurable per command

#### 4.19.3 Health Intelligence Architecture

The Health Dashboard evolves from an interactive-only display into a full metrics pipeline with scoring, persistence, and trend analysis.

**Target design:**

```
┌──────────────── Health Pipeline ───────────────────────┐
│                                                         │
│  collectHealth(ctx)          ← existing (unchanged)     │
│       │                                                 │
│       ▼                                                 │
│  HealthSnapshot              ← existing type            │
│  ├── source: { files, loc }                             │
│  ├── tests: { total, passed, failed }                   │
│  ├── coverage: { lines, branches }                      │
│  ├── build: { status, duration }                        │
│  ├── lint: { errors, warnings }                         │
│  ├── git: { branch, dirty, ahead }                      │
│  └── components: { total, byKind }                      │
│                                                         │
│  ── New: Scoring ────────────────────────────────────   │
│  scoreHealth(snapshot, thresholds): HealthScore          │
│  ├── per-category score (0–100)                         │
│  ├── overall grade (A–F)                                │
│  └── thresholds from flowti.config.json                 │
│       { coverage: { min: 80 }, lint: { maxWarnings: 0 }}│
│                                                         │
│  ── New: Persistence ────────────────────────────────   │
│  saveHealthSnapshot(snapshot, score)                     │
│  ├── .flowti/var/health-history.json                    │
│  ├── Rolling window (last 30 snapshots)                 │
│  └── Timestamped entries for trend analysis             │
│                                                         │
│  ── New: Trends ─────────────────────────────────────   │
│  analyzeHealthTrends(history): HealthTrend[]            │
│  ├── Delta per category (improved/regressed/stable)     │
│  ├── Regression alerts (score dropped > threshold)      │
│  └── Sparkline-style indicators in display              │
│                                                         │
│  ── New: CLI Command ────────────────────────────────   │
│  flowti health [--project=X] [--format=json]            │
│  ├── Non-interactive: score + snapshot                   │
│  ├── --format=json: structured output for AI agents     │
│  └── Interactive: existing displayHealth() + trends     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Config addition** (`flowti.config.json`):
```json
{
  "health": {
    "thresholds": {
      "coverage": { "min": 80, "target": 95 },
      "lint": { "maxErrors": 0, "maxWarnings": 10 },
      "tests": { "minPassed": 100 },
      "complexity": { "maxAverage": 15 }
    }
  }
}
```

#### 4.19.4 Contract System Architecture

Event contracts evolve from metadata parsing into a test-time validation layer and TypeScript code generator.

**Target design:**

```
┌──────────────── Contract System ───────────────────────┐
│                                                         │
│  ── Existing (unchanged) ────────────────────────────   │
│  parsePayloadTable(content) → PayloadField[]            │
│  loadEventContracts(dir)    → EventContract[]           │
│  validateContracts(cs)      → ContractValidationResult  │
│  generateContractsJson(cs)  → string                    │
│                                                         │
│  ── New: Vitest Integration ─────────────────────────   │
│  createContractValidator(contractsDir)                   │
│    → (eventName, payload) → ValidationResult            │
│                                                         │
│  Usage in test files:                                   │
│    const validate = createContractValidator("docs/events")│
│    expect(validate("user.created", payload)).toPass()   │
│                                                         │
│  Validates:                                             │
│    ✓ All required fields present                        │
│    ✓ Field types match contract                         │
│    ✓ No unknown fields (strict mode, opt-in)            │
│    ✓ Nested object structure                            │
│                                                         │
│  ── New: TypeScript Codegen ─────────────────────────   │
│  generateTypeScript(contracts): string                   │
│    → export interface UserCreatedPayload { ... }        │
│    → export type EventPayloads = { ... }                │
│                                                         │
│  CLI command: events:codegen --out=types/events.ts      │
│                                                         │
│  ── New: CI Gate (Phase 6) ──────────────────────────   │
│  events:contracts --validate --strict                    │
│    → Exit 1 if any contract violation found             │
│    → Integrates into publish pipeline as prerequisite    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 4.19.5 Enhanced Capture Architecture

Capture evolves from single-line text input to a structured note system with metadata and retrieval.

**Target design:**

```
┌──────────────── Enhanced Capture ──────────────────────┐
│                                                         │
│  ── Existing ────────────────────────────────────────   │
│  capture:idea --text="..."                              │
│  capture:note --type=X --title="..."                    │
│                                                         │
│  ── New: Metadata ───────────────────────────────────   │
│  capture:idea --text="..." --tags=ux,perf --priority=1  │
│  capture:note --type=X --title="..." --tags=...         │
│                                                         │
│  Generated frontmatter:                                 │
│    type: Idea | Task | Bug | Note | Documentation       │
│    tags: [ux, perf]                                     │
│    priority: 1                                          │
│    created: 2026-03-09T...                              │
│    status: inbox                                        │
│                                                         │
│  ── New: Retrieval ──────────────────────────────────   │
│  capture:search --tag=ux [--type=Idea] [--format=json]  │
│  capture:list [--recent=7d] [--format=json]             │
│                                                         │
│  ── New: Batch Import ───────────────────────────────   │
│  capture:import --file=ideas.md                         │
│    → Parse markdown list → individual capture files      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 4.19.6 Target Non-Interactive Command Surface

The complete target CLI surface for AI agent tool use:

```
flowti <command> [--project=<name>] [--format=json] [flags]

── Core (existing, stable) ──────────────────────────────
help [section]                    info
build                             test
publish                           publish:all
publish --dry-run                 review:clean
reports                           report:{id}
health [--format=json]            edit:component --name=X
make:component --name=X           make:layout --name=X
make:page --name=X                make:ui-component --name=X
make:system --name=X              make:container --name=X
make:c4-component --name=X        make:person --name=X
events:list                       events:add --name=X --domain=Y
events:flow                       events:version --name=X --version=Y
events:contracts                  capture:idea --text="..."
capture:note --type=X --title=Y   project:deps
scaffold:list                     scaffold:new --name=X
scaffold:marketplace              scaffold:import --file=X
plugin:list                       plugin:validate
plugin:new                        plugin:reference
ai:list                           ai:validate
ai:new                            ai:reference
docs

── Target (new commands) ────────────────────────────────
ai:run --tool=X [--params]        ← FR-14 / IMP-24
events:codegen --out=X            ← FR-18.7
capture:search --tag=X            ← IMP-22
capture:list [--recent=7d]        ← IMP-22
capture:import --file=X           ← IMP-22
scaffold:export --file=X          ← FR-17.6
ci:generate                       ← IMP-11
update                            ← IMP-12
```

#### 4.19.7 Target Configuration Schema

The full target configuration schema for `flowti.config.json`:

```json
{
  "name": "my-project",
  "tools": {
    "build": "npm run build",
    "reports": "npm run reports",
    "devtools": "npm run dev"
  },
  "components": {
    "storybook": true,
    "storybookDir": "component-library"
  },
  "make": {
    "templates": ["journey", "component"]
  },
  "reports": {
    "generators": [
      { "id": "test", "prerequisites": ["npm run test:coverage"] },
      { "id": "coverage" },
      { "id": "codebase" },
      { "id": "complexity" },
      { "id": "status" },
      { "id": "summary" }
    ]
  },
  "publish": {
    "build": "npm run build",
    "test": "npm test",
    "outDir": "dist",
    "artifacts": ["main.js"],
    "endpoints": [
      { "name": "Local", "path": "../output", "clean": true }
    ]
  },
  "review": {
    "journeysDir": "tests/e2e/journeys",
    "runner": "npm run test:e2e",
    "build": "npm run build",
    "test": "npm test"
  },
  "docs": {
    "allCommand": "npm run typedoc",
    "referenceDir": "docs/reference"
  },
  "health": {
    "thresholds": {
      "coverage": { "min": 80, "target": 95 },
      "lint": { "maxErrors": 0, "maxWarnings": 10 },
      "tests": { "minPassed": 100 },
      "complexity": { "maxAverage": 15 }
    }
  }
}
```

The `health` section is the only new top-level key. All other config sections are unchanged.

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

**Milestone**: Projects have a health score. Review enforces quality gates. Storybook v10 is a first-class, opt-in component library tool managed from the Components menu with dynamic state-aware gating. Component data model expanded with icon, heroImage, images, domain for rich documentation and Storybook parameters. TypeDoc error parsing captures both native and TS compilation errors. 1,724 tests, 98 suites (grew to 1,766 tests, 100 suites after Phase 4). 0 lint errors, 0 warnings.

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

### Phase 4: Hardening — COMPLETE

All items delivered. 42 new tests (1,724 → 1,766, 98 → 100 suites). Health scoring, plugin exit codes, config deep validation, publish dry-run, review cleanup. 0 new lint warnings.

| # | Task | Status | Files |
|---|------|--------|-------|
| 4.1 | **Health CLI command** (FR-15.5, IMP-20) | DONE | Modify: `health/health.ts` (commands handler with `--format=json`), `main.ts` (register health domain), 4 new tests |
| 4.2 | **Plugin exit code propagation** (FR-13, IMP-21) | DONE | Modify: `plugins/plugin-loader.ts` (`process.exitCode` on non-zero), 2 new tests |
| 4.3 | **Config deep validation** (FR-08, IMP-23) | DONE | New: `project/config-deep-validation.ts` (filesystem-aware validation, warnings only), Modify: `project-config.ts` (wire into initializeProject), `paths.ts` (isAbsolute), `config-schema.ts` (health key), 12 new tests |
| 4.4 | **Health scoring** (FR-15.6, IMP-20) | DONE | New: `health/health-scoring.ts` (scoreHealth, letterGrade, DEFAULT_THRESHOLDS), Modify: `types.ts` (HealthConfig), 18 new tests |
| 4.5 | **Publish dry-run** (FR-05) | DONE | Modify: `publish/publish.ts` (dry-run flag, displayDryRun, resolvePublishConfig), 3 new tests |
| 4.6 | **Review cleanup** (FR-12) | DONE | Modify: `review/review.ts` (review:clean command, resolveTestVault), 3 new tests |

**Milestone**: All `Functional` features promoted to `Deep`. `flowti health` available for AI agents. Plugins report failures via `process.exitCode`. Config validation catches filesystem-level issues. 1,766 tests, 100 suites. 0 lint errors, 0 warnings.

### Phase 5: Depth (Medium-Term)

Turn "Shallow" features into useful, reliable tools. Introduce the Execution Engine (4.18.2), Health Intelligence pipeline (4.18.3), and Contract System (4.18.4).

| # | Task | Effort | Impact | FR / IMP | New / Modify |
|---|------|--------|--------|----------|--------------|
| 5.1 | **Capture enrichment** — tags, structured fields, search/retrieve | M | High | FR-02.11, IMP-22 | Modify: `capture/capture.ts` (tags, search), New: `capture/capture-search.ts` |
| 5.2 | **Event contract validation** — Vitest integration + `--validate` flag | L | High | FR-18.6, IMP-18 | New: `events/contract-validator.ts`, export `createContractValidator()` |
| 5.3 | **Health trends** — snapshot persistence + delta indicators | M | Medium | FR-15.7, IMP-26 | New: `health/health-trends.ts`, Modify: `state.ts` (health history) |
| 5.4 | **AI Tool execution** — `ai:run` with parameter substitution | L | Medium | FR-14, IMP-24 | New: `ai-tools/ai-tool-executor.ts`, shared `ExecutionEngine` in infrastructure |
| 5.5 | **Marketplace export** — `scaffold:export` + remote import | M | Low | FR-17.6, IMP-25 | Modify: `scaffold/marketplace.ts` (export command) |
| 5.6 | **Event TypeScript codegen** — `events:codegen --out=X` | M | Low | FR-18.7, IMP-18 | New: `events/contract-codegen.ts` |

**Milestone**: Capture is a useful note system with tags and search. Event contracts integrate into test pipelines. Health provides actionable trend data. AI Tools can execute commands.

**Exit criteria**: PRD Feature Maturity Assessment shows no `Shallow` entries.

### Phase 6: Ecosystem (Long-Term)

Make the CLI a force multiplier across projects and teams.

| # | Task | Effort | Impact | FR / IMP | New / Modify |
|---|------|--------|--------|----------|--------------|
| 6.1 | **CI/CD generation** — `flowti ci:generate` outputs GitHub Actions YAML | L | High | IMP-11 | New: `domain/build/ci-generator.ts` |
| 6.2 | **Interactive dependency browser** — terminal project graph | L | Medium | FR-16.5, IMP-27 | New: `project/project-deps-browser.ts` |
| 6.3 | **Self-update** — detect source changes, rebuild binary | M | Medium | IMP-12 | Modify: `boot/bootstrap.mjs` (source hash check) |
| 6.4 | **Plugin lifecycle hooks** — `onInstall`/`onUpdate`/`onRemove` | L | Low | FR-13 | Modify: `plugins/plugin-types.ts`, `plugin-loader.ts` (hook execution) |
| 6.5 | **Cross-vault sharing** — remote plugin/definition registry | XL | Low | FR-17, FR-13, IMP-25 | New: `domain/registry/` (remote discovery, install) |

**Milestone**: CLI generates CI pipelines. Projects explorable interactively. Plugin ecosystem supports lifecycle management.

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

Pure functions are well-covered (1,766 tests). Remaining low-coverage files are: (1) report generators — I/O-heavy, tested via output shape; (2) interactive flows — thin wrappers over tested `menu.ts` infrastructure; (3) E2E orchestration — covered by integration tests. Adding unit tests for these yields diminishing returns. Coverage will grow organically as new features add tests.

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
| `infrastructure/shell.ts` | Shell execution (`run`, `runSilent`, `runCaptureStatus`, `runAsync`, `runParallel`) |
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
| Project | `project.ts`, `project-config.ts`, `project-deps.ts`, `config-deep-validation.ts` | Project selection, initialization, auto-scaffolding, cross-project dependency detection, filesystem-aware config validation |
| Scaffold | `scaffold-service.ts`, `scaffold-plan.ts`, `scaffold-schema.ts`, `marketplace.ts` | Project creation from JSON definitions, local definition marketplace |
| Make | `make-service.ts`, `makers.ts`, `make-commands.ts` | In-project scaffolding (journey, component) |
| Component | `component-registry.ts`, `component-plan.ts`, `component-types.ts`, `component-list.ts`, `component-edit.ts`, `storybook-service.ts` | 8-kind component system with properties, actions, variants, states (Storybook-compatible), C4 hierarchy, post-creation editing, opt-in Storybook |
| Reports | `pipeline/report-runner.ts`, `generator-registry.ts` (6 reports + 2 refs), `pipeline/report-pipeline.ts`, `export/html-export.ts`, `export/report-archive.ts` | Resilient report generation, reference documents, archive, HTML export, diff. Organized: cli/, generators/, analysis/, export/, pipeline/ |
| Review | `project-review.ts`, `e2e-service.ts` | E2E test execution, test vault management |
| Publish | `project-publish.ts` | Gated build → test → distribute pipeline |
| Events | `event-catalog.ts`, `event-commands.ts`, `event-payload.ts`, `event-versioning.ts`, `event-flow.ts`, `event-contracts.ts` | Event documentation, payload editing, versioning, flow visualization, contract parsing/validation |
| Build | `build.ts` | Build command dispatch |
| Capture | `capture.ts` | Quick-capture ideas and typed notes |
| Help | `help.ts` | 10-section man-page system |
| Info | `info.ts` | Project diagnostics display |
| DevTools | `devtools.ts`, `cli-reload.ts`, `fix-frontmatter.ts` | Development utilities |
| Onboarding | `onboarding.ts` | Node.js version check, prerequisite validation |
| Knowledgebase | `knowledgebase.ts`, `vault-service.ts` | Obsidian vault interaction (opt-in) |
| Plugins | `plugin-loader.ts`, `plugin-commands.ts`, `plugin-reference.ts`, `plugin-types.ts` | Vault-level plugin discovery, validation, scaffolding, reference generation |
| AI Tools | `ai-tool-loader.ts`, `ai-tool-commands.ts`, `ai-tool-reference.ts`, `ai-tool-types.ts` | Vault-level AI tool definition management, validation, scaffolding, reference generation |
| Health | `health.ts`, `health-scoring.ts` | Project health dashboard — aggregates test/coverage/lint/git metrics, scoring (0–100) with configurable thresholds, `health` CLI command with `--format=json` |

### Configuration

| File | Scope | Purpose |
|------|-------|---------|
| `.flowti/config.json` | Vault | CLI source path, projects folder, subsystems, capture dirs |
| `<project>/configs/flowti.config.json` | Per-project | Tools, make, reports, docs, publish, review, health |
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
| D-39 | Shared Execution Engine | Plugins and AI Tools use the same `ExecutionRequest`/`ExecutionResult` types and shared `execute()` function; avoids duplicating shell execution logic |
| D-40 | Plugin exit code propagation via `process.exitCode` | Plugin command handlers set `process.exitCode = exitCode` when `shell.run()` returns non-zero; simpler than adding `shell.runCapture()` — existing `shell.run()` already returns exit codes, handlers just weren't surfacing them. `shell.runCapture()` deferred to IMP-24 (AI Tool execution) where stdout/stderr capture is actually needed |
| D-41 | Health scoring in config, not code | Thresholds live in `flowti.config.json` (`health.thresholds`), not hardcoded; projects adopt scoring when ready (progressive opt-in) |
| D-42 | Health history in `.flowti/var/` | Snapshots persisted in `health-history.json` alongside `state.json`; rolling window (30 entries) prevents unbounded growth |
| D-43 | Contract validator as exported function | `createContractValidator(contractsDir)` returns a reusable validator function; test files import and call it — no CLI dependency in test code |
| D-44 | TypeScript codegen from contracts | `events:codegen` generates interfaces from payload tables; output is a standalone `.ts` file with no imports — copy-pasteable into any project |
| D-45 | Capture tags as frontmatter arrays | Tags stored as YAML arrays in frontmatter (`tags: [ux, perf]`); searchable via existing `parseFrontmatterContent()` infrastructure |
| D-46 | Feature Maturity as architectural driver | PRD Section 14 (Feature Maturity Assessment) drives roadmap priorities; each phase targets specific maturity promotions (Shallow→Functional→Deep) |
| D-47 | Pure utility imports are not DI violations | `Document` (builder, `.save()` requires explicit `IFileSystem`), `parseFrontmatter*` (string parsing, no I/O), and `pipeline-runner` (shared engine) are pure utilities — domain files may import them directly. Only I/O-performing singletons require injection |
