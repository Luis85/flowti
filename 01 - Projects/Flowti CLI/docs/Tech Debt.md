---
type: TechDebt
domain: CLI
title: Flowti CLI — Technical Debt Register
version: 1
created: 2026-03-10
updated: 2026-03-10
status: active
source: "[[Development Roadmap]]"
---

# Flowti CLI — Technical Debt Register

> Curated inventory of technical debt across the Flowti CLI codebase. Items are categorized by severity, domain, and estimated remediation effort. Prioritized by impact on Phase 8 (Plugin Integration).

---

## Summary

| Severity | Count | Estimated Hours |
|----------|-------|-----------------|
| Critical | 3 | 28h |
| High | 7 | 32h |
| Medium | 8 | 20h |
| Low | 5 | 8h |
| **Total** | **23** | **88h** |

---

## Critical

### TD-01: Config Schema Mismatch Between CLI and Plugin

**Domain**: infrastructure/types
**File**: `src/infrastructure/types.ts` (ProjectConfig)
**Impact**: Blocks Phase 8 entirely

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

### TD-02: FLOWTI_TOOLS Constant Incomplete

**Domain**: infrastructure/types
**File**: `src/infrastructure/types.ts:139`
**Impact**: Menu system doesn't surface build/reports tools correctly

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

### TD-22: Only 1 Scaffold Definition, No Import Flow

**Domain**: domain/scaffold, domain/project
**Files**: `src/domain/scaffold/definitions/`, `src/domain/project/project.ts`
**Impact**: CLI can only create one project type; no way to onboard existing codebases

The CLI ships with a single scaffold definition (`flowti-project`) that creates a TypeScript project. There is no `project` (bare markdown), `typescript-cli`, or `obsidian-plugin` definition. There is also no flow for importing an existing folder into CLI management.

**Remediation**:
- Create 3 new scaffold definitions: `flowti-bare`, `flowti-cli`, `flowti-obsidian-plugin`
- Add "Import Project" to the Start Menu: snapshot project list → prompt user to copy folder → detect new folders → ask type → generate config
- Add project type detection heuristics for import: `manifest.json` → obsidian-plugin, `bin` in package.json → typescript-cli, `package.json` → typescript, else → project

**Effort**: L (8h)
**Phase 8 item**: 8.0.3, 8.0.4, 8.7

### TD-03: Reports Domain Size — 42 Files

**Domain**: domain/reports
**Files**: `src/domain/reports/` (42 files, ~3,000+ LOC)
**Impact**: Largest domain by file count; hard to navigate

The reports domain contains 6 CLI generators, 2 reference generators, the report pipeline bridge, the doc pipeline bridge, the runner facades, archive, diff, HTML export, caching, complexity analysis, summary analysis (types, loaders, renderers, formatters, analyzers), and the report service. This is 3x the size of the next-largest domain.

**Remediation**: Extract sub-domains:
- `reports/generators/` — already partially done (cli-reference, entity-reference)
- `reports/analysis/` — complexity-analyzer, summary-loaders, summary-analyzers, summary-renderers, summary-formatters, summary-types
- `reports/export/` — html-export, report-archive, report-diff
- `reports/pipeline/` — report-pipeline, doc-pipeline, report-runner, doc-runner

**Effort**: M (4h)
**Phase 8 relevance**: Plugin adds 14 more generators; domain grows even larger without reorganization.

### TD-04: Legacy Dependency Map in report-pipeline.ts

**Domain**: domain/reports
**File**: `src/domain/reports/report-pipeline.ts:30-33`
**Impact**: Duplicated knowledge — dependencies should be in config

```typescript
const LEGACY_DEPENDENCIES: Record<string, string[]> = {
  status: ["test", "coverage", "codebase", "complexity"],
  summary: ["test", "coverage", "codebase", "complexity", "status"],
};
```

These hardcoded dependencies duplicate what should be declared in `flowti.config.json` via the `dependencies` field on each generator.

**Remediation**: Migrate dependencies to config; remove hardcoded map.
**Effort**: S (2h)

### TD-05: Shell Module Lacks Async Execution

**Domain**: infrastructure/shell
**File**: `src/infrastructure/shell.ts`
**Impact**: All shell commands block the main thread

Every `IShell` method is synchronous (`execSync`, `spawnSync`). The only async option is `spawnBackground` for long-running processes. For Phase 8's multi-step build pipelines, async execution would enable better progress reporting and parallelism.

**Remediation**: Add `runAsync()` and `runCaptureAsync()` methods using `spawn` with promise-based output collection.
**Effort**: M (4h)

### TD-06: No Config Validation Schema (Zod/AJV)

**Domain**: infrastructure
**File**: `src/domain/project/project-config.ts`
**Impact**: Config validation is manual if-checks, not schema-driven

The Plugin uses Zod for settings validation, but the CLI validates config manually. As `ProjectConfig` v2 grows more complex (Phase 8), manual validation becomes error-prone.

