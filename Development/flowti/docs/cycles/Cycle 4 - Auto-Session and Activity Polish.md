---
type: DevelopmentCycle
feature: "[[Session Workspaces PRD]]"
stage: completed
cycle: 4
date_planned: 2026-02-18
date_completed: 2026-02-18
pbis:
  - "[[PBI-SW-007 Auto-Session and Session Nudges]]"
bugs:
  - "[[exporter is not evaluating formulas]]"
  - "[[exporter should only show view properties]]"
  - "[[TD-62 generateEventKey non-deterministic when path absent]]"
  - "[[TD-64 file.renamed payload inconsistency breaks path extraction]]"
  - "[[The Data Exchange Dashboard does not know when a Pipeline, Import, or Export was started or is still running after leaving the view]]"
  - "[[when importing a report from the data-exchange hub dashboard and then starting another one, the progressbar gets confused and the first started export gets combined with the second one]]"
  - "[[when running a pipeline from the pipeline detail page, the progress bar does not update]]"
tech_debt:
  - "[[TD-01 UI files exceed size convention]]"
estimated_increments: 6
actual_increments: 6
estimated_tests: 155
actual_tests: 108
total_tests_after: 2426
total_test_files_after: 94
---

# Cycle 4: Bug Fixes, Auto-Session & Activity Polish

## Situation Assessment

### Pre-Cycle State (2026-02-18)

**Plugin health:**
- 2,318 tests passing (32 skipped), 90 test files
- Clean working tree, all builds green
- `npm run build` pipeline: vitest + typedoc + tsc + eslint + esbuild

**Session Workspaces feature:**
- PRD v5, FRI 33/35, stage: in-progress
- PBI-SW-001 (Activity Log): done
- PBI-SW-002 (Context Bindings): done
- PBI-SW-003 (Session Types): done — 8 built-in types, guiding questions, custom type creation
- PBI-SW-004 (Decision Log): done — structured decisions, workspace panel, summary integration
- PBI-SW-005 (Session Summary): done — frontmatter + body + decisions section
- PBI-SW-006 (State Restoration): done — workspace state save/restore on pause/resume
- PBI-SW-008 (Session Output Artifacts): done — 3 built-in templates, custom templates, output panel + picker modal
- Session domain: 2,194 LOC across 4 domain files; 976 LOC across 12 UI files
- 60 session events registered
- SessionService: 1,130 LOC (20 LOC headroom under 1,150 threshold)
- SessionWorkspaceView: 791 LOC (**11 LOC over 780 threshold** — extraction needed before adding features)

**What's next per PRD priority ranking:**
1. PBI-SW-007 (Auto-Session & Session Nudges) — large effort, independent, high user demand
2. PBI-SW-009 (Domain Design Session) — large effort, unblocked (SW-003 done), needs UI spike

**Inbox signals (reviewed 2026-02-18, both vault + plugin inboxes):**

*Resolved by Cycle 4:*
- "file events in the sessions activity log should only be displayed in one item" — **delivered** Inc 2, `groupActivityByFile()`
- "exporter is not evaluating formulas" — **fixed** Inc 1, ResolvedColumn unified descriptor
- "exporter should only show view properties" — **fixed** Inc 1, ResolvedColumn + view order preservation

*In-progress (Cycle 4 Inc 3-5):*
- "I want to automatically start a Day Session to track my usage" — core driver for Inc 3-5
- "I always want to have a daily-session to track what I have done over the day" — duplicate, stage updated to in-progress

*Partially delivered:*
- "I want to filter folders to not appear in my sessions activity log" — per-session filter delivered, global filter deferred
- "I want to capture a Product Development session" — core infra delivered, note updated
- "Guided Tour for the next development cycle" — partially codified, full guided tours remain PBI-SW-009/010

*Deferred to Cycle 5:*
- "I want to easily start a new session while working inside Obsidian" — nudge system
- "I want to have a Domain Design Session" — PBI-SW-009, cross-referenced with 4 related items

*Out of scope (Cycle 5+ candidates):*
- "I want a capture an idea section on my user-hub" — high priority
- "How could the Inbox serve as the main note ingestion point" — cross-referenced
- "I want to manage Flowti inside Flowti" — enabled by daily sessions
- "I want to import and export a session template via JSON" — high priority, low effort

*Open DX bugs (plugin inbox):*
- ~~DX Dashboard loses running state when navigating away~~ — **fixed Inc 2b**, state-backed `ActiveOperation` tracking
- ~~Progress bar confusion with concurrent imports~~ — **fixed Inc 2b**, `operationId` on all events + filtered listeners
- ~~Pipeline detail page progress bar not updating~~ — **fixed Inc 2b**, state-backed rendering + `pipelineId` correlation

**Open bugs (7, all bundled into this cycle):**
1. **Exporter formula evaluation** (HIGH) — export preview shows property names instead of computed formula values from Base views. **Fixed in Inc 1.**
2. **Exporter view properties** (HIGH) — exporter shows ALL properties instead of only the view's selected/ordered columns. **Fixed in Inc 1.**
3. **TD-62: generateEventKey UUID fallback** (MEDIUM) — `IngestionService.generateEventKey()` falls back to UUID when path is undefined. **Fixed in Inc 1.**
4. **TD-64: file.renamed payload inconsistency** (MEDIUM) — `file.renamed` uses `{ oldPath, newPath }` instead of including `path`. **Fixed in Inc 1.**
5. **DX Dashboard state loss** (MEDIUM) — progress rows destroyed on tab navigation. Root: DOM-only progress state. **Fixed in Inc 2b.**
6. **DX Progress bar merge** (MEDIUM) — concurrent imports share progress. Root: events lack operation ID. **Fixed in Inc 2b.**
7. **DX Pipeline progress not updating** (MEDIUM) — only coarse per-source jumps. Root: no per-row progress subscription. **Fixed in Inc 2b.**

