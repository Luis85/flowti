---
type: ArchitectureReview
domain: CLI
title: Flowti CLI — Architecture Review
version: 1
created: 2026-03-12
status: active
source: "[[Flowti CLI Architecture]]"
tech_debt: "[[Tech Debt]]"
---

# Flowti CLI — Architecture Review (2026-03-12)

> Post-cleanup audit of the Flowti CLI codebase. Identifies pattern deviations, DI violations, test gaps, code duplication, and prioritized improvement areas.

---

## 1. Current Scale

| Metric | Value |
|--------|-------|
| Source files | 343 |
| Test files | 245 (239 suites) |
| Tests passing | 3,899 |
| Controllers | 22 |
| Domain directories | 24 |
| Infrastructure modules | 33 |
| UI view files | 74 |
| Scaffold definitions | 4 |
| Component definitions | 8 |
| Runtime dependencies | 0 |
| Build | Clean (esbuild) |
| TypeDoc | Clean (0 errors) |
| ESLint | Clean (0 warnings) |

---

## 2. Architecture Compliance

### 2.1 Layer Violations

| Check | Status |
|-------|--------|
| Domain -> Controller/UI imports | None (CLEAN) |
| Infrastructure -> Domain imports | None (CLEAN) |
| Controller -> UI imports | All correct (expected pattern) |
| Circular dependencies | None detected |
| Naming conventions | Consistent kebab-case throughout |

**Verdict**: Layer architecture is well-enforced.

### 2.2 DI Violations — Domain Importing Infrastructure Directly

**Status: SIGNIFICANT — ~82 instances across domain files**

The domain layer imports infrastructure modules directly instead of receiving them via `CliDeps` injection. This is the single largest architectural deviation.

| Infrastructure Import | Domain Files Affected | Severity |
|----------------------|----------------------|----------|
| `Document` class | 19 files (stores, capture, events, reports, plugins, ai-tools) | High |
| `parseFrontmatter*` utilities | 16 files (all store domains) | High |
| `InternalError` | 2 files (scaffold-plan, component-plan) | Low |
| `pipeline-runner` | 4 files (e2e-build, e2e-runner, e2e-service, e2e-teardown) | Medium |
| `countFiles` | 2 files (info, health) | Low |
| `suggestions` | 1 file (component-commands) | Low |

**Why this matters**: Domain functions should be pure — testable without real I/O. Direct infrastructure imports create hidden coupling and make isolated testing harder.

**Recommended fix**: Create domain-level interfaces for Document building and frontmatter parsing, then inject via `CliDeps` subsets. Prioritize the 19-file `Document` dependency first.

### 2.3 External Path Reference

**File**: `src/domain/make/templates/app-stubs.ts:34-35`

