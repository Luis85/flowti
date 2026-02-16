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
- [ ] Focus File Profiles — detect file type and provide contextual tools:
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
- [ ] Focus file type detected and matching tool profile rendered in detail panel — *Increment 6*
- [ ] Context files can be attached/removed during a session — *Increment 6*
- [ ] New session can be spawned from existing session with inherited focus and context — *Increment 6*
- [ ] Guiding questions displayed during active/paused sessions — *Increment 6*
- [ ] Session summary document generated on completion as `.md` in configurable folder — *Increment 6*
- [ ] Unknown file extensions show basic metadata and "Document as MD" action — *Increment 6*

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

### Increment 6: Session Focus Tools (planned)

> Sessions are the primary mechanism for focused, time-boxed content creation inside the Vault. The focus file is the session's anchor — its type drives the available tooling, its content drives the user's attention, and the session always pushes toward the next increment. This increment transforms sessions from a timer-with-tracking into a **focused workspace** that leverages Obsidian's tools based on what the user is working on.

#### 6a. Focus File Profiles

Detect the focus file's extension (and for `.md`, its frontmatter `type`) to determine which tools to surface in the session detail panel.

**File type categories:**

| Category | Extensions | Tools / Actions |
|----------|-----------|-----------------|
| Markdown | `.md` | Open in editor, show backlinks panel, outgoing links, tags. If frontmatter `type` is a known DocType (EventDoc, ServiceDoc, FlowDoc, etc.), show domain-specific actions: "Open in Event Catalog", "Show related Flows", "View Service Blueprint" |
| Canvas | `.canvas` | Open canvas view, show node count and connection summary. Design sessions benefit from visual board overview |
| PDF | `.pdf` | Open in PDF viewer, show page count. Allow creating annotation notes linked to the PDF |
| Image | `.png`, `.jpg`, `.jpeg`, `.svg`, `.gif`, `.webp` | Show image preview (thumbnail), dimensions, file size. Allow creating annotation/documentation notes linked to the image |
| CSV | `.csv` | Open in Flowti table view, show row/column count. Link to Data Exchange import/export actions |
| Unknown | everything else | Show basic file metadata: filename, extension, file size, last modified date. Provide **"Document as MD"** action — creates a new `.md` file with frontmatter metadata and a `[[wiki-link]]` to the original file, enabling the unknown file to participate in the knowledge graph |

**Domain logic:**
- New pure function `resolveFocusFileProfile(filePath, frontmatterType?)` in `src/domain/session/helpers.ts`
- Returns a `FocusFileProfile` object: `{ category, extension, docType, tools[] }`
- Tools are declarative: `{ id, label, icon, actionType }` — UI maps `actionType` to Obsidian workspace operations

**UI:**
- New `renderFocusFileTools(session, profile)` section in `UserHubSessions` detail panel, positioned after the timer section
- Shows: file type icon + category badge, then tool buttons in a flex row
- For `.md` with known DocType: additional domain badge (e.g., "EventDoc") + domain-specific tool buttons
- For unknown: file metadata card + prominent "Document as MD" button

#### 6b. Context Files

Sessions need more than a single focus file. Context files are the working set — the supporting material the user needs alongside the focus file during focused work.

**Data model:**
- `contextFiles: string[]` added to `Session` entity (default: `[]`)
- `contextFiles?: string[]` on `SessionTemplate` (optional, for template carry-forward)
- Backward compatibility: `load()` initializes missing `contextFiles` to `[]`

**Actions:**
- "Add Context File" button in session detail panel opens `VaultFilePickerModal` (reuse existing)
- Each context file row shows: type icon (derived from extension), filename, clickable link (opens file), "remove" action button
- Context file list is collapsible (collapsed by default when empty, expanded when files present)
- Context files are tracked through rerun and templates (same pattern as focusFile)

**Events:**
- `session.contextFile.added` — `{ sessionId, filePath }` — emitted when a context file is attached
- `session.contextFile.removed` — `{ sessionId, filePath }` — emitted when a context file is detached
- Both events trigger `save()` and UI refresh

#### 6c. Session Spawning

Enable iterative work by spawning new sessions from existing ones with inherited context.

**Two spawn modes:**

