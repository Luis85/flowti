---
type: DevelopmentCycle
feature: "[[Hubs PRD]]"
stage: done
cycle: 1
date_planned: 2026-02-14
date_completed: 2026-02-18
pbis:
  - "[[PBI-001 User Hub]]"
  - "[[PBI-002 Documentation Sessions]]"
  - "[[PBI-SW-001 Activity Log]]"
  - "[[PBI-SW-002 Context Bindings]]"
tech_debt: []
estimated_increments: 17
actual_increments: 17
estimated_tests: 515
actual_tests: 515
total_tests_after: 2177
total_test_files_after: 84
---

# Cycle 1: Foundations

> **Retroactive documentation.** Cycle 1 was not formally planned as a cycle — it was the entire exploratory build phase that produced the Flowti IBDE plugin from first concept to the point where cycle-driven development was adopted. This document was written after the fact to anchor the story that Cycles 2–6 build on.

## Philosophy

The goal was simple: **build a tool to quickly support daily tasks inside Obsidian.** Not a grand vision, not a polished product plan — just a question: *"What if my vault could do more than store notes?"*

The approach was deliberately fast and loose:
- Build the smallest thing that works
- Use it immediately (eat your own dog food)
- Ship small, focused tools that each solve one real need
- Let friction and missing features generate the next idea
- Capture learnings as they emerge

By the end of this cycle, Flowti went from "an idea" to a working system with infrastructure, tooling, hubs, and sessions — and the act of building it revealed how to build it *better*.

---

## The Story Arc

### Act 1: Plugin Infrastructure — "Make the plumbing work"

Everything started with infrastructure. Before any user-facing feature could exist, the plugin needed a backbone:

- **EventBus** — the central nervous system. All communication flows through typed events. No direct coupling between domains.
- **EventBridge** — the sole contact point with Obsidian's API. Vault events (file creates, renames, deletes) are translated into domain events.
- **DDD Architecture** — `infrastructure/`, `domain/`, `ui/`, `utils/` — established early and never changed. Each domain owns its types, events, and services.
- **Infrastructure services** — ErrorHandler, Logger, FileSystemClient, TypedStorage, PathMutex — small, focused utilities that every domain builds on.
- **Installer** — automated first-run setup: folder creation, default settings, event catalog population.
- **Settings** — FlowtiSettingTab with typed persistence and per-domain configuration.

This phase wasn't glamorous, but it was critical. The architecture decisions made here — event-driven communication, domain isolation, pure helper functions — held up through 5 subsequent cycles without structural changes.

### Act 2: Small Focused Tools — "Solve a real need every day"

With the plumbing in place, the focus shifted to **tools that earned their place by being used daily**:

- **Event System** — typed event registration, category tagging, system vs. user events. Every action in the plugin became traceable.
- **Event Catalog** — the visual source of truth. Browse all events by category, see what's registered, configure subscriptions, define event documentation. This became the central hub for understanding what the system does.
- **File Events** — real-time vault monitoring. File creates, modifications, renames, deletions — all captured and routed through the EventBus.
- **Data Exchange Hub** — CSV import with column mapping, data export with templates, automated pipelines. Turned Obsidian from a note-taking app into a data processing tool.
- **Subscriptions** — event-driven notifications. Match patterns, trigger actions, build workflows.
- **Ingestion** — vault content discovery and frontmatter normalization. The plugin could now understand and process structured vault content.

Each of these was a small, focused delivery. None required months of planning. The pattern was: identify a daily friction point, build the smallest solution, use it, iterate.

By this point, ~1,585 tests were passing across 15 bounded contexts.

### Act 3: Hubs Framework — "Navigate domains, not files" (Phases 1–3)

The individual tools worked well, but they were disconnected. Users had to know where to go for each task. The **Hubs PRD** changed the paradigm: instead of navigating files, navigate **Domains > Hubs > Events & Entities**.

