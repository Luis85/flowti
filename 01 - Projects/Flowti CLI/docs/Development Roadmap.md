---
type: Roadmap
domain: CLI
title: Flowti CLI — Development Roadmap
version: 2
created: 2026-03-09
updated: 2026-03-10
status: active
source: "[[Flowti CLI PRD]]"
architecture: "[[Flowti CLI Architecture]]"
tech_debt: "[[Tech Debt]]"
plugin_integration: "[[Plugin Integration Analysis]]"
---

# Flowti CLI — Development Roadmap

> Synthesized from PRD v10, Architecture v18, and codebase analysis. Phases 5–7 are **complete**. Next target: **Phase 8 (Plugin Integration)** — migrate the Flowti Plugin to be a managed Flowti CLI project, unifying build, test, report, and E2E pipelines across both apps.

---

## Current State (2026-03-10)

| Metric | Value | Δ from v1 |
|--------|-------|-----------|
| Source files | 239 | +68 |
| Test files | 140 | +22 |
| Tests passing | 2,565 (140 suites) | +304 |
| Source LOC | ~62,022 | +38,759 |
| Domains | 18 | — |
| Infrastructure modules | 21 | — |
| Non-interactive commands | 84 | — |
| Dependencies | 0 (runtime) | — |
| Feature Requests (PRD) | 22 (FR-01 – FR-22) | — |
| Improvements (PRD) | 45 (IMP-01 – IMP-45) | — |
| Completed FRs | 22/22 | +2 |
| Completed IMPs | 30/45 (67%) | +10 |
| E2E environment providers | 5 (cli, typescript, obsidian-vault, obsidian-plugin, webapp) | NEW |
| Pipeline domains | 2 (reports, docs) | NEW |
| Journey base tools | 9 | NEW |

---

## Priority 0: Test Hardening — COMPLETE

**Result**: +72 new tests (1,780 → 1,852), +8 new test files, +8 suites (101 → 109).

| # | Domain | New Tests | New Files |
|---|--------|-----------|-----------|
| T-01 | **ai-tools** | +15 (commands + reference) | `ai-tool-commands.test.ts`, `ai-tool-reference.test.ts` |
| T-02 | **plugins** | +12 (commands + reference) | `plugin-commands.test.ts`, `plugin-reference.test.ts` |
| T-03 | **info** | +11 (collectProjectInfo) | `info-collect.test.ts` |
| T-04 | **capture** | Already at 35 tests — adequate | — |
| T-05 | **health** | +10 (display + collectHealth) | `health-display.test.ts` |
| T-06 | **help** | +9 (sections + commands) | `help-sections.test.ts` |
| T-07 | **onboarding** | +11 (prereqs + deps + first-run) | `onboarding-prereqs.test.ts` |
| T-08 | **knowledgebase** | +12 (vault-service edge cases) | `vault-service.test.ts` |

---

## Priority 1: Refactoring

**Goal**: Reduce maintenance cost and improve extensibility before Phase 5 features.

### ~~R-01: Extract help text constants~~ — SKIPPED

Help text is already exported as a `Record<string, string>` constant (`HELP`), testable independently. New test file (`help-sections.test.ts`) validates all 10 sections. No extraction needed.

### R-02: Report generator discriminated unions — DEFERRED to Phase 5.1

The current `GeneratorOutput { success: boolean }` works well with the resilient runner. Discriminated unions become valuable when `--json` output is added (Phase 5.1), where exhaustive matching matters. Defer until then to avoid churn.

### ~~R-03: Command registry consolidation~~ — ALREADY EXISTS

`CommandRegistry` already exists at `src/infrastructure/command-registry.ts` with typed registration, collision detection, domain grouping, and project-free flags. No additional work needed.

### R-04: Break up large files — DEFERRED

8 source files exceed 300 LOC but the largest (333–375 LOC) are not extreme. Defer to Phase 5 sprint 3 alongside other DX items.

---

## Phase 5: Agent-Native & DX (from PRD)

**Goal**: Make every command usable by both humans and AI agents.

| # | Work Item | IMP | Priority | Effort | Dependencies |
|---|-----------|-----|----------|--------|-------------|
| 5.1 | **`--json` output flag** — ✅ DONE | IMP-28 | Critical | L | ~~R-03~~ (exists) |
| 5.2 | **Quality Gates** — ✅ DONE | IMP-29 | High | M | T-05 (health tests) |
| 5.3 | **Scaffold `--dry-run`** — ✅ DONE | IMP-30 | High | S | — |
| 5.4 | **Global output flags** — ✅ DONE | IMP-34 | High | M | 5.1 |
| 5.5 | **Progress indicators** — Spinners and progress bars | IMP-31 | Medium | M | — |
| 5.6 | **Post-command suggestions** — ✅ DONE | IMP-33 | Medium | S | — |
| 5.7 | **Report diff mode** — ✅ DONE | IMP-32 | Medium | M | — |

### 5.1: `--json` Output — COMPLETE

