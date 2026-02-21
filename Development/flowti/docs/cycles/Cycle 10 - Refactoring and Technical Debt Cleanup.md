---
type: DevelopmentCycle
feature: "[[Session Workspaces PRD]]"
stage: planned
cycle: 10
date_planned: 2026-02-20
date_updated: 2026-02-21
pbis: []
bugs: []
bugs_fixed_precycle: []
tech_debt:
  - "[[TD-105 void emit fire-and-forget masks handler failures]]"
  - "[[TD-110 ImportsTab live listeners accumulate per active-import render]]"
  - "[[TD-114 loadSettings warning lost because logger not yet initialized]]"
  - "[[TD-116 onunload incomplete cleanup and missing error isolation]]"
  - "[[TD-102 FileSystemClient.fileExists conflates not-found with failure]]"
  - "[[TD-104 FileSystemClient has no disposal for in-flight requests]]"
  - "[[TD-107 DataExchangeService catch blocks assume child service emitted error]]"
  - "[[TD-106 HubRegistry.openHub missing error handling for Obsidian API]]"
  - "[[TD-115 saveSettings unsafe cast of loadData result]]"
  - "[[TD-103 ServiceContainer.disposeAll lacks cascading failure protection]]"
  - "[[TD-111 FolderSuggest input listeners never cleaned up]]"
  - "[[TD-117 ESLint config missing no-floating-promises rule]]"
  - "[[TD-72 SettingsService saveSettings read-merge-write race]]"
  - "[[TD-56 Storage corruption silent fallback]]"
  - "[[TD-112 Hub tabs full re-render on every click interaction]]"
  - "[[TD-113 UserHubSessions exceeds 600 LOC with mixed concerns]]"
  - "[[TD-46 No error boundaries in views]]"
  - "[[TD-62 generateEventKey non-deterministic when path absent]]"
  - "[[TD-64 file.renamed payload inconsistency breaks path extraction]]"
  - "[[TD-67 frontmatter.update.response may return stale data]]"
  - "[[TD-71 FolderScaffoldStep idempotency relies on error string matching]]"
  - "[[TD-74 error.handled event is dead definition]]"
  - "[[TD-61 IngestionService processJobPayload is dead no-op]]"
  - "[[TD-65 pendingCreatedPaths Set has no eviction]]"
  - "[[TD-75 checkOrphanedFlows has quadratic complexity]]"
  - "[[TD-76 Health checks have no render-to-render caching]]"
  - "[[TD-108 NudgeService persists dismiss before emitting trigger event]]"
  - "[[TD-109 ImportService CSV headers used as YAML keys without sanitization]]"
estimated_increments: 6
estimated_tests: 40
---

# Cycle 10: Refactoring and Technical Debt Cleanup

This is a dedicated maintenance cycle. No new features are delivered. The goal is to systematically reduce the open technical debt backlog, improve infrastructure resilience, eliminate resource leaks, and establish tooling that prevents debt from re-accumulating.

---

## Situation Assessment

### Pre-Cycle State (2026-02-21)

**Cycle 9 delivered.** All 4 increments complete. Retrospective and DoD satisfied.

**Plugin health (actual post-Cycle 9):**
- **2,855 tests passing** (32 skipped), **111 test suites**
- SessionService reduced to **613 LOC** (TD-101 resolved in Cycle 9 Inc 1)
- TD-100 (session performance) **resolved** in Cycle 9 Inc 2 (render debounce + panel batching)
- TD-101 (handler extraction) **resolved** in Cycle 9 Inc 1 (1,766→613 LOC)
- PBI-SW-015 (Activity Intelligence, FR-15) **delivered** in Cycle 9 Inc 3
- MAX_REFLECTIONS (200) + MAX_EXECUTION_TASKS (50) caps in Cycle 9 Inc 4
- 100 total session events (92 active + 8 deprecated)
- PRD v9, FRI 31/35, 8/10 v2 FRs delivered
- `npm test` pipeline: tsc + eslint + vitest

