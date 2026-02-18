---
type: DecisionNote
adr: ADR-025
title: Activity Log Separate from Artifacts
status: Superseded
date: 2026-02-17
superseded_by: "[[Phase 4 Inc 9 - Sidebar Workspace and Activity Consolidation]]"
domain: session
category: Data Model
drivers:
  - Separation of Concerns
  - Signal vs. Noise
  - Backward Compatibility
tags:
  - decision
  - data-model
  - session
  - activity
---

# ADR-025: Activity Log Separate from Artifacts

## Status

**Superseded** — by Inc 9 (Sidebar Workspace & Activity Consolidation), 2026-02-17.

### Supersession Rationale

Real-world usage during Inc 8 and Inc 9 revealed that the separate-arrays model (Option 3) created **redundant UI sections** rather than the anticipated clean separation:

1. **Artifacts were a strict subset of activity.** Every artifact (created/modified) also appeared in the activity log. The "curated outputs" value proposition did not materialize — users looked at activity, not artifacts, to understand what happened during a session.

2. **Two sections showing overlapping data confused users.** The workspace had both an "Artifacts" section and an "Activity" section, with file-created and file-modified entries appearing in both. Users questioned why the same file appeared twice.

3. **Activity filtering made artifacts redundant.** Per-session folder filtering on the activity log already scoped results to the working area, achieving the "signal vs. noise" goal that artifacts were meant to address.

**Resolution:** Inc 9 removed the artifacts section entirely. The unified activity log (with folder filtering) serves both purposes — tracking session outputs and session process. `session.artifact.added` events still fire and redirect to `renderActivityList()`. The `SessionArtifact` type and `session.artifacts` array remain on the Session interface for backward compatibility and summary generation (`generateSessionSummary()` still uses artifacts for the "Session Outputs" section of notes files).

## Context

The existing Session domain tracks **artifacts** — files created or modified during an active session — via `SessionArtifact[]` on the `Session` interface. Artifacts are recorded automatically when `file.created` or `file.modified` events fire during an active session, with deduplication within a 1-second window.

PBI-SW-001 (Activity Log & Folder Filtering) introduces a comprehensive **activity log** that tracks all vault file events during a session: creates, modifications, deletes, renames, and (in future) opens. The activity log also supports folder filtering — global exclusions that apply to all sessions plus per-session exclusions that scope to a specific working area.

### The Question: Extend Artifacts or Introduce a Separate Activity Log?

Three approaches were considered:

1. **Extend `SessionArtifact`** — add "deleted", "renamed", "opened" to `SessionArtifact.action`, add `oldPath?` for renames, add filter logic to the existing `onFileEvent()` handler. Artifacts and activity are the same array.

2. **Replace `SessionArtifact` with `SessionActivity`** — deprecate the artifacts array in favor of a single activity log that covers all event types. Filters apply globally.

3. **Separate `SessionActivity` alongside `SessionArtifact`** — two parallel arrays on Session. Artifacts remain curated (created/modified), activity is comprehensive (all events). Filters apply only to activity, not artifacts.

## Decision

**Option 3: Separate `SessionActivity[]` alongside existing `SessionArtifact[]`.**

### Why Separate Over Extend or Replace

**Artifacts and activity serve different purposes:**

| Dimension | Artifacts | Activity |
|-----------|-----------|----------|
| **Purpose** | Track session outputs (what was produced) | Track session process (what happened) |
| **Semantics** | Curated — files the user intentionally worked on | Comprehensive — all vault changes during session |
| **Actions** | `"created" \| "modified"` | `"created" \| "modified" \| "deleted" \| "renamed" \| "opened"` |
| **Filtering** | No filtering — all created/modified files recorded | Global + per-session folder filtering |
| **Cap** | No explicit cap (bounded by session duration) | 1000 entries with oldest-first eviction |
| **Consumers** | Session summary, session detail panel, session notes file | Activity timeline panel, session review |
| **Lifecycle** | Retained on archive (part of session record) | Cleared on archive (operational data) |

**Extending artifacts would conflate signal with noise.** Artifacts are used in session summaries (`generateSessionSummary()`), the User Hub sessions detail panel, and session notes files. Adding deletes and renames to this array would pollute summaries with operational churn that users don't consider "session outputs."

**Replacing artifacts would break backward compatibility.** 148+ tests reference `session.artifacts` directly. 9 increments of the Hubs PRD built on the artifact model. The `session.artifact.added` event is consumed by multiple UI components. Replacing this would require a migration and coordinated refactoring with no functional benefit.

**Separation preserves both models.** Artifacts continue to track "what the session produced." Activity tracks "what happened in the vault." Each has its own semantics, cap, filter rules, and lifecycle. They can evolve independently.

### Integration Points

- `SessionService.onFileEvent()` continues to produce artifacts (created/modified) — unchanged
- A new `SessionService.onActivityEvent()` produces activity entries for all file events (created/modified/deleted/renamed), applying folder filters before recording
- Both methods listen to the same file events but serve different purposes
- The UI renders activity in a new timeline panel, while artifacts continue to render in the existing artifacts section

## Consequences

### Positive

- **Zero breaking changes** — `SessionArtifact`, `session.artifacts`, and `session.artifact.added` remain unchanged
- **148+ tests unaffected** — no test modifications needed for existing session functionality
- **Clean separation** — artifact semantics (outputs) vs. activity semantics (process) are explicit
- **Independent evolution** — activity filtering, caps, and lifecycle can change without impacting artifacts
- **Summary integrity** — `generateSessionSummary()` continues to use artifacts as curated session outputs

### Negative

- **Duplication** — file created/modified events are recorded in both arrays (once as artifact, once as activity unless filtered). This is intentional: artifacts are outputs, activity is process.
- **Storage overhead** — two arrays per session. Mitigated by the 1000-entry activity cap and activity clearing on archive.
- **Conceptual surface** — developers must understand both models. Documented in this ADR and the Session Workspaces PRD data model section.

### Neutral

- **LOC impact** — ~18 LOC for new types + ~65 LOC for activity tracking logic in SessionService. No changes to existing artifact code.
- **Event model** — 2 new events (`session.activity.tracked`, `session.activity.filter.updated`) alongside the existing `session.artifact.added`. No naming conflicts.

## Files

| File | Change |
|------|--------|
| `src/domain/session/types.ts` | NEW types: `SessionActivity`, `SessionActivityAction`, `MAX_SESSION_ACTIVITY`, `ACTIVITY_DEDUP_WINDOW_MS`; MODIFIED: `Session` gains `activity` + `activityFilter` fields |
| `src/domain/session/events.ts` | MODIFIED: 2 new events added |
| `src/domain/session/SessionService.ts` | MODIFIED: new `onActivityEvent()` method, parallel to existing `onFileEvent()` |

## Related

- PRD: [[Session Workspaces PRD]] (Section 8: Data Model Extensions)
- PBI: [[PBI-SW-001 Activity Log]]
- Increment: [[Phase 4 Inc 9 - Sidebar Workspace and Activity Consolidation]] (activity delivered + ADR superseded)
- Existing: ADR-004 (Single JSON Blob Storage — activity stored alongside artifacts in TypedStorage)
- Superseded by: Inc 9 unified activity log — artifacts section removed, single activity log with folder filtering