9 query commands support `--format=json`. Pattern: `resolveFormat(flags)` + `printOutput()`. Write operations (`make:*`, `build`, `test`) and shell wrappers don't need JSON. +10 tests.

### 5.2: Quality Gates — COMPLETE

New files: `src/domain/health/quality-gate.ts`, updated `publish.ts`.

- **Config**: `health.qualityGates` in `flowti.config.json` — `{ enabled, minScore, rules[] }`
- **Rules**: `{ metric, operator (>=, <=, ==), value }` — resolves dot-path metrics from HealthSnapshot
- **Integration**: `publish` and `publish:all` check gates before executing (bypass with `--skip-gates`)
- **New command**: `publish:check` — preview gate status without publishing, supports `--format=json`
- **Default gates**: score ≥ 60, zero test failures, zero lint errors
- **Tests**: +27 quality-gate unit tests + 8 publish integration tests = +35

### 5.3: Scaffold `--dry-run` — COMPLETE

- `scaffold:new --name=X --dry-run` previews files without writing
- Supports `--format=json` for machine-readable output
- New function: `scaffoldDryRun()` in scaffold-service.ts
- **Tests**: +6 tests (dry-run text, file list, JSON, error handling)

### 5.4: Global Output Flags — COMPLETE

- `--quiet` — suppresses `log`/`info`/`blank` (errors and warnings still shown)
- `--verbose` — enables `debug()` output
- `--no-color` — strips ANSI escape sequences from all output
- Implementation: `setLogLevel()` + `setColorEnabled()` in `logger.ts`, wired via `applyGlobalFlags()` in `main.ts`
- **Tests**: +11 tests (quiet mode, verbose mode, no-color mode)

### 5.6: Post-command Suggestions — COMPLETE

- `showSuggestions()` in `infrastructure/suggestions.ts` — displays contextual next-step hints
- Context-aware builders: `afterScaffold`, `afterMakeComponent`, `afterPublish`, `afterReports`
- Wired into `scaffold:new` and `make:component` commands
- **Tests**: +7 tests in `suggestions.test.ts`

### 5.7: Report Diff Mode — COMPLETE

- `reports:diff` command compares frontmatter metrics between the two most recent archived reports per category
- Pure logic in `report-diff.ts`: `extractMetrics()`, `compareMetrics()`, `diffReports()`
- Skips non-metric keys (type, project, date, schema_version)
- Sorts deltas by absolute magnitude, formats with +/- signs
- Supports `--format=json` for machine-readable output
- **Tests**: +12 tests in `report-diff.test.ts`

**Exit criteria**: Every query command supports `--json`. Publish is gated by quality thresholds. CI pipelines can run headlessly.

---

## Phase 6: Depth (from PRD)

**Goal**: Turn "Shallow" features into reliable tools.

| # | Work Item | IMP | Priority | Effort | Dependencies |
|---|-----------|-----|----------|--------|-------------|
| 6.1 | **Capture enrichment** — ✅ DONE | IMP-22 | High | M | T-04 (capture tests) |
| 6.2 | **Event contract validation** — ✅ DONE | IMP-18 | High | L | — |
| 6.3 | **Health trends** — ✅ DONE | IMP-26 | Medium | M | T-05 (health tests) |
| 6.4 | **AI Tool execution** — ✅ DONE | IMP-24 | Medium | L | T-01 (ai-tools tests) |
| 6.5 | **npm audit integration** — ✅ DONE | IMP-41 | Medium | S | 5.2 |
| 6.6 | **Technical debt estimation** — ✅ DONE | IMP-42 | Low | M | 5.2 |
| 6.7 | **Marketplace export** — ✅ DONE | IMP-25 | Low | M | — |
| 6.8 | **Event TypeScript codegen** — ✅ DONE | IMP-18 | Low | M | 6.2 |

### 6.1: Capture Enrichment — COMPLETE

- **Tags**: `--tags=a,b` flag on `capture:idea` and `capture:note` — stored as YAML array in frontmatter
- **Search**: `capture:search --query="keyword" [--type=idea] [--tag=urgent]` — searches titles, types, tags, and body content; supports `--format=json`
- **Batch import**: `capture:import --file=items.json` — imports array of `{ type, title, body?, tags? }` items; reports created/skipped counts
- **Tests**: +16 tests (4 tags, 6 search, 6 import)

### 6.2: Event Contract Validation — COMPLETE

- **Runtime payload validator**: `validatePayload(contract, payload)` — checks required fields, type matching (string/number/boolean/object/array/Date), unknown field detection
- **`findContract(contracts, eventName)`** — lookup helper for runtime use
- **`events:check-payload`** — CLI command: `--event="user.created" --payload='{"id":"1"}'` — validates a JSON payload against a contract, exits 1 on failure
- **CI exit code**: `events:validate` now exits with code 1 when contracts have errors
- **Tests**: +12 tests (10 validatePayload, 2 findContract)

### 6.3: Health Trends — COMPLETE

