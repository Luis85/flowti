---
type: ProductRequirementsDocument
domain: Signal
stage: in-progress
version: 2
maturity: L2
created: 2026-02-20
updated: 2026-02-21
foundation: "[[I want to get my Azure DevOps Boards Backlog into my Vault]]"
related_events:
  - signal.configured
  - signal.connection.tested
  - signal.sync.started
  - signal.sync.completed
  - signal.sync.failed
  - signal.sync.progress
  - signal.item.created
  - signal.item.updated
  - signal.removed
  - signal.loaded
maturity_score_strategy: 4
maturity_score_scope: 4
maturity_score_architecture: 4
maturity_score_event_integration: 4
maturity_score_data_model: 3
maturity_score_ui_consistency: 3
maturity_score_validation_testing: 3
fri_score: 26
business_value: 5
implementation_cost: 4
maintenance_cost: 3
discovery_cost: 4
design_cost: 3
test_cost: 3
priority: 5
tags:
  - signal
  - azure-devops
  - integration
  - prd
  - core
plugin: "[[Development/flowti/README|README]]"
---

# Feature PRD: Azure DevOps Integration — Signals Framework

## Executive Summary

Azure DevOps Integration introduces the **Signals framework** — a new domain for connecting Flowti to external data sources. The first signal adapter targets Azure DevOps Boards, enabling users to pull work items from their backlogs into the vault as structured notes.

This is architecturally significant: it represents the plugin's **first network call**, establishing authentication, error handling, and sync patterns that every future integration will inherit. It directly addresses **RB-5** ("No external data ingestion") from the release blocker assessment.

---

## 1. Problem Statement

All data currently enters Flowti through manual creation or CSV import. Project management data living in Azure DevOps Boards — work items, backlogs, iterations — remains invisible to the knowledge graph. Users must manually copy information between systems, which is error-prone, unsustainable, and defeats the purpose of an integrated knowledge system.

Without external data ingestion, the vault operates as an isolated information silo. The knowledge graph cannot grow beyond what users manually feed it.

## 2. Outcome

Users can configure Azure DevOps Board connections and pull work items into the vault as structured notes with frontmatter. Received items are stored in a configurable target folder (`resources/signals/<signal-name>/items/` by default) and can be explored, linked, and enriched within the knowledge graph. The underlying Signals framework is reusable for future adapters.

## 3. Scope

### In Scope

- **Signal domain** — new `src/domain/signal/` with types, events, service, and adapter infrastructure
- **Azure DevOps Adapter** — REST API client using Personal Access Token (PAT) authentication
- **Connection configuration** — organization, project, PAT, target folder, item type filters
- **Connection testing** — validate credentials and project access before first sync
- **Work item pull** — fetch work items via Azure DevOps REST API (Work Item Tracking)
- **Note mapping** — transform work items into vault notes with structured frontmatter
- **Manual sync trigger** — user-initiated pull operation
- **Multi-project support** — configure multiple Azure DevOps signals (different orgs/projects)
- **Sync status tracking** — last sync time, item counts, error state
- **Signal management UI** — configuration, status monitoring, sync trigger in Data Exchange Hub
- **Signal events** — full event integration following established command/state pair pattern

### Out of Scope (Deferred)

- **Push / write-back** to Azure DevOps (bi-directional sync)
- **Real-time / periodic auto-sync** (future: scheduled sync via intervals)
- **Git repository import** from Azure DevOps Repos
- **Azure DevOps Pipelines** integration (build/release data)
- **Other signal adapters** (RSS, GitHub, Jira) — framework supports them, but only Azure DevOps is delivered
- **Work item attachments** (binary files)
- **Work item comments / discussion threads**
- **Linked work items** (relationships between items)
- **Board / sprint views** in the vault (items are flat notes, not Kanban boards)

## 4. UX Entry Points

- **Data Exchange Hub → Signals tab** — new tab in DX Hub for managing signal connections
- **Signal configuration modal** — multi-page wizard: Connection → Mapping → Test → Confirm
- **Command palette** — `flowti:signal-sync` to trigger manual sync for all configured signals
- **Ribbon action** (stretch) — quick-sync button in the sidebar ribbon

