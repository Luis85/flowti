---
type: Plan
title: Canvas Integration
stage: discovery
priority: high
description: Integrate Obsidian Canvas as a first-class visualization and design tool for Flowti
tags:
  - canvas
  - integration
  - design
  - domain-modeling
---

# Canvas Integration Plan

> Tighter integration of the Obsidian Canvas data format behind a Flowti facade. Enables visualizing Flowti config on a canvas and importing from canvas to build domains, event catalogs, and documentation.

## Context

### What exists today

Flowti already has a **QuickAdd-based canvas importer** (`var/scripts/quickadd/import-canvas.js`) with supporting modules in `var/scripts/canvas-importer/`. This legacy system:

- Parses `.canvas` JSON (nodes, edges, groups)
- Maps colors/shapes to Flowti types (Event, Feature, Epic, Task, etc.)
- Supports a "Legend" group convention for custom color-to-type mappings
- Creates vault notes from canvas nodes with frontmatter (type, status, parent, up/down/prev/next relations)
- Can rebuild a canvas with file-node references after import
- Uses `canvas-import-core.js` for parsing, `canvas-import-notes.js` for note creation, `canvas-import-canvas.js` for canvas generation
- Requires QuickAdd + Modal Forms plugins (external dependencies)

### What the plugin has natively

- **Event-driven architecture** with ~98 typed events via `EventBus`
- **DocService** centralizing all doc file creation via `doc.create` events
- **Event Catalog** with 8 tabs: Domains, Services, Events, Flows, Systems, Actors, Products
- **Data Exchange Hub** with CSV import/export, pipelines, type docs, data dictionary
- **FileSystemClient** for vault operations
- **Discovery Service** scanning vault for user-defined events
- **Entity path resolution** for all entity types (events, domains, services, flows, etc.)

### Obsidian Canvas format

The `.canvas` file is JSON with this structure:

```json
{
  "nodes": [
    { "id": "...", "type": "text|file|link|group", "x": 0, "y": 0, "width": 260, "height": 60,
      "text": "...", "color": "1-6", "label": "...",
      "styleAttributes": { "shape": "circle|diamond|...", "textAlign": "center" } }
  ],
  "edges": [
    { "id": "...", "fromNode": "...", "fromSide": "top|bottom|left|right",
      "toNode": "...", "toSide": "top|bottom|left|right", "label": "..." }
  ]
}
```

Key properties: node types (`text`, `file`, `link`, `group`), 6 color codes, shape attributes, spatial positioning (x/y/width/height), and directional edges with optional labels.

---

## Architecture: The Canvas Domain

Add a new bounded context `src/domain/canvas/` following the established DDD pattern.

### New domain: `canvas`

```
src/domain/canvas/
├── CanvasService.ts          # Orchestrator facade (registered in ServiceContainer)
├── CanvasParser.ts           # Parse .canvas JSON into typed CanvasDocument
├── CanvasExporter.ts         # Export Flowti config/entities to .canvas format
├── CanvasImporter.ts         # Import from .canvas into vault notes + domain entities
├── CanvasLayoutEngine.ts     # Auto-layout algorithms for generated canvases
├── events.ts                 # CanvasEventMap
└── types.ts                  # All canvas domain types
```

### Types (`types.ts`)