**Tech debt register:**
- **117 total items** (TD-01 through TD-117)
- **~47 resolved** — items fixed in Cycles 1–9
- **~5 mitigated** — partial fixes, downgraded severity
- **~65 open** — active debt requiring remediation

**Open debt by severity:**

| Severity | Count | Key Items |
|----------|-------|-----------|
| High | 8 | TD-49, TD-50, TD-72, TD-78, TD-79, TD-80, TD-85, TD-110 |
| Medium | 36 | TD-06, TD-30, TD-42, TD-46, TD-51, TD-52, TD-56, TD-57, TD-62, TD-64, TD-66, TD-67, TD-68, TD-70, TD-71, TD-77, TD-81, TD-83, TD-90, TD-92, TD-100, TD-102, TD-103, TD-104, TD-105, TD-106, TD-107, TD-111, TD-112, TD-113, TD-115, TD-116, TD-117 |
| Low | 21 | TD-01, TD-12, TD-23, TD-28, TD-29, TD-36, TD-38, TD-43, TD-44, TD-45, TD-47, TD-48, TD-53, TD-58, TD-59, TD-60, TD-61, TD-63, TD-65, TD-73, TD-75, TD-76, TD-87, TD-108, TD-109 |

**Open debt by layer:**

| Layer | Count |
|-------|-------|
| Infrastructure | 16 |
| Domain | 14 |
| UI | 19 |
| Cross-cutting | 12 |
| Flows/Docs | 4 |

**Open debt by category (top themes):**

| Category | Count | Impact |
|----------|-------|--------|
| Architecture | 14 | Long-term maintainability, coupling |
| Error handling | 7 | Silent failures, unobservable errors |
| Resource leaks / Memory | 6 | Degraded performance in long sessions |
| Performance | 7 | UI sluggishness with large datasets |
| Documentation | 8 | Knowledge gaps, onboarding friction |
| Correctness / Bug risk | 5 | Subtle data integrity issues |
| Dead code | 3 | Noise, misleading API surface |
| Tooling / Process | 3 | Prevention of future debt |

### Cycle Goals

1. **Harden error handling and resilience** — fix the most impactful silent failure patterns across all layers
2. **Eliminate resource leaks** — resolve listener accumulation, missing disposal, and unbounded collections
3. **Add EventBus error boundary** — single fix that addresses 60+ `void emit()` call sites
4. **Fix infrastructure correctness bugs** — race conditions, non-deterministic behavior, stale data
5. **Improve UI render performance** — reduce unnecessary DOM churn in hub tabs
6. **Establish lint guardrails** — enable `no-floating-promises` to prevent future debt

**Explicitly deferred to Cycle 11+:**
- TD-49, TD-50 (Layout abstraction, Workspace shell) — large architectural efforts, blocked by PBI-SW-017
- TD-06 (UI bypasses EventBridge) — large effort, requires systematic audit
- TD-42 (Direct service calls bypass EventBus) — medium effort, overlaps with TD-06
- TD-78, TD-79, TD-80, TD-81, TD-83, TD-85 (Documentation stubs) — content authoring, not code refactoring
- TD-30, TD-57 (Test strategy/coverage) — planned as a separate testing cycle
- TD-51, TD-52 (Component registry, Declarative tabs) — architectural aspirations for hub v2
- TD-90 (Event Catalog auto-generation) — depends on Data Dictionary architecture
- TD-92 (PR process) — process improvement, not code change

---

## Increment Plan

### Inc 1: Error Handling Foundation

**Goal:** Fix the most impactful silent failure and initialization bugs. Every item is small effort with high observability payoff.

**Scope:**

| TD | Title | Effort | Fix |
|----|-------|--------|-----|
| TD-114 | loadSettings warning lost (logger not initialized) | Small | Use `console.warn` as pre-logger fallback; re-emit warning after logger is available |
| TD-116 | onunload incomplete cleanup and missing error isolation | Small | Wrap each dispose call in individual try-catch; add hubRegistry cleanup |
| TD-115 | saveSettings unsafe cast of loadData result | Small | Add type guard: validate `raw` is a plain object before spreading |
| TD-102 | FileSystemClient.fileExists conflates not-found with failure | Small | Catch only `FILE_NOT_FOUND` errors; re-throw unexpected failures |
| TD-107 | DataExchangeService catch blocks assume child service emitted | Small | Add fallback error emission in catch blocks |
| TD-106 | HubRegistry.openHub missing error handling | Small | Wrap Obsidian API calls in try-catch; emit `hub.error` event |
| TD-56 | Storage corruption silent fallback | Small | Emit `storage.fallback` event from TypedStorage when defaults are used |