**PBI-SW-007 selected over PBI-SW-009 because:**
1. Higher user demand — daily session is a high-priority inbox item with duplicate signals
2. Concurrent session support is foundational — SW-009's guided workflow benefits from it later
3. Daily-tracking is a type addition (known pattern), vs. SW-009's guided step-through UI (novel pattern requiring spike)
4. Activity log aggregation pairs naturally with daily sessions (high activity volume)
5. Session nudges can be deferred to Cycle 5 without losing core value

### Post-Cycle State (2026-02-18)

**Plugin health:**
- 2,426 tests passing (32 skipped), 94 test files (+108 tests, +4 files)
- Clean working tree, all builds green
- `npm run build` pipeline: vitest + typedoc + tsc + eslint + esbuild

**Session Workspaces feature:**
- PBI-SW-007: **partial** — daily-tracking type, concurrent sessions, auto-start, daily note auto-link, same-day restart, preferences UI delivered; nudges + `generateDailySummary()` + flow test deferred to Cycle 5
- TD-01 partial: SessionWorkspaceView extracted to 479 LOC (from 791)
- Activity log aggregation: file-level grouping delivered
- User Hub: 3 tabs (Sessions → Inbox → Preferences), dashboard with quick actions + active session card
- Session Preferences: 3 categories (Profile, Inbox, Sessions) with daily session toggles, activity filter, custom types, output templates
- Daily session lifecycle: auto-start on vault open, auto-stop on unload, same-day restart (reactivates completed session from today), daily note auto-link via `resolveDailyNotePath()` template resolution
- Updated domain metrics:
  - SessionService: ~1,290 LOC (from 1,130, +160 LOC for daily lifecycle + restart)
  - Session events: 64 registered (from 60, +4 daily lifecycle)
  - Session UI: ~1,750 LOC across 16 files (from 976 LOC / 12 files)

---

## Cycle Goals

1. **Fix all open bugs** — 4 Inc 1 bugs (exporter formula + view props, TD-62, TD-64) + 3 Inc 2b DX bugs (dashboard state, progress merge, pipeline progress)
2. **Extract SessionWorkspaceView** — reduce from 791 LOC to ~450 by extracting subscription wiring (205 LOC) and 9 helper methods (~145 LOC); unblocks safe feature additions
3. **Deliver activity log aggregation** — group file events by path (one row per file with latest action + edit count) per inbox signal
4. **Deliver PBI-SW-007 core** — `daily-tracking` session type, concurrent session support (1 daily + 1 focused), auto-start on vault open
5. **Deliver PBI-SW-007 daily note integration** — append daily activity summary to user's daily note on vault close or session stop
6. **Flow test** — end-to-end integration test covering daily session lifecycle

**Explicitly deferred to Cycle 5:**
- Session nudges (SW-007 nudge system, nudge configuration, pre-prepared sessions)
- PBI-SW-009 (Domain Design Session)

---

## Tech Debt Bundled

### TD-01 partial: SessionWorkspaceView extraction (LOW severity, SMALL effort)

**Why now:** SessionWorkspaceView is at 791 LOC (11 over the 780 threshold for non-hub orchestrators). Cycle 4 adds concurrent session support and daily session indicators — estimated +30 LOC to the orchestrator. Without extraction first, the view will grow to ~820+ LOC and exceed the threshold by 40+.

**Fix:** Extract two modules:
1. `SessionWorkspaceSubscriptions.ts` — the 205-line `subscribeToEvents()` method (lines 456-661) becomes a standalone setup function with a callback interface
2. `SessionWorkspaceHelpers.ts` — move 9 methods (lines 665-791): `captureWorkspaceState()`, `restoreWorkspaceState()`, `openOutputPicker()`, `openSaveTemplateModal()`, `openInTab()`, `openInSidebar()`, `revealInFileExplorer()`, `openInAdjacentLeaf()`, `getStatusStyle()`

**Target:** SessionWorkspaceView ≤ 450 LOC after extraction (~350 LOC extracted).

### Activity log aggregation (from inbox signal, no existing TD)

**Why now:** The inbox item "file events in the sessions activity log should only be displayed in one item" is a direct user pain. Daily sessions will generate significantly more activity entries than focused sessions (tracking all vault activity across a full day). Without aggregation, the activity panel becomes unusably long.

**Fix:** Group `SessionActivity` entries by file path in `SessionActivityPanel.renderActivityList()`. Show one row per file with: file name, latest action badge, edit count (if > 1), and latest timestamp. Expand on click to show full history (optional, defer if complex).

---

## Increment Plan

### Inc 1: Bug Fixes — Exporter + Infrastructure

**Goal:** Fix all 4 open bugs: exporter formula evaluation, exporter view property filtering, `file.renamed` payload inconsistency, and `generateEventKey` idempotency fallback.

**Bug 1 — Exporter formula evaluation:**
The export preview shows property names (e.g. `"price"`) instead of computed formula values. Root cause: `ExportService.executeExport()` reads `file.frontmatter?.[column]` which contains the raw frontmatter — Base formula values are computed by the Base plugin and accessible via Obsidian's `metadataCache` or `getPropertyValue()`, not directly in frontmatter. The fix needs to resolve formula columns to their computed values during both preview and export.

**Bug 2 — Exporter view properties:**
The exporter shows ALL frontmatter properties instead of only the columns selected in the Base view. Root cause: `ExportService.scanColumns()` falls back to scanning all frontmatter keys when the view's `order` array doesn't perfectly resolve. Additionally, `Array.from(columnSet).sort()` (alphabetical) loses the view's column order. Fix: respect view `order` array as the authoritative column list, preserve its ordering.

