---
severity: low
category: architecture
layer: ui
status: open
created: 2026-02-14
description: Catalog tabs use entityScanner.ts for file-driven entity scanning; Hub tabs implement their own scanning logic against storage. Duplication is minor and low ROI to fix.
source: "[[Frontend Architecture]]"
---
# TD-28: Scanner duplication between Catalog and Hub

## Problem

Catalog tabs (`DomainsTab`, `ServicesTab`, `FlowsTab`, `SystemsTab`, `ActorsTab`, `ProductsTab`) use shared scanning methods via `entityScanner.ts` and `metadataCache` to discover file-driven entities from the vault.

Hub tabs (`ImportsTab`, `ExportsTab`, `PipelinesTab`, `PropertiesTab`, `TypesTab`) implement their own scanning logic, but these are primarily storage-driven (reading from `DataExchangeService` persisted configs) rather than file-driven.

## Impact

- Minor code duplication in scanning patterns
- Two slightly different approaches to listing entities

## Assessment

Low ROI to fix. The scanning approaches serve different data sources:
- **Catalog**: file system → `metadataCache` → frontmatter parsing
- **Hub**: service storage → config arrays → optional doc file check

Generalizing into a single scanner would add abstraction complexity without meaningful benefit since the data sources are fundamentally different.

## Affected Files

- `src/ui/catalog/DomainsTab.ts` (scanDomains)
- `src/ui/catalog/ServicesTab.ts` (scanServices)
- `src/ui/catalog/FlowsTab.ts` (scanFlows)
- `src/ui/hub/ImportsTab.ts` (reads from DataExchangeService)
- `src/ui/hub/ExportsTab.ts` (reads from DataExchangeService)
