---
type: TechDebt
severity: high
category: architecture
layer: ui
status: open
created: 2026-02-15
effort: large
description: "DataExchangeHubView is a standalone 485 LOC orchestrator with manual DOM layout. Migrate to Hub framework using Shell + Layout + Adapter pattern."
source: "[[Hubs PRD]]"
feature: "[[Hubs PRD]]"
tags:
  - hubs
  - migration
---
# TD-55: Data Exchange Hub → Hub migration

## Problem

DataExchangeHubView (485 LOC) is a standalone orchestrator that:
- Manually creates sidebar + content layout
- Implements its own tab switching logic
- Directly instantiates 18 component classes
- Manages state for 7 tabs + CSV file scanning + doc scanning
- Cannot be validated against layout/component manifests

## Target State

DataExchangeHubView becomes a thin shell that:

1. Creates a `WorkspaceShell` (TD-50) with Data Exchange tab definitions
2. Provides a `DataExchangeAdapter` that implements `HubAdapter`
3. Tab definitions reference layouts and components by name
4. Existing 18 component classes reused with layout-provided regions

### Before

```
DataExchangeHubView (485 LOC orchestrator)
├── Manual sidebar + content DOM
├── 7 tab buttons with manual click handlers
├── CSV + doc scanning logic
├── Direct component instantiation
└── State: activeTab, csvFiles, reportEntries, typeEntries, ...
```

### After

```
DataExchangeHubView (~120 LOC thin view)
├── WorkspaceShell (shared chrome)
├── DataExchangeAdapter (data methods + scanning)
├── Tab definitions (JSON config)
└── Existing 18 components (unchanged)
```

## Migration Strategy

### Step 1: Create DataExchangeAdapter

Extract data-fetching and scanning methods:
- `getDashboardData()` — from current dashboard aggregation
- `scanCsvFiles()` — currently in orchestrator
- `scanCsvDocs()` — currently in orchestrator
- `getImportConfigs()` / `getExportConfigs()` — from DataExchangeService

### Step 2: Create tab definitions

Convert 7 implicit tabs to explicit `TabDefinition[]`:

```typescript
const DATA_EXCHANGE_TABS: TabDefinition[] = [
    { id: "dashboard", label: "Dashboard", icon: "layout-dashboard", layout_ref: "dashboard_grid", ... },
    { id: "reports", label: "Reports", icon: "file-text", layout_ref: "split_dock", ... },
    { id: "types", label: "Types", icon: "tag", layout_ref: "split_dock", ... },
    { id: "properties", label: "Properties", icon: "list", layout_ref: "split_dock", ... },
    { id: "imports", label: "Imports", icon: "download", layout_ref: "split_dock", ... },
    { id: "exports", label: "Exports", icon: "upload", layout_ref: "split_dock", ... },
    { id: "pipelines", label: "Pipelines", icon: "git-branch", layout_ref: "split_dock", ... },
];
```

### Step 3: Wire shell + layouts

Replace manual DOM construction with shell mount.

### Step 4: Verify zero regression

Run all tests. Manual verification of all 7 tabs including CSV scanning, import/export, pipelines.

## Scope

### New files

- `src/ui/adapters/DataExchangeAdapter.ts` — HubAdapter implementation
- `src/ui/tabs/data-exchange-tabs.ts` — tab definitions

### Modified files

- `src/ui/DataExchangeHubView.ts` — reduce from 485 → ~120 LOC
- `src/ui/hub/*.ts` — 18 components receive regions from layouts

## Dependencies

- **TD-49** (Layout abstraction) — layouts
- **TD-50** (Workspace shell) — shared chrome

## Priority

**High** — Second migration target. Validates the Hub framework generalizes beyond Event Catalog.

## Acceptance Criteria

- [ ] DataExchangeHubView uses WorkspaceShell for navigation
- [ ] DataExchangeAdapter provides all data for 7 tabs
- [ ] Tab definitions validate against layout + component manifests
- [ ] All 7 tabs render identically to before (no visual regression)
- [ ] CSV scanning and doc scanning work as before
- [ ] All existing hub tests pass
- [ ] DataExchangeHubView LOC reduced by >50%
