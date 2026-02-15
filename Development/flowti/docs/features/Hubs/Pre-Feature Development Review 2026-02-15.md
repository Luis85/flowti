---
type: ReviewSession
session_type: ThreeAmigos
frequency: sprint_end
owner: Technical Architect
participants:
  - product: Product Owner (simulated)
  - engineering: Technical Architect (simulated)
  - ux_or_qa: QA Engineer (simulated)
date: 2026-02-15
related_hubs:
  - Event Catalog (System Hub)
  - Data Exchange (System Hub)
related_features:
  - "[[Hubs PRD]]"
  - "[[ADR-024 BaseHubView Shell Extraction]]"
  - "[[PBI-001 User Hub]]"
  - "[[PBI-003 Product Hub]]"
  - "[[PBI-004 Project Hub]]"

scores_product_value: 4
scores_architectural_integrity: 4
scores_event_discipline: 5
scores_data_model_integrity: 3
scores_ux_quality: 4
scores_performance_scalability: 5
scores_documentation_discipline: 4
scores_max_score: 35
scores_health_level: strong

drift_detected: true
refactor_required: true
immediate_action_required: false

summary: "Pre-feature development gap analysis for Phase 3 (User Hub) and Phase 4 (Domain Hubs). The BaseHubView foundation is solid and both System Hubs are migrated. However, 5 gaps remain before new Hubs can be built efficiently: (1) no cross-hub data aggregation mechanism, (2) no cross-hub navigation API, (3) EntityScanner coupled to CatalogComponentDeps, (4) no scoped hub pattern, (5) PRD's TD items significantly diverge from implemented architecture. 3 TDs should be closed as superseded, 2 need rewriting. Recommended refactoring: ~300 LOC of new infrastructure before starting PBI-001."
---

# Three Amigos Review Session

## 1. Purpose

This session is a **pre-feature development review** — a gap analysis between the Hubs PRD (approved, FRI 25/35) and the current codebase, performed before starting Phase 3 (User Hub) and Phase 4 (Domain Hubs).

Goals:
- Map PRD technical debt items to current architecture
- Identify what the PRD envisioned vs. what was actually built
- Determine concrete refactoring needed before new Hub development
- Classify each TD as: done, superseded, still needed, or needs rewriting
- Estimate effort for bridging gaps

---

# 2. Session Scope

### Hubs Reviewed
- [ ] User Hub ← next to build
- [ ] Product Hub ← Phase 4
- [ ] Services Hub
- [ ] Areas Hub
- [ ] Project Hub ← Phase 4
- [x] Event Catalog ← reference implementation
- [x] Data Exchange ← reference implementation

### Topics Reviewed
- PRD technical debt items (TD-49 through TD-55) vs. implemented architecture
- HubAdapter interface (PRD) vs. BaseHubView inheritance (reality)
- Cross-hub aggregation gap (User Hub prerequisite)
- EntityScanner/BaseEntityTab coupling to catalog-specific deps
- Scoped hub pattern (Domain Hub prerequisite)
- View registration consistency

---

# 3. PRD vs. Reality: Technical Debt Item Audit

## 3.1 TD-49: Layout Abstraction Layer

| Aspect | PRD Envisioned | Current Reality |
|--------|---------------|-----------------|
| Pattern | `LayoutRegistry` with 4 named layouts | `buildSplitLayout()` helper + BaseHubView shell |
| Layouts | `dashboard_grid`, `table`, `split_dock`, `session_focus` | dashboard + split_dock only (implicit, not named) |
| Registry | Runtime lookup by name | Direct function call |
| Validation | Layout manifest with required/optional regions | No manifest, no validation |

**Assessment: SUPERSEDED**

BaseHubView provides the layout abstraction in simpler form. The two layouts needed (dashboard grid + split dock) are built into the shell. No `table` or `session_focus` layout is needed until Phase 4 (Sessions).

**Recommendation**: Close TD-49. If `session_focus` is needed for PBI-002, create it as a one-off component — a layout registry for 3 layouts is premature.

---

## 3.2 TD-50: Workspace Shell Layout

