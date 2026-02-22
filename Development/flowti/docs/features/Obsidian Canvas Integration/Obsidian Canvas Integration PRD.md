---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: delivered
delivered_in: "[[Cycle 15 - Canvas Integration]]"
delivered_date: 2026-02-22
related_events:
  - canvas.import.started
  - canvas.import.progress
  - canvas.import.completed
  - canvas.import.failed
  - canvas.entity.detected
  - canvas.legend.detected
  - canvas.config.saved
  - canvas.loaded
  - canvas.template.applied
  - canvas.session.started
maturity: L1
maturity_score_strategy: 4
maturity_score_scope: 4
maturity_score_architecture: 5
maturity_score_event_integration: 4
maturity_score_data_model: 4
maturity_score_ui_consistency: 4
maturity_score_validation_testing: 5
maturity_score_pipeline_integration: 5
business_value: 5
implementation_cost: 4
maintenance_cost: 3
discovery_cost: 3
design_cost: 4
test_cost: 3
priority: 4
fri_score: 30
planned_in: "[[Cycle 15 - Canvas Integration]]"
tags:
  - canvas
  - core
  - ingestion
---

# Feature: Obsidian Canvas Integration

> Inbox sources: [[Canvas Integration Plan]], [[Canvas importer must be a first-class plugin feature]], [[Canvas session workspace opens canvas as session anchor with sidebar monitor]], [[Canvas template library for session types]], [[Starting a Canvas Session]], [[How can we make ingestion and connecting of information as easy and enjoyable as possible]]

---

## 1. Vision & Strategic Context

> Canvas is the visual layer of Flowti's knowledge graph. It bridges the gap between creative visual thinking and structured documentation by enabling users to design on a canvas and import their work as typed vault notes.

**Strategic position**: Flowti's current data exchange supports CSV only. Canvas files (`.canvas`) are Obsidian's native visual medium and contain rich structural information (nodes, edges, groups, colors) that maps directly to Flowti's domain model (domains, services, events, actors, flows). Bringing Canvas into the Data Exchange pipeline unlocks visual-first documentation workflows and makes ingestion as intuitive as drawing on a whiteboard.

### Core Principles

1. Canvas is a first-class import source alongside CSV
2. Groups map to folders or containers
3. Nodes map to typed notes (color/shape determines type)
4. Edges map to relationships (up/down/prev/next)
5. Legend groups override default color mappings
6. Canvas templates enable preconfigured session workspaces
7. Round-trip: export vault entities back to canvas for visualization

---

## 2. Problem Statement

- **Canvas import logic lives outside the plugin** — `var/scripts/canvas-importer/` contains standalone QuickAdd scripts that are untested, not shipped with the plugin, and inaccessible from the Data Exchange Hub.
- **No visual-first documentation workflow** — users must create notes manually in file trees. There is no way to brainstorm visually and then convert that work into structured documentation.
- **Sessions lack canvas integration** — starting a design session with a preconfigured canvas (e.g., groups for Actors, Systems, Events) is not possible. Canvas files can be attached but not orchestrated.
- **No canvas templates** — each session type could benefit from a preconfigured canvas layout but no template system exists.
- **No canvas export** — vault entities cannot be visualized on a canvas for review or presentation.

---

## 3. Outcome (Success Definition)

- **User can** import a `.canvas` file from the Data Exchange Hub, mapping nodes to typed notes with frontmatter.
- **User can** right-click a `.canvas` file and select "Import Canvas" from the context menu.
- **User can** start a Canvas Session that opens a preconfigured canvas in main with the session workspace in sidebar.
- **User can** choose from a library of canvas templates per session type (Domain Design, Sprint Planning, Retrospective, etc.).
- **System can** round-trip export vault entities to a canvas file for visualization.

---

## 4. Scope

### In Scope (v1)

- Canvas parser: Parse `.canvas` JSON into structured data
- Canvas importer: Convert canvas nodes to typed vault notes
- Data Exchange Hub integration: Canvas as import source type
- Context menu: Right-click `.canvas` → "Import Canvas"
- Color/shape mapping: Node colors and shapes determine note types
- Legend support: Legend groups override default mappings
- Group-to-container: Canvas groups become parent containers or folders
- Edge-to-relationship: Edges translate to up/down/prev/next frontmatter
- Canvas templates: Preconfigured layouts for session types
- Canvas Sessions: Session type that opens canvas + sidebar workspace

