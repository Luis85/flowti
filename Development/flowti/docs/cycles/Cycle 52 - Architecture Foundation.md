---
type: DevelopmentCycle
feature: "[[Backlog Refinement - Post Cycle 48]]"
stage: in-progress
cycle: 52
release_anchor:
  - "Theme 5: Architecture — Invest in the Platform"
pbis:
  - "TD-49: Layout abstraction layer"
  - "TD-50: Workspace shell layout"
  - "TD-51: Component registry and manifest"
  - "TD-127: Performance observability"
bugs: []
tech_debt:
  - TD-49
  - TD-50
  - TD-51
  - TD-127
estimated_increments: 6
estimated_tests: 103
pre_cycle_tests: 5643
pre_cycle_suites: 243
---

# Cycle 52 — Architecture Foundation

## Release Anchor Theme

- **Theme 5: Architecture — Invest in the Platform** — Pay now, move faster later.

## Situation Assessment

### Codebase Health
- **Production LOC**: ~27,000+ across 11 domain services
- **Tests**: 5,643 passing (243 suites), 0 failures
- **Build**: `npm run build` green — 9 generation scripts execute cleanly
- **Lint**: `npm run check` → 0 errors, 0 warnings
- **Previous cycle**: C51 closed (stage: `done`, 2026-02-27), 5 increments delivered, 94 tests added, TASM 34.7/35

### Hub Framework Current State
- **BaseHubView**: 373 LOC abstract base class providing shell lifecycle (wrapper → top bar → tab bar → split layout → render scheduling → cleanup)
- **5 Hub subclasses**: EventCatalogView (746 LOC), DataExchangeHubView (768 LOC), TrainHubView (500 LOC), UserHubView (477 LOC), AnalyticsHubView (446 LOC) — total ~3,310 LOC
- **Average subclass**: ~546 LOC. Each manually constructs DOM layouts and duplicates tab/chrome management
- **SplitLayout helper**: `buildSplitLayout()` in `src/ui/catalog/helpers.ts` — used by BaseHubView, provides master/detail regions
- **UI components**: 183 .ts files under `src/ui/` across 10+ subdirectories — no component registry, no manifest, no programmatic discovery

### Storage & Performance
- **TypedStorage**: 87 LOC — atomic load/save via PathMutex, type-safe, no Obsidian coupling. No timing instrumentation.
- **Service startup**: 20+ services initialized sequentially in `main.ts onLayoutReady()` — no per-service timing, no total startup measurement
- **`data.json` domains**: Settings, Subscriptions, EventDefinitions, Inbox (capped 500), Session, Analytics, Signal — growing with usage
- **No `perf.*` events**: Zero performance instrumentation in the event system. Event trace skips `log.*` events; would need to skip `perf.*` if trace becomes noisy.

### Open Issues
- TD-49 (high): Layout abstraction layer — no declarative layout system
- TD-50 (high): Workspace shell — no shared chrome, each view duplicates tab management
- TD-51 (medium): Component registry — no manifest, no validation, no dynamic resolution
- TD-127 (medium): Performance observability — no instrumentation for storage, startup, or queries
- No critical bugs open
- No release blockers targeting C52

## Cycle Overview

Cycle 52 is a pure architecture investment cycle. No new user-facing features — instead, we build the Hub Framework foundation that will accelerate all future UI work. The sequential dependency chain TD-49 → TD-50 → TD-51 has been the highest-severity open architecture debt since it was identified. Additionally, TD-127 (performance observability) must be in place before any optimization work in future cycles.

This is the "sharpen the axe" cycle. Every Hub view added after this cycle will benefit from declarative layouts, shared workspace chrome, and a component registry.

## User Pains (Developer Experience)

1. **Each view manually constructs DOM layouts** — No shared layout abstraction. Adding a new view requires ~80 LOC of boilerplate layout code (TD-49).
2. **No shared workspace chrome** — Each Hub view duplicates tab management, ribbon, and content area construction. 5 views × ~80 LOC = ~400 LOC of duplicated chrome (TD-50).
3. **Components are directly imported with no registry** — No component-manifest.json, no validation, no dynamic resolution (TD-51).
4. **No performance instrumentation** — No way to know if startup is degrading, queries are slowing, or storage is growing. Optimization decisions are based on intuition, not data (TD-127).

## Cycle Goals

