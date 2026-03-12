---
type: TechDebt
domain: CLI
title: Flowti CLI — Technical Debt Register
version: 3
created: 2026-03-10
updated: 2026-03-12
status: active
source: "[[Development Roadmap]]"
---

# Flowti CLI — Technical Debt Register

> Curated inventory of technical debt across the Flowti CLI codebase. Items are categorized by severity, domain, and estimated remediation effort. Prioritized by impact on Phase 8 (Plugin Integration).

---

## Summary

| Severity | Count | Estimated Hours |
|----------|-------|-----------------|
| Critical | 3 (2 resolved) | 28h |
| High | 8 (6 resolved) | 40h |
| Medium | 14 (8 resolved) | 38h |
| Low | 5 | 8h |
| **Total** | **30 (16 resolved)** | **114h (57h resolved)** |

---

## Critical

### TD-01: Config Schema Mismatch Between CLI and Plugin ✓ RESOLVED

**Domain**: infrastructure/types
**File**: `src/infrastructure/types.ts` (ProjectConfig)
**Impact**: Blocks Phase 8 entirely
**Status**: Resolved — Schema extended with `project.type`, `build.commands`, `test.commands`, `devtools.commands`, `paths` (2026-03-11)

The CLI's `ProjectConfig` type and the Plugin's `flowti.config.json` use incompatible schemas:

| CLI Schema | Plugin Schema | Gap |
|------------|---------------|-----|
| `tools.build: string` | `build.commands.fast/increment/full/watch/distribute` | CLI supports 1 build command; Plugin needs 5 |
| `reports.generators[].command` | `reports.scripts[].script` | Different field name and format |
| No `paths` section | `paths.pluginRoot/pluginOutput/reports/e2eVault` | Plugin needs path mapping |
| `docs.generators[].command` | No docs section | Plugin generates docs via scripts |
| No `project.type` field | Implicit: always "obsidian-plugin" | No way to detect project type |

**Remediation**: Extend `ProjectConfig` with `project.type`, `build.commands{}`, `test.commands{}`, `devtools.commands{}`, `reports.scripts[]`, `paths`. ONE schema — the Plugin rewrites its `flowti.config.json` to conform. No dual-format parsing.
**Effort**: L (8h)
**Phase 8 item**: 8.0.1–8.0.4

### TD-02: FLOWTI_TOOLS Constant Incomplete ✓ RESOLVED

**Domain**: infrastructure/types
**File**: `src/infrastructure/types.ts:139`
**Impact**: Menu system doesn't surface build/reports tools correctly
**Status**: Resolved — Build, reports, devtools entries added (2026-03-11)

`FLOWTI_TOOLS` array only contains `devtools`. The `build` and `reports` tool IDs are defined in the `FlowtiToolId` type but have no corresponding entries in the constant. This means the interactive menu doesn't auto-generate entries for these tools.

```typescript
// Current (incomplete):
export const FLOWTI_TOOLS: FlowtiToolDef[] = [
  { id: "devtools", key: "6", label: "Dev Tools" },
];
// Missing: build, reports
```

**Remediation**: Add missing entries or remove the constant if tools are resolved differently.
**Effort**: S (1h)

### TD-23: E2E Infrastructure Lives in Plugin, Not CLI

**Domain**: domain/e2e (Plugin → CLI migration)
**Files**: `Development/flowti/src/infrastructure/cli/ObsidianCli.ts`, `Development/flowti/tests/e2e/`
**Impact**: Blocks Phase 8.5 — CLI cannot run E2E journeys without owning the infrastructure

~8,000 LOC of E2E infrastructure currently lives in the Flowti Plugin:

| Component | LOC | Description |
|-----------|-----|-------------|
| ObsidianCli | ~360 | Obsidian 1.12+ CLI wrapper (16 methods) |
| Journey executor | ~400 | Step runner, action dispatch, assertion engine |
| Action runner | ~300 | DOM interaction, navigation, command execution |
| Environment providers (5) | ~500 | fresh/incremental/minimal/headless/mock providers |
| Helpers (15) | ~1,200 | fixtures, sequencer, highlight, errorContext, navigation, qc |
| Journey types | ~200 | JourneyConfig, JourneyStep, JourneyResult |
| E2E report generator | ~1,400 | Vault notes, canvases, event traces |
| Test files (69) | ~3,500 | 4 journey suites (prerequisites, installer, getting-started, component-library) |