### Out of Scope (v2+)

- Canvas export (vault → canvas visualization)
- Real-time canvas ↔ vault sync
- Multi-user canvas collaboration
- Canvas layout engine (auto-layout algorithms)
- Canvas as BPMN/flow diagram editor

---

## 5. UX Entry Points

- **Data Exchange Hub**: Canvas tab or import source selector
- **File context menu**: Right-click `.canvas` → "Import Canvas"
- **Session creation**: "Canvas Session" type in NewSessionModal
- **Command palette**: `flowti:import-canvas`, `flowti:new-canvas-session`

---

## 6. Functional Requirements

### Canvas Parser & Importer

- [x] Parse `.canvas` JSON format (nodes, edges, groups, metadata) (Cycle 15 Inc 1 — parseCanvasJson)
- [x] Map node colors to types: 1=Issue, 2=Epic, 3=Task, 4=Test, 5=Deliverable, 6=Feature (default mapping) (Cycle 15 Inc 1 — DEFAULT_COLOR_MAP)
- [x] Map node shapes to types: circle=Event, diamond=Gateway, parallelogram=Data, document=Document, database=Database (Cycle 15 Inc 1 — DEFAULT_SHAPE_MAP)
- [x] Support Legend group: custom color-to-type override within the canvas (Cycle 15 Inc 1 — extractLegend)
- [x] Groups become parent containers (frontmatter `parent` field on child nodes) (Cycle 15 Inc 2-3 — resolveParentage + toCanvasNoteFrontmatter)
- [x] Edges translate to relationship frontmatter (`up`, `down`, `prev`, `next`) (Cycle 15 Inc 2-3 — buildRelations + toCanvasNoteFrontmatter)
- [x] Import wizard: Select `.canvas` file, preview nodes with type mapping, configure target folder, execute (Cycle 15 Inc 6 — CanvasImportWizard 3-page modal)
- [x] Progress events fire per-node during import (Cycle 15 Inc 3 — importCanvas lifecycle events)
- [x] All existing canvas-importer test scenarios pass after migration (Cycle 15 Inc 4 — all 5 scripts ported, 131 canvas tests)

### Data Exchange Hub Integration

- [x] Canvas registered as import source type alongside CSV (Cycle 15 Inc 5 — CanvasService registered in ServiceContainer, DX Hub dashboard stat card)
- [x] Canvas import available from Data Exchange Hub dashboard (Cycle 15 Inc 5 — renderCanvasStats section in HubDashboard)
- [x] Right-click `.canvas` file shows "Import Canvas" context menu (Cycle 15 Inc 6 — dataExchangeSetup file-menu handler for .canvas extension)
- [x] Import configurations saved and reusable (Cycle 15 Inc 5 — CanvasService CRUD + TypedStorage persistence)
- [x] Full Canvas Action View: ItemView-based wizard (landing → config → preview → result) replacing modal (Cycle 15 Inc 7 — CanvasActionView + 5 page components)
- [x] Type exclusion: configurable excluded types filter during import (Cycle 15 Inc 7 — excludedTypes on CanvasImportConfig)
- [x] DX Hub Canvas tab: config CRUD, detail view, inline run/delete actions (Cycle 15 Inc 7 — CanvasTab in DataExchangeHubView)
- [x] Canvas configs as pipeline sources: `canvasConfigIds` on pipelines, executed after CSV sources (Cycle 15 Inc 8 — PipelineExecutor canvas step execution)
- [x] Pipeline detail: Inputs/Outputs row layout with canvas step cards and "Add Canvas Step" button (Cycle 15 Inc 8 — SourcesExportsGrid restructure)
- [x] Safe folder reveal: `revealFolderInExplorer` utility prevents creating unwanted files (Cycle 15 Inc 8 — bug fix for openLinkText on folder paths)

### Canvas Templates