**Estimated size:**
- LOC changed: ~80 (small fixes across 7 files)
- Tests: ~10 (error path tests for loadSettings, fileExists, disposeAll)
- Files: ~10

**Acceptance criteria:**
- [ ] `loadSettings()` logs validation warnings even on first load
- [ ] `onunload()` completes all cleanup steps even if one disposal throws
- [ ] `saveSettings()` validates `loadData()` result type before spreading
- [ ] `fileExists()` propagates non-FILE_NOT_FOUND errors
- [ ] DataExchangeService catch blocks emit fallback failure events
- [ ] `openHub()` catches Obsidian API errors with user-visible feedback
- [ ] `TypedStorage.safeLoad()` emits event when falling back to defaults
- [ ] `npm test` green

**Documentation intent:** Update TD-114, TD-116, TD-115, TD-102, TD-107, TD-106, TD-56 status to resolved. Document error handling convention decisions in review.

---

### Inc 2: Resource Leak Remediation

**Goal:** Eliminate listener accumulation and add missing disposal patterns.

**Scope:**

| TD | Title | Effort | Fix |
|----|-------|--------|-----|
| TD-110 | ImportsTab live listeners accumulate per render | Small | Clean up listeners at top of `renderActiveImportProgress()`; ensure parent calls `cleanupLiveListeners()` on close |
| TD-111 | FolderSuggest input listeners never cleaned up | Small | Return unsubscribe function from `attachFolderSuggest()`; call in component teardown |
| TD-104 | FileSystemClient has no disposal for in-flight requests | Medium | Track active requests in a Map; implement `dispose()` that rejects pending + clears listeners |
| TD-103 | ServiceContainer.disposeAll cascading failure | Small | Collect disposal errors; return aggregated report; emit `service.disposeFailed` per failure |
| TD-65 | pendingCreatedPaths Set has no eviction | Tiny | Add TTL-based eviction (30s) or cap at 500 entries with FIFO eviction |
| TD-74 | error.handled dead definition | Tiny | Remove dead event type from FlowtiEventMap and catalog metadata |
| TD-61 | processJobPayload dead no-op | Tiny | Remove unused hook method and retry wrapper; simplify IngestionService |

**Estimated size:**
- LOC changed: ~120 (FileSystemClient disposal is the largest item)
- Tests: ~10 (disposal tests for FileSystemClient, ImportsTab cleanup verification)
- Files: ~8

**Acceptance criteria:**
- [ ] ImportsTab listener count does not grow across re-renders during active import
- [ ] `attachFolderSuggest()` returns cleanup function; callers invoke it
- [ ] `FileSystemClient.dispose()` rejects pending requests and clears all listeners
- [ ] `ServiceContainer.disposeAll()` returns list of failed service IDs
- [ ] `pendingCreatedPaths` does not grow unbounded in long sessions
- [ ] `error.handled` removed from event type map and catalog
- [ ] `processJobPayload` and retry wrapper removed from IngestionService
- [ ] `npm test` green

**Documentation intent:** Update TD-110, TD-111, TD-104, TD-103, TD-65, TD-74, TD-61 status to resolved. Document disposal patterns in review.

---

### Inc 3: EventBus Resilience

**Goal:** Add a global error boundary to EventBus.emit() and fix the settings race condition. This single EventBus fix addresses the root cause behind 60+ `void emit()` sites.

**Scope:**

