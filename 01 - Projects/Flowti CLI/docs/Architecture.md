---
type: Architecture
domain: CLI
title: Flowti CLI — Architecture Document
version: 6
created: 2026-03-07
updated: 2026-03-08
status: living-document
---

# Flowti CLI — Architecture Document

> Living document. Reflects the current implementation (status quo) and the target architecture derived from PRD v4. Updated as the codebase evolves.

---

## 1. Overview

The Flowti CLI is a **definition-driven project orchestrator** that ships as a self-contained Node.js binary. It manages multi-project development workflows — scaffolding, building, testing, reviewing, publishing, and reporting — from a single interactive menu or via non-interactive commands for AI agent tool use.

**Scale**: 132 source files, 82 test files (1,232 tests, 77 suites), 15 domain modules, 19 infrastructure modules. Zero production dependencies — runs on Node.js built-ins only.

---

## 2. Status Quo

[[2026-03-08T20-24-55.237Z-project-summary]]]]
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
│  │            Generator functions (7 report types)           │     │
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
│  │  d  Documentation  (Update All, Entity Reference) │  │
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
│                       Domain Layer (15 modules)              │
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
│                                                              │
│  Each domain exports:                                        │
│    commands: Record<string, CommandHandler>  (non-interactive)│
│    menu() or xxxMenu()                      (interactive)    │
└───────────┬──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────┐
│                  Infrastructure Layer (19 modules)            │
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
│  ┌────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────┐  │
│  │ test-vault │ │ frontmatter │ │   readline  │ │ types  │  │
│  └────────────┘ └─────────────┘ └─────────────┘ └────────┘  │
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

PROJECT_FREE commands: help, project, capture:*, scaffold:*
All others require --project=<name> or a persisted selection.
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
Record<templateId, (vars: ComponentVariables, def: ComponentDefinition) => string>
```

Separates "what to create" (definitions) from "how to render" (templates). Templates are pure functions that return file content as a string.

### 2.7 Report Generation Architecture

```
┌──────────────────── Report Pipeline ──────────────────────┐
│                                                            │
│  flowti.config.json                                        │
│    generators: [                                           │
│      { id: "test",       prerequisites: ["npm run ..."] }, │
│      { id: "coverage",   prerequisites: ["npm run ..."] }, │
│      { id: "codebase",   prerequisites: ["npm run docs"] },│
│      { id: "complexity", prerequisites: ["npm run ..."] }, │
│      { id: "status" },                                     │
│      { id: "summary" },                                    │
│    ]                                                       │
│                                                            │
│  runAllReports(generators, projectPath)                     │
│    │                                                       │
│    ├── Deduplicate prerequisites across all generators      │
│    ├── For each generator:                                 │
│    │   ├── Run prerequisites (skip already completed)      │
│    │   ├── Look up in GeneratorRegistry (by ID)            │
│    │   │   ├── Found → call GeneratorFn(projectPath)       │
│    │   │   └── Not found → fallback to shell command       │
│    │   ├── Collect: success, duration, output, warnings    │
│    │   └── Never stop on failure                           │
│    │                                                       │
│    └── Print Run Summary                                   │
│        ├── ✓  passed                                       │
│        ├── ⚠  passed with warnings (lint, TypeDoc, etc.)   │
│        └── ✗  failed (with error details)                  │
│                                                            │
│  Generator Registry (7 built-in):                          │
│    test → generateTestReport                               │
│    coverage → generateCoverageReport                       │
│    codebase → generateCodebaseReport                       │
│    complexity → generateComplexityReport                   │
│    status → generateProjectStatusReport                    │
│    summary → generateSummaryReport                         │
│    entity-reference → generateEntityReference              │
└────────────────────────────────────────────────────────────┘
```

**Resilience**: The runner never stops on failure. Each generator runs independently. Failed reports are signals captured in the summary, not blockers.

**Warnings**: Generators return `warnings?: string[]` for non-fatal issues (coverage below threshold, lint warnings, TypeDoc warnings, high complexity). The summary displays individual lint issues with file:line detail.

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

The target architecture extends the status quo to fulfill all PRD v4 requirements, particularly the incomplete items (FR-12) and the planned improvements (IMP-01 through IMP-18).

### 4.1 Non-Interactive Project Selection (IMP-01) — DONE

`resolveProjectContext()` in `main.ts` validates `--project=<name>` against available projects. Invalid names show available alternatives. `PROJECT_FREE` commands bypass project resolution.

### 4.2 Config Validation (IMP-06) — DONE

`config-schema.ts` provides `validateProjectConfig(raw): ConfigValidationResult` with 45 test cases. `readProjectConfig()` returns `ReadConfigResult { config, warnings }`. Validates: required `name`, tool commands, make templates, report generators, publish endpoints, docs generators, review config, unknown keys.

### 4.3 Report Archive Navigation (IMP-03) — DONE

`report-archive.ts` discovers timestamped `.md` files in report subdirectories. Reports menu has "Browse Archive" (`key: "a"`) that lists categories and lets users view past reports.

### 4.4 Entity Reference Generator — DONE

`generators/entity-reference.ts` generates the entity dictionary of the CLI ecosystem. 9 entities (Flowti Project, Journey, Component, Component Library, Test, Test Suite, Event, Event Catalog, Report) with description, purpose, locations, config keys, commands, artifacts, and relationships.

Wired into:
- Generator registry as 7th built-in generator (`entity-reference`)
- Documentation menu as built-in generator (always available)
- "Update All" runs config generators + built-in generators (Entity Reference)

### 4.5 Developer Onboarding E2E Journey (FR-12) — DONE

`tests/e2e/60-journey-developer-onboarding.test.ts` — 7 tests covering: help, help build, scaffold:list, unknown command handling, invalid `--project` validation, journey JSON validity. Uses `spawnSync` with `tsx` to run CLI directly.

### 4.6 Target: Component Relationships (IMP-04)

**Current**: C4 entities have `containedBy` in metadata but it's just a string. No visualization or traversal.

**Target**: The Component browser shows parent/child relationships and can navigate between related components.

```
  System: Flowti Platform
    ├── Container: Plugin Runtime
    │   ├── Component: EventBus
    │   └── Component: StorageEngine
    └── Container: CLI
        ├── Component: ScaffoldService
        └── Component: ReportRunner