The CLI's architecture already has `domain/e2e/` and `domain/review/` domains, but they lack the actual execution infrastructure. The Plugin should only own what runs inside Obsidian (event handlers, UI, domain services). E2E orchestration — building, launching, asserting, reporting — belongs in the CLI.

**Journey-as-blueprint model**: Projects declare testing needs via JSON journey definitions with `requires.tools`. The CLI resolves requirements from its environment provider registry and runs the journey. The Plugin provides only a thin Obsidian assertion adapter (vault state queries via EventBridge).

**Remediation**:
1. Migrate ObsidianCli, journey executor, action runner, environment providers, helpers, types to CLI's `domain/e2e/`
2. Migrate E2E report generator to CLI's `domain/reports/`
3. Migrate journey test files to CLI's `tests/e2e/`
4. Leave thin Obsidian assertion adapter in Plugin (vault state queries via EventBridge)
5. Update Plugin to remove migrated code (Phase 8.8)

**Effort**: XL (16h)
**Phase 8 item**: 8.5.1–8.5.8

---

## High

### TD-22: Only 1 Scaffold Definition, No Import Flow ✓ PARTIALLY RESOLVED

**Domain**: domain/scaffold, domain/project
**Files**: `src/domain/scaffold/definitions/`, `src/domain/project/project.ts`
**Status**: Partially resolved — 3 new scaffold definitions created (2026-03-11). Import flow still pending.

**What was done**:
1. Created `flowti-bare` scaffold definition — minimal TypeScript library (tsc-only, no bundler)
2. Created `flowti-cli` scaffold definition — TypeScript CLI tool with esbuild bundle and arg parser
3. Created `flowti-obsidian-plugin` scaffold definition — Obsidian plugin with manifest.json, styles.css, esbuild CJS externals
4. Created template registries: `bare-templates.ts` (2 templates), `cli-templates.ts` (2 templates), `plugin-templates.ts` (6 templates)
5. Updated `scaffold-service.ts` to import and register all 4 definitions + 5 template sets
6. Added 41 tests covering definition loading, validation, template resolution, dry run, and output

**Remaining**: Import flow for existing folders (Phase 8.7).
**Effort**: L (8h) — scaffold definitions done (~5h); import flow remains (~3h)

### TD-03: Reports Domain Size — 42 Files ✓ RESOLVED

**Domain**: domain/reports
**Files**: `src/domain/reports/` (42 files across 5 sub-directories)
**Status**: Resolved — reports domain reorganized into sub-directories (2026-03-11)

**What was done**:
1. Created `reports/pipeline/` — report-pipeline.ts, doc-pipeline.ts, report-runner.ts, doc-runner.ts
2. Created `reports/export/` — html-export.ts, report-archive.ts, report-diff.ts
3. Updated 18 consumer files (7 source + 11 test) with new import paths
4. All tests pass after reorganization

**Current structure**:
```
domain/reports/
├── cli/                   # 6 report generators + report-service
├── generators/            # 2 reference generators
├── analysis/              # Complexity + summary analysis
├── export/                # HTML, archive, diff
├── pipeline/              # Report + doc pipeline bridges + runners
├── generator-registry.ts  # Unified registry
└── report-events.ts       # Domain event map
```

**Effort**: M (4h) — as estimated

### TD-04: Legacy Dependency Map in report-pipeline.ts ✓ RESOLVED

**Domain**: domain/reports
**File**: `src/domain/reports/report-pipeline.ts:30-33`
**Status**: Resolved — Dependencies moved to `flowti.config.json` generator config (2026-03-11)
**Effort**: S (2h)

### TD-05: Shell Module Lacks Async Execution ✓ RESOLVED

**Domain**: infrastructure/shell
**File**: `src/infrastructure/shell.ts`
**Status**: Resolved — async shell methods added (2026-03-11)