## 5. Functional Requirements

### v1 — Core Signal Infrastructure + Azure DevOps Pull

- [ ] **FR-01: Configure Signal Connection** — User can create a named signal with Azure DevOps org URL, project name, and PAT. Configuration is persisted via TypedStorage.
- [ ] **FR-02: Test Signal Connection** — User can validate PAT and project access. System reports success or specific error (invalid PAT, project not found, no permissions).
- [ ] **FR-03: Pull Work Items** — System fetches work items from the configured Azure DevOps project via REST API. Supports filtering by work item type (Bug, User Story, Task, Epic, Feature).
- [ ] **FR-04: Map Work Items to Notes** — Each work item becomes a vault note with frontmatter: `id`, `type`, `title`, `state`, `assignedTo`, `areaPath`, `iterationPath`, `priority`, `tags`, `url`, `signalSource`, `lastSynced`. Note body contains the work item description (HTML → Markdown conversion).
- [ ] **FR-05: Conflict Resolution on Sync** — When a note already exists for a work item: skip, update frontmatter only, or overwrite entirely. User configures default strategy per signal.
- [ ] **FR-06: Sync Status Monitoring** — Each signal displays: connection status (connected/disconnected/error), last sync timestamp, item count, error details.
- [ ] **FR-07: Multi-Project Signals** — User can configure multiple signals pointing to different Azure DevOps organizations and projects. Each signal has its own target folder.
- [ ] **FR-08: Remove Signal** — User can remove a signal configuration. Existing synced notes remain in the vault (not deleted).
- [ ] **FR-09: Signal Events** — All signal operations emit events following the command/state pair pattern. Events are registered in the Event Catalog.
- [ ] **FR-10: Sync Progress** — During sync, system emits progress events (`current/total`) and displays progress in the UI.

### Future (v2+)

- FR-11: Scheduled auto-sync (configurable intervals)
- FR-12: Push changes back to Azure DevOps
- FR-13: Bi-directional conflict resolution
- FR-14: Additional adapters (GitHub Issues, Jira, RSS)
- FR-15: Work item relationship mapping (parent/child, related)

## 6. Data Model

### New Types

| Type | Fields | Storage |
|------|--------|---------|
| `SignalConfig` | `id`, `name`, `type: "azure-devops"`, `orgUrl`, `project`, `pat` (encrypted ref), `targetFolder`, `itemTypeFilter`, `conflictStrategy`, `lastSync`, `lastSyncItemCount`, `status` | `signal` storage key |
| `SignalState` | `signals: SignalConfig[]` | TypedStorage persisted |
| `SyncResult` | `signalId`, `itemsCreated`, `itemsUpdated`, `itemsSkipped`, `errors: SyncError[]`, `duration`, `timestamp` | Runtime (emitted via events) |
| `SyncError` | `workItemId`, `message`, `recoverable` | Runtime |
| `WorkItemMapping` | `id`, `rev`, `type`, `title`, `state`, `assignedTo`, `areaPath`, `iterationPath`, `priority`, `tags[]`, `url`, `description`, `createdDate`, `changedDate` | Runtime (mapped to frontmatter) |

### Frontmatter Schema (Synced Work Item Note)

```yaml
---
type: work-item
signal_source: "my-azure-signal"
azure_devops_id: 12345
azure_devops_rev: 42
work_item_type: "User Story"
state: "Active"
assigned_to: "John Doe"
area_path: "MyProject\\Team A"
iteration_path: "MyProject\\Sprint 23"
priority: 2
tags:
  - frontend
  - ux
url: "https://dev.azure.com/org/project/_workitems/edit/12345"
last_synced: "2026-02-20T14:30:00Z"
---
```

### Storage Key

Signal configuration stored under `"signal"` key in plugin storage, following the same `TypedStorage<SignalState>` pattern used by other domains.

## 7. Event Integration

### Signal Events (10 events)