```typescript
// ── Canvas data model (Flowti facade over Obsidian Canvas format) ──

/** Obsidian Canvas node types */
type CanvasNodeType = "text" | "file" | "link" | "group";

/** Flowti semantic types derived from canvas conventions */
type FlowtiCanvasType =
  | "Event" | "Gateway" | "Subprocess" | "Data" | "Document" | "Database" | "Terminator"
  | "Epic" | "Feature" | "Deliverable" | "Task" | "Test" | "Issue"
  | "Domain" | "Service" | "System" | "Actor" | "Flow" | "Product"
  | "Group" | "Node";

/** Color-to-type mapping (user-configurable via Legend or defaults) */
interface ColorTypeMapping {
  [colorCode: string]: FlowtiCanvasType;
}

/** A parsed canvas node with Flowti semantics */
interface CanvasNode {
  id: string;
  title: string;
  flowtiType: FlowtiCanvasType;
  originalType: CanvasNodeType;
  color: string | null;
  shape: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId: string | null;
  parentTitle: string | null;
  metadata: Record<string, unknown>;
}

/** A parsed canvas edge with Flowti semantics */
interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide: "top" | "bottom" | "left" | "right";
  toSide: "top" | "bottom" | "left" | "right";
  label: string | null;
  relation: "up" | "down" | "prev" | "next";
}

/** Full parsed canvas document */
interface CanvasDocument {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  groups: CanvasNode[];
  legend: ColorTypeMapping | null;
}

/** Configuration for canvas import */
interface CanvasImportConfig {
  sourcePath: string;
  targetFolder: string;
  importMode: "folder" | "flat";
  conflictStrategy: "skip" | "update" | "overwrite";
  createBase: boolean;
  createCanvas: boolean;
  skipEmpty: boolean;
  entityMapping: boolean;  // whether to create domain entities (domains, services, etc.)
}

/** Configuration for canvas export/generation */
interface CanvasExportConfig {
  outputPath: string;
  sourceType: "domain" | "flow" | "system" | "eventCatalog" | "config";
  sourceName: string;
  layout: "hierarchical" | "force-directed" | "grid";
  includeEdges: boolean;
  colorScheme: ColorTypeMapping;
}

/** Result of a canvas import */
interface CanvasImportResult {
  totalNodes: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ nodeId: string; title: string; error: string }>;
  entitiesCreated: {
    domains: string[];
    services: string[];
    events: string[];
    flows: string[];
    systems: string[];
    actors: string[];
    products: string[];
  };
  canvasPath: string | null;
  basePath: string | null;
}

/** Persisted canvas domain state */
interface CanvasState {
  savedImportConfigs: SavedCanvasImportConfig[];
  savedExportConfigs: SavedCanvasExportConfig[];
  defaultColorMapping: ColorTypeMapping;
}
```

### Events (`events.ts`)

```typescript
interface CanvasEventMap {
  // Import lifecycle
  "canvas.import.started": { operationId: string; config: CanvasImportConfig };
  "canvas.import.progress": { operationId: string; current: number; total: number; lastTitle: string };
  "canvas.import.completed": { operationId: string; result: CanvasImportResult };
  "canvas.import.failed": { operationId: string; error: string };

  // Export lifecycle
  "canvas.export.started": { operationId: string; config: CanvasExportConfig };
  "canvas.export.completed": { operationId: string; outputPath: string };
  "canvas.export.failed": { operationId: string; error: string };

  // Entity mapping
  "canvas.entity.detected": { nodeId: string; flowtiType: FlowtiCanvasType; title: string };
  "canvas.entity.created": { nodeId: string; docType: DocType; path: string };
}
```

---

## Implementation Phases

### Phase 1: Canvas Parser (Foundation)

Port the parsing logic from `canvas-import-core.js` into a typed TypeScript module.

**`CanvasParser.ts`** — Pure functions, no Obsidian dependencies, fully testable:

- `parseCanvasJson(json: string): CanvasDocument` — Parse raw canvas JSON into typed structure
- `extractLegend(nodes): ColorTypeMapping | null` — Find legend group and extract color mappings
- `resolveNodeType(node, legend?): FlowtiCanvasType` — Map node to Flowti type using legend → shape → color → default
- `resolveParentage(nodes): void` — Assign parent groups via bounding-box containment (smallest enclosing group)
- `buildRelations(nodes, edges): void` — Translate edges into directional relations (up/down/prev/next based on fromSide/toSide)

**Tests**: Migrate the implicit test cases from the QuickAdd scripts into proper Vitest tests. Cover: legend extraction, type mapping (all shape types, all color codes), parent resolution (nested groups, self-parent prevention), edge relation mapping.

### Phase 2: Canvas Importer (Core Feature)

Create notes from canvas nodes, integrating with the existing `DocService` and entity path system.

**`CanvasImporter.ts`**:

- `importCanvas(config: CanvasImportConfig): Promise<CanvasImportResult>` — Main orchestrator
- Entity detection: When `entityMapping` is enabled, recognize canvas nodes as domain entities:
  - Groups labeled as domains → create `DomainDoc` via `doc.create`
  - Nodes typed as Service/System/Actor/Flow → create corresponding docs
  - Nodes typed as Event → create `EventDoc` and register with DiscoveryService
  - Relations become wikilinks between the created entity docs
- Standard import: Create notes with frontmatter (type, status, parent, relations) in the target folder
- Create `.base` index file with filters for the target folder
- Rebuild canvas with file-node references pointing to created notes

**Integration points**:
- Emit `doc.create` events for entity docs (reuse existing DocService pipeline)
- Emit `discovery.create` for discovered events (reuse existing DiscoveryService)
- Use `FileSystemClient` for all vault operations
- Use `CanvasExporter.buildCanvas()` for the rebuilt canvas

### Phase 3: Canvas Exporter (Visualization)

