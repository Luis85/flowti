---
type: ProductBacklogItem
feature: "[[Obsidian Canvas Integration PRD]]"
stage: done
delivered_in: "[[Cycle 15 - Canvas Integration]]"
priority: high
phase: 1
dependencies:
  - "[[Data Exchange Hub PRD]]"
tags:
  - release-blocker
  - RB-3
  - canvas
  - data-exchange
planned_in: "[[Cycle 15 - Canvas Integration]]"
user_story: "[[Canvas importer must be a first-class plugin feature]]"
---

## User Story - Problemspace

As a domain architect, I want to import Canvas files as typed vault notes from the Data Exchange Hub so that my visual designs become part of the structured knowledge graph without manual note creation.

### User Pains

- Canvas import logic lives in external QuickAdd scripts (`var/scripts/canvas-importer/`)
- Scripts are not shipped with the plugin, not tested, and not accessible from the Data Exchange Hub
- No way to import a canvas from the file context menu
- Color/shape-to-type mapping is hardcoded in scripts with no user override

### User Needs

- Canvas import available from Data Exchange Hub alongside CSV
- Right-click `.canvas` file shows "Import Canvas" context menu
- Configurable color/shape-to-type mapping with Legend group override
- Import wizard with preview showing how nodes will be mapped
- Progress events during import for UI feedback

## Solutionstatement

### Use Case

- Flow: User right-clicks `.canvas` file → "Import Canvas" → Preview nodes with type mapping → Configure target folder → Execute import → Notes created with frontmatter
- Gherkin:
  ```gherkin
  Given a Canvas file with 10 nodes in 3 groups
  When the user imports the canvas via Data Exchange Hub
  Then 10 typed notes are created in the target folder
  And each note has frontmatter with type, parent, and relationship fields
  And groups create container structure
  And the Legend group overrides default color mappings
  ```

### Functional Requirements

- [x] Migrate `canvas-import-core.js` and `canvas-import-constants.js` into `src/domain/canvas/` (Cycle 15 Inc 1)
- [x] `CanvasParser`: Parse `.canvas` JSON into `CanvasData` type + `CanvasParsedResult` (Cycle 15 Inc 1)
- [x] `CanvasImporter`: Convert parsed canvas nodes to typed vault notes (Cycle 15 Inc 3 — `toCanvasNotePath`, `toCanvasNoteFrontmatter`, `toCanvasNoteContent`, `writeCanvasNote`, `importCanvas`)
- [x] Color mapping: 1=Issue, 2=Epic, 3=Task, 4=Test, 5=Deliverable, 6=Feature (DEFAULT_COLOR_MAP) (Cycle 15 Inc 1)
- [x] Shape mapping: circle=Event, diamond=Gateway, parallelogram=Data, document=Document, database=Database, predefined-process=Subprocess, pill=Terminator (DEFAULT_SHAPE_MAP) (Cycle 15 Inc 1)
- [x] Legend group detection and override: custom color-to-type within canvas (`extractLegend()`) (Cycle 15 Inc 1)
- [x] Group-to-container: canvas groups set `parent` frontmatter on child nodes — parser: `resolveParentage()` (Inc 2), frontmatter: `toCanvasNoteFrontmatter()` writes `parent: "[[slug]]"` wikilink (Inc 3)
- [x] Edge-to-relationship: edges translate to `up`/`down`/`prev`/`next` frontmatter — parser: `buildRelations()` (Inc 2), frontmatter: `toCanvasNoteFrontmatter()` resolves IDs to `[[slug]]` wikilinks (Inc 3)
- [x] Register as import source type in Data Exchange Hub (Cycle 15 Inc 5 — CanvasService registered, DX Hub dashboard stat card)
- [x] Import wizard: 3-page (Select, Preview/Map, Execute) (Cycle 15 Inc 6 — `CanvasImportWizard` with file/folder pickers, config settings, preview, live progress)
- [x] Right-click `.canvas` → "Import Canvas" context menu (Cycle 15 Inc 6 — `dataExchangeSetup.ts` file-menu handler + saved config quick-run items)
- [x] Progress events: `canvas.import.started/progress/completed/failed` (Cycle 15 Inc 3 — `importCanvas()` emits all 4 lifecycle events)
- [x] Saved import configurations for repeatable imports (Cycle 15 Inc 5 — CanvasService CRUD + TypedStorage, `MAX_CANVAS_CONFIGS = 50`)

### Technical Requirements

