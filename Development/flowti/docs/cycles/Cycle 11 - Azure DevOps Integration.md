---
type: DevelopmentCycle
feature: "[[Azure DevOps Integration PRD]]"
stage: in-progress
cycle: 11
date_planned: 2026-02-20
pbis:
  - "[[PBI-SIG-001 Signal Domain Foundation]]"
  - "[[PBI-SIG-002 Azure DevOps Adapter]]"
  - "[[PBI-SIG-003 Work Item Mapping and Note Creation]]"
  - "[[PBI-SIG-004 Signal Management UI]]"
  - "[[PBI-SIG-005 End-to-End Sync Orchestration]]"
bugs: []
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 5
estimated_tests: 100
---

# Cycle 11: Azure DevOps Integration

## Situation Assessment

### Pre-Cycle State (assumes Cycle 9 + Cycle 10 complete)

**Plugin health (projected):**
- ~2,900 tests passing, ~112 test suites
- SessionService reduced to ~580 LOC (TD-101 resolved in Cycle 9)
- Error handling foundation in place (Cycle 10 Inc 1)
- Resource leak patterns fixed (Cycle 10 Inc 2)
- EventBus resilience with error boundary (Cycle 10 Inc 3)
- `npm test` pipeline: tsc + eslint + vitest

**Session Workspaces feature:**
- PRD v8+, FRI 31/35 (post-Cycle 9 PBI-SW-015 delivery)
- TD-101 resolved, TD-100 resolved or mitigated
- Remaining v2 PBIs: SW-017 (Main/Sidebar separation), SW-009 (Domain Design Session)

**Data Exchange Hub:**
- PRD stage: done
- 6 tabs operational (Dashboard, Reports, Types, Properties, Imports, Exports, Pipelines)
- CSV import/export mature and tested

**Azure DevOps Integration:**
- PRD v1 created (FRI 24/35 — Technically Ready)
- 5 inbox items consolidated into PRD scope
- No existing code — greenfield domain
- First network call in the plugin

**Release Blockers (updated):**
- RB-1: Installer JSON config — **open** (Cycle 12)
- RB-2: No CI/CD — **open** (Cycle 12)
- RB-3: Canvas importer — **open** (Cycle 12)
- RB-4: Seed content — **open** (Cycle 12)
- RB-5: No external data ingestion — **targeted this cycle**
- RB-6: Documentation stubs — **open** (medium-term)
- RB-7: Pipeline multi-source merge — **open** (Cycle 12)

### Cycle Goals

1. **Establish the Signal domain** (PBI-SIG-001) — create reusable infrastructure for external data source connections
2. **Implement Azure DevOps adapter** (PBI-SIG-002) — first concrete adapter using PAT authentication and REST API
3. **Deliver work item → note mapping** (PBI-SIG-003) — transform Azure DevOps work items into vault notes with structured frontmatter
4. **Build Signal management UI** (PBI-SIG-004) — Signals tab in DX Hub + configuration modal
5. **Wire end-to-end sync** (PBI-SIG-005) — complete pull workflow from Azure DevOps to vault notes

---

## Scope

### Inc 1: Signal Domain Foundation (PBI-SIG-001)

**Goal:** Establish the Signal domain with types, events, service skeleton, and adapter interface. This is the spike increment — validate HTTP patterns and establish the integration architecture.

**Scope:**

| Deliverable | Details |
|-------------|---------|
| `src/domain/signal/types.ts` | `SignalConfig`, `SignalState`, `SyncResult`, `SyncError`, `WorkItemMapping` |
| `src/domain/signal/events.ts` | `SignalEventMap` with 10 events |
| `src/domain/signal/SignalService.ts` | Service skeleton — `configure()`, `remove()`, `getSignals()`, `load()`, `save()`. State management via TypedStorage. |
| `src/domain/signal/adapters/SignalAdapter.ts` | Adapter interface: `testConnection(config)`, `fetchItems(config)` |
| Event Catalog | "Signal" category registered with all 10 events |
| Spike: HTTP patterns | Validate `requestUrl()` usage, error handling, timeout behavior. Document in ADR. |

**Estimated size:**
- Production LOC: ~150 (types + events + service skeleton + adapter interface)
- Tests: ~25 (service CRUD, event emission, state persistence)
- Files: ~6