| TD | Title | Effort | Fix |
|----|-------|--------|-----|
| TD-105 | void emit fire-and-forget masks handler failures | Medium | Add try-catch per subscriber in `EventBus.emit()`; route errors through ErrorService or `console.error` fallback |
| TD-117 | ESLint no-floating-promises rule | Small | Enable `@typescript-eslint/no-floating-promises` as warning; add `parserOptions.project` for type-aware linting |
| TD-72 | SettingsService saveSettings read-merge-write race | Small | Add `PathMutex.withLock()` wrapper around read-merge-write sequence |

**Estimated size:**
- LOC changed: ~60
- Tests: ~10 (EventBus error boundary tests, SettingsService concurrent save test)
- Files: ~5

**Acceptance criteria:**
- [ ] EventBus.emit() catches subscriber errors and routes to ErrorService
- [ ] Existing `void emit()` call sites continue to work without modification
- [ ] ESLint `no-floating-promises` enabled (warning level); existing `void` usages pass
- [ ] `npm run lint` green with new rule
- [ ] SettingsService concurrent saves are serialized via mutex
- [ ] `npm test` green

**Documentation intent:** Update TD-105, TD-117, TD-72 status to resolved. Document EventBus error boundary pattern in review (potential ADR candidate).

---

### Inc 4: Infrastructure Correctness

**Goal:** Fix subtle correctness bugs in event bridge, installer, and file operations.

**Scope:**

| TD | Title | Effort | Fix |
|----|-------|--------|-----|
| TD-62 | generateEventKey non-deterministic when path absent | Small | Fall back to `name` or `id` instead of random UUID when path is absent |
| TD-64 | file.renamed payload inconsistency | Small | Normalize payload to always include `oldPath` and `newPath` |
| TD-67 | frontmatter.update.response may return stale data | Small | Re-read frontmatter after update to ensure response reflects committed state |
| TD-71 | FolderScaffoldStep idempotency relies on error string matching | Small | Use `app.vault.getAbstractFileByPath()` existence check instead of catching error strings |
| TD-108 | NudgeService dismiss-before-emit ordering | Small | Emit first, then persist dismiss state; use transient in-memory set for same-minute dedup |
| TD-109 | ImportService YAML key sanitization | Small | Add `sanitizeYamlKey()` function; validate keys contain only safe characters |

**Estimated size:**
- LOC changed: ~60
- Tests: ~5 (deterministic key generation, payload normalization, YAML key sanitization)
- Files: ~7

**Acceptance criteria:**
- [ ] `generateEventKey()` produces deterministic keys regardless of path presence
- [ ] `file.renamed` events always include both `oldPath` and `newPath`
- [ ] Frontmatter update responses reflect committed values
- [ ] Folder scaffold checks existence before creation (no error string matching)
- [ ] NudgeService emits trigger before persisting dismiss state
- [ ] CSV column headers are sanitized before use as YAML keys
- [ ] `npm test` green

**Documentation intent:** Update TD-62, TD-64, TD-67, TD-71, TD-108, TD-109 status to resolved.

---

### Inc 5: UI Performance Quick Wins

**Goal:** Reduce unnecessary DOM churn in hub tabs and add caching for expensive health check computations.

**Scope:**

| TD | Title | Effort | Fix |
|----|-------|--------|-----|
| TD-112 | Hub tabs full re-render on every click | Medium | Selection-change handler toggles CSS class on master items; only re-renders detail panel |
| TD-75 | checkOrphanedFlows has quadratic complexity | Small | Pre-compute `Set` objects for domain/event membership tests |
| TD-76 | Health checks no render-to-render caching | Small | Memoize health check results; invalidate on entity count change |
| TD-46 | No error boundaries in views | Small | Add top-level try-catch in `onTabRender()` and `onDashboardRender()` with user-visible error state |

**Estimated size:**
- LOC changed: ~80
- Tests: ~5 (health check caching, error boundary rendering)
- Files: ~6

**Acceptance criteria:**
- [ ] Master list item click does not trigger full `renderMaster()` — only CSS class toggle + `renderDetail()`
- [ ] `checkOrphanedFlows()` uses Set-based membership tests (O(1) per lookup)
- [ ] Health check results are cached across renders; invalidated when entity counts change
- [ ] View render errors are caught and displayed as "Something went wrong" state (not blank screen)
- [ ] `npm test` green

