---
type: Component
domain: Flowti
stage: done
description: "Azure DevOps signal connection management with CRUD, sync, and connection testing"
source: "[[Development/flowti/src/ui/hub/SignalsTab.ts|SignalsTab.ts]]"
parent: "[[DataExchangeHubView]]"
tags:
  - hub
  - signal
  - component
---

# SignalsTab

## Description

SignalsTab renders the signal connection management interface within the Data Exchange Hub. The master panel shows a list of configured signals with status indicators. The detail panel shows connection info, last sync details, and action buttons (Sync Now, Test Connection, Edit, Remove). Supports CRUD operations for Azure DevOps signal configurations.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `masterEl` | `HTMLElement` | Master panel DOM element |
| `detailEl` | `HTMLElement` | Detail panel DOM element |
| `deps` | `HubComponentDeps` | Shared dependency bag providing state, services, and callbacks |
| `deps.getState()` | callback | Read hub state including selected signal |
| `deps.setState()` | callback | Update selected signal ID |
| `deps.signalService` | `SignalService` | Signal CRUD, sync, and connection testing |
| `ConfirmModal` | modal | Confirmation dialog for signal removal |

## State

**Reads:** `selectedSignalId` from hub state, signal list from `signalService.getSignals()`

**Writes:** `selectedSignalId` via `deps.setState()`

## Renders

### Master Panel
- **Signal list**: Each signal shows name, type badge, status dot (color-coded: green=connected, yellow=syncing, red=error, gray=configured)
- **"+ New" button**: Opens signal configuration modal
- **Filter**: Signals filtered by search text from hub search input

### Detail Panel
- **Header**: Signal name, type badge, status badge
- **Connection info**: Organization URL, project name, target folder, item type filter, conflict strategy
- **Sync info**: Last sync timestamp, items synced count
- **Actions**: Sync Now (inline progress feedback), Test Connection (inline success/failure feedback), Edit (opens modal), Remove (with confirmation)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `signal.sync.completed` | Listens (via hub) | Re-render after sync completes |
| `signal.sync.failed` | Listens (via hub) | Show error feedback |
| `signal.connection.tested` | Listens (via hub) | Show test result feedback |
| `signal.configured` | Listens (via hub) | Re-render after config change |
| `signal.removed` | Listens (via hub) | Re-render after removal |

## Related

- Parent: [[DataExchangeHubView]]
- Siblings: [[ImportsTab]], [[ExportsTab]], [[ReportsTab]], [[PropertiesTab]], [[PipelinesTab]], [[TypesTab]], [[CanvasTab]], [[AnalyticsTab]]
- Domain: [[Connect Azure DevOps Signal]]
