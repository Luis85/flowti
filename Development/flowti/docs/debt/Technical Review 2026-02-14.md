---
severity: info
category: review
layer: cross-cutting
status: reference
effort: n/a
description: Comprehensive plugin review covering architecture, infrastructure, testing gaps, and generalization opportunities. Supplements the baseline Technical Debt Review 2026-02-13.
reviewed: 2026-02-14
reviewer: Technical Architect
---
# Technical Review — 2026-02-14

Comprehensive code review of the Flowti IBDE plugin, focused on: what should be refactored, where architecture is lacking, where infrastructure is lacking, and what should be generalized or abstracted to improve testability.

---

## Executive Summary

The plugin is architecturally sound — DDD layering is consistent, the EventBus backbone delivers on its decoupling promise, and the 854-test suite provides a strong safety net for infrastructure and domain logic. The main gaps are:

1. **Render-time writes** — `normalizeDocFrontmatter()` writes vault files as a side-effect of rendering (TD-32, high)
2. **Storage race** — concurrent `saveStateToStorage` calls can lose updates (TD-33)
3. **Testing** — 60 of 95 source files (~17,300 LOC) have no tests; pure functions are trivially testable (TD-27, TD-30)
4. **Error handling** — 4 distinct strategies across 62 catch blocks with no convention (TD-29)
5. **Path utilities** — 75+ inline path operations with no centralized module (TD-18)
6. **Write boundary** — 4 UI write mutations bypass EventBridge (TD-31)
7. **Fire-and-forget persistence** — 3 services discard save promises for critical state (TD-35)

One high-severity item found (TD-32). Remaining items are medium or low.

---

## 1. Architecture Review

### What works well

| Aspect | Assessment |
|--------|-----------|
| DDD layering | `infrastructure/`, `domain/`, `ui/` consistently applied across 154 files |
| Event backbone | EventBus + EventBridge delivers decoupling; 128 typed events in `FlowtiEventMap` |
| Service lifecycle | 9/11 domain services implement `IDisposable`; `ServiceContainer.disposeAll()` handles cleanup |
| Registry pattern | Commands, views, services declaratively registered — extending the plugin requires minimal boilerplate |
| Type safety | `strict: true`, Zod at boundaries, composed event map keeps contracts explicit |
| Doc centralization | All doc CRUD routes through `doc.create`/`doc.delete` events via DocService (Phase 8 resolution) |
| Component architecture | Orchestrator + component pattern with shared `deps` injection — consistent across 4 view subsystems |

### Where architecture is lacking

#### 1.1 EventBridge boundary erosion (TD-06, TD-31)

~112 direct Obsidian API accesses in UI files. Most are acceptable read-only queries (metadataCache, vault listing), but **4 write mutations** bypass EventBridge:

| Location | Operation | Should route through |
|----------|-----------|---------------------|
| `CsvActionView.ts:632` | `vault.create()` | DocService `doc.create` event |
| `FolderPickerModal.ts:46` | `vault.createFolder()` | `FileSystemClient.createFolder()` |
| `TypesTab.ts:164` | `vault.delete()` | DocService `doc.delete` event |
| `ReportsTab.ts:194` | `vault.delete()` | DocService `doc.delete` event |

**Recommendation**: Fix the 4 write mutations (small effort). Accept read-only boundary erosion as pragmatic for Obsidian plugin development.

#### 1.2 No unified error strategy (TD-29)

62 catch blocks across 24 files use 4 unrelated strategies:

```
Domain wrapping (12)  → FlowtiError + error.* event     ← infrastructure layer
Logged + emitted (18) → console.error + failure event    ← domain services
Console-only (25)     → console.error, no propagation    ← UI layer
Silent swallow (1)    → catch(() => {})                  ← SourcesExportsGrid
```

One catch in `SourcesExportsGrid.ts:279` silently swallows parse errors. `ConfigDocService` has 4 near-identical catch blocks that should be extracted.

**Recommendation**: Establish convention document. Fix the silent swallow immediately. Extract ConfigDocService shared handler.

#### 1.3 Render-time frontmatter writes (TD-32)