| Event | Payload | Category | Tags |
|-------|---------|----------|------|
| `signal.configured` | `{ signalId, name, type, project }` | Signal | — |
| `signal.removed` | `{ signalId, name }` | Signal | — |
| `signal.connection.tested` | `{ signalId, success, error? }` | Signal | — |
| `signal.sync.started` | `{ signalId, name }` | Signal | — |
| `signal.sync.progress` | `{ signalId, current, total }` | Signal | — |
| `signal.sync.completed` | `{ signalId, result: SyncResult }` | Signal | — |
| `signal.sync.failed` | `{ signalId, error }` | Signal | — |
| `signal.item.created` | `{ signalId, workItemId, notePath }` | Signal | — |
| `signal.item.updated` | `{ signalId, workItemId, notePath, fields }` | Signal | — |
| `signal.loaded` | `{ signalCount }` | Signal | `["system"]` |

### Event Naming Convention

Follows established patterns:
- Command/state pairs: `sync.started` / `sync.completed` / `sync.failed`
- CRUD: `configured` / `removed`
- Item-level: `item.created` / `item.updated`

## 8. Architecture

### Domain Structure

```
src/domain/signal/
├── types.ts                    # SignalConfig, SignalState, SyncResult, WorkItemMapping
├── events.ts                   # SignalEventMap interface
├── SignalService.ts            # Signal lifecycle, sync orchestration, state persistence
├── adapters/
│   ├── SignalAdapter.ts        # Adapter interface (shared contract)
│   └── AzureDevOpsAdapter.ts   # Azure DevOps REST API client
└── mappers/
    └── workItemMapper.ts       # Work Item JSON → WorkItemMapping → frontmatter note
```

### Key Design Decisions

1. **Adapter Interface** — `SignalAdapter` defines `testConnection()`, `fetchItems(config)`, `mapItem(raw)`. Azure DevOps is the first implementation. Future adapters (GitHub, Jira) implement the same interface.

2. **PAT Storage** — PAT stored in plugin `data.json` via Obsidian's `loadData/saveData`. This is local, encrypted at OS level (Electron). PAT is NEVER logged, emitted in events, or included in error messages.

3. **HTTP via `requestUrl`** — Uses Obsidian's built-in `requestUrl()` API (no external HTTP library needed). This handles CORS, SSL, and platform differences.

4. **HTML → Markdown** — Work item descriptions in Azure DevOps are HTML. Convert to Markdown for note body using a lightweight manual converter for common patterns. v1 supports a defined subset:

   **Supported:** `<p>`, `<br>`, `<strong>`/`<b>`, `<em>`/`<i>`, `<ul>`+`<li>`, `<ol>`+`<li>`, `<a>`, `<code>`, `<pre>`, `<h1>`–`<h6>`, `<img>`

   **Known limitations (v1):**
   - Nested lists render as flat single-level lists
   - Tables (`<table>`) are stripped to plain text (no Markdown table conversion)
   - Inline styles and CSS classes are silently removed
   - `<div>` containers are unwrapped (content preserved, structure lost)
   - Embedded images reference external URLs (not downloaded into vault)
   - Complex HTML from Azure DevOps rich editor may produce imperfect output

   Imperfect conversion is acceptable for v1 — users can edit synced notes.

5. **Sync is Pull-Only** — v1 is read-only. No mutations are sent to Azure DevOps. This simplifies error handling and eliminates conflict resolution complexity.

6. **Idempotent Sync** — Work items are identified by `azure_devops_id` in frontmatter. Re-sync updates existing notes based on conflict strategy. `rev` field tracks Azure DevOps revision for change detection.

### Integration Points

| Integration | Method |
|-------------|--------|
| Data Exchange Hub | New "Signals" tab via tab definitions |
| Event Catalog | Signal events registered in catalog metadata |
| EventBus | All signal operations emit events |
| FileSystemClient | Note creation/update via established file operations |
| TypedStorage | Signal configuration persistence |
| Obsidian API | `requestUrl()` for HTTP calls |

### Sequence: Manual Sync

```
User clicks "Sync Now"
  → SignalService.sync(signalId)
    → emit signal.sync.started
    → AzureDevOpsAdapter.fetchItems(config)
      → requestUrl(GET https://dev.azure.com/{org}/{project}/_apis/wit/wiql)
      → requestUrl(GET https://dev.azure.com/{org}/{project}/_apis/wit/workitems?ids=...)
    → for each work item:
      → workItemMapper.toNote(item)
      → FileSystemClient.createFile() or updateFrontmatter()
      → emit signal.item.created or signal.item.updated
      → emit signal.sync.progress { current, total }
    → emit signal.sync.completed { result }
    → SignalService.updateSyncStatus(signalId, result)
```

