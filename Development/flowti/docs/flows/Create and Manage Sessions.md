---
type: Flow
domain: Flowti
stage: done
description: End-to-end journey from creating a session through active work with goals, decisions, activity tracking, context bindings, completion with summary generation, state restoration, and output artifact generation
domains:
  - Session
services:
  - SessionService
events:
  - session.create
  - session.created
  - session.start
  - session.started
  - session.pause
  - session.paused
  - session.resume
  - session.resumed
  - session.complete
  - session.completed
  - session.archive
  - session.archived
  - session.delete
  - session.deleted
  - session.activity.tracked
  - session.goal.add
  - session.goal.added
  - session.goal.toggle
  - session.goal.toggled
  - session.goal.remove
  - session.goal.removed
  - session.context.bind
  - session.context.bound
  - session.duration.update
  - session.duration.updated
  - session.decision.record
  - session.decision.recorded
  - session.decision.remove
  - session.decision.removed
  - session.state.save
  - session.state.saved
  - session.state.restore
  - session.state.restored
  - session.output.generate
  - session.output.generated
tags:
  - session
---

# Create and Manage Sessions

## Overview

The session lifecycle covers the full journey from creating a focused work session through active tracking to completion, output generation, and archival. Users create sessions with a type (8 built-in + custom), title, and optional duration, then work within the session while the system tracks vault activity (file creates, edits, deletes, renames). Sessions support goals, decisions, context bindings (folder/file associations), notes, linked files, and artifacts. On pause or completion, workspace state (open files, active file) is automatically saved and restored on resume. On completion, a summary is generated. Users can then generate structured output artifacts (meeting invites, action items, review summaries) from completed sessions using built-in or custom templates.

## Trigger

User clicks "New Session" in the Session Workspace view, or runs the `flowti:create-session` command. Alternatively, users can create a session from a saved template via "Use Template" in the workspace.

## Steps

### 1. Create Session

- **View/Service**: SessionWorkspaceView → SessionService
- **User Action**: User clicks "New Session", enters a title, selects a session type (8 built-in types with guiding questions, or a custom type), and sets an optional duration
- **System Response**: SessionService creates a new Session object with status `"prepared"`, generates a unique ID, initializes empty goals/links/activity/decisions arrays, and persists to storage. The selected session type's guiding questions are loaded for display. The workspace re-renders to show the new session in the session list
- **Events**: `session.create` → `session.created`

### 2. Configure Session (Optional)

- **View/Service**: SessionWorkspaceView (detail panel)
- **User Action**: User adds goals, sets duration, links files, or binds context folders/files before starting
- **System Response**: Each configuration action fires its own command/state event pair. Goals are added via `session.goal.add` → `session.goal.added`. Context bindings associate folders or files with the session via `session.context.bind` → `session.context.bound`. Duration updates via `session.duration.update` → `session.duration.updated`. Notes file and canvas file can be set via their respective commands
- **Events**: `session.goal.add` → `session.goal.added`, `session.context.bind` → `session.context.bound`, `session.duration.update` → `session.duration.updated`

### 3. Start Session

- **View/Service**: SessionWorkspaceView → SessionService
- **User Action**: User clicks "Start" on a prepared session
- **System Response**: SessionService transitions the session to `"active"` status, records `startedAt` timestamp in the timeline, starts the countdown timer (if duration > 0), and begins tracking vault activity. The workspace switches to the active session detail view showing timer, guiding questions, goals, and activity log
- **Events**: `session.start` → `session.started`

### 4. Track Activity

- **View/Service**: EventBridge → SessionService (automatic)
- **User Action**: User works normally in the vault — creating, editing, renaming, and deleting files
- **System Response**: EventBridge emits vault file events. SessionService intercepts these and records `SessionActivity` entries in the active session's activity log. Activities are deduplicated within a time window to avoid noise. The per-session folder filter (if configured) excludes events from folders the user doesn't want tracked. The activity log renders in real-time in the workspace detail panel
- **Events**: `session.activity.tracked` (per tracked file event)