- [ ] Template library: preconfigured canvas layouts per session type
- [ ] Built-in templates: Domain Design, Sprint Planning, Retrospective, Brainstorm, Flow Design
- [ ] Domain Design template: Groups for Actors, Systems, Events, Services, Flows + Legend
- [ ] Sprint Planning template: Groups for Backlog, Sprint Scope, Risks, Dependencies
- [ ] Retrospective template: Groups for Went Well, Improve, Actions
- [ ] Templates stored in `var/config/canvas-templates/` as `.canvas` JSON
- [ ] Custom template creation and management

### Canvas Sessions

- [ ] "Canvas Session" type in session creation modal
- [ ] Canvas opens in main pane, session workspace in sidebar
- [ ] Canvas template applied based on session type selection
- [ ] Canvas file automatically linked as session artifact
- [ ] Post-session import: prompt to import canvas nodes as typed notes on session completion
- [ ] Nodes created during session get session frontmatter reference

---

## 7. Data Model Impact

```
CanvasDocument
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  groups: CanvasGroup[]
  metadata: CanvasMetadata

CanvasNode
  id: string
  type: "text" | "file" | "link" | "group"
  text?: string
  file?: string
  x: number
  y: number
  width: number
  height: number
  color?: string
  styleAttributes?: Record<string, unknown>

CanvasEdge
  id: string
  fromNode: string
  toNode: string
  fromSide: string
  toSide: string
  label?: string

CanvasImportConfig
  sourcePath: string
  targetFolder: string
  colorMapping: Record<string, string>
  shapeMapping: Record<string, string>
  legendGroupId?: string
  createFolders: boolean

CanvasTemplate
  id: string
  name: string
  sessionType: SessionType
  description: string
  canvas: CanvasDocument
```

---

## 8. Event Impact

### Produced

- `canvas.import.started` — Canvas import pipeline started ✅
- `canvas.import.progress` — Per-node import progress ✅
- `canvas.import.completed` — Canvas import finished ✅
- `canvas.import.failed` — Canvas import error ✅
- `canvas.entity.detected` — Entity detected during parsing ✅
- `canvas.legend.detected` — Legend group detected ✅
- `canvas.config.saved` — Import configuration saved ✅
- `canvas.loaded` — Canvas service loaded ✅
- `canvas.template.applied` — Canvas template applied to session (Phase 2)
- `canvas.session.started` — Canvas session started with template (Phase 3)

### Consumed

- `session.completed` — Trigger post-session import prompt
- File system events for context menu integration

---

## 9. UI Layout Impact

- **Canvas Action View**: 4-page ItemView wizard (Landing, Configure, Preview, Result) — replaces the initial 3-page modal wizard (Cycle 15 Inc 7)
- **DX Hub Canvas Tab**: Master-detail split for canvas config CRUD (Cycle 15 Inc 7)
- **Data Exchange Hub**: Canvas listed as import source type in dashboard, Pipeline Inputs row includes canvas step cards (Cycle 15 Inc 5, 8)
- **Canvas Template Picker**: Modal for selecting canvas template during session creation (Phase 2)

---

## 10. Non-Functional Requirements

- Canvas file parsing must handle files with 500+ nodes
- Import of 100-node canvas must complete within 10 seconds
- Templates must load within 500ms
- All operations must be idempotent when using skip conflict strategy

---

## 11. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Canvas JSON format changes in Obsidian update | High | Defensive parsing with version detection |
| Large canvases cause memory issues | Medium | Streaming parser, node count warning |
| Color/shape mapping conflicts with user conventions | Medium | Legend override + configurable default mappings |
| Migration from QuickAdd scripts introduces regressions | Medium | Port existing test scenarios first |

---

## 12. Acceptance Criteria

