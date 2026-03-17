---
type: DecisionNote
adr: ADR-033
title: Canvas File Format as Configuration Storage
status: Proposed
date: 2026-02-20
domain: infrastructure
category: Storage
drivers:
  - Visual Configuration
  - Obsidian-Native Editing
  - Relationship Discoverability
  - User Empowerment
tags:
  - decision
  - canvas
  - storage
  - configuration
  - visualization
---

# ADR-033: Canvas File Format as Configuration Storage

## Status

**Proposed** — exploring the use of Obsidian's `.canvas` format as a visual, editable storage layer for plugin configuration.

## Context

Plugin configuration is currently stored as an opaque JSON blob inside Obsidian's `data.json` via `loadData()`/`saveData()` (ADR-004). This works well for machine consumption but has significant limitations:

1. **Invisible to users** — configuration lives inside a hidden file that Obsidian does not render or index
2. **No spatial reasoning** — import pipelines, entity relationships, and subscription topologies are flat lists with no visual structure
3. **No native editing** — users must use plugin-provided UI or hand-edit JSON to change configurations
4. **No relationship visibility** — connections between configs (e.g., import config → target folder → base file → export config) are implicit, stored as string references

Meanwhile, Obsidian's Canvas format (`.canvas`) is a JSON file with first-class support in the application:

```json
{
  "nodes": [
    { "id": "abc", "type": "text", "text": "...", "x": 0, "y": 0, "width": 300, "height": 200, "color": "2" },
    { "id": "def", "type": "group", "label": "Import Configs", "x": -20, "y": -20, "width": 640, "height": 440 },
    { "id": "ghi", "type": "file", "file": "path/to/note.md", "x": 400, "y": 0, "width": 300, "height": 200 }
  ],
  "edges": [
    { "id": "e1", "fromNode": "abc", "toNode": "ghi", "fromSide": "right", "toSide": "left", "label": "feeds into" }
  ],
  "metadata": { "version": "1.0-1.0", "frontmatter": {} }
}
```

Canvas files are:
- **Rendered natively** by Obsidian with a spatial infinite canvas
- **Editable visually** — users can drag, connect, group, and annotate nodes
- **Indexed by metadataCache** — discoverable via vault search and graph view
- **JSON-based** — trivially readable and writable by plugin code
- **Structured** — nodes carry typed content (`text`, `group`, `file`), edges express directional relationships

This creates an opportunity: use `.canvas` files as a **visual configuration layer** where users see, understand, and edit their configurations spatially.

### Alternatives Considered

1. **Status quo (JSON blob only)** — machine-efficient but user-opaque. Users have no spatial model of their configuration landscape.
2. **Markdown frontmatter configs** — visible but limited to flat key-value pairs. Cannot express relationships natively. Already used for entity definitions (ADR-005).
3. **Canvas as configuration storage (proposed)** — leverages Obsidian's spatial canvas as both the storage format and the editing surface.
4. **Canvas as visualization only (read-only projection)** — generate canvas files from JSON blob state for viewing but don't read them back. Simpler but loses the editing benefit.

## Decision

### Principle: Canvas as Editable Configuration Surface

Selected configuration types are stored as `.canvas` files in the vault. The plugin reads canvas files to load configuration and writes canvas files to persist changes. Users can edit these configurations either through plugin UI or by directly manipulating the canvas in Obsidian.

### Applicable Configuration Types

Not all configuration is suited for canvas storage. The selection criteria are:

| Criterion | Canvas-Suitable | JSON-Blob-Suitable |
|-----------|----------------|-------------------|
| Has relationships to visualize | Yes | No |
| Benefits from spatial layout | Yes | No |
| User wants to edit/curate | Yes | No |
| Simple scalar values | No | Yes |
| High-frequency read/write | No | Yes |
| Requires Zod schema validation | Either | Yes |

Based on these criteria:

| Configuration | Storage | Rationale |
|--------------|---------|-----------|
| Import/Export pipelines | Canvas | Multi-source flows with ordering and relationships |
| Subscription topologies | Canvas | Event → subscriber wiring is inherently a graph |
| Entity relationship maps | Canvas | Domains → services → events form a visual hierarchy |
| Session templates | Canvas | Combine intent, tasks, context bindings visually |
| Hub page layouts | Canvas | Spatial arrangement of hub sections and widgets |
| FlowtiSettings (scalars) | JSON blob | Simple key-value pairs, no relationships |
| Catalog category toggles | JSON blob | Boolean flags, no spatial meaning |
| Ingestion tuning params | JSON blob | Numeric thresholds, no visual benefit |

### Canvas Schema Convention

Each canvas-stored config type defines a **node schema** — a mapping from canvas node properties to configuration fields:

```typescript
interface CanvasConfigNode {
  id: string;                        // Stable identifier (UUID)
  type: "text" | "group" | "file";   // Obsidian canvas node type
  text?: string;                     // For text nodes: contains structured content
  label?: string;                    // For group nodes: config category name
  file?: string;                     // For file nodes: vault path reference
  color?: string;                    // Semantic color coding (by config type)
  x: number; y: number;             // Spatial position (user-arrangeable)
  width: number; height: number;     // Node dimensions
}

interface CanvasConfigEdge {
  id: string;
  fromNode: string;                  // Source config node ID
  toNode: string;                    // Target config node ID
  fromSide: "top" | "right" | "bottom" | "left";
  toSide: "top" | "right" | "bottom" | "left";
  label?: string;                    // Relationship type (e.g., "feeds into", "triggers")
}
```

**Structured content in text nodes** uses a lightweight convention: the node's `text` field contains a markdown block with YAML-fenced config data:

```markdown
## Import: Customer Data
​```yaml
sourcePath: 00 - Connectivity/imports/customers.csv
targetFolder: 02 - Areas/CRM/Customers
nameColumn: company_name
conflictStrategy: update
​```
```

This keeps the canvas visually readable (the markdown renders in the canvas) while carrying structured data the plugin can parse.

### Storage Location

Canvas config files live in a dedicated folder:

```
var/config/
├── pipelines.canvas          # Import/export pipeline topology
├── subscriptions.canvas      # Event subscription wiring
├── entity-map.canvas         # Domain → service → event relationships
├── session-templates.canvas  # Reusable session configurations
└── hub-layout.canvas         # Hub page spatial arrangement
```

The `var/config/` path is configurable via `FlowtiSettings.configCanvasPath`.

### Read/Write Protocol

**Reading (canvas → config):**

1. Read `.canvas` file as JSON via `FileSystemClient`
2. Parse nodes and edges into typed arrays
3. Extract structured YAML from text node content
4. Validate extracted config against Zod schemas (same schemas as JSON blob configs)
5. Build in-memory config objects from validated data
6. Spatial positions (`x`, `y`) are preserved but not semantically meaningful to the plugin — they are user-owned layout data

**Writing (config → canvas):**

1. Serialize config objects to YAML blocks inside text node markdown
2. Preserve existing node positions and dimensions (never overwrite spatial layout)
3. Preserve user-added annotations (text nodes without config YAML are left untouched)
4. Add/remove/update only the config-carrying nodes
5. Write the complete canvas JSON back via `FileSystemClient`

**Conflict handling:**

- If a user edits the canvas while the plugin is writing, the file-modified event triggers a re-read on next access (scan-on-render pattern, per ADR-032)
- Config YAML blocks are the source of truth inside the canvas — decorative nodes and annotations are ignored during config extraction
- Nodes are identified by stable `id` (UUID), not by position or content

### Color Convention

Canvas node colors map to config categories for visual clarity:

| Color Code | Category | Example |
|-----------|----------|---------|
| `"1"` (red) | Import sources | CSV files, external data |
| `"2"` (orange) | Domains & entities | Domain nodes, service nodes |
| `"3"` (yellow) | Actions & tasks | Pipeline steps, session tasks |
| `"4"` (green) | Outputs & targets | Export targets, generated docs |
| `"5"` (cyan) | User stories & intent | Session intent, goals |
| `"6"` (purple) | Infrastructure | Event subscriptions, system configs |

