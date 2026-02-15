---
severity: info
category: review
layer: cross-cutting
status: reference
effort: n/a
description: Post-sprint comprehensive review covering architecture health, new findings, and updated debt status. Follows Technical Review 2026-02-14 and the Tech Debt Sprint (Phases 8-11).
reviewed: 2026-02-15
reviewer: Technical Architect
tags:
  - qa
---
# Technical Review — 2026-02-15

Post-sprint comprehensive review of the Flowti IBDE plugin. This review follows the Tech Debt Sprint (Phases 8-11: UI Command Bus, DocService centralization, BaseEntityTab deduplication, EventConfigModal decomposition, contentGenerator split, error handling ADR, UI component testing pattern, release strategy) and the Flow Integration Test Suite (10 suites, 87 passing, 28 skipped).

---

## Executive Summary

The plugin is in **excellent architectural health** after the Tech Debt Sprint. Of 38 tracked debt items, **27 are resolved**, 4 are mitigated, and 7 remain open. The sprint eliminated all high-severity items (TD-32, TD-33, TD-35). This review identified **3 new items** (TD-39, TD-40, TD-41) — none are high severity.

**Key metrics:**
- 1,447 tests passing, 32 skipped across 65 test files
- 164 source files (~25,500 LOC: 8,700 domain + 16,800 UI)
- 136 typed events in FlowtiEventMap
- 22 ADRs documenting architectural decisions

**New findings:**
1. **TD-39** (low): InstallerService/UserService missing `dispose()`, DocService missing `load()`
2. **TD-40** (medium): Hardcoded paths ignore `settings.entityPaths` — effectively dead settings
3. **TD-41** (medium): EventDefinitionService "once" emission policy has a dedup race window

---

## 1. Architecture Review

### What works well

| Aspect | Assessment |
|--------|-----------|
| DDD layering | `infrastructure/`, `domain/`, `ui/` consistently applied across 164 files |
| Event backbone | EventBus + EventBridge delivers decoupling; 136 typed events in `FlowtiEventMap` |
| Service lifecycle | 8/11 domain services implement full `load()` + `dispose()` lifecycle (TD-39 tracks 3 exceptions) |
| Registry pattern | Commands, views, services declaratively registered |
| Type safety | `strict: true`, composed event map keeps contracts explicit |
| Doc centralization | All doc CRUD routes through `doc.create`/`doc.delete` events via DocService (Phase 8) |
| Component architecture | Orchestrator + component pattern with shared `deps` injection across 4 view subsystems |
| UI Command Bus | All user entry points route through `ui.*` events (Phase 8) |
| BaseEntityTab | 4 entity tabs share abstract base, eliminating ~438 LOC duplication (Phase 10) |
| Error convention | ADR-021 codifies 4 error handling strategies with clear "when to use" guidance |

### What improved since last review (2026-02-14)

| Item | Before | After |
|------|--------|-------|
| TD-32 (render-time writes) | HIGH — writes during scan | Resolved — scan is read-only |
| TD-33 (storage race) | MEDIUM — concurrent saves | Resolved — PathMutex on saveStateToStorage |
| TD-34 (entity tab duplication) | LOW — 800 LOC duplicated | Resolved — BaseEntityTab<T> extraction |
| TD-35 (fire-and-forget) | MEDIUM — save promises discarded | Resolved — .catch() handlers added |
| TD-31 (write mutations) | MEDIUM — 4 UI write bypasses | Resolved — routed through DocService |
| Error handling (TD-29) | MEDIUM — 4 strategies, no convention | Mitigated — ADR-021 established |
| UI testing (TD-27) | MEDIUM — 0% component coverage | Mitigated — DomainsTab exemplar + happy-dom pattern |
| Release strategy (TD-37) | MEDIUM — no CHANGELOG | Mitigated — CHANGELOG.md + ADR-022 |
| Test suite | 854 tests, 45 files | 1,447 tests, 65 files |

### Where architecture is still lacking

#### 1.1 Dead settings: entityPaths configuration (NEW — TD-40)

`DEFAULT_SETTINGS.entityPaths` defines customizable subfolder names for entity types (Flows, Systems, Actors, Products). However, `pathResolver.ts` hardcodes these folder names, and `installer/folders.ts` hardcodes full paths. The settings exist but nothing reads them.

**Severity**: Medium — dead code creates false expectations for users who might try to customize paths.

