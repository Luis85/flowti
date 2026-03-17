---
type: DecisionNote
adr: ADR-004
title: Single JSON Blob Storage via IStorageProvider
status: Accepted
date: 2026-01-15
domain: infrastructure
category: Data
drivers:
  - Obsidian API Constraints
  - Simplicity
  - Consistency
tags:
  - decision
  - architecture
  - storage
---

# ADR-004: Single JSON Blob Storage via IStorageProvider

## Status

**Accepted** — constrained by Obsidian plugin API.

## Context

Obsidian plugins persist data via `loadData()` / `saveData()`, which reads and writes a single JSON file (`data.json` in the plugin folder). There is no built-in key-value store, database, or per-service storage.

With 11 domain services needing to persist state, we need a strategy for sharing this single JSON blob without conflicts.

### Alternatives Considered

1. **Each service manages its own file** — requires custom file I/O, bypasses Obsidian's API, risk of corruption
2. **Single object with service-specific keys (chosen)** — each service gets a top-level key in the shared JSON blob
3. **External database (SQLite, IndexedDB)** — overkill for an Obsidian plugin, adds complexity

## Decision

All services share a single `IStorageProvider` adapter that wraps `loadData()` / `saveData()`. Each service uses a unique storage key:

| Service | Key | Shape |
|---------|-----|-------|
| SettingsService | *(top-level keys)* | `debugMode`, `docsRootPath`, etc. |
| UserService | `user` | `{ id, name, createdAt }` |
| EventFilterService | `eventFilter` | `{ excludedTypes: string[] }` |
| SubscriptionService | `subscription` | `{ subscriptions: Record<string, Subscription> }` |
| IngestionService | `ingestion` | `{ processedKeys, pendingJobs }` |
| DataExchangeService | `dataExchange` | `{ savedImportConfigs, savedExportConfigs, ... }` |
| InstallerService | `installer` | `{ installed, completedSteps }` |
| ... | ... | ... |

### Critical Rule: Load Before Use

Every service that persists state must call `load()` explicitly during `onLayoutReady()`. Without this, internal state stays at `DEFAULT_SETTINGS` and any event-driven update overwrites persisted data (the "dual-state bug" discovered Feb 2026).

## Consequences

### Positive

- **Simplicity**: One JSON file, one adapter interface, no external dependencies
- **Consistency**: All services use the same persistence pattern
- **Portability**: Plugin data moves with the vault (it's just a JSON file in `.obsidian/plugins/`)

### Negative

- **Concurrency risk**: Two services saving simultaneously could lose writes — mitigated by sequential init and event-driven updates
- **Growing blob**: As more services add data, the JSON file grows — acceptable at current scale (~10KB)
- **No partial load**: Reading one service's data requires loading the entire blob

## Related

- [[Backend Architecture]] — Storage Schema section
- [[Data Dictionary]] — Full schema reference
- [[ADR-017 Zod Schema Validation for Settings]]