1. **"New Session from Focus"** — quick spawn:
   - Available on completed/archived sessions (alongside Rerun)
   - Creates a new "prepared" session with the same focus file, empty context files
   - Title auto-generated: `"[Focus] <original-title> (cont.)"` or similar
   - Unlike Rerun (which copies everything), this starts fresh with just the focus anchor

2. **"Design Session"** — curated spawn:
   - Available on any session with a focus file
   - Opens a multi-select file picker showing the current session's context files + artifacts
   - User selects which files to carry into the new session as context files
   - The focus file is carried over automatically
   - Creates a new "prepared" session with focus file + selected context files
   - Enables the user to evolve a work stream: complete a session → review outputs → spawn a design session that carries forward the relevant files

**Event:**
- `session.spawned` — `{ sourceSessionId, newSessionId }` — emitted after spawn completes

#### 6d. Guiding Questions

Every session is oriented toward incremental improvement. Two guiding questions are always visible during active/paused sessions to keep the user's attention on the focus file's content:

- **"How should the next increment look like?"** — Forward-looking: what is the next concrete step?
- **"What can be improved?"** — Reflective: what about the current state could be better?

**UI:**
- Rendered as a subtle callout/card in the session detail panel, between the timer and the tools section
- Only visible during `active` and `paused` states — not for `prepared`, `completed`, or `archived`
- Styled as a muted accent card with question mark icon, easy to read but not distracting
- These are fixed prompts (not user-configurable in v1) — they encode the session philosophy

#### 6e. Session Document

On session completion, generate a permanent markdown record in the vault that captures what happened during the session. This makes sessions first-class vault citizens — discoverable via search, linkable via backlinks, and browsable in the file explorer.

**Generated document structure:**

```markdown
---
type: SessionDocument
session_id: "<id>"
session_type: "<type>"
focus_file: "[[<focus-file-path>]]"
duration_minutes: <n>
completed_at: "<ISO>"
---

# Session: <title>

## Focus
[[<focus-file-path>]]

## Context Files
- [[file-1]]
- [[file-2]]

## Time Breakdown
- Wall Clock: Xm Ys
- Active: Xm Ys
- Paused: Xm Ys (N pauses)

## Artifacts
- [[created-file]] (created)
- [[modified-file]] (modified)

## Notes
<session notes content>

## Timeline
- HH:MM:SS — Started
- HH:MM:SS — Paused
- HH:MM:SS — Resumed
- HH:MM:SS — Completed
```

**Configuration:**
- Session documents folder: configurable in Settings (default: `Sessions/`)
- File naming: `YYYY-MM-DD <SessionType> - <Title>.md` (e.g., `2026-02-16 Event Storming - Order Flow.md`)

**Behavior:**
- Generated automatically on `session.complete` (not on archive — only the first completion)
- `session.document.created` event emitted with `{ sessionId, documentPath }`
- Document path stored on Session entity as `documentPath: string | null`
- If a session document already exists (e.g., rerun of same session), a new document is created (not overwritten)
- Uses `DocService` or direct vault file creation depending on implementation simplicity

#### Technical Requirements (Increment 6)

- `FocusFileProfile` type and `resolveFocusFileProfile()` pure helper in `helpers.ts`
- `contextFiles: string[]` and `documentPath: string | null` fields on `Session`
- `contextFiles?: string[]` and `documentPath` omitted on `SessionTemplate`
- New `SessionService` methods: `addContextFile()`, `removeContextFile()`, `spawnSession()`, `spawnDesignSession()`, `generateSessionDocument()`
- 4 new events in `SessionEventMap`: `session.contextFile.added`, `session.contextFile.removed`, `session.document.created`, `session.spawned`
- UI: `renderFocusFileTools()`, `renderContextFiles()`, `renderGuidingQuestions()` in `UserHubSessions`
- Settings: `sessionDocumentsFolder` in FlowtiSettings (default: `"Sessions/"`)

#### Constraints (Increment 6)

- Focus file profile detection must work without reading file content for non-`.md` files (extension-based only)
- For `.md` files, frontmatter `type` is read via Obsidian's `metadataCache` (no raw file parsing)
- Session document generation must not block the UI — use async file creation
- Context files list should be bounded (suggest max 20 per session) to avoid performance issues
- "Document as MD" action must handle name collisions (append suffix if file exists)
