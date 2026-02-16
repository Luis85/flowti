---
type: ProductBacklogItem
feature: "[[Hubs PRD]]"
stage: in-progress
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

- [x] New domain: `src/domain/session/` with types, events, SessionService — *Increment 1: 5 files, 19 events, 60 tests*
- [x] Session types: Event Storming, Service Design, Requirements Refinement, Backlog Structuring, Knowledge Cleanup — *SessionType union + SESSION_TYPE_LABELS*
- [x] Session lifecycle: Prepared → Active → Paused → Completed → Archived — *SessionService state machine (Scheduled removed as unnecessary)*
- [ ] `session_focus` layout with regions:
  - `header`: Session name, type badge, status, action buttons
  - `timer`: Pomodoro timer (25/50 min configurable) with start/pause/reset
  - `workspace`: Main working area (note editor or structured form)
  - `notes`: Side panel for session notes (persisted as markdown)
  - `artifacts`: List of files created/modified during session
- [x] SessionService:
  - CRUD via events: `session.create`, `session.start`, `session.pause`, `session.resume`, `session.complete`, `session.archive`, `session.delete`
  - Persistence via shared storage key `sessions` (TypedStorage)
  - Artifact tracking via `file.created`/`file.modified` listeners during active session
- [x] Timer events: `session.timer.tick` (every second), `session.timer.completed` (on expiry) — *1s setInterval, Date math for surviving window minimize*
- [ ] Session artifacts persist as markdown files in configurable folder — *currently tracked in-memory, not as separate files*

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

- [x] Can create and start a Documentation Session — *SessionService.createSession() via event bus*
- [x] Pomodoro timer counts down and emits events — *session.timer.tick every 1s, session.timer.completed on expiry*
- [x] Files created during session are tracked as artifacts — *file.created/file.modified → session.artifact.added*
- [x] Session history shows completed sessions with artifact count — *UserHubSessions master list + detail panel*
- [ ] `session_focus` layout renders all 5 regions — *remaining work*
- [x] Session lifecycle events emitted on EventBus — *19 events registered in catalog*
- [x] `npm run build` passes — *1,938 tests across 82 suites*
- [x] Unit tests for SessionService lifecycle, timer, templates, and rerun — *90 tests in SessionService.test.ts*
- [x] Rerun completed/archived sessions without re-entering configuration — *Increment 3: rerunSession() + auto-select*
- [x] Save sessions as reusable templates — *Increment 3: SaveTemplateModal + template CRUD + template list in detail panel*
- [x] Dashboard session callout with live timer and contextual actions — *Increment 3: updateTimerDisplay() + Pause/Resume*

## Implementation Progress

### Increment 1: Session Domain Core (2026-02-16)

New files:
- `src/domain/session/types.ts` — Session, SessionType, SessionStatus, SessionArtifact types
- `src/domain/session/events.ts` — SessionEventMap (19 events: 8 commands + 11 facts)
- `src/domain/session/SessionService.ts` — Full lifecycle service with timer, artifact tracking, persistence
- `src/domain/session/helpers.ts` — Pure helpers (computeRemainingMs, computeElapsedMs, formatDuration, isTimerExpired, createSession)
- `tests/domain/session/SessionService.test.ts` — 60 tests covering lifecycle, timer, artifacts, persistence, edge cases

### Increment 2: Sessions Tab in User Hub (2026-02-16)

New files:
- `src/ui/userHub/UserHubSessions.ts` — Sessions tab component (~316 LOC): master list + detail panel + "New" buttons
- `tests/ui/userHub/UserHubSessions.test.ts` — 35 tests for master list, detail panel, actions, timer display, new session buttons

Modified files:
- `src/ui/userHub/types.ts` — Added `"sessions"` tab, session state fields, SessionService in deps, label maps, `openNewSessionModal()` callback
- `src/ui/UserHubView.ts` (~273 LOC) — SessionService param, sessions tab def, 9 event listeners, refreshSessionState(), timer tick optimization, `openNewSessionModal()` dep wiring via `NewSessionModal`
- `src/ui/modals.ts` — New `NewSessionModal` class (~70 LOC): title text input, type dropdown (from `SESSION_TYPES`), duration dropdown (25/50/15/45/60 min), Cancel/Create buttons
- `src/ui/userHub/UserHubDashboard.ts` — Active session card, "Sessions" quick action
- `src/main.ts` — Pass sessionService to UserHubView
- 3 test files updated with session state/deps + `openNewSessionModal: vi.fn()`

### Increment 3: Session Templates, Rerun & UX Polish (2026-02-16)

Modified files:
- `src/domain/session/types.ts` — `SessionTemplate` interface, `MAX_TEMPLATES = 50`, `SessionState.savedTemplates?` (optional for backward compat)
- `src/domain/session/events.ts` — `savedTemplates: SessionTemplate[]` added to `session.loaded` payload
- `src/domain/session/SessionService.ts` — 7 new methods: `getSavedTemplates()`, `getTemplate()`, `saveTemplate()`, `updateTemplate()`, `deleteTemplate()`, `saveTemplateFromSession()`, `rerunSession()`, `createFromTemplate()` + `generateRerunTitle()` helper + backward compat migration in `load()`
- `src/ui/modals.ts` — New `SaveTemplateModal` class + extended `NewSessionModal` with template chooser dropdown + prefill
- `src/ui/userHub/types.ts` — `openSaveTemplateModal` callback added to `UserHubComponentDeps`
- `src/ui/userHub/UserHubSessions.ts` — Rerun/Save Template buttons on completed/archived, template list in empty detail panel, actions moved under header, Start hidden when active session exists, margin-bottom on list rows
- `src/ui/UserHubView.ts` — Wired `openSaveTemplateModal`, pass templates to NewSessionModal, dashboard timer tick
- `src/ui/userHub/UserHubDashboard.ts` — `updateTimerDisplay()` for live timer, contextual Pause/Resume buttons, Paused badge, muted border for paused sessions
- `tests/domain/session/SessionService.test.ts` — +30 tests (template CRUD, rerun, createFromTemplate, backward compat, generateRerunTitle)
- `tests/ui/userHub/UserHubSessions.test.ts` — +12 tests (rerun/save template, template list, Start hidden when active, margin-bottom)
- `tests/ui/userHub/UserHubDashboard.test.ts` — +5 tests (paused Resume, resume event, Paused badge, updateTimerDisplay, no-op timer)
- 2 test files updated with `openSaveTemplateModal: vi.fn()`