This template file imports from `../../src/infrastructure/events/` — a path that references the Obsidian Plugin's infrastructure, not the CLI's. The generated code is correct (it's a template for app scaffolding), but the import path pattern is confusing and could break if the Plugin moves.

---

## 3. Code Quality

### 3.1 Type Safety

| Check | Count | Verdict |
|-------|-------|---------|
| `@ts-ignore` / `@ts-expect-error` | 0 | Excellent |
| Non-null assertions (`!`) | ~20 | Acceptable (guarded by context) |
| Type assertions (`as`) | ~40 | Most are flag parsing in controllers — acceptable |
| `any` type usage | 0 in source | Excellent |

### 3.2 Error Handling

| Pattern | Count | Verdict |
|---------|-------|---------|
| Empty catch blocks | 4 (all in E2E domain — best-effort cleanup) | Acceptable |
| `catch { return null }` | ~5 (graceful degradation by design) | Document this pattern |
| TODO/FIXME/HACK comments | 0 | Excellent |

### 3.3 God Files (> 300 LOC)

| File | Lines | Recommendation |
|------|-------|----------------|
| `infrastructure/types.ts` | 562 | Type hub — acceptable |
| `domain/make/component/storybook-service.ts` | 453 | Split: generation vs validation |
| `domain/scaffold/templates/shared-templates.ts` | 405 | Template collection — acceptable |
| `ui/menus/component-list-menu.ts` | 403 | Split: rendering vs filtering |
| `ui/menus/component-detail-menu.ts` | 388 | Split: rendering vs editing |
| `infrastructure/pipeline/pipeline-runner.ts` | 373 | Core engine — acceptable |
| `domain/reports/generators/entity-registry.ts` | 359 | Split by entity type |
| `domain/e2e/journey/journey-tools.ts` | 358 | Split by tool category |

Only `storybook-service.ts` (453 lines) significantly exceeds the 350-line threshold.

---

## 4. Test Coverage Gaps

### 4.1 Controller Tests

**22 controllers, 2 test files** — This is the biggest test gap. Controllers are the API surface for AI agents and non-interactive commands. Priority: High.

Existing: `project.controller.test.ts`, `reports.controller.test.ts`
Missing: ai-tools, build, capa, capture, deliverables, devtools, events, health, help, info, lifecycle, make, plugins, publish, raid, requirements, resources, review, scaffold, timelog (20 controllers).

### 4.2 Domain Test Gaps

Domains with zero or minimal test coverage:

| Domain | Source Files | Test Files | Priority |
|--------|-------------|------------|----------|
| ai-tools | 5 | 0 | Medium |
| build | 2 | 0 | Medium |
| capa | 2 | 1 (partial) | Low |
| capture | 1 | 1 (partial) | Low |
| deliverables | 2 | 1 (partial) | Low |
| devtools | 7 | 0 | Medium |
| health | 1 | 0 | High (quality gate logic) |
| info | 1 | 0 | Low |

### 4.3 Skipped E2E Tests

5 journey suites are `describe.skip()`:
- `20-journey-loading-a-project-for-review-and-publishing.test.ts`
- `30-journey-creating-a-new-project-and-start-to-work.test.ts`
- `40-journey-creating-a-new-application-and-publishing-it.test.ts`
- `50-journey-building-and-using-the-flowti-ibde.test.ts`

These should either be enabled or documented as deferred to Phase 8.

### 4.4 UI Test Gap

74 UI files, ~25 test files. Many display renderers and menus lack tests. This is lower priority since UI is presentation-only, but would improve confidence in the agent-native JSON output path.

---

## 5. Code Duplication

### 5.1 Store Pattern (Critical)

7 store implementations follow the identical pattern:

```
list files → filter .md → parseFrontmatterStrings → map to typed summary
create/update → Document.create() → mergeFrontmatter → save
```

**Affected**: capa-store, deliverable-store, lifecycle-store, raid-store, requirement-store, resource-store, timelog-store

**Recommendation**: Extract a `MarkdownStore<T>` base class or factory that handles:
- Directory listing + `.md` filtering
- Frontmatter parsing to typed objects
- Document creation + save
- Sort + filter helpers

Estimated reduction: ~40% of code in each store file.

### 5.2 Hardcoded `.md` Extension

The string `.md` appears 50+ times across domain files. Extract to a shared constant.

---

## 6. Configuration Issues

### 6.1 Coverage Threshold Mismatch

| Config | Value | Location |
|--------|-------|----------|
| Vitest coverage threshold | 40% | `configs/vitest.config.ts:42-45` |
| flowti.config.json health target | 85% | `configs/flowti.config.json:124` |
| flowti.config.json health minimum | 70% | `configs/flowti.config.json:124` |

The vitest threshold should be raised to match the health minimum (70%) or at least be aligned.

### 6.2 ESLint Permissive Rules

| Rule | Setting | Risk |
|------|---------|------|
| `@typescript-eslint/ban-ts-comment` | off | Allows `@ts-ignore` silently |
| `@typescript-eslint/no-empty-function` | off | Allows empty catch blocks |

These are currently harmless (0 violations found) but remove the safety net.

---

## 7. Prioritized Improvement Backlog

### P0 — Architecture (Fix DI violations)

| ID | Task | Effort | Impact |
|----|------|--------|--------|
| AR-01 | Create `IDocumentBuilder` interface; inject into domain stores | 8h | Fixes 19 DI violations |
| AR-02 | Create `IFrontmatterParser` interface; inject into domain stores | 4h | Fixes 16 DI violations |
| AR-03 | Extract `MarkdownStore<T>` factory from 7 duplicate stores | 6h | Removes ~700 LOC of duplication |

### P1 — Test Coverage (High impact)

| ID | Task | Effort | Impact |
|----|------|--------|--------|
| AR-04 | Create controller test files (20 remaining) | 10h | Covers AI agent API surface |
| AR-05 | Add health domain tests | 2h | Quality gate logic is critical |
| AR-06 | Add ai-tools domain tests | 2h | Untested domain |
| AR-07 | Add devtools domain tests | 3h | 7 untested files |

### P2 — Code Quality

| ID | Task | Effort | Impact |
|----|------|--------|--------|
| AR-08 | Split `storybook-service.ts` (453 LOC) | 2h | Under 350 threshold |
| AR-09 | Align vitest coverage threshold to 70% | 0.5h | Config consistency |
| AR-10 | Replace `new Date()` with clock in E2E files | 1h | Test determinism (TD-28) |
| AR-11 | Resolve or document 5 skipped E2E suites | 1h | Test hygiene |

### P3 — Tech Debt Alignment

| ID | Task | Effort | Impact |
|----|------|--------|--------|
| AR-12 | Wire EventBus into main.ts (TD-26) | 2h | Phase 8 enabler |
| AR-13 | Move legacy dependencies from report-pipeline to config (TD-04) | 2h | Config purity |
| AR-14 | Extract journey infrastructure to `infrastructure/journey/` (TD-07) | 4h | Phase 8 enabler |

### Deferred (Phase 8+)

| ID | Task | Phase |
|----|------|-------|
| AR-15 | E2E infrastructure migration from Plugin (TD-23) | 8.5 |
| AR-16 | Import existing project flow (FR-01.10) | 8.7 |
| AR-17 | Progress indicators (TD-19) | 9 |
| AR-18 | MCP server mode (IMP-38) | 9 |

---

## 8. Summary

**Strengths**:
- Layer architecture is strictly enforced — zero violations at the domain/controller/UI boundary
- Zero TODO/FIXME comments, zero `@ts-ignore`, zero `any` types
- Naming conventions are consistent throughout
- 3,899 tests passing, build/typedoc/eslint all clean
- Zero runtime dependencies

**Top 3 Areas for Improvement**:
1. **DI violations** (82 instances) — Domain files directly import `Document`, `parseFrontmatter*`, and other infrastructure modules
2. **Controller test gap** — 20 of 22 controllers lack dedicated tests
3. **Store duplication** — 7 stores repeat identical CRUD-over-markdown patterns

**Estimated Total Effort**: ~47h for P0–P2 items.
