---
type: Flow
domain: Flowti
stage: done
description: End-to-end journey from configuring an Azure DevOps signal connection through work item sync to vault notes and inbox notifications
domains:
  - Signal
  - Inbox
  - Data Exchange
services:
  - SignalService
  - InboxService
events:
  - signal.configured
  - signal.connection.tested
  - signal.sync.started
  - signal.sync.progress
  - signal.item.created
  - signal.item.updated
  - signal.sync.completed
  - signal.sync.failed
  - signal.removed
  - signal.loaded
tags:
  - signal
  - azure-devops
  - data-exchange
---

# Connect Azure DevOps Signal

## Overview

The Signal domain connects Flowti to external data sources. Currently the only adapter is Azure DevOps. A "signal" is a saved connection configuration that pulls work items into the vault as structured Markdown notes with typed frontmatter. Users configure signals in the Data Exchange Hub's Signals tab, test the connection, trigger syncs, and receive inbox notifications on completion or failure. Synced notes include full frontmatter (id, type, state, assignedTo, tags, etc.) and the work item description converted from HTML to Markdown.

## Trigger

User opens the Data Exchange Hub and navigates to the Signals tab, or invokes "Sync All Signals" from the command palette.

## Steps

### 1. Open the Signals Tab

- **View/Service**: DataExchangeHubView → SignalsTab
- **User Action**: Opens Data Exchange Hub (ribbon icon `arrow-left-right` or command "Open Data Exchange Hub"), clicks the "Signals" tab (icon: `radio`)
- **System Response**: The master panel renders a "Signals" category header with a count badge and a `+` button. If no signals exist: "No signals configured".
- **Events**: `hub.tab.changed`

### 2. Configure a New Signal

- **View/Service**: SignalsTab → SignalConfigModal → SignalService
- **User Action**: Clicks `+` button. SignalConfigModal opens with title "New Signal". User fills in:
  - **Name** (required) — display label, e.g. "My Project Backlog"
  - **Organization URL** (required) — e.g. `https://dev.azure.com/org`
  - **Project** (required) — exact project name
  - **Personal Access Token** (required) — PAT with Work Items (Read) scope, rendered as password field
  - **Target Folder** (default: `signals/items`) — vault-relative path for synced notes
  - **Item Type Filter** (optional) — comma-separated, e.g. "Bug, User Story, Task". Empty = all types
  - **Conflict Strategy** (default: `update`) — Skip / Update frontmatter only / Overwrite entirely
  Clicks "Save".
- **System Response**: SignalService creates a new `SignalConfig` with auto-generated ID (`sig_<timestamp>_<random>`), status `"disconnected"`, `lastSync: null`. State persisted to TypedStorage under key `"signal"`.
- **Events**: `signal.configured` `{ signalId, name, type, project }`

### 3. View Signal Details

- **View/Service**: SignalsTab (detail panel)
- **User Action**: Clicks a signal row in the master list
- **System Response**: Detail panel shows: signal name + badges (adapter type, connection status), connection card (Organization, Project, Target Folder, Conflict Strategy, Type Filter), last sync info (timestamp + item count, or "Never synced"), and action bar (Sync Now, Test Connection, Edit, Remove).
- **Events**: (none — UI display)

### 4. Test the Connection

- **View/Service**: SignalsTab → SignalService → AzureDevOpsAdapter
- **User Action**: Clicks "Test Connection" (icon: `plug`)
- **System Response**: Adapter makes a GET request to the Azure DevOps project endpoint (`/_apis/projects/{project}?api-version=7.1-preview.1`) with Basic auth (PAT). On success: status updated to `"connected"`, green "Connected" feedback shown. On failure: status set to `"error"`, user-friendly error displayed:
  - 401: "Invalid Personal Access Token"
  - 403: "Insufficient permissions — PAT needs Work Items (Read) scope"
  - 404: "Project not found — check organization URL and project name"
  - 429: "Rate limited — retry after N seconds"
  - 5xx: "Azure DevOps service error — try again later"
  - Network: "Connection failed — check your network and organization URL"
- **Events**: `signal.connection.tested` `{ signalId, success, error? }`

### 5. Sync Work Items