#### 1.2 UI boundary erosion (existing — TD-06)

~112 direct Obsidian API calls across 32 UI files. Previous assessment stands: all are read-only queries (metadataCache, vault listing, workspace navigation). The one write exception (`FolderPickerModal.createFolder`) is a UI utility. Acceptable trade-off.

#### 1.3 Folder scans vs events (existing — TD-36)

6 entity tabs query metadataCache directly during render. Performance is fine for current scale. Defer unless file count grows significantly.

---

## 2. Infrastructure Review

### Code quality: EXCELLENT

| Check | Result |
|-------|--------|
| Empty catch blocks | 0 found |
| TODO/FIXME/HACK comments | 0 found |
| Console calls without `[Flowti]` prefix | 0 found |
| Unused exports | 0 found |
| Dead imports | 0 found |
| `as any` type casts | 1 found (`CsvLanding.ts:132` — Obsidian undocumented API) |

### File sizes

| File | LOC | Assessment |
|------|-----|-----------|
| `EventBridge.ts` | 614 | Largest infrastructure file — 13 handler pairs. Could be modularized but well-structured internally |
| `catalog.ts` | 423 | Event catalog metadata — justified as single source of truth |
| `events.ts` | 418 | FlowtiEventMap interface — justified by design |

All other infrastructure files (24) are under 300 LOC. All utils files (6) are under 100 LOC.

### Type assertions

Only 1 problematic cast found across all of `src/`:

```typescript
// src/ui/csv/CsvLanding.ts:132
(this.deps.app as any).openWithDefaultApp(file.path);
```

All other type assertions are justified patterns (branded types, generic bridges, internal union discriminators).

---

## 3. Domain Review

### Service lifecycle compliance

| Service | load() | dispose() | Listeners tracked | TypedStorage | Status |
|---------|--------|-----------|-------------------|-------------|--------|
| SettingsService | ✓ | ✓ | ✓ (5) | ✓ | ✅ |
| IngestionService | ✓ | ✓ | ✓ (3 + timer) | ✓ | ✅ |
| SubscriptionService | ✓ | ✓ | ✓ (5) | ✓ | ✅ |
| DataExchangeService | ✓ | ✓ | ✓ (5+) | ✓ | ✅ |
| DiscoveryService | ✓ | ✓ | ✓ (3) | ✓ | ✅ |
| EventDefinitionService | ✓ | ✓ | ✓ (5) | ✓ | ✅ |
| EventFilterService | ✓ | ✓ | ✓ (2) | ✓ | ✅ |
| EventNotificationService | ✓ | ✓ | ✓ (2) | ✓ | ✅ |
| DocService | ✗ | ✓ | ✓ (3) | ✗ | ⚠️ TD-39 |
| InstallerService | ✓ | ✗ | — (emitter only) | ✓ | ⚠️ TD-39 |
| UserService | ✓ | ✗ | — (emitter only) | ✓ | ⚠️ TD-39 |

### Concurrency issue: EventDefinitionService dedup (NEW — TD-41)

The "once" emission policy checks `emittedKeys` before async payload extraction, then adds the key after completion. Under concurrent load, the same event can pass the check twice before the first completes. Standard TOCTOU (time-of-check-to-time-of-use) bug. Fix: add key optimistically before async work, remove on failure.

### Hardcoded paths (NEW — TD-40)

`pathResolver.ts` hardcodes "Flows", "Systems", "Actors", "Products" as subfolder names. `installer/folders.ts` hardcodes the full `03 - Resources/Documentation/Reference/...` path structure. The `settings.entityPaths` configuration exists but is never consulted, making it dead code.

---

## 4. UI Review

### File sizes (files over 400 LOC)