## 9. UI Design

### Signals Tab in Data Exchange Hub

The Signals tab follows the established master/detail split layout pattern used by all other DX Hub tabs.

```
┌─────────────────────────────────────────────────────────────────┐
│  Data Exchange Hub                                    [≡] [×]   │
├─────────────────────────────────────────────────────────────────┤
│  Dashboard │ Imports │ Exports │ Reports │ ... │ ▸ Signals      │
├──────────────────────┬──────────────────────────────────────────┤
│  🔍 Search signals   │                                          │
├──────────────────────┤  Azure DevOps — MyProject                │
│                      │                                          │
│  ● My Team Project   │  ┌─ Connection ───────────────────────┐  │
│    myorg / MyProject │  │  Org:     https://dev.azure.com/org │  │
│    ✓ 3m ago · 142    │  │  Project: MyProject                 │  │
│                      │  │  Status:  ● Connected                │  │
│  ● Backend Board     │  └────────────────────────────────────┘  │
│    myorg / Backend   │                                          │
│    ✓ 1h ago · 87     │  ┌─ Sync ─────────────────────────────┐  │
│                      │  │  [ ⟳ Sync Now ]  [ Test Connection ]│  │
│  ○ Stale Signal      │  │                                     │  │
│    other / Stale     │  │  Last sync: 2026-02-20 14:30        │  │
│    ✗ error · 0       │  │  Created: 12  Updated: 130          │  │
│                      │  │  Skipped: 0   Errors: 0             │  │
│  ──────────────────  │  └─────────────────────────────────────┘  │
│  [ + Add Signal ]    │                                          │
│                      │  ┌─ Configuration ─────────────────────┐  │
│                      │  │  Target: resources/signals/myproj/   │  │
│                      │  │  Types:  Bug, User Story, Task       │  │
│                      │  │  Conflict: Update frontmatter        │  │
│                      │  └─────────────────────────────────────┘  │
│                      │                                          │
│                      │  [ Edit ]  [ Remove ]                    │
└──────────────────────┴──────────────────────────────────────────┘

Legend:  ● connected (green)   ○ disconnected (grey)   ✗ error (red)
```

**Master panel:**
- List of configured signals with status indicators (green/red/grey dot)
- "+" button to add a new signal
- Each signal shows: name, project, last sync time, item count

**Detail panel (signal selected):**
- Connection info (org, project, status)
- Sync controls: "Sync Now" button, "Test Connection" button
- Last sync result: items created/updated/skipped/errors
- Configuration: target folder, item type filter, conflict strategy
- Actions: Edit, Remove

### Signal Configuration Modal

4-page wizard following the established modal pattern:

```
┌──────────────────────────────────────────────────┐
│  Configure Signal                          [×]   │
├──────────────────────────────────────────────────┤
│  ● Connection  ○ Mapping  ○ Test  ○ Confirm      │
├──────────────────────────────────────────────────┤
│                                                  │
│  Signal Name                                     │
│  ┌──────────────────────────────────────────┐    │
│  │ My Team Project                          │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Organization URL                                │
│  ┌──────────────────────────────────────────┐    │
│  │ https://dev.azure.com/myorg              │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Project Name                                    │
│  ┌──────────────────────────────────────────┐    │
│  │ MyProject                                │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Personal Access Token                           │
│  ┌──────────────────────────────────────────┐    │
│  │ ••••••••••••••••••••••••                 │    │
│  └──────────────────────────────────────────┘    │
│  ℹ Minimum scope: Work Items (Read)              │
│                                                  │
│                              [ Cancel ] [ Next ] │
└──────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────┐
│  Configure Signal                          [×]   │
├──────────────────────────────────────────────────┤
│  ○ Connection  ● Mapping  ○ Test  ○ Confirm      │
├──────────────────────────────────────────────────┤
│                                                  │
│  Target Folder                                   │
│  ┌──────────────────────────────────────────┐    │
│  │ resources/signals/my-team-project/items  │ 📁│
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Work Item Types                                 │
│  ☑ Bug  ☑ User Story  ☑ Task  ☐ Epic  ☐ Feature │
│                                                  │
│  Conflict Strategy                               │
│  ┌──────────────────────────────────────────┐    │
│  │ Update frontmatter (preserve body)    ▾  │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│                          [ Back ] [ Next ]       │
└──────────────────────────────────────────────────┘
```