`normalizeDocFrontmatter()` in `helpers.ts` calls `app.fileManager.processFrontMatter()` — a **write operation** — during scan, which runs on every render cycle. This affects DomainsTab, ServicesTab, EventsTab, and all entity tabs via `entityScanner.ts`. Opening a catalog tab silently modifies non-conforming frontmatter files, violating the "render should be side-effect-free" principle and bypassing EventBridge entirely.

**Recommendation**: Separate scan (read-only) from normalize (write). Collect non-conforming files → show indicator → explicit user action to normalize → route writes through DocService.

#### 1.4 Entity tab structural duplication (TD-34)

FlowsTab, ActorsTab, ProductsTab, SystemsTab share identical lifecycle, CRUD, and master-list rendering (~800 LOC duplicated). Entry types (`FlowEntry`, `ActorEntry`, `ProductEntry`) are structurally identical. Four `findRelated*` helper functions in `helpers.ts` are copy-paste variants.

**Recommendation**: Extract `BaseEntityTab<T>` abstract class + `BaseEntityEntry` interface. Medium effort but eliminates ~600 LOC of duplication.

#### 1.5 Orchestrator view complexity (TD-01, mitigated)

14 files exceed 500 LOC. The largest are orchestrator views (600-850 LOC) which is expected given their role, but 3 files have further decomposition opportunities:

| File | LOC | Opportunity |
|------|-----|-------------|
| `contentGenerator.ts` | 708 | Extract per-entity generators into separate functions |
| `EventConfigModal.ts` | 629 | Extract page renderers into sub-components |
| `DomainsTab.ts` | 563 | Extract "Mark as Area" and cross-reference rendering |

---

## 2. Infrastructure Review

### What works well

| Component | Assessment |
|-----------|-----------|
| EventBus | Generic, typed, wildcard support, proper dispose — backbone of the plugin |
| FileSystemClient | Wraps vault ops with error handling, timeout guard (TD-07 resolved) |
| ServiceContainer | Auto-dispose, dependency-ordered registration |
| CommandRegistry | Declarative command wiring with auto-cleanup |
| ViewRegistry | Type-safe view factory registration |
| StorageProvider | Shared state with scoped keys, load/save centralized |

### Where infrastructure is lacking

#### 2.1 No path utility module (TD-18)

75+ inline path operations across 17 files. Three sub-patterns:
- **Basename**: `path.split("/").pop()` — 31 occurrences, 11 files
- **Regex**: `path.replace(/\.md$/, "")` — 44 occurrences, 6 files
- **Payload extraction**: `typeof payload.path === "string"` — 4 occurrences, 4 files

`pathResolver.ts` centralizes entity-doc paths (29 operations) but there's no general-purpose path utility.

**Recommendation**: Create `src/utils/pathUtils.ts` with `basename()`, `dirname()`, `stripExtension()`, `extractStringField()`. Replace inline operations. Small effort, high readability ROI.

#### 2.2 Storage save race condition (TD-33)

`saveStateToStorage()` in `persistence.ts` performs a non-atomic read-merge-write. Concurrent saves from different services can cause lost updates. Three services use `void this.saveState()` fire-and-forget (IngestionService x2, EventDefinitionService x1), making concurrent saves likely during high event throughput.

**Recommendation**: Wrap `saveStateToStorage` with `PathMutex` (already exists in `mutex.ts`). Small effort — single function change.

#### 2.3 Fire-and-forget persistence (TD-35)

Three `void this.saveState()` calls discard save promises after critical state mutations (idempotency ledger, emission tracking). If the save fails, in-memory state diverges from persisted state. After restart, files may be re-processed or events re-emitted. Additionally, `ConfigDocService.createConfigEventDocs()` is called without `void` or `await`.

**Recommendation**: Add `.catch()` handlers that emit error events. For critical paths, await saves or implement retry.

#### 2.4 Storage merging not type-safe (TD-16)

9 services use centralized `loadStateFromStorage` / `saveStateToStorage` helpers. 2 outliers:
- `SettingsService` spreads state at root level (vs other services using nested keys) — potential key collision risk
- `main.ts` uses legacy direct `storage.load()` / `storage.save()` pattern

**Recommendation**: Create `TypedStorage<T>` wrapper with Zod validation. Medium effort — requires touching all service constructors.

