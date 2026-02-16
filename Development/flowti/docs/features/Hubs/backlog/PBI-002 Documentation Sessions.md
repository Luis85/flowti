---
type: ProductBacklogItem
feature: "[[Hubs PRD]]"
stage: in-progress
priority: high
phase: 4
dependencies:
  - "[[TD-49 Layout abstraction layer]]"
note: "Core delivery complete (5 increments). Increments 6-8 planned: Goals, Workspace View, Preparation Flow. Increments 9-11 planned: Focus File Profiles & Context Files, Session Spawning & Guiding Questions, Session Document Generation."
user_story: "[[I want to prepare a working session, so that I can focus on one task at a time]]"
---

## User Story - Problemspace

As a domain architect, I want time-boxed documentation sessions with a Pomodoro timer so that I can maintain documentation discipline through structured workflows like Event Storming and Service Design.

As a vault user, I want sessions to provide contextual tools based on my focus file so that I can work efficiently on the specific type of content I'm improving, always oriented around "How should the next increment look like?" and "What can be improved?"

### User Pains

- Documentation is always "later" — no structure to enforce discipline
- Event Storming and Service Design sessions have no tooling support in Obsidian
- No way to track what was documented during a session or measure documentation velocity
- Sessions produce scattered notes with no connection to the domain model
- A focus file alone is not enough — the user needs related files at hand during focused work
- Different file types need different tools, but sessions treat all focus files the same
- Completed sessions leave no permanent record in the vault — insights are lost
- Non-Obsidian files (binaries, unknown extensions) cannot be properly documented or linked

### User Needs

- Time-boxed session with visible countdown timer
- Session types tailored to different documentation activities
- Workspace area for session work (note-taking, event listing, etc.)
- Artifact tracking — what files were created/modified during the session
- Session history per hub showing completed sessions and their outputs
- Contextual tools based on the focus file's type — leverage what Obsidian already knows
- Ability to attach context files alongside the focus file as a working set
- Spawn follow-up sessions that inherit context from completed sessions
- Guiding questions that keep attention on incremental improvement
- A session document generated at completion that summarizes what happened
- Unknown file types should be documentable as proper markdown files linked to the original

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
- [ ] Session goals: `SessionGoal[]` on Session with add/toggle/remove via events — *Increment 6*
- [ ] Session notes mutation: `session.notes.update` command + `session.notes.updated` state event — *Increment 6*
- [ ] Goals threaded through templates, rerun, createFromTemplate — *Increment 6*
- [ ] SessionWorkspaceView: dedicated leaf with timer, goals checklist, notes textarea, focus file, artifacts — *Increment 7*
- [ ] Auto-open workspace on session.start + open focus file in adjacent leaf — *Increment 8*
- [ ] Goals repeater in NewSessionModal for pre-session preparation — *Increment 8*
- [ ] - [ ] Focus File Profiles — detect file type and provide contextual tools:
  - **Markdown (`.md`)** — open in editor, backlinks, outgoing links, tags; if frontmatter `type` matches a DocType, provide domain-specific actions
  - **Canvas (`.canvas`)** — open canvas, show node/connection summary
  - **PDF (`.pdf`)** — open PDF viewer, page count
  - **Image (`.png`, `.jpg`, `.svg`, `.gif`, `.webp`)** — preview, dimensions, file size
  - **CSV (`.csv`)** — open in Flowti table view, row/column count, Data Exchange actions
  - **Unknown extensions** — show basic metadata (name, size, modified), provide "Document as MD" action that creates a linked markdown file
- [ ] Context Files — attach additional files to a session as the working set alongside the focus file, with add/remove via vault file picker
- [ ] Session Spawning — create new sessions from existing ones, inheriting focus file and selectable context files; "New Session from Focus" and "Design Session" actions
- [ ] Guiding Questions — always-visible prompts during active/paused sessions: "How should the next increment look like?" and "What can be improved?"
- [ ] Session Document — on completion, generate a markdown summary file with metadata, focus file link, context files, artifacts, notes, and timeline

### Technical Requirements

