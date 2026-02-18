---
type: DevelopmentCycle
feature: "[[Session Workspaces PRD]]"
stage: in-progress
cycle: 4
date_planned: 2026-02-18
date_completed:
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
actual_increments:
estimated_tests: 155
actual_tests:
total_tests_after:
total_test_files_after:
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

*Open DX bugs (plugin inbox, not in Cycle 4):*
- DX Dashboard loses running state when navigating away
- Progress bar confusion with concurrent imports
- Pipeline detail page progress bar not updating

**Open bugs (7, all bundled into this cycle):**
1. **Exporter formula evaluation** (HIGH) — export preview shows property names instead of computed formula values from Base views. **Fixed in Inc 1.**
2. **Exporter view properties** (HIGH) — exporter shows ALL properties instead of only the view's selected/ordered columns. **Fixed in Inc 1.**
3. **TD-62: generateEventKey UUID fallback** (MEDIUM) — `IngestionService.generateEventKey()` falls back to UUID when path is undefined. **Fixed in Inc 1.**
4. **TD-64: file.renamed payload inconsistency** (MEDIUM) — `file.renamed` uses `{ oldPath, newPath }` instead of including `path`. **Fixed in Inc 1.**
5. **DX Dashboard state loss** (MEDIUM) — progress rows destroyed on tab navigation. Root: DOM-only progress state. **Planned in Inc 2b.**
6. **DX Progress bar merge** (MEDIUM) — concurrent imports share progress. Root: events lack operation ID. **Planned in Inc 2b.**
7. **DX Pipeline progress not updating** (MEDIUM) — only coarse per-source jumps. Root: no per-row progress subscription. **Planned in Inc 2b.**

**PBI-SW-007 selected over PBI-SW-009 because:**
1. Higher user demand — daily session is a high-priority inbox item with duplicate signals
2. Concurrent session support is foundational — SW-009's guided workflow benefits from it later
3. Daily-tracking is a type addition (known pattern), vs. SW-009's guided step-through UI (novel pattern requiring spike)
4. Activity log aggregation pairs naturally with daily sessions (high activity volume)
5. Session nudges can be deferred to Cycle 5 without losing core value

### Post-Cycle State (YYYY-MM-DD)
<!-- Filled post-delivery -->

**Plugin health:**
- X tests passing (Y skipped), Z test files (+N tests, +M files)

**Session Workspaces feature:**
- PBI-SW-007: **partial** — daily-tracking type, concurrent sessions, auto-start, daily note integration delivered; nudges deferred to Cycle 5
- TD-01 partial: SessionWorkspaceView extracted to ~450 LOC (from 791)
- Activity log aggregation: file-level grouping delivered
- Updated domain metrics:

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
- [x] `npm run build` passes — 2,357 tests (92 files), tsc clean, eslint clean

### Inc 2b: DX Progress Tracking Bug Fixes