1. **Connection** — Signal name, Azure DevOps org URL, project name, PAT input (password field)
2. **Mapping** — Target folder (with folder suggest), work item type filter (checkboxes), conflict strategy (dropdown)
3. **Test** — "Test Connection" button with success/error feedback
4. **Confirm** — Summary of configuration, "Save Signal" button

## 10. Security Considerations

| Concern | Mitigation |
|---------|------------|
| PAT exposure in logs | PAT is NEVER included in log messages, event payloads, or error details. Masked as `***` if displayed. |
| PAT storage | Stored in Obsidian's `data.json` (local, OS-level encryption). Not synced via Obsidian Sync by default. |
| Network errors | All `requestUrl` calls wrapped in try-catch. Timeout set to 30 seconds. Errors emit `signal.sync.failed` with sanitized message. |
| API rate limiting | Azure DevOps allows 800 requests per 5 minutes for PAT auth. Implement basic rate awareness: if 429 received, back off and retry once. |
| Scope limitation | PAT should have minimum required scope: `Work Items (Read)`. Document recommended PAT configuration. |

## 11. FRI Score at Review Time

| Dimension | Score | Notes |
|-----------|-------|-------|
| Strategy | 4/5 | Addresses RB-5 release blocker. First external integration. Enables dogfooding with real project data. Not 5/5 because this is the first integration domain — strategic value grows with more adapters. |
| Scope | 4/5 | Clear v1 boundary (pull-only, Azure DevOps only). Well-defined FRs with explicit deferrals. Not 5/5 because push/bi-directional sync scope needs refinement. |
| Architecture | 4/5 | Adapter pattern defined and implemented. Integration points validated. `requestUrl()` spike completed (ADR-034). Not 5/5 because HTML→MD conversion approach not yet validated. |
| Event Integration | 4/5 | 10 events with payloads defined. Follows command/state pair pattern. Category assigned. Not 5/5 because event-to-inbox mapping (signal errors → inbox notifications) not yet specified. |
| Data Model | 3/5 | Core types defined (SignalConfig, WorkItemMapping, SyncResult). Frontmatter schema specified. Not higher because relationship between SignalState and DataExchangeState needs clarification, and PAT storage model needs security review. |
| UI Consistency | 3/5 | Wireframes for Signals tab and config modal provided. Master/detail layout follows DX Hub pattern. Sync progress display specified. Not higher because no detailed interaction specs for error states and edge case flows. |
| Validation & Testing | 3/5 | 23 foundation tests passing. Service CRUD, event emission, state persistence all tested. Not higher because adapter and mapper tests not yet written, no flow test yet. |
| **Total** | **26/35** | **Technically Ready** (threshold: 19/35 for new features) |

### FRI Improvement Path

Current: 26/35 (post-Inc 1). To reach 28+/35:
- ~~**Architecture → 4**: Complete Inc 1 spike~~ — **DONE** (ADR-034)
- ~~**Validation & Testing → 3**: Foundation tests~~ — **DONE** (23 tests)
- **Data Model → 4**: Finalize PAT storage approach, clarify SignalState relationship (Inc 2)
- **UI Consistency → 4**: Add error state wireframes, sync progress interaction specs (Inc 4)

## 12. PBIs

### PBI-SIG-001: Signal Domain Foundation

**Problem:** No infrastructure exists for external data source connections.
**Solution:** Create `src/domain/signal/` with types, events, service skeleton, and adapter interface.
**Acceptance Criteria:**
- [ ] SignalService manages SignalState via TypedStorage
- [ ] SignalAdapter interface defined with `testConnection()` and `fetchItems()`
- [ ] Signal events registered in EventBus type map
- [ ] Signal category added to Event Catalog
- [ ] `npm test` green with foundation tests