- **Snapshot persistence**: `health-trends.ts` — saves timestamped JSON files in `reports/health/`, auto-trims to 30 entries
- **`health:snapshot`** — saves current health + score as a timestamped snapshot
- **`health:history`** — lists stored snapshots with date, grade, score, test count; supports `--format=json`
- **Trend deltas**: `computeDeltas()` compares score, tests, coverage, build, lint, components between snapshots
- **Trend indicators**: `health` command now shows trend line (▲/▼ indicators) when history exists
- **Tests**: +10 tests (saveSnapshot, loadHistory, computeDeltas, buildTrend)

### 6.4: AI Tool Execution — COMPLETE

- **`ai:run --tool=<name>`** — executes an AI tool by name with parameter substitution
- **`substituteParams()`** — replaces `{{param}}` placeholders in `run` commands with flag values or defaults
- **Required param validation** — checks all required params are provided before execution
- **`--dry-run`** — previews the substituted command and cwd without executing
- **cwd support** — uses `tool.definition.cwd` (relative to vault root) when defined
- **Error handling** — reports missing tool, invalid tool, missing params, non-zero exit codes
- **Tests**: +15 tests (6 substituteParams, 9 ai:run)

### 6.5: npm Audit Integration — COMPLETE

- **`SecurityMetrics`** type — `{ critical, high, moderate, low, info, total }` added to `HealthSnapshot`
- **`collectSecurityMetrics()`** — runs `npm audit --json` when `package.json` exists
- **`parseAuditJson()`** — parses both npm audit v2 (metadata.vulnerabilities) and v3 (flat vulnerabilities) format
- **`scoreSecurity()`** — scoring: critical -30, high -15, moderate -5, low -1 per vulnerability
- **Weight redistribution** — Tests 25%, Coverage 20%, Build 20%, Lint 15%, Security 10%, Git 10%
- **Dashboard display** — shows vulnerability counts by severity with color coding
- **Summary indicator** — Security ✓/✗ based on zero critical+high vulnerabilities
- **Tests**: +11 tests (6 security scoring, 5 parseAuditJson)

### 6.6: Technical Debt Estimation — COMPLETE

- **`estimateDebt(snapshot, score)`** — pure function computing remediation effort from health metrics
- **Cost model** — failing test 0.5h, lint error 0.25h, lint warning 0.1h (above 10), coverage gap 0.5h/point below 80%, build fix 4h, critical vuln 2h, high vuln 1h, moderate 0.5h, low 0.1h
- **`DebtItem`** type — `{ category, description, estimatedHours, severity }`
- **`debt:estimate`** command — displays debt items sorted by severity, supports `--format=json`
- **Tests**: +12 tests in `tech-debt.test.ts`

### 6.7: Marketplace Export — COMPLETE

- **`ExportBundle`** type — versioned JSON containing AI tools, plugins, scaffold definitions
- **`exportBundle(vaultRoot, projectRoot)`** — collects valid definitions from all three domains
- **`saveBundle(bundle, outputPath)`** / **`loadBundle(path)`** — serialize/deserialize
- **`importAiToolsFromBundle(bundle, vaultRoot)`** — import tools into another vault (skip duplicates)
- **`marketplace:export`** command — preview bundle or save with `--output=<path>`, supports `--format=json`
- **`marketplace:import-bundle`** command — import AI tools from a bundle file
- **Tests**: +11 tests in `marketplace-export.test.ts`

### 6.8: Event TypeScript Codegen — COMPLETE

- **`generateEventTypes(contracts)`** — pure function producing TypeScript source from event contracts
- **`eventNameToInterfaceName(name)`** — converts dotted/hyphenated names to PascalCase + "Payload" suffix
- **Type mapping** — string→string, number→number, boolean→boolean, object→Record<string, unknown>, array→unknown[], Date→string|Date, PascalCase custom types pass through
- **`EventPayloadMap`** — union interface mapping event names to payload types
- **`events:codegen`** command — generates `src/generated/event-types.ts` (or `--out=<path>`)
- **Tests**: +14 tests in `event-codegen.test.ts`

**Exit criteria**: Phase 6 COMPLETE (8/8 items done). All depth features are functional: capture enrichment, event contracts + codegen, health trends + security + tech debt, AI tool execution, and marketplace export.

---

## Phase 7: Ecosystem (from PRD)

**Goal**: Force multiplier across projects, teams, and AI agents.

| # | Work Item | IMP | Priority | Effort | Dependencies |
|---|-----------|-----|----------|--------|-------------|
| 7.1 | **Shell completions** — ✅ DONE | IMP-35 | Medium | M | R-03 |
| 7.2 | **Change-based selective review** — ✅ DONE | IMP-36 | Medium | L | — |
| 7.3 | **Report caching** — ✅ DONE | IMP-43 | Medium | M | — |
| 7.4 | **Parallel report generation** — ✅ DONE | IMP-45 | Medium | M | R-02 |
| 7.5 | **Interactive dependency browser** — ✅ DONE | IMP-27 | Medium | L | — |
| 7.6 | **Template versioning** — ✅ DONE | IMP-40 | Medium | L | — |
| 7.7 | **HTML report export** — ✅ DONE | IMP-44 | Low | M | — |
| 7.8 | **Self-update** — ✅ DONE | IMP-12 | Low | M | — |
| 7.9 | **Plugin lifecycle hooks** — ✅ DONE | IMP-37 | Low | L | T-02 |
| 7.10 | **Cross-vault sharing** — ✅ DONE | IMP-25 | Low | XL | 6.7, 7.9 |