**Acceptance criteria:**
- [x] SignalService manages SignalState via TypedStorage
- [x] SignalAdapter interface defines `testConnection()` and `fetchItems()` contracts
- [x] All 10 signal events compile and are emittable
- [x] Signal category visible in Event Catalog
- [x] HTTP spike documented (error patterns, timeout approach, `requestUrl()` usage)
- [x] `npm test` green

**Delivery notes (Inc 1):**
- Production: types.ts (73 LOC), events.ts (82 LOC), SignalService.ts (126 LOC), SignalAdapter.ts (31 LOC) = 312 LOC total
- Tests: 23 new (SignalService.test.ts), 2,919 total passing (114 suites)
- ADR-034: HTTP Integration Patterns (requestUrl, PAT auth, error mapping, rate limiting, security)
- Also updated: events.ts, catalog.ts, registry.ts, main.ts, settings.ts, helpers.test.ts

---

### Inc 2: Azure DevOps Adapter (PBI-SIG-002)

**Goal:** Implement the Azure DevOps REST API adapter with PAT authentication, connection testing, and work item fetching.

**Scope:**

| Deliverable | Details |
|-------------|---------|
| `AzureDevOpsAdapter.ts` | Implements `SignalAdapter` interface |
| Authentication | PAT → Base64 Basic auth header (`:${pat}` → base64) |
| `testConnection()` | GET `{orgUrl}/{project}/_apis/projects/{project}?api-version=7.1-preview.1` — validates org, project, and PAT |
| `fetchItems()` | WIQL query to find work items + batch GET to fetch details |
| Type filtering | Filter by work item type (Bug, User Story, Task, Epic, Feature) via WIQL WHERE clause |
| Error mapping | HTTP 401 → "Invalid PAT", 404 → "Project not found", 403 → "Insufficient permissions", timeout → "Connection timeout" |
| Rate awareness | If HTTP 429 received, emit warning and include `Retry-After` in error |

**Azure DevOps API flow:**
```
1. POST {orgUrl}/{project}/_apis/wit/wiql?api-version=7.1
   Body: { query: "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '{project}' AND [System.WorkItemType] IN (...)" }
   Response: { workItems: [{ id, url }] }

2. GET {orgUrl}/{project}/_apis/wit/workitems?ids={id1},{id2},...&$expand=all&api-version=7.1
   Response: { value: [{ id, rev, fields: { ... } }] }
```

**Estimated size:**
- Production LOC: ~180 (adapter implementation + error mapping)
- Tests: ~25 (mocked HTTP responses for success, auth failure, not found, timeout, rate limit, type filtering)
- Files: ~3

**Acceptance criteria:**
- [ ] `testConnection()` validates org/project/PAT and returns typed result
- [ ] `fetchItems()` retrieves work items via WIQL + batch fetch
- [ ] Work item type filtering works via WIQL WHERE clause
- [ ] HTTP errors mapped to typed, sanitized error responses
- [ ] PAT never appears in logs, events, or error messages
- [ ] Rate limit (429) handled gracefully with retry-after awareness
- [ ] PRD architecture section updated with validated API behavior
- [ ] `npm test` green with mocked HTTP tests

---

### Inc 3: Work Item Mapping and Note Creation (PBI-SIG-003)

**Goal:** Transform raw Azure DevOps work item JSON into vault notes with structured frontmatter.

**Scope:**

| Deliverable | Details |
|-------------|---------|
| `workItemMapper.ts` | `mapWorkItem(raw) → WorkItemMapping` — extracts fields from Azure DevOps JSON |
| `toNoteFrontmatter(mapping) → Record<string, unknown>` | Converts mapping to YAML-safe frontmatter object |
| `toNoteBody(mapping) → string` | HTML description → Markdown conversion (basic patterns: `<p>`, `<br>`, `<strong>`, `<em>`, `<ul>`, `<ol>`, `<li>`, `<a>`, `<code>`) |
| Note creation | Uses `FileSystemClient.createFile()` for new items |
| Note update | Uses frontmatter update for existing items (conflict strategy) |
| Conflict strategies | Skip (if note exists), Update frontmatter (preserve body), Overwrite (full replace) |
| File naming | `{workItemId} - {sanitized title}.md` |

