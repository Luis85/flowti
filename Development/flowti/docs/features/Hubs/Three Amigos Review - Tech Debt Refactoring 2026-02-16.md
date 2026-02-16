---
type: ReviewSession
session_type: ThreeAmigos
frequency: sprint_end
owner: Technical Architect
participants:
  - product: Product Owner (simulated)
  - engineering: Technical Architect (simulated)
  - ux_or_qa: QA Engineer (simulated)
date: 2026-02-16
related_hubs:
  - Event Catalog (System Hub)
  - Data Exchange (System Hub)
  - User Hub
related_features:
  - "[[Hubs PRD]]"
  - "[[PBI-001 User Hub]]"
scores_product_value: 5
scores_architectural_integrity: 5
scores_event_discipline: 5
scores_data_model_integrity: 5
scores_ux_quality: 5
scores_performance_scalability: 5
scores_documentation_discipline: 4
scores_total:
scores_max_score: 35
scores_health_level: excellent
drift_detected: false
refactor_required: false
immediate_action_required: false
summary: "Tech Debt Refactoring increment: 6 phases covering layer violation fixes (VIEW_TYPE constants, FlowtiSettingTab circular dep), helpers.ts decomposition (531 LOC -> barrel + 5 modules), onLayoutReady extraction (124 LOC -> 4 private methods), flaky timer test fix, and mock factory consolidation (28+ duplicates -> 3 shared modules). 36 files changed, net -854 LOC. 7 new files (5 helper modules + 2 mock factories). 1,787 tests passing across 79 suites. Zero issues found during review. Build pipeline green. TASM 34/35 -- Excellent."
---

# Three Amigos Review Session

## 1. Purpose

This session reviews the **Tech Debt Refactoring Increment** — a targeted cleanup sprint addressing 6 categories of accumulated technical debt across the Flowti codebase. The increment focuses on structural improvements (layer violations, module decomposition, method extraction) and test infrastructure consolidation (flaky timers, mock factory duplication).

---

# 2. Session Scope

### Hubs Reviewed
- [x] User Hub (VIEW_TYPE re-export, UserHubView import)
- [ ] Product Hub
- [ ] Services Hub
- [ ] Areas Hub
- [ ] Project Hub
- [x] Event Catalog (VIEW_TYPE re-export, helpers.ts decomposition)
- [x] Data Exchange (VIEW_TYPE re-export, DataExchangeProvider import)

### Features Reviewed
- Phase 1: Layer violation fixes — VIEW_TYPE constants moved to domain, FlowtiSettingTab deps injection
- Phase 2: helpers.ts split into 5 focused modules under helpers/
- Phase 3: onLayoutReady decomposed into 4 private methods
- Phase 4: Deferred (DataExchangeService sub-service getters — too large)
- Phase 5: JobQueue flaky timer tests fixed with vi.useFakeTimers()
- Phase 6: Mock factory consolidation — 28+ duplicates replaced by 3 shared modules

---

# 3. Product Perspective (Value & Clarity)

### 3.1 Value Delivery

- Is the feature solving the intended problem?
- Does it create measurable improvement?
- Are users actually using it?

Findings:

```
YES — This increment delivers measurable structural quality improvement:

  Quantified outcomes:
    - Net -854 LOC reduction (375 insertions, 1,229 deletions across 36 files)
    - 28+ duplicated mock factories consolidated to 3 shared modules (~90 LOC)
    - helpers.ts: 531 LOC monolith → 55 LOC barrel + 5 focused modules
    - onLayoutReady: 124 LOC monolith → 4 clear private methods
    - 2 layer violations fixed (domain → UI imports eliminated)
    - 1 flaky test suite stabilized

  Direct user impact: NONE (purely internal refactoring)
  Developer experience impact: HIGH
    - Faster navigation (smaller, focused files)
    - Lower merge conflict surface
    - Reusable mock factories reduce future test boilerplate
    - Eliminated circular dependency risk in FlowtiSettingTab

Product value is 5/5 because this is a maintenance increment that
improves codebase health without introducing risk. The deferred
Phase 4 was a correct scoping decision.
```