### 7.1: Shell Completions — COMPLETE

- **`generateCompletions(shell, commands)`** — dispatches to shell-specific generators
- **4 shells**: bash (compgen), zsh (compdef), fish (complete -c), PowerShell (Register-ArgumentCompleter)
- **`completions` command** — `flowti completions [shell]` outputs completion script for the given shell
- **Dynamic**: uses `registry.keys()` to include all registered commands (builtins + plugins)
- **Tests**: +11 tests in `completions.test.ts`

### 7.2: Change-based Selective Review — COMPLETE

- **`parseGitStatus()`** — parses `git status --porcelain` output into `ChangedFile[]`
- **`parseGitDiffNameStatus()`** — parses `git diff --name-status` tab-separated output
- **`analyzeChanges()`** — matches changed files against 13 domain rules (src, tests, domain-logic, infrastructure, styles, docs, configs, scripts, dependencies, typescript, lint, documentation)
- **`ChangeImpact`** type — `{ affectedDomains, suggestedActions, changedFiles, summary }`
- **`review:changes`** command — analyzes working tree or branch diff (`--base=<branch>`), supports `--format=json`
- **`analyzeWorkingTree()`** / **`analyzeBranchDiff()`** — convenience wrappers
- **Tests**: +32 tests in `change-analysis.test.ts`

### 7.3: Report Caching — COMPLETE

- **`report-cache.ts`** — Hash-based cache for report generators using SHA-256 content hashing
- **Input source mapping** — Maps generator IDs to their primary input files (test→testreport.json, coverage→coverage-final.json, codebase→codebase.json, complexity→analysis.json)
- **`hashFiles()`** — Computes SHA-256 of concatenated input file contents
- **`getCachedOutput()` / `setCachedOutput()`** — Check and update cache entries keyed by generator ID
- **Cache file** — `.report-cache.json` in the reports directory, stores `{ inputHash, output, timestamp }` per generator
- **Runner integration** — `runAllReports()` checks cache before executing each generator; caches successful outputs
- **`--no-cache` flag** — `reports --no-cache` forces regeneration, skipping cache
- **`reports:cache-clear`** command — clears the cache file
- **Summary display** — Shows "N cached" count in the run summary
- **Tests**: +25 tests (21 report-cache + 4 runner cache integration)

### 7.4: Parallel Report Generation — COMPLETE

- **`report-phases.ts`** — Dependency-aware generator scheduling
- **`partitionByDependency()`** — Groups generators into ordered phases based on dependency graph
- **Built-in dependency map** — status depends on test/coverage/codebase/complexity; summary depends on all + status
- **Phase execution** — Phase 0 (independent) runs first, Phase 1+ (dependent) follow in order
- **`collectPrerequisites()`** — Deduplicates and collects all prerequisites for a phase
- **`--parallel` flag** — `reports --parallel` activates phased execution mode
- **Phased runner** — Runs prerequisites per-phase upfront, then all generators in that phase; marks failed prereqs
- **Custom dependencies** — Supports custom dependency maps for extensibility
- **Tests**: +17 tests (14 partitionByDependency/collectPrerequisites + 3 phased runner integration)

### 7.5: Interactive Dependency Browser — COMPLETE

- **`findReverseDeps(graph, project)`** — Find all projects that depend on a given project
- **`findDirectDeps(graph, project)`** — Find all direct dependencies of a project
- **`filterByType(edges, type)`** — Filter edges by npm/config/publish type
- **`graphStats(graph)`** — Compute stats: projects, edges, cycles, isolated count, most deps, most depended on
- **`--project=X`** flag — Focus view showing direct + reverse deps for a specific project
- **`--reverse`** flag — Show reverse dependency view (who depends on each project)
- **`--type=npm|publish|config`** flag — Filter dependencies by type
- **`--stats`** flag — Show dependency graph statistics
- **All flags combine** with `--format=json` for machine-readable output
- **Tests**: +14 tests (3 findReverseDeps, 2 findDirectDeps, 3 filterByType, 5 graphStats, 1 combined)

### 7.6: Template Versioning — COMPLETE

- **`scaffold-version.ts`** — Template versioning and update detection with conflict resolution
- **`ScaffoldManifest`** type — Stores definition ID, creation date, and SHA-256 file hashes
- **`createManifest()`** — Generates manifest from scaffold output for storage in the project
- **`diffScaffold()`** — Compares stored manifest + current files against updated template plan
- **`FileDiff`** statuses — `unchanged`, `modified` (safe to update), `added`, `removed`, `conflict` (user + template both changed)
- **`markConflict()`** — Generates git-style conflict markers (`<<<<<<<` / `=======` / `>>>>>>>`)
- **`resolveUpdates()`** — Applies conflict strategy: `overwrite` (force template), `skip` (keep user changes), `mark` (insert conflict markers)
- **Smart detection** — Only marks as "conflict" when both user AND template modified the same file; safe auto-update when only template changed
- **Tests**: +20 tests in `scaffold-version.test.ts`

