---
type: DecisionNote
adr: ADR-032
title: Plugin State and Vault Metadata Reconciliation
status: Accepted
date: 2026-02-19
domain: infrastructure
category: Data
drivers:
  - Data Consistency
  - Obsidian-Native Integration
  - Single Source of Truth
tags:
  - decision
  - architecture
  - storage
  - metadata
---

# ADR-032: Plugin State and Vault Metadata Reconciliation

## Status

**Accepted** — establishes canonical data ownership rules and reconciliation strategy.

## Context

The plugin maintains dual data stores:

1. **TypedStorage** (`data.json` via `loadData()`/`saveData()`) — fast, in-memory, plugin-controlled
2. **Vault metadata** (frontmatter in markdown files, indexed by `metadataCache`) — user-editable, Obsidian-native

Several data points exist in both:

| Data Point | TypedStorage | Vault Metadata |
|-----------|-------------|----------------|
| Event definitions | `eventDefinition.definitions` | `type: "Event"` frontmatter files |
| Subscriptions | `subscription.subscriptions` | Referenced in event doc files |
| Entity references | Entity scanner caches | `metadataCache` frontmatter scan |
| Session notes | `session.notes` string field | `notesFile` markdown content |
| Import/Export configs | `dataExchange.saved*Configs` | Config doc files via ConfigDocService |

When these diverge, users see inconsistent state depending on which view they use (Event Catalog vs. vault file, session workspace vs. notes file).

### Alternatives Considered

1. **Vault-first (all data in frontmatter)** — makes data visible in Obsidian but requires parsing on every access, loses structured query capability
2. **Plugin-first (TypedStorage only)** — fast and consistent, but users can't leverage Obsidian's native editing, search, and graph view for plugin data
3. **Hybrid with clear ownership (chosen)** — each data point has one canonical source, with reconciliation where needed

## Decision

### Ownership Rules

Each data point has exactly one **canonical source** (the source of truth when they disagree):

| Data Point | Canonical Source | Reason |
|-----------|-----------------|--------|
| Event definitions (configuration) | TypedStorage | Plugin manages creation/deletion lifecycle |
| Event definition docs | Vault files | Generated artifacts, user may edit |
| Subscriptions | TypedStorage | Pure plugin state, no user-facing file |
| Entity references (domains, services, flows) | Vault files | Scanned fresh from `metadataCache` on each render |
| Session state (status, goals, tasks) | TypedStorage | State machine integrity requires plugin control |
| Session notes content | **Bidirectional** | Forward sync (plugin → file) + reverse sync (file → plugin) |
| Import/Export configs | TypedStorage | Config docs are generated output, not source |

### Reconciliation Strategy

**1. Scan-on-render (entities):** Entity scanners (`scanDomains()`, `scanServices()`, etc.) query `metadataCache` at the top of each render cycle. No caching — always fresh. This is already implemented.

**2. Bidirectional sync (session notes):** Session notes use the `noteSyncFile` pattern with write-timestamp suppression to prevent sync loops. Forward sync runs on state changes; reverse sync runs on `file.modified` events. See ADR-031 §7 for sync architecture.

**3. Load-time validation (settings):** `SettingsService` validates TypedStorage data against `FlowtiSettingsSchema` (Zod) on load. Invalid data falls back to `DEFAULT_SETTINGS`. See ADR-017.

**4. No automatic reconciliation (definitions/subscriptions):** Event definitions and subscriptions are purely plugin-managed. If the user deletes or edits a generated doc file, the plugin state is unaffected. The doc is a read-only projection of plugin state.

### Non-Goals

- **No live two-way sync for definitions/subscriptions** — the complexity of bidirectional sync for structured config data outweighs the benefit. Session notes are the exception because they are explicitly designed for user editing.
- **No cache invalidation on file events** — entity scanners already bypass caching by scanning fresh each render.
- **No migration of existing TypedStorage to vault files** — the single JSON blob (ADR-004) remains the primary persistence layer.

## Consequences

### Positive

- **Clear ownership** prevents conflicting updates — each data point has one authority
- **Scan-on-render** ensures entity data is always fresh without complex sync logic
- **Session notes bidirectional sync** enables natural user editing while preserving state machine integrity
- **Generated docs as projections** means users can freely edit docs without corrupting plugin state

### Negative

- **Generated docs can drift** — if plugin state changes, generated doc files may become stale until re-generated
- **No single unified view** — users must use the Event Catalog UI for definitive state, not vault files
- **Session notes sync adds complexity** — reverse parsing, suppression windows, debounce timers

### Mitigations

- ConfigDocService regenerates docs on config changes (import/export configs)
- `doc.create` events keep definition docs in sync with plugin state
- Session notes sync has extensive test coverage (forward + reverse + suppression + loop prevention)

## Related

- [[ADR-004 Single JSON Blob Storage]] — TypedStorage is the primary persistence layer
- [[ADR-017 Zod Schema Validation for Settings]] — load-time validation
- [[ADR-031 Session v2 Architecture]] — bidirectional note sync
- [[TD-93 Duplicate data between plugin state and Obsidian metadata]] — the debt item this ADR addresses
- [[TD-90 Event Catalog and Data Dictionary are manually maintained]] — related manual maintenance concern