#### 2.3 No centralized error boundary for UI

UI errors surface only via `console.error()`. No mechanism to show `Notice()` or error panel to users. The `ErrorService` exists but only handles domain-layer `FlowtiError` instances.

**Recommendation**: Extend `ErrorService` with a UI notification channel. When errors have `userVisible: true`, show an Obsidian `Notice`. Low effort, high user-experience ROI.

---

## 3. Testing Review

### Current state

| Layer | Test files | Source files | Coverage |
|-------|-----------|-------------|----------|
| Infrastructure | 12 | 18 | ~67% by file |
| Domain | 22 | 32 | ~69% by file |
| UI | 6 | 42 | ~14% by file (orchestrators only) |
| Utils | 5 | 5 | 100% by file |
| **Total** | **45** | **97** | **~46% by file** |

854 tests pass. All infrastructure and domain services with business logic are covered. The gap is:

1. **UI components** (42 files, ~12,000 LOC) — no rendering tests (TD-27)
2. **Pure functions** (~1,740 LOC) — trivially testable with zero mocking (TD-30 Tier 1)
3. **Injectable services** (~1,360 LOC) — testable with existing mock patterns (TD-30 Tier 2)

### What should be tested first (priority order)

| Priority | Files | LOC | Why |
|----------|-------|-----|-----|
| 1 | `configDocContent.ts` | 579 | Pure function, generates markdown — highest regression risk |
| 2 | `contentGenerator.ts` | 708 | Pure function, builds note content from CSV |
| 3 | `pathResolver.ts` | 180 | Pure function, path resolution |
| 4 | `ConfigDocService.ts` | 435 | Injectable, complex branching, 4 catch blocks |
| 5 | `PipelineExecutor.ts` | ~280 | Injectable, multi-step orchestration with retry |
| 6 | `eventDocTemplate.ts` | ~275 | Pure function, template generation |

### What should NOT be tested (low ROI)

- `main.ts`, `pluginBootstrap.ts`, `dataExchangeSetup.ts` — wiring files that require full Obsidian runtime
- `ComponentShowcaseView.ts` — demo/preview view

---

## 4. Generalization & Abstraction Opportunities

### 4.1 Path utilities → `src/utils/pathUtils.ts`

**What to generalize**: 75+ inline path operations
**Benefit**: Testable pure functions, eliminates duplication, improves readability
**Effort**: Small (create utility + replace calls)

### 4.2 Typed storage → `src/infrastructure/services/TypedStorage.ts`

**What to generalize**: Storage load/save/merge pattern across 9+ services
**Benefit**: Type safety via Zod, error handling, nested merge support
**Effort**: Medium (new abstraction + refactor service constructors)

### 4.3 Error handler → convention + shared utility

**What to generalize**: 62 catch blocks into 2-3 standard patterns
**Benefit**: Consistent error propagation, no silent swallows, UI notification channel
**Effort**: Small (convention doc + fix outliers) to medium (full ErrorBoundary)

### 4.4 Entity tab base class → `BaseEntityTab<T>` (TD-34)

**What to generalize**: Identical lifecycle, CRUD, and rendering across 4 entity tabs (~800 LOC)
**Benefit**: Eliminates duplication, makes adding new entity types trivial
**Effort**: Medium (create abstract base + refactor 4 subclasses)

### 4.5 Settings-enabled toggle pattern

**What to generalize**: 3 services (Subscription, Ingestion, EventDefinition) independently implement identical `enabled` toggle + `settings.changed`/`settings.loaded` listeners
**Benefit**: Eliminates ~30 LOC of boilerplate per service
**Effort**: Small (shared `registerSettingsToggle()` utility)

### 4.6 Storage save atomicity → mutex wrapper (TD-33)

**What to generalize**: Wrap `saveStateToStorage` with `PathMutex` to prevent concurrent save races
**Benefit**: Eliminates lost-update bug across all 9+ services
**Effort**: Small (single function change)

### 4.7 Entity scanner → `src/ui/catalog/entityScanner.ts` (existing)

**Status**: Already generalized for catalog tabs. Hub tabs intentionally use different data sources (storage vs files). TD-28 correctly assessed as low ROI to unify.

### 4.8 Component deps pattern → already standardized

