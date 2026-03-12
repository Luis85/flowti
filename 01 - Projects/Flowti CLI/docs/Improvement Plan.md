---
type: Plan
domain: CLI
title: Flowti CLI — Improvement Plan
version: 2
created: 2026-03-10
updated: 2026-03-11
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
| **Naming convention** | CONSISTENT — all kebab-case (TD-27 resolved) | ✓ Resolved |
| **Test-to-source ratio** | 0.60 (170 test files / 282 source files) | Good |
| **EventBus** | CREATED — not wired (deferred to Phase 8) | ✓ By design |
| **Reports domain size** | 42 files across 5 sub-dirs (TD-03 resolved) | ✓ Resolved |

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

## Sprint 3: Reports Domain Reorganization (Priority: MEDIUM) — ✅ COMPLETE

**Goal**: Split the 42-file reports domain into focused sub-domains for maintainability before Phase 8 adds 14 more generators.

**Result**: Created `reports/pipeline/` (4 files) and `reports/export/` (3 files). Updated 18 consumer files (7 source + 11 test). All tests pass. TD-03 resolved.

**Current structure**:
```
domain/reports/
├── cli/                   # 6 report generators + report-service
├── generators/            # 2 reference generators
├── analysis/              # Complexity + summary analysis (8 files)
├── export/                # HTML, archive, diff (3 files)
├── pipeline/              # Report + doc pipeline bridges + runners (4 files)
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

## Sprint 5: File Naming Standardization (Priority: LOW) — ✅ COMPLETE

**Goal**: Consistent kebab-case file naming across the codebase.

**Result**: Renamed `E2EService.ts` → `e2e-service.ts` and `MakeService.ts` → `make-service.ts` (+ test files). Updated all import paths. TD-27 resolved.

---

## Recommended Execution Order

```
Sprint 1 (controller tests)      HIGH    ~8h    ← Do before Phase 8
Sprint 2 (mock standardization)  MEDIUM  ~4h    ← Do alongside Sprint 1
Sprint 3 (reports reorganization) MEDIUM  ~4h    ✅ COMPLETE (TD-03 resolved)
Sprint 4 (clock consistency)     LOW     ~2h    ← Quick win, any time
Sprint 5 (file naming)           LOW     ~2h    ✅ COMPLETE (TD-27 resolved)
                                         ────
                                Remaining: ~14h (Sprints 1, 2, 4)
```

**Key insight**: Sprint 3 and 5 are done. Sprint 1 (controller tests) should be completed **before Phase 8** begins — it's the highest-impact remaining item.

---

## Deferred (Phase 8+ scope)

These items are documented in [[Tech Debt]] and [[Development Roadmap]] but not part of this improvement sprint:

| Item | Status |
|------|--------|
| Wire EventBus into main.ts (TD-26) | Deferred to Phase 8 — needed when Plugin integration requires cross-domain events |
| ~~Async shell execution (TD-05)~~ | ✅ RESOLVED — `runAsync()` and `runParallel()` added to IShell |
| ~~Config validation schema (TD-06)~~ | ✅ RESOLVED — `validateProjectConfig()` with 45+ rules exists |
| Reports domain test coverage | Addressed partially by Sprint 1 (controller tests) |
| Progress indicators (TD-19) | Deferred — nice-to-have, not blocking |

---

## Metrics After Completion

| Metric | Current | After Sprints 1,2,4 | Target (Phase 8) |
|--------|---------|----------------------|-------------------|
| Tests | 3,608 | ~3,750 | 3,800+ |
| Test suites | 221 | ~240 | 250+ |
| Controller test files | 0 | 15 | 15+ |
| Reports domain file groups | 5 sub-dirs ✓ | 5 sub-dirs | 5 sub-dirs |
| Mock factory usage | ~40% | ~90% | 95%+ |
| `new Date()` in domain | ~5 files | 0 | 0 |
| Naming violations | 0 ✓ | 0 | 0 |