1. **Build ILayout interface and LayoutRegistry** with 4 layout implementations
2. **Extract WorkspaceShell** with shared ribbon, tab bar, and content area
3. **Create component-manifest.json and ComponentRegistry** for validation and dynamic resolution
4. **Implement performance observability** with `perf.*` events for storage, startup, and query timing

## Scope

### In Scope
- TD-49: ILayout interface, LayoutRegistry, 4 layout types (single, split, tabbed, stacked)
- TD-50: WorkspaceShell extraction from BaseHubView (shared chrome)
- TD-51: component-manifest.json, ComponentRegistry, validateComponent()
- TD-127: perf.* events (perf.storage.load, perf.storage.save, perf.startup.domain, perf.query.execute)

### Out of Scope
- TD-52: Declarative tab definitions (depends on TD-49/50/51; stretch goal or C53+)
- Migration of existing views to new layout system (migration comes after framework is proven)
- Performance optimization (this cycle adds observability only; optimize based on data later)
- UI changes visible to end users

## Increments

### Inc 1: ILayout Interface and Layout Types (TD-49a)
**Theme**: Architecture
**Effort**: Large
**Estimate**: +250 LOC production, +120 LOC test, ~25 tests

Define the layout abstraction layer:
- `ILayout` interface: `{ type, mount(container), getRegion(name), dispose() }`
- `SinglePaneLayout`: full-width content area — region: `content`
- `SplitLayout`: master-detail with configurable split ratio — regions: `primary`, `inspector`
- `TabbedLayout`: tab bar + content area with tab switching — regions: `tabs`, `content`
- `StackedLayout`: vertical stack of content sections — regions: `sections[]`
- `LayoutRegistry`: register, resolve, validate layout types by name
- All layouts are pure DOM — no Obsidian API dependency

**Acceptance Criteria**:
- [ ] ILayout interface defined with mount/getRegion/dispose contract
- [ ] 4 layout implementations with consistent API
- [ ] LayoutRegistry with register/resolve/validate
- [ ] Each layout independently testable (happy-dom)
- [ ] Unit tests for all layouts and registry
- [ ] `npm test` green

**Test Intent**: ~25 tests covering: ILayout contract compliance per layout (4×3 = 12 mount/getRegion/dispose), LayoutRegistry register/resolve/validate/unknown (4), SinglePane region content (1), SplitLayout configurable ratio (2), TabbedLayout tab switching (2), StackedLayout section ordering (2), dispose cleans up DOM nodes (2).

**Documentation Intent**: JSDoc on ILayout interface and all implementations. Architecture seam documented in this cycle plan.

**Architecture Seams**:
- New directory: `src/ui/layouts/`
- New: `src/ui/layouts/types.ts` — `ILayout`, `LayoutFactory`, `RegionMap` interfaces
- New: `src/ui/layouts/LayoutRegistry.ts` — registry mapping names → factories
- New: `src/ui/layouts/SinglePaneLayout.ts`, `SplitLayout.ts`, `TabbedLayout.ts`, `StackedLayout.ts`
- New: `src/ui/layouts/index.ts` — barrel export
- No existing files modified (additive only)

### Inc 2: Layout Integration Tests (TD-49b)
**Theme**: Architecture
**Effort**: Small
**Estimate**: +0 LOC production, +80 LOC test, ~12 tests

Verify layouts work with real Hub view scenarios:
- Integration tests: render each layout type with mock content injected into regions
- Verify layout switching (e.g., single → split → tabbed) on same container
- Verify layout disposal cleans up DOM correctly (childNodes.length === 0)
- Content persistence: confirm content survives tab switch round-trip

**Acceptance Criteria**:
- [ ] Integration tests for each layout type with content
- [ ] Layout switching tests
- [ ] Disposal verification (no leaked DOM nodes)
- [ ] `npm test` green

**Test Intent**: ~12 tests covering: render content into each layout's regions (4), layout switch on same container (2), disposal cleans up all DOM children (4), content injected into region survives getRegion re-call (2).

**Documentation Intent**: None (test-only increment).

**Architecture Seams**:
- New: `tests/ui/layouts/layouts.integration.test.ts`
- No production files modified

### Inc 3: WorkspaceShell Extraction (TD-50)
**Theme**: Architecture
**Effort**: Large
**Estimate**: +200 LOC production (net: ~120 new + ~80 extracted from BaseHubView), +100 LOC test, ~18 tests