**Bug 3 — TD-64: file.renamed payload:**
`file.renamed` uses `{ oldPath, newPath }` while all other file events use `{ path }`. Fix: add `path: newPath` to the payload alongside existing fields for backward compat. This unblocks generic path extraction for subscriptions and ingestion.

**Bug 4 — TD-62: generateEventKey fallback:**
`generateEventKey()` uses UUID when path is undefined, defeating idempotency. Fix: use a deterministic fallback — hash of `eventType + JSON.stringify(payload)` instead of UUID. With TD-64 fixed, rename events will have `path` and won't hit the fallback.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/infrastructure/events/events.ts` | Add `path: string` (= newPath) to `file.renamed` payload type (line ~275) | ~3 |
| 2 | `src/infrastructure/events/EventBridge.ts` | Add `path: file.path` to `file.renamed` emission (line ~478) | ~1 |
| 3 | `src/domain/ingestion/IngestionService.ts` | Replace UUID fallback with deterministic hash: `eventType::hash(JSON.stringify(payload))` (line ~154) | ~10 |
| 4 | `src/domain/dataExchange/ExportService.ts` | Fix `scanColumns()`: when view `order` exists, use it as authoritative column list; preserve view order instead of alphabetical sort (lines ~100-120) | ~25 |
| 5 | `src/domain/dataExchange/ExportService.ts` | Fix `executeExport()`: for formula columns, resolve computed value via `metadataCache.getFileCache()` property resolution instead of raw frontmatter lookup (lines ~245-250) | ~30 |
| 6 | `src/ui/export/PreviewPage.ts` | Same formula resolution in preview rendering (lines ~154-162) | ~15 |
| 7 | `src/ui/export/ConfigurePage.ts` | Filter property grid to only view columns when exporting a Base view; respect view order | ~15 |
| 8 | `tests/infrastructure/events/EventBridge.test.ts` | `file.renamed` event includes `path` field | ~10 |
| 9 | `tests/domain/ingestion/IngestionService.test.ts` | Pathless events get deterministic keys (not UUID); duplicate pathless events are skipped | ~15 |
| 10 | `tests/domain/dataExchange/ExportService.test.ts` | View columns: only view properties exported; view order preserved; formula values resolved | ~20 |
| 11 | `tests/ui/export/PreviewPage.test.ts` | Formula columns show resolved values in preview | ~10 |

**Est. total:** ~99 LOC source, ~55 tests

**Acceptance criteria:**
- [x] `file.renamed` payload includes `path` field (= newPath) alongside `oldPath`/`newPath`
- [x] `generateEventKey()` uses deterministic hash fallback (not UUID) for pathless events
- [x] Exporter `scanColumns()` returns only view-selected columns when `order` array exists
- [x] Exporter preserves view column order (not alphabetical sort)
- [x] Formula columns resolve to computed values in both export and preview — **implemented via ResolvedColumn unified descriptor (plan approved mid-Inc 1)**
- [x] ConfigurePage property grid filtered to view columns for Base exports
- [x] All existing exporter/ingestion tests pass unchanged
- [x] `npm run build` passes — 2,357 tests (92 files), tsc clean, eslint clean

---

### Inc 2: SessionWorkspaceView Extraction + Activity Log Aggregation