### 5. Manage Goals During Session

- **View/Service**: SessionWorkspaceView (goals panel)
- **User Action**: User adds new goals, toggles goals as completed, or removes goals during the session
- **System Response**: Goal mutations fire command/state event pairs. The goals panel re-renders to show completion state. Goal progress contributes to the session summary on completion
- **Events**: `session.goal.add` → `session.goal.added`, `session.goal.toggle` → `session.goal.toggled`, `session.goal.remove` → `session.goal.removed`

### 6. Record Decisions During Session

- **View/Service**: SessionWorkspaceView (decision panel) → SessionService
- **User Action**: User clicks "Record Decision", enters a title and optional description
- **System Response**: SessionService records the decision with a unique ID and timestamp, appends it to the session's `decisions` array (max 100), and persists. The `SessionDecisionPanel` re-renders to show the new decision. Decisions can be removed via the panel. Decisions are included in the session summary and available as `{{decisions}}` placeholder in output templates
- **Events**: `session.decision.record` → `session.decision.recorded`, `session.decision.remove` → `session.decision.removed`

### 7. Pause and Resume (with State Restoration)

- **View/Service**: SessionWorkspaceView → SessionService
- **User Action**: User clicks "Pause" to temporarily stop the timer, then "Resume" to continue
- **System Response**:
  - **On Pause**: SessionService transitions to `"paused"` status, stops the timer, records the pause timestamp, and emits `session.state.save`. The View captures the current workspace state (open files, active file) via `app.workspace` and emits `session.state.saved`. SessionService persists the `WorkspaceState` on the session entity
  - **On Resume**: SessionService transitions back to `"active"`, emits `session.state.restore` with the saved state. The View opens the saved files and activates the previously active file. Missing files are skipped gracefully. Timer restarts from remaining duration, activity tracking resumes
  - Multiple pause/resume cycles are supported, each overwriting the previous workspace state
- **Events**:
  - Pause: `session.pause` → `session.paused` → `session.state.save` → `session.state.saved`
  - Resume: `session.resume` → `session.resumed` → `session.state.restore` → `session.state.restored`

### 8. Complete Session

- **View/Service**: SessionWorkspaceView → SessionService (manual or timer-triggered)
- **User Action**: User clicks "Complete", or the timer reaches zero (`session.timer.completed` auto-triggers completion)
- **System Response**: SessionService transitions to `"completed"` status, records `completedAt` timestamp, stops the timer, saves workspace state (same as pause), and generates a session summary. The summary includes: session metadata, goal completion status, decisions, activity count, linked files, context bindings, and inline notes. The summary is written to a markdown file in `SESSION_NOTES_FOLDER` via `FileSystemClient.createFile()`. The workspace re-renders to show the completed session with summary and the Output Artifacts panel
- **Events**: `session.complete` → `session.completed` → `session.state.save` → `session.state.saved`

### 9. Generate Output Artifacts (Completed Sessions Only)

- **View/Service**: SessionWorkspaceView (output panel) → SessionOutputPickerModal → SessionService
- **User Action**: User clicks "Generate Output" on a completed or archived session. A picker modal shows 3 built-in template cards (Meeting Invite, Action Items, Review Summary) plus any custom templates configured in settings
- **System Response**: User selects a template. The system emits `session.output.generate` with the session ID and selected template. SessionService validates the session is completed/archived, generates markdown content using `generateSessionOutput()` (pure function with 10 mustache placeholders), creates a file in `SESSION_NOTES_FOLDER`, appends a wikilink to the session notes file (if it exists), and persists the `SessionOutputArtifact` on the session entity (max 20 per session). The `SessionOutputPanel` refreshes to show the new artifact as a clickable link
- **Events**: `session.output.generate` → `session.output.generated`

### 10. Archive Session (Optional)