**Goal:** Fix 3 related Data Exchange bugs: dashboard state loss on navigation, progress bar merge on concurrent operations, pipeline detail progress not updating. Root cause: events lack operation identifiers and progress state is DOM-only.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/dataExchange/events.ts` | Add `operationId` to all import/export event payloads; add optional `pipelineId` to import events | ~15 |
| 2 | `src/domain/dataExchange/ImportService.ts` | Accept `{ operationId?, pipelineId? }` options; propagate to all emits | ~12 |
| 3 | `src/domain/dataExchange/DataExchangeService.ts` | Generate `operationId` in import/export command handlers; pass through to services and completion events | ~20 |
| 4 | `src/domain/dataExchange/ExportService.ts` | Accept `{ operationId? }` option; include in `export.started` | ~8 |
| 5 | `src/domain/dataExchange/PipelineExecutor.ts` | Pass `{ pipelineId: pipeline.id }` to each `executeImport()` call | ~3 |
| 6 | `src/ui/hub/types.ts` | Add `ActiveOperation` interface + `activeOperations` field to `HubState` | ~18 |
| 7 | `src/ui/DataExchangeHubView.ts` | Subscribe to lifecycle events in `onHubOpen()`; manage `activeOperations` state | ~60 |
| 8 | `src/ui/hub/HubDashboard.ts` | Render active operations from state after `empty()`; live progress subscriptions | ~60 |
| 9 | `src/ui/hub/DashboardImportExecutor.ts` | Generate + filter by `operationId` | ~10 |
| 10 | `src/ui/hub/ImportsTab.ts` | Generate + filter by `operationId` in `runImportWithFeedback()` | ~10 |
| 11 | `src/ui/hub/pipelines/PipelineExecution.ts` | Subscribe to `import.progress` filtered by `pipelineId` for per-row updates | ~14 |
| 12 | 6 existing test files | Update event payload assertions for `operationId` | ~30 |
| 13 | 2 new test files | Concurrent isolation + pipeline granular progress tests | ~80 |

**Est. total:** ~230 LOC source, ~110 LOC tests

**Acceptance criteria:**
- [ ] All import/export events carry `operationId`; pipeline-triggered imports also carry `pipelineId`
- [ ] `HubState.activeOperations` tracks in-flight operations; survives dashboard re-render
- [ ] Dashboard progress rows rebuild from state on tab navigation return
- [ ] Concurrent imports each show independent progress (filtered by `operationId`)
- [ ] Pipeline detail page shows per-row progress (not just per-source jumps)
- [ ] All existing tests pass (payload assertions updated)
- [ ] `npm run build` passes

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
- [ ] `"daily-tracking"` is a valid `SessionType` with config (icon: calendar, duration: 0, no guiding questions)
- [ ] `SessionState.dailySessionId` tracks the active daily session separately from `activeSessionId`
- [ ] `getDailySession()` returns the daily session, `getActiveSession()` returns focused session only (unchanged)
- [ ] `onActivityEvent()` emits to both daily and focused sessions when concurrent (dual tracking)
- [ ] Daily session uses 30s dedup window (`DAILY_ACTIVITY_DEDUP_WINDOW_MS`)
- [ ] Daily session has no timer countdown (duration = 0 means passive tracking)
- [ ] 4 new events in catalog: `session.daily.start/started/stop/stopped`
- [ ] Backward compat: `state.dailySessionId ??= null` in `load()`
- [ ] `npm run build` passes

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
- [ ] `enableDailySession` setting in FlowtiSettingTab (default off)
- [ ] `dailyNotePath` setting for daily note location pattern
- [ ] Daily session auto-starts on vault open when setting is enabled
- [ ] Daily session auto-stops on plugin unload
- [ ] User Hub shows "Daily Session: Active" indicator when running
- [ ] SessionWorkspaceView shows "Daily" badge for daily sessions
- [ ] Timer panel and goals panel hidden for daily sessions (passive tracking only)
- [ ] `npm run build` passes

### Inc 5: Daily Note Integration + Flow Test

**Goal:** Append daily activity summary to user's daily note. End-to-end integration test.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/session/helpers.ts` | `generateDailySummary(session): string` — pure function rendering activity summary as markdown list (grouped by file, with action counts) | ~45 |
| 2 | `src/domain/session/events.ts` | 1 event: `session.daily.summary.generated` | ~5 |
| 3 | `src/domain/session/SessionService.ts` | On `session.daily.stopped`: generate summary, resolve daily note path, append via `FileSystemClient`, emit `session.daily.summary.generated` | ~55 |
| 4 | `src/infrastructure/events/catalog.ts` | 1 catalog entry for summary event | ~2 |
| 5 | `tests/domain/session/helpers.test.ts` | `generateDailySummary()`: grouped output, empty session, many files | ~20 |
| 6 | `tests/domain/session/SessionService.test.ts` | Daily stop → summary generated → file appended; missing daily note handled gracefully | ~15 |
| 7 | `tests/flows/13-DailySessionLifecycle.test.ts` | Full lifecycle: vault open → daily auto-start → concurrent focused session → activity tracked in both → focused complete → vault close → daily summary appended to note → verify all events | ~150 |