| File | LOC | Role | Assessment |
|------|-----|------|-----------|
| `EventCatalogView.ts` | 836 | Master orchestrator (8 tabs + dashboard) | Expected for orchestrator role |
| `CsvActionView.ts` | 754 | CSV wizard orchestrator | Expected for wizard pattern |
| `ExportView.ts` | 655 | Export wizard orchestrator | Expected for wizard pattern |
| `EventLogView.ts` | 581 | Event log with filtering | Acceptable |
| `DomainsTab.ts` | 565 | File scanning + master-detail | Scanning could extract to service |
| `ExportsTab.ts` | 543 | Hub export config CRUD | Acceptable for complex UI |
| `ImportsTab.ts` | 540 | Hub import config CRUD | Acceptable for complex UI |
| `helpers.ts` | 531 | 20+ utility functions | Should split by concern |
| `ServicesTab.ts` | 509 | File scanning + master-detail | Same as DomainsTab |
| `DataExchangeHubView.ts` | 485 | Hub orchestrator | Expected for orchestrator role |
| `PipelineSourceModal.ts` | 470 | Pipeline source picker | Complex filtering logic |
| `EventDetailPanel.ts` | 419 | Event detail with 8 sections | Sub-component, acceptable |
| `CsvConfigPage.ts` | 405 | CSV config page | Acceptable for wizard page |

**Observation**: The 4 largest files (836, 754, 655, 485 LOC) are all **orchestrator views** — their size is expected since they manage tab state, component lifecycle, and event listeners. These were already assessed as acceptable in TD-01 (mitigated).

### UI component patterns

All catalog components follow the standard `constructor(masterEl, detailEl, deps)` + `render()` pattern. Hub components follow similarly. CSV and Export wizard pages follow a `constructor(container, deps)` + `render()` pattern. Consistency is strong.

**One deviation**: `CsvLanding.ts:132` uses `as any` to access `app.openWithDefaultApp()` — an undocumented Obsidian API. Minor type safety gap.

### Direct Obsidian API calls (existing — TD-06)

Confirmed by this review: CsvActionView, DataExchangeHubView, FolderPickerModal, ExportView, EventLogView all make direct API calls. Previous assessment stands — these are read-only queries except for one `createFolder` in FolderPickerModal.

---

## 5. Testing Review

### Current state

| Layer | Test files | Source files | Coverage |
|-------|-----------|-------------|----------|
| Infrastructure | 12 | 18 | ~67% by file |
| Domain | 31 | 50 | ~62% by file |
| UI | 9 | 71 | ~13% by file |
| Utils | 5 | 6 | ~83% by file |
| Flows | 10 | — | 10 user journeys |
| **Total** | **65** | **164** | **~40% by file** |

**1,447 tests passing, 32 skipped**

### What's well-tested

- All domain services with business logic (9/11 services have dedicated test suites)
- EventBus, TypedStorage, PathMutex, glob utilities
- Content generation (configDocContent, contentGenerator, pathResolver)
- Pipeline execution, config tracking, data dictionary building
- 10 flow integration tests covering documented user journeys

### What's NOT tested (tracked in TD-27)

~40 UI component files have zero test coverage. The DomainsTab exemplar pattern (16 tests, happy-dom environment) was established but not yet replicated to other components. Key untested areas:

- Catalog tabs: ServicesTab, EventsTab, EventDetailPanel, CatalogDashboard, helpers
- CSV wizard pages: CsvLanding, CsvConfigPage, CsvPreviewPage, CsvResultPage
- Export wizard pages: ViewSelectPage, ConfigurePage, PreviewPage, ResultPage
- Hub components: HubDashboard, ImportsTab, ExportsTab, PipelinesTab, ReportsTab, PropertiesTab
- Pipeline components: PipelineDetail, PipelineEditForm, PipelinePreview, SourcesExportsGrid
- Modals: SubscriptionManagerModal, PipelineSourceModal

### Flow integration test coverage

10 suites covering all documented user journeys:

| Suite | Tests | Skip | Coverage |
|-------|-------|------|----------|
| 01-FirstRunOnboarding | 5 | 2 | Complete lifecycle + persistence |
| 02-BrowseAndConfigureEvents | 10 | 3 | Catalog + subscription + definition |
| 03-ImportCsvData | 9 | 2 | CSV parse + import + conflict |
| 04-ExportVaultData | 9 | 3 | Export + config persistence |
| 05-ManageEventSubscriptions | 9 | 3 | CRUD + filter matching |
| 06-CreateDomainDocumentation | 9 | 3 | DocService + cross-references |
| 07-MonitorAndDebugEvents | 8 | 3 | Logger + filter + notification |
| 08-ConfigureFileIngestion | 10 | 2 | Ingestion + definition matching |
| 09-DiscoverCustomEvents | 8 | 3 | Discovery + definition + subscription |
| 10-ManageDataDictionary | 10 | 4 | Dictionary + config + display |

