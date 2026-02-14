---
severity: low
category: architecture
layer: ui
status: mitigated
updated: 2026-02-14
effort: large
description: Multiple UI files exceed 500 LOC. The original 4 files exceeding 1,000 LOC have been significantly reduced through Phases 1-10 component extraction, but 14 files still exceed the 500 LOC threshold.
---
# TD-01: UI files exceed size convention

## Original Problem (2026-02-13)

Four UI files massively exceeded the 200-300 LOC convention:

| File | Lines (original) | Lines (current) | Reduction |
|------|-----------------|-----------------|-----------|
| `CsvActionView.ts` | 2,288 | 747 | -67% |
| `DataExchangeHubView.ts` | 2,297 | 484 | -79% |
| `ExportView.ts` | 1,350 | 655 | -51% |
| `EventsTab.ts` | 1,040 | 655 | -37% |

Phases 1-8 component extraction reduced these 4 files from an average of 1,744 LOC to 635 LOC.

## Current State (2026-02-14)

14 files still exceed 500 LOC:

| File | LOC | Notes |
|------|-----|-------|
| `EventCatalogView.ts` | 836 | Orchestrator with 15 sub-components |
| `CsvActionView.ts` | 747 | Orchestrator with 10 sub-components |
| `contentGenerator.ts` | 708 | Markdown generators — candidate for split |
| `ExportView.ts` | 655 | Orchestrator with 6 sub-components |
| `EventConfigModal.ts` | 629 | 3-page wizard modal — candidate for extraction |
| `EventBridge.ts` | 613 | Core infrastructure — careful |
| `EventLogView.ts` | 581 | Single-purpose activity log |
| `DataExchangeService.ts` | 579 | Facade delegating to 5 sub-modules |
| `catalog/helpers.ts` | 579 | Shared catalog helpers |
| `catalog/DomainsTab.ts` | 563 | Domain list + detail panel |
| `hub/ExportsTab.ts` | 544 | Export list + config management |
| `hub/ImportsTab.ts` | 540 | Import list + config management |
| `catalog/ServicesTab.ts` | 507 | Service list + detail panel |
| `DataExchangeHubView.ts` | 484 | Hub orchestrator with 21 components |

## Impact

- Cognitive load when navigating large files
- Merge conflict surface area
- Some files mix rendering + state + API access

## Remaining Decomposition Opportunities

1. **contentGenerator.ts** (708) -- Split markdown generators by doc type (event, domain, service, etc.)
2. **EventConfigModal.ts** (629) -- Extract per-page components (overview, subscription-form, definition-form)
3. **DomainsTab.ts** (563) -- Extract domain detail panel + actions

Note: Orchestrator files (`EventCatalogView`, `CsvActionView`, `ExportView`) are expected to be larger since they coordinate sub-components. The 500-800 LOC range is acceptable for orchestrators.

## Affected Files

- `src/ui/contentGenerator.ts`
- `src/ui/EventConfigModal.ts`
- `src/ui/catalog/DomainsTab.ts`