### 7.7: HTML Report Export — COMPLETE

- **`html-export.ts`** — Lightweight markdown-to-HTML converter with inline CSS
- **`markdownToHtml()`** — Regex-based converter handling: headings, paragraphs, bold, italic, code, links, lists (ordered + unordered), tables, blockquotes, callout blocks, horizontal rules, wikilinks
- **`wrapHtml()`** — Generates self-contained HTML document with inline CSS, metadata block, and footer
- **`exportReportToHtml()`** — Reads markdown report, parses frontmatter via `splitFrontmatter()`, converts to standalone HTML file
- **`reports:html`** command — Exports all stable `.md` reports to HTML in one batch
- **HTML escaping** — Prevents XSS via `escapeHtml()` applied to all user content
- **Callout support** — Renders `> [!warning]`, `> [!info]`, etc. as styled callout divs with color-coded borders
- **Tests**: +21 tests in `html-export.test.ts` (16 markdownToHtml + 5 wrapHtml)

### 7.8: Self-update — COMPLETE

- **`build-freshness.ts`** — Hash-based build freshness detection using SHA-256 content hashing
- **`BuildManifest`** type — Stores `builtAt`, `sourceHash` (aggregate), `fileCount`, and per-file `files` hash map
- **`collectSourceHashes()`** — Recursively walks `src/` collecting `.ts` file content hashes (skips `node_modules`)
- **`aggregateHash()`** — Deterministic aggregate hash from sorted file hashes (order-independent)
- **`checkFreshness()`** — Compares current source hashes against stored manifest, reports `FreshnessCheck` with detailed diff (added/modified/removed files)
- **`recordBuild()`** — Snapshots current source state into `.build-manifest.json` after successful build
- **`build:check`** command — Reports whether rebuild is needed, shows changed file details, supports `--format=json`
- **`build:auto`** command — Checks freshness and only rebuilds if source has changed; records manifest on success
- **`build:record`** command — Manually records current source state as a build manifest
- **Tests**: +23 tests in `build-freshness.test.ts` (2 hash, 4 collect, 4 aggregate, 1 manifestPath, 3 load, 1 save, 1 create, 6 freshness, 1 record)

### 7.9: Plugin Lifecycle Hooks — COMPLETE

- **`plugin-hooks.ts`** — Plugin lifecycle hook validation, extraction, and execution
- **5 hook types**: `onInstall`, `onEnable`, `onDisable`, `onBeforeCommand`, `onAfterCommand`
- **`PluginHooks`** type — Optional shell commands for each lifecycle event
- **`validateHooks()`** — Validates hook names and values; integrated into `validateManifest()`
- **`extractHooks()`** — Safely extracts hooks from raw manifest JSON
- **`runHook()`** — Executes a lifecycle hook with optional environment variables
- **`runHookSilent()`** — Silent hook execution for background hooks
- **`wrapWithHooks()`** — Wraps a command with onBeforeCommand/onAfterCommand execution
- **Abort on before-hook failure** — If `onBeforeCommand` fails, the command is skipped
- **After-hook gets exit code** — `FLOWTI_COMMAND_EXIT_CODE` env var passed to `onAfterCommand`
- **Loader integration** — Hooks are extracted during `loadPluginFile()` and wrapped into command handlers
- **Manifest extension** — `PluginManifest.hooks` is optional; existing plugins unaffected
- **Tests**: +27 tests in `plugin-hooks.test.ts` (9 validate, 4 extract, 4 runHook, 3 runHookSilent, 7 wrapWithHooks)

### 7.10: Cross-vault Sharing — COMPLETE

- **`remote-registry.ts`** — Remote registry client for fetching and installing shared definitions
- **`RegistryIndex`** format — Version 1 JSON with `entries[]` array of `RegistryEntry` items
- **`RegistryEntry`** type — `{ id, type, name, description, version, url }` with type = scaffold | plugin | ai-tool
- **`fetchRegistryIndex()`** — Fetches and parses registry index from HTTP(S) URL
- **`fetchRegistryEntry()`** — Fetches individual definition/plugin/tool JSON from entry URL
- **`searchEntries()`** — Search by name, description, or ID (case insensitive) with optional type filter
- **`installScaffoldDefinition()`** — Writes definition to `configs/definitions/` (skips existing)
- **`installPlugin()`** — Writes manifest to `.flowti/plugins/<name>/` (skips existing)
- **`installAiTool()`** — Writes tool to `.flowti/ai-tools/` (skips existing)
- **`installFromRegistry()`** — Batch install with fetch + type routing + skip/error tracking
- **Local cache** — `loadCachedIndex()` / `saveCachedIndex()` in `.flowti/cache/registry/`
- **`HttpFetcher`** type — Injectable HTTP client (default uses Node.js built-in `https`/`http`)
- **`parseRegistryConfigs()`** / **`validateRegistryUrl()`** — Config helpers for registry URL management
- **Tests**: +38 tests in `remote-registry.test.ts` (5 fetchIndex, 3 fetchEntry, 5 search, 1 filter, 3 cache, 4 installScaffold, 3 installPlugin, 3 installAiTool, 4 installFromRegistry, 3 parseConfig, 4 validateUrl)