**Documentation intent:** Update TD-112, TD-75, TD-76, TD-46 status to resolved. Document error boundary pattern in review.

---

### Inc 6: Stretch — Component Extraction and Cleanup

**Goal:** Extract oversized UI components and clean up remaining small items. Only if budget allows after Inc 1–5.

**Scope:**

| TD | Title | Effort | Fix |
|----|-------|--------|-----|
| TD-113 | UserHubSessions exceeds 600 LOC with mixed concerns | Medium | Extract `SessionDetailPanel` (~250 LOC) and `SessionTimerDisplay` (~80 LOC) |
| TD-70 | Installer state not persisted per step | Small | Persist installer progress to storage after each step; resume on reopen |
| TD-68 | Export emits no per-record progress events | Small | Emit `dataExchange.export.progress` with current/total counts during export |

**Estimated size:**
- LOC changed: ~100 (mostly moved, net ~30 new)
- Tests: ~0 (refactoring; existing tests cover behavior)
- Files: ~5

**Acceptance criteria:**
- [ ] UserHubSessions.ts reduced to ~200 LOC
- [ ] SessionDetailPanel and SessionTimerDisplay are separate files under `src/ui/userHub/`
- [ ] All existing UserHub tests pass unchanged
- [ ] Installer progress survives tab close and reopen
- [ ] Export operations emit per-record progress events
- [ ] `npm test` green

**Documentation intent:** Update TD-113, TD-70, TD-68 status to resolved. Update Frontend Architecture doc if UserHubSessions extraction changes component map.

---

## Completed Pre-Cycle

No pre-cycle work required. Cycle 9 delivered cleanly with all DoD criteria satisfied. Build is green at 2,855 tests, 111 suites. No blocking bugs.

---

## Increment Dependencies

```
Inc 1: Error Handling Foundation — independent, foundational
    ↓
Inc 2: Resource Leak Remediation — independent (can parallel with Inc 1)
    ↓
Inc 3: EventBus Resilience — benefits from Inc 1 (error patterns established)
    ↓
Inc 4: Infrastructure Correctness — independent
    ↓
Inc 5: UI Performance — independent (can parallel with Inc 3-4)
    ↓
Inc 6: Component Extraction — stretch, after all others
```

**Recommended order:** Inc 1 → Inc 2 → Inc 3 → Inc 4 → Inc 5 → Inc 6

Inc 1 and Inc 2 can run in parallel. Inc 3 is most impactful when Inc 1's error handling patterns are established first. Inc 4 and Inc 5 are independent and can be interleaved.

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| EventBus error boundary changes subscriber timing | Low | High | Existing `void emit()` sites explicitly opt out of error handling; boundary only catches, does not suppress |
| ESLint no-floating-promises produces hundreds of warnings | Medium | Low | Enable as warning, not error; address incrementally; `void` prefix already handles most cases |
| FileSystemClient disposal rejects promises that callers don't expect | Medium | Medium | Use a `CancelledError` type that callers can check; add `.catch()` to critical file operations |
| Hub tab render optimization breaks selection state | Low | Medium | Unit test selection toggle behavior; verify CSS class manipulation matches existing visual state |
| SettingsService mutex introduces deadlock | Low | High | Use same PathMutex pattern as TD-33 fix (proven in production); add timeout |

---

## Success Criteria

| Metric | Target | Notes |
|--------|--------|-------|
| Open high-severity debt | 6 (was 8) | TD-110 and TD-72 resolved |
| Open medium-severity debt | 22 (was 36) | 14 items resolved in Inc 1-5 |
| Total debt resolved this cycle | 28 items | From 65 open → 37 open |
| Test suite | All passing, +40 new | Zero regressions |
| Build green | `npm test` + `npm run lint` | Including new ESLint rule |
| No new debt introduced | 0 new TDs | Maintenance cycle — debt goes down, not up |
| Resource leak score | 0 high-severity leaks | TD-110, TD-104, TD-111, TD-103 resolved |

---

## Tech Debt Inventory — Full Status After Cycle 10

### Items Targeted for Resolution (28)