**Goal:** Reduce SessionWorkspaceView to ≤ 450 LOC by extracting subscription wiring and navigation helpers. Group activity log entries by file path.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/session/SessionWorkspaceSubscriptions.ts` | New file: `setupSubscriptions(deps, callbacks)` extracted from lines 456-661. Defines `SubscriptionCallbacks` interface for panel refresh/re-render hooks | ~230 |
| 2 | `src/ui/session/SessionWorkspaceHelpers.ts` | New file: 9 methods from lines 665-791 — workspace state capture/restore, modal openers, leaf navigation, status styling. Takes `WorkspaceHelperDeps` interface (app, eventBus, session getters) | ~145 |
| 3 | `src/ui/SessionWorkspaceView.ts` | Remove extracted code, import + wire helpers via deps interfaces. Target ≤ 450 LOC | -350 net |
| 4 | `src/ui/session/SessionActivityPanel.ts` | Group entries by file path: one row per file, latest action + count badge. Pure `groupActivityByFile()` helper | ~45 |
| 5 | `tests/ui/session/SessionWorkspaceSubscriptions.test.ts` | Subscription setup: correct events wired, callbacks invoked, cleanup returns unsubscribers | ~15 |
| 6 | `tests/ui/session/SessionActivityPanel.test.ts` | File grouping: multiple edits → 1 row, mixed actions, empty state, rename handling | ~15 |
| 7 | `tests/ui/SessionWorkspaceView.test.ts` | Verify existing tests still pass with refactored structure | ~5 |

**Est. total:** ~420 LOC refactored, ~45 LOC new features, ~35 tests

**Acceptance criteria:**
- [x] SessionWorkspaceView ≤ 450 LOC (from 791) — **actual: 479 LOC** (canvas/notes file sections kept in view)
- [x] `SessionWorkspaceSubscriptions.ts` extracted with all 24 event subscriptions + `SubscriptionViewContext` interface (256 LOC)
- [x] `SessionWorkspaceHelpers.ts` extracted with 9 methods + `WorkspaceHelperContext` interface (167 LOC)
- [x] All existing SessionWorkspaceView tests pass unchanged (1 test updated for grouping behavior)
- [x] Activity log groups entries by file path (one row per file) — `groupActivityByFile()` pure function
- [x] Grouped rows show file name, latest action, edit count (`×N` badge if > 1), timestamp
- [x] `npm run build` passes — 2,357 tests (92 files), tsc clean, eslint clean → updated to 2,362 tests after Inc 2b test additions

### Inc 2b: DX Progress Tracking Bug Fixes

**Goal:** Fix 3 related Data Exchange bugs: dashboard state loss on navigation, progress bar merge on concurrent operations, pipeline detail progress not updating. Root cause: events lack operation identifiers and progress state is DOM-only.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/dataExchange/events.ts` | Add `operationId` to all import/export event payloads; add optional `pipelineId` to import+export events | ~15 |
| 2 | `src/domain/dataExchange/ImportService.ts` | Accept `ImportExecuteOptions { operationId?, pipelineId? }`; propagate to all emits; emit `import.completed`/`import.failed` (complete lifecycle emitter) | ~20 |
| 3 | `src/domain/dataExchange/DataExchangeService.ts` | Simplify import/export command handlers — generate `operationId`, delegate lifecycle to sub-services | ~20 |
| 4 | `src/domain/dataExchange/ExportService.ts` | Accept `ExportExecuteOptions { operationId?, pipelineId? }`; include in `export.started`/`export.completed`/`export.failed` (complete lifecycle emitter) | ~15 |
| 5 | `src/domain/dataExchange/PipelineExecutor.ts` | Pass `{ pipelineId: pipeline.id }` to each `executeImport()` and linked `executeExport()` call | ~5 |
| 6 | `src/ui/hub/types.ts` | Add `ActiveOperation` interface + `activeOperations` field to `HubState` | ~18 |
| 7 | `src/ui/DataExchangeHubView.ts` | Subscribe to lifecycle events in `onHubOpen()`; manage `activeOperations` state; cleanup pipeline listeners in `onHubClose()`/`onTabChanged()` | ~80 |
| 8 | `src/ui/hub/HubDashboard.ts` | Render active operations from state after `empty()`; live progress subscriptions filtered by `operationId` | ~60 |
| 9 | `src/ui/hub/DashboardImportExecutor.ts` | Generate + filter by `operationId` | ~10 |
| 10 | `src/ui/hub/ImportsTab.ts` | Generate + filter by `operationId` in `runImportWithFeedback()`; fix Save handler (direct render instead of `scheduleRender()`) | ~15 |
| 11 | `src/ui/hub/PipelinesTab.ts` | State-backed pipeline progress via `renderPipelineProgress()` with live listeners filtered by `pipelineId`; `cleanupLiveListeners()` | ~80 |
| 12 | `src/ui/hub/ExportsTab.ts` | Fix Save handler (direct render instead of `scheduleRender()`) | ~3 |
| 13 | `src/ui/hub/pipelines/PipelineEditForm.ts` | Fix Save handler (direct `renderDetail()` instead of `scheduleRender()`) | ~3 |
| 14 | `src/ui/CsvActionView.ts` | Save button always rendered (hidden by default), toggled reactively via `updateUnsavedHint()` | ~10 |
| 15 | `src/ui/csv/CsvConfigPage.ts` | Call `updateUnsavedHint()` at end of render to sync Save button for changes that trigger re-render | ~1 |
| — | `src/ui/hub/pipelines/PipelineExecution.ts` | **Deleted** — replaced by state-backed rendering in PipelinesTab | -55 |
| 16 | 3 existing test files | Update event payload assertions for `operationId` + `pipelineId` (10 assertions updated/added) | ~50 |

**Est. total:** ~300 LOC source (net ~245 after deletion), ~50 LOC tests

**Acceptance criteria:**
- [x] All import/export events carry `operationId`; pipeline-triggered imports also carry `pipelineId`
- [x] `HubState.activeOperations` tracks in-flight operations; survives dashboard re-render
- [x] Dashboard progress rows rebuild from state on tab navigation return
- [x] Concurrent imports each show independent progress (filtered by `operationId`)
- [x] Pipeline detail page shows per-row progress (not just per-source jumps)
- [x] Edit form Save returns to detail view (direct render, no race with `scheduleRender()`)
- [x] CSV config Save button appears immediately on config change (not only on page navigation)
- [x] All existing tests pass (payload assertions updated)
- [x] `npm run build` passes — 2,362 tests (92 files), tsc clean, eslint clean

---

### Inc 3: PBI-SW-007 Domain Layer — Daily-Tracking Type + Concurrent Sessions

**Goal:** Add `daily-tracking` session type and enable concurrent session support (1 daily + 1 focused).