**Deferred** (revisit after Phase 8): MCP server mode (IMP-38), AGENTS.md generation (IMP-39), CI/CD generation (IMP-11).

**Exit criteria**: Reports are cacheable and parallelizable. Plugin ecosystem supports lifecycle management. Shell completions available. Remote registries supported.

---

## Phase 8: Plugin Integration

**Goal**: Make the Flowti Plugin a fully managed project within the Flowti CLI ecosystem. Unify build, test, report, and E2E pipelines so both CLI and Plugin share the same toolchain.

**Context**: The Flowti Plugin (480 source files, 7,697 tests, 406 events, 20 domain services) is currently a self-contained project at `Development/flowti/`. It has its own `flowti.config.json` with a **different schema** than the CLI's `ProjectConfig` type. Phase 8 bridges this gap.

See [[Plugin Integration Analysis]] for detailed gap analysis and migration plan.

### 8.0: Config Schema & Project Type System

**Problem**: The CLI's `ProjectConfig` lacks a `type` field and the fields needed for multi-mode builds, script-based reports, and non-standard project layouts. The Plugin's `flowti.config.json` uses an incompatible schema.

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 8.0.1 | Add `ProjectTarget` type: `"project"`, `"typescript"`, `"typescript-cli"`, `"obsidian-plugin"` | Critical | S |
| 8.0.2 | Extend `ProjectConfig` with fields for multi-mode projects (`build.commands`, `test.commands`, `devtools.commands`, `reports.scripts[]`, `paths`) | Critical | M |
| 8.0.3 | Create 3 new scaffold definitions: `flowti-bare` (empty project), `flowti-cli` (TypeScript CLI), `flowti-obsidian-plugin` (Obsidian plugin) | High | L |
| 8.0.4 | Implement project import flow: detect new folders in projects dir, ask type, generate `flowti.config.json` | High | M |
| 8.0.5 | Rewrite Plugin's `flowti.config.json` to conform to `ProjectConfig` | High | M |
| 8.0.6 | Validate config in `project-config.ts` with clear error messages | High | S |

**Key principle**: The CLI's `ProjectConfig` type is the single source of truth. Projects must conform to it — there is no dual-format support or backward-compatible parsing. The Plugin rewrites its config to match.

**4 Project Types**:

| Type | Scaffold ID | What it creates |
|------|-------------|-----------------|
| **Project** | `flowti-bare` | Bare markdown project — `README.md`, `docs/`, `flowti.config.json`. No code. |
| **TypeScript Project** | `flowti-project` | Existing definition. TS strict + Vitest + esbuild + ESLint. |
| **TypeScript CLI** | `flowti-cli` | Like TS project + `#!/usr/bin/env node` banner, arg parser, `bin` field in package.json. |
| **Obsidian Plugin** | `flowti-obsidian-plugin` | Obsidian plugin skeleton: `manifest.json`, `styles.css`, esbuild with Obsidian externals, `main.ts` extending `Plugin`. |

**Two onboarding scenarios**:

1. **Create new**: User picks a project type from the menu → scaffold creates folder + all files.
2. **Import existing**: User copies folder into projects dir → CLI detects new folder(s), asks for confirmation → user picks project type → CLI generates `configs/flowti.config.json` and any missing management files.

**Key decisions**:
- `build.commands` map replaces `tools.build` single string (multi-mode builds)
- `reports.scripts[]` with `{ id, label, script }` alongside `reports.generators[]` (script-based generators become external commands)
- `paths` section added for non-standard project layouts
- Scaffold definitions are JSON-driven, bundled into the binary via esbuild `with { type: "json" }` imports

### 8.1: Build Pipeline Integration

**Problem**: Plugin uses esbuild + CSS concatenation + distribution endpoints. CLI's `build` command just runs a shell script. The CLI needs to understand multi-step build pipelines.

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 8.1.1 | Extend `build.ts` to support named build modes: `fast`, `increment`, `full`, `watch`, `distribute` | High | M |
| 8.1.2 | Support `build.commands` map in config (not just `tools.build` single string) | High | S |
| 8.1.3 | Add CSS build awareness: `build.css` config section for concatenation pipeline | Medium | M |
| 8.1.4 | Support `build-endpoints.json` for multi-target distribution | Medium | M |

### 8.2: Test Pipeline Integration