**What was done**:
1. Added `runAsync(cmd, opts?)` to `IShell` interface — Promise-based execution via `child_process.exec`
2. Added `runParallel(cmds, opts?)` to `IShell` — runs multiple commands concurrently via `Promise.all`
3. Updated `mock-shell.ts` with matching mock implementations
4. Added 7 new tests (4 runAsync + 3 runParallel)

**Effort**: M (4h) — as estimated

### TD-06: No Config Validation Schema (Zod/AJV) ✓ RESOLVED

**Domain**: infrastructure
**Files**: `src/domain/project/config-schema.ts`, `src/domain/project/config-deep-validation.ts`
**Status**: Resolved — comprehensive validation exists (discovered pre-existing, 2026-03-11)

**What exists**:
1. `config-schema.ts` — `validateProjectConfig()` with 45+ validation rules covering all config sections
2. `config-deep-validation.ts` — filesystem-aware deep validation (paths exist, scripts runnable, etc.)
3. Zod was not needed — manual validation with exhaustive checks is sufficient and keeps zero-dependency promise

**Effort**: Already addressed during earlier phases

### TD-07: E2E Infrastructure Size — 35 Files

**Domain**: domain/e2e
**Files**: `src/domain/e2e/` (35 files)
**Impact**: Second-largest domain; mixes generic infrastructure with CLI-specific logic

The E2E domain contains the journey executor, journey loader, journey types, journey tools, environment providers (5), the test runner, and various helpers. Much of this is generic infrastructure that could benefit other projects too.

**Remediation**: Extract to `infrastructure/journey/` (generic engine) vs `domain/e2e/` (CLI-specific helpers and wiring).
**Effort**: M (4h)
**Phase 8 relevance**: Plugin's E2E tests would reuse the journey infrastructure.

### TD-24: No MVC Separation — Commands Mix Business Logic and Presentation ✓ RESOLVED

**Domain**: architecture (cross-cutting)
**Status**: Resolved — Symfony-inspired MVC refactoring complete (2026-03-10)

**What was done**:
1. Created `CliRequest` / `CliResponse<T>` types in `infrastructure/request-response.ts`
2. Created `controller/` directory with 15 controllers — thin handlers that accept `CliRequest`, call domain services, return `dataResponse(model, renderer)`
3. Extracted all ANSI display functions from domain/ into 11 `ui/*-display.ts` view files + `ui/common-renderers.ts`
4. Domain files retain only pure business logic (no `log()`, no ANSI imports)
5. `handleResponse()` at the edge dispatches JSON vs human-readable output
6. `adapt()` bridges `ControllerAction` → `CommandHandler` for `CommandRegistry`
7. 8 empty domain files deleted after command extraction

**Impact**: 84 commands across 15 controllers. All domain modules are presentation-free. `--format=json` works uniformly. New commands follow the established controller pattern.

**Effort**: L (8h) — as estimated

### TD-08: Wildcard Command Pattern Limited to report:*

**Domain**: infrastructure/command-registry
**File**: `src/infrastructure/command-registry.ts`
**Impact**: Only `report:*` uses the wildcard pattern; other domains use explicit registration

The wildcard pattern is useful for extensible domains but only one domain uses it. If Plugin integration adds more dynamic commands (e.g., `devtools:*` for plugin-specific devtools), the pattern needs to be generalized.

**Remediation**: No immediate action needed. Document the pattern and consider generalization when Phase 8.6 is implemented.
**Effort**: S (1h)

---

## Medium

### TD-09: Summary Report Generator Complexity — 309 LOC ✓ RESOLVED

**Domain**: domain/reports/cli
**File**: `src/domain/reports/cli/generate-summary-report.ts` (308 LOC)
**Status**: Resolved — already fully decomposed into 8 extracted modules

The main `generateSummaryReport()` function is a clean 39-line orchestrator. All heavy lifting is delegated to:
- `summary-loaders.ts` — data discovery and loading
- `summary-analyzers.ts` + `summary-analyzers-ext.ts` — finding detection
- `summary-renderers.ts` — document section rendering
- `summary-formatters.ts` — number/date formatting
- `summary-types.ts` — shared type definitions
- `summary-promotion.ts` — frontmatter promotion
- `summary-details.ts` — detailed metrics collection

