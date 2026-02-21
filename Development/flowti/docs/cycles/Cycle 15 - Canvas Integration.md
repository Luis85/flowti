---
type: DevelopmentCycle
feature: "[[Obsidian Canvas Integration PRD]]"
stage: in-progress
cycle: 15
date_planned:
date_completed:
pbis:
  - "[[PBI-CAN-001 Canvas Parser and Importer]]"
bugs: []
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 7
actual_increments:
estimated_tests: 90
actual_tests:
total_tests_after:
total_test_files_after:
---

# Cycle 15: Canvas Integration

## Cycle Overview

**User Story:**

> As a domain architect, I want to import Canvas files as typed vault notes from the Data Exchange Hub so that my visual designs become structured documentation without manual note creation — and I no longer depend on external QuickAdd scripts.

**User Pains:**
- Canvas import logic lives in external QuickAdd scripts (~2,000 LOC in `var/scripts/canvas-importer/`)
- Scripts are not shipped with the plugin, not tested, and not accessible from the Data Exchange Hub
- No way to import a canvas from the file context menu
- Color/shape-to-type mapping is hardcoded in scripts with no user override
- Canvas files are Obsidian's native visual medium but disconnected from Flowti's structured documentation

**User Needs:**
- Canvas import available from Data Exchange Hub alongside CSV
- Right-click `.canvas` file shows "Import Canvas" context menu
- Configurable color/shape-to-type mapping with Legend group override
- Import wizard with preview showing how nodes will be mapped
- Progress events during import for UI feedback
- Saved import configurations for repeatable imports

---

## Situation Assessment

### Pre-Cycle State (projected post-Cycle 14)

**Plugin health (projected):**
- ~3,363 tests passing, ~133 test suites
- Build status: green
- Train of Thoughts views polished and integrated (Cycle 14)

**Feature status across contributing PRDs:**

| PRD | Stage | FRI | Delivered So Far |
|-----|-------|-----|------------------|
| [[Obsidian Canvas Integration PRD]] | approved | 21/35 | No PBIs delivered yet — migration from QuickAdd scripts |
| [[Data Exchange Hub PRD]] | done | — | 7-tab hub, CSV import/export, pipelines, type docs |
| [[Hubs PRD]] | in-progress | 33/35 | User Hub, Event Catalog, Data Exchange Hub |

**Infrastructure available:**
- Data Exchange Hub: 7-tab hub with CSV import/export pipeline, saved configurations, progress events
- FileSystemClient: note creation, frontmatter management, folder creation
- DocService: `doc.create` events for entity doc creation
- DiscoveryService: event discovery pipeline
- EventBus: full event tracing, per-domain event composition
- InboxService: wired to import completion/failure events (reuse pattern from CSV/Signal)
- Entity path system: all entity types (events, domains, services, flows, systems, actors, products)

**Migration source (existing QuickAdd scripts):**

| Script | LOC | Migration Target |
|--------|-----|-----------------|
| `canvas-import-core.js` | 315 | `src/domain/canvas/CanvasParser.ts` |
| `canvas-import-constants.js` | 54 | `src/domain/canvas/types.ts` (constants) |
| `canvas-import-notes.js` | 1,064 | `src/domain/canvas/CanvasImporter.ts` |
| `canvas-import-canvas.js` | 154 | `src/domain/canvas/CanvasRebuilder.ts` |
| `canvas-import-basefile.js` | 69 | `src/domain/canvas/CanvasBaseGenerator.ts` |
| `canvas-import-logger.js` | 338 | Replaced by EventBus events |
| **Total** | **1,994** | **~1,200 TypeScript (typed, tested)** |

**Obsidian Canvas API types** (from `node_modules/obsidian/canvas.d.ts`):
- `CanvasData`: `{ nodes: AllCanvasNodeData[], edges: CanvasEdgeData[] }`
- `AllCanvasNodeData`: `CanvasFileData | CanvasTextData | CanvasLinkData | CanvasGroupData`
- `CanvasEdgeData`: `{ id, fromNode, toNode, fromSide?, toSide?, color?, label? }`
- `CanvasColor`: `string` (1-6 or hex)
- `NodeSide`: `"top" | "right" | "bottom" | "left"`

