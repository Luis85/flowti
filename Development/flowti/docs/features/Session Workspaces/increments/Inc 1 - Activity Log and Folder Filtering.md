---
type: Increment
feature: "[[Session Workspaces PRD]]"
pbi: "[[PBI-SW-001 Activity Log]]"
phase: 7
increment: 1
stage: done
date: 2026-02-17
tasm_score: 32
tasm_review: "[[Three Amigos Review - Sidebar Workspace and Activity Consolidation 2026-02-17]]"
tests_added: 57
tests_total: 2177
test_suites: 84
loc_added: 310
note: "Delivered early via PBI-002 Inc 10 cross-PBI delivery (Sidebar Workspace & Activity Consolidation). Not run as a standalone increment — all scope was consolidated into Inc 10."
---

# Increment 1: Activity Log & Folder Filtering

## Context

The Session Workspaces PRD is approved (FRI 29/35) and PBI-SW-001 is the first PBI to deliver. The existing session infrastructure tracks **artifacts** (files created/modified during a session) but has no concept of a comprehensive **activity log** with folder filtering. Users have no way to exclude system folders (.obsidian, templates, node_modules) from session activity, and different sessions working in different vault areas lack per-session filtering.

The foundation exists: `SessionService` already intercepts `file.created` and `file.modified` events for artifact tracking (lines 93-103, 630-648). Four file events are already emitted by `EventBridge`: `file.created`, `file.modified`, `file.deleted`, `file.renamed`. This increment extends that infrastructure into a full activity log with filtering.

User story: [[I want to filter folders to not appear in my sessions activity log]]

## Scope

This increment delivers end-to-end activity tracking with folder filtering:

1. **SessionActivity type** — new `SessionActivity` interface with 5 action types (created, modified, opened, deleted, renamed), separate from existing `SessionArtifact`. `activity: SessionActivity[]` and `activityFilter: string[]` added to `Session`.
2. **Folder filtering** — pure function `isExcluded(path, globalFilter, perSessionFilter)` for composable filter logic. Global filter persisted in `SettingsService`, per-session filter on `Session` object.
3. **Activity tracking in SessionService** — extend existing vault event listeners to also track `file.deleted` and `file.renamed`. Apply filter before recording. Cap at 1000 entries (oldest-first eviction). Clear on archive.
4. **Two new events** — `session.activity.tracked` (state) and `session.activity.filter.updated` (state) following existing command/state conventions.
5. **Activity timeline panel** — new section in `SessionWorkspaceView` showing chronological activity with timestamps, action badges, and file paths. Live-updated via `session.activity.tracked` subscription.
6. **Per-session filter UI** — text input in workspace to add/remove per-session folder exclusions.
7. **Global filter setting** — `sessionActivityFilterGlobal: string[]` in settings schema + UI in `FlowtiSettingTab`.

### Deliberately Excluded

- **`file.opened` event**: The PRD data model includes "opened" as an action type, but `EventBridge` does not currently emit a `file.opened` event. The type will support it for forward compatibility, but this increment only tracks 4 actions (created, modified, deleted, renamed). Adding `file.opened` to EventBridge is deferred — it touches infrastructure and is not required by the PBI acceptance criteria.
- **Split layout (goals + activity side by side)**: PRD UI concept shows a split layout. This increment renders activity as a full-width section below goals. Split layout is a future UI refinement.

## Data Model

```typescript
/** Actions tracked in the session activity log. */
type SessionActivityAction = "created" | "modified" | "opened" | "deleted" | "renamed";

/** A vault file event tracked during an active session. */
interface SessionActivity {
  timestamp: string;     // ISO 8601
  action: SessionActivityAction;
  path: string;
  oldPath?: string;      // for renames only
}

/** Maximum activity entries per session before oldest-first eviction. */
const MAX_SESSION_ACTIVITY = 1000;

/** Deduplication window for activity tracking (ms). */
const ACTIVITY_DEDUP_WINDOW_MS = 1000;

// ── Added to Session interface ──
// activity: SessionActivity[]
// activityFilter: string[]    // per-session excluded folder paths

// ── Added to Settings schema ──
// sessionActivityFilterGlobal: z.array(z.string()).default([])
```

## Events (2 new)

| Event | Payload | Direction |
|-------|---------|-----------|
| `session.activity.tracked` | `{ sessionId: string; activity: SessionActivity }` | State |
| `session.activity.filter.updated` | `{ sessionId: string; filter: string[] }` | State |

## Pure Functions

```typescript
/**
 * Check if a file path is excluded by global or per-session folder filters.
 * A path is excluded if it starts with any filter prefix.
 */
function isExcluded(path: string, globalFilter: string[], perSessionFilter: string[]): boolean
```

