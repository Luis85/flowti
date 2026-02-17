---
type: Increment
feature: "[[Hubs PRD]]"
pbi: "[[PBI-002 Documentation Sessions]]"
phase: 4
increment: 9
stage: in-review
date: 2026-02-17
tasm_score:
tasm_review: "[[Three Amigos Review - Sidebar Workspace and Activity Consolidation 2026-02-17]]"
tests_added: 39
tests_total: 2164
test_suites: 84
loc_added: 250
cross_pbi:
  - "[[PBI-SW-001 Activity Log]]"
  - "[[PBI-SW-002 Context Bindings]]"
---

# Phase 4, Increment 9: Sidebar Workspace & Activity Consolidation

## Context

Increment 8 delivered a rich SessionWorkspaceView (737 LOC) with 7 capabilities. Real-world usage immediately revealed workflow friction: users wanted the workspace available in the sidebar for persistent visibility, artifacts and activity were redundant parallel sections, context folder bindings opened as notes instead of revealing in the file explorer, and case-insensitive file systems caused session note collisions.

This increment addresses those issues while also delivering early pieces of PBI-SW-001 (activity log) and PBI-SW-002 (context bindings), bringing the workspace to 987 LOC (triggering the component extraction threshold noted in the Inc 8 review).

User story: [[I want to prepare a working session, so that I can focus on one task at a time]]

## Scope

Fifteen capabilities delivered:

1. **Sidebar Workspace** — `location?: "tab" | "sidebar"` parameter on `openSessionWorkspace`, sidebar opens via `getRightLeaf(false)`, singleton pattern using `getLeavesOfType().find(l => l.getRoot() === workspace.rightSplit)` + `revealLeaf()`
2. **Sidebar UI Buttons** — "Sidebar" button (`panel-right` icon) in UserHubSessions for prepared/active/paused sessions, and in SessionWorkspaceView actions (hidden when already in sidebar)
3. **Sidebar Command** — `flowti:open-session-workspace-sidebar` command registered in main.ts
4. **Click Lag Fix** — `setTimeout(0)` deferral on all sidebar-opening paths to prevent UI jank from synchronous DOM operations blocking cursor state
5. **Activity Consolidation** — Removed separate artifacts section entirely; artifacts are a subset of activity (created/modified vs created/modified/opened/deleted/renamed). Single unified activity log with folder filtering serves both purposes. **Supersedes ADR-025.**
6. **File Collision Fix** — Session notes and canvas files now include a 6-char ID suffix: `Title (abc123).md` to prevent case-insensitive filesystem collisions
7. **File-Already-Exists Guard** — `try-catch` around all `vault.create()` calls in `openOrCreateNotesFile()`, `createAndLinkCanvas()`, and `appendCanvasLinkToNotes()` to handle stale Obsidian file cache
8. **Folder Context Reveal** — Clicking a folder-type context binding now calls `revealInFileExplorer()` (file-explorer `revealInFolder()` API) instead of `openLinkText()` which was creating same-named notes
9. **Start-from-Sidebar Guard** — `session.started` handler in main.ts skips opening a new tab when a workspace leaf already exists (e.g. sidebar)
10. **CSS Section Standardization** — `.ft-section` and `.ft-section-flush` CSS classes replace inline `padding:12px 16px;border-bottom:...` on all workspace sections. Dashboard padding updated from `1.5rem 0` to `1.5rem 16px`.
11. **Sidebar Session Switching** — `setState()`/`getState()` on SessionWorkspaceView enables switching sessions on an existing sidebar leaf without destroying and recreating the view. All `setViewState()` callers pass `state: { sessionId }`.
12. **Start Button Guard** — "Start" button hidden when another session is already active. Lifecycle events from other sessions trigger `renderActions()` refresh so the button appears/disappears in real time across multiple open workspaces.
13. **Start Denied Feedback** — If another session becomes active between render and click (race condition), clicking "Start" shows a Notice: "Another session is already active. Complete or pause it first."
14. **Folder Context Menu** — `registerSessionFileMenu()` now handles both `TFile` and `TFolder`. Right-clicking a folder in the navigator shows "Add to {session}" which binds it as a `folder` type with trailing `/`. "Create New Session" only appears for files.
15. **Open in Tab from Sidebar** — When the workspace is in the sidebar, the "Sidebar" button is replaced with an "Open in Tab" button (`layout` icon) via `openInTab()` which opens the session in a new tab leaf.

## Data Model Changes

```typescript
// Session notes file path now includes short ID suffix:
// Before: "03 - Resources/Sessions/Sprint Planning.md"
// After:  "03 - Resources/Sessions/Sprint Planning (a1b2c3).md"
const shortId = id.slice(-6);
session.notesFile = `${SESSION_NOTES_FOLDER}/${safeName} (${shortId}).md`;

// Canvas file path also includes short ID:
const path = `${folder}/${safeName} (${shortId}).canvas`;
```

## Events (0 new, 1 behavior change)

No new events introduced. Existing `session.artifact.added` listener redirected from deleted `renderArtifactsList()` to `renderActivityList()`.

## Changes

### Modified Files (Source: 6 files)