---

## Cycle Goals

1. **Migrate canvas parser** (Inc 1-2) — Port `canvas-import-core.js` + `canvas-import-constants.js` into typed TypeScript with full test coverage
2. **Migrate canvas importer** (Inc 3-4) — Port `canvas-import-notes.js` into plugin using FileSystemClient and doc.create events
3. **Data Exchange Hub integration** (Inc 5) — Canvas as import source type alongside CSV
4. **Context menu + commands** (Inc 6) — Right-click `.canvas` → "Import Canvas", command palette
5. **Integration verification** (Inc 7) — Flow tests covering end-to-end import pipeline

---

## Scope

**In scope (PBI-CAN-001 only):**
- Canvas parser: Parse `.canvas` JSON into typed `CanvasDocument`
- Canvas importer: Convert canvas nodes to typed vault notes with frontmatter
- Color mapping: 1=Issue, 2=Epic, 3=Task, 4=Test, 5=Deliverable, 6=Feature (default)
- Shape mapping: circle=Event, diamond=Gateway, parallelogram=Data, document=Document, database=Database
- Legend group detection and override
- Group-to-container mapping (parent frontmatter)
- Edge-to-relationship translation (up/down/prev/next)
- Data Exchange Hub registration as import source
- File context menu: `.canvas` → "Import Canvas"
- Import wizard (3-page: Select, Preview/Map, Execute)
- Canvas rebuilder (file-node references after import)
- `.base` index file generation
- Progress events per node
- Saved import configurations

**Out of scope (future cycles):**
- Canvas Templates (PBI-CAN-002) → Cycle 16
- Canvas Sessions (PBI-CAN-003) → Cycle 16+
- Canvas Export (vault → canvas visualization) → Future
- Round-trip sync → Future

---

## Tech Debt Bundled

None bundled — this is a greenfield domain migration cycle.

---

## Increment Plan

### Inc 1: Canvas Domain Types & Parser Foundation

**Goal:** Establish the canvas domain bounded context with types, events, and core parser functions.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/canvas/types.ts` | CanvasDocument, CanvasNode, CanvasEdge, FlowtiCanvasType, ColorTypeMapping, CanvasImportConfig, CanvasImportResult, DEFAULT_COLOR_MAP, DEFAULT_SHAPE_MAP | ~80 |
| 2 | `src/domain/canvas/events.ts` | CanvasEventMap: 8 events (import lifecycle + entity detection) | ~30 |
| 3 | `src/infrastructure/events/events.ts` | Compose CanvasEventMap into FlowtiEventMap | +2 |
| 4 | `src/domain/canvas/CanvasParser.ts` | `parseCanvasJson()`, `extractLegend()`, `resolveNodeType()` | ~60 |

**Est. total:** ~120 LOC source, ~80 LOC tests, ~18 new tests

**Test intent:**
- Unit tests: parseCanvasJson handles valid/invalid JSON, empty canvas
- Unit tests: extractLegend finds legend group, returns null when absent
- Unit tests: resolveNodeType follows priority: legend → shape → color → default
- Unit tests: all 6 color codes map correctly, all shape types map correctly

**Architecture seams:**
- New bounded context `src/domain/canvas/` — isolated from data exchange internals
- CanvasEventMap composed into FlowtiEventMap via `extends` (same pattern as TrainEventMap)
- Pure functions in CanvasParser — no side effects, no Obsidian dependencies

**Acceptance criteria:**
- [x] `CanvasParsedResult` type represents parsed canvas with items, relations, groups, legendMap (named `CanvasParsedResult` — more descriptive than planned `CanvasDocument`)
- [x] `parseCanvasJson()` handles valid JSON and edge cases (empty, malformed) — 8 tests
- [x] `extractLegend()` detects Legend group and returns color mapping — 6 tests
- [x] `resolveNodeType()` follows resolution chain: legend → shape → color → default — 10 tests
- [x] All 6 default color codes and 7 shape types mapped correctly — constants + tests
- [x] 8 canvas events registered in type system — CanvasEventMap + catalog + category

**Delivery notes:**
- Domain at `src/domain/canvas/` (bounded context, not nested under dataExchange)
- 44 new tests (est. 18) — added `slugifyTitle`, `toPascalCase`, `isNodeInsideGroup` utilities for Inc 2+
- ~322 LOC source (est. ~120), ~228 LOC tests (est. ~80) — extra utilities and thorough tests
- Also updated: `DEFAULT_CATALOG_CATEGORIES` (+Canvas), catalog helpers test fixture (+Canvas)

---

### Inc 2: Parser Completion — Parentage, Relations, Filtering

**Goal:** Complete the parser with parent resolution, edge-to-relation mapping, and item filtering.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/canvas/CanvasParser.ts` | `resolveParentage()` — bounding-box containment (smallest enclosing group) | ~40 |
| 2 | `src/domain/canvas/CanvasParser.ts` | `buildRelations()` — edge fromSide/toSide → up/down/prev/next | ~30 |
| 3 | `src/domain/canvas/CanvasParser.ts` | `filterItemsForImport()` — exclude legend nodes, file nodes, empty text nodes | ~20 |