- `SessionService` implements `IService` with `load()` + `dispose()` lifecycle
- Timer uses `setInterval()` with cleanup on dispose
- Artifact tracking: wildcard listener for `file.*` events during active session window
- Session data model stored in TypedStorage under key `sessions`
- `session_focus` layout registered in LayoutRegistry (TD-49)
- - [ ] Focus file type detected and matching tool profile rendered in detail panel 
- [ ] Context files can be attached/removed during a session 
- [ ] New session can be spawned from existing session with inherited focus and context 
- [ ] Guiding questions displayed during active/paused sessions 
- [ ] Session summary document generated on completion as `.md` in configurable folder 
- [ ] Unknown file extensions show basic metadata and "Document as MD" action 
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
- [x] `npm run build` passes — *1,984 tests across 84 suites*
- [x] Unit tests for SessionService lifecycle, timer, templates, rerun, and timeline — *99 tests in SessionService.test.ts*
- [x] Rerun completed/archived sessions without re-entering configuration — *Increment 3: rerunSession() + auto-select*
- [x] Save sessions as reusable templates — *Increment 3: SaveTemplateModal + template CRUD + template list in detail panel*
- [x] Dashboard session callout with live timer and contextual actions — *Increment 3: updateTimerDisplay() + Pause/Resume*
- [x] Focus file selection with vault file picker — *Increment 4: focusFile on Session + VaultFilePickerModal*
- [x] End-to-end session time tracking with timeline and pause durations — *Increment 5: SessionTimelineEntry[] + computeTimelineSummary + Time Breakdown UI*
- [ ] Session goals: add, toggle, remove goals during session — *Increment 6*
- [ ] Session notes: inline editing with auto-save — *Increment 6*
- [ ] SessionWorkspaceView: dedicated focused leaf — *Increment 7*
- [ ] Goals in NewSessionModal for pre-session preparation — *Increment 8*
- [ ] Auto-open workspace + focus file on session start — *Increment 8*
- [ ] Focus file type detection returns correct profile for all 6 categories — *Increment 9*
- [ ] Context files: attach, remove, deduplicate, cap at 20 — *Increment 9*
- [ ] Context files carried through rerun, templates, create-from-template — *Increment 9*
- [ ] Spawn new sessions from existing ones inheriting focus + context — *Increment 10*
- [ ] Guiding questions visible during active/paused sessions — *Increment 10*
- [ ] Session document generated on completion as markdown file — *Increment 11*

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

### Increment 4: Focus File & Vault File Picker (2026-02-16)

Modified files:
- `src/domain/session/types.ts` — `focusFile: string | null` on Session, `focusFile?: string` on SessionTemplate
- `src/domain/session/helpers.ts` — `createSession()` accepts optional `focusFile` parameter
- `src/domain/session/SessionService.ts` — `focusFile` threaded through `handleCreate()`, `rerunSession()`, `createFromTemplate()`, `saveTemplateFromSession()`
- `src/ui/modals.ts` — Focus file text input + "Browse" button (folder-open icon) on NewSessionModal, new `VaultFilePickerModal` class (~22 LOC) using `FuzzySuggestModal` to pick any vault file
- `src/ui/userHub/UserHubSessions.ts` — Focus file link in detail panel (clickable, opens file via `deps.openFile()`)
- `src/ui/userHub/types.ts` — `openFile(path)` callback added to `UserHubComponentDeps`
- `src/ui/UserHubView.ts` — Wired `openFile` dep via `app.workspace.openLinkText()`
- `tests/domain/session/SessionService.test.ts` — +5 tests (focusFile creation, default null, template inclusion, rerun carry-forward, template carry-forward)
- `tests/domain/session/helpers.test.ts` — +1 test (createSession with focusFile)
- `tests/ui/userHub/UserHubSessions.test.ts` — +3 tests (focus file link display, null handling, openFile click)
- 2 test files updated with `openFile: vi.fn()`

### Increment 5: Session Timeline & Pause Duration Tracking (2026-02-16)

Modified files:
- `src/domain/session/types.ts` — `SessionTimelineAction` type, `SessionTimelineEntry` interface, `PauseSegment` interface, `TimelineSummary` interface, `timeline: SessionTimelineEntry[]` on Session
- `src/domain/session/helpers.ts` — 6 new pure functions: `computePauseSegments()`, `computeTotalPauseMs()`, `computeWallClockMs()`, `computeActiveTimeMs()`, `computeTimelineSummary()`, `formatDurationHuman()` + `createSession()` returns `timeline: []`
- `src/domain/session/SessionService.ts` — `timeline.push()` in `handleStart()`, `handlePause()`, `handleResume()`, `completeSession()` + backward compat in `load()` initializes missing `timeline` to `[]`
- `src/ui/userHub/UserHubSessions.ts` — New `renderTimeBreakdown()` (stat pills: Wall Clock, Active, Paused, Pauses count), `renderStatPill()`, `renderTimeline()` (chronological action log with icons and timestamps) sections in detail panel
- `tests/domain/session/helpers.test.ts` — +20 tests (computePauseSegments, computeTotalPauseMs, computeWallClockMs, computeActiveTimeMs, computeTimelineSummary, formatDurationHuman)
- `tests/domain/session/SessionService.test.ts` — +9 tests (timeline recording per lifecycle action, full lifecycle ordering, multiple pause/resume cycles, backward compat)
- `tests/ui/userHub/UserHubSessions.test.ts` — +6 tests (Time Breakdown rendering, pause count visibility, Timeline section entry count, action labels)
- `tests/ui/userHub/UserHubDashboard.test.ts` — makeSession updated with `timeline: []`