**Est. total:** ~107 LOC source + ~150 LOC flow test, ~35 tests (including flow)

**Acceptance criteria:**
- [ ] `generateDailySummary()` renders activity as grouped markdown (file name → actions)
- [ ] Daily session stop triggers summary generation
- [ ] Summary appended to daily note file (if configured and file exists)
- [ ] Missing daily note handled gracefully (summary still generated, not written)
- [ ] Flow test covers: auto-start → concurrent tracking → focused session lifecycle → daily stop → summary generation
- [ ] All PBI-SW-007 acceptance criteria checked (except nudge-related ones, deferred)
- [ ] `npm run build` passes — all tests green

---

## Dependency Graph

```
Inc 1: Bug Fixes — exporter + infrastructure (independent, no session deps) ✓
  |
Inc 2: SessionWorkspaceView extraction + Activity aggregation (independent of Inc 1) ✓
  |
Inc 2b: DX Progress Tracking Bug Fixes (independent of Inc 1-2, no session deps)
  |
Inc 3: PBI-SW-007 Domain — types, daily-tracking, concurrent sessions (independent of Inc 1-2b)
  |
Inc 4: PBI-SW-007 UI — auto-start, settings, display (requires Inc 2 extraction + Inc 3 types)
  |
Inc 5: Daily note integration + flow test (requires Inc 3 + Inc 4)
```

**Note:** Inc 1 (bugs) is fully independent — exporter and infrastructure fixes don't touch session code. Inc 2 (extraction) and Inc 3 (domain) are technically independent of each other. Inc 2b (DX bugs) is independent of session code — only touches dataExchange domain + DX Hub UI. Inc 4 (UI) requires both Inc 2 (clean view) and Inc 3 (types). Inc 5 requires the full stack.

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

| Metric | Target |
|--------|--------|
| Tests added | ~285 new (~175 session + ~110 DX bugs) |
| Tests total | ~2,603+ |
| Test suites | ~97+ |
| LOC added (source) | ~725 new (~99 Inc 1 bugs + ~230 Inc 2b DX bugs + ~396 features) |
| LOC refactored | ~420 (extraction — subscriptions + helpers) |
| SessionWorkspaceView LOC | ≤ 450 (from 791, -341) |
| Bugs fixed | 7 (2 exporter + TD-62 + TD-64 + 3 DX progress) |
| PBIs closed | PBI-SW-007 (partial — nudges deferred) |
| New events | 5 (4 daily lifecycle + 1 summary) |
| Total session events | 65+ |
| Flow tests | 13 (new: DailySessionLifecycle) |

---

## Cycle Retrospective

### What Went Well
<!-- Filled post-delivery -->

### Deviations from Plan
- **Inc 1 Bug 1+2 (exporter):** Original plan had incremental fixes to `scanColumns()` and `executeExport()`. Mid-increment, the scope expanded to a full **ResolvedColumn unified descriptor** approach (approved plan) — added `ResolvedColumn` type, `scanResolvedColumns()`, unified column rendering across ExportService, PreviewPage, ConfigurePage, and ViewSelectPage. Better architecture than planned, but more LOC (~200 vs ~70 est).
- **Inc 2 SessionWorkspaceView:** Target was ≤ 450 LOC. Actual: 479 LOC — canvas/notes file creation sections stayed in view (30 LOC over, acceptable for orchestrator).

### Improvement Backlog (from this cycle)
<!-- Filled post-delivery -->
- [ ] PBI-SW-007 nudge system — deferred from this cycle

### Learnings
<!-- Filled post-delivery -->

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
  - Open DX bugs: 3 items → **planned in Inc 2b** (dashboard state, progress bar confusion, pipeline progress)
- Learnings (input): [[L-25 Overview placeholder bug]], [[L-28 Carry-forward escalation]]
- Learnings (output): <!-- filled post-delivery -->
- Previous Cycle: [[Cycle 3 - Session Output Artifacts and State Restoration]]