## Implementation Order

Following domain-first convention (Types → Events → Domain → Infrastructure → UI):

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/session/types.ts` | `SessionActivity`, `SessionActivityAction`, `MAX_SESSION_ACTIVITY`, `ACTIVITY_DEDUP_WINDOW_MS`, extend `Session` with `activity` + `activityFilter` | +18 |
| 2 | `src/domain/session/events.ts` | 2 new events: `session.activity.tracked`, `session.activity.filter.updated` | +8 |
| 3 | `src/domain/session/helpers.ts` | `isExcluded()` pure function | +12 |
| 4 | `src/domain/session/SessionService.ts` | Activity tracking: listen to `file.deleted`/`file.renamed`, new `onActivityEvent()` with filter + cap + dedup, `handleActivityFilterUpdate()`, clear activity on archive, backward compat for new fields | +65 |
| 5 | `src/domain/settings/settings.ts` | `sessionActivityFilterGlobal` schema field | +2 |
| 6 | `src/infrastructure/events/catalog.ts` | 2 new catalog entries for activity events | +3 |
| 7 | `src/ui/SessionWorkspaceView.ts` | Activity timeline panel, per-session filter input, `session.activity.tracked` subscription, live update via `renderActivityList()` | +95 |
| 8 | `src/ui/settings/FlowtiSettingTab.ts` | Global folder filter text setting in Session section | +15 |

**Estimated total**: ~218 LOC source

## Test Intent

| File | Tests | Purpose |
|------|-------|---------|
| `tests/domain/session/helpers.test.ts` | ~10 | `isExcluded`: exact match, prefix match, nested paths, empty filters, global-only, per-session-only, combined, case sensitivity |
| `tests/domain/session/SessionService.test.ts` | ~15 | Activity tracking: created/modified/deleted/renamed events tracked, filtered paths excluded, dedup within window, cap at 1000 with eviction, archive clears activity, backward compat defaults, filter update emits event, no tracking when no active session |
| `tests/ui/SessionWorkspaceView.test.ts` | ~8 | Activity panel renders, empty state, chronological order, live update on event, filter input interaction, action badges |

**Estimated total**: ~33 tests

## Documentation Intent

- Update PBI-SW-001 with file list and test counts
- Update Session Workspaces PRD: mark FR-01 partial checks, update lifecycle stage
- Add activity events to event catalog documentation if separate from code catalog
- No new component docs needed (activity panel is inline in workspace view)

## Acceptance Criteria

- [ ] `SessionActivity` type with timestamp, action (5 types), path, oldPath
- [ ] `isExcluded()` pure function filters paths against global + per-session folders
- [ ] Activity log tracks file creates, modifications, deletes, renames during active session
- [ ] Global folder filter configured in plugin settings excludes paths from all sessions
- [ ] Per-session folder filter configured in workspace excludes paths for that session
- [ ] Combined filter: global + per-session exclusions merged
- [ ] Activity capped at 1000 entries with oldest-first eviction
- [ ] Activity deduplicated within 1-second window (same path + action)
- [ ] Activity persisted with session state (survives pause/resume)
- [ ] Activity cleared when session is archived
- [ ] Activity timeline panel visible in SessionWorkspaceView during active/paused sessions
- [ ] Live update: new activity appears in timeline without manual refresh
- [ ] `session.activity.tracked` event emitted per tracked activity
- [ ] `session.activity.filter.updated` event emitted on filter change
- [ ] Backward compatibility: existing sessions without `activity`/`activityFilter` fields load cleanly
- [ ] `npm run build` passes — tests + tsc + eslint + esbuild

## Verification

1. `npm run build` passes (all tests green)
2. Start a session → create a file → activity log shows "created path/to/file"
3. Modify a file → activity log shows "modified path/to/file"
4. Delete a file → activity log shows "deleted path/to/file"
5. Rename a file → activity log shows "renamed old → new"
6. Add ".obsidian/" to global filter in settings → no activity from `.obsidian/` appears
7. Add "docs/" to per-session filter in workspace → no activity from `docs/` appears
8. Create 1001 file events → oldest entry evicted, count stays at 1000
9. Pause session → resume → activity log preserved
10. Archive session → activity cleared
11. Load a session created before this increment → no errors (backward compat)

## Related

- PRD: [[Session Workspaces PRD]] (FR-01: Activity Log)
- PBI: [[PBI-SW-001 Activity Log]]
- User story: [[I want to filter folders to not appear in my sessions activity log]]
- ADR-025: [[ADR-025 Activity Log Separate from Artifacts]]
- ADR-026: [[ADR-026 Composable Folder Filtering]]