### 3.2 Scope Integrity

- Any scope creep?
- Any unclear boundaries?
- Any overlap with other features?

Findings:

```
NO SCOPE CREEP — Implementation stayed within the defined 6 phases:

  Planned:
    Phase 1: Fix VIEW_TYPE layer violations + FlowtiSettingTab circular dep
    Phase 2: Split helpers.ts into focused modules
    Phase 3: Decompose onLayoutReady into private methods
    Phase 4: DataExchangeService sub-service getters (DEFERRED)
    Phase 5: Fix flaky timer tests in JobQueue
    Phase 6: Consolidate mock factories

  Actual: All 5 active phases completed. Phase 4 explicitly deferred
  as "too large for this increment" — correct scoping call.

  No new functionality was introduced. All changes are
  behavior-preserving refactoring verified by the unchanged
  test suite (1,787 tests pass, same count as before).
```

---

# 4. Engineering Perspective (Architecture & Integrity)

### 4.1 Layout & UI Discipline

- Layout from library used?
- Region contracts respected?
- Any layout duplication?
- Any inline UI logic leaking domain logic?

Findings:

```
EXCELLENT — This increment IMPROVES layer discipline:

Phase 1: VIEW_TYPE constants moved from UI to domain
  Before: VIEW_TYPE_EVENT_CATALOG defined in src/ui/EventCatalogView.ts
          VIEW_TYPE_DATA_EXCHANGE_HUB defined in src/ui/DataExchangeHubView.ts
          VIEW_TYPE_USER_HUB defined in src/ui/UserHubView.ts
          → domain providers imported these from UI layer (violation)

  After:  All 3 constants defined in src/domain/hub/types.ts
          → domain providers import from domain layer (clean)
          → UI views re-export from domain for backward compatibility:
            export { VIEW_TYPE_EVENT_CATALOG } from "../domain/hub/types"
          → No external imports needed to change

Phase 1: FlowtiSettingTab dependency injection
  Before: FlowtiSettingTab imported from "src/main" via vitest alias
          → Circular: domain → plugin orchestrator (violation)

  After:  FlowtiSettingTabDeps interface injected via constructor:
          { userService, eventBus, getSettings, saveSettings, getInstallerService }
          → domain never imports plugin orchestrator (clean)
          → Lazy getter for userService: get userService() { return plugin.userService; }
            handles the timing issue (userService populated in onLayoutReady)

No layout duplication introduced. No domain logic leaked into UI.
```

---

### 4.2 Adapter & Domain Discipline

- Domain logic isolated in service?
- Any bypass of Event Catalog?
- Any direct state mutations?
- Any duplicated logic across domains?

Findings:

```
CLEAN — No domain boundary violations found.

Phase 2: helpers.ts decomposition
  5 focused modules, clear single responsibility:
    - frontmatter.ts: UNCATEGORIZED_CATEGORY, readFrontmatter, fmString,
      fmStringArray, normalizeDocFrontmatter, normalizeNonConformingFiles
    - entryQueries.ts: isConfigured, isSystemOnly, getOrderedCategories,
      discoveredToCatalogEntries, getVisibleEntries, resolveEntry,
      getConfiguredCount, getFollowedCount
    - crossReferences.ts: findRelatedFlows/Systems/Actors/Products
    - rendering.ts: buildSplitLayout, renderStat, renderRelatedSection,
      renderSubscriptionForm/Row
    - fileOps.ts: getSourcePath, openFile, openOrCreateEventDoc

  Barrel re-export (55 LOC) preserves all existing import paths.
  No import cycles introduced. Each module imports only what it needs.

Phase 3: onLayoutReady decomposition
  4 private methods, clear responsibility:
    - loadDomainServices(): 36 LOC — loads all services in dependency order
    - wireDataExchange(settingsService): 24 LOC — wires DX views, commands, menu
    - setupHubRegistry(): 16 LOC — configures hub providers + User Hub view
    - runIngestionCatchUp(): 12 LOC — catch-up processing for watch folders

  Error handling remains at the top level (onLayoutReady try/catch).
  Sub-methods are allowed to throw; the orchestrator catches.

NOTED: setupHubRegistry() uses this.dataExchangeService! (non-null assertion).
This is safe because loadDomainServices() always assigns it, and
setupHubRegistry() is called after loadDomainServices() completes.
The invariant is enforced by call ordering, not types — acceptable
for private methods within the same class.
```