- New bounded context: `src/domain/canvas/` (own domain, not nested under dataExchange)
- `CanvasParser.ts`: Pure functions, no side effects — `parseCanvasJson()`, `extractLegend()`, `resolveNodeType()`, `slugifyTitle()`, `toPascalCase()`, `isNodeInsideGroup()` ✅, `resolveParentage()`, `buildRelations()`, `filterItemsForImport()` ✅
- `CanvasImporter.ts`: 3-layer architecture (pure content → I/O → orchestrator) — `toCanvasNotePath()`, `toCanvasNoteFrontmatter()`, `toCanvasNoteContent()`, `writeCanvasNote()` (conflict strategies), `importCanvas()` (progress events) ✅
- `CanvasRebuilder.ts`: `rebuildCanvasData()` (text→file-node references, edge remapping), `writeRebuiltCanvas()` (skip/overwrite) ✅
- `CanvasBaseGenerator.ts`: `buildBaseFileContent()` (folder filter + type-grouped table), `writeBaseFile()` (skip/overwrite) ✅
- `CanvasService.ts`: Service facade with CRUD (saveConfig/removeConfig/getConfigs), TypedStorage persistence, 10-step import orchestration pipeline, registered in ServiceContainer ✅
- `CanvasParser.ts` extensions: `getNodeTitle()` (title by node type), `buildCanvasItems()` (raw nodes → typed CanvasItem[]) ✅
- Inbox mappers: `mapCanvasImportCompleted()`, `mapCanvasImportFailed()` wired in InboxService ✅
- DX Hub dashboard: `canvasConfigCount` in HubState, `renderCanvasStats()` section in HubDashboard ✅
- 8 events registered in catalog with category "Canvas" ✅
- All existing QuickAdd canvas-importer test scenarios ported as unit tests — all 5 source scripts migrated (core, constants, notes, canvas, basefile) ✅
- `CanvasImportWizard.ts` (~280 LOC): 3-page modal (Select → Preview → Execute), FilePickerModal + FolderPickerModal integration, live progress via event subscriptions ✅
- `dataExchangeSetup.ts`: `.canvas` file-menu context menu ("Import Canvas" + saved config quick-run), `flowti:import-canvas` command, `openCanvasImportWizard()` helper ✅
- `CanvasActionView.ts` (~540 LOC): ItemView-based orchestrator (landing → config → preview → result), replaces modal wizard, unsaved changes detection, step bar navigation ✅
- `src/ui/canvas/` (5 page components, ~1,550 LOC): CanvasLanding, CanvasConfigPage, CanvasPreviewPage, CanvasResultPage, types ✅
- `excludedTypes?: string[]` on CanvasImportConfig: type exclusion filter in importer + rebuilder + base generator ✅
- `src/ui/hub/CanvasTab.ts` (~250 LOC): DX Hub Canvas tab with master/detail split, config CRUD, inline actions ✅
- Pipeline integration: `canvasConfigIds?: string[]` on SavedMultiImportPipeline, PipelineExecutor canvas step execution, UI cards + "Add Canvas Step" ✅
- `revealFolderInExplorer()` utility: safe folder reveal replacing `openLinkText` (prevents file creation) ✅

## Acceptance Criteria

- [x] Canvas import available from Data Exchange Hub (Cycle 15 Inc 5)
- [x] Right-click `.canvas` file shows "Import Canvas" context menu (Cycle 15 Inc 6)
- [x] Nodes create typed notes with frontmatter (type, parent, relationships) (Cycle 15 Inc 3 — toCanvasNoteFrontmatter, 178 canvas tests)
- [x] Legend group overrides default color mapping (Cycle 15 Inc 1 — extractLegend + resolveNodeType priority chain)
- [x] Groups create container structure (Cycle 15 Inc 2-3 — resolveParentage + toCanvasNoteFrontmatter parent wikilink)
- [x] Progress events fire per-node (Cycle 15 Inc 3 — importCanvas emits canvas.import.progress per item)
- [x] All existing canvas-importer test scenarios pass (Cycle 15 Inc 4 — all 5 scripts ported, 186 canvas-specific tests)
- [x] Full Canvas Action View with type exclusion and DX Hub Canvas tab (Cycle 15 Inc 7)
- [x] Canvas configs as pipeline sources with execution, aggregation, and UI (Cycle 15 Inc 8)
- [x] Integration flow test covers end-to-end pipeline (Cycle 15 Inc 9 — 18-CanvasImport.test.ts, 20 tests)
- [x] npm run build passes (verified Cycle 15 Inc 9 — 3,548 tests, 141 suites)

## Related

- PRD: [[Obsidian Canvas Integration PRD]]
- Inbox: [[Canvas importer must be a first-class plugin feature]], [[Canvas Integration Plan]]
- Existing: `var/scripts/canvas-importer/`
