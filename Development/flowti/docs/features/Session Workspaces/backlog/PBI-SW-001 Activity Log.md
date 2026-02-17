---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
priority: high
dependencies:
  - "[[PBI-002 Documentation Sessions]]"
note: "First PBI for Session Workspaces. Builds on PBI-002 foundation to add file activity tracking and folder filtering."
user_story: "[[I want to filter folders to not appear in my sessions activity log]]"
---

## User Story — Problem Space

As a session user, I want to see what vault activity happened during my session and filter out irrelevant folders so that I can focus on meaningful changes and review session outcomes.

### User Pains

- No visibility into what files were created, modified, or opened during a session
- Session artifacts list only tracks files added via "Add to Session" — not organic vault activity
- System folders (.obsidian, templates, node_modules) would pollute an activity log
- Different sessions work in different vault areas — global filtering alone isn't enough
- Post-session review has no activity timeline to reference

### User Needs

- Live activity log showing file creates, modifications, opens, deletes, renames during active sessions
- Global folder filter (settings) to exclude system paths from all sessions
- Per-session folder filter to scope activity to the session's working area
- Chronological timeline view in the workspace
- Activity persisted across pause/resume cycles

## Solution Statement

### Use Case

- Flow: Session starts → vault file events are intercepted → filtered against global + per-session rules → displayed as activity timeline in workspace → persisted with session state
- Gherkin:
  ```gherkin
  Given a session is active with global filter excluding ".obsidian/"
  And a per-session filter excluding "docs/"
  When the user creates a file at "src/domain/types.ts"
  Then the activity log shows "created src/domain/types.ts"
  And no activity from ".obsidian/" or "docs/" appears
  ```

### Functional Requirements

- [ ] `SessionActivity` type: `{ timestamp, action, path, oldPath? }`
- [ ] `SessionFolderFilter` type: `{ global: string[], perSession: string[] }`
- [ ] `session.activity.tracked` event emitted per tracked file event
- [ ] `session.activity.filter.updated` event for filter changes
- [ ] Global filter persisted in SettingsService (new setting: `sessionActivityFilterGlobal`)
- [ ] Per-session filter persisted on Session object
- [ ] Activity capped at 1000 entries per session (oldest evicted)
- [ ] Activity timeline panel in SessionWorkspaceView
- [ ] Filter configuration UI (settings + per-session in workspace)
- [ ] Activity cleared on session archive

### Technical Requirements

- Intercept `vault.on("create")`, `vault.on("modify")`, `vault.on("delete")`, `vault.on("rename")` in SessionService during active session
- Filter check: `isExcluded(path, globalFilter, perSessionFilter)` — pure function
- Debounce activity UI updates to 16ms (match existing `scheduleRender` pattern)
- Activity stored in-memory during session, flushed to TypedStorage on pause/complete
- Settings UI: folder picker or text input for global filter paths

### Events

| Event | Category | Tags |
|-------|----------|------|
| `session.activity.tracked` | Session | `[]` |
| `session.activity.filter.updated` | Session | `[]` |

### Acceptance Criteria

- [ ] Activity log shows file creates, modifications, deletes, renames during active session
- [ ] Global folder filter excludes configured paths from all sessions
- [ ] Per-session folder filter extends global filter for a specific session
- [ ] Activity survives pause/resume cycles
- [ ] Activity capped at 1000 entries with oldest eviction
- [ ] Activity cleared when session is archived
- [ ] Build passes: tests + tsc + eslint + esbuild