**Estimated size:**
- Production LOC: ~150 (mapper + HTML→MD converter + file operations)
- Tests: ~20 (mapping correctness, HTML conversion, conflict strategies, filename sanitization)
- Files: ~3

**Acceptance criteria:**
- [ ] Work items correctly mapped from Azure DevOps JSON to `WorkItemMapping`
- [ ] Frontmatter includes all specified fields (id, type, state, assignedTo, etc.)
- [ ] HTML description converted to readable Markdown
- [ ] All three conflict strategies work (skip, update, overwrite)
- [ ] File names sanitized (no illegal characters, reasonable length)
- [ ] Notes created in configured target folder
- [ ] `signal.item.created` and `signal.item.updated` events emitted per item
- [ ] HTML→MD known limitations documented in PRD §8
- [ ] `npm test` green

---

### Inc 4: Signal Management UI (PBI-SIG-004)

**Goal:** Build the user-facing signal management interface in the Data Exchange Hub.

**Scope:**

| Deliverable | Details |
|-------------|---------|
| Signals tab | New tab in DX Hub tab definitions: `{ id: "signals", label: "Signals", icon: "radio", searchPlaceholder: "Search signals..." }` |
| `SignalsTab.ts` | Master/detail component following established DX Hub component pattern |
| Master list | Signal cards with: name, project, status dot (green/red/grey), last sync, item count |
| Detail panel | Connection info, sync controls, last result, configuration, actions |
| Signal Config Modal | 4-page wizard: Connection → Mapping → Test → Confirm |
| "Sync Now" button | Triggers `SignalService.sync()` with inline progress display |
| "Test Connection" button | Triggers `SignalService.testConnection()` with success/error feedback |
| "Remove" action | Confirms and removes signal configuration |

**Estimated size:**
- Production LOC: ~200 (SignalsTab + SignalConfigModal + signal card rendering)
- Tests: ~15 (tab rendering, modal pages, button actions)
- Files: ~4

**Acceptance criteria:**
- [ ] Signals tab visible in DX Hub
- [ ] Signal list renders with correct status indicators
- [ ] "+" opens configuration modal
- [ ] Configuration modal 4-page flow works end-to-end
- [ ] "Sync Now" triggers sync and displays progress
- [ ] "Test Connection" shows success or error message
- [ ] "Remove" removes signal config after confirmation
- [ ] DX Hub documentation updated with Signals tab (7 tabs)
- [ ] `npm test` green

---

### Inc 5: End-to-End Sync Orchestration (PBI-SIG-005)

**Goal:** Wire everything together into a complete, production-quality sync flow. Add flow test and hardening.

**Scope:**

| Deliverable | Details |
|-------------|---------|
| `SignalService.sync(signalId)` | Full implementation: fetch → map → create/update → progress → result |
| Per-item error resilience | One bad work item does not abort the entire sync. Errors collected per item. |
| Sync status persistence | After sync, update `SignalConfig.lastSync`, `lastSyncItemCount`, `status` |
| Progress reporting | `signal.sync.progress` emitted per item with `{ current, total }` |
| Command registration | `flowti:signal-sync` command palette command for quick sync |
| Inbox integration | `signal.sync.failed` → inbox notification (via existing inbox mapper pattern) |
| Flow test | `tests/flows/flow14-signalSync.test.ts` — "Configure and sync Azure DevOps signal" |
| Documentation | Update DX Hub tab definitions, add signal events to catalog metadata |

**Estimated size:**
- Production LOC: ~120 (sync orchestration + command + inbox mapper)
- Tests: ~15 (end-to-end flow test + orchestration tests)
- Files: ~4

**Acceptance criteria:**
- [ ] Full sync flow: configure → test → sync → notes created → status updated
- [ ] Sync errors per item are non-fatal (collected, reported at end)
- [ ] Progress events emitted during sync
- [ ] Sync result includes created/updated/skipped/error counts
- [ ] `flowti:signal-sync` command registered and functional
- [ ] Failed syncs create inbox notification
- [ ] Flow test `flow14-signalSync.test.ts` passes
- [ ] FRI updated to reflect delivery (target 28/35)
- [ ] `npm test` green

---

## Increment Dependencies