**Remediation**: Add Zod (dev dependency only, tree-shaken at build time) or keep manual but add a `validateProjectConfig()` function with exhaustive field checks.
**Effort**: M (4h)

### TD-07: E2E Infrastructure Size — 35 Files

**Domain**: domain/e2e
**Files**: `src/domain/e2e/` (35 files)
**Impact**: Second-largest domain; mixes generic infrastructure with CLI-specific logic

The E2E domain contains the journey executor, journey loader, journey types, journey tools, environment providers (5), the test runner, and various helpers. Much of this is generic infrastructure that could benefit other projects too.

**Remediation**: Extract to `infrastructure/journey/` (generic engine) vs `domain/e2e/` (CLI-specific helpers and wiring).
**Effort**: M (4h)
**Phase 8 relevance**: Plugin's E2E tests would reuse the journey infrastructure.

### TD-08: Wildcard Command Pattern Limited to report:*

**Domain**: infrastructure/command-registry
**File**: `src/infrastructure/command-registry.ts`
**Impact**: Only `report:*` uses the wildcard pattern; other domains use explicit registration

The wildcard pattern is useful for extensible domains but only one domain uses it. If Plugin integration adds more dynamic commands (e.g., `devtools:*` for plugin-specific devtools), the pattern needs to be generalized.

**Remediation**: No immediate action needed. Document the pattern and consider generalization when Phase 8.6 is implemented.
**Effort**: S (1h)

---

## Medium

### TD-09: Summary Report Generator Complexity — 309 LOC

**Domain**: domain/reports/cli
**File**: `src/domain/reports/cli/generate-summary-report.ts` (309 LOC)
**Impact**: Hardest generator to maintain; mixes data loading, analysis, and rendering

The summary report is the most complex generator because it aggregates data from all other reports. It loads test results, coverage, codebase metrics, complexity, build data, and lint output, then scores and renders them.

**Remediation**: Already partially decomposed into summary-loaders, summary-analyzers, summary-renderers, summary-formatters, summary-types. The main function still orchestrates too much. Extract `collectSummaryData()` and `scoreSummary()` as standalone functions.
**Effort**: M (3h)

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

### TD-15: No Integration Test for docs Command

**Domain**: domain/reports
**File**: `tests/domain/reports/reports.test.ts`
**Impact**: `docs` command tested via mock only; no end-to-end pipeline test

The `docs` command now delegates to `runAllDocs()` which goes through the pipeline. But the test only verifies the delegation via a mock. There's no integration test that runs the actual pipeline with mock generators.

**Remediation**: Add an integration test in `doc-pipeline.test.ts` that verifies the full pipeline flow with controlled reference generator mocks.
**Effort**: S (1h)

### TD-16: No Project Type Discrimination

**Domain**: infrastructure/types
**File**: `src/infrastructure/types.ts`
**Impact**: CLI treats all projects identically — no way to enable/disable features by project type

There's no `project.type` field in `ProjectConfig`. The CLI doesn't know whether a project is a bare markdown project, a TypeScript library, a CLI tool, or an Obsidian plugin. This means all features are available for all projects even when they don't apply.

**Remediation**: Add `ProjectTarget = "project" | "typescript" | "typescript-cli" | "obsidian-plugin"` and `type?: ProjectTarget` to `ProjectConfig`. Use it to:
- Show/hide menu items (e.g., `dev:reload` only for obsidian-plugin projects)
- Select appropriate E2E provider
- Apply project-type-specific config validation
- Drive scaffold definition selection (4 project types = 4 scaffold definitions)
- Support project import flow (type detection heuristics + user confirmation)

**Effort**: M (3h)
**Phase 8 item**: 8.0.1

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

---

## Resolution Tracking

| ID | Status | Resolved In | Notes |
|----|--------|-------------|-------|
| TD-01 | Open | — | Blocks Phase 8 |
| TD-02 | Open | — | Quick fix |
| TD-03 | Open | — | Ongoing refactoring |
| TD-04 | Open | — | Config migration |
| TD-05 | Open | — | Phase 8 enabler |
| TD-06 | Open | — | Phase 8 enabler |
| TD-07 | Open | — | Phase 8 enabler |
| TD-08 | Open | — | Monitor |
| TD-09 | Open | — | Refactoring |
| TD-10 | Open | — | Test quality |
| TD-11 | Open | — | Phase 8 enabler |
| TD-12 | Open | — | Clean architecture |
| TD-13 | Open | — | Consistency |
| TD-14 | Open | — | Minor |
| TD-15 | Open | — | Test coverage |
| TD-16 | Open | — | Phase 8 blocker |
| TD-17 | Open | — | Deferred from P5 |
| TD-18 | Open | — | Deferred from P1 |
| TD-19 | Open | — | Deferred from P5 |
| TD-20 | Open | — | Performance |
| TD-21 | Open | — | Phase 8 |
| TD-22 | Open | — | Phase 8 blocker (scaffold + import) |
| TD-23 | Open | — | Phase 8.5 blocker (E2E migration) |