Extract shared workspace chrome from BaseHubView:
- `WorkspaceShell` class: ribbon area (hub icon + name + action buttons), tab bar, content area, optional status bar
- Shell renders chrome once; content area delegates to ILayout from Inc 1
- Shell accepts `ShellConfig`: hubName, hubIcon, tabs (TabDef[]), onTabChange callback
- BaseHubView refactored to instantiate WorkspaceShell internally — subclass API unchanged
- Tab bar logic (~80 LOC) extracted from BaseHubView into WorkspaceShell
- Existing Hub views continue to work without code changes (internal refactor)

**Acceptance Criteria**:
- [ ] WorkspaceShell class with ribbon, tab bar, content area, status bar
- [ ] BaseHubView uses WorkspaceShell internally
- [ ] All 5 existing Hub views pass existing tests without changes
- [ ] Tab switching works through WorkspaceShell
- [ ] Unit tests for WorkspaceShell rendering
- [ ] `npm test` green

**Test Intent**: ~18 tests covering: shell mount creates expected DOM structure (3), tab bar renders from TabDef[] (2), tab switching triggers callback and swaps active class (3), ribbon renders hub icon and name (2), action button slot receives content (1), dispose cleans up all DOM and listeners (2), BaseHubView integration (shell used internally, existing API unchanged) (3), edge cases (0 tabs, 1 tab) (2).

**Documentation Intent**: JSDoc on WorkspaceShell and ShellConfig. Update this cycle plan with final BaseHubView LOC delta.

**Architecture Seams**:
- New directory: `src/ui/shell/`
- New: `src/ui/shell/WorkspaceShell.ts` — shell class (~150 LOC)
- New: `src/ui/shell/types.ts` — `ShellConfig`, `ShellTab` interfaces
- New: `src/ui/shell/index.ts` — barrel export
- Modified: `src/ui/BaseHubView.ts` — refactor internal chrome construction to use WorkspaceShell (net LOC reduction ~80)
- **Critical constraint**: BaseHubView's public/protected API must NOT change — subclasses must compile and pass tests without modification

### Inc 4: Component Registry (TD-51)
**Theme**: Architecture
**Effort**: Medium
**Estimate**: +120 LOC production, +70 LOC test, ~15 tests

Create a component registry with manifest validation:
- `component-manifest.json`: declare component id, name, category, description, layout compatibility, emits (events), accepts (context)
- `ComponentRegistry`: `has(id)`, `get(id)`, `getAll()`, `getByCategory(cat)`, `validate(id)`
- Manifest populated with at least 10 existing components (CatalogDashboard, ReportsTab, EventsTab, DomainsTab, ServicesTab, QueriesTab, DashboardsTab, TrainBranchesTab, InboxTab, UserDashboard)
- Registry is read-only at runtime — populated from JSON at build/import time
- Does not require migration of existing components (opt-in registration)

**Acceptance Criteria**:
- [ ] component-manifest.json schema defined
- [ ] ComponentRegistry with has/get/getAll/getByCategory/validate
- [ ] Manifest includes at least 10 existing components
- [ ] Validation catches missing or misconfigured components
- [ ] Unit tests for registry and validation
- [ ] `npm test` green

**Test Intent**: ~15 tests covering: has() returns true for registered / false for unknown (2), get() returns metadata / returns null for unknown (2), getAll() returns full list (1), getByCategory() filters correctly (2), validate() passes for valid / fails for missing / fails for invalid schema (3), manifest parsing from JSON (2), edge cases (empty manifest, duplicate IDs) (3).

**Documentation Intent**: JSDoc on ComponentRegistry. Manifest schema documented inline in JSON.

**Architecture Seams**:
- New directory: `src/ui/components/`
- New: `src/ui/components/component-manifest.json` — JSON manifest (~10 entries)
- New: `src/ui/components/ComponentRegistry.ts` — registry class (~80 LOC)
- New: `src/ui/components/types.ts` — `ComponentMeta` interface
- New: `src/ui/components/index.ts` — barrel export
- No existing files modified (additive, opt-in)

### Inc 5: Performance Observability — Events (TD-127a)
**Theme**: Architecture
**Effort**: Medium
**Estimate**: +80 LOC production, +60 LOC test, ~15 tests