```
Inc 1: Signal Foundation — independent, must complete first
    ↓
Inc 2: Azure DevOps Adapter — depends on Inc 1 (adapter interface)
    ↓
Inc 3: Work Item Mapping — depends on Inc 2 (adapter output format)
    ↓
Inc 4: Signal UI — depends on Inc 1 (service API), can parallel with Inc 2-3
    ↓
Inc 5: E2E Orchestration — depends on Inc 1-4 (all pieces assembled)
```

**Recommended order:** Inc 1 → Inc 2 → Inc 3 → Inc 4 (can start after Inc 1) → Inc 5

Inc 4 (UI) can begin once Inc 1 provides the service skeleton, running in parallel with Inc 2 and 3. Inc 5 requires all other increments to be complete.

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Azure DevOps REST API has undocumented quirks | Medium | Medium | Inc 1 includes a spike to validate API behavior. Use well-documented Work Item Tracking API (stable since v5). |
| `requestUrl()` limitations (CORS, headers) | Low | High | Obsidian's `requestUrl()` is specifically designed for cross-origin API calls from plugins. Already used by many community plugins. |
| HTML→Markdown conversion quality | Medium | Low | Start with basic patterns (p, br, strong, em, lists, links, code). Accept imperfect conversion for v1 — users can edit notes. |
| PAT security review raises concerns | Low | Medium | PAT stored in same location as all other plugin state (data.json). Document recommended PAT scopes (minimum: Work Items Read). |
| Signal framework over-engineered | Medium | Medium | Build for Azure DevOps concretely. Extract generic adapter interface, but don't build abstract infrastructure for hypothetical adapters. |
| Cycle 10 not complete (dependencies) | Low | High | If Cycle 10 Inc 1-3 incomplete, fold error handling + EventBus resilience into Cycle 11 Inc 1 as pre-work. |
| Large cycle scope (5 increments) | Medium | Medium | Each increment is self-contained with its own acceptance criteria. Scope can be trimmed: Inc 5 can be slimmed to core sync only (defer command, inbox mapper). |

---

## Success Criteria

| Metric | Target | Notes |
|--------|--------|-------|
| Tests | +80–100 new | Across 5 increments |
| Production LOC | ~600–800 | New Signal domain |
| Events registered | +10 | Signal category in Event Catalog |
| PBIs completed | 5/5 | SIG-001 through SIG-005 |
| FRI | 24 → 28/35 | Architecture + Data Model + UI + Testing improvements |
| RB-5 status | Resolved | External data ingestion operational |
| Build green | `npm test` | Zero regressions, all new tests passing |
| E2E validation | Successful | Work items pulled from real Azure DevOps project into vault |
| Flow test | 1 new | flow14-signalSync.test.ts passing |

---

## Deferred Items

| Item | Reason | Target |
|------|--------|--------|
| Push / write-back to Azure DevOps | Scope control — v1 is pull-only | v2 (Cycle 14+) |
| Scheduled auto-sync | Adds complexity — manual sync sufficient for v1 | v2 |
| Git repository import | Different API surface, different mapping | v2 |
| Other signal adapters (GitHub, Jira, RSS) | Framework supports them, but one adapter at a time | Cycle 14+ |
| Work item relationships | Requires recursive fetching, complex linking | v2 |
| Remaining Cycle 10 tech debt (Inc 4-6) | Deferred to Cycle 12 to prioritize Azure DevOps | Cycle 12 |

---

## Related

- PRD: [[Azure DevOps Integration PRD]] (FRI 24/35 → target 28/35)
- PBIs: [[PBI-SIG-001 Signal Domain Foundation]], [[PBI-SIG-002 Azure DevOps Adapter]], [[PBI-SIG-003 Work Item Mapping and Note Creation]], [[PBI-SIG-004 Signal Management UI]], [[PBI-SIG-005 End-to-End Sync Orchestration]]
- Parent hub: [[Data Exchange Hub PRD]]
- Review: [[Cycle Sequence Review 2026-02-20 Azure DevOps Prioritization]]
- Previous: [[Cycle 10 - Refactoring and Technical Debt Cleanup]] (slimmed to 3 increments)
- Next: Cycle 12 — Release Preparation (installer, canvas, quick capture + deferred Cycle 10 debt)
