---
type: idea
stage: planned
origin: inbox
domain: data-exchange
description: "Move canvas import logic from external QuickAdd scripts into the plugin as a first-class import source type alongside CSV."
tags:
  - release-blocker
  - RB-3
priority: "2 - high"
rank:
planned_in: "[[Release Preparation Cycle]]"
related:
  - "[[Starting a Canvas Session]]"
  - "[[I want to import an Obsidian Canvas to add its content to my domain]]"
  - "[[Data Exchange Hub PRD]]"
  - "[[backlog-refinement-2026-02-20]]"
  - "[[Cycle Sequence Review 2026-02-20 Azure DevOps Prioritization]]"
note: "Release blocker RB-3. Moved from Cycle 11 to Cycle 13 per cycle sequence review (Azure DevOps prioritized in Cycle 11). Canvas importer scripts exist in var/scripts/canvas-importer/ (core, basefile, canvas, constants, logger, notes). These must be migrated into src/domain/dataExchange/ as a CanvasImportService. Canvas nodes become typed notes (using color/shape mapping). Groups become domain containers. Edges become relationships. Legend group provides custom type mapping."
---

## Problem

Canvas import logic lives in `var/scripts/canvas-importer/` as standalone QuickAdd scripts. These are not shipped with the plugin, not tested, and not accessible from the Data Exchange Hub. Users must manually configure QuickAdd to use them.

## Proposed Solution

1. **Migrate** `canvas-import-core.js`, `canvas-import-constants.js`, etc. into `src/domain/dataExchange/canvas/`
2. **CanvasImportService**: Parses `.canvas` JSON, applies color/shape/legend mapping, creates typed notes
3. **Register** as import source type in Data Exchange Hub alongside CSV
4. **Import wizard**: Select `.canvas` file, preview nodes with type mapping, configure target folder, execute
5. **Events**: `dataExchange.canvasImport.execute`, `.progress`, `.completed`, `.failed`
6. **Tests**: Port existing QuickAdd test coverage + add integration tests

## Key Mappings (from existing scripts)

- Colors 1-6: Issue, Epic, Task, Test, Deliverable, Feature
- Shapes: circle=Event, diamond=Gateway, parallelogram=Data, document=Document, database=Database
- Groups: become parent containers
- Legend group: custom color-to-type override
- Edges: translated to up/down/prev/next relationships

## Acceptance Criteria

- [ ] Canvas import available from Data Exchange Hub
- [ ] Right-click `.canvas` file shows "Import Canvas" context menu
- [ ] Nodes create typed notes with frontmatter (type, parent, relationships)
- [ ] Legend group overrides default color mapping
- [ ] Groups create container structure
- [ ] Progress events fire per-node
- [ ] All existing canvas-importer test scenarios pass
- [ ] `npm run build` passes