- [x] Canvas import available from Data Exchange Hub (Cycle 15 Inc 5)
- [x] Right-click `.canvas` file shows "Import Canvas" context menu (Cycle 15 Inc 6)
- [x] Nodes create typed notes with frontmatter (type, parent, relationships) (Cycle 15 Inc 3)
- [x] Legend group overrides default color mapping (Cycle 15 Inc 1)
- [x] Groups create container structure (Cycle 15 Inc 2-3)
- [x] Progress events fire per-node (Cycle 15 Inc 3)
- [x] Full Canvas Action View with 4-page wizard (Cycle 15 Inc 7)
- [x] Canvas configs usable as pipeline sources (Cycle 15 Inc 8)
- [x] All existing canvas-importer test scenarios pass (Cycle 15 Inc 4 — 186 canvas tests)
- [x] Integration flow test covers end-to-end canvas import pipeline (Cycle 15 Inc 9 — 18-CanvasImport.test.ts, 20 tests)
- [x] npm run build passes (Cycle 15 Inc 9 — 3,548 tests, 141 suites)
- [ ] Canvas Session type available in session creation
- [ ] Canvas opens in main with sidebar workspace
- [ ] At least 3 canvas templates available (Domain Design, Sprint Planning, Retrospective)
- [ ] Post-session import prompt on Canvas Session completion

---

## 13. Definition of Done

- All acceptance criteria verified manually
- Unit tests cover CanvasParser, CanvasImporter, template loading
- Integration tests cover end-to-end canvas import pipeline
- Event catalog updated with all canvas events
- `npm run build` passes

---

## Product Backlog Items

| PBI | Title | Status | Dependencies |
|-----|-------|--------|-------------|
| [[PBI-CAN-001 Canvas Parser and Importer]] | First-class canvas import in Data Exchange Hub | DONE | Data Exchange Hub ✅ |
| [[PBI-CAN-002 Canvas Templates]] | Preconfigured canvas layouts for session types | PLANNED | PBI-CAN-001 |
| [[PBI-CAN-003 Canvas Sessions]] | Session type with canvas + sidebar workspace | PLANNED | PBI-CAN-002, Session Workspaces ✅ |

---

## Implementation Phases

### Phase 1: Canvas Parser & Importer (PBI-CAN-001) — Done (Cycle 15, 9 increments)

Migrate canvas import logic from `var/scripts/canvas-importer/` into `src/domain/canvas/` (own bounded context). Register as import source type in Data Exchange Hub. Implement import wizard, context menu, and progress events.

**Cycle 15 Inc 1 delivered:** Domain types (CanvasItem, CanvasRelation, CanvasParsedResult, CanvasImportConfig), 8 events in CanvasEventMap + catalog, core parser functions (parseCanvasJson, extractLegend, resolveNodeType, slugifyTitle, toPascalCase, isNodeInsideGroup). 44 new tests (3,386 total).

**Cycle 15 Inc 2 delivered:** Parser completion — resolveParentage (smallest enclosing group, self-parent prevention), buildRelations (edge fromSide/toSide → up/down/prev/next, bidirectional, dedup), filterItemsForImport (legend/file/empty exclusion). 28 new tests (3,414 total, 72 canvas-specific). Full parser layer complete.

**Cycle 15 Inc 3 delivered:** Canvas Importer — note creation pipeline. 3-layer architecture: pure content functions (toCanvasNotePath, toCanvasNoteFrontmatter, toCanvasNoteContent), I/O function (writeCanvasNote with skip/update/overwrite conflict strategies), orchestrator (importCanvas with started/progress/completed/failed events, per-node error resilience). 31 new tests (3,445 total, 103 canvas-specific). Full content + write layer complete.

**Cycle 15 Inc 4 delivered:** Canvas Rebuilder & Base Generator — post-import artifacts. CanvasRebuilder: rebuildCanvasData (text→file-node references, group/file preserved, edge ID remapping, injectable ID gen), writeRebuiltCanvas (skip/overwrite). CanvasBaseGenerator: buildBaseFileContent (folder filter + type-grouped table with 13 columns), writeBaseFile (skip/overwrite). 28 new tests (3,473 total, 131 canvas-specific). Full QuickAdd script migration complete — all 5 source scripts ported.

**Cycle 15 Inc 5 delivered:** CanvasService & Data Exchange Hub Integration. CanvasService: service facade with CRUD (saveConfig/removeConfig/getConfigs), TypedStorage persistence, 10-step import orchestration (read→parse→legend→items→parentage→relations→filter→import→rebuild→base). Registered in ServiceContainer, loaded/disposed in main.ts. Canvas shown in DX Hub dashboard (stat card for saved configs). Inbox integration via mapCanvasImportCompleted + mapCanvasImportFailed pure mappers. Parser extended with getNodeTitle + buildCanvasItems glue functions. importedPaths tracking in CanvasImportResult for rebuilder bridge. 34 new tests (3,507 total, 165 canvas-specific).