**Architecture decision — concurrent sessions:**
- `SessionState.dailySessionId: string | null` — separate from `activeSessionId`
- `getActiveSession()` returns focused session only (backward compat — callers unchanged)
- New `getDailySession()` returns daily session by `state.dailySessionId`
- `onActivityEvent()` (line 947) modified: after tracking to focused session via `activeSessionId`, also track to daily session via `dailySessionId` (dual emit)
- Daily session dedup uses `DAILY_ACTIVITY_DEDUP_WINDOW_MS = 30_000` (30s vs 1s for focused) to reduce noise
- Daily session has no timer (durationMinutes = 0), no goals, no guiding questions
- Daily session type config: icon `"calendar"`, `defaultDuration: 0`, `guidingQuestions: []`
- `SessionType` union grows from 8 → 9 members; `SESSION_TYPES` array gets new entry; `SESSION_TYPE_CONFIGS` gets new key

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/session/types.ts` | Add `"daily-tracking"` to `SessionType` union (line 13); entry in `SESSION_TYPES` array (line 24); config in `SESSION_TYPE_CONFIGS` (line 51); `dailySessionId?: string \| null` on `SessionState` (line 314); `DAILY_ACTIVITY_DEDUP_WINDOW_MS = 30_000` constant | ~40 |
| 2 | `src/domain/session/events.ts` | 4 events: `session.daily.start`, `session.daily.started`, `session.daily.stop`, `session.daily.stopped` (all tagged `["system"]`) | ~20 |
| 3 | `src/domain/session/SessionService.ts` | `handleDailyStart()`: create daily-tracking session, set `state.dailySessionId`, transition to active. `handleDailyStop()`: complete daily session, clear `dailySessionId`. `getDailySession()` getter. Modified `onActivityEvent()`: track to both `activeSessionId` and `dailySessionId` sessions (dual emit, separate dedup windows). Backward compat `state.dailySessionId ??= null` in `load()` (insert after line 314) | ~110 |
| 4 | `src/infrastructure/events/catalog.ts` | 4 catalog entries for daily session events, category "Session", tagged `["system"]` | ~8 |
| 5 | `tests/domain/session/SessionService.test.ts` | Daily session: create, start, stop, concurrent activity tracking (both sessions receive events), `getDailySession()`, backward compat, dedup window | ~45 |
| 6 | `tests/domain/session/types.test.ts` | `daily-tracking` type config exists with correct defaults (duration: 0, icon: calendar, no questions) | ~5 |

**Est. total:** ~178 LOC source, ~50 tests

**Acceptance criteria:**
- [x] `"daily-tracking"` is a valid `SessionType` with config (icon: calendar, duration: 0, no guiding questions)
- [x] `SessionState.dailySessionId` tracks the active daily session separately from `activeSessionId`
- [x] `getDailySession()` returns the daily session, `getActiveSession()` returns focused session only (unchanged)
- [x] `onActivityEvent()` emits to both daily and focused sessions when concurrent (dual tracking)
- [x] Daily session uses 30s dedup window (`DAILY_ACTIVITY_DEDUP_WINDOW_MS`)
- [x] Daily session has no timer countdown (duration = 0 means passive tracking)
- [x] 4 new events in catalog: `session.daily.start/started/stop/stopped`
- [x] Backward compat: `state.dailySessionId ??= null` in `load()`
- [x] `npm run build` passes — 2,383 tests (93 files), tsc clean, eslint clean

### Inc 4: PBI-SW-007 UI — Auto-Start + Settings + Workspace Display

**Goal:** Wire daily session auto-start on vault open, settings toggle, and workspace indicators.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/settings/settings.ts` | Add to `FlowtiSettingsSchema` (after line 156): `enableDailySession: z.boolean().default(false)` and `dailyNotePath: z.string().default("")`. Zod schema ensures backward compat via `.default()` | ~6 |
| 2 | `src/main.ts` | In `onLayoutReady()`: if `enableDailySession`, emit `session.daily.start` on workspace-ready (deferred via `setTimeout` 500ms, same as existing service loads) | ~15 |
| 3 | `src/main.ts` | In `onunload()`: if daily session active, emit `session.daily.stop` | ~10 |
| 4 | `src/ui/settings/FlowtiSettingTab.ts` | "Daily Session" section: toggle for auto-start, text input for daily note path pattern (supports `{{date:YYYY-MM-DD}}` placeholder) | ~35 |
| 5 | `src/ui/userHub/UserHubProvider.ts` | Show daily session indicator in User Hub stats: "Daily Session: Active/Off" + activity count | ~20 |
| 6 | `src/ui/SessionWorkspaceView.ts` | Daily session badge in header: small "Daily" chip if viewing daily-tracking session; hide timer/goals/guiding panels for daily sessions (check `session.type === "daily-tracking"`) | ~25 |
| 7 | `tests/ui/SessionWorkspaceView.test.ts` | Daily session: header shows "Daily" badge, timer hidden, goals hidden, guiding questions hidden | ~15 |
| 8 | `tests/ui/settings/FlowtiSettingTab.test.ts` | Daily Session toggle renders, default off | ~5 |

**Est. total:** ~111 LOC source, ~20 tests

**Acceptance criteria:**
- [x] `enableDailySession` setting — moved to User Hub Preferences tab (Sessions category) instead of FlowtiSettingTab; default off
- [x] `dailyNotePath` setting for daily note location pattern — default `"03 - Resources/Daily Notes/{{date:YYYY-MM-DD}}.md"`
- [x] Daily session auto-starts on vault open when setting is enabled
- [x] Daily session auto-stops on plugin unload
- [x] User Hub shows "Daily Session: Active" indicator when running (UserHubProvider stat + dashboard card)
- [x] SessionWorkspaceView shows "Daily" badge for daily sessions
- [x] Timer panel and goals panel hidden for daily sessions (passive tracking only)
- [x] Daily session cannot be manually paused/resumed/completed — only deactivated via settings toggle
- [x] `npm run build` passes — 2,404 tests (94 files), tsc clean, eslint clean

### Inc 5: Tab Polish + Daily Note Auto-Link + Same-Day Restart + Bug Fixes

**Goal:** Polish User Hub tab ordering, add daily note auto-link on session start, enable same-day daily session restart, fix 4 UX bugs discovered during live testing.

