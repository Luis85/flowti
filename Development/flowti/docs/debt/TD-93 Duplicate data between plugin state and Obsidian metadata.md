---
type: TechDebt
severity: medium
category: architecture
layer: infrastructure
status: open
effort: large
updated: 2026-02-18
description: Plugin state (TypedStorage) and Obsidian metadata (frontmatter, metadataCache) can hold duplicate or conflicting data. No reconciliation strategy exists.
---
# TD-93: Duplicate data between plugin state and Obsidian metadata

## Problem

How can we integrate better with the Obsidian MetaData to avoid duplicate data?

The plugin maintains its own state in TypedStorage (JSON blobs in `data.json`) while Obsidian maintains metadata via frontmatter and `metadataCache`. Several data points exist in both:

- **Event definitions** — stored in `EventDefinitionState` AND in vault markdown files with frontmatter
- **Subscriptions** — stored in `SubscriptionState` AND referenced in event documentation files
- **Entity references** (domains, services, flows) — scanned from `metadataCache` frontmatter AND tracked in entity scanner caches
- **Session notes** — persisted as `session.notes` string AND as vault markdown files (`notesFile`)

When these diverge, the user sees inconsistent state depending on which view they're looking at (Event Catalog vs. vault file).

## Impact

- Data can get out of sync when files are edited externally (e.g., via another plugin or direct text editing)
- Plugin state and vault metadata may disagree about which events have definitions
- Rebuilding plugin state from vault files is not possible (one-way sync only)
- Users may unknowingly have stale data in one system

## Suggested Remediation

1. **Audit**: Map all data that exists in both TypedStorage and vault frontmatter
2. **Single source of truth**: For each data point, decide whether TypedStorage or vault frontmatter is canonical
3. **Reconciliation on load**: When plugin loads, reconcile TypedStorage state against `metadataCache`
4. **Event-driven sync**: When vault files change (`metadataCache.changed`), update TypedStorage state if frontmatter is canonical
5. **Consider vault-first**: For data that users might edit (event definitions, subscriptions), vault frontmatter could be the source of truth with TypedStorage as a cache

## Related

- TD-90: Event Catalog and Data Dictionary are manually maintained
- ADR-004: Single JSON Blob Storage
