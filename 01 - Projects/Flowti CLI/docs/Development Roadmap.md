---
type: Roadmap
domain: CLI
title: Flowti CLI — Development Roadmap
version: 5
created: 2026-03-09
updated: 2026-03-13
status: active
source: "[[Flowti CLI PRD]]"
architecture: "[[Flowti CLI Architecture]]"
tech_debt: "[[Tech Debt]]"
plugin_integration: "[[Plugin Integration Analysis]]"
---

# Flowti CLI — Development Roadmap

> Phases 5–7.6 are **complete**. Next target: **Phase 8 (Plugin Integration)** — migrate the Flowti Plugin to be a managed Flowti CLI project, unifying build, test, report, and E2E pipelines across both apps.

---

## Current State (2026-03-13)

| Metric | Value |
|--------|-------|
| Source files | 352 |
| Test files | 274 (267 suites) |
| Tests passing | 4,505 |
| Domain modules | 25 |
| Controllers | 22 |
| UI view files | 74 |
| Infrastructure modules | 33 |
| Non-interactive commands | 84 |
| Runtime dependencies | 0 |
| Scaffold definitions | 4 (project, bare/library, cli, obsidian-plugin) |
| Component definitions | 8 (4 C4 + 4 UI building blocks) |
| Report generators | 8 (6 report + 2 reference) |
| E2E environment providers | 5 |
| Coverage | 80.53% statements, 81.67% lines |
| Tech debt | 30 items (22 resolved), 114h total (77h resolved) |
| Build | Clean (0 errors) |
| TypeDoc | Clean (0 errors) |
| ESLint | Clean (0 warnings) |

---

## Completed Phases

| Phase | Goal | Key Results |
|-------|------|-------------|
| **Priority 0** | Test hardening | +72 tests, 8 new test files across 8 domains |
| **Priority 1** | Refactoring | Registry consolidation, help testing, large file deferral |
| **Phase 5** | Agent-Native & DX | `--format=json`, quality gates, `--dry-run`, global output flags, report diff, suggestions (6/7 done; progress indicators deferred) |
| **Phase 6** | Depth | Capture enrichment, event contracts + codegen, health trends + security + tech debt, AI tool execution, marketplace export (8/8 done) |
| **Phase 7** | Ecosystem | Shell completions, change-based review, report caching, parallel reports, dependency browser, template versioning, HTML export, self-update, plugin hooks, cross-vault sharing (10/10 done) |
| **Phase 7.5** | MVC refactoring | 22 controllers, typed request-response, display renderers, `handleResponse()` edge dispatch |
| **Phase 7.6** | Domain purification | Zero domain→infrastructure violations, injectable log pattern, EventBus infrastructure, scripts layer |

See `docs/archive/` for detailed phase completion notes.

---

## Remaining Tech Debt (8 open items)

| ID | Severity | Description | Phase 8? |
|----|----------|-------------|----------|
| TD-23 | Critical | E2E infrastructure lives in Plugin, not CLI (~8,000 LOC) | 8.5 blocker |
| TD-22 | High (partial) | Import flow for existing folders still pending | 8.7 |
| TD-07 | High | E2E domain size — 35 files, mixes generic + CLI-specific | 8.5 enabler |
| TD-08 | Low | Wildcard command pattern limited to `report:*` | Monitor |
| TD-11 | Medium | Help content hardcoded in source | 8.6 |
| TD-14 | Low | Document builder `this` return type | Minor |
| TD-17 | Low | Generator output discriminated unions | Deferred |
| TD-18 | Low | 8 files over 300 LOC (max 358) | Deferred |
| TD-19 | Low | Progress indicators for long operations | Deferred |
| TD-20 | Low | Async pipeline support for parallel steps | Deferred |
| TD-21 | Low | CSS build not abstracted (Plugin-specific) | 8.1 |
| TD-26 | Medium | EventBus created but not wired | Phase 8 |

---

## Phase 8: Plugin Integration

**Goal**: Make the Flowti Plugin a fully managed project within the Flowti CLI ecosystem. Unify build, test, report, and E2E pipelines so both CLI and Plugin share the same toolchain.

**Context**: The Flowti Plugin (480 source files, 7,697 tests, 406 events, 20 domain services) is currently a self-contained project at `Development/flowti/`. Phase 8 bridges the gap.

See [[Plugin Integration Analysis]] for detailed gap analysis.

### 8.0: Config Schema & Project Type System — MOSTLY DONE

| # | Work Item | Status |
|---|-----------|--------|
| 8.0.1 | Add `ProjectTarget` type | Done (TD-16) |
| 8.0.2 | Extend `ProjectConfig` with multi-mode fields | Done (TD-01) |
| 8.0.3 | Create 3 new scaffold definitions | Done (TD-22) |
| 8.0.4 | Implement project import flow | Pending |
| 8.0.5 | Rewrite Plugin's `flowti.config.json` to conform | Pending |
| 8.0.6 | Validate config | Done (TD-06) |

