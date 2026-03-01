---
type: DevelopmentCycle
feature: "[[Backlog Refinement - Post Cycle 48]]"
stage: in-progress
cycle: 54
release_anchor:
  - "Theme 4: Feature Deepening — Competitive Moat"
pbis:
  - "PBI-CAN-003: Canvas Sessions"
  - "PBI-CAN-002: Canvas template library"
  - "PBI-SIG-008: Signal Azure DevOps hardening"
  - "PBI-006: Auto-route inbox files"
bugs: []
tech_debt:
  - CLI wrapper unit tests (C53 backlog)
  - RB-6 CLI Installer reassessment (C53 backlog)
estimated_increments: 8
estimated_loc: 1490
estimated_tests: 135
pre_cycle_tests: 5825
pre_cycle_suites: 252
---

# Cycle 54 — Canvas Sessions and Signal Hardening

## Release Anchor Theme

- **Theme 4: Feature Deepening — Competitive Moat** — Visual workflows and integration reliability.

## Situation Assessment

### Pre-Cycle State

- **Tests**: 5,825 passing (252 suites) — all green
- **E2E**: 69 tests (53 pass, 16 skip) — established in C53
- **Build**: `npm run build` green
- **Open bugs**: None critical (TD-123/124/125 are medium severity)
- **Previous cycle**: C53 (Obsidian CLI Spike) closed — DoD satisfied, retrospective complete
- **ADR-028**: Updated to Accepted (resolved in C53)
- **Data Exchange Evolution**: Deferred from C53 → C55 (RB-7 target updated)

### C53 Improvement Backlog Items Carried Forward

| Item | Classification | Action |
|------|----------------|--------|
| CLI wrapper unit tests (mock execSync) | Tech debt | Inc 0 — isolated unit tests for ObsidianCli wrapper |
| RB-6 CLI Installer reassessment | Architecture decision | Inc 0 — formal analysis: does Obsidian 1.12 CLI supersede RB-6? |
| ADR-028 update to Accepted | Documentation | Already completed during C53 DoD — no action needed |
| Per-step `settleMs` on JourneyStep config | Enhancement | Deferred — apply when adding new journeys |
| Canvas visual polish | Enhancement | Deferred — separate cycle or organic improvement |
| Populate journey step metadata | Enhancement | Deferred — Getting Started and Component Library steps |
| CI/CD pipeline for E2E | Future PRD | Deferred — requires Xvfb spike (PBI-RP-003) |
| Visual regression diff comparison | Future PRD | Deferred — screenshot diffing tooling |

## Cycle Overview

Cycle 54 invests in two differentiators: **Canvas Sessions** (visual-first domain modeling) and **Signal hardening** (reliable Azure DevOps integration). Canvas is Flowti's most visually distinctive feature — Train of Thought already uses it extensively (349 domain tests, 15 UI files). Canvas Sessions extend this to guided, structured visual workflows. Signal hardening ensures the existing Azure DevOps adapter is production-reliable before we ever consider adding Jira or GitHub.

Additionally, auto-routing inbox files by type (PBI-006) transforms the inbox from a dumping ground into a true triage zone.

## User Pains

1. **No guided Canvas workflows** — Canvas is powerful for freeform thinking (Train) but has no structured session mode. Users can't start a "Domain Design Session" or "Sprint Planning Session" with preconfigured areas (PBI-CAN-003).
2. **No Canvas templates** — Each canvas starts blank. No domain-specific starter templates (PBI-CAN-002).
3. **Signal Azure DevOps has no error recovery** — Network failures, token expiry, and API rate limits are not handled gracefully. No retry logic, no diagnostics, no connection health monitoring (PBI-SIG-008).
4. **Inbox files stay in inbox forever** — Once a note is typed (e.g., `type: Idea` → `type: Feature`), it should auto-route to the appropriate vault folder. Currently, typed notes rot in inbox (PBI-006).

## Cycle Goals

1. **Close C53 housekeeping** — CLI wrapper unit tests and RB-6 reassessment
2. **Implement Canvas Sessions** with sidebar monitor and preconfigured canvas areas
3. **Build Canvas template library** with 5 starter templates
4. **Harden Signal Azure DevOps adapter** with retry, diagnostics, and health monitoring
5. **Implement inbox auto-routing** by type