**Phase 1: Foundation** — Extracted `BaseHubView` (278 LOC) as the abstract base class for all Hub views. Unified ~220 LOC of duplicated shell logic (wrapper, top bar, tab bar, split layout, debounced render, cleanup).

**Phase 2: System Hub Migration** — Migrated Event Catalog (864>723 LOC, -16%) and Data Exchange Hub (556>477 LOC, -14%) to the BaseHubView pattern. Component extraction reduced complexity. Cross-Hub Infrastructure added `HubRegistry` and `hub.navigate` for deep linking between hubs.

**Phase 3: User Hub** — Built the personal cockpit in 4 increments:
- **Dashboard** with cross-hub stat cards and deep-linking
- **Inbox** with actionable items from domain events (subscriptions, imports, exports, pipelines)
- **Inbox UX** with source configuration, unread badges, and catalog deep-linking
- **Preferences** with user profile and inbox source toggles

PBI-001 (User Hub) was now complete. The plugin had a home.

### Act 4: Sessions — From Timer to Workspace (Phase 4)

While using the Event Catalog daily and interacting with stakeholders, a pattern emerged: **there was no structure around the act of working.** You could browse events, import data, manage subscriptions — but the work itself was untracked. Content was being created without context. Vault ingestion needed direction.

The sessions idea was born from this insight: *what if work happened inside a structured container that kept things focused and steered vault content into predefined templates?*

**PBI-002 (Documentation Sessions)** started as "a timer for documentation work." Within the first increment, it became clear this was much bigger — it was a **workspace** concept. A way to fill the vault with structured content in an easy-to-follow way.

10 increments delivered in 3 days:

| Inc | Deliverable |
|-----|-------------|
| 1 | Session domain core — state machine, Pomodoro timer, 19 events, TypedStorage |
| 2 | Sessions tab in User Hub — master-detail list, NewSessionModal |
| 3 | Templates & rerun — template CRUD, session rerun, createFromTemplate |
| 4 | Focus file — vault file picker, attach a file to a session for context |
| 5 | Timeline & pause tracking — chronological event log, time breakdown |
| 6 | Goals & notes — SessionGoal, 8 events, goal threading through templates |
| 7 | SessionWorkspaceView — dedicated full-screen workspace (463 LOC) |
| 8 | Workspace enrichment — links, canvas, summary generation, duration editing, "Save as Template" |
| 9 | Preparation flow — auto-open on start, goals in modal, validation |
| 10 | Activity & context — activity log, folder filtering, context bindings, sidebar workspace |

By Inc 4, sessions stopped being timers. Attaching a focus file turned a session into a *context*. By Inc 7, the SessionWorkspaceView gave sessions a dedicated environment. By Inc 10, activity tracking made sessions a genuine record of work done — the plugin watched what you did in the vault and recorded it on the session.

**Sessions became the bridge between "tools" and "workflow."** They steered vault content ingestion into structured templates, kept work focused around a goal, and produced traceable artifacts. This was the moment sessions became a core feature of Flowti — not just a timer, but the way you fill the vault.

### Act 5: The Meta-Insight — "Improve the process that builds the process"

The most important discovery of Cycle 1 wasn't a feature — it was a realization.

While playtesting sessions, we discovered they could improve the development cycle itself. Put the dev work in a session. Track what files are created. Record decisions. Generate summaries. Adjust the workflow inside Obsidian. The tool we built to help users focus their work could help us focus *our* work.

This meta-insight triggered the switch to **cycle-driven development** to better harness AI-assisted development:

- Formal cycle planning with goals and success criteria
- Definition of Ready (Cycle) and Definition of Done (Cycle) checklists
- AI-assisted development structured through sessions inside Obsidian
- Each cycle scoped, estimated, reviewed, and retrospected

Cycle 2 would be the first cycle built this way.

---

## Cumulative Delivery

### By Phase

