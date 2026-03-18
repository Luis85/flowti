# Plugin Lit Migration — Full UI Restoration & Modernization

**Date:** 2026-03-18
**Status:** Draft
**Iteration:** 5 — Agent World
**Depends on:** C0 fix (done), tab navigation fix (done), component imports (done)

## 1. Vision

Migrate the entire Flowti Plugin UI from the legacy Obsidian DOM API (`createDiv`/`createEl`) to Lit web components. Restore all functionality that was lost during the sitemap-driven architecture migration. Every hub, leaf view, modal, and wizard renders through Lit with full interactivity.

## 2. Current State

- **28 Lit components** exist in `src/components/` — all render content but have gaps in interactivity
- **136 files** in `src/ui/` use old DOM APIs — these are the migration targets
- **5 large leaf handlers** (500-800 LOC each) orchestrate old DOM page classes
- **Hub tab navigation** now works (fixed in this iteration)
- **Component registration** guarded against hot-reload (fixed in this iteration)

## 3. Migration Strategy

**Approach: Inside-out migration.**

1. Each old DOM panel/page class gets a Lit component equivalent in `src/components/`
2. The handler file switches from instantiating the old class to creating the Lit component
3. Old DOM files are deleted once their Lit replacement is verified
4. Handlers remain the bridge between Obsidian (views, events) and Lit (rendering)

**Key principles:**
- One Lit component per panel/page (not monolithic components)
- Components receive data via properties, emit events via CustomEvent
- Handlers wire events to the EventBus / service layer
- Shared styles via `shared-styles.ts` and CSS custom properties
- All components extend `FlowtiElement` base class for consistent loading/error/empty states

## 4. Chunk 1: Hub Interactivity Completion

**Goal:** Make all 6 hub dashboards and all tab content fully interactive and functional.

### Scope
- Fix all remaining event wiring gaps in handlers
- Ensure all Lit component click handlers dispatch events
- Ensure all handler event listeners bridge to EventBus correctly
- Fix data flow — handlers must pass all required properties to components
- Analytics: tiles render with data, queries tab functional, measurements tab functional
- Catalog: entity tabs show data, event toggle/settings work
- DX: all 8 tabs functional with real data where available
- Test Management: dashboard KPI navigation, all tabs functional
- User Hub: all tabs functional with real data
- Train Hub: verify all tabs functional

### Deliverables
- All hub tab content renders and is interactive
- Clicking elements triggers appropriate actions
- Data refreshes on events (where wired via refreshEvents in sitemap)

## 5. Chunk 2: Analytics Domain Migration

**Goal:** Migrate the analytics query builder, chart rendering, and tile system to Lit.

### Old Files to Migrate
- `src/ui/analytics/ChartRenderer.ts` — Canvas-based chart drawing
- `src/ui/analytics/queries/QueryBuilderPanel.ts` — Query construction UI
- `src/ui/analytics/queries/FilterBuilderPanel.ts` — Filter configuration
- `src/ui/analytics/queries/ActionsBar.ts` — Query action buttons
- `src/ui/analytics/queries/ResultsSection.ts` — Query results display
- `src/ui/analytics/tiles/ChartTileRenderer.ts` — Chart tile rendering
- `src/ui/analytics/tiles/StatCardTileRenderer.ts` — Stat card rendering
- `src/ui/analytics/tiles/TableTileRenderer.ts` — Table tile rendering
- `src/ui/analytics/tiles/TileRendererFactory.ts` — Tile type dispatcher
- `src/ui/analytics/NewQueryModal.ts` — New query creation modal
- `src/ui/analytics/SourcePreviewPanel.ts` — Data source preview
- `src/ui/analytics/DashboardQueryMap.ts` — Dashboard-query mapping

### New Lit Components
- `flowti-query-builder.ts` — Full query builder (replaces QueryBuilderPanel + FilterBuilder + ActionsBar)
- `flowti-query-results.ts` — Query results table/chart display
- `flowti-chart.ts` — Generic chart component (line, bar, area, pie) using Canvas API
- Existing `flowti-analytics-tile.ts` enhanced with chart rendering capability