**Est. total:** ~100 LOC source, ~80 LOC tests, ~16 new tests

**Test intent:**
- Unit tests: parent resolution with nested groups (smallest enclosing wins), self-parent prevention
- Unit tests: edge direction mapping (top→up, bottom→down, left→prev, right→next)
- Unit tests: legend nodes filtered, file nodes filtered, empty text nodes filtered
- Unit tests: complex canvas with overlapping groups

**Acceptance criteria:**
- [ ] Nodes assigned to smallest enclosing group as parent
- [ ] Self-parentage prevented (node cannot be its own parent)
- [ ] Edges mapped to directional relations based on fromSide/toSide
- [ ] Legend group nodes excluded from import
- [ ] File nodes (already existing) excluded from import
- [ ] Empty text nodes excluded

---

### Inc 3: Canvas Importer — Note Creation

**Goal:** Create vault notes from parsed canvas nodes with proper frontmatter, folder structure, and progress events.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/canvas/CanvasImporter.ts` | `importCanvas()` orchestrator: parse → filter → create notes → report | ~80 |
| 2 | `src/domain/canvas/CanvasImporter.ts` | Per-node note creation with frontmatter (type, status, parent, up/down/prev/next) | ~50 |
| 3 | `src/domain/canvas/CanvasImporter.ts` | Conflict strategies: skip, update, overwrite | ~30 |
| 4 | `src/domain/canvas/CanvasImporter.ts` | Folder creation from groups, progress events per node | ~20 |

**Est. total:** ~180 LOC source, ~80 LOC tests, ~18 new tests

**Test intent:**
- Unit tests: note creation with correct frontmatter for each Flowti type
- Unit tests: conflict strategies (skip existing, update frontmatter, overwrite)
- Unit tests: folder structure matches group hierarchy
- Unit tests: progress events fire per-node with correct counts
- Unit tests: error resilience (single node failure doesn't stop import)

**Acceptance criteria:**
- [ ] Notes created with frontmatter: type, status, parent, relationship fields
- [ ] Folder structure created from canvas group hierarchy
- [ ] Skip strategy: no-op for existing notes
- [ ] Update strategy: merge frontmatter, preserve body
- [ ] Overwrite strategy: replace entire note
- [ ] Progress events fire per-node with current/total counts
- [ ] Single node failure captured as error, import continues

---

### Inc 4: Canvas Rebuilder & Base Generator

**Goal:** Post-import: rebuild canvas with file-node references and generate `.base` index file.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/canvas/CanvasRebuilder.ts` | `rebuildCanvas()` — replace text nodes with file-node references to imported notes | ~50 |
| 2 | `src/domain/canvas/CanvasBaseGenerator.ts` | `generateBaseFile()` — create `.base` index with type-based filters | ~30 |

**Est. total:** ~80 LOC source, ~50 LOC tests, ~11 new tests

