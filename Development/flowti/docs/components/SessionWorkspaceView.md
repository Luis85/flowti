---
type: Component
domain: Session
stage: development
description: "Dedicated focused workspace for a single documentation session with timer, goals, notes, context bindings, sidebar support, and unified activity log with folder filtering"
source: "[[Development/flowti/src/ui/SessionWorkspaceView.ts|SessionWorkspaceView.ts]]"
feature: "[[Session Workspaces PRD]]"
viewType: flowti-session-workspace
tags:
  - view
  - session
  - workspace
---

# SessionWorkspaceView

## Description

SessionWorkspaceView is a dedicated focused leaf for working within a single documentation session. It extends Obsidian's `ItemView` directly (not `BaseHubView`) because it renders a single-session workspace rather than a tabbed hub shell.

The view loads a specific session (by `workspaceSessionId` or falling back to active session) and renders a scrollable single-column layout. All sections update reactively via EventBus subscriptions. The view does not own state — it reads from `SessionService` and dispatches mutations via events.

The workspace can open as a **tab** (default) or in the **right sidebar** (singleton pattern). When opened in the sidebar, it reuses an existing leaf or creates one via `getRightLeaf(false)`, then calls `revealLeaf()` to ensure visibility.

## Sections (render order)

| Section | Condition | Description |
|---------|-----------|-------------|
| Header | Always | Title, type badge, status badge |
| Actions | Always | Contextual lifecycle buttons (Start — hidden when another session is active, Pause, Resume, Complete, Save Template, Sidebar / Open in Tab) |
| Timer | Always | Large monospace countdown (editable duration for prepared sessions) |
| Goals | Always | Checklist with add/toggle/remove + goal count badge |
| Notes | Always | Debounced textarea (500ms) |
| Focus File | When set | Clickable link to focused file |
| Notes File | When set | Clickable link to session notes file (create-or-open) |
| Canvas File | When set / Create button | Clickable link or "Create Session Canvas" button |
| Context Bindings | Always | Bound files/folders with type cycling, add/remove. Folders reveal in file explorer. |
| Activity | Always | Unified log of all vault activity with folder filtering, action badges, timestamps |

**Removed sections (Inc 10):** Links (merged into Context Bindings in Inc 8.5), Artifacts (merged into Activity — artifacts were a strict subset of activity actions).

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IEventBus` | interface | Event subscriptions + command dispatch |
| `SessionService` | service | Session state access (`getSessionById`, `getActiveSession`, `workspaceSessionId`) |
| `formatDuration`, `computeRemainingMs` | functions | Timer display formatting |
| `generateSessionSummary` | function | Notes file content generation |
| `SESSION_TYPE_LABELS`, `SESSION_STATUS_LABELS` | maps | Human-readable labels for badges |
| `SaveTemplateModal` | modal | Template creation UI |
| `attachFolderSuggest` | function | Folder autocomplete on filter input |

## Event Subscriptions (17)

| Event | Handler |
|-------|---------|
| `session.timer.tick` | Update timer display directly (no re-render) |
| `session.timer.completed` | Refresh session state + re-render |
| `session.duration.updated` | Refresh session + re-render |
| `session.started` | Own session: refresh + re-render. Other session: refresh actions (Start button visibility) |
| `session.paused` | Own session: refresh + re-render. Other session: refresh actions |
| `session.resumed` | Own session: refresh + re-render. Other session: refresh actions |
| `session.completed` | Own session: refresh + re-render. Other session: refresh actions (Start button may appear) |
| `session.goal.added` | Refresh goals section |
| `session.goal.toggled` | Refresh goals section |
| `session.goal.removed` | Refresh goals section |
| `session.notes.updated` | Update textarea (if not focused) |
| `session.artifact.added` | Refresh activity list |
| `session.notesFile.updated` | Re-render (section changes) |
| `session.canvasFile.updated` | Re-render (section changes) |
| `session.context.bound/unbound/typeChanged` | Re-render (context section changes) |
| `session.activity.tracked` | Refresh activity list |
| `session.activity.filter.updated` | Re-render (filter tags change) |
| `session.paths.updated` | Re-render when file/folder rename updates session paths (filtered by session ID) |
| `session.deleted` | Show empty state |

## Sidebar Support

- `openInSidebar()`: finds existing workspace leaf in `rightSplit` or creates via `getRightLeaf(false)`, deferred with `setTimeout(0)` to avoid click jank
- `openInTab()`: opens session in a new tab leaf via `getLeaf("tab")`
- In sidebar: "Sidebar" button replaced with "Open in Tab" (`layout` icon). In tab: "Sidebar" button shown (`panel-right` icon).
- Singleton pattern: only one workspace instance in the sidebar at a time
- **Session switching**: `setState(state)` / `getState()` enable switching sessions on an existing leaf. All `setViewState()` callers pass `state: { sessionId }` — when Obsidian finds an existing leaf of the same type, it calls `setState()` instead of `onOpen()`, and the view loads the new session and re-renders.

## File Collision Prevention

Session notes and canvas files include a 6-character ID suffix derived from the session UUID: `Title (abc123).md`. This prevents collisions on case-insensitive filesystems (e.g., "test" vs "Test").

## CSS Classes

| Class | Purpose |
|-------|---------|
| `ft-hide-header` | Applied to `containerEl` — hides Obsidian view header, adds 27px top padding |
| `ft-section` | Standard section padding (12px 16px) with bottom border |
| `ft-section-flush` | Edge-to-edge section (12px 0) with bottom border |
| `ft-session-workspace` | Container class for the workspace layout |
| `ft-session-workspace-*` | Prefix for all workspace-specific section classes |

## Technical Notes

- View type: `flowti-session-workspace`, icon: `timer`
- Session loading order: `workspaceSessionId` (explicit) → `getActiveSession()` (fallback)
- `workspaceSessionId` on SessionService tracks the target session across status changes
- Adjacent leaf tracked for file split view (notes, focus, context binding files)
- Folder context bindings use `revealInFileExplorer()` → file-explorer's `revealInFolder()` API
- `vault.create()` calls wrapped in try-catch for stale file cache scenarios
- All event subscriptions cleaned up in `onClose()` via `unsubscribes[]`
- Start button visibility: hidden when `sessionService.getActiveSession()` returns truthy. Click handler re-checks at click time and shows Notice if denied (race condition protection).
- Cross-view sync: lifecycle events from other sessions trigger `renderActions()` to update Start button visibility across all open workspace views.
- Context menu: `registerSessionFileMenu()` in main.ts handles both TFile and TFolder — right-clicking a folder shows "Add to {session}" when a session is current
- Source file: `src/ui/SessionWorkspaceView.ts` (~1017 LOC — above 900 LOC extraction threshold, component extraction recommended)