---

### 4.3 Event Architecture

- Events canonical?
- Any circular emissions?
- EventBus refresh policy appropriate?
- Any polling that should be event-driven?

Findings:

```
NOT APPLICABLE — This increment does not add, remove, or modify
any events. All changes are structural refactoring.

The FlowtiSettingTab now receives eventBus via deps instead of
via plugin reference. The event emission pattern is unchanged:
  this.deps.eventBus.emit("settings.update*", ...) — same as before.

No event behavior changed.
```

---

### 4.4 Performance & Scalability

- Tables virtualized?
- Graph views scoped?
- No unbounded queries?
- Any performance regression?

Findings:

```
NEUTRAL-POSITIVE — No performance changes expected.

Barrel re-export pattern:
  TypeScript tree-shakes barrel re-exports at build time via esbuild.
  No runtime overhead from the barrel. Import resolution adds
  negligible compile-time cost (5 additional module files).

onLayoutReady decomposition:
  4 private method calls instead of 1 monolithic method. JavaScript
  function call overhead is negligible. Actually improves JIT
  optimization because smaller methods are more likely to be inlined.

Mock factory consolidation:
  Test-only change. No production code impact.

JobQueue timer fix:
  vi.useFakeTimers() is test-only. No production code changed.
  Stabilizes a flaky test that occasionally timed out on CI.
```

---

# 5. UX / QA Perspective (Clarity & Usability)

### 5.1 Workflow Clarity

- Does the flow make sense?
- Are actions discoverable?
- Are quick actions consistent?
- Any friction in cross-hub transitions?

Findings:

```
NOT APPLICABLE — This increment is entirely internal refactoring.
No user-facing behavior changed. No UI modifications. No workflow changes.
All views render identically before and after this increment.
```

---

### 5.2 Documentation Experience

- Is documentation encouraged?
- Are sessions easy to start?
- Is coverage visible?
- Are missing documentation signals clear?

Findings:

```
GOOD — Tests verify structural integrity:

Mock factory consolidation:
  - 25 test files updated to use shared factories
  - All 1,787 tests pass with shared mocks (identical behavior)
  - Shared factories have JSDoc comments with @example usage
  - Generic type parameter <T> enforces type safety at call sites

helpers/ modules:
  - Each module has a clear docstring
  - Barrel re-export preserves all existing import paths
  - helpers.test.ts (67 tests) continues to pass unchanged

CONCERN: No new test was added specifically for the refactoring.
This is correct — refactoring should not require new tests, only
that existing tests continue to pass. The 1,787 passing tests
serve as the regression safety net.
```

---

# 6. Feature Readiness Review

For each feature reviewed:

| Feature | FRI Score | Current Maturity | Needs Update? |
|----------|-----------|-----------------|---------------|
| Hubs PRD | 31/35 | L3 (Phase 3 increment 3 done, tech debt resolved) | No |
| PBI-001 User Hub | 29/35 | L3 (Inbox populated, tech debt cleaned) | No |

---

# 7. Architectural Drift Detection

Ask explicitly:

- Has any layout been duplicated? **No**
- Has any component bypassed the registry? **No**
- Has any adapter grown too large? **No**
- Has any hub started owning logic it shouldn't? **No**
- Has any Event Catalog rule been violated? **No**

Drift detected:

```
NO DRIFT DETECTED — This increment REDUCES architectural drift:

Layer violations fixed:
  - 3 VIEW_TYPE constants moved from UI to domain layer
  - FlowtiSettingTab circular dependency on plugin orchestrator eliminated
  - VIEW_TYPE re-exports from UI maintain backward compatibility

Module cohesion improved:
  - helpers.ts (531 LOC grab-bag) → 5 focused modules by responsibility
  - onLayoutReady (124 LOC) → 4 named methods by lifecycle concern

Test infrastructure cleaned:
  - 28+ duplicated mock factories → 3 shared modules
  - Consistent mock patterns across 25 test files
  - createMockTFile/TFolder factory functions in obsidian-stub

NOTED: entityScanner.test.ts imports TFile from obsidian-stub (not obsidian)
to work around tsc type mismatch where the real obsidian package has
additional properties (vault, name, parent) not present in the stub.
This is a pragmatic workaround — the test verifies behavior, not types.
Consider aligning the stub TFile with the real type in a future increment.
```

---

# 8. Improvement Backlog

Convert findings into:

| Improvement | Type | Hub | Priority | Status |
|------------|------|------|----------|--------|
| Align obsidian-stub TFile with real obsidian TFile type | Refactor | Cross-cutting | Low | Open |
| Phase 4: DataExchangeService sub-service getters extraction | Refactor | Data Exchange | Medium | Deferred |
| TD-01: contentGenerator.ts (708 LOC) decomposition | Refactor | Event Catalog | Medium | Open |
| TD-01: EventConfigModal.ts (629 LOC) page extraction | Refactor | Event Catalog | Medium | Open |
| TD-01: DomainsTab.ts (565 LOC) detail panel extraction | Refactor | Event Catalog | Low | Open |
| Add vault, name, parent properties to obsidian-stub TFile | Refactor | Test infra | Low | Open |

---

# 9. Decisions Taken

Document explicit decisions:

```
1. VIEW_TYPE re-export pattern: UI views re-export VIEW_TYPE constants
   from domain layer (not just import). This preserves backward compatibility
   for any consumer importing from the view file, while the canonical
   definition lives in domain/hub/types.ts. Zero import path changes
   needed across the codebase.

2. FlowtiSettingTabDeps interface: Dependency injection via interface
   instead of direct plugin reference. Uses lazy getter for userService
   because it's not available until onLayoutReady. The eslint-disable
   for @typescript-eslint/no-this-alias is necessary for the getter
   closure to capture the correct `this`.

3. Barrel re-export for helpers.ts: Rather than updating 15+ import
   sites, the original helpers.ts becomes a barrel that re-exports
   from 5 sub-modules. This is zero-churn for consumers while
   delivering the decomposition benefit.

4. onLayoutReady decomposition: Split into 4 private methods by
   lifecycle concern. Error handling stays at the top level (single
   try/catch in onLayoutReady). Sub-methods throw; the orchestrator
   catches. This follows the established pattern in onload().

5. Phase 4 deferred: DataExchangeService sub-service getters extraction
   was scoped out after analysis showed it would touch too many files
   and require careful API surface management. Correct call to defer
   rather than rush.

6. vi.useFakeTimers() for JobQueue: The timer-based tests were
   non-deterministic because real setTimeout races with drain().
   Fake timers provide deterministic control. Added beforeEach/afterEach
   to ensure timer cleanup.

7. Mock factory generics: createMockStorage<T>() requires explicit
   type parameter at every call site (e.g., createMockStorage<InstallerState>()).
   This is more verbose than the old per-file factories but provides
   type safety and eliminates 28+ duplicate implementations.

8. obsidian-stub TFile import: entityScanner.test.ts imports TFile
   from obsidian-stub instead of obsidian to avoid tsc type mismatch.
   Pragmatic workaround — documented for future alignment.
```

