---
type: TechDebt
severity: medium
category: testing
layer: domain
status: resolved
resolved: 2026-02-27
resolved_in: "[[Cycle 49 - Release Readiness and Dogfooding]]"
created: 2026-02-21
effort: medium
description: "The 6 handler modules extracted from SessionService (TD-101) have no individual test files. They are tested indirectly through SessionService.test.ts, but dedicated unit tests would enable targeted coverage of each handler's branching logic."
domain: session
parent: "[[Session Workspaces PRD]]"
---

# TD-121: Session handler modules lack dedicated test files

## Problem

The TD-101 handler extraction (Cycle 9) created 6 handler modules under `src/domain/session/handlers/`:

| Module | LOC | Dedicated Tests |
|--------|-----|-----------------|
| `fieldHandlers.ts` | 295 | None |
| `lifecycleHandlers.ts` | 201 | None |
| `taskHandlers.ts` | 150 | None |
| `trackingHandlers.ts` | 147 | None |
| `syncHandlers.ts` | 123 | None |
| `closureHandlers.ts` | 56 | None |
| **Total** | **972** | **0 files** |

These handlers are tested indirectly through `tests/domain/session/SessionService.test.ts` (which exercises the full service including its delegated handlers). All 2,855 tests pass, so behavioral coverage exists — but the handlers have complex branching logic (particularly `fieldHandlers.ts` with 295 LOC) that would benefit from isolated unit tests.

## Impact

- Handler-level bugs require debugging through the full SessionService test harness
- New handler logic additions lack a clear test target
- Coverage gaps in error paths and edge cases (e.g., `syncHandlers.ts` has a silent `catch {}` at line 120)

## Suggested Fix

Create dedicated test files following the existing patterns:

```
tests/domain/session/handlers/
├── fieldHandlers.test.ts        # ~40 tests
├── lifecycleHandlers.test.ts    # ~20 tests
├── syncHandlers.test.ts         # ~15 tests
├── taskHandlers.test.ts         # ~15 tests
├── trackingHandlers.test.ts     # ~10 tests
└── closureHandlers.test.ts      # ~5 tests
```

The handlers accept a `HandlerContext` interface, making them straightforward to test with the existing mock factories.

## Related

- [[TD-101 SessionService Handler Extraction]] — the extraction that created these modules
- [[TD-30 Untested domain and infrastructure logic]] — broader test coverage tracking
- [[TD-118 session helpers.ts exceeds 600 LOC with mixed concerns]] — same domain

## Affected Files

- `src/domain/session/handlers/*.ts` (6 files, 972 LOC total)