Generate canvas files from Flowti data structures.

**`CanvasExporter.ts`**:

- `exportDomain(domainName: string, config): Promise<string>` — Visualize a domain with its services, events, and flows
- `exportFlow(flowName: string, config): Promise<string>` — Visualize a single flow as a process diagram
- `exportEventCatalog(config): Promise<string>` — Full event catalog visualization
- `exportSystem(systemName: string, config): Promise<string>` — System architecture diagram
- `buildCanvasJson(nodes, edges): string` — Low-level canvas JSON builder

**`CanvasLayoutEngine.ts`**:

- `layoutHierarchical(nodes, edges): void` — Tree layout for domain hierarchies
- `layoutGrid(nodes): void` — Grid layout for flat entity lists
- Simple auto-positioning using node dimensions and configurable spacing

### Phase 4: CanvasService (Orchestrator)

Register as service #12 in the ServiceContainer.

**`CanvasService.ts`**:

- Depends on: `eventBus`, `fileSystem`, `settingsService`
- Listens for: canvas file open events, commands
- Exposes: import/export operations for UI consumption
- Manages: saved config persistence via `loadStateFromStorage`/`saveStateToStorage`

### Phase 5: UI Integration

**Canvas Catalog Tab** — Add a 9th tab to `EventCatalogView`:

- List all `.canvas` files in the vault
- Quick actions: import, export, open in Obsidian
- Preview: node/edge counts, detected entity types

**Canvas section in Data Exchange Hub**:

- Canvas as an import source alongside CSV
- Saved canvas import configs (like saved CSV import configs)
- Import history

**Commands**:

- `flowti:import-canvas` — Open canvas import wizard
- `flowti:export-to-canvas` — Open canvas export wizard

### Phase 6: Round-trip Sync (Future)

After Azure integration provides rich data sources:

- Watch canvas files for changes → sync back to vault notes
- Detect manual canvas edits → update entity docs
- Bidirectional: edit domain in catalog → regenerate canvas visualization

---

## Entity Mapping Convention

Canvas nodes map to Flowti entities based on this convention:

| Canvas Convention | Flowti Entity | Doc Type |
|---|---|---|
| Group (no color) labeled as domain name | Domain | `DomainDoc` |
| Node color=2 (orange) "Epic" or legend-mapped | Domain grouping | — |
| Node with shape `circle` | Event | `EventDoc` |
| Node color=6 (purple) or legend "Feature" | Feature / Flow | `FlowDoc` |
| Node inside a domain group, typed "Service" | Service | `ServiceDoc` |
| Node typed "System" | System | `SystemDoc` |
| Node typed "Actor" | Actor | `ActorDoc` |
| Group labeled "Legend" | Type mapping config | — |
| Edge with label | Named relation | Wikilink |

This extends the existing `DEFAULT_COLOR_MAP` and `shape → type` mapping from `canvas-import-constants.js`.

---

## Migration from QuickAdd Scripts

The existing `var/scripts/canvas-importer/` and `var/scripts/quickadd/import-canvas.js` will remain as-is for backward compatibility during the transition. The new native implementation:

1. Absorbs all logic from `canvas-import-core.js` into `CanvasParser.ts`
2. Absorbs `canvas-import-notes.js` into `CanvasImporter.ts`
3. Absorbs `canvas-import-canvas.js` into `CanvasExporter.ts`
4. Removes the QuickAdd/Modal Forms dependency (uses native Obsidian modals)
5. Integrates with the event-driven architecture (events instead of direct calls)

---

## Sequencing

1. **After Azure integration** — Access to rich data sources for meaningful canvas visualizations
2. **Phase 1-2 first** — Parser + Importer are the highest-value deliverables
3. **Phase 3 in parallel** — Exporter can be developed independently
4. **Phase 4-5 integrate** — Service registration + UI after core is stable
5. **Phase 6 later** — Round-trip sync is a future cycle

---

## Knowledge Graph Strengthening

Canvas integration strengthens the knowledge graph by:

- **Visual domain modeling** — Design domains, services, and flows visually, then import as structured entities
- **Event discovery** — Draw event flows on canvas → import creates `EventDoc` files → DiscoveryService picks them up
- **Documentation generation** — Import from canvas auto-generates entity docs with cross-references (wikilinks)
- **Bidirectional truth** — Canvas becomes both a design tool and a visualization of the living system
- **Spatial semantics** — Edge directions (top/bottom = hierarchy, left/right = sequence) encode meaningful relationships that translate to frontmatter relations (up/down/prev/next)