### Increment 6: Goals & Notes Domain (PLANNED)

User story: [[I want to prepare a working session, so that I can focus on one task at a time]]

Scope:
- `SessionGoal` interface (id, text, completed, completedAt) in `types.ts`
- `goals: SessionGoal[]` on Session, `goals?: string[]` on SessionTemplate
- 8 new events: `session.goal.{add,toggle,remove}` commands + `session.goal.{added,toggled,removed}` state + `session.notes.{update,updated}`
- 4 new SessionService handlers: `handleGoalAdd`, `handleGoalToggle`, `handleGoalRemove`, `handleNotesUpdate`
- Threading: `handleCreate`, `rerunSession`, `createFromTemplate`, `saveTemplateFromSession`
- Backward compat in `load()`: `s.goals ??= []`
- Pure helper: `createGoal(id, text)`
- ~203 LOC, ~25 tests

### Increment 7: SessionWorkspaceView (PLANNED)

Scope:
- New `SessionWorkspaceView` extending `ItemView` directly (not BaseHubView)
- Layout: header (title + status + actions) → timer → goals checklist → notes textarea → focus file link → artifacts
- Timer: incremental DOM update via `session.timer.tick`
- Goals: inline add, checkbox toggle, remove — all via event bus
- Notes: `<textarea>` with 500ms debounced save via `session.notes.update`
- Focus file: clickable link → `app.workspace.openLinkText()` in adjacent leaf
- Artifacts: live list updated on `session.artifact.added`
- Registered in `registry.ts`, command `flowti:open-session-workspace`
- ~513 LOC, ~15 tests

### Increment 8: Preparation Flow & Auto-Open (PLANNED)

Scope:
- Goals repeater in `NewSessionModal` (add/remove goal text inputs before creating session)
- Update `session.create` payload with optional `goals?: string[]`
- Auto-open `SessionWorkspaceView` on `session.started` event
- Open focus file in adjacent split leaf on session start
- "Open Workspace" button on active/paused sessions in `UserHubSessions` detail panel
- ~111 LOC, ~6 tests

### Increment 9: Focus File Profiles & Context Files (PLANNED)

User story: [[I want to prepare a working session, so that I can focus on one task at a time]]

Scope:
- `FocusFileCategory`, `FocusFileTool`, `FocusFileProfile` types in new `focusFileProfile.ts`
- `detectFocusFileCategory(path)` — extension → category mapping (6 categories: markdown, canvas, pdf, image, csv, unknown)
- `resolveFocusFileProfile(path, frontmatterType?)` — full profile with contextual tools + DocType enrichment
- `FOCUS_FILE_TOOLS` registry — static tool definitions per category
- `contextFiles: string[]` on Session, `contextFiles?: string[]` on SessionTemplate
- 4 new events: `session.context.{add,remove}` commands + `session.context.{added,removed}` state
- `handleContextAdd` / `handleContextRemove` on SessionService (dedupe + max 20)
- Threading: rerunSession, createFromTemplate, saveTemplateFromSession carry context files
- Backward compat in `load()`: `s.contextFiles ??= []`
- See: [[Phase 4 Inc 9 - Focus File Profiles and Context Files]]
- ~90 LOC new file + ~50 LOC service changes, ~31 tests

### Increment 10: Session Spawning & Guiding Questions (PLANNED)

User story: [[I want to prepare a working session, so that I can focus on one task at a time]]

Scope:
- `spawnSession(sessionId)` on SessionService — creates new session inheriting focus file + context files
- `designSession(sessionId, selectedContextFiles)` — spawn with user-selected context subset
- 2 new events: `session.spawn` command + `session.spawned` state
- `GUIDING_QUESTIONS` constant — always-visible prompts: "How should the next increment look like?", "What can be improved?"
- UI: "New Session from Focus" and "Design Session" actions on completed/archived session detail
- UI: Guiding Questions rendered in SessionWorkspaceView during active/paused
- ~120 LOC, ~18 tests

### Increment 11: Session Document Generation (PLANNED)

User story: [[I want to prepare a working session, so that I can focus on one task at a time]]

Scope:
- `generateSessionDocument(session)` — pure function producing markdown string with metadata, focus file link, context files, artifacts, notes, timeline summary
- Listen to `session.completed` → create `.md` file via `file.create.request` event
- Configurable folder: `sessionDocumentsPath` setting (default: `"Sessions/"`)
- File name pattern: `YYYY-MM-DD <SessionType> - <Title>.md`
- Backlink from session document to focus file via wiki-link
- ~100 LOC, ~15 tests