### Acceptance Criteria
- User can create, edit, run, and delete queries from the Queries tab
- Query results render as tables or charts based on display mode
- Dashboard tiles show live data with chart/stat/table visualizations
- New Query modal works from the Queries tab
- Source preview shows data before query execution

## 6. Chunk 3: Session Domain Migration

**Goal:** Migrate all 15 session workspace panels to Lit components.

### Old Files to Migrate
- `SessionTimerPanel.ts` — Session countdown/timer display
- `SessionGoalsPanel.ts` — Session goal tracking
- `SessionExecutionPanel.ts` — Execution progress
- `SessionNotesPanel.ts` — Note-taking area
- `SessionContextPanel.ts` — Context display
- `SessionActivityPanel.ts` — Activity log
- `SessionGuidingQuestions.ts` — Guiding questions display
- `SessionDecisionPanel.ts` — Decision tracking
- `SessionReflectionPanel.ts` — Reflection notes
- `SessionOutputPanel.ts` — Session outputs
- `SessionClosureOverlay.ts` — Session end overlay
- `SessionEnergyIndicator.ts` — Energy level display
- `CognitiveLoadAlert.ts` — Cognitive load warning
- `SessionActivityIntelligencePanel.ts` — AI activity insights
- `TrainClosurePanel.ts` — Train closure from session

### New Lit Components
- `flowti-session-workspace.ts` — Orchestrator component (replaces session-workspace-handler DOM logic)
- `flowti-session-timer.ts`
- `flowti-session-goals.ts`
- `flowti-session-execution.ts`
- `flowti-session-notes.ts`
- `flowti-session-context.ts`
- `flowti-session-activity.ts`
- `flowti-session-decisions.ts`
- `flowti-session-reflection.ts`
- `flowti-session-output.ts`
- `flowti-session-closure.ts`
- `flowti-session-energy.ts`
- `flowti-cognitive-load.ts`

### Acceptance Criteria
- Session workspace leaf view renders all panels via Lit
- Timer works (countdown, pause, resume)
- All panels display data and accept input
- Session lifecycle transitions work (start → active → pause → complete)
- Session closure overlay triggers correctly

## 7. Chunk 4: Train Domain Migration

**Goal:** Migrate train workspace panels and controls to Lit.

### Old Files to Migrate
- `TrainStatsPanel.ts` — Train statistics display
- `TrainBreadcrumbPanel.ts` — Navigation breadcrumbs
- `TrainHistoryPanel.ts` — History of captures
- `TrainControlsPanel.ts` — Start/pause/stop/complete controls
- `TrainPropertyEditor.ts` — Property editing
- `TrainMergeSelector.ts` — Merge selection UI
- `TrainCaptureModal.ts` — Capture creation modal
- `TrainTypePickerModal.ts` — Type selection modal

### New Lit Components
- `flowti-train-workspace.ts` — Orchestrator (replaces train-main-handler DOM logic)
- `flowti-train-stats.ts`
- `flowti-train-breadcrumb.ts`
- `flowti-train-controls.ts`
- `flowti-train-property-editor.ts`
- `flowti-train-merge.ts`
- `flowti-train-capture-modal.ts` (or Obsidian Modal wrapper)

### Acceptance Criteria
- Train workspace leaf view renders all panels via Lit
- Capture creation works
- Property editing works
- Train lifecycle (start, pause, resume, complete, merge) functional
- History display shows all captures

## 8. Chunk 5: Catalog + Data Exchange Detail Panels

**Goal:** Migrate catalog entity detail panels and DX wizard pages to Lit.