**Test intent:**
- Unit tests: rebuilt canvas has file nodes referencing created notes
- Unit tests: original spatial layout preserved (x, y, width, height)
- Unit tests: `.base` file contains correct filter configuration
- Unit tests: rebuilder handles empty canvas, canvas with only groups

**Acceptance criteria:**
- [ ] Rebuilt canvas replaces text nodes with file-node references
- [ ] Spatial layout (position, size) preserved from original canvas
- [ ] `.base` file generated with type-based filters for indexed queries
- [ ] Rebuilt canvas file written to vault alongside imported notes

---

### Inc 5: CanvasService & Data Exchange Hub Integration

**Goal:** Create the service orchestrator and integrate Canvas as an import source in the Data Exchange Hub.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/canvas/CanvasService.ts` | Service facade: import orchestration, saved configs, state persistence | ~70 |
| 2 | `src/infrastructure/services/registry.ts` | Register CanvasService in ServiceContainer | +5 |
| 3 | `src/infrastructure/events/catalog.ts` | Register 8 canvas events in Event Catalog | +8 |
| 4 | `src/ui/hub/DataExchangeHubView.ts` | Add "Canvas" as import source in dashboard | +20 |
| 5 | `src/domain/inbox/InboxService.ts` | Wire `canvas.import.completed/failed` inbox mappers | +5 |

**Est. total:** ~120 LOC source, ~60 LOC tests, ~14 new tests

**Test intent:**
- Unit tests: CanvasService orchestrates parse → import → rebuild → report
- Unit tests: saved configs persist and load
- Unit tests: Canvas source visible in DX Hub dashboard
- Unit tests: inbox items created for import completion/failure

**Acceptance criteria:**
- [ ] CanvasService registered in ServiceContainer
- [ ] Canvas events registered in Event Catalog
- [ ] Canvas listed as import source in Data Exchange Hub dashboard
- [ ] Saved import configurations persist across sessions
- [ ] Inbox integration: items created for import success/failure

---

### Inc 6: Import Wizard, Context Menu & Commands

**Goal:** User-facing UI for canvas import.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/canvas/CanvasImportWizard.ts` (new) | 3-page modal: Select .canvas file → Preview nodes with type mapping → Execute import | ~100 |
| 2 | `src/main.ts` | Register `flowti:import-canvas` command | +5 |
| 3 | `src/main.ts` | Register file context menu: `.canvas` → "Import Canvas" | +15 |
| 4 | `src/domain/inbox/mappers.ts` | Add `mapCanvasImportCompleted`, `mapCanvasImportFailed` | +15 |

**Est. total:** ~150 LOC source, ~50 LOC tests, ~11 new tests

**Test intent:**
- Unit tests: wizard page navigation (Select → Preview → Execute)
- Unit tests: preview shows node type mapping
- Unit tests: execute triggers CanvasService.importCanvas()
- Unit tests: context menu visible for .canvas files only

**Acceptance criteria:**
- [ ] Import wizard: 3-page flow (Select → Preview/Map → Execute)
- [ ] Preview page shows node count, type mapping, group structure
- [ ] Execute triggers import with progress feedback
- [ ] `flowti:import-canvas` command in palette
- [ ] Right-click `.canvas` → "Import Canvas" in file context menu
- [ ] Inbox mappers create items for import completion/failure

---

### Inc 7: Integration Tests & Verification

**Goal:** End-to-end verification with flow tests.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `tests/flows/18-CanvasImport.test.ts` (new) | Parse → import → verify notes → verify frontmatter → verify events | ~60 |
| 2 | Verify | `npm test` — all tests pass | — |
| 3 | Verify | `npm run check` — tsc + eslint clean | — |

**Est. total:** ~60 LOC tests, ~13 new tests

**Test intent:**
- Integration: full import pipeline from canvas JSON to vault notes
- Integration: frontmatter correctness (type, parent, relationships)
- Integration: events fired in correct order (started → progress × N → completed)
- Integration: legend override, group structure, edge relations
- Integration: conflict strategies with pre-existing notes