- `src/ui/SessionWorkspaceView.ts` — Removed `artifactsEl`, `renderArtifacts()`, `renderArtifactsList()`; added `openInSidebar()`, `openInTab()`, `revealInFileExplorer()`, `setState()`/`getState()`; folder-type context binding handler; sidebar/tab toggle buttons in actions; try-catch on vault.create; short ID suffix on canvas path; `.ft-section` on all sections; Start button guard (`!getActiveSession()`); cross-view action sync via lifecycle event handlers; Notice on start-denied race condition (+280 LOC net, 737 → ~1017 LOC)
- `src/ui/UserHubView.ts` — Updated both `openSessionWorkspace` implementations with location parameter, singleton sidebar pattern, `setTimeout(0)` deferral, `state: { sessionId }` in `setViewState()` (+25 LOC)
- `src/ui/userHub/UserHubSessions.ts` — "Sidebar" button for prepared/active/paused sessions (+12 LOC)
- `src/ui/userHub/types.ts` — Updated `openSessionWorkspace` signature: `(sessionId?: string, location?: "tab" | "sidebar") => void` (+1 LOC)
- `src/main.ts` — `openSessionWorkspaceInSidebar()` method, `flowti:open-session-workspace-sidebar` command, start-from-sidebar guard in `session.started` handler, `registerSessionFileMenu()` extended with TFolder support (+40 LOC)
- `src/domain/session/SessionService.ts` — Short ID suffix on notes file path (+2 LOC)
- `styles.css` — `.ft-section`, `.ft-section-flush`, `:last-child` rule, dashboard padding fix (+12 LOC)

### Modified Files (Tests: 2 files)

- `tests/ui/SessionWorkspaceView.test.ts` — Mock leaf `getRoot()`, mock workspace `rightSplit`/`getLeavesOfType`/`getRightLeaf`/`revealLeaf`; replaced artifacts describe with merged-activity tests; removed clickable artifacts tests; `getActiveSession` mock now returns `null` for non-active sessions
- `tests/domain/session/SessionService.test.ts` — Notes file path assertions changed from `toBe` to `toMatch` regex for short ID suffix

## Tests

**SessionWorkspaceView.test.ts**: Updated artifacts section tests (3 removed, 2 added for merge verification), added sidebar mock infrastructure
**SessionService.test.ts**: 2 assertions updated for regex matching

Final: 84 test files, 2,164 tests passing, 32 skipped

## Acceptance Criteria

- [x] Workspace opens in right sidebar via `getRightLeaf(false)`
- [x] Only one workspace instance exists in sidebar (singleton pattern)
- [x] Sidebar reveals if collapsed (`revealLeaf`)
- [x] "Sidebar" button visible in UserHubSessions and SessionWorkspaceView (hidden when already in sidebar)
- [x] No cursor lag when clicking sidebar button (`setTimeout(0)` deferral)
- [x] Artifacts section removed — activity log is the single unified log
- [x] Activity log filters apply to all tracked events (created/modified/opened/deleted/renamed)
- [x] Session notes include short ID suffix to avoid case-insensitive collisions
- [x] Canvas files include short ID suffix
- [x] `vault.create()` failures handled gracefully (file-already-exists)
- [x] Folder context bindings reveal in file explorer, not create notes
- [x] Starting a session from sidebar doesn't open duplicate workspace tab
- [x] All workspace sections use `.ft-section` CSS class
- [x] Clicking "Sidebar" on a different session switches the sidebar view (no new leaf)
- [x] Start button hidden when another session is active
- [x] Lifecycle events from other sessions refresh the action bar in all open workspaces
- [x] Notice shown if Start is clicked when another session became active (race condition)
- [x] Right-clicking a folder in file explorer shows "Add to {session}" when a session is current
- [x] Right-clicking a file in file explorer shows both "Add to {session}" and "Create New Session"
- [x] "Open in Tab" button visible in sidebar workspace, opens session in a new tab
- [x] `npm run build` passes — 2,164 tests across 84 suites

## Verification

1. `npm run build` passes (all tests green)
2. Click "Sidebar" on a session in User Hub → workspace opens in right sidebar
3. Click "Sidebar" again → same leaf reused (no duplicate)
4. Collapsed sidebar → clicking "Sidebar" opens and reveals it
5. Click "Sidebar" in workspace view → workspace appears in sidebar, no lag
6. No "Artifacts" section visible — only unified "Activity" log with filters
7. Create sessions "test" and "Test" → different notes file paths (short ID suffix)
8. Click session notes link when file exists → opens file (no error)
9. Add folder context binding → click it → file explorer reveals the folder
10. Start session from sidebar → no new tab opens
11. All workspace sections have consistent 12px 16px padding
12. Session A open in sidebar → click "Sidebar" on session B in User Hub → sidebar shows session B (no new leaf)
13. Session A active, session B prepared in sidebar → Start button not visible on session B
14. Session A completes → Start button appears on session B workspace without manual refresh
15. Right-click folder in file explorer with session open in sidebar → "Add to {session title}" appears
16. Right-click file in file explorer with session open in sidebar → both "Add to {session}" and "Create New Session" appear
17. Sidebar workspace → click "Open in Tab" → session opens in main tab area

## Related

- PRD: [[Hubs PRD]], [[Session Workspaces PRD]]
- PBI: [[PBI-002 Documentation Sessions]], [[PBI-SW-001 Activity Log]], [[PBI-SW-002 Context Bindings]]
- ADR: [[ADR-025 Activity Log Separate from Artifacts]] (superseded by activity consolidation)
- Previous: [[Phase 4 Inc 8 - Session Workspace Enrichment]]
- Review: [[Three Amigos Review - Sidebar Workspace and Activity Consolidation 2026-02-17]]