### PBI-SIG-002: Azure DevOps Adapter

**Problem:** No mechanism to communicate with Azure DevOps REST API.
**Solution:** Implement `AzureDevOpsAdapter` using Obsidian's `requestUrl()`.
**Acceptance Criteria:**
- [ ] Adapter authenticates via PAT (Basic auth header)
- [ ] `testConnection()` validates org/project/PAT
- [ ] `fetchItems()` retrieves work items via WIQL query + batch fetch
- [ ] Work item type filtering works (Bug, User Story, Task, Epic, Feature)
- [ ] HTTP errors mapped to typed error responses
- [ ] PAT never appears in logs or events
- [ ] `npm test` green with mocked HTTP tests

### PBI-SIG-003: Work Item Mapping and Note Creation

**Problem:** Raw Azure DevOps work item JSON needs to be transformed into vault notes.
**Solution:** Implement `workItemMapper` and integrate with `FileSystemClient` for note creation.
**Acceptance Criteria:**
- [ ] Work items mapped to notes with frontmatter schema (see §6)
- [ ] HTML description converted to Markdown body
- [ ] Conflict strategies work: skip, update frontmatter, overwrite
- [ ] Notes created in configured target folder
- [ ] `signal.item.created` and `signal.item.updated` events emitted
- [ ] `npm test` green with mapper and integration tests

### PBI-SIG-004: Signal Management UI

**Problem:** Users need a way to configure, monitor, and trigger signal operations.
**Solution:** Add Signals tab to Data Exchange Hub + Signal Configuration Modal.
**Acceptance Criteria:**
- [ ] Signals tab visible in DX Hub with master/detail layout
- [ ] Signal list shows name, status indicator, last sync, item count
- [ ] "+" button opens configuration modal (4-page wizard)
- [ ] "Sync Now" button triggers manual sync with progress display
- [ ] "Test Connection" button validates credentials inline
- [ ] "Remove" button removes signal config (notes preserved)
- [ ] `npm test` green with UI tests

### PBI-SIG-005: End-to-End Sync Orchestration

**Problem:** Individual pieces (adapter, mapper, UI) need to work together as a complete sync flow.
**Solution:** Wire SignalService.sync() end-to-end with progress reporting and error handling.
**Acceptance Criteria:**
- [ ] Full sync flow works: fetch → map → create/update → report
- [ ] Progress events emitted during sync (`current/total`)
- [ ] Sync errors are non-fatal per item (one bad item doesn't abort entire sync)
- [ ] Sync result includes created/updated/skipped/error counts
- [ ] Signal status updated after sync (last sync time, item count)
- [ ] Flow test: "Configure and sync Azure DevOps signal" passes
- [ ] `npm test` green

## 13. Dependencies

| Dependency | Source | Status | Impact |
|------------|--------|--------|--------|
| Error handling foundation | Cycle 10 Inc 1 | Planned | HTTP errors need robust patterns |
| EventBus resilience | Cycle 10 Inc 3 | Planned | Signal events must not silently fail |
| Obsidian `requestUrl()` API | Obsidian core | Available | Used for HTTP calls — no external deps |
| Azure DevOps REST API v7.1 | Microsoft | Stable | Work Item Tracking API well-documented |

## 14. Success Metrics

| Metric | Target |
|--------|--------|
| FRI score | 22 → 28/35 by cycle end |
| Tests | +80–120 new tests |
| Production LOC | ~600–800 |
| Events registered | +10 in Event Catalog |
| PBIs completed | 5/5 (SIG-001 through SIG-005) |
| RB-5 status | Resolved |
| Sync works | Successfully pull work items from a real Azure DevOps project |

## 15. Related

- [[Data Exchange Hub PRD]] — parent hub, Signals tab extends DX Hub
- [[I want to get my Azure DevOps Boards Backlog into my Vault]] — canonical inbox item (Signals vision)
- [[I want to import an Azure DevOps Boards project with all of it's workitems]] — related inbox item
- [[Cycle Sequence Review 2026-02-20 Azure DevOps Prioritization]] — prioritization decision
- [[Cycle 11 - Azure DevOps Integration]] — delivery cycle