| Phase | Scope | Increments | Tests Added | Key PBI |
|-------|-------|-----------|-------------|---------|
| Pre-Hubs | Infrastructure, Event System, Event Catalog, Data Exchange, Subscriptions, Ingestion, Installer, Settings | — | ~1,585 (baseline) | — |
| Phase 1 | BaseHubView foundation | 1 | 0 | — |
| Phase 2 | System Hub Migration + Cross-Hub Infrastructure | 2 | 0 | — |
| Phase 3 | User Hub (Dashboard, Inbox, Preferences) | 4 | 92 | PBI-001 |
| Phase 4 | Sessions > Workspaces | 10 | 423 | PBI-002, SW-001, SW-002 |
| **Total** | | **17** | **515 new** | **4 PBIs** |

### End-of-Cycle Metrics

| Metric | Value |
|--------|-------|
| Tests total | 2,177 (32 skipped), 84 test files |
| Bounded contexts | 15 |
| Session domain LOC | 2,724 across 5 source files |
| Session UI LOC | ~1,300 across 8 UI files |
| Hubs framework LOC | BaseHubView 278, HubRegistry 65 |
| Session events registered | 38 |
| Hub lifecycle events | 3 (hub.opened, hub.closed, hub.tab.changed) |
| PRDs active | Hubs PRD (Phase 4 complete); Session Workspaces PRD v4, FRI 29/35 |
| PBIs delivered | PBI-001, PBI-002, PBI-SW-001, PBI-SW-002 |
| ADRs produced | ADR-025 through ADR-029 (5 ADRs) |
| Learnings produced | L-01 through L-20 |

---

## Ideas Generated

This is the real output of Cycle 1 — the backlog of improvements that emerged from actually using the tool:

**Immediately obvious needs (became Cycle 2):**
- Session types need guiding questions and configurable defaults (> PBI-SW-003)
- Need a structured way to record decisions during sessions (> PBI-SW-004)
- Summary should include decisions (> PBI-SW-005 completion)
- SessionWorkspaceView at 1,037 LOC needs component extraction (> TD-01)

**Medium-term needs (became Cycles 3–5):**
- Workspace state (open files) should be saved on pause and restored on resume (> PBI-SW-006)
- Sessions should produce exportable output artifacts — meeting notes, action items (> PBI-SW-008)
- "I want to automatically start a Day Session to track my usage" (> PBI-SW-007)
- Session nudges — timed reminders to start focused work (> PBI-SW-007)

**Long-term vision (became Cycle 6 / v2):**
- Sessions should have an intent — "what am I trying to achieve?" (> FR-10, Cycle 6)
- Sessions should track energy level over time (> FR-11)
- Structured reflection at session end, not just a blank summary (> FR-13, FR-14)
- Sessions should detect cognitive overload (> FR-16)

**Inbox items captured during Cycle 1:**
- Filter folders from activity log (partially delivered, global filter deferred)
- Domain Design guided session type (> PBI-SW-009)
- JSON import/export for session templates (> Cycle 6 Inc 1)
- Capture ideas section on User Hub
- Guided tours for new users

---

## Risks & Mitigations

| Risk | Impact | Mitigation | Materialized? |
|------|--------|------------|---------------|
| Rapid iteration produces fragile code | High | Event-driven architecture + pure helpers kept coupling low; domain-first approach (L-01) caught issues early | No — architecture held up well |
| SessionWorkspaceView grows uncontrollably | Medium | Monitor LOC; extract components when threshold hit | **Yes** — reached 1,037 LOC, became TD-01 |
| No formal DoR/DoD for increments | Medium | Retrospective review after the fact; establish formal process for Cycle 2+ | **Yes** — gap acknowledged, DoR/DoD created post-cycle |
| Feature scope creep from "just one more thing" | Medium | Each increment scoped with clear deliverable; PRD updated incrementally | **Partial** — Inc 8 was larger than planned but delivered value |
| Pre-Hubs tools become disconnected silos | Medium | Hubs framework unified navigation; BaseHubView standardized UI | No — Hubs pattern resolved this cleanly |

---

## Three Amigos Review

