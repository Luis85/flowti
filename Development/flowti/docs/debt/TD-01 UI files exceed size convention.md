---
severity: high
category: architecture
layer: ui
status: open
effort: large
description: Multiple UI files exceed 500 LOC. The original 4 files exceeding 1,000 LOC have been significantly reduced through Phases 1-8 component extraction, but 10 files still exceed the 500 LOC threshold.
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

10 files still exceed 500 LOC:

| File | LOC | Notes |
|------|-----|-------|
| `EventCatalogView.ts` | 833 | Orchestrator with 13 sub-components |
| `hub/HubDashboard.ts` | 766 | Dashboard with multiple sections |
| `CsvActionView.ts` | 747 | Orchestrator with 7 sub-components |
| `csv/CsvLanding.ts` | 701 | Source file scanning + config matching |
| `ExportView.ts` | 655 | Orchestrator with 6 sub-components |
| `catalog/EventsTab.ts` | 655 | Category tree + detail panel rendering |
| `EventConfigModal.ts` | 628 | 3-page wizard modal |
| `EventLogView.ts` | 581 | Single-purpose activity log |
| `catalog/DomainsTab.ts` | 563 | Domain list + detail panel |
| `hub/ExportsTab.ts` | 544 | Export list + config management |

Additional files at 507-540 LOC: ImportsTab, helpers.ts (catalog), ServicesTab.

## Impact

- Cognitive load when navigating large files
- Merge conflict surface area
- Some files mix rendering + state + API access

## Remaining Decomposition Opportunities

1. **HubDashboard.ts** (766) -- Extract `DashboardStats`, `DashboardPipelines`, `DashboardQuickActions`
2. **CsvLanding.ts** (701) -- Extract `CsvSourceList`, `CsvBaseScanner`
3. **EventsTab.ts** (655) -- Extract `CategoryTreeRenderer`
4. **DomainsTab.ts** (563) -- Extract domain detail panel + actions

Note: Orchestrator files (`EventCatalogView`, `CsvActionView`, `ExportView`) are expected to be larger since they coordinate sub-components. The 500-800 LOC range is acceptable for orchestrators.

## Affected Files

- `src/ui/hub/HubDashboard.ts`
- `src/ui/csv/CsvLanding.ts`
- `src/ui/catalog/EventsTab.ts`
- `src/ui/catalog/DomainsTab.ts`