**28 skipped tests** fall into 2 categories:
1. `emitCustom()` only fires wildcard handlers (8 tests) — by-design limitation
2. Require live Obsidian runtime (20 tests) — modal rendering, settings UI, dashboard rendering

---

## 6. Debt Status Summary

### All tracked items (41 total)

| Status | Count | Items |
|--------|-------|-------|
| Resolved | 27 | TD-02–05, TD-07–11, TD-13–22, TD-24–26, TD-31–35 |
| Mitigated | 4 | TD-01, TD-27, TD-29, TD-37 |
| Open | 10 | TD-06, TD-12, TD-23, TD-28, TD-30, TD-36, TD-38, TD-39, TD-40, TD-41 |

### Open items by severity

| # | Title | Severity | Effort | Layer |
|---|-------|----------|--------|-------|
| TD-40 | Hardcoded paths ignore settings.entityPaths | medium | medium | domain |
| TD-41 | EventDefinitionService dedup race condition | medium | small | domain |
| TD-30 | Untested domain/infra logic (Tier 3 bootstrap) | medium | low ROI | cross-cutting |
| TD-06 | UI layer bypasses EventBridge (read-only) | medium | large | ui |
| TD-39 | Missing lifecycle methods on 3 services | low | tiny | domain |
| TD-12 | Wildcard listeners degrade performance | low | deferred | infrastructure |
| TD-23 | InstallerWizardModal mixes state/rendering | low | medium | ui |
| TD-28 | Scanner duplication between Catalog and Hub | low | low | ui |
| TD-36 | Folder scans instead of events | low | deferred | infrastructure |
| TD-38 | Outdated Component Library View | low | small | cross-cutting |

### Mitigated items (conventions established, incremental work remains)

| # | Title | What's done | What remains |
|---|-------|-------------|-------------|
| TD-01 | UI files exceed size convention | Orchestrators accepted as justified | Monitor for growth |
| TD-27 | Limited UI component testing | DomainsTab exemplar + happy-dom | ~39 more components |
| TD-29 | Error handling inconsistency | ADR-021 convention established | Apply to new code |
| TD-37 | No release strategy | CHANGELOG.md + ADR-022 | Version bump workflow |

---

## 7. Recommended Action Priority

### Immediate (next sprint)

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | TD-41 Fix EventDefinitionService dedup race | small | Prevents duplicate domain events |
| 2 | TD-39 Add missing lifecycle methods | tiny | Pattern consistency |

### Near-term (this month)

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 3 | TD-40 Wire settings.entityPaths or remove dead config | medium | Eliminates dead code / enables customization |
| 4 | TD-27 Replicate DomainsTab test pattern to 5-10 more components | medium | Increase UI test coverage |

### Deferred (low priority, no urgency)

| # | Item | Reason for deferral |
|---|------|-------------------|
| TD-06 | Read-only API calls are acceptable | Not blocking |
| TD-12 | Performance not measurably impacted | Not blocking |
| TD-23 | InstallerWizardModal works correctly | Low usage frequency |
| TD-28 | Scanner patterns serve different data sources | Architectural trade-off |
| TD-30 | Tier 3 bootstrap files have low test ROI | Require Obsidian runtime |
| TD-36 | Scan performance is fine at current scale | Deferred until scale requires it |
| TD-38 | Component library serves limited purpose | Consider removal vs update |

---

## 8. Biggest Gap: Untested Business Logic in UI Components

### The gap in numbers

| Metric | Value |
|--------|-------|
| Untested UI files with business logic | 21 |
| Untested business logic functions | 85+ |
| Estimated untested business logic LOC | ~3,000 |
| Functions with side effects (vault writes, events) | 78% |
| Identified potential data-loss scenarios | 8+ |
| Silent failure points | 12+ |

While 1,447 tests cover domain services, infrastructure, and pure utilities, **the UI layer contains significant business logic that has zero test coverage**. This is not about rendering or CSS — it's about data transforms, aggregation, validation, state machines, and pipeline execution embedded in UI components.

### 8.1 Critical risk: Functions where bugs cause data loss or corruption

#### `entityScanner.scanEntityFolder()` — backbone of ALL entity tabs

**File**: `src/ui/catalog/entityScanner.ts` (lines 77-151)

This single function powers the Flows, Systems, Actors, and Products tabs. It:
- Resolves doc folder paths via `getAbstractFileByPath()`
- Iterates children, filters `.md` files
- Reads frontmatter from `metadataCache`
- Maps frontmatter fields to `EntityEntry` objects via `fmString()` / `fmArray()`
- Collects non-conforming files for normalization