## Scope

### In Scope
- PBI-CAN-003: Canvas Sessions (sidebar monitor, preconfigured areas, guided flow)
- PBI-CAN-002: Canvas template library (5 templates: Domain Design, Sprint Planning, Retrospective, Brainstorm, Flow Design)
- PBI-SIG-008: Signal ADO hardening (retry with backoff, token refresh detection, rate limit handling, connection health, diagnostics panel)
- PBI-006: Auto-route inbox files by type (configurable routing rules)

### Out of Scope
- Signal v2 (Jira, GitHub adapters) — explicitly deferred beyond C55
- Signal push/write-back — deferred to Signal v2
- Signal auto-sync scheduling — deferred to Signal v2
- Canvas import from external sources — existing CanvasImporter sufficient
- Canvas round-trip sync — deferred

## Increments

### Inc 0: C53 Housekeeping
**Theme**: Quality
**Effort**: Small | **Est. LOC**: ~80 | **Est. Tests**: ~20

Close improvement backlog items carried forward from Cycle 53:

**CLI Wrapper Unit Tests**:
- Add isolated unit tests for `ObsidianCli` class with mocked `execSync`/`exec`
- Test: `run()`, `eval()`, `createFile()`, `readFile()`, `deleteFile()`, `setProperty()`, `search()`, `getPlugins()`, `reloadPlugin()`, `executeCommand()`, `getPluginState()`, `evalJson()`
- Test error paths: CLI not running, timeout, syntax errors, plugin not loaded
- File: `tests/infrastructure/cli/ObsidianCli.test.ts` (extend or create)

