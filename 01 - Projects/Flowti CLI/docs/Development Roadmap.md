---
type: Roadmap
domain: CLI
title: Flowti CLI — Development Roadmap
version: 1
created: 2026-03-09
updated: 2026-03-09
status: active
source: "[[Flowti CLI PRD]]"
architecture: "[[Flowti CLI Architecture]]"
---

# Flowti CLI — Development Roadmap

> Synthesized from PRD v10, Architecture v18, and codebase analysis (1,780 tests, 171 source files, 23,263 LOC). Prioritizes **test hardening → refactoring → features** to maintain quality as the codebase grows.

---

## Current State (2026-03-09)

| Metric | Value |
|--------|-------|
| Source files | 171 |
| Test files | 118 |
| Tests passing | 2,261 (126 suites) |
| Source LOC | ~23,263 |
| Test LOC | ~21,286 |
| Domains | 18 |
| Infrastructure modules | 21 |
| Non-interactive commands | 84 |
| Dependencies | 0 (runtime) |
| Feature Requests (PRD) | 22 (FR-01 – FR-22) |
| Improvements (PRD) | 45 (IMP-01 – IMP-45) |
| Completed FRs | 20/22 (FR-21, FR-22 pending) |
| Completed IMPs | 20/45 (44%) |

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

**Deferred** (revisit after Phase 7): MCP server mode (IMP-38), AGENTS.md generation (IMP-39), CI/CD generation (IMP-11).

**Exit criteria**: Reports are cacheable and parallelizable. Plugin ecosystem supports lifecycle management. Shell completions available. Remote registries supported.

---

## Suggested Execution Order

```
Priority 0 ──► Priority 1 ──► Phase 5 ──► Phase 6 ──► Phase 7
(tests) ✓      (refactoring)✓  (agent DX)   (depth)     (ecosystem)

✓ Done:    T-01..T-08 (+72 tests, +8 files, +8 suites)
✓ Done:    R-01 skipped, R-02 deferred, R-03 already exists, R-04 deferred
✓ Done:    5.1 --json (9 commands, +10 tests)
✓ Done:    5.2 quality gates (+35 tests)
✓ Done:    5.3 scaffold --dry-run (+6 tests)
✓ Done:    5.4 global flags --quiet/--verbose/--no-color (+11 tests)
✓ Done:    5.6 post-command suggestions (+7 tests)
✓ Done:    5.7 report diff mode (+12 tests)
Deferred:  5.5 progress indicators (low impact — existing labels sufficient)
Sprint 1:  Phase 5 COMPLETE (6 of 7 items done)
Sprint 2:  6.1 (capture) + 6.2 (contracts)    (~5 days)
Sprint 3:  6.3 (trends) + 6.4 (ai-tool exec)  (~5 days)
Sprint 4+: Phase 7 items by priority            (ongoing)
```

---

## Key Metrics to Track

| Metric | Current | Phase 5 Target | Phase 6 Target |
|--------|---------|----------------|----------------|
| Tests | 1,914 | 2,100+ | 2,300+ |
| Test suites | 111 | 130+ | 145+ |
| Commands with `--json` | 9 | 9 | 9 |
| Quality gate rules | 2 (default) | 5+ | 5+ |
| Files > 300 LOC | 8 | 6 | 4 |
| Shallow features | 5 | 5 | 2 |
| Deep features | 12 | 12 | 14 |

---

## Appendix: Feature Maturity Progression

| Feature | Current | After P0+P1 | After Phase 5 | After Phase 6 |
|---------|---------|-------------|---------------|---------------|
| Agent-Native (FR-21) | Shallow | Shallow | **Deep** | Deep |
| Quality Gates (FR-22) | Not Started | Not Started | **Functional** | Deep |
| AI Tools (FR-14) | Shallow | Shallow | Shallow | **Functional** |
| Capture (FR-02.11) | Shallow | Shallow | Shallow | **Functional** |
| Event Contracts (FR-18) | Shallow | Shallow | Shallow | **Functional** |
| Health Dashboard (FR-15) | Functional | Functional | Functional | **Deep** |
| Marketplace (FR-17) | Shallow | Shallow | Shallow | **Functional** |
