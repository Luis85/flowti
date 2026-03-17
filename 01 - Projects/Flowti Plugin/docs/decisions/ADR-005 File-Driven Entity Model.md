---
type: DecisionNote
adr: ADR-005
title: File-Driven Entity Model (Markdown + Frontmatter)
status: Accepted
date: 2026-02-01
domain: ui
category: Architecture
drivers:
  - User Ownership
  - Obsidian-Native
  - Extensibility
tags:
  - decision
  - architecture
  - data-model
---

# ADR-005: File-Driven Entity Model (Markdown + Frontmatter)

## Status

**Accepted** — adopted Feb 2026, replacing code-only entity definitions.

## Context

The Event Catalog needs to display domains, services, flows, systems, actors, and products. Initially these were defined purely in code (e.g., `customDomains` in settings). But users need to:

- Create, edit, and delete entities using Obsidian's native editor
- Add rich documentation beyond what a settings array can hold
- Link entities to each other using Obsidian's wikilinks
- Version-control their domain model alongside their vault

### Alternatives Considered

1. **Code-only definitions** (previous approach) — `customDomains: string[]` in settings — limited, no rich content
2. **Database tables** — structured but fights Obsidian's file-first paradigm
3. **Markdown files with typed frontmatter (chosen)** — entities are `.md` files with `type: DomainDoc` (etc.) in frontmatter

## Decision

All catalog entities are defined as Markdown files with typed YAML frontmatter. The catalog merges file-driven entries with code-registered metadata (from `CATALOG_DATA`) to produce a unified view.

### Document Types

17 document types defined, each with a specific frontmatter schema:

- **Entity types**: `EventDoc`, `DomainDoc`, `ServiceDoc`, `CategoryDoc`, `FlowDoc`, `SystemDoc`, `ActorDoc`, `ProductDoc`
- **Data Exchange types**: `CsvDoc`, `PropertyDoc`, `TypeDoc`, `ImportConfigDoc`, `ExportConfigDoc`, `PipelineConfigDoc`
- **Special types**: `AreaDoc`, `ArchitectureDoc`, `ServiceBlueprintDoc`

### Hybrid Scanning

Each catalog tab scans its folder at render time via `metadataCache`, then merges with catalog data:

- `filePath: string` → documented (file exists)
- `filePath: null` → undocumented (catalog-derived only, shown with "Create Doc" action)

### Forgiving Frontmatter

The `fmString()` helper reads frontmatter with fallback field names (e.g., `domain` → `name` → filename), and `normalizeDocFrontmatter()` auto-updates non-conforming files.

## Consequences

### Positive

- **User ownership**: Users control their domain model with standard Markdown editing
- **Obsidian-native**: Wikilinks, backlinks, graph view, and search all work naturally
- **Version-controllable**: Entities are plain text files, tracked in Git alongside the vault
- **Rich content**: Each entity doc can include sections, diagrams, links — no schema limits

### Negative

- **metadataCache timing**: After `createFile()`, the cache hasn't indexed frontmatter yet — requires `setTimeout(500ms)` before scan-based re-render
- **Scan cost**: Every render triggers a folder scan — acceptable for current scale (~50 files per folder)
- **Schema drift**: Users can edit frontmatter incorrectly — mitigated by auto-normalization

## Related

- [[Data Dictionary]] — Full frontmatter schemas
- [[Frontend Architecture]] — Scan methods, forgiving frontmatter
- [[ADR-009 DocService Centralization]]