### Migration Path

1. **Phase 1 — Pipeline canvas (first target):** Implement canvas read/write for import/export pipelines. This is the highest-value use case because pipelines are multi-source flows with explicit ordering. Existing `SavedMultiImportPipeline` configs in TypedStorage are migrated to `var/config/pipelines.canvas` on first load.
2. **Phase 2 — Subscription topology:** Represent event → subscriber wiring as a canvas. Read-only projection first, then editable.
3. **Phase 3 — Session templates and entity maps:** Extend to remaining config types.
4. **Phase 4 — Hub layout:** Allow users to arrange hub page sections spatially.

Each phase ships independently. JSON blob storage remains the fallback — if a canvas file is missing or corrupt, the plugin falls back to TypedStorage.

### Canvas File Lifecycle

- **Creation:** Generated on first access or via "Initialize Config Canvas" command
- **Updates:** Plugin writes config changes; user edits spatial layout and annotations
- **Deletion:** If user deletes a config canvas, the plugin recreates it from TypedStorage on next access (TypedStorage remains the persistence backup)
- **Installer:** The installer wizard (InstallerService) scaffolds `var/config/` with empty canvas files seeded with group nodes for each config category

## Consequences

### Positive

- **Visual understanding** — users see their pipeline topology, subscription wiring, and entity relationships as spatial diagrams rather than flat lists
- **Native editing** — users can rearrange, annotate, and connect configurations using Obsidian's canvas tools without leaving the app
- **Relationship discovery** — edges between nodes make implicit relationships explicit (e.g., "this import feeds this export", "this event triggers these subscribers")
- **Documentation as configuration** — canvas files are vault citizens — they appear in search, graph view, and can be linked from other notes
- **Annotation freedom** — users can add explanatory text nodes, color-code groups, and attach file references alongside config nodes
- **Existing infrastructure** — `FileSystemClient` already handles JSON read/write; `metadataCache` already indexes `.canvas` files

### Negative

- **Parsing complexity** — extracting structured YAML from canvas text nodes is more fragile than reading a typed JSON blob. Malformed user edits to YAML blocks break config loading.
- **Canvas format dependency** — Obsidian's `.canvas` format is not formally versioned with stability guarantees. Format changes could break parsing.
- **Dual storage** — TypedStorage remains the backup/fallback, creating a second reconciliation concern (similar to ADR-032's vault metadata challenge). The ownership rule: canvas is canonical for canvas-stored configs when the file exists; TypedStorage is the fallback.
- **Spatial layout is user-owned** — the plugin must never reflow or auto-layout nodes, which means programmatic changes (adding a new pipeline step) must pick reasonable default positions without disrupting existing layout.
- **Performance** — canvas files with many nodes (100+) may be slower to parse than flat arrays in TypedStorage. Mitigation: config canvases are small (typically 10–50 nodes).

### Risks

| Risk | Mitigation |
|------|------------|
| Obsidian changes `.canvas` format | Pin to `metadata.version` field; add migration on version bump |
| User corrupts YAML in text nodes | Zod validation on read; fall back to TypedStorage; surface validation error in UI |
| Canvas and TypedStorage diverge | Canvas is canonical when present; TypedStorage is write-behind backup updated on every canvas write |
| Large canvas files degrade perf | Partition by config type (separate files); lazy-load on demand |
| User accidentally deletes config node | Undo via Obsidian's canvas undo; TypedStorage backup enables full restore |

## Related

- [[ADR-004 Single JSON Blob Storage]] — current storage strategy; remains as fallback
- [[ADR-005 File-Driven Entity Model]] — precedent for vault files as data source
- [[ADR-017 Zod Schema Validation for Settings]] — validation applies to canvas-extracted configs too
- [[ADR-032 Plugin State and Vault Metadata Reconciliation]] — dual storage ownership pattern
- [[L-27 Canvas files are natural session anchors]] — learning that inspired canvas-as-storage exploration
- [[Canvas session workspace opens canvas as session anchor with sidebar monitor]] — related canvas integration idea
