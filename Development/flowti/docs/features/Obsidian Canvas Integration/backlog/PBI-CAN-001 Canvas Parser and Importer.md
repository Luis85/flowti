---
type: ProductBacklogItem
feature: "[[Obsidian Canvas Integration PRD]]"
stage: planned
priority: high
phase: 1
dependencies:
  - "[[Data Exchange Hub PRD]]"
tags:
  - release-blocker
  - RB-3
  - canvas
  - data-exchange
planned_in: "[[Release Preparation Cycle]]"
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

- [ ] Migrate `canvas-import-core.js` and `canvas-import-constants.js` into `src/domain/dataExchange/canvas/`
- [ ] `CanvasParser`: Parse `.canvas` JSON into `CanvasDocument` type
- [ ] `CanvasImportService`: Convert parsed canvas nodes to typed vault notes
- [ ] Color mapping: 1=Issue, 2=Epic, 3=Task, 4=Test, 5=Deliverable, 6=Feature (default)
- [ ] Shape mapping: circle=Event, diamond=Gateway, parallelogram=Data, document=Document, database=Database
- [ ] Legend group detection and override: custom color-to-type within canvas
- [ ] Group-to-container: canvas groups set `parent` frontmatter on child nodes
- [ ] Edge-to-relationship: edges translate to `up`/`down`/`prev`/`next` frontmatter
- [ ] Register as import source type in Data Exchange Hub
- [ ] Import wizard: 3-page (Select, Preview/Map, Execute)
- [ ] Right-click `.canvas` → "Import Canvas" context menu
- [ ] Progress events: `dataExchange.canvasImport.execute/progress/completed/failed`
- [ ] Saved import configurations for repeatable imports

### Technical Requirements

- New bounded context: `src/domain/dataExchange/canvas/`
- `CanvasParser.ts`: Pure function, no side effects
- `CanvasImportService.ts`: Uses `fileSystemClient` via `doc.create` events
- Events registered in catalog with category "Data Exchange"
- All existing QuickAdd canvas-importer test scenarios ported as unit tests

## Acceptance Criteria

- [ ] Canvas import available from Data Exchange Hub
- [ ] Right-click `.canvas` file shows "Import Canvas" context menu
- [ ] Nodes create typed notes with frontmatter (type, parent, relationships)
- [ ] Legend group overrides default color mapping
- [ ] Groups create container structure
- [ ] Progress events fire per-node
- [ ] All existing canvas-importer test scenarios pass
- [ ] npm run build passes

## Related

- PRD: [[Obsidian Canvas Integration PRD]]
- Inbox: [[Canvas importer must be a first-class plugin feature]], [[Canvas Integration Plan]]
- Existing: `var/scripts/canvas-importer/`