**RB-6 CLI Installer Reassessment**:
- Obsidian 1.12 CLI provides `plugin:enable`, `plugin:disable`, `plugin:reload` natively
- Analyze: does this supersede the need for a CLI-based installer (RB-6)?
- Decision: update RB-6 status (close as superseded, or refine scope to what CLI doesn't cover)
- Document decision in RB-6 file with rationale

**Acceptance Criteria**:
- [ ] CLI wrapper has isolated unit tests (mock execSync)
- [ ] Error scenarios tested (timeout, not running, syntax error)
- [ ] RB-6 decision documented with rationale
- [ ] `npm test` green

### Inc 1: Canvas Template Library (PBI-CAN-002)
**Theme**: Feature Deepening
**Effort**: Medium | **Est. LOC**: ~200 | **Est. Tests**: ~15

Create preconfigured canvas templates for structured sessions:
- Template storage: `templates/canvas/` folder with `.canvas` files
- 5 starter templates:
  - **Domain Design**: groups for Actors, Events, Services, Flows with connection guides
  - **Sprint Planning**: backlog, sprint goal, capacity, commitment areas
  - **Retrospective**: went-well, improve, action-items columns
  - **Brainstorm**: central topic node with radial idea zones
  - **Flow Design**: start, steps, decision points, end zones
- Template picker UI in Train Hub
- Each template includes color-coded groups and placeholder cards

**Acceptance Criteria**:
- [ ] 5 canvas templates created and stored
- [ ] Template picker UI in Train Hub
- [ ] Templates load correctly into Obsidian Canvas
- [ ] Placeholder cards and groups render as designed
- [ ] Unit tests for template loading and validation
- [ ] `npm test` green

### Inc 2: Canvas Session — Sidebar Monitor (PBI-CAN-003a)
**Theme**: Feature Deepening
**Effort**: Medium | **Est. LOC**: ~250 | **Est. Tests**: ~20

Build the canvas session sidebar that monitors active canvas work:
- Sidebar leaf (Obsidian right sidebar) shows session state
- Tracks: session goal, active template, nodes added/modified/connected
- Timer: session duration with pause/resume
- Activity feed: real-time list of canvas operations (node added, connected, moved to group)
- Integrates with existing SessionService for lifecycle management

**Acceptance Criteria**:
- [ ] Sidebar opens alongside active canvas
- [ ] Session goal displayed and editable
- [ ] Node tracking (added, modified, connected)
- [ ] Timer with pause/resume
- [ ] Activity feed updates in real-time
- [ ] Unit tests for sidebar state management
- [ ] `npm test` green

### Inc 3: Canvas Session — Guided Flow (PBI-CAN-003b)
**Theme**: Feature Deepening
**Effort**: Large | **Est. LOC**: ~350 | **Est. Tests**: ~25

Implement guided canvas session workflow:
- "Start Canvas Session" command: select template → set goal → open canvas + sidebar
- Canvas opens with selected template applied
- Groups in template map to session phases (e.g., "Actors" phase → "Events" phase → "Flows" phase)
- Phase progression: sidebar highlights current phase, suggests next steps
- Session close: generate summary note from canvas content (reuse TrainSummaryWriter pattern)
- Emit canvas session events (session.canvas.started, session.canvas.phase.changed, session.canvas.completed)

**Acceptance Criteria**:
- [ ] "Start Canvas Session" command works end-to-end
- [ ] Template applied to new canvas
- [ ] Phase progression tracked in sidebar
- [ ] Summary note generated on session close
- [ ] Canvas session events emitted
- [ ] Unit tests for session lifecycle and phase progression
- [ ] `npm test` green

### Inc 4: Signal Azure DevOps — Retry and Error Handling (PBI-SIG-008a)
**Theme**: Feature Deepening
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~20

Harden AzureDevOpsAdapter with robust error handling:
- Exponential backoff retry (3 attempts, 1s/2s/4s delays)
- Token expiry detection: catch 401 responses, emit `signal.auth.expired` event
- Rate limit handling: detect 429 responses, respect `Retry-After` header
- Network failure handling: catch ECONNREFUSED/ETIMEDOUT, emit `signal.connection.failed`
- All errors logged with context (operation, URL, attempt number)

**Acceptance Criteria**:
- [ ] Retry with exponential backoff on transient failures
- [ ] 401 detected and `signal.auth.expired` emitted
- [ ] 429 detected with Retry-After respected
- [ ] Network failures caught and reported
- [ ] All errors logged with context
- [ ] Unit tests for each error scenario (mocked HTTP responses)
- [ ] `npm test` green

### Inc 5: Signal Azure DevOps — Diagnostics and Health (PBI-SIG-008b)
**Theme**: Feature Deepening
**Effort**: Medium | **Est. LOC**: ~200 | **Est. Tests**: ~15

Add connection health monitoring and diagnostics:
- Connection health check: periodic ping (configurable: every 5 min when active)
- Health status: healthy/degraded/unreachable with last-check timestamp
- Diagnostics panel in Signal tab: connection status, last sync time, error history (last 10)
- "Test Connection" button with detailed result (latency, API version, permissions)
- Health status visible in Signal tab header (green/yellow/red indicator)

**Acceptance Criteria**:
- [ ] Health check runs periodically
- [ ] Status tracked: healthy/degraded/unreachable
- [ ] Diagnostics panel shows connection details and error history
- [ ] "Test Connection" returns detailed diagnostics
- [ ] Health indicator visible in Signal tab
- [ ] Unit tests for health check logic and status transitions
- [ ] `npm test` green

### Inc 6: Inbox Auto-Routing (PBI-006)
**Theme**: Feature Deepening
**Effort**: Medium | **Est. LOC**: ~180 | **Est. Tests**: ~15

Auto-route inbox files to appropriate folders based on type:
- Routing rules: `{ type: string, targetFolder: string }[]` in settings
- Default rules: `Idea → inbox/`, `Feature → features/`, `Bug → bugs/`, `Learning → learnings/`
- Trigger: when `type` frontmatter changes on an inbox file
- Move file to target folder, update internal links
- Emit `inbox.file.routed` event with source, target, type
- Opt-in: disabled by default, enable in settings

**Acceptance Criteria**:
- [ ] Routing rules configurable in settings
- [ ] File moves to target folder on type change
- [ ] Internal links updated after move
- [ ] Event emitted with routing details
- [ ] Disabled by default (opt-in)
- [ ] Unit tests for routing logic and link updates
- [ ] `npm test` green

### Inc 7: Integration and Polish
**Theme**: Feature Deepening
**Effort**: Small | **Est. LOC**: ~80 | **Est. Tests**: ~5

Wire everything together and verify cross-feature interactions:
- Canvas Sessions visible in session history (reuse existing session list)
- Signal health visible on User Hub dashboard (health widget)
- Inbox routing status visible in inbox view (routed count)
- Update onboarding callouts for new features

**Acceptance Criteria**:
- [ ] Canvas sessions appear in session history
- [ ] Signal health visible on User Hub
- [ ] Inbox routing status displayed
- [ ] Onboarding callouts updated
- [ ] Manual end-to-end verification
- [ ] `npm test` green

## Dependency Graph

```
Inc 0 (Housekeeping)        ──→ Independent (first increment)
Inc 1 (Templates)           ──→ Inc 3 (Guided Flow)
Inc 2 (Sidebar Monitor)     ──→ Inc 3 (Guided Flow)
Inc 4 (Signal Retry)        ──→ Inc 5 (Signal Diagnostics)
Inc 6 (Inbox Routing)       ──→ Independent
Inc 7 (Integration)         ──→ Depends on Inc 1–6
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Canvas Session scope is large (sidebar + guided flow + summary) | High | Inc 1-2 are independently valuable; Inc 3 can be reduced to MVP |
| Obsidian Canvas API limitations for programmatic node creation | Medium | CanvasWriter (548 LOC) already handles this; extend as needed |
| Signal health check adds background network traffic | Low | Only when signal is configured; configurable interval |
| Inbox file moves break existing links | Medium | Use Obsidian's vault.rename() which updates links automatically |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~130 |
| Post-cycle tests | ~5,955 |
| Canvas templates | 5 |
| Signal error scenarios covered | 4 (401, 429, network, timeout) |
| Routing rules | 4+ default types |
| CLI wrapper unit tests | ~20 |
| RB-6 decision | Documented |
| Increments | 8 |

## Deferred Items

- **Data Exchange Evolution** → C55 (RB-7 multi-source merge, TD-69 import concurrency, PBI-008 execution timing, PBI-DX-001 step preview)
- Signal v2 (Jira, GitHub adapters) → beyond C55 (strategic decision)
- Signal push/write-back → beyond C55
- Signal auto-sync scheduling → beyond C55
- Canvas round-trip sync → future cycle
- Canvas import from external formats → existing importer sufficient
- Per-step settleMs on JourneyStep config → next journey additions
- CI/CD pipeline for E2E → PBI-RP-003, requires Xvfb spike
- Visual regression diff comparison → future tooling cycle

## Actual Results

| Metric | Target | Actual |
|--------|--------|--------|
| New tests | ~130 | 184 (6,009 − 5,825) |
| Post-cycle tests | ~5,955 | 6,009 |
| Post-cycle suites | ~255 | 261 |
| Canvas templates | 5 | 5 |
| Signal error scenarios | 4 | 4 (401, 429, network, timeout) |
| Routing rules | 4+ default | 4 (idea, feature, bug, learning) |
| CLI wrapper edge tests | ~20 | 6 (40 already existed from C53) |
| RB-6 decision | Documented | Closed as superseded |
| Increments | 8 | 8 |

### Increment Summary

| Inc | Theme | New Tests | New Files | Key Deliverables |
|-----|-------|-----------|-----------|-----------------|
| 0 | Housekeeping | 6 | 0 | CLI edge tests, RB-6 closed |
| 1 | Canvas Templates | 54 | 4 | 5 templates, CanvasTemplateService, CanvasTemplatePickerModal |
| 2 | Canvas Sidebar | 24 | 3 | CanvasSessionMonitor, CanvasSessionSidebar, session types |
| 3 | Canvas Guided Flow | 18 | 1 | CanvasSessionService, summary writer, command registration |
| 4 | Signal Retry | 22 | 1 | Exponential backoff, error classification, retry helpers |
| 5 | Signal Diagnostics | 28 | 2 | SignalHealthMonitor, SignalDiagnosticsService, health events |
| 6 | Inbox Routing | 20 | 1 | InboxAutoRouter, routing rules, settings, inbox.file.routed |
| 7 | Integration | 12 | 1 | SESSION_TYPE_LABELS fix, callout updates, integration tests |

### New Events (7)
- `canvas.template.created`, `canvas.session.started`, `canvas.session.activity`, `canvas.session.completed`
- `signal.health.checked`, `signal.health.changed`
- `inbox.file.routed`

### New Settings (2)
- `inboxAutoRoutingEnabled` (boolean, default false)
- `inboxRoutingRules` (array, 4 default rules)