```

**Implementation**: Add `containedBy` and `contains` cross-references to component frontmatter. The component browser reads all component docs and builds a tree.

### 4.7 Target: Event Catalog Enrichment (IMP-14)

**Current**: Event Catalog supports `events:add` with basic fields (name, domain, version, description, producers, consumers). No payload field editor or versioning.

**Target**: Interactive payload field editor during `events:add`. Event versioning with migration notes between versions.

### 4.8 Target: Component Property Editor (IMP-15)

**Current**: Properties are defined in JSON definitions and rendered during scaffolding. No interactive editing after creation.

**Target**: `make:component --name=X` prompts for property values. An `edit:component` command allows adding/editing properties on existing components.

### ~~4.9 E2E Onboarding Journey (FR-12)~~ — moved to 4.5 (DONE)

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
| 1.5 | **Entity Reference generator** | DONE | `reports/generators/entity-reference.ts`, `generator-registry.ts` |
| 1.6 | **Documentation menu redesign** | DONE | `mainMenu.ts` (Update All + built-in generators) |

**Milestone**: All PRD v4 acceptance criteria passing. 1,232 tests, 77 suites. 0 lint errors.

### Phase 2: Component & Event Enrichment

Deepens the two newest domain features with cross-references and richer editing.

| # | Task | Effort | Impact | Files |
|---|------|--------|--------|-------|
| 2.1 | **Component relationships** (IMP-04) | M | High | Modify: `component-list.ts`, `component-types.ts` |
| 2.2 | **Component property editor** (IMP-15) | M | Medium | Modify: `component-makers.ts`, `component-commands.ts` |
| 2.3 | **Event payload field editor** (IMP-14) | M | Medium | Modify: `event-catalog.ts` |
| 2.4 | **Event versioning** (IMP-14) | S | Low | Modify: `event-catalog.ts` |
| 2.5 | **Event flow visualization** (IMP-16) | L | Medium | New: `events/event-flow.ts` |

**Milestone**: C4 entities form a navigable hierarchy. Components are editable post-creation. Event catalog supports full lifecycle.

### Phase 3: Project Health & Storybook Integration

Aggregate project metrics and integrate with the broader development ecosystem.

| # | Task | Effort | Impact | Files |
|---|------|--------|--------|-------|
| 3.1 | **Project health dashboard** (IMP-05) | M | High | New: `domain/health/health.ts` |
| 3.2 | **Review pipeline gating** (IMP-07) | S | Medium | Modify: `review/project-review.ts` |
| 3.3 | **Storybook integration** (IMP-17) | S | Medium | Modify: `mainMenu.ts`, `devtools.ts` |
| 3.4 | **Definition marketplace** (IMP-09) | L | Medium | New: `domain/scaffold/marketplace.ts` |

**Milestone**: Projects have a health score. Review enforces quality gates. Storybook is a first-class tool.

### Phase 4: Cross-Project & Automation

Long-term vision for multi-project management and CI/CD integration.

| # | Task | Effort | Impact | Files |
|---|------|--------|--------|-------|
| 4.1 | **Cross-project dependencies** (IMP-10) | L | High | New: `domain/project/dependencies.ts` |
| 4.2 | **CI/CD workflow generation** (IMP-11) | L | Medium | New: `domain/build/ci-generator.ts` |
| 4.3 | **Self-update mechanism** (IMP-12) | M | Medium | Modify: `boot/bootstrap.mjs` |
| 4.4 | **Plugin system** (IMP-13) | XL | High | New: `domain/plugins/` |
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

### 6.1 Domain Module Consistency

**Current**: Domain modules export `commands` and menu functions inconsistently. Some have a facade file (`make.ts`, `scaffold.ts`), others expose internals directly.

**Target**: Every domain follows the same pattern:
```
domain/<name>/
  ├── <name>.ts          ← facade: exports { commands, menu }
  ├── <name>-service.ts  ← orchestrator (if needed)
  ├── <name>-types.ts    ← domain types
  └── ...                ← internal modules