**What breaks**: If `scanEntityFolder()` silently drops entries (e.g., frontmatter parse failure, folder path mismatch), entire entities disappear from the UI with no error. Users see an empty tab and assume no data exists.

**Risk**: HIGH — this is the single point of failure for 4 major views.

#### `DomainsTab.scan()` and `ServicesTab.scan()` — aggregation logic

**Files**: `src/ui/catalog/DomainsTab.ts` (lines 46-134), `ServicesTab.ts` (lines 46-125)

These functions merge data from three sources: file-scanned entries, catalog-derived entries, and discovered entries. They:
- Aggregate events per domain/service from the catalog
- Merge metadata (descriptions, linked services/domains)
- Check Area doc existence for "Mark as Area" state
- Apply visibility settings to filter results

**What breaks**: Incorrect merge logic (e.g., duplicate domain names from different sources, missing events from catalog) produces wrong cross-reference counts. The "2 events" badge shows "0" silently.

#### `ImportsTab.runImportWithFeedback()` — import execution

**File**: `src/ui/hub/ImportsTab.ts` (lines 458-539)

Executes the CSV → vault import pipeline with real-time progress tracking:
- Subscribes to `dataExchange.import.progress` events
- Merges custom properties into import config
- Handles completion/failure with UI state transitions

**What breaks**: If the event subscription races with import completion, progress callbacks fire after the modal closes. If custom properties merge overwrites user-specified column mappings, imported notes have wrong frontmatter.

#### `PipelinePreview.run()` — preview computation with dedup

**File**: `src/ui/hub/pipelines/PipelinePreview.ts` (lines 31-135)

Computes a merge preview before executing a pipeline:
- Reads source CSV, parses merge keys
- Checks vault for existing files by merge key
- Deduplicates entries with matching keys
- Filters out empty/blank merge keys

**What breaks**: If dedup logic has an off-by-one (e.g., case-insensitive matching when keys are case-sensitive), the preview shows "5 new, 0 updates" but execution creates duplicates. The preview becomes misleading rather than protective.

#### `ConfigurePage.ts` external/vault toggle — path conversion

**File**: `src/ui/export/ConfigurePage.ts` (lines 99-168)

Toggles between vault-relative and filesystem-absolute paths:
- Vault → external: prepends vault base path to relative path
- External → vault: strips vault base path prefix

**What breaks**: Switching modes loses the folder component of the path. User selects "Reports/Q1" in vault mode, switches to external, path becomes `C:\vault\Reports\Q1`, switches back — path may resolve to wrong location if vault base path doesn't perfectly round-trip.

#### `PipelineSourceModal.parseCsv()` — merge key fuzzy matching

**File**: `src/ui/PipelineSourceModal.ts` (lines 221-269)

Normalizes merge keys by stripping underscores, spaces, and dashes for fuzzy column matching:
- Parses CSV header row
- Normalizes each column name: `remove_underscores` → `removeunderscores`
- 3-way sync between source columns, target columns, and merge key

**What breaks**: Fuzzy matching creates false positives: columns named `first_name` and `firstname` would match when they shouldn't. This silently maps wrong columns during merge operations.

### 8.2 High risk: Functions where bugs cause silent failures or wrong results

#### `csvUtils.ts` — 5 pure functions, 0 tests

**File**: `src/ui/csv/csvUtils.ts`

| Function | Risk |
|----------|------|
| `splitCsvLine()` | Incorrect CSV parsing with quoted fields, embedded commas |
| `detectDelimiter()` | Wrong delimiter detection → entire CSV misread |
| `generateBaseYaml()` | Malformed YAML frontmatter in generated `.base` files |
| `getBaseFilename()` | Wrong filename extraction → file not found |
| `formatRelativeTime()` | Display-only, low risk |

**This is the highest-ROI testing target** — 5 pure functions with zero dependencies, trivially testable, and 3 of them directly affect data integrity.

#### `helpers.ts:getVisibleEntries()` — category/system filtering

**File**: `src/ui/catalog/helpers.ts` (lines 244-265)

Complex filtering logic combining category visibility settings, system event tags, and user toggle state. **What breaks**: A filtering bug hides events that should be visible, or shows events that should be hidden — users see inconsistent counts between tabs.