**Effort**: Already addressed during Phase 7

### TD-10: No Shared Mock Factory for Shell

**Domain**: tests
**File**: `tests/mocks/mock-shell.ts`
**Impact**: Each test file manually creates shell mocks differently

While `createMockShell()` exists, many test files still mock the shell module inline with `vi.mock()`. A standardized factory would reduce boilerplate.

**Remediation**: Consolidate all test files to use `createMockShell()`.
**Effort**: S (2h)

### TD-11: Help Content Hardcoded in Source

**Domain**: ui/help
**File**: `src/ui/help-content.ts`
**Impact**: Help text must be updated in TypeScript source when commands change

Help sections are template literals in a `HELP` record. Adding a new command requires editing this file. For Phase 8, Plugin-specific help sections would need to be injected dynamically.

**Remediation**: Move to JSON/YAML help definitions that can be loaded per-project-type, or support `help.sections` in config.
**Effort**: M (3h)

### TD-12: ReportService Constructor Reads Config

**Domain**: domain/reports/cli
**File**: `src/domain/reports/cli/report-service.ts:20-25`
**Impact**: Side effect in constructor — reads file system

`ReportService` reads `flowti.config.json` in its constructor to resolve `reportsDir` and `referenceDir`. This makes testing harder and violates the dependency injection principle.

**Remediation**: Pass resolved paths as constructor parameters; let the caller read config.
**Effort**: S (2h)

### TD-13: Clock Module Not Consistently Used

**Domain**: infrastructure
**Impact**: Some generators use `new Date()` directly instead of `clock.now()`

The `clock` abstraction exists for testability but isn't used everywhere. Inconsistent usage means some timestamps can't be controlled in tests.

**Remediation**: Grep for `new Date()` and `Date.now()` in source files; replace with `clock` calls.
**Effort**: S (1h)

### TD-14: Document Builder Returns `this` Without Typing

**Domain**: infrastructure/document
**File**: `src/infrastructure/document.ts`
**Impact**: Fluent API loses type safety in some chains

The `Document` class uses a fluent API (`doc.heading().addBlank().text()`). The return type is `this` which works for single-level classes but could cause issues if the class is extended.

**Remediation**: Minor. Only address if Document is subclassed.
**Effort**: S (1h)

### TD-15: No Integration Test for docs Command ✓ RESOLVED

**Domain**: domain/reports
**Files**: `tests/domain/reports/doc-pipeline.test.ts`, `tests/domain/reports/doc-runner.test.ts`
**Status**: Resolved — 20 tests across 2 test files

- `doc-pipeline.test.ts` (12 tests): `toDocStep`, `toReferenceStep`, `buildDocSteps`, `runDocPipeline` — exercises full pipeline runner with controlled mocks
- `doc-runner.test.ts` (8 tests): `runAllDocs` facade — continuation after failure, output conversion, timing, exception handling, null output

**Effort**: Already addressed during Phase 7

### TD-16: No Project Type Discrimination ✓ RESOLVED

**Domain**: infrastructure/types
**File**: `src/infrastructure/types.ts`
**Status**: Resolved — `ProjectTarget` type and `type` field added to `ProjectConfig`

`ProjectTarget = "project" | "typescript" | "typescript-cli" | "obsidian-plugin"` is defined in `types.ts`. Config validation in `config-schema.ts` validates the type field. 4 scaffold definitions now exist matching the 4 project types.

**Effort**: M (3h) — as estimated

### TD-25: Controller Test Gap — 15 Controllers, 0 Dedicated Test Files

**Domain**: tests/controller
**Files**: `src/controller/*.ts` (15 files)
**Impact**: Controllers are tested indirectly via domain tests, but lack dedicated request→response assertions

The MVC refactoring (TD-24) created 15 controllers with the `CliRequest → ControllerAction → CliResponse<T>` pattern. None have dedicated test files asserting the controller layer — flag parsing, `adapt()` bridging, `dataResponse()` construction, and `handleResponse()` dispatch are only tested incidentally.

**Remediation**: Create `tests/controller/` directory with one test file per controller. Test: correct model returned for given flags, `--format=json` produces valid JSON, error cases return correct exit codes.
**Effort**: L (8h)
**Priority**: High — controllers are the API surface for AI agents