### Old Files to Migrate (Catalog)
- `CatalogDashboard.ts`, `BaseEntityTab.ts`
- `EventsTab.ts`, `EventsCategoryRenderer.ts`, `EventDetailPanel.ts`, `EventsSettingsPanel.ts`
- `DomainsTab.ts`, `DomainDetailPanel.ts`
- `ActorsTab.ts`, `FeaturesTab.ts`, `FeatureDetailPanel.ts`
- `HealthTab.ts`

### Old Files to Migrate (DX Wizards)
- `CanvasLanding.ts`, `CanvasConfigPage.ts`, `CanvasPreviewPage.ts`, `CanvasResultPage.ts`
- `CsvLanding.ts`, `CsvConfigPage.ts`, `CsvPreviewPage.ts`, `CsvResultPage.ts`
- `ExportView.ts`, `ViewSelectPage.ts`, `PreviewPage.ts`, `ResultPage.ts`

### New Lit Components
- `flowti-event-detail.ts` — Event detail panel (replaces EventDetailPanel)
- `flowti-domain-detail.ts` — Domain detail panel
- `flowti-canvas-wizard.ts` — Multi-step canvas import wizard
- `flowti-csv-wizard.ts` — Multi-step CSV import wizard
- `flowti-export-wizard.ts` — Multi-step export wizard

### Acceptance Criteria
- Clicking an event in the catalog shows detail panel
- Clicking a domain/service/actor shows detail panel
- Canvas import wizard works end-to-end (landing → config → preview → result)
- CSV import wizard works end-to-end
- Export wizard works end-to-end

## 9. Chunk 6: Journey Builder + Modals

**Goal:** Migrate the journey builder and all modals to Lit.

### Old Files to Migrate (Journey Builder)
- `JourneyFileView.ts`, `JourneyBuilderSidebar.ts`, `NavBar.ts`, `WelcomeScreen.ts`
- `StepCard.ts`, `ActionForm.ts`, `ActionList.ts`, `ChipList.ts`
- `TemplatePicker.ts`, `ToolPicker.ts`

### Old Files to Migrate (Modals)
- `modals.ts` — ConfirmModal, InputModal, ManualQaModal, etc.
- `InstallerWizardModal.ts`
- `QuickCaptureModal.ts`
- `SignalConfigModal.ts`
- Domain-specific modals

### New Lit Components
- `flowti-journey-builder.ts` — Orchestrator
- `flowti-journey-step.ts` — Step card
- `flowti-journey-sidebar.ts` — Sidebar navigation
- `flowti-modal.ts` — Base modal component (wraps Obsidian Modal with Lit content)
- `flowti-confirm-modal.ts`
- `flowti-input-modal.ts`
- `flowti-capture-modal.ts`

### Acceptance Criteria
- Journey builder renders via Lit in its leaf view
- Steps can be added, edited, reordered, deleted
- All modals render with Lit content inside Obsidian Modal wrapper
- Confirm/Input/Capture modals work correctly

## 10. Execution Order & Dependencies

```
Chunk 1 (Hub Interactivity) — no dependencies, highest visibility
  ↓
Chunk 2 (Analytics) — depends on Chunk 1 for handler patterns
  ↓ (parallel with)
Chunk 3 (Session) — independent domain
  ↓ (parallel with)
Chunk 4 (Train) — independent domain
  ↓
Chunk 5 (Catalog + DX) — depends on Chunk 1 patterns
  ↓
Chunk 6 (Journey + Modals) — depends on modal base component
```

Chunks 2, 3, 4 can run in parallel after Chunk 1 establishes patterns.

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Old panels have complex state management | Lit reactive properties handle this; migrate state to component |
| Chart rendering needs Canvas API | Lit components can use Canvas — create `flowti-chart.ts` base |
| Modals need Obsidian Modal wrapper | Create `FlowtiModal` base that renders Lit content inside Obsidian Modal |
| Session workspace has 15 panels in one view | Use composition — orchestrator component arranges sub-components |
| Migration breaks existing functionality | Each chunk has acceptance criteria; test before deleting old files |
| Bundle size increase from Lit | Lit is lightweight (~5KB); 28 components already use it |