#### `EventLogView.subscribe()` — wildcard event handler

**File**: `src/ui/EventLogView.ts` (lines 294-327)

Multi-stage filtering pipeline on the wildcard event stream:
- Stage 1: Skip `log.*` events (recursion guard)
- Stage 2: Apply type filter
- Stage 3: Apply path filter
- Stage 4: Deduplicate by event key

**What breaks**: If the recursion guard regex is too broad, legitimate events matching `log.*` patterns get silently dropped.

#### `SourcesExportsGrid.ts` — conflict detection

**File**: `src/ui/hub/pipelines/SourcesExportsGrid.ts` (lines 336-378)

Detects when multiple pipeline sources target the same export path:
- Iterates all sources × all exports
- Checks path overlap

**What breaks**: Incomplete conflict detection allows two pipelines to write the same file, with last-write-wins data loss.

#### `CsvDataSnapshot.ts` — filter/sort state machine

**File**: `src/ui/csv/CsvDataSnapshot.ts` (lines 110-224)

Interactive filter + sort state with column visibility:
- Filters applied → rows disappear
- Column hidden → sort state on that column becomes orphaned
- Filter reset → must restore correct row count

**What breaks**: Sort state referencing a hidden column causes silent mis-sorting. Filter state accumulates across resets, making "Reset All" not actually reset.

### 8.3 Risk summary by tier

| Tier | Functions | Example | Consequence |
|------|-----------|---------|-------------|
| **Critical** (data loss) | 6 | `entityScanner.scanEntityFolder()`, `PipelinePreview.run()`, `parseCsv()` | Entries vanish, duplicates created, wrong columns merged |
| **High** (silent wrong results) | 8 | `csvUtils.splitCsvLine()`, `getVisibleEntries()`, conflict detection | CSV misread, events hidden, file overwrites |
| **Medium** (degraded UX) | 12+ | `formatRelativeTime()`, progress tracking, sort state | Wrong display, stale UI, cosmetic errors |

### 8.4 Recommended testing priority

| Priority | Target | Tests | ROI |
|----------|--------|-------|-----|
| 1 | `csvUtils.ts` (5 pure functions) | ~30 | Highest — zero deps, data integrity |
| 2 | `entityScanner.scanEntityFolder()` | ~15 | High — backbone of 4 tabs, mock metadataCache |
| 3 | `DomainsTab.scan()` / `ServicesTab.scan()` | ~20 | High — aggregation correctness |
| 4 | `PipelinePreview.run()` | ~10 | High — prevents duplicate creation |
| 5 | `helpers.ts:getVisibleEntries()` | ~10 | Medium — filtering correctness |
| 6 | `CsvDataSnapshot` filter/sort | ~15 | Medium — state machine integrity |

Priorities 1-3 cover the critical risk tier with ~65 tests. All can run in `happy-dom` environment using the existing `obsidian-stub` polyfills.

---

## 9. Conclusion

The Flowti IBDE plugin is in **strong shape** after the Tech Debt Sprint. All high-severity items are resolved. The 10 remaining open items are medium or low severity, with none blocking feature development.

**Biggest improvements since last review:**
- Test suite grew from 854 → 1,447 tests (+70%)
- High-severity items: 1 → 0
- Resolved items: 16 → 27
- 10 flow integration tests now cover all documented user journeys
- Error handling, release strategy, and UI testing patterns all have established conventions

**Biggest remaining gap:**
The UI layer contains ~3,000 LOC of untested business logic across 21 files (Section 8). Six critical-risk functions — led by `entityScanner.scanEntityFolder()` which is the backbone of 4 entity tabs — have zero test coverage and could silently lose or corrupt data. The highest-ROI fix is testing `csvUtils.ts` (5 pure functions, ~30 tests, zero dependencies) and `entityScanner.ts` (~15 tests with mocked metadataCache).

**Top priorities for next sprint:**
1. TD-41 (small): Fix the dedup race in EventDefinitionService — a 10-line change with high correctness impact
2. `csvUtils.ts` + `entityScanner.ts` tests (~45 tests): Cover the two highest-risk untested pure/quasi-pure modules
3. TD-40 (medium): Decide whether to wire `settings.entityPaths` or remove the dead configuration

The plugin's architecture is well-positioned for continued feature development, but the UI business logic testing gap (Section 8) should be addressed before adding more data-pipeline features.