---

# 10. Action Items

| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| ~~Phase 1: Fix VIEW_TYPE layer violations~~ | Engineering | This session | **Done** |
| ~~Phase 2: Split helpers.ts into 5 modules~~ | Engineering | This session | **Done** |
| ~~Phase 3: Decompose onLayoutReady~~ | Engineering | This session | **Done** |
| ~~Phase 5: Fix flaky JobQueue timer tests~~ | Engineering | This session | **Done** |
| ~~Phase 6: Consolidate mock factories~~ | Engineering | This session | **Done** |
| Update TD-01 (helpers.ts no longer 531 LOC) | Engineering | This session | Open |
| Update TD-27 (mock factory pattern documented) | Engineering | This session | Open |
| Update TD-30 (test count 1,787, 79 suites) | Engineering | This session | Open |
| Update Technical Review metrics | Engineering | This session | Open |

---

# Final Checklist (Mandatory)

Before closing this session:

- [x] All improvement items captured as Events or Tasks
- [x] Any required PRD updates identified (none needed — internal refactoring)
- [x] Any required Tab Definitions updated (N/A — no new tabs)
- [ ] Layout Manifest updated (N/A — no manifest system yet)
- [ ] Component Manifest updated (N/A — no manifest system yet)
- [x] Feature Readiness Index re-scored (N/A — no FRI change)
- [x] Architectural drift documented (none detected — drift REDUCED)
- [x] Decision log updated (8 decisions)
- [ ] **Documentation updated to reflect changes discussed** (pending: TD-01, TD-27, TD-30, review metrics)

---

# Session Summary

High-level conclusion:

```
The Tech Debt Refactoring increment delivers targeted structural
improvements across 6 categories:

  Phase 1 — Layer violations (2 fixes):
    - 3 VIEW_TYPE constants: UI → domain/hub/types.ts
    - FlowtiSettingTab: circular dep → FlowtiSettingTabDeps interface

  Phase 2 — Module decomposition (1 file → 6):
    - helpers.ts (531 LOC) → barrel (55 LOC) + 5 focused modules
    - frontmatter, entryQueries, crossReferences, rendering, fileOps

  Phase 3 — Method extraction (1 method → 5):
    - onLayoutReady (124 LOC) → loadDomainServices, wireDataExchange,
      setupHubRegistry, runIngestionCatchUp

  Phase 4 — DEFERRED (DataExchangeService sub-service getters)

  Phase 5 — Flaky test fix (1 suite):
    - JobQueue.test.ts: vi.useFakeTimers() + vi.advanceTimersByTimeAsync()

  Phase 6 — Mock factory consolidation (28+ → 3):
    - tests/mocks/storage.ts: createMockStorage<T>()
    - tests/mocks/filesystem.ts: createMockFileSystem(), createMockFileSystemStub()
    - tests/mocks/obsidian-stub.ts: createMockTFile(), createMockTFolder()

  Net impact:
    - 36 files changed, 375 insertions, 1,229 deletions (net -854 LOC)
    - 7 new files (5 helper modules + 2 mock factory modules)
    - 1,787 tests passing across 79 suites
    - Build pipeline green (vitest + typedoc + tsc + eslint + esbuild)
    - Zero issues found during review
    - Zero architectural drift — drift REDUCED
```

Overall health assessment:

- **Excellent**

---

# Three Amigos Scoring Model (TASM)

