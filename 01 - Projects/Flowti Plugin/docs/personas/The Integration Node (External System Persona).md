---
type: Actor
stage: done
description: "External systems that participate as actors in the event-driven architecture"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
roles:
  - user
related_domains:
  - signal
  - data-exchange
  - ingestion
  - event-catalog
---
# The Integration Node (External System Persona)

## Identity

### Name & Role

The Integration Node — external systems that participate as actors in Flowti's event-driven architecture.

### Archetype

Not a user — an actor in the event system. External systems that produce or consume data through Flowti's Signal Integration and Data Exchange Hub. Each integration node has defined attributes for data format, sync behavior, authority level, and conflict resolution.

### Quote

> "I am not a person. I am a data source with a contract, a sync frequency, and conflict rules."

### Profile Summary

Integration Nodes are the external systems that Flowti connects to via Signal Integration and the Data Exchange Hub. They are modeled as system personas (actors) within the Event Catalog rather than as users. Each node has specific attributes: data format, sync frequency, authority level, conflict rules, and signal direction. As of February 2026, Azure DevOps is the first fully delivered signal connector, with canvas files supported as import sources through the Data Exchange Hub.

## Connected Systems

### Delivered

| System | Connection Type | Status | Integration Method |
|---|---|---|---|
| Azure DevOps | Signal Integration | Delivered ✓ | PAT auth, WIQL queries, inbound pull, per-item error resilience |
| Obsidian Canvas Files | Data Exchange Hub | Delivered ✓ | Canvas parser, node→note mapping, hierarchy detection |
| CSV Data Sources | Data Exchange Hub | Delivered ✓ | CSV import with merge keys, multi-source pipelines |
| Base Files | Data Exchange Hub | Delivered ✓ | Base file integration within vault |

### Planned

| System | Connection Type | Status |
|---|---|---|
| Epicor Prophet 21 | Signal Integration | Planned |
| Microsoft 365 | Signal Integration | Planned |
| Shopify | Signal Integration | Planned |

These are not users — they are **actors in your event system**.

They should be modeled as:

> System Personas (Actors) within the [[Event Catalog]]

## System Persona Attributes

Each Integration Node is defined by these attributes:

| Attribute | Description | Example (Azure DevOps) |
|---|---|---|
| Data format | Structure of incoming/outgoing data | Work items (JSON via REST API) |
| Sync frequency | How often data is synchronized | On-demand via command palette, or scheduled |
| Authority level | Who is the source of truth | Azure DevOps is authoritative for work items |
| Conflict rules | How conflicts are resolved | Skip, Update, or Overwrite strategies |
| Signal direction | Direction of data flow | Inbound (receive into vault) |
| Authentication | How the connection is secured | PAT (Personal Access Token) |
| Query method | How data is selected for sync | WIQL (Work Item Query Language) |
| Error handling | How failures are managed | Per-item error resilience (one failure doesn't stop the batch) |

## Signal Configuration (Delivered)

The Azure DevOps signal connector demonstrates the delivered integration pattern:

- **Authentication**: PAT-based, stored securely in plugin settings
- **Query**: WIQL queries select which work items to sync
- **Direction**: Inbound pull — Flowti pulls data from Azure DevOps
- **Conflict Strategies**:
  - `skip` — Don't update if local version exists
  - `update` — Merge new fields, preserve local additions
  - `overwrite` — Replace local with remote data
- **Error Resilience**: Per-item error handling; one failed work item does not block the rest
- **Trigger**: Command palette sync for on-demand execution

## Data Exchange Sources (Delivered)

The Data Exchange Hub supports these non-signal data sources:

- **CSV files** — Import with merge keys for deduplication, export with formulas
- **Canvas files** — Obsidian .canvas → vault notes via canvas parser with hierarchy detection (flat/nested/grouped)
- **Base files** — Structured data within the vault
- **JSON export** — Structured data export for external consumption
- **Markdown export** — Human-readable documentation export

## Domain Interaction Map

| Domain | Interaction Level | Primary Use |
|---|---|---|
| signal | Heavy | Azure DevOps work item sync |
| data-exchange | Heavy | CSV/canvas/Base import and export |
| ingestion | Heavy | Data pipeline orchestration |
| event-catalog | Moderate | Actor registration, system entity modeling |
| documentation | Light | System documentation |

## Related Artifacts

### Features Used

- [[Signal Integration]]
- [[Data Exchange Hub]]
- [[Event Catalog]]
- [[Canvas Integration]]

This will become foundational for Signal PRDs as additional connectors (Epicor Prophet 21, Microsoft 365, Shopify) are developed.