Add performance instrumentation via `perf.*` events:
- `perf.storage.loaded`: emit on storage load with `key`, `durationMs`, `sizeBytes`
- `perf.storage.saved`: emit on storage save with `key`, `durationMs`, `sizeBytes`
- `perf.startup.service`: emit per service initialization with `service`, `durationMs`
- `perf.startup.total`: emit on full startup completion with `durationMs`, `serviceCount`
- `perf.query.executed`: emit on analytics query with `queryId`, `durationMs`, `sourceRows`, `resultRows`
- All perf events carry `timestamp` and are tagged `["system"]`
- Event trace wildcard listener must skip `perf.*` (same pattern as `log.*` skip)

**Acceptance Criteria**:
- [ ] 5 perf.* event types defined in events.ts with typed payloads
- [ ] Storage load/save instrumented with `performance.now()` timing
- [ ] Service startup instrumented with per-service timing in `onLayoutReady()`
- [ ] Query execution instrumented with timing in AnalyticsService
- [ ] perf.* events registered in catalog.ts with `["system"]` tag
- [ ] Event trace skips `perf.*` events (no infinite recursion)
- [ ] Unit tests for timing emission
- [ ] `npm test` green

**Test Intent**: ~15 tests covering: TypedStorage.load emits perf.storage.loaded with key/duration/size (3), TypedStorage.save emits perf.storage.saved (3), startup wrapper emits perf.startup.service per service (2), startup wrapper emits perf.startup.total with count (2), AnalyticsService emits perf.query.executed (2), event trace skips perf.* (1), perf events have system tag (2).

**Documentation Intent**: Add Performance event category to Event Catalog (auto-generated). JSDoc on new event payloads.

**Architecture Seams**:
- New: `src/infrastructure/events/performanceEvents.ts` — `PerformanceEventMap` interface
- Modified: `src/infrastructure/events/events.ts` — compose `PerformanceEventMap` into `FlowtiEventMap`
- Modified: `src/utils/TypedStorage.ts` — wrap load/save with `performance.now()` timing (~15 LOC)
- Modified: `src/main.ts` — wrap each service `.load()` in `onLayoutReady()` with timing (~20 LOC)
- Modified: `src/domain/analytics/AnalyticsService.ts` — emit perf.query.executed (~5 LOC)
- Modified: `src/infrastructure/events/catalog.ts` — register 5 perf.* events with system tag
- Modified: `src/infrastructure/events/EventBus.ts` — skip `perf.*` in wildcard trace (1 LOC)

### Inc 6: Performance Observability — Aggregator (TD-127b)
**Theme**: Architecture
**Effort**: Medium
**Estimate**: +180 LOC production, +100 LOC test, ~18 tests

Collect, aggregate, and expose performance metrics:
- `PerfAggregator` service: listens to `perf.*` events, maintains rolling window of last 20 measurements per metric
- Exposes `getStartupSummary()`: total, per-service breakdown, p50/p95/max
- Exposes `getStorageSummary()`: per-key load/save times, sizes
- Exposes `getQuerySummary()`: p50/p95/max query times, result sizes
- Threshold alerting: emit `perf.alert` if startup total exceeds configurable limit (default: 5000ms)
- Persists last 20 startup measurements in storage for cross-session trend detection

**Performance Report Generation** (build pipeline):
- `scripts/generate-performance-report.mjs`: generates a timestamped Performance Report vault note on every distribution build
- Report includes key metrics: startup total (p50/p95/max), per-service startup breakdown, storage load/save times and sizes, query execution percentiles, data.json size trend, alert threshold status
- Follows existing report pattern: YAML frontmatter (type: PerformanceReport, queryable fields) + markdown body with summary tables
- Output: `docs/reports/performance/Performance Report YYYY-MM-DD HH-mm.md`
- Wired into `esbuild.config.mjs` `generateReportNotes()` and `package.json` `generate:reports`
- Pure function generator: `src/domain/docs/performanceReportGenerator.ts` — transforms PerfAggregator summaries into markdown

**Acceptance Criteria**:
- [ ] PerfAggregator collects perf.* events into rolling window
- [ ] Startup breakdown queryable (total + per-service)
- [ ] Storage metrics queryable (per-key sizes and timings)
- [ ] Query timing queryable (p50, p95, max)
- [ ] Historical trend data persisted (last 20 measurements)
- [ ] Alert emitted if startup exceeds threshold
- [ ] `scripts/generate-performance-report.mjs` generates timestamped vault note with key metrics
- [ ] Performance report wired into build pipeline (`generateReportNotes()` in esbuild.config.mjs)
- [ ] Unit tests for aggregation, percentile calculation, alerting, and report generation
- [ ] `npm test` green