- **View/Service**: SessionWorkspaceView → SessionService
- **User Action**: User clicks "Archive" on a completed session to move it out of the active list
- **System Response**: SessionService transitions to `"archived"` status. The session moves from the active/completed list to the archive. Archived sessions remain accessible and can still generate output artifacts
- **Events**: `session.archive` → `session.archived`

### 11. Create from Template (Alternative Start)

- **View/Service**: SessionWorkspaceView → SessionService
- **User Action**: User clicks "Use Template" and selects a saved template
- **System Response**: SessionService creates a new session pre-populated with the template's type, title prefix, duration, goals, and decisions. The user can customize before starting. Templates can also be saved from completed sessions for reuse
- **Events**: `session.create` → `session.created` (same as step 1, with template data pre-filled)

### 12. Delete Session

- **View/Service**: SessionWorkspaceView → SessionService
- **User Action**: User clicks "Delete" on any session (with confirmation)
- **System Response**: SessionService removes the session from state and persists. If the session had a notes file, the file remains in the vault (not auto-deleted). The workspace re-renders
- **Events**: `session.delete` → `session.deleted`

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Session type | vault-hygiene, event-storming, service-design, requirements-refinement, backlog-structuring, knowledge-cleanup, documentation, review, or custom | vault-hygiene |
| Duration | 0 (no timer) / 15 / 30 / 45 / 60 / custom minutes | 30 |
| Activity tracking | All folders / filtered folders (per-session filter) | All folders |
| Completion trigger | Manual "Complete" / Timer auto-complete | Timer auto-complete |
| Notes file | Create new / Link existing / None | None |
| Template usage | Start fresh / Use saved template | Start fresh |
| Output type | Meeting Invite / Action Items / Review Summary / Custom template | — (user selects) |

## Events Sequence

```
[New Session] → session.create → session.created
    → [Configure goals/bindings/decisions]
        → session.goal.add → session.goal.added
        → session.context.bind → session.context.bound
    → [Start] → session.start → session.started
        → [Work in vault] → session.activity.tracked (repeated)
        → [Toggle goals] → session.goal.toggle → session.goal.toggled
        → [Record decisions] → session.decision.record → session.decision.recorded
        → [Pause] → session.pause → session.paused
            → session.state.save → session.state.saved
        → [Resume] → session.resume → session.resumed
            → session.state.restore → session.state.restored
    → [Complete] → session.complete → session.completed
        → session.state.save → session.state.saved
    → [Generate Output] → session.output.generate → session.output.generated (repeatable)
    → [Archive] → session.archive → session.archived
```

## Related Decisions

- [[ADR-025 Activity Log Separate from Artifacts]] — activity tracking design
- [[ADR-026 Composable Folder Filtering]] — per-session folder filter
- [[ADR-029 ISO Date Prefix for Session Files]] — session notes file naming

## Known Debt

- TD-93: Duplicate data between plugin state and Obsidian metadata (session notes exist in both)
- SessionWorkspaceView at 791 LOC exceeds 780 threshold — extraction TD pending

## Learnings

- [[L-20 Pure functions for filtering compose cleanly]] — folder filtering in activity tracking
- [[L-22 Every major event domain needs a flow doc]] — motivation for creating this doc
- [[L-25 Overview placeholder bug]] — `computeActiveTimeMs` vs `computeElapsedMs` in output templates
- [[L-28 Carry-forward escalation]] — this doc was originally a carry-forward item that slipped 3 cycles

## Session v2 Flows

This flow documents the v1 session lifecycle. Session v2 extends this with intent-driven execution, structured reflection, closure rituals, energy tracking, and dual-mode rendering. See:

- [[Run Intentional Session]] — v2 flow: intent → execution → closure ritual → follow-up
- [[Monitor Session from Sidebar]] — v2 sidebar companion flow: monitoring control surface

## Related Use Cases

- [[Browse and Configure Events]] (session events appear in the catalog)
- [[Manage Inbox Notifications]] (session completion can trigger inbox items)
- [[Session Workspaces PRD]] (feature PRD governing this flow)
