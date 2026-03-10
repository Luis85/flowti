---
type: Plan
domain: CLI
title: Flowti CLI — Improvement Plan
version: 1
created: 2026-03-10
updated: 2026-03-10
status: active
source: "[[Development Roadmap]]"
tech_debt: "[[Tech Debt]]"
---

# Flowti CLI — Improvement Plan

> Prioritized improvements synthesized from comprehensive codebase audit (2026-03-10). Grouped into actionable sprints. Addresses gaps discovered after Phase 7.6 (domain purification) completion.

---

## Audit Summary

| Area | Finding | Severity |
|------|---------|----------|
| **Layer compliance** | EXCELLENT — zero domain→infrastructure violations | ✓ Resolved |
| **Type safety** | GOOD — no `any` casts, no `@ts-ignore` | ✓ Clean |
| **Error handling** | 73 bare catch blocks — all intentional (resilient runner pattern) | ✓ Acceptable |
| **Controller tests** | GAP — 15 controllers, 0 dedicated test files | High |
| **Mock standardization** | INCONSISTENT — `createMockShell()` exists but many tests mock inline | Medium |
| **Naming convention** | INCONSISTENT — mix of kebab-case and PascalCase file names | Low |
| **Test-to-source ratio** | 0.54 (152 test files / 281 source files) | Acceptable |
| **EventBus** | CREATED — not wired (deferred to Phase 8) | ✓ By design |
| **Reports domain size** | 42 files — largest domain, 3x next-largest | Medium |

---

## Sprint 1: Test Coverage for API Surface (Priority: HIGH)

**Goal**: Ensure the CLI's API surface (controllers) has dedicated test coverage before Phase 8 adds more commands.

| # | Task | Files | Effort | TD |
|---|------|-------|--------|-----|
| 1.1 | Create `tests/controller/` directory structure | — | S | TD-25 |
| 1.2 | Test `reports.controller.ts` — most complex (6 actions, diff, HTML export) | 1 new test file | M | TD-25 |
| 1.3 | Test `health.controller.ts` — health, health:snapshot, health:history, debt:estimate | 1 new test file | M | TD-25 |
| 1.4 | Test `build.controller.ts` — build, build:check, build:auto, build:record | 1 new test file | S | TD-25 |
| 1.5 | Test `events.controller.ts` — 8 event commands including codegen | 1 new test file | M | TD-25 |
| 1.6 | Test remaining 11 controllers (simpler, 1-3 actions each) | 11 new test files | L | TD-25 |

**Test pattern**:
```typescript
const req: CliRequest = { command: "health", flags: {}, rawArgs: [], project: mockCtx, format: "text" };
const response = await actions.health(req);
expect(response.data.score.grade).toBe("B");
```

**Exit criteria**: Every controller has a test file asserting correct model shape, JSON output, and error cases.

---

## Sprint 2: Mock Factory Standardization (Priority: MEDIUM)

**Goal**: Reduce test boilerplate by consolidating all domain mocking to shared factories.

| # | Task | Files | Effort | TD |
|---|------|-------|--------|-----|
| 2.1 | Audit all `vi.mock("shell")` calls — count unique mock patterns | — | S | TD-10 |
| 2.2 | Extend `createMockShell()` to cover all patterns found | `tests/mocks/mock-shell.ts` | S | TD-10 |
| 2.3 | Create `createMockDisk()` factory (many tests mock `disk` inline) | `tests/mocks/mock-disk.ts` | S | — |
| 2.4 | Migrate test files to use shared factories (batch by domain) | ~30 test files | M | TD-10 |

**Exit criteria**: `vi.mock("../infrastructure/shell.js")` only appears in `mock-shell.ts`, not in individual test files.

---

## Sprint 3: Reports Domain Reorganization (Priority: MEDIUM)

**Goal**: Split the 42-file reports domain into focused sub-domains for maintainability before Phase 8 adds 14 more generators.