### TD-26: EventBus Infrastructure Created But Not Wired

**Domain**: infrastructure/event-bus
**Files**: `src/infrastructure/event-bus.ts`, `src/infrastructure/cli-events.ts`, `src/ui/cli-event-renderer.ts`
**Impact**: EventBus exists but nothing emits or subscribes to events at runtime

The EventBus was created during Phase 7.6 (domain purification) as infrastructure for Phase 8. Domain functions use the simpler injectable `log` callback pattern. The bus, event maps, and renderer are tested but not wired into `main.ts`.

**Remediation**: Wire in Phase 8 when Plugin integration requires cross-domain event communication. No immediate action needed — the injectable log pattern is sufficient for current needs.
**Effort**: S (2h)

### TD-27: Naming Inconsistency — kebab-case vs PascalCase Services ✓ RESOLVED

**Domain**: domain (cross-cutting)
**Status**: Resolved — PascalCase files renamed to kebab-case (2026-03-11)

**What was done**:
1. Renamed `E2EService.ts` → `e2e-service.ts` (+ test file)
2. Renamed `MakeService.ts` → `make-service.ts` (+ test file)
3. Updated all import paths referencing renamed files

**Effort**: S (2h) — as estimated

### TD-28: `new Date()` Usage in E2E Domain Files

**Domain**: domain/e2e
**Impact**: Timestamps in E2E files can't be controlled in tests

Several E2E domain files use `new Date()` directly instead of the `clock` abstraction from `infrastructure/clock.ts`. This makes test assertions on timestamps fragile.

**Remediation**: Replace `new Date()` with `clock.now()` in E2E domain files. The `clock` abstraction already exists and is used elsewhere.
**Effort**: S (1h)

---

## Low

### TD-17: R-02 Deferred — Generator Output Discriminated Unions

**Domain**: infrastructure/types
**Impact**: `GeneratorOutput.success` boolean is adequate now but doesn't support exhaustive matching

Deferred from Phase 5.1. The `--json` output works with the boolean pattern. Discriminated unions (`type: "success" | "failure"`) would improve type safety when adding new output shapes.

**Effort**: S (2h)

### TD-18: R-04 Deferred — Files Over 300 LOC

**Domain**: various
**Impact**: 8 source files exceed 300 LOC

Top files: `journey-tools.ts` (358), `pipeline-runner.ts` (353), `cli-reference.ts` (348), `summary-loaders.ts` (343), `tool-reference.ts` (337), `types.ts` (333), `marketplace.ts` (333), `ai-tool-commands.ts` (330).

None are extreme (all under 360 LOC) and most are well-decomposed internally. Not urgent.

**Effort**: M (4h total if addressed)

### TD-19: 5.5 Deferred — Progress Indicators

**Domain**: infrastructure
**Impact**: Long operations show only start/end labels, no progress

Deferred from Phase 5. Current label-based output is adequate for CI and AI agent use. Progress bars would improve human DX during long report runs or E2E suites.

**Effort**: M (3h)

### TD-20: No Async Pipeline Support for Long Operations

**Domain**: infrastructure/pipeline
**Impact**: Pipeline steps run sequentially even when independent

The pipeline supports phased execution but within a phase, steps run sequentially. True parallel execution (Promise.all for independent steps) would speed up report generation.

**Effort**: M (3h)

### TD-21: CSS Build Not Abstracted

**Domain**: (not in CLI, but relevant for Phase 8)
**Impact**: Plugin's CSS concatenation pipeline is in `esbuild.config.mjs`, not reusable

When the CLI manages Plugin builds, it needs to understand the CSS pipeline. Currently this is embedded in the esbuild config script.

**Remediation**: Extract CSS concatenation into a reusable function or CLI command (`build:css`).
**Effort**: S (2h)
**Phase 8 item**: 8.1.3

### TD-29: Domain Layer DI Violations — 82 Direct Infrastructure Imports

**Domain**: architecture (cross-cutting)
**Files**: 19 domain files import `Document`, 16 import `parseFrontmatter*`, 4 import `pipeline-runner`, 2 import `countFiles`, 2 import `InternalError`
**Impact**: Domain functions are not pure — hidden coupling to infrastructure makes isolated testing harder