**Reviews conducted:** 6 Three Amigos reviews across Phase 4 increments (informal, concurrent with delivery). No formal reviews during Phases 1–3.

| Review | TASM Score | Key Findings |
|--------|-----------|-------------|
| Inc 1: Session Domain Core | 0 (initial baseline) | Foundation accepted |
| Inc 3: Templates & Rerun | 32 | Template CRUD patterns validated |
| Inc 4: Focus File | 34 | Minimal scope, clean delivery |
| Inc 5: Timeline & Pause | 34 | Pure helper approach validated |
| Inc 8: Workspace Enrichment | 34 | 7 integrated capabilities reviewed |
| Inc 9: Preparation Flow | 32 | Auto-open and goal integration reviewed |

**Technical Review (2026-02-17):** PASS — validated full Session Workspaces PRD scope (6 PBIs, L1-L2), architecture compliance confirmed, no hidden cross-domain side effects.

---

## Cycle Retrospective

### What Went Well
- **Architecture decisions held** — EventBus + domain services + pure helpers scaled from infrastructure to hubs to sessions without structural changes
- **Small focused tools earned their place** — every feature was used daily, which made friction immediately visible and generated the next requirement
- **Speed of iteration** — 17 increments delivered through fast, focused pushes. The event-driven architecture made it possible to add features without breaking existing ones
- **The product designed itself** — daily usage generated the backlog. Requirements weren't hypothetical — they came from real friction
- **20 learnings captured** — more than any subsequent cycle. The rapid iteration surfaced patterns that became the foundation for all future development

### Deviations from Plan

There was no plan — and that was the plan. Cycle 1 was exploratory by design. The approach was to build the smallest thing, use it, and let the next step reveal itself.

Key emergent scope:
- **Hubs framework** — started as a refactoring exercise, became the navigation paradigm for the entire plugin
- **User Hub Inbox** — not in any original plan, emerged from the need to surface cross-domain events
- **Sessions as workspaces** — scoped as "a timer for documentation," became an execution environment
- **Activity tracking** — planned for a future cycle, pulled forward because daily usage demanded it
- **Cycle-driven development** — the biggest unplanned outcome: the tool improved its own build process

### Learnings (L-01 through L-20)

| # | Learning | Impact |
|---|---------|--------|
| L-01 | Domain-first, UI-second | Applied in every subsequent cycle |
| L-02 | Timer optimization matters | 1s interval with computed remaining |
| L-03 | Deps callback pattern for modals | Standard modal architecture |
| L-04 | Type safety at boundaries | Zod validation pattern |
| L-05 | Test mock maintenance | Shared mock factories |
| L-06 | Direct CRUD for config data | Simplified persistence |
| L-07 | Reuse existing pipelines | FileSystemClient reuse |
| L-08 | UI should reflect service constraints | Status-driven rendering |
| L-09 | Thread new fields through all creation paths | Field threading discipline |
| L-10 | Pure helpers scale safely | Composable filtering |
| L-11 | Backward compat is the tax on persisted state | `??=` guard pattern |
| L-12 | Feedback loops generate the best requirements | Self-use > backlog |
| L-13 | Domain-only increments build confidence | Test before UI |
| L-14 | Standalone views don't need BaseHubView | ItemView for workspaces |
| L-15 | Aggregate small features into cohesive increments | Inc 8 pattern |
| L-16 | Planned increments shift as reality unfolds | Embrace emergence |
| L-17 | Wikilink insertion for artifacts | Standard link pattern |
| L-18 | Cross-PBI delivery keeps momentum | SW-001 + SW-002 in Inc 10 |
| L-19 | Superseding ADRs is a healthy sign | ADR-025 superseded |
| L-20 | Pure functions for filtering compose cleanly | Folder filter pattern |