**Acceptance criteria:**
- [ ] Flow 18 covers end-to-end canvas import pipeline
- [ ] All created notes have correct frontmatter
- [ ] Events fire in order: started → progress × N → completed
- [ ] Legend override tested
- [ ] Conflict strategies tested
- [ ] `npm test` passes
- [ ] `npm run check` clean

---

## Dependency Graph

```
Inc 1 (Types + Parser Foundation)
    │
    ▼
Inc 2 (Parser Completion)
    │
    ▼
Inc 3 (Canvas Importer) → Inc 4 (Rebuilder + Base)
    │
    ▼
Inc 5 (CanvasService + DX Hub)
    │
    ▼
Inc 6 (Import Wizard + Context Menu)
    │
    ▼
Inc 7 (Integration Tests)
```

Strictly sequential: each increment depends on the previous. This is intentional — the canvas domain builds layer-by-layer from types through service to UI.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| QuickAdd scripts have implicit behavior not captured in docs | High | Read all scripts line-by-line before migration; port test scenarios first |
| Canvas JSON format edge cases (empty nodes, malformed groups) | Medium | Defensive parsing with validation; skip malformed nodes with error capture |
| Large canvases (500+ nodes) cause performance issues | Medium | Progress events with cancellation support; node count warning at 200+ |
| Obsidian Canvas format changes in future updates | Low | Canvas format is stable and documented; version detection header |
| Context menu API differences across Obsidian versions | Low | Feature-detect context menu API; graceful degradation |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| New tests | ~90 | `npm test` count delta |
| Source LOC | ~810 | Sum of increment estimates |
| Build status | green | `npm test` passes |
| FRI score | 21 → 26+ | Post-cycle FRI re-score |
| Release blocker | RB-3 resolved | Canvas import shipped as plugin feature |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Canvas Templates (PBI-CAN-002) | Separate PBI, lower priority than core import | Cycle 16 |
| Canvas Sessions (PBI-CAN-003) | Depends on PBI-CAN-002, separate UX | Cycle 16+ |
| Canvas Export (vault → canvas visualization) | Out of v1 scope per PRD | Future |
| Round-trip sync (canvas ↔ vault) | Complex, future need | Future |
| Canvas layout engine | Not needed for import | Future |

---

## DoR Preparation Notes

### Gaps to Close Before Cycle 15 Starts

| # | Gap | Current | Required | Action |
|---|-----|---------|----------|--------|
| 1 | PRD stage | `discovery` | `approved` | Complete phases 3-5 (Solution Exploration → Development Ready) |
| 2 | FRI score | 18/35 | ≥ 19/35 | Strengthen: Event Integration (2→3), UI Consistency (2→3), Validation (1→2) |
| 3 | Technical Review | Not done | PASS | Schedule post-Cycle 14 review |
| 4 | PBI test scenarios | Absent | Gherkin scenarios | Write test scenarios per functional requirement |
| 5 | Canvas API exploration | Theoretical | Confirmed | Build proof-of-concept for context menu + canvas JSON read |

### Already Ready

- [x] PRD exists with clear vision, scope, data model, and event impact
- [x] 3 PBIs defined (CAN-001, CAN-002, CAN-003) with dependencies mapped
- [x] Existing implementation exists as reference (~2,000 LOC QuickAdd scripts)
- [x] Canvas JSON format fully documented (Obsidian types in `canvas.d.ts`)
- [x] Architecture plan exists ([[Canvas Integration Plan]])
- [x] Data Exchange Hub infrastructure available for integration
- [x] Entity mapping convention defined (color/shape → Flowti type)

---

## Related

- PRD: [[Obsidian Canvas Integration PRD]]
- Architecture: [[Canvas Integration Plan]]
- PBI: [[PBI-CAN-001 Canvas Parser and Importer]]
- Release Blocker: RB-3
- Existing scripts: `var/scripts/canvas-importer/`
- Prior Cycle: [[Cycle 14 - Train View Polish]]
- ADR: [[ADR-033 Canvas File Format as Configuration Storage]]