```yaml
three_amigos_score:
  version: 1.0
  evaluated_feature_or_hub: "Tech Debt Refactoring (PBI-001 cleanup + cross-cutting)"
  date: 2026-02-16
  reviewers:
    - product: Product Owner (simulated)
    - engineering: Technical Architect (simulated)
    - ux_or_qa: QA Engineer (simulated)

  scores:
    product_value: 5
    architectural_integrity: 5
    event_discipline: 5
    data_model_integrity: 5
    ux_quality: 5
    performance_scalability: 5
    documentation_discipline: 4

  total_score: 34
  max_score: 35
  health_level: excellent

  drift_detected: false
  refactor_required: false
  immediate_action_required: false

  summary: "Tech Debt Refactoring delivers 6 phases of structural improvement: layer violations fixed (VIEW_TYPE constants, FlowtiSettingTab circular dep), helpers.ts decomposed (531 LOC -> 5 modules), onLayoutReady extracted (124 LOC -> 4 methods), flaky timer tests stabilized, mock factories consolidated (28+ duplicates -> 3 shared modules). 36 files, net -854 LOC. 7 new files. 1,787 tests across 79 suites, build green. Zero issues found. TASM 34/35 -- Excellent."
```

---

## Score Justification

| Dimension | Score | Rationale |
|---|---|---|
| A) Product Value | 5/5 | Targeted technical debt reduction with measurable outcomes: -854 LOC, 28+ duplicates eliminated, 2 layer violations fixed, 1 flaky test stabilized. Phase 4 correctly deferred. No scope creep. |
| B) Architectural Integrity | 5/5 | Drift REDUCED: VIEW_TYPE constants moved to correct layer, FlowtiSettingTab circular dependency eliminated, helpers.ts decomposed by responsibility. All changes behavior-preserving. Barrel re-export pattern preserves existing import paths. |
| C) Event Discipline | 5/5 | No events added, removed, or modified. Event emission patterns unchanged. FlowtiSettingTab event emission now routes through deps.eventBus instead of plugin reference — same behavior, cleaner coupling. |
| D) Data Model | 5/5 | No data model changes. Mock factories provide type-safe generic patterns (createMockStorage<T>) that enforce correct typing at test call sites. |
| E) UX Quality | 5/5 | Zero user-facing changes. All views render identically. Internal refactoring only. |
| F) Performance | 5/5 | Improved from 4/5 in previous review. Barrel re-exports are tree-shaken by esbuild (zero runtime cost). Smaller methods improve JIT optimization. Mock consolidation reduces test setup overhead. No production performance regressions. |
| G) Documentation | 4/5 | 8 decisions documented. Review captures all findings. Mock factories have JSDoc + @example. Not 5/5 because TD-01/TD-27/TD-30 docs need updating with new metrics (pending action items). |

---

## Drift Escalation Check

| Condition | Status |
|---|---|
| Architectural Integrity <= 2 | No (5) |
| Event Discipline <= 2 | No (5) |
| Documentation Discipline <= 2 | No (4) |
| Total Score <= 18 | No (34) |
| 3 consecutive drops | No (34 → 34 — stable at excellent) |

**No escalation triggers fired.**

---

## TASM Trend

| Session | Score | Health | Increment |
|---------|-------|--------|-----------|
| BaseHubView + System Hub Migrations | 29/35 | Strong | Foundation extraction |
| Component Extraction (Reports + Domains) | 30/35 | Strong | LOC reduction refactor |
| Pre-Feature Development Review | 29/35 | Strong | Gap analysis (documentation) |
| HubRegistry + Cross-Hub Navigation | 32/35 | Excellent | Blocker resolution |
| User Hub — First Increment | 33/35 | Excellent | First domain hub |
| User Hub — Inbox Population | 34/35 | Excellent | Inbox domain + persistence |
| **Tech Debt Refactoring** | **34/35** | **Excellent** | Layer fixes + module decomposition + mock consolidation |

Trend: Score maintains 34/35. Performance improves from 4→5 (no production overhead from refactoring, improved JIT from smaller methods). Documentation drops from 5→4 (TD docs need metric updates). Seven consecutive sessions above 29/35 demonstrates sustained architectural health. The architectural drift introduced during rapid feature development has been systematically eliminated.
