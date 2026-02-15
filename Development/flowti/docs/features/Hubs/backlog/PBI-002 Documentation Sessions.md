---
type: ProductBacklogItem
feature: "[[Hubs PRD]]"
priority: high
phase: 4
dependencies:
  - "[[TD-49 Layout abstraction layer]]"
---

## User Story - Problemspace

As a domain architect, I want time-boxed documentation sessions with a Pomodoro timer so that I can maintain documentation discipline through structured workflows like Event Storming and Service Design.

### User Pains

- Documentation is always "later" — no structure to enforce discipline
- Event Storming and Service Design sessions have no tooling support in Obsidian
- No way to track what was documented during a session or measure documentation velocity
- Sessions produce scattered notes with no connection to the domain model

### User Needs

- Time-boxed session with visible countdown timer
- Session types tailored to different documentation activities
- Workspace area for session work (note-taking, event listing, etc.)
- Artifact tracking — what files were created/modified during the session
- Session history per hub showing completed sessions and their outputs

## Solutionstatement

### Use Case

- Flow: User opens Domain Hub → clicks "Start Session" → selects type (Event Storming) → timer starts → user works in workspace → timer completes → artifacts saved
- Gherkin:
  ```gherkin
  Given a Documentation Session of type "Event Storming" is active
  When the user creates a note in the session workspace
  Then the note is tracked as a session artifact
  And when the timer completes
  Then the session status changes to "completed"
  And all artifacts are listed in the session summary
  ```

### Functional Requirements

- [ ] New domain: `src/domain/session/` with types, events, SessionService
- [ ] Session types: Event Storming, Service Design, Requirements Refinement, Backlog Structuring, Knowledge Cleanup
- [ ] Session lifecycle: Prepared → Scheduled → Active → Paused → Completed → Archived
- [ ] `session_focus` layout with regions:
  - `header`: Session name, type badge, status, action buttons
  - `timer`: Pomodoro timer (25/50 min configurable) with start/pause/reset
  - `workspace`: Main working area (note editor or structured form)
  - `notes`: Side panel for session notes (persisted as markdown)
  - `artifacts`: List of files created/modified during session
- [ ] SessionService:
  - CRUD via events: `session.create`, `session.start`, `session.pause`, `session.complete`
  - Persistence via shared storage key `sessions`
  - Artifact tracking via file system event listener during active session
- [ ] Timer events: `session.timer.tick` (every second), `session.completed` (on expiry)
- [ ] Session artifacts persist as markdown files in configurable folder

### Technical Requirements

- `SessionService` implements `IService` with `load()` + `dispose()` lifecycle
- Timer uses `setInterval()` with cleanup on dispose
- Artifact tracking: wildcard listener for `file.*` events during active session window
- Session data model stored in TypedStorage under key `sessions`
- `session_focus` layout registered in LayoutRegistry (TD-49)

### Constraints

- Timer must survive Obsidian window minimize (use Date math, not accumulated intervals)
- Session data must persist across plugin reloads
- Artifact tracking must not interfere with ingestion pipeline (separate concern)

## Acceptance Criteria

- [ ] Can create and start a Documentation Session from any Hub
- [ ] Pomodoro timer counts down and emits events
- [ ] Files created during session are tracked as artifacts
- [ ] Session history shows completed sessions with artifact count
- [ ] `session_focus` layout renders all 5 regions
- [ ] Session lifecycle events emitted on EventBus
- [ ] `npm run build` passes
- [ ] Unit tests for SessionService lifecycle and timer