| Step | File | Purpose | LOC |
|------|------|---------|-----|
| 1 | `src/ui/userHub/types.ts` | Reorder `UserHubTab` type: `"sessions" \| "inbox" \| "preferences"` | ~1 |
| 2 | `src/ui/UserHubView.ts` | Reorder `getTabDefinitions()`: Sessions → Inbox → Preferences | ~3 |
| 3 | `src/ui/userHub/UserHubDashboard.ts` | Reorder quick actions: Sessions first; add `stopPropagation()` on actions container (bug fix #4) | ~5 |
| 4 | `src/domain/session/events.ts` | Add `dailyNotePath?: string` to `session.daily.start` payload | ~1 |
| 5 | `src/domain/session/helpers.ts` | Add `resolveDailyNotePath(template, date?)` — resolves `{{date:YYYY-MM-DD}}` placeholders | ~12 |
| 6 | `src/domain/session/SessionService.ts` | Rewrite `handleDailyStart(dailyNotePath?)`: same-day restart (find completed daily from today, reactivate) + daily note auto-link (set `session.notesFile` from template) + `startTimer()` guard for zero-duration sessions (bug fix #3) | ~45 |
| 7 | `src/main.ts` | Pass `dailyNotePath` setting in `session.daily.start` emit calls; add `session.daily.stopped` listener → `writeSessionSummary()` | ~15 |
| 8 | `src/ui/userHub/UserHubPreferences.ts` | Change row classes to `ft-catalog-row ft-cursor-pointer` for hover/active state (bug fix #1) | ~3 |
| 9 | `src/domain/settings/settings.ts` | Change `dailyNotePath` default to `"03 - Resources/Daily Notes/{{date:YYYY-MM-DD}}.md"` | ~1 |
| 10 | `src/ui/userHub/UserHubSessions.ts` | Add `session.type !== "daily-tracking"` guards on Pause/Resume/Complete/Save buttons (bug fix #2) | ~8 |
| 11 | `src/ui/SessionWorkspaceView.ts` | Add `isDaily` guard on active/paused action buttons (bug fix #2) | ~5 |
| 12 | `styles.css` | Fix `.ft-catalog-row:hover` to use `var(--background-modifier-hover)` (was invisible `var(--background-primary)`) (bug fix #1) | ~1 |
| 13 | 6 test files | New + updated tests: `resolveDailyNotePath`, daily note auto-link, same-day restart, tab order, preference selectors, settings defaults | ~22 |

**Bug fixes delivered (discovered during live testing):**
1. **Preference items missing hover/active state** — `ft-tree-item` class had no CSS rules; switched to `ft-catalog-row` with existing `:hover` styles. Also fixed `:hover` color from invisible `var(--background-primary)` to `var(--background-modifier-hover)`.
2. **Daily sessions could be manually completed** — added `daily-tracking` type guards on Pause/Resume/Complete/Save-as-Template buttons in both UserHubSessions and SessionWorkspaceView.
3. **Zero-duration sessions instant-complete on Start** — `startTimer()` was called unconditionally; first tick found `remainingMs <= 0` and called `completeSession()`. Fixed with `if (session.durationMinutes <= 0) return;` guard.
4. **Resume from dashboard opens unrelated file** — click event from Resume button bubbled up to the active session card's click handler, which called `openSessionWorkspace()` and restored saved workspace state (which included `00 - Inbox.base`). Fixed with `stopPropagation()` on actions container.

**Acceptance criteria:**
- [x] User Hub tabs show Sessions → Inbox → Preferences (was Inbox → Sessions)
- [x] Quick actions show Sessions first in dashboard
- [x] `resolveDailyNotePath()` resolves `{{date:YYYY-MM-DD}}` template placeholders
- [x] `handleDailyStart()` sets `session.notesFile` from `dailyNotePath` setting template
- [x] Same-day restart: completed daily session from today is reactivated instead of creating new
- [x] `session.daily.stopped` triggers `writeSessionSummary()` to persist daily note
- [x] Preference items show hover/active state
- [x] Daily sessions cannot be paused/resumed/completed via UI buttons
- [x] Zero-duration sessions don't instant-complete on start
- [x] Resume from dashboard doesn't open unrelated files
- [x] `npm run build` passes — 2,426 tests (94 files), tsc clean, eslint clean

---

## Dependency Graph

```
Inc 1: Bug Fixes — exporter + infrastructure (independent, no session deps) ✓
  |
Inc 2: SessionWorkspaceView extraction + Activity aggregation (independent of Inc 1) ✓
  |
Inc 2b: DX Progress Tracking Bug Fixes (independent of Inc 1-2, no session deps) ✓
  |
Inc 3: PBI-SW-007 Domain — types, daily-tracking, concurrent sessions (independent of Inc 1-2b) ✓
  |
Inc 4: PBI-SW-007 UI — auto-start, settings, display (requires Inc 2 extraction + Inc 3 types) ✓
  |
Inc 5: Tab polish + daily note auto-link + same-day restart + bug fixes (requires Inc 4) ✓
```

**Note:** All increments delivered. Inc 1 (bugs) and Inc 2b (DX bugs) were independent. Inc 2 and Inc 3 were independent of each other. Inc 4 required Inc 2+3. Inc 5 built on Inc 4's settings and daily session UI.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Formula evaluation depends on Base plugin internals / metadataCache | Medium | Investigate `metadataCache.getFileCache()` property resolution first. If formula values aren't exposed, may need to access Base plugin API directly. Spike early in Inc 1. |
| Exporter view property fix could break existing folder-based exports | Low | Folder exports don't have `order` arrays — fallback behavior stays for folder sources. Only Base view exports change. |
| Concurrent session activity tracking doubles event volume | Medium | Daily sessions use 30s dedup window (6× focused); profile activity tracking in Inc 3 tests |
| SessionService at 1,130 LOC grows by ~165 LOC (concurrent + daily note) → ~1,295 LOC | High | Plan extraction TD if exceeds 1,300 LOC post-cycle. Most new code is in handlers (natural growth). |
| Daily note path resolution depends on Daily Notes plugin or custom pattern | Medium | Use configurable `dailyNotePath` setting with `{{date}}` placeholder. Skip gracefully if file doesn't exist. |
| `subscribeToEvents()` extraction could break subtle callback ordering | Low | Existing tests cover all subscription behavior. Run full test suite after extraction. |
| Auto-start on vault open adds startup latency | Low | Defer daily session creation to `setTimeout(() => ..., 500)` after layout-ready, same as existing service loads. |

---

## Success Metrics

| Metric | Target | Actual (final) |
|--------|--------|----------------|
| Tests added | ~285 new | 108 (39 Inc 1 + 5 Inc 2 + 21 Inc 3 + 21 Inc 4 + 22 Inc 5) |
| Tests total | ~2,603+ | 2,426 |
| Test suites | ~97+ | 94 |
| LOC added (source) | ~725 new | ~650 (est.) |
| LOC refactored | ~420 (extraction) | ~420 (Inc 2) |
| SessionWorkspaceView LOC | ≤ 450 (from 791) | 479 |
| Bugs fixed | 7 planned | 11 (7 planned + 4 live-testing bugs in Inc 5) |
| PBIs closed | PBI-SW-007 (partial) | PBI-SW-007 partial — core + daily note + restart delivered; nudges deferred |
| New events | 5 (4 daily lifecycle + 1 summary) | 4 (4 daily lifecycle; summary uses existing `writeSessionSummary`) |
| Total session events | 65+ | 64 |
| Flow tests | 13 (new: DailySessionLifecycle) | 12 (DailySessionLifecycle deferred to Cycle 5) |

---

## Cycle Retrospective

### What Went Well
- **Bug fixes front-loaded:** Delivering all 7 planned bugs in Inc 1 + Inc 2b de-risked the cycle early and improved plugin stability before feature work
- **Extraction before features:** Inc 2's SessionWorkspaceView extraction (791 → 479 LOC) made Inc 4-5 changes safe and contained
- **Settings in User Hub Preferences:** Moving session settings from FlowtiSettingTab to User Hub Preferences (3-category master-detail layout) was a better UX decision than planned — settings are co-located with the features they control
- **Same-day restart emerged naturally:** The `handleDailyStart()` rewrite to support daily note auto-link made same-day restart trivial to add (check for completed session from today before creating new)
- **Live testing caught 4 real bugs:** Preference hover, daily completion, zero-duration timer, and click bubbling were all caught and fixed in the same session — each was a 1-5 line fix

### Deviations from Plan
- **Inc 1 Bug 1+2 (exporter):** Original plan had incremental fixes to `scanColumns()` and `executeExport()`. Mid-increment, the scope expanded to a full **ResolvedColumn unified descriptor** approach (approved plan) — added `ResolvedColumn` type, `scanResolvedColumns()`, unified column rendering across ExportService, PreviewPage, ConfigurePage, and ViewSelectPage. Better architecture than planned, but more LOC (~200 vs ~70 est).
- **Inc 2 SessionWorkspaceView:** Target was ≤ 450 LOC. Actual: 479 LOC — canvas/notes file creation sections stayed in view (30 LOC over, acceptable for orchestrator).
- **Inc 2b PipelineExecution.ts deleted:** Original plan had PipelineExecution subscribing to `import.progress` by `pipelineId`. Investigation revealed it created DOM-based progress that was immediately destroyed by `scheduleRender()` from `pipeline.started`. Fixed by **deleting** `PipelineExecution.ts` entirely and adding state-backed `renderPipelineProgress()` to `PipelinesTab` — same pattern as dashboard. Net cleaner: one component less, progress survives re-renders.
- **Inc 2b ImportService/ExportService became complete lifecycle emitters:** Original plan had `DataExchangeService` emitting `import.completed`/`import.failed`. Refactored so each sub-service emits its own lifecycle events, and `DataExchangeService` handlers became thin delegates. Better separation of concerns.
- **Inc 2b three additional UX bugs discovered and fixed:** (1) Edit form Save handlers used `scheduleRender()` which raced with `config.changed` event — fixed with direct `renderMaster()`/`renderDetail()` calls. (2) CSV config Save button only appeared after page navigation — fixed by always rendering (hidden) + toggling in `updateUnsavedHint()`. (3) Pipeline export events now carry `pipelineId` for linked export tracking (not in original plan).
- **Inc 3 `dailySessionId` made optional:** Plan called for `dailySessionId: string | null` (required). Made it `dailySessionId?: string | null` (optional) to avoid updating 30+ existing test state literals. Backward compat `??= null` in `load()` handles undefined.
- **Inc 3 dual artifact tracking added:** Plan focused on dual `onActivityEvent()` tracking. Implementation also added dual `onFileEvent()` tracking via extracted `trackArtifactToSession()` helper — both artifact and activity events now track to both daily and focused sessions.
- **Inc 3 `handleDelete()` cleanup added:** Plan didn't mention delete. Added `dailySessionId` cleanup in `handleDelete()` (same pattern as `completeSession()`) to prevent stale reference if a daily session is deleted.
- **Inc 3 `session.loaded` event updated:** Added `dailySessionId` to `session.loaded` payload type — not in original plan but required for UI consumers to know daily session state on startup.
- **Inc 4 settings location changed:** Plan called for `enableDailySession` and `dailyNotePath` settings in `FlowtiSettingTab` (Obsidian settings panel). Instead, all session-related settings moved to a new **User Hub Preferences tab** with 3 categories (Profile, Inbox, Sessions). `UserHubSessionPreferences.ts` (~175 LOC) provides the full session settings UI. Better UX — settings co-located with the features they control.
- **Inc 4 added daily session completion guard:** Not in original plan. Added `session.type !== "daily-tracking"` guards on Pause/Resume/Complete/Save-as-Template buttons in both UserHubSessions and SessionWorkspaceView. Daily sessions can only be deactivated via settings toggle, not manually completed.
- **Inc 5 scope changed entirely:** Original Inc 5 was "Daily Note Integration + Flow Test" (`generateDailySummary()`, daily note append, flow test `13-DailySessionLifecycle.test.ts`). Actual Inc 5 became "Tab Polish + Daily Note Auto-Link + Same-Day Restart + Bug Fixes". `generateDailySummary()` was deferred — daily note writing reuses the existing `writeSessionSummary()` pipeline via a `session.daily.stopped` listener. Flow test deferred to Cycle 5.
- **Inc 5 same-day restart was unplanned:** The user requested that stopping and restarting a daily session on the same day should reactivate the existing session rather than creating a new one. Implemented as a simple `createdAt.startsWith(today)` check in `handleDailyStart()`.
- **Inc 5 tab reorder was unplanned:** User Hub tab order changed from Inbox → Sessions → Preferences to Sessions → Inbox → Preferences. Quick actions reordered to match.
- **Inc 5 discovered 4 bugs during live testing:** (1) Preference items had no hover/active CSS, (2) daily sessions could be manually completed, (3) zero-duration sessions instant-completed on Start, (4) Resume from dashboard opened unrelated file via click event bubbling. All fixed inline.

### Improvement Backlog (from this cycle)
- [ ] PBI-SW-007 nudge system — deferred from this cycle
- [ ] `generateDailySummary()` — dedicated daily activity summary renderer (currently reuses `writeSessionSummary`)
- [ ] Flow test `13-DailySessionLifecycle.test.ts` — end-to-end daily session lifecycle coverage
- [ ] Consider extracting `ActiveOperation` state management into a dedicated `OperationTracker` service if more hub views need progress tracking
- [ ] SessionService at ~1,290 LOC — approaching 1,300 threshold, consider extraction if more features added
- [ ] Global activity folder filter (per-session filter delivered, global deferred)

### Learnings
- **`scheduleRender()` is wrong for state transitions:** Debounced rendering (16ms via `setTimeout`) races with async EventBus emissions. When a handler calls `scheduleRender()` and a `.then()` callback also needs to render after state change, the handler's render fires first while the old state is still set. Fix: use direct `renderMaster()`/`renderDetail()` for state transitions (same pattern as Cancel buttons).
- **DOM-based progress is fragile:** Any `el.empty()` call destroys progress bars. State-backed `ActiveOperation` tracking with live listener reattachment on render is the correct pattern for progress that must survive navigation.
- **Sub-services should own their lifecycle events:** Having `DataExchangeService` emit `import.completed`/`import.failed` on behalf of `ImportService` created unnecessary coupling. Letting each sub-service emit its own lifecycle makes `operationId`/`pipelineId` propagation natural and the orchestrator handler simpler.
- **Zero-duration sessions need timer guards:** `startTimer()` must early-return for `durationMinutes <= 0` — otherwise the first timer tick (1s later) sees `remainingMs <= 0` and immediately completes the session. Any time-based feature needs explicit duration checks.
- **Click event bubbling in nested action containers:** When action buttons (Resume, Pause, etc.) live inside clickable cards, the click event bubbles up to the card's handler. Always `stopPropagation()` on the actions container — not on individual buttons, which is error-prone as new buttons are added.
- **CSS variable invisibility trap:** `.ft-catalog-row:hover` using `var(--background-primary)` was identical to the inherited background, making hover invisible. Always verify hover colors against parent backgrounds — use `var(--background-modifier-hover)` which is guaranteed to be visually distinct.
- **Settings co-location > central settings panel:** Moving session-related settings from the Obsidian settings tab to User Hub Preferences improved discoverability. Users expect to configure features where they use them, not in a separate modal.

---

## Related

- PRD: [[Session Workspaces PRD]] (v6, FRI 33/35)
- PBIs: [[PBI-SW-007 Auto-Session and Session Nudges]] (partial delivery — core + daily note, nudges deferred)
- Bugs: [[exporter is not evaluating formulas]], [[exporter should only show view properties]], [[TD-62 generateEventKey non-deterministic when path absent]], [[TD-64 file.renamed payload inconsistency breaks path extraction]], [[The Data Exchange Dashboard does not know when a Pipeline, Import, or Export was started or is still running after leaving the view]], [[when importing a report from the data-exchange hub dashboard and then starting another one, the progressbar gets confused and the first started export gets combined with the second one]], [[when running a pipeline from the pipeline detail page, the progress bar does not update]]
- Tech Debt: [[TD-01 UI files exceed size convention]] (partial — SessionWorkspaceView extraction)
- Inbox signals (reviewed 2026-02-18, vault + plugin inboxes — 32 + 39 items):
  - Resolved: 3 items (activity aggregation, 2 exporter bugs)
  - In-progress: 2 items (daily session — canonical + duplicate)
  - Partially delivered: 3 items (folder filter, product dev, guided tour)
  - Deferred: 2 items (nudge system Cycle 5, domain design PBI-SW-009)
  - Out of scope: 4 items (idea capture, inbox ingestion, manage Flowti, session template JSON)
  - Open DX bugs: 3 items → **fixed in Inc 2b** (dashboard state, progress bar confusion, pipeline progress) + 3 additional UX bugs discovered and fixed (edit form Save, CSV Save button, pipeline export pipelineId)
- Learnings (input): [[L-25 Overview placeholder bug]], [[L-28 Carry-forward escalation]]
- Learnings (output): [[L-29 Zero-duration timer guard]], [[L-30 Click event bubbling in action containers]], [[L-31 CSS variable invisibility]], [[L-32 Settings co-location]]
- Previous Cycle: [[Cycle 3 - Session Output Artifacts and State Restoration]]
- Next Cycle: [[Cycle 5 - Daily Summary and Session Nudges]]