**Cycle 15 Inc 6 delivered:** Import Wizard, Context Menu & Commands. CanvasImportWizard: 3-page modal (Select → Preview → Execute) following InstallerWizardModal pattern. Select page: FilePickerModal (.canvas), FolderPickerModal, config name, conflict strategy, hierarchy mode. Preview page: stat badges (nodes, groups, legend entries), type distribution, group structure with child counts, legend mappings, config summary. Execute page: live progress bar via canvas.import.started/progress event subscriptions, success/error result display. Context menu: .canvas file-menu "Import Canvas" + saved config quick-run items. Command: flowti:import-canvas in palette. 13 new tests (3,520 total, 178 canvas-specific).

**Cycle 15 Inc 7 delivered:** Canvas Action View + Type Exclusion + DX Hub Canvas Tab. Full ItemView-based import experience replacing the modal wizard: CanvasActionView (~540 LOC) orchestrates landing → config → preview → result pages. 5 page components under `src/ui/canvas/` (~1,550 LOC). Type exclusion (`excludedTypes` on CanvasImportConfig) filters types from import, rebuilder, and base generator. DX Hub Canvas tab with master/detail split for config CRUD. Step bar navigation, unsaved changes detection. 2 new tests (3,522 total).

**Cycle 15 Inc 8 delivered:** Pipeline-Canvas Integration + DX Hub Polish + Bug Fixes. Canvas configs as pipeline sources: `canvasConfigIds?: string[]` on SavedMultiImportPipeline, executed by PipelineExecutor after CSV sources. Late binding via `setCanvasService()` setter + `getCanvasService` lazy getter. Pipeline detail restructured: Inputs row (CSV + canvas) and Outputs row (exports). DX Hub tab reorder: Pipelines first. Bug fix: `revealFolderInExplorer` utility replaces `openLinkText` for safe folder reveal (prevents creating unwanted markdown files). Fix applied to canvas auto-reveal, canvas result page, and CSV result page. 6 new pipeline tests (3,528 total).

**Cycle 15 Inc 9 delivered:** Integration Tests & Documentation. Flow test `18-CanvasImport.test.ts` (20 tests, ~470 LOC) covering config CRUD, import pipeline, legend override, group containment, edge relations, type exclusion, error handling, inbox integration, and event sequence verification. 10 documentation files: 6 component docs (CanvasActionView, CanvasLanding, CanvasConfigPage, CanvasPreviewPage, CanvasResultPage, CanvasTab), 1 flow doc (Import Canvas as Notes), 1 sitemap entry (Canvas Action View), 2 stale docs updated (SourcesExportsGrid, DataExchangeHubView). Frontend Architecture.md updated with full Canvas component inventory. 20 new tests (3,548 total, 141 suites).

### Phase 2: Canvas Templates (PBI-CAN-002)

Create canvas template library stored in `var/config/canvas-templates/`. Implement template picker modal. Provide 5 built-in templates.

### Phase 3: Canvas Sessions (PBI-CAN-003)

New Canvas Session type in NewSessionModal. Opens canvas in main pane with sidebar workspace. Template applied on creation. Post-session import prompt.

---

## Related

- Inbox: [[Canvas Integration Plan]], [[Canvas importer must be a first-class plugin feature]], [[Canvas session workspace opens canvas as session anchor with sidebar monitor]], [[Canvas template library for session types]], [[Starting a Canvas Session]], [[How can we make ingestion and connecting of information as easy and enjoyable as possible]]
- Existing scripts: `var/scripts/canvas-importer/`
- PRDs: [[Data Exchange Hub PRD]], [[Session Workspaces PRD]], [[Hubs PRD]]
- Inbox (v2): [[I can save a Type on Canvas Configs to bridge the gap to the data-dictionary]], [[I want to export a folder to Canvas]], [[I want to capture a canvas as a folder of idea notes to type and tag them in an associated Obsidian Base]], [[I want to start documenting a process on a canvas with prepared fields for input process output this canvas should then auto-create needed notes]]