| # | Task | Files Moved | Effort | TD |
|---|------|-------------|--------|-----|
| 3.1 | Create `reports/analysis/` — complexity-analyzer, summary-{loaders,analyzers,analyzers-ext,renderers,formatters,types,promotion,details} | 8 files | S | TD-03 |
| 3.2 | Create `reports/export/` — html-export, report-archive, report-diff | 3 files | S | TD-03 |
| 3.3 | Create `reports/pipeline/` — report-pipeline, doc-pipeline, report-runner, doc-runner | 4 files | S | TD-03 |
| 3.4 | Update all import paths in source and test files | ~25 files | M | TD-03 |
| 3.5 | Verify all tests pass after reorganization | — | S | — |

**Target structure**:
```
domain/reports/
├── cli/                   # 6 report generators + report-service
├── generators/            # 2 reference generators (existing)
├── analysis/              # Complexity + summary analysis (8 files)
├── export/                # HTML, archive, diff (3 files)
├── pipeline/              # Report + doc pipeline bridges (4 files)
├── generator-registry.ts  # Unified registry
└── report-events.ts       # Domain event map
```

---

## Sprint 4: Clock Abstraction Consistency (Priority: LOW)

**Goal**: Ensure all timestamp-producing code uses the testable `clock` abstraction.

| # | Task | Files | Effort | TD |
|---|------|-------|--------|-----|
| 4.1 | Grep for `new Date()` and `Date.now()` in `src/domain/` | — | S | TD-28 |
| 4.2 | Replace with `clock.now()` — primarily in E2E domain files | ~5 files | S | TD-28 |
| 4.3 | Add tests for time-dependent logic using mock clock | ~3 test files | S | — |

---

## Sprint 5: File Naming Standardization (Priority: LOW)

**Goal**: Consistent kebab-case file naming across the codebase.

| # | Task | Files | Effort | TD |
|---|------|-------|--------|-----|
| 5.1 | Rename `E2EService.ts` → `e2e-service.ts` | 1 + imports | S | TD-27 |
| 5.2 | Rename `MakeService.ts` → `make-service.ts` | 1 + imports | S | TD-27 |
| 5.3 | Update all import paths referencing renamed files | ~10 files | S | TD-27 |

---

## Recommended Execution Order

```
Sprint 1 (controller tests)      HIGH    ~8h    ← Do before Phase 8
Sprint 2 (mock standardization)  MEDIUM  ~4h    ← Do alongside Sprint 1
Sprint 3 (reports reorganization) MEDIUM  ~4h    ← Do before Phase 8.3
Sprint 4 (clock consistency)     LOW     ~2h    ← Quick win, any time
Sprint 5 (file naming)           LOW     ~2h    ← Quick win, any time
                                         ────
                                Total:   ~20h
```

**Key insight**: Sprints 1-3 should be completed **before Phase 8** begins. Phase 8 adds 42 work items including 14 new report generators and multi-project commands — the controller test infrastructure and reports reorganization will pay dividends immediately.

---

## Deferred (Phase 8+ scope)

These items are documented in [[Tech Debt]] and [[Development Roadmap]] but not part of this improvement sprint:

| Item | Why Deferred |
|------|-------------|
| Wire EventBus into main.ts (TD-26) | Phase 8 — needed when Plugin integration requires cross-domain events |
| Async shell execution (TD-05) | Phase 8 — needed for multi-step build pipelines |
| Config validation schema (TD-06) | Phase 8 — needed when ProjectConfig v2 grows |
| Reports domain test coverage | Addressed partially by Sprint 1 (controller tests) |
| Progress indicators (TD-19) | Nice-to-have, not blocking |

---

## Metrics After Completion

| Metric | Current | After Sprints | Target (Phase 8) |
|--------|---------|---------------|-------------------|
| Tests | 2,592 | ~2,750 | 2,800+ |
| Test suites | 147 | ~165 | 170+ |
| Controller test files | 0 | 15 | 15+ |
| Reports domain file groups | 1 flat dir | 5 sub-dirs | 5 sub-dirs |
| Mock factory usage | ~40% | ~90% | 95%+ |
| `new Date()` in domain | ~5 files | 0 | 0 |
| Naming violations | 2 files | 0 | 0 |