### Improvement Backlog (from this cycle)
- [x] Establish formal cycle planning process > Definition of Ready and Definition of Done created
- [x] Create Session Workspaces PRD as standalone (extracted from Hubs PRD) > PRD v4 created
- [x] Define PBI backlog with acceptance criteria > 9 PBIs (SW-001 through SW-009)
- [x] Component extraction for SessionWorkspaceView (1,037 LOC) > TD-01, resolved in Cycle 2
- [x] SettingsService race condition discovered > TD-72, resolved in Cycle 2
- [x] Session management flow integration test missing > TD-94, resolved in Cycle 2

### Inbox & Feedback Loop

**Inbox review:** Not formally conducted. Inbox items were captured organically during development — ideas, friction points, and bugs were written directly into the plugin inbox (`Development/flowti/docs/inbox/`) as they emerged.

**Key inbox items generated during Cycle 1:**
- "I want to filter folders to not appear in my sessions activity log" (partially delivered)
- "I want to have a daily-session to track what I have done over the day" (> Cycle 4)
- "I want to easily start a new session while working inside Obsidian" (> Cycle 5)
- "I want to have a Domain Design Session" (> PBI-SW-009)
- "I want to import and export a session template via JSON" (> Cycle 6)

---

## The Bridge to Cycle 2

By the end of Cycle 1, Flowti was a working system:
- **Infrastructure**: EventBus, EventBridge, DDD architecture, 15 bounded contexts
- **Tools**: Event Catalog, Data Exchange Hub, File Events, Subscriptions, Ingestion
- **Framework**: BaseHubView, HubRegistry, cross-hub navigation
- **User Hub**: Dashboard with cross-hub stats, Inbox with actionable items, Preferences
- **Sessions**: Create, run, pause, resume, complete. Track activity, bind context, use templates, generate summaries. Dedicated workspace view.

But the most significant output wasn't a feature — it was a **process change**. The realization that sessions could structure the development work itself led to adopting cycle-driven development:

- **Formal planning** with goals, success criteria, and increment scope
- **Definition of Ready / Definition of Done** to ensure quality
- **AI-assisted development** harnessed through structured sessions inside Obsidian
- **Retrospectives** to capture what worked and what to improve

Cycle 2 would be the first cycle built this way: planned, scoped, and tracked from the start.

The foundation was laid. Now it was time to refine.

---

## Related

- PRD: [[Hubs PRD]] (Phases 1–4 delivered during Cycle 1)
- PRD: [[Session Workspaces PRD]] (v4, FRI 29/35 at cycle end — extracted from Hubs PRD Phase 4)
- PBIs: [[PBI-001 User Hub]], [[PBI-002 Documentation Sessions]], [[PBI-SW-001 Activity Log]], [[PBI-SW-002 Context Bindings]]
- Hubs Increments: [[Phase 1 - Foundation]], [[Phase 2 - System Hub Migration]], [[Phase 2.5 - Cross-Hub Infrastructure]], [[Phase 3 Inc 1 - User Hub Dashboard]], [[Phase 3 Inc 2 - Inbox Population]], [[Phase 3 Inc 3 - Inbox UX and Source Config]], [[Phase 3 Inc 4 - Pipeline Inbox and Preferences]]
- Session Increments: [[Phase 4 Inc 1 - Session Domain Core]], [[Phase 4 Inc 2 - Sessions Tab]], [[Phase 4 Inc 3 - Templates and Rerun]], [[Phase 4 Inc 4 - Focus File]], [[Phase 4 Inc 5 - Timeline and Pause Tracking]], [[Phase 4 Inc 6 - Goals and Notes Domain]], [[Phase 4 Inc 7 - SessionWorkspaceView]], [[Phase 4 Inc 8 - Session Workspace Enrichment]], [[Phase 4 Inc 9 - Focus File Profiles and Context Files]], [[Phase 4 Inc 9 - Sidebar Workspace and Activity Consolidation]]
- Review: [[Technical Review 2026-02-17]]
- Learnings: L-01 through L-20
- ADRs: ADR-025 through ADR-029
- Next Cycle: [[Cycle 2 - Session Types and Decision Log]]