| Aspect | PRD Envisioned | Current Reality |
|--------|---------------|-----------------|
| Pattern | Standalone `WorkspaceShell` class | `BaseHubView` abstract class extending `ItemView` |
| Shape | Composition (shell is a helper object) | Inheritance (shell IS the view) |
| API | `mount()`, `switchTab()`, `getActiveLayout()`, `dispose()` | `onOpen()`, `navigateTo()`, `scheduleRender()`, `onClose()` |
| Reusability | Hub-agnostic; receives config | Hub-agnostic via abstract methods + `TabDef[]` |

**Assessment: DONE (different form)**

BaseHubView delivers the same outcome: shared shell lifecycle for all Hubs. The shape differs (inheritance vs. composition), but ADR-024 documents why inheritance was chosen (tight coupling with Obsidian's `ItemView` lifecycle).

**Recommendation**: Close TD-50 as implemented via ADR-024.

---

## 3.3 TD-51: Component Registry

| Aspect | PRD Envisioned | Current Reality |
|--------|---------------|-----------------|
| Pattern | JSON manifest + `ComponentRegistry` class | Direct imports in orchestrator files |
| Validation | `hasComponent(name)`, manifest validation at startup | None (compile-time imports) |
| Scale assumption | 50+ components across 5+ hubs | ~30 components across 2 hubs |

**Assessment: PREMATURE — defer**

At current scale (2 hubs, 30 components), a runtime registry adds complexity without benefit. TypeScript's type system and direct imports provide sufficient validation. Re-evaluate when component count exceeds 50 or when plugin API extensibility is needed.

**Recommendation**: Keep TD-51 open but deprioritize. Re-evaluate at Phase 4 completion.

---

## 3.4 TD-52: Declarative Tab Definitions

| Aspect | PRD Envisioned | Current Reality |
|--------|---------------|-----------------|
| Pattern | JSON `TabDefinition` with `layout_ref`, `bindings`, `regions` | `TabDef[]` array with `{ id, label, icon, searchPlaceholder }` |
| Validation | Schema validation against layout + component manifests | None (tab existence verified by `onTabRender` switch) |
| Complexity | `TabRenderer` mounts layout and populates regions | Orchestrator directly calls component render methods |

**Assessment: PREMATURE — defer**

Current `TabDef` provides what hubs need: tab bar rendering + navigation. The declarative binding/region system would require LayoutRegistry + ComponentRegistry (TD-49, TD-51) which are both deferred. Hardcoded tab arrays work well for <10 hubs.

**Recommendation**: Keep TD-52 open but deprioritize. The current `TabDef` interface is sufficient.

---

## 3.5 TD-53: Shared UI Primitive Library

| Aspect | PRD Envisioned | Current Reality |
|--------|---------------|-----------------|
| Pattern | Extracted UI primitives (buttons, badges, cards, inputs) | `StatCard.ts` exists; rest uses CSS classes inline |
| Scale | Full library for consistency across hubs | Ad-hoc but consistent via shared CSS class naming |

**Assessment: PARTIALLY ADDRESSED**

`StatCard` (`renderStatGrid()`) is shared between both dashboards. CSS classes (`ft-card`, `ft-badge`, `ft-btn`, etc.) provide visual consistency without a formal component library. The inline style cost is minimal.

**Recommendation**: Close TD-53. Extract primitives organically when duplication appears (as was done with StatCard). No upfront library needed.

---

## 3.6 TD-54: Event Catalog Hub Migration

**Assessment: DONE**

EventCatalogView extends BaseHubView<CatalogTab>. Shell code extracted. 864 → 723 LOC. 8 tabs + 13 components preserved. Zero test regression.

The migration used inheritance instead of the PRD's adapter pattern. This is simpler and works because EventCatalogView owns its data directly (no need for an intermediary adapter).

**Recommendation**: Close TD-54.

---

## 3.7 TD-55: Data Exchange Hub Migration

**Assessment: DONE**

DataExchangeHubView extends BaseHubView<DXTab>. Shell code extracted. 556 → 477 LOC. Gained tab bar for UX consistency. Zero test regression.

**Recommendation**: Close TD-55.

---

# 4. Gap Analysis: What's Missing for New Hubs

## Gap 1: No Cross-Hub Data Aggregation (blocks PBI-001)

**Severity: HIGH — blocks User Hub**

The User Hub (PBI-001) requires a "cross-hub summary" that aggregates dashboard data from all registered hubs. Currently, no mechanism exists for one hub to query another hub's data.

**What the PRD envisioned**: `HubAdapter.getDashboardData()` called by UserHubAdapter via a hub registry.

**What exists**: Each hub renders its own dashboard internally. No external API.

**Minimum viable solution** (~100 LOC):

```typescript
// src/domain/hub/types.ts
interface HubDashboardProvider {
    getHubId(): string;
    getDisplayName(): string;
    getIcon(): string;
    getSummary(): HubSummary;
}

interface HubSummary {
    stats: Array<{ label: string; value: number; icon: string }>;
    healthLevel: "healthy" | "warning" | "error";
    actionItemCount: number;
}

// src/domain/hub/HubRegistry.ts
class HubRegistry {
    private providers = new Map<string, HubDashboardProvider>();
    register(provider: HubDashboardProvider): void;
    unregister(hubId: string): void;
    getAll(): HubDashboardProvider[];
    get(hubId: string): HubDashboardProvider | undefined;
}
```

Both System Hubs implement `HubDashboardProvider` (returning their existing stat counts). User Hub queries the registry. EventBus not needed — direct method calls.

**Effort**: ~150 LOC (types + registry + 2 provider implementations)

---

## Gap 2: No Cross-Hub Navigation API (blocks PBI-001)

**Severity: MEDIUM — blocks User Hub inbox**

User Hub inbox items need to navigate to specific locations in other hubs (e.g., "failed import" → Data Exchange > Imports > specific config). Currently, cross-hub navigation requires knowing each hub's internal view type and state shape.

**What exists**:
- `openEventInCatalog(app, eventType)` in `src/ui/hub/helpers.ts` — opens Event Catalog and navigates to an event
- Each hub has `navigateTo(page)` on BaseHubView (protected, not externally callable)

**Minimum viable solution** (~50 LOC):

```typescript
// src/domain/hub/HubRegistry.ts (extend)
class HubRegistry {
    openHub(app: App, hubId: string, tabId?: string): void {
        // Activate the hub's view leaf, optionally navigate to tab
    }
}
```

This formalizes the pattern already used by `openEventInCatalog()`. Each hub registers its Obsidian view type; the registry activates the leaf and sends a navigation event.

**Effort**: ~50 LOC (registry method + navigation event)

---

## Gap 3: EntityScanner Coupled to CatalogComponentDeps (friction for Domain Hubs)

**Severity: MEDIUM — friction for PBI-003/004**

`EntityScanner` and `BaseEntityTab` both require `CatalogComponentDeps`, which includes catalog-specific dependencies (`vaultQuery`, `workspace`, `getEntityFolder`, `createEntity`). Domain Hubs (Product, Project) would need equivalent deps but can't use `CatalogComponentDeps` directly.

**What exists**:
- `EntityScanner` requires `CatalogComponentDeps` for `deps.app.vault`, `deps.getEntityFolder()`, `deps.vaultQuery`
- `BaseEntityTab` requires `CatalogComponentDeps` for navigation, state, rendering

**Two options**:

**(A) Extract generic `EntityScanDeps` interface** (~30 LOC):
```typescript
interface EntityScanDeps {
    app: App;
    vaultQuery: IVaultQueryService;
    getEntityFolder: (entity: EntityType) => string;
    getDiscoveredEvents: () => DiscoveredEvent[];
}
```
Both `CatalogComponentDeps` and future `DomainHubComponentDeps` would extend this.

**(B) Domain Hubs don't use EntityScanner** — they scan different file types (FeatureTemplate, WorkItemTemplate) with different frontmatter shapes. They'd implement their own scanning.

**Recommendation**: Option B. Product/Project hubs scan their own folder structures with domain-specific logic. Trying to generalize EntityScanner for different frontmatter schemas adds complexity. The scanner is 152 LOC — duplicating the pattern is cheaper than abstracting it.

**Effort**: 0 LOC refactoring. Domain hubs will have their own scan methods (~80 LOC each).

---

## Gap 4: No Scoped Hub Pattern (friction for Domain Hubs)

**Severity: MEDIUM — friction for PBI-003/004**

Product Hub and Project Hub need to be "scoped" to a specific entity: which product? which project? Current System Hubs are global singletons — there's one Event Catalog and one Data Exchange Hub.

**What the PRD envisioned**: `Hub.domain_name: string` field that scopes a hub instance.

**What exists**: `BaseHubView` has no concept of scope. View state is internal.

**Options**:

**(A) Obsidian view state**: Use `getState()` / `setState()` on `ItemView` to persist scope.
```typescript
// In ProductHubView
getState() { return { productPath: this.productPath }; }
setState(state) { this.productPath = state.productPath; await this.onOpen(); }
```
This is Obsidian's built-in mechanism for view state persistence across workspace saves.

**(B) Hub picker modal**: When opening a Domain Hub, show a modal to select which product/project. Store selection in view state.

**(C) One leaf per entity**: Open multiple Product Hub leaves, each scoped to a different product.

**Recommendation**: Option A + B. Use Obsidian's view state for persistence, hub picker for selection. This is a feature concern, not a refactoring concern — implement alongside PBI-003.

**Effort**: 0 LOC refactoring. ~50 LOC per Domain Hub for scope handling.

---

## Gap 5: PRD TD Items Diverge from Architecture (documentation debt)

**Severity: LOW — documentation only**

The PRD references 7 TD items as prerequisites. 3 are done, 2 are superseded, 2 are deferred. But the TD items still read as if they describe the target architecture. This creates confusion when onboarding or reviewing.

**Recommendation**: Update each TD item's status:

| TD | Action |
|----|--------|
| TD-49 | Close as **superseded** by BaseHubView + buildSplitLayout() |
| TD-50 | Close as **implemented** via ADR-024 (BaseHubView) |
| TD-51 | Keep open, update status to **deferred** (re-evaluate at Phase 4) |
| TD-52 | Keep open, update status to **deferred** (re-evaluate at Phase 4) |
| TD-53 | Close as **partially addressed** (StatCard exists, inline styles adequate) |
| TD-54 | Close as **done** |
| TD-55 | Close as **done** |

**Effort**: ~30 min of doc updates.

---

# 5. HubAdapter: Does the PRD Pattern Still Apply?

The PRD defines a `HubAdapter` hierarchy:
```
HubAdapter (base interface)
├── getDashboardData(): DashboardData
├── getEntities(filters): EntityRow[]
├── getEntityDetail(id): EntityDetail
├── getSessions(): SessionEntry[]
├── getRelations(): RelationEdge[]
├── getTabDefinitions(): TabDefinition[]
└── dispose(): void
```

**Reality check**: BaseHubView's abstract methods serve the same purpose:
```
BaseHubView<TPage> (abstract class)
├── getHubId(): string
├── getHubType(): "system" | "domain" | "user"
├── getTabDefinitions(): TabDef[]
├── onDashboardRender(): void
├── onTabRender(tabId): void
├── onHubOpen(): void
└── onHubClose(): void
```

**Key difference**: The PRD's adapter separates data access from rendering. BaseHubView merges them — the subclass both fetches data and renders it.

**Do we need to separate them?**

| For User Hub | Verdict |
|-------------|---------|
| Needs data from other hubs | YES — but only summary data, not full adapter |
| Renders its own dashboard | NO — BaseHubView handles this |
| Has its own tabs (Inbox, Activity) | NO — these are unique to User Hub |

| For Domain Hubs | Verdict |
|----------------|---------|
| Scan folders for entities | NO — each hub scans its own domain |
| Render master-detail | NO — BaseHubView + tabs handle this |
| Expose data to User Hub | YES — need summary provider |

**Conclusion**: A full `HubAdapter` interface is unnecessary. What's needed is the much simpler `HubDashboardProvider` (Gap 1) for cross-hub aggregation. The rendering concern is already solved by BaseHubView.

**Recommendation**: Do NOT implement the PRD's HubAdapter. Instead implement `HubDashboardProvider` (~30 LOC interface) for the specific cross-hub aggregation need.

---

# 6. Recommended Refactoring Plan (Before PBI-001)

## Priority 1: HubRegistry + HubDashboardProvider (blocks User Hub)

| Item | LOC | Files |
|------|-----|-------|
| `HubDashboardProvider` interface | 25 | `src/domain/hub/types.ts` (NEW) |
| `HubSummary` type | 10 | `src/domain/hub/types.ts` |
| `HubRegistry` class | 50 | `src/domain/hub/HubRegistry.ts` (NEW) |
| Hub registry events | 15 | `src/domain/hub/events.ts` (MODIFY) |
| EventCatalog provider impl | 40 | `src/ui/EventCatalogView.ts` (MODIFY) |
| DataExchange provider impl | 40 | `src/ui/DataExchangeHubView.ts` (MODIFY) |
| Registry wiring in main.ts | 20 | `src/main.ts` (MODIFY) |
| **Total** | **~200** | **3 new, 4 modified** |

## Priority 2: Cross-Hub Navigation (blocks User Hub inbox)

| Item | LOC | Files |
|------|-----|-------|
| `openHub()` method on HubRegistry | 30 | `src/domain/hub/HubRegistry.ts` (MODIFY) |
| `hub.navigate` event | 5 | `src/domain/hub/events.ts` (MODIFY) |
| Navigation listener in BaseHubView | 20 | `src/ui/BaseHubView.ts` (MODIFY) |
| **Total** | **~55** | **3 modified** |

## Priority 3: TD Status Updates (documentation)

| Item | Effort |
|------|--------|
| Update TD-49, TD-50, TD-53, TD-54, TD-55 status | 30 min |
| Update Hubs PRD FRI score (Validation 1→2) | 10 min |

---

# 7. What Does NOT Need Refactoring

| Item | Reason |
|------|--------|
| TD-51 Component Registry | Premature at <5 hubs, <50 components |
| TD-52 Declarative Tab Definitions | Hardcoded `TabDef[]` works; saves ~500 LOC of framework |
| TD-53 UI Primitive Library | StatCard exists; CSS classes provide consistency |
| EntityScanner generalization | Domain Hubs scan different file types; pattern duplication is cheaper |
| BaseEntityTab generalization | Domain Hub tabs have different enough shapes to warrant own classes |
| HubAdapter interface | BaseHubView's abstract methods + HubDashboardProvider covers all needs |
| LayoutRegistry | Only 2 layouts needed; `buildSplitLayout()` + dashboard are sufficient |

---

# 8. Architectural Drift Detection

```
DRIFT DETECTED: PRD architecture has diverged from implementation.

The PRD describes a layered framework:
  LayoutRegistry → WorkspaceShell → ComponentRegistry → HubAdapter → TabRenderer

The implementation is simpler:
  BaseHubView → TabDef[] → component classes → deps interfaces

This is POSITIVE drift — the simpler approach delivers the same outcomes
with less code and complexity. But the PRD documentation now misleads
about the target architecture.

Action required:
  1. Update PRD Section 9 (Adapter Hierarchy) to reflect BaseHubView pattern
  2. Update PRD Section 14 (Implementation Phases) to mark Phase 1-2 as done
  3. Close superseded TD items
  4. Rewrite TD-54/TD-55 acceptance criteria to reflect actual LOC results
```

---

# 9. Decisions Taken

```
1. HubAdapter interface will NOT be implemented. BaseHubView's abstract
   methods provide the rendering contract. HubDashboardProvider (new,
   simpler interface) provides the data aggregation contract for User Hub.

2. EntityScanner will NOT be generalized. Domain Hubs will implement
   their own scanning (~80 LOC each) rather than abstracting the scanner
   for different frontmatter schemas.

3. Scoped hub pattern will be implemented alongside Domain Hubs (not as
   pre-work). Obsidian's built-in view state API handles persistence.

4. Cross-hub navigation will use a hub.navigate event, not direct method
   calls. This preserves the EventBus-as-backbone principle.

5. TD-49, TD-50, TD-53, TD-54, TD-55 should be closed. TD-51, TD-52
   remain open but deprioritized.

6. HubRegistry is a domain service (src/domain/hub/), not infrastructure,
   because it models business relationships between hubs.
```

---

# 10. Feature Readiness Review

| Feature | FRI Score | Current Maturity | Needs Update? |
|----------|-----------|-----------------|---------------|
| Hubs PRD | 25/35 | L3 (Phase 1-2 done) | Yes — update Phase status, close TDs, rewrite adapter section |
| PBI-001 User Hub | not scored | L1 (Defined) | Score after HubRegistry refactoring |
| PBI-003 Product Hub | not scored | L1 (Defined) | No change needed yet |
| PBI-004 Project Hub | not scored | L1 (Defined) | No change needed yet |

---

# 11. Improvement Backlog

| Improvement | Type | Priority | Blocks |
|------------|------|----------|--------|
| Implement HubRegistry + HubDashboardProvider | Refactor | **Critical** | PBI-001 |
| Implement cross-hub navigation (hub.navigate) | Refactor | **High** | PBI-001 inbox |
| Close TD-49, TD-50, TD-53, TD-54, TD-55 | Documentation | Medium | Clarity |
| Update PRD adapter section to reflect BaseHubView | Documentation | Medium | Clarity |
| Update PRD Phase 1-2 status to "Done" | Documentation | Medium | FRI accuracy |
| Define inbox item types for User Hub | Design | High | PBI-001 |
| Define hub picker modal for Domain Hubs | Design | Medium | PBI-003/004 |

---

# 12. Action Items

| Action | Owner | Due Date |
|--------|-------|----------|
| Implement HubRegistry + HubDashboardProvider (~200 LOC) | Engineering | Before PBI-001 |
| Implement cross-hub navigation API (~55 LOC) | Engineering | Before PBI-001 |
| Close superseded TD items (49, 50, 53, 54, 55) | Engineering | Next session |
| Update Hubs PRD Phases 1-2 to "Done" | Product | Next session |
| Update PRD adapter hierarchy to reflect reality | Product | Next session |
| Score PBI-001 FRI after HubRegistry exists | Product | After refactoring |

---

# Final Checklist (Mandatory)

- [x] All improvement items captured
- [x] Required PRD updates identified (adapter section, phase status, TD closures)
- [ ] Tab Definitions updated (N/A)
- [ ] Layout Manifest updated (N/A)
- [ ] Component Manifest updated (N/A)
- [x] Feature Readiness Index reviewed (25/35, update pending)
- [x] Architectural drift documented (positive drift — simpler than PRD)
- [x] Decision log updated (6 decisions)
- [ ] **Documentation updates executed** (pending: TD closures, PRD updates)

---

# Session Summary

```
The Hubs foundation (BaseHubView + System Hub migrations) is solid. Both
System Hubs work well, tests pass, and the architecture is cleaner than
what the PRD originally envisioned.

However, the PRD's architecture documentation has drifted significantly
from reality. The envisioned LayoutRegistry → WorkspaceShell → HubAdapter
→ ComponentRegistry → TabRenderer pipeline was replaced by the simpler
BaseHubView inheritance + TabDef[] + component deps pattern. This is
positive drift (less code, less complexity) but needs documentation cleanup.

For feature development to begin on PBI-001 (User Hub), two concrete
gaps must be filled:

  1. HubRegistry + HubDashboardProvider (~200 LOC)
     Enables User Hub to aggregate dashboard data from all hubs.

  2. Cross-hub navigation API (~55 LOC)
     Enables User Hub inbox items to deep-link into other hubs.

Total pre-feature refactoring: ~255 LOC across 6 files.

Domain Hubs (PBI-003, PBI-004) can be built on BaseHubView directly
with no additional refactoring. Their scanning, state, and tab patterns
are domain-specific and don't need generalized infrastructure.

5 of 7 TD items should be closed (done or superseded). 2 remain open
but deferred until scale justifies them (TD-51 Component Registry,
TD-52 Declarative Tabs).
```

Overall health assessment:

- **Strong** (with targeted refactoring needed)

---

# Three Amigos Scoring Model (TASM)

```yaml
three_amigos_score:
  version: 1.0
  evaluated_feature_or_hub: "Hubs PRD — Pre-Feature Development Readiness"
  date: 2026-02-15
  reviewers:
    - product: Product Owner (simulated)
    - engineering: Technical Architect (simulated)
    - ux_or_qa: QA Engineer (simulated)

  scores:
    product_value: 4
    architectural_integrity: 4
    event_discipline: 5
    data_model_integrity: 3
    ux_quality: 4
    performance_scalability: 5
    documentation_discipline: 4

  total_score: 29
  max_score: 35
  health_level: strong

  drift_detected: true
  refactor_required: true
  immediate_action_required: false

  summary: "Foundation solid (BaseHubView, 2 System Hubs migrated, 1,662 tests). Positive architecture drift from PRD (simpler than planned). Two blockers for User Hub: HubRegistry (~200 LOC) and cross-hub navigation (~55 LOC). 5/7 TDs can be closed. Domain Hubs need no pre-work. TASM 29/35 — Strong."
```

---

## Score Justification

| Dimension | Score | Rationale |
|---|---|---|
| A) Product Value | 4/5 | Foundation enables all planned Hubs. System Hubs migrated successfully. Not 5 because User Hub (highest business value) still blocked by 2 gaps. |
| B) Architectural Integrity | 4/5 | BaseHubView is clean. EntityScanner and BaseEntityTab are reusable. Not 5 because PRD architecture docs are stale and HubAdapter was replaced without formal ADR. |
| C) Event Discipline | 5/5 | 3 hub lifecycle events canonical. EventBus remains backbone. Cross-hub navigation planned as event (hub.navigate), not direct coupling. |
| D) Data Model | 3/5 | No HubRegistry entity, no HubSummary type, no inbox item type defined yet. These are needed before User Hub. Current hub data model is minimal (3 events only). |
| E) UX Quality | 4/5 | Both System Hubs have consistent navigation (tab bar, dashboard, split). Not 5 because no hub picker, no cross-hub navigation, no scoped hub UX yet. |
| F) Performance | 5/5 | Debounced render, lazy tab rendering, event-driven refresh all working. No regressions. 1,662 tests pass. |
| G) Documentation | 4/5 | ADR-024 exists. Two Three Amigos reviews done. Frontend Architecture.md updated. Not 5 because PRD is stale (adapter hierarchy, TD statuses, phase completion). |