The domain layer should receive all infrastructure capabilities via `CliDeps` injection. Currently, 82 import statements bypass this pattern by importing infrastructure modules directly.

**Highest-impact targets**:
1. `Document` class (19 files) — create `IDocumentBuilder` interface
2. `parseFrontmatter*` utilities (16 files) — create `IFrontmatterParser` interface
3. `pipeline-runner` (4 files) — inject via `E2EDeps`

**Remediation**: Define domain-level interfaces, add to `CliDeps` ISP subsets, update consumers.
**Effort**: L (12h)
**Priority**: High — largest single architectural deviation

### TD-30: Store Pattern Duplication Across 7 Domains

**Domain**: capa, deliverables, lifecycle, raid, requirements, resources, timelog
**Impact**: ~700 LOC of duplicated CRUD-over-markdown patterns

All 7 store implementations repeat: directory listing → `.md` filter → `parseFrontmatterStrings` → typed summary mapping → `Document.create()` → `mergeFrontmatter()` → save.

**Remediation**: Extract a `MarkdownStore<T>` factory or base that handles shared CRUD operations. Domain stores reduce to type definitions + domain-specific query/filter logic.
**Effort**: M (6h)
**Priority**: Medium — reduces duplication, simplifies future domain additions

---

## Resolution Tracking

| ID | Status | Resolved In | Notes |
|----|--------|-------------|-------|
| TD-01 | Resolved | Pre-Phase 8 | Schema extended: type, build.commands, test.commands, devtools.commands, paths |
| TD-02 | Resolved | Pre-Phase 8 | FLOWTI_TOOLS now has build, reports, devtools |
| TD-03 | Resolved | Pre-Phase 8 | Reports domain reorganized into pipeline/, export/, cli/, generators/, analysis/ |
| TD-04 | Resolved | Pre-Phase 8 | Dependencies moved to flowti.config.json, legacy map removed |
| TD-05 | Resolved | Pre-Phase 8 | runAsync() + runParallel() added to IShell |
| TD-06 | Resolved | Pre-Phase 8 | validateProjectConfig() with 45+ rules + deep validation |
| TD-07 | Open | — | Phase 8 enabler |
| TD-08 | Open | — | Monitor |
| TD-09 | Resolved | Phase 7 | Already decomposed into 8 modules; 39-line orchestrator |
| TD-10 | Open | — | Test quality |
| TD-11 | Open | — | Phase 8 enabler |
| TD-12 | Resolved | Pre-Phase 8 | Constructor accepts opts; coverageDir uses stored relDir |
| TD-13 | Resolved | Pre-Phase 8 | 6 non-E2E files migrated to clock abstraction |
| TD-14 | Open | — | Minor |
| TD-15 | Resolved | Phase 7 | 20 tests across doc-pipeline + doc-runner test files |
| TD-16 | Resolved | Pre-Phase 8 | ProjectTarget type added, wired into config + validation |
| TD-17 | Open | — | Deferred from P5 |
| TD-18 | Open | — | Deferred from P1 |
| TD-19 | Open | — | Deferred from P5 |
| TD-20 | Open | — | Performance |
| TD-21 | Open | — | Phase 8 |
| TD-22 | Partial | Pre-Phase 8 | 3 new scaffold definitions created; import flow pending (Phase 8.7) |
| TD-23 | Open | — | Phase 8.5 blocker (E2E migration) |
| TD-24 | Resolved | Pre-Phase 8 | MVC refactoring: 15 controllers, 11 display renderers, request-response abstraction |
| TD-25 | Open | — | Controller test gap (22 controllers, 2 test files) |
| TD-26 | Open | — | EventBus created, not wired (deferred to Phase 8) |
| TD-27 | Resolved | Pre-Phase 8 | E2EService→e2e-service, MakeService→make-service |
| TD-28 | Open | — | `new Date()` in E2E domain files |
| TD-29 | Open | — | 82 DI violations: domain imports infrastructure directly |
| TD-30 | Open | — | 7 stores duplicate CRUD-over-markdown pattern |