### 8.1: Build Pipeline Integration

Extend CLI to understand multi-step build pipelines (esbuild + CSS + distribution).

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 8.1.1 | Support named build modes in `build.commands` | High | M |
| 8.1.2 | CSS build awareness for Plugin | Medium | M |
| 8.1.3 | Multi-target distribution via `build-endpoints.json` | Medium | M |

### 8.2: Test Pipeline Integration

Support Plugin's 5 test presets and Obsidian-dependent E2E.

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 8.2.1 | Support `test.commands` map with named presets | High | S |
| 8.2.2 | Wire E2E presets through `review` config | Medium | M |
| 8.2.3 | Support `test.coverage` config | Low | S |

### 8.3: Report Pipeline Unification

Unify CLI's 8 internal generators with Plugin's 14 script-based generators.

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 8.3.1 | Support `reports.scripts[]` alongside `reports.generators[]` | High | M |
| 8.3.2 | Create `toScriptStep()` adapter in report-pipeline | High | S |
| 8.3.3 | Support `reports.categories[]` for archive organization | Medium | S |

### 8.4: Documentation Pipeline

Verify Plugin's script-based doc generators work through CLI's doc pipeline.

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 8.4.1 | Verify Plugin scripts work through doc-pipeline | High | S |
| 8.4.2 | Add `docs.scripts[]` format | Medium | S |

### 8.5: E2E Infrastructure Migration

Migrate ~8,000 LOC of E2E infrastructure from Plugin to CLI. The Plugin keeps only a thin Obsidian assertion adapter.

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 8.5.1 | Migrate ObsidianCli wrapper + types | Critical | M |
| 8.5.2 | Migrate journey executor, action runner, journey runner, types | Critical | L |
| 8.5.3 | Migrate E2E helpers (fixtures, testVault, highlight, etc.) | High | L |
| 8.5.4 | Migrate globalSetup + globalTeardown | High | M |
| 8.5.5 | Add `requires.tools` resolution to journey executor | High | M |
| 8.5.6 | Enhance obsidian-plugin environment provider | High | L |
| 8.5.7 | Support `review.testVault` and `review.pluginId` config | Medium | S |
| 8.5.8 | Wire Plugin's 9 journey definitions through CLI's review | Medium | M |

### 8.6: Plugin-Specific Commands

Surface Plugin's devtools through CLI's devtools domain.

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 8.6.1 | Support `devtools.commands` map in config | High | M |
| 8.6.2 | Add Obsidian-specific devtools | Medium | S |
| 8.6.3 | Support `make.hub` template for Plugin's Hub scaffolding | Low | L |

### 8.7: Project Onboarding & Import

Frictionless path from "I have a folder" to "managed Flowti project".

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 8.7.1 | Project type detection heuristics | High | S |
| 8.7.2 | Import flow: detect new folders → confirm → ask type → generate config | High | M |
| 8.7.3 | Prerequisite checks per project type | Medium | S |

### 8.8: Plugin Cleanup

Remove migrated E2E code from Plugin, update test commands.

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 8.8.1 | Remove migrated E2E infrastructure from Plugin | High | M |
| 8.8.2 | Update Plugin's `test:e2e` to invoke CLI's E2E runner | High | S |
| 8.8.3 | Verify Plugin's flow tests still run independently | Medium | S |

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

**Exit criteria**: CLI can load the Plugin project, run its builds, execute all test suites, generate all 14 reports. CLI owns all E2E infrastructure; Plugin only declares journey blueprints.

---

## Phase 9: Convergence (Future)

| # | Work Item | Priority | Effort |
|---|-----------|----------|--------|
| 9.1 | Shared event contract format (CLI ↔ Plugin) | Medium | L |
| 9.2 | MCP server mode (IMP-38) | Medium | XL |
| 9.3 | AGENTS.md generation (IMP-39) | Low | M |
| 9.4 | CI/CD pipeline generation (IMP-11) | Low | L |
| 9.5 | Shared component system (CLI ↔ Plugin) | Low | XL |
| 9.6 | Cross-project health dashboard | Low | L |

---

## Key Metrics to Track

| Metric | Current (2026-03-13) | Phase 8 Target | Phase 9 Target |
|--------|---------------------|----------------|----------------|
| Tests | 4,505 | 4,700+ | 5,000+ |
| Test suites | 267 | 285+ | 300+ |
| Managed project types | 4 | 4 + import flow | 4+ marketplace |
| Report pipeline steps | 8 internal | 8 internal + 14 script | 22+ |
| Config schema | v1 (type, paths, validation) | v2 (single schema) | v2 |
| E2E journey providers | 5 | 5 (enhanced) | 5 |

---

## Archive

Detailed completion notes for Phases 5–7.6, architecture reviews, and improvement plans are preserved in `docs/archive/`.
