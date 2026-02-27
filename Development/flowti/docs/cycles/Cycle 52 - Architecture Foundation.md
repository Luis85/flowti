---
type: DevelopmentCycle
feature: "[[Backlog Refinement - Post Cycle 48]]"
stage: planning
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
---

# Cycle 52 — Architecture Foundation

## Release Anchor Theme

- **Theme 5: Architecture — Invest in the Platform** — Pay now, move faster later.

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

Define the layout abstraction layer:
- `ILayout` interface: `{ type, render(container), dispose() }`
- `SinglePaneLayout`: full-width content area
- `SplitLayout`: master-detail with configurable split ratio
- `TabbedLayout`: tab bar + content area with tab switching
- `StackedLayout`: vertical stack of content sections
- `LayoutRegistry`: register, resolve, validate layout types
- All layouts are pure DOM — no Obsidian API dependency

**Acceptance Criteria**:
- [ ] ILayout interface defined with render/dispose contract
- [ ] 4 layout implementations with consistent API
- [ ] LayoutRegistry with register/resolve/validate
- [ ] Each layout independently testable (jsdom)
- [ ] Unit tests for all layouts and registry
- [ ] `npm test` green

### Inc 2: Layout Integration Tests (TD-49b)
**Theme**: Architecture
**Effort**: Small

Verify layouts work with real Hub view scenarios:
- Integration tests: render each layout type with mock content
- Verify layout switching (e.g., single → split → tabbed)
- Verify layout disposal cleans up DOM correctly
- Memory leak checks (dispose removes all listeners and DOM nodes)

**Acceptance Criteria**:
- [ ] Integration tests for each layout type with content
- [ ] Layout switching tests
- [ ] Disposal verification (no leaked DOM nodes)
- [ ] `npm test` green

### Inc 3: WorkspaceShell Extraction (TD-50)
**Theme**: Architecture
**Effort**: Large

Extract shared workspace chrome from BaseHubView:
- `WorkspaceShell` class: ribbon area, tab bar, content area, status bar
- Shell renders chrome once; content area delegates to ILayout
- BaseHubView refactored to use WorkspaceShell internally
- Existing Hub views continue to work without changes (shell is internal refactor)
- Tab bar logic extracted from BaseHubView into WorkspaceShell

**Acceptance Criteria**:
- [ ] WorkspaceShell class with ribbon, tab bar, content area, status bar
- [ ] BaseHubView uses WorkspaceShell internally
- [ ] All 5 existing Hub views pass existing tests without changes
- [ ] Tab switching works through WorkspaceShell
- [ ] Unit tests for WorkspaceShell rendering
- [ ] `npm test` green

### Inc 4: Component Registry (TD-51)
**Theme**: Architecture
**Effort**: Medium

Create a component registry with manifest validation:
- `component-manifest.json`: declare component id, name, category, layout compatibility
- `ComponentRegistry`: register, resolve, validate, list components
- `validateComponent(id)`: check component exists in manifest and has required exports
- Registry populated at startup from manifest
- Does not require migration of existing components (opt-in registration)

**Acceptance Criteria**:
- [ ] component-manifest.json schema defined
- [ ] ComponentRegistry with register/resolve/validate/list
- [ ] Manifest includes at least 10 existing components as examples
- [ ] Validation catches missing or misconfigured components
- [ ] Unit tests for registry and validation
- [ ] `npm test` green

### Inc 5: Performance Observability — Events (TD-127a)
**Theme**: Architecture
**Effort**: Medium

Add performance instrumentation via `perf.*` events:
- `perf.storage.load`: emit on storage load with duration_ms, key, size_bytes
- `perf.storage.save`: emit on storage save with duration_ms, key, size_bytes
- `perf.startup.domain`: emit per domain initialization with domain, duration_ms
- `perf.startup.total`: emit on full startup completion with duration_ms, domain_count
- `perf.query.execute`: emit on analytics query with query_id, duration_ms, result_count
- All perf events carry `timestamp` for timeline analysis

**Acceptance Criteria**:
- [ ] 5 perf.* event types defined in events.ts
- [ ] Storage load/save instrumented with timing
- [ ] Domain startup instrumented with per-domain timing
- [ ] Query execution instrumented with timing
- [ ] perf.* events visible in Event Log (not filtered by system event filter)
- [ ] Unit tests for timing accuracy
- [ ] `npm test` green

### Inc 6: Performance Observability — Dashboard (TD-127b)
**Theme**: Architecture
**Effort**: Medium

Make performance data queryable and visible:
- Performance summary tab in Analytics Hub (or Settings)
- Display: startup time (total + per-domain breakdown), storage sizes, query p50/p95
- Historical tracking: store last 10 startup timings for trend detection
- Alert threshold: warn if startup exceeds configurable limit (default: 5s)

**Acceptance Criteria**:
- [ ] Performance data queryable via analytics queries
- [ ] Startup breakdown visible (total + per-domain)
- [ ] Storage size tracking visible
- [ ] Query timing visible (p50, p95, max)
- [ ] Historical trend data stored (last 10 measurements)
- [ ] Alert fires if startup exceeds threshold
- [ ] Unit tests for aggregation and alerting logic
- [ ] `npm test` green

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
| New tests | ~100 |
| Post-cycle tests | ~5,685 |
| BaseHubView LOC reduction | ~80 LOC (chrome extracted to WorkspaceShell) |
| Layout types | 4 implementations |
| Perf events | 5 types instrumented |
| Tech debt resolved | TD-49, TD-50, TD-51, TD-127 |
| Increments | 6 |

## Deferred Items

- TD-52: Declarative tab definitions → depends on this cycle; earliest C53
- Migration of existing views to new layout system → gradual, per-view
- Performance optimization (TD-12, TD-44, TD-48, TD-66, TD-69) → data-driven, post-observability
- Component hot-reload → only if needed for development workflow