**Inc 1 — Error Handling (7):**
TD-114, TD-116, TD-115, TD-102, TD-107, TD-106, TD-56

**Inc 2 — Resource Leaks (7):**
TD-110, TD-111, TD-104, TD-103, TD-65, TD-74, TD-61

**Inc 3 — EventBus Resilience (3):**
TD-105, TD-117, TD-72

**Inc 4 — Infrastructure Correctness (6):**
TD-62, TD-64, TD-67, TD-71, TD-108, TD-109

**Inc 5 — UI Performance (4):**
TD-112, TD-75, TD-76, TD-46

**Inc 6 Stretch (3):**
TD-113, TD-70, TD-68

### Items Remaining Open After Cycle 10 (~36)

**High severity (6 remaining):**
- TD-49: Layout abstraction layer (large, deferred to hub v2)
- TD-50: Workspace shell layout (large, deferred to hub v2)
- TD-78: Domain documents empty stubs (documentation)
- TD-79: Persona documents empty stubs (documentation)
- TD-80: 95% of JTBDs empty stubs (documentation)
- TD-85: 40% docs lack type frontmatter (documentation)

**Medium severity (21 remaining):**
- TD-06: UI bypasses EventBridge (large effort)
- TD-27: Limited UI component testing (mitigated)
- TD-30: Untested domain/infra logic (testing cycle)
- TD-42: Direct service calls bypass EventBus (medium effort)
- TD-51: Component registry (hub v2)
- TD-52: Declarative tab definitions (hub v2)
- TD-57: Migration test strategy (testing cycle)
- TD-66: FileSystemClient wildcard listener churn (medium)
- TD-77: Health tab entities not navigable (small)
- TD-81: User stories have no content (documentation)
- TD-83: Only 1/28 features has problem-solution separation (documentation)
- TD-90: Event Catalog manually maintained (large)
- TD-91: No wikilink validation (mitigated)
- TD-92: No pull-request process (process)
- TD-93: Duplicate data plugin state vs metadata (large)

**Low severity (9 remaining):**
- TD-01: UI files exceed size convention (mitigated)
- TD-12: Wildcard listeners degrade performance
- TD-23: InstallerWizardModal mixes concerns
- TD-28: Scanner duplication
- TD-36: Folder scans instead of events
- TD-38: Outdated component library view
- TD-43: No correlation IDs
- TD-44: No list virtualization
- TD-45: View state not persisted
- TD-47: Dedup not visible to users
- TD-48: CSV parsing blocks UI thread
- TD-53: Shared UI primitive library
- TD-58: Performance baseline/monitoring
- TD-59: DomainsTab/ServicesTab not on BaseEntityTab
- TD-60: Health widget hub integration gap
- TD-63: No telemetry for delete detection
- TD-69: Import runs sequentially
- TD-73: CommandRegistry no unregister
- TD-87: Knowledgebase has only 2 articles

---

## Definition of Done (Cycle)

- [ ] All planned increments completed (Inc 1–5 required, Inc 6 stretch)
- [ ] Build pipeline passes (`npm test` + `npm run lint` green)
- [ ] All targeted TD items updated to `status: resolved` with resolution notes
- [ ] No regressions — all existing tests pass unchanged
- [ ] Three Amigos review completed (focus: error handling convention, EventBus change, resource leak verification)
- [ ] PRD and tech debt register updated (open count, resolved dates)
- [ ] Cycle retrospective captured
- [ ] Improvement items from Cycle 10 captured for Cycle 11

---

## Related

- [[Session Workspaces PRD]] — parent feature
- [[Cycle 9 - Service Extraction and Intelligence]] — predecessor cycle (TD-101, TD-100, PBI-SW-015)
- [[TD-29 Error handling inconsistency]] — foundational debt item, partially mitigated
- [[TD-35 Fire-and-forget persistence risk]] — resolved precursor to TD-105 pattern
- [[ADR-021 Error Handling Convention]] — error handling guidelines
- Next candidate: Cycle 11 — PBI-SW-017 (Main/Sidebar Mode Separation) + remaining v2 features, or hub v2 architecture