```

### 6.2 Command Registry Typing

**Current**: `allCommands` in `main.ts` merges all domain command maps with the spread operator. No type-level enforcement that command keys don't collide.

**Target**: Introduce a `CommandRegistry` class that detects collisions at registration time and supports command metadata (help text, required flags, project requirement).

### 6.3 Menu Builder Abstraction

**Current**: `buildProjectDetailMenu()` in `mainMenu.ts` is 300 lines of imperative menu construction with inline lambdas.

**Target**: Declarative menu definition similar to how component definitions work:

```typescript
const MENU_DEF: ToolMenuDef[] = [
  { key: "1", tool: "make",      always: true },
  { key: "2", tool: "build",     configKey: "tools.build" },
  { key: "5", tool: "reports",   submenu: reportMenuBuilder },
  ...
];
```

### 6.4 Structured CLI Output

**Current**: Non-interactive commands produce human-readable output with ANSI codes. AI agents must parse free-form text.

**Target**: Add `--format=json` flag to non-interactive commands for machine-readable output:

```bash
flowti info --format=json
# → { "name": "Flowti Plugin", "version": "1.0.0", "tests": 7559, ... }
```

### 6.5 Report Generator Plugin Pattern

**Current**: The generator registry is a hardcoded `Map<string, GeneratorFn>`. Adding a new report type requires modifying `generator-registry.ts`.

**Target**: Generators self-register via a decorator or convention. Projects can provide custom generators in their config:

```json
{
  "reports": {
    "generators": [
      { "id": "test", "label": "Test Report" },
      { "id": "custom", "label": "Custom Report", "command": "tsx scripts/my-report.ts" }
    ]
  }
}
```

This already works for external commands. The improvement is allowing projects to register internal generator functions.

### 6.6 Error Handling Consistency

**Current**: Some domains catch errors and log them, others let them propagate to `main.ts`. There is no unified error boundary or error reporting pattern.

**Target**: Introduce `CliError` (user-facing, with guidance) vs. `InternalError` (bug, with stack trace). The top-level catch in `main()` formats them differently.

### 6.7 State Expansion

**Current**: Persistent state holds only `selectedProject`. Session state is implicit (publish pipeline gates live in closure variables).

**Target**: Expand state to support:
- Recent projects list (for quick switching)
- Last run timestamps per generator (for stale report detection)
- Publish pipeline state (persisted across sessions)

---

## 7. Key File Reference

### Entry Points

| File | Purpose |
|------|---------|
| `src/main.ts` | Interactive CLI orchestrator, command dispatch |
| `src/boot/bootstrap.mjs` | Zero-install launcher (deployed to `.flowti/bin/index.js`) |
| `src/domain/mainMenu.ts` | Project detail menu builder |
| `src/infrastructure/dispatch.ts` | Pure command resolution (no I/O) |

### Infrastructure

| File | Purpose |
|------|---------|
| `infrastructure/types.ts` | All cross-cutting type definitions |
| `infrastructure/config.ts` | Vault root + CLI project path resolution |
| `infrastructure/filesystem.ts` | `IFileSystem` abstraction (`disk` singleton) |
| `infrastructure/shell.ts` | Shell execution (`run`, `runSilent`, `runCaptureStatus`) |
| `infrastructure/state.ts` | Persistent state (`.flowti/var/state.json`) |
| `infrastructure/document.ts` | Fluent Markdown builder (frontmatter, tables, callouts) |
| `infrastructure/menu.ts` | Generic data-driven menu loop |
| `infrastructure/ui.ts` | ANSI colors, `printBanner()`, `printMenu()` |
| `infrastructure/input.ts` | Interactive input (`ask()`, `createRL()`) |
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
| Component | `component-registry.ts`, `component-plan.ts`, `component-types.ts` | 8-kind component system with ECS properties |
| Reports | `report-runner.ts`, `generator-registry.ts`, 7 generators, `report-archive.ts` | Resilient report generation with prerequisites, archive browsing |
| Review | `project-review.ts`, `E2EService.ts` | E2E test execution, test vault management |
| Publish | `project-publish.ts` | Gated build → test → distribute pipeline |
| Events | `event-catalog.ts` | Per-project domain event documentation |
| Build | `build.ts` | Build command dispatch |
| Capture | `capture.ts` | Quick-capture ideas and typed notes |
| Help | `help.ts` | 8-section man-page system |
| Info | `info.ts` | Project diagnostics display |
| DevTools | `devtools.ts`, `cli-reload.ts`, `fix-frontmatter.ts` | Development utilities |
| Onboarding | `onboarding.ts` | Node.js version check, prerequisite validation |
| Knowledgebase | `knowledgebase.ts`, `vault-service.ts` | Obsidian vault interaction (opt-in) |

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