**Problem**: Plugin has 5 test presets (`unit`, `flows`, `e2e`, `increment`, `coverage`) vs CLI's single `npm test`. E2E tests require a running Obsidian instance.

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 8.2.1 | Support `test.commands` map with multiple named presets | High | S |
| 8.2.2 | Add `test:flows` command for flow integration tests | Medium | S |
| 8.2.3 | Wire E2E presets through `review` config (Plugin has 9 E2E journey presets) | Medium | M |
| 8.2.4 | Support `test.coverage` config for coverage-specific options | Low | S |

### 8.3: Report Pipeline Unification

**Problem**: Plugin has 14 script-based report generators vs CLI's 8 internal generators. Plugin generators run as `node scripts/generate-*.mjs` — they're external commands, not internal functions.

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 8.3.1 | Support `reports.scripts[]` format alongside `reports.generators[]` in the pipeline | High | M |
| 8.3.2 | Create `toScriptStep()` adapter in `report-pipeline.ts` — wraps script entries as pipeline steps | High | S |
| 8.3.3 | Support `reports.categories[]` for archive organization | Medium | S |
| 8.3.4 | Support `reports.stableReports[]` for non-timestamped reports | Medium | S |

### 8.4: Documentation Pipeline

**Problem**: Plugin generates 4 reference documents (Command Reference, Event Catalog, Data Dictionary, Tool Reference) via scripts. CLI generates 2 via internal functions.

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 8.4.1 | `doc-pipeline.ts` already supports external generators — verify Plugin scripts work through it | High | S |
| 8.4.2 | Add `docs.scripts[]` format (like `reports.scripts[]`) for script-based doc generators | Medium | S |
| 8.4.3 | Support per-project reference directory (`docs.referenceDir`) — Plugin uses `docs/reference/` | Low | S |

### 8.5: E2E Infrastructure Migration

**Problem**: The Plugin currently owns ~8,000 LOC of E2E testing infrastructure (ObsidianCli wrapper, journey executor, 45+ action tools, fixtures, testVault, helpers). This infrastructure belongs in the CLI — the Plugin should only be concerned with what happens inside the vault. Projects declare their testing needs via journey definition files (JSON blueprints); the CLI fulfills them.

**The journey-as-blueprint model**: A journey definition is a contract. The project says *"test me like this, I need these tools"* via `requires.tools`. The CLI resolves the requirements from its environment provider registry and runs the journey.

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 8.5.1 | Migrate `ObsidianCli` wrapper (440 LOC) + types to CLI's `src/infrastructure/cli/` | Critical | M |
| 8.5.2 | Migrate journey executor (656 LOC), action runner (1,362 LOC), journey runner (524 LOC), journey types (640 LOC) to CLI's `src/domain/e2e/` | Critical | L |
| 8.5.3 | Migrate E2E helpers to CLI: fixtures (412), testVault (134), highlight (341), navigation (180), errorContext (158), toolCatalog (1,086), seedRegistry (175), sequencer (60), parallelGroup (478), qc (94) | High | L |
| 8.5.4 | Migrate globalSetup (244) + globalTeardown (~200) to CLI's E2E infrastructure | High | M |
| 8.5.5 | Add `requires.tools` resolution to journey executor — validate tool availability against provider | High | M |
| 8.5.6 | Enhance `obsidian-plugin` environment provider with ObsidianCli-backed tool implementations | High | L |
| 8.5.7 | Support `review.testVault` and `review.pluginId` config for plugin E2E | Medium | S |
| 8.5.8 | Wire Plugin's 9 journey definitions through CLI's `review` domain | Medium | M |

### 8.8: Plugin Cleanup

**Problem**: After the E2E infrastructure migrates to the CLI, the Plugin needs cleanup. Remove migrated code, update test commands to delegate to CLI, ensure flow tests still work independently.

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 8.8.1 | Remove migrated E2E infrastructure from Plugin (`tests/e2e/helpers/`, `src/infrastructure/cli/`) | High | M |
| 8.8.2 | Update Plugin's `test:e2e` script to invoke CLI's E2E runner | High | S |
| 8.8.3 | Verify Plugin's flow tests (45 files, `tests/flows/`) still run independently | Medium | S |
| 8.8.4 | Remove Plugin's `scripts/_redirect.mjs` — CLI runs generators directly | Medium | S |

### 8.6: Plugin-Specific Commands

**Problem**: Plugin has domain-specific devtools (`reload`, `console`, `errors`, `fixFrontmatter`, `testdata`) that the CLI can surface through its devtools domain.

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 8.6.1 | Support `devtools.commands` map in config — each entry becomes a CLI command | High | M |
| 8.6.2 | Add Obsidian-specific devtools: `dev:reload`, `dev:console`, `dev:errors` | Medium | S |
| 8.6.3 | Support `make.hub` template config for Plugin's Hub scaffolding (9 files per Hub) | Low | L |

### 8.7: Project Onboarding & Import