- **View/Service**: SignalsTab → SignalService → AzureDevOpsAdapter → FileSystemClient
- **User Action**: Clicks "Sync Now" (icon: `refresh-cw`)
- **System Response**: SignalService runs a three-phase pipeline:
  1. **Fetch IDs**: WIQL POST query retrieves work item IDs (filtered by item type if configured)
  2. **Batch fetch details**: GET requests in batches of 200, mapping each item to `WorkItemMapping` (id, rev, type, title, state, assignedTo, areaPath, iterationPath, priority, tags, url, description, dates)
  3. **Write notes**: For each work item, creates or updates a note at `{targetFolder}/{id} - {sanitized title}.md`:
     - **Frontmatter**: id, type, state, assignedTo, areaPath, iterationPath, priority, tags, url, signalSource, lastSynced
     - **Body**: `# {title}` + description converted from HTML to Markdown
     - **Conflict resolution**: `skip` = don't touch existing files; `update` = update frontmatter only; `overwrite` = replace entire file
  After sync: `lastSync` timestamp and `lastSyncItemCount` updated, status set to `"connected"`.
- **Events**: `signal.sync.started` → `signal.sync.progress` (per item) → `signal.item.created` / `signal.item.updated` (per note) → `signal.sync.completed` or `signal.sync.failed`

### 6. Inbox Notifications

- **View/Service**: InboxService
- **User Action**: (none — automatic)
- **System Response**: InboxService listens for sync completion/failure:
  - `signal.sync.completed`: If errors exist → type `"action"`, title "Signal sync completed with N error(s)". If clean → type `"info"`, title "Signal sync: N created, N updated".
  - `signal.sync.failed`: Type `"action"`, title "Signal sync failed"
  Items appear in User Hub Inbox with source hub `"signal"`.
- **Events**: `inbox.itemAdded`

### 7. Edit a Signal

- **View/Service**: SignalsTab → SignalConfigModal → SignalService
- **User Action**: Clicks "Edit" (icon: `pencil`) in detail panel. Modal reopens pre-populated. Modifies fields, clicks "Save".
- **System Response**: SignalService updates the config, persists state.
- **Events**: `signal.configured`

### 8. Remove a Signal

- **View/Service**: SignalsTab → SignalService
- **User Action**: Clicks "Remove" (icon: `trash-2`, red text). Confirmation dialog: "Remove signal '<name>'? Synced notes will be preserved."
- **System Response**: Signal deleted from state, persisted. Synced vault notes are NOT deleted. Selection cleared, tab re-renders.
- **Events**: `signal.removed` `{ signalId, name }`

### 9. Sync All Signals (Command Palette)

- **View/Service**: Command palette → SignalService
- **User Action**: Invokes "Sync All Signals" (`flowti:sync-all-signals`, icon: `radio`)
- **System Response**: SignalService iterates all configured signals sequentially, calling `sync()` on each. Each sync emits the full lifecycle events from Step 5.
- **Events**: Per-signal: `signal.sync.started` → `signal.sync.completed` / `signal.sync.failed`

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Conflict strategy | Skip / Update frontmatter only / Overwrite entirely | Update |
| Item type filter | Specific types or all | All types |
| Target folder | Any vault path | `signals/items` |

## Events Sequence

```
[User configures signal]
    → signal.configured

[User tests connection]
    → signal.connection.tested { success/error }

[User syncs]
    → signal.sync.started
    → signal.sync.progress (×N)
    → signal.item.created / signal.item.updated (×N)
    → signal.sync.completed / signal.sync.failed
    → InboxService mapper → inbox.itemAdded
```

## Note Template

```yaml
---
id: 12345
type: User Story
state: Active
assignedTo: John Doe
areaPath: MyProject\Backend
iterationPath: MyProject\Sprint 1
priority: 2
tags:
  - api
  - backend
url: https://dev.azure.com/org/project/_workitems/edit/12345
signalSource: sig_abc123
lastSynced: 2026-02-21T14:30:00.000Z
---

# Implement API endpoint

Converted description content in Markdown...
```

## Known Limitations

- Only Azure DevOps adapter available (extensible via SignalAdapter interface)
- HTML-to-Markdown conversion: nested lists render flat, tables lose structure
- PAT stored in plugin data (not encrypted vault storage)
- No automatic sync scheduling (manual trigger only)

## Related Use Cases

- [[Manage Inbox Notifications]] (sync results surface as inbox items)
- [[Export Vault Data]] (Data Exchange Hub companion feature)
- [[Import CSV as Notes]] (Data Exchange Hub companion feature)