**Status**: The `CatalogComponentDeps` / `HubComponentDeps` pattern is consistent across all 4 view subsystems. No further generalization needed.

### 4.9 DataExchangeService pass-through delegation

DataExchangeService has 25+ one-liner methods delegating to ConfigDocService (lines 503-561, ~60 LOC). Exposing `configDocService` as a public property (e.g., `dxService.docs.getCsvDocPath(...)`) would reduce the god-object surface. Low priority but worth noting for future refactoring.

---

## 5. Debt Summary

### All tracked items (35 total)

| Status | Count | Items |
|--------|-------|-------|
| Resolved | 16 | TD-02, TD-03, TD-04, TD-05, TD-07, TD-08, TD-10, TD-11, TD-14, TD-15, TD-17, TD-19, TD-21, TD-24, TD-25, TD-26 |
| Mitigated | 2 | TD-01 (severity: low), TD-09 (severity: low) |
| Reclassified | 2 | TD-06 (high→medium), TD-12 (high→low) |
| Open | 15 | TD-06, TD-12, TD-13, TD-16, TD-18, TD-20, TD-22, TD-23, TD-27–TD-35 |

### New items from this review

| # | Title | Severity | Effort | Layer |
|---|-------|----------|--------|-------|
| TD-27 | [[TD-27 Limited UI component testing]] | medium | medium | UI |
| TD-28 | [[TD-28 Scanner duplication between Catalog and Hub]] | low | low | UI |
| TD-29 | [[TD-29 Error handling inconsistency]] | medium | medium | cross-cutting |
| TD-30 | [[TD-30 Untested domain and infrastructure logic]] | medium | medium | cross-cutting |
| TD-31 | [[TD-31 Direct write mutations bypass EventBridge]] | medium | small | UI |
| TD-32 | [[TD-32 normalizeDocFrontmatter writes during render]] | high | medium | UI |
| TD-33 | [[TD-33 Storage save race condition]] | medium | small | infrastructure |
| TD-34 | [[TD-34 Entity tab structural duplication]] | low | medium | UI |
| TD-35 | [[TD-35 Fire-and-forget persistence risk]] | medium | small | domain |

### Updated items

| # | Change |
|---|--------|
| TD-18 | Expanded from "5+ times" to "75+ occurrences across 17 files" with 3 sub-patterns |

### Recommended action priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 1 | TD-32 separate scan from normalize | medium | Eliminates writes during render (high severity) |
| 2 | TD-33 storage save mutex | small | Prevents concurrent save data loss |
| 3 | TD-29 fix silent swallow | tiny | Eliminates hidden failures |
| 4 | TD-35 add .catch() to save calls | small | Makes persistence failures visible |
| 5 | TD-18 path utilities | small | Removes 75+ inline operations |
| 6 | TD-30 Tier 1 tests | small | Tests 1,740 LOC of pure functions |
| 7 | TD-31 write mutations | small | 4 targeted fixes for boundary consistency |
| 8 | TD-29 error convention | medium | Establishes consistent error strategy |
| 9 | TD-30 Tier 2 tests | medium | Tests 1,360 LOC of injectable services |
| 10 | TD-34 entity tab base class | medium | Eliminates ~800 LOC duplication |
| 11 | TD-27 UI component tests | medium-large | Tests 12,000 LOC of UI rendering |
| 12 | TD-16 typed storage | medium | Type-safe storage across all services |

---

## 6. Conclusion

The Flowti IBDE plugin is well-architected with strong foundations: typed EventBus, DDD layering, comprehensive domain testing, and centralized doc management. The debt is structural rather than critical — no items block further development.

The highest-ROI improvements are:
1. **Separate scan from normalize** (TD-32) — stops writes during render, the only high-severity item
2. **Storage save mutex** (TD-33) — small effort, prevents data loss from concurrent saves
3. **Path utility extraction** (TD-18) — small effort, removes widespread duplication
4. **Persistence error visibility** (TD-35) — small effort, makes save failures observable
5. **Pure function testing** (TD-30 Tier 1) — small effort, covers highest-risk untested code

The plugin's architecture supports continued scaling. The component decomposition (53 components across 4 view subsystems) and event-driven domain model provide a solid foundation for future features.