---

## Drift Escalation Check

| Condition | Status |
|---|---|
| Architectural Integrity <= 2 | No (4) |
| Event Discipline <= 2 | No (5) |
| Documentation Discipline <= 2 | No (4) |
| Total Score <= 18 | No (29) |
| 3 consecutive drops | No (29 → 30 → 29, stable) |

**No escalation triggers fired.**

---

## Appendix: <200 LOC Acceptance Criterion Check

PRD acceptance criterion: *"Adding new Domain Hub requires only adapter + tab definitions (<200 LOC)"*

**Current reality for a hypothetical Domain Hub**:

| Component | LOC | Notes |
|-----------|-----|-------|
| View class (extends BaseHubView) | 60 | Abstract method implementations |
| Tab definitions | 25 | `TabDef[]` array |
| HubDashboardProvider impl | 30 | getSummary() returns stats |
| View registration (main.ts) | 15 | registerView + ribbon command |
| **Framework total** | **~130** | **Under 200 LOC target** |

Tab components (domain-specific content) are additional:

| Component | LOC | Notes |
|-----------|-----|-------|
| Dashboard | 100 | StatCard grid + quick actions |
| Entity tab (using BaseEntityTab) | 50 | Config object only |
| Custom detail panel | 150 | Domain-specific rendering |
| **Content total** | **~300** | Domain logic, not framework |

**Verdict**: Framework cost ~130 LOC. Acceptance criterion met.