**Problem**: Users need a frictionless path from "I have a folder" to "it's a managed Flowti project". Both fresh creation and importing existing codebases must be easy.

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 8.7.1 | Project type detection heuristics: `manifest.json` → obsidian-plugin, `bin` in package.json → typescript-cli, `package.json` → typescript, else → project | High | S |
| 8.7.2 | Import flow in `project.ts`: snapshot project list → prompt user to copy folder → diff to detect new folders → confirm → ask type → generate config | High | M |
| 8.7.3 | Prerequisite checks per project type: Node.js for TS projects, Obsidian CLI for plugin projects | Medium | S |
| 8.7.4 | Multi-folder import: when multiple new folders detected, let user pick one or import all | Medium | S |

### Phase 8 Execution Order

```
8.0 Config & Types  ──► 8.1 Build Pipeline ──► 8.2 Test Pipeline
        │                                              │
        ▼                                              ▼
8.3 Report Pipeline ──► 8.4 Doc Pipeline   ──► 8.5 E2E Migration
        │                                              │
        ▼                                              ▼
8.6 Plugin Commands ──► 8.7 Onboarding     ──► 8.8 Plugin Cleanup
```

**Exit criteria**:
- `flowti` CLI can load the Plugin project, run its builds, execute its test suites, generate all 14 reports
- CLI owns all E2E infrastructure; Plugin only declares journey blueprints
- Projects declare `requires.tools` in journey definitions; CLI resolves and provides them
- Plugin is only concerned with Obsidian runtime (domain services, events, UI)

---

## Phase 9: Convergence (Future)

**Goal**: Shared infrastructure between CLI and Plugin. Features that benefit both.

| # | Work Item | Priority | Effort | Notes |
|---|-----------|----------|--------|-------|
| 9.1 | Shared event contract format between CLI event catalog and Plugin FlowtiEventMap | Medium | L | Enables cross-project event validation |
| 9.2 | MCP server mode (IMP-38) — expose CLI as a Model Context Protocol server | Medium | XL | Deferred from Phase 7 |
| 9.3 | AGENTS.md generation (IMP-39) — generate AI agent instruction files | Low | M | Deferred from Phase 7 |
| 9.4 | CI/CD pipeline generation (IMP-11) — generate GitHub Actions / Azure Pipelines | Low | L | Deferred from Phase 7 |
| 9.5 | Shared component system — unify CLI's C4/UI components with Plugin's ComponentRegistry | Low | XL | Both have component registries |
| 9.6 | Cross-project health dashboard — aggregate health from all managed projects | Low | L | Requires 8.0 complete |

---

## Suggested Execution Order (Updated)

```
✓ Priority 0 (tests)         COMPLETE — +72 tests
✓ Priority 1 (refactoring)   COMPLETE — registry exists, help tested
✓ Phase 5 (agent DX)         COMPLETE — 6/7 items (progress indicators deferred)
✓ Phase 6 (depth)            COMPLETE — 8/8 items
✓ Phase 7 (ecosystem)        COMPLETE — 10/10 items
► Phase 8 (plugin integration) NEXT — 9 sub-phases, ~42 work items
  Phase 9 (convergence)       FUTURE — shared infra, MCP, CI/CD gen
```

---

## Key Metrics to Track

| Metric | Phase 7 (actual) | Phase 8 Target | Phase 9 Target |
|--------|-------------------|----------------|----------------|
| Tests | 2,565 | 2,800+ | 3,000+ |
| Test suites | 140 | 155+ | 165+ |
| Managed project types | 1 (typescript) | 4 (project, typescript, typescript-cli, obsidian-plugin) | 4 |
| Report pipeline steps | 8 internal + ext | 8 internal + 14 script-based | 22+ |
| Doc pipeline steps | 2 internal + ext | 2 internal + 4 script-based | 6+ |
| Config schema version | v1 | v2 (single schema) | v2 |
| E2E journey providers | 5 | 5 (enhanced) | 5 |

---

## Appendix: Feature Maturity Progression

| Feature | Phase 5 | Phase 6 | Phase 7 | Phase 8 Target |
|---------|---------|---------|---------|----------------|
| Agent-Native (FR-21) | **Deep** | Deep | Deep | Deep |
| Quality Gates (FR-22) | **Functional** | Deep | Deep | Deep |
| AI Tools (FR-14) | Shallow | **Functional** | Functional | Functional |
| Capture (FR-02.11) | Shallow | **Functional** | Functional | Functional |
| Event Contracts (FR-18) | Shallow | **Functional** | Functional | **Deep** (cross-project) |
| Health Dashboard (FR-15) | Functional | **Deep** | Deep | **Deep** (multi-project) |
| Marketplace (FR-17) | Shallow | **Functional** | **Deep** | Deep |
| Project Onboarding | Shallow | Shallow | Shallow | **Deep** (4 types, import flow) |
| Plugin Integration | — | — | — | **Deep** |
| Build Pipeline | Functional | Functional | Functional | **Deep** (multi-mode) |
| Report Pipeline | Functional | Functional | **Deep** | **Deep** (script + internal) |
| Doc Pipeline | Shallow | Shallow | Shallow | **Functional** |
| E2E Testing | Functional | Functional | **Deep** | **Deep** (Obsidian CLI) |