**Test Intent**: ~18 tests covering: aggregator collects perf.startup.service events (2), getStartupSummary returns total + per-service breakdown (2), getStorageSummary returns per-key data (2), getQuerySummary computes p50/p95/max (3), rolling window caps at 20 entries (1), threshold alert fires when exceeded / does not fire below threshold (2), persistence round-trip (load → emit → save → load) (2), empty aggregator returns safe defaults (1), performance report generator produces valid frontmatter (1), report includes startup/storage/query sections (2).

**Documentation Intent**: JSDoc on PerfAggregator. Performance Report auto-generated on each build. Performance observability noted in this cycle's retrospective.

**Architecture Seams**:
- New: `src/infrastructure/services/PerfAggregator.ts` — aggregation service (~100 LOC)
- New: `src/infrastructure/services/perfTypes.ts` — `StartupSummary`, `StorageSummary`, `QuerySummary` interfaces
- New: `src/domain/docs/performanceReportGenerator.ts` — pure function report generator (~50 LOC)
- New: `scripts/generate-performance-report.mjs` — build script (~40 LOC)
- Modified: `src/main.ts` — instantiate PerfAggregator, pass EventBus + storage (~10 LOC)
- Modified: `src/infrastructure/events/performanceEvents.ts` — add `perf.alert` event type
- Modified: `src/infrastructure/events/catalog.ts` — register `perf.alert`
- Modified: `esbuild.config.mjs` — add performance report to `generateReportNotes()` scripts array
- Modified: `package.json` — add `generate-performance-report.mjs` to `generate:reports` chain

## Dependency Graph

```
Inc 1 (Layouts)       ──→ Inc 2 (Layout Tests) ──→ Inc 3 (WorkspaceShell)
Inc 4 (Component Reg) ──→ Independent (but can use layouts for validation)
Inc 5 (Perf Events)   ──→ Inc 6 (Perf Dashboard)
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Layout abstraction is over-engineered for current 5 views | Medium | Start with 2 layout types (split, tabbed); add others only when needed |
| WorkspaceShell extraction breaks existing Hub views | High | Refactor BaseHubView internals only; external API unchanged |
| Performance instrumentation adds overhead | Low | Use conditional emission; skip in production if perf.enabled=false |
| Component manifest maintenance burden | Low | Start with 10 components; expand organically as new components are added |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~103 (Inc 1: 25, Inc 2: 12, Inc 3: 18, Inc 4: 15, Inc 5: 15, Inc 6: 18) |
| Post-cycle tests | ~5,746 |
| Production LOC added | ~830 |
| BaseHubView LOC reduction | ~80 LOC (chrome extracted to WorkspaceShell) |
| Layout types | 4 implementations |
| Component manifest entries | ≥10 |
| Perf events | 6 types instrumented (5 metrics + 1 alert) |
| Performance report | Auto-generated on every distribution build with key metrics |
| Tech debt resolved | TD-49, TD-50, TD-51, TD-127 |
| Increments | 6 |

## Deferred Items

| Item | Target | Rationale |
|------|--------|-----------|
| TD-52: Declarative tab definitions | C53+ | Depends on TD-49/50/51 delivered in this cycle |
| Migration of existing views to new layout system | Gradual, per-view | Framework must be proven before migration |
| Performance optimization (TD-12, TD-44, TD-48, TD-66, TD-69) | Post-C52, data-driven | This cycle adds observability; optimize only when data shows bottlenecks |
| Component hot-reload | Not planned | Only if development workflow demands it |
| Performance dashboard UI | Future cycle | PerfAggregator exposes data; build-time Performance Report covers key metrics; interactive UI visualization can use existing Analytics Hub queries |
| Layout theme/style system | Future cycle | CSS architecture (C48) handles styling; layouts are structural only |

## Inbox Signals

| Inbox Item | Decision | Rationale |
|-----------|----------|-----------|
| Hub Framework foundation items (TD-49, TD-50, TD-51) | **Addressed** | Core deliverables of this cycle |
| Performance observability (TD-127) | **Addressed** | Inc 5-6 add instrumentation and aggregation |
| Component Showcase view (TD-38) | **Partially enabled** | Component registry (Inc 4) enables programmatic discovery; showcase UI deferred |
| Declarative tab definitions (TD-52) | **Deferred** | Depends on this cycle's deliverables; earliest C53 |
