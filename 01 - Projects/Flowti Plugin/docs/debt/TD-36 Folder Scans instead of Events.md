---
type: TechDebt
status: open
severity: low
effort: medium
layer: infrastructure
category: architecture
updated: 2026-02-16
description: Entity tab scan methods (scanDomains, scanFlows, etc.) directly query metadataCache during render. Could be event-driven but adds complexity for marginal benefit.
---
# TD-36: Folder Scans instead of Events

Relates to [[TD-32 normalizeDocFrontmatter writes during render]]

## Current Design

Scans are read-only (TD-32 resolved). Non-conforming files are collected during scan. Normalization happens once per session (deduplicated) after scan completes. This eliminates writes during render while preserving auto-normalization behavior.

## Assessment (2026-02-16)

The current scan-based approach (6 entity tabs each call `scan*()` at top of `renderMaster()`) works well in practice. Scans query `metadataCache` which is fast and always up-to-date. An EventBus-driven approach would require:
1. File watcher events for doc folder changes
2. State management in a new service
3. Event-to-UI state synchronization

This adds architectural complexity for marginal benefit since the current scans are lightweight (read-only metadataCache queries) and run only on user navigation. **Defer unless scan performance becomes measurable.**

## To consider

An EventBus approach would be better suited if:
- The number of doc files grows significantly (100+)
- Multiple views need the same scan data simultaneously
- Real-time reactivity is needed (e.g., live dashboard updates)

## Affected Files

- `src/ui/catalog/DomainsTab.ts` (scanDomains)
- `src/ui/catalog/ServicesTab.ts` (scanServices)
- `src/ui/catalog/FlowsTab.ts` (scanFlows)
- `src/ui/catalog/SystemsTab.ts` (scanSystems)
- `src/ui/catalog/ActorsTab.ts` (scanActors)
- `src/ui/catalog/ProductsTab.ts` (scanProducts)
