---
type: Process
domain: Flowti/Process
stage: draft
version: 1
review_cycle: quarterly
tags:
  - process
  - lifecycle
  - quality
  - delivery
---

# Flowti Development Lifecycle

> **Answered**: The [[Feature Lifecycle PRD]] implements this process as a first-class Flowti domain. PRDs flow through 6 stages (idea → draft → approved → in-progress → review → done), gate readiness is computed automatically, sessions track progress, and FRI/TASM scores enforce quality.

> Objective: 
> 1. Make this document processable by Flowti to document the domain and as codified process inside the plugin — **see [[Feature Lifecycle PRD]] for implementation**
> 2. Auto-Generate this Document out of settings

## 1. Purpose

This process defines how Flowti turns **feedback and ideas** into **tested, documented, published increments**.

It ensures:
- customer alignment
- event-driven architectural integrity
- continuous documentation
- predictable quality gates
- repeatable release outcomes

In short: We document a new solution-idea as [[PRD Template|PRD]], review and refine that PRD during discovery while developing the solution incrementally and in parallel, Flowti supports us by keeping track of undocumented Features and our learnings, each increment must run trough a extensive [[Three Amigos Session Template|Three Amigos Review Session]] where technical-debt and deviations get collected and documented for further improvements. Imagine PRDs as tokens trough the process. Each Phase Gate triggers a thorough review from the three amigos to ensure quality over time.

---

## 2. Roles and Responsibilities

### 2.1 Core Roles

| Role | Primary Responsibilities |
|------|--------------------------|
| Product (PM/PO) | Vision, outcomes, scope, prioritization, stakeholder alignment |
| Engineering (Dev) | Architecture, implementation, testing, performance, maintainability |
| UX | Interaction design, usability, workflow clarity, IA & discoverability |
| QA / Quality | Test strategy execution, regression prevention, quality gates |
| Tech Lead / Architect | Architectural coherence, boundaries, reviews, constitution enforcement |
| Documentation Owner | Ensures docs reflect reality; coordinates updates & structure |
| Customer/User Representative | Feedback, validation, acceptance, workflow verification |

### 2.2 RACI (per increment)

| Activity | Product | Eng | UX | QA | Architect | Doc Owner | Customer |
|----------|--------:|----:|---:|---:|----------:|----------:|---------:|
| Define problem & outcome | A | C | C | C | C | C | C |
| Create PRD | A | C | C | C | C | C | C |
| Technical review | C | R | C | C | A | C | - |
| Design solution | C | C | A/R | C | C | C | C |
| Implement | - | A/R | C | C | C | - | - |
| Write tests (TDD) | - | A/R | - | C | C | - | - |
| Validate & integrate | - | R | - | A/R | C | - | - |
| Publish & release notes | A | R | C | C | C | A/R | C |

Legend: R=Responsible, A=Accountable, C=Consulted

---

## 3. Principles

- Event Catalog is **source of truth**
- Hubs are **workspaces** (User Hub + Domain Hubs + System Hubs)
- UI is **configuration-driven** (tabs/layouts/manifests)
- Domain logic lives in **adapters/services**, not UI
- Every increment is:
  **implemented + tested + documented + published**
- Quality is enforced via:
  **TestPlan**, **Technical Review**, **Three Amigos**

---

## 4. Lifecycle Overview

### 4.1 Phases

1) Feedback & Idea Intake  
2) Discovery (problem space)  
3) Solution Exploration  
4) Solution Design + PRD Drafting  
5) PRD → Development Ready  
6) Delivery Planning + Chunking  
7) Iterative Implementation (increments)  
8) Review + Quality Assurance  
9) Documentation + Publication  
10) Post-Release Feedback Loop

---

## 5. Phase Details

### Phase 1 — Feedback & Idea Intake

**Inputs**
- customer feedback (captured as User Stories while using existing solutions)
- user issues
- Three Amigos findings
- tech debt review
- telemetry/usage signals (if available)

**Primary feedback mechanism: User Stories**
Feedback is captured primarily through **User Stories** that emerge while users work with existing solutions. When a user encounters friction, discovers a gap, or imagines an improvement, the observation is documented as a User Story linked to the affected Domain and Actor. This keeps feedback grounded in real usage rather than abstract feature requests.

**Activities**
- observe Jobs to be done by Actors within a Domain
- capture the observation as a User Story (user voice)
- link the story to affected hubs/domains/actors
- initial hypothesis: "what improvement do we expect?"

**Outputs**
- User Stories (linked to domain + actor + evidence)
- initial priority signal

**Quality Gate**
- Is this a real problem or a symptom?

---

### Phase 2 — Discovery (Problem Space)

**Goal**
- understand the problem and constraints before designing solutions

**Activities**
- stakeholder interviews / customer sync
- review existing behavior + workflows
- map impacted domains (bounded contexts)
- identify acceptance constraints (performance, compatibility, maintainability)

**Outputs**
- problem statement
- success outcomes (measurable)
- initial scope boundaries

**Gate**
- Problem and outcome must be written (not assumed).

---

### Phase 3 — Solution Exploration

**Activities**
- explore alternatives (2–3 options)
- align with architecture constraints (Event Catalog, adapters, manifests)
- early UX sketching
- risk identification

**Outputs**
- solution options + tradeoffs
- preferred direction

**Gate**
- solution must not violate architecture principles.

---

### Phase 4 — Solution Design + PRD Drafting

**Activities**
- PRD one-pager created
- define:
  - functional requirements
  - event impact (produced/consumed)
  - data model impact
  - hub entry points
  - UI layout impact (tabs/layouts/regions)

**Outputs**
- PRD draft
- initial tab definition (if UI change)
- initial adapter method list

**Gate**
- PRD must be reviewable by Engineering + UX + QA.

---

### Phase 5 — PRD → Development Ready

**Activities**
- refine requirements into testable acceptance criteria
- confirm architecture seams:
  - layout vs domain vs adapter
  - manifest changes
- confirm test approach aligns with TestPlan
- align with customers/users (expectations + acceptance)

**Outputs**
- PRD at “development_ready”
- Feature Readiness metrics block filled (FRI)
- Technical Review done (pass/conditional/fail)

**Gate**
- Technical Review must be ✅ Pass or ⚠ Conditional Pass with actions.

---

### Phase 6 — Delivery Planning + Chunking

**Goal**
- break PRD into vertical slices / manageable increments

**Activities**
- define increments by value
- identify dependencies
- define test coverage per slice
- define doc updates per slice

**Outputs**
- increment plan (slices)
- each slice has:
  - scope
  - acceptance criteria
  - test intent
  - documentation intent

**Gate**
- slices must produce end-to-end value, not partial infrastructure only.

---

### Phase 7 — Iterative Implementation (Increments)

**Activities per increment**
- implement via TDD where possible
- maintain architectural boundaries
- update manifests when needed:
  - layout-manifest
  - component-manifest
  - tab definitions
- emit/consume events via EventBus
- ensure vault artifacts are created/updated correctly

**Outputs**
- working increment
- tests passing
- docs updated alongside work (no “later”)

**Gate**
- build pipeline passes: tests → typedoc → tsc → eslint → esbuild

---

### Phase 8 — Review + Quality Assurance

**Activities**
- code review
- regression checks
- integration flow checks
- Three Amigos (regular cadence, not only at release)
- update tech debt register if shortcuts were needed

**Outputs**
- validated increment
- discovered improvements captured
- updated quality score (TASM) if applicable

**Gate**
- no increment is “done” without tests + docs.

---

### Phase 9 — Documentation + Publication

**Activities**
- finalize PRD status
- update:
  - feature docs
  - architecture docs (if impacted)
  - manifests and schemas
  - release notes (if release boundary)
- publish increment (plugin release or internal publish)
- ensure documentation is discoverable from hubs/catalog

**Outputs**
- published increment
- release note (if applicable)
- updated documentation

**Gate**
- documentation must reflect current behavior.

---

### Phase 10 — Post-Release Feedback Loop

**Activities**
- collect feedback as User Stories while users work with the published solution
- monitor issues and friction points observed in real usage
- schedule improvements based on captured stories
- incorporate findings into next cycle (new Phase 1 inputs)

**Outputs**
- User Stories (the primary feedback artifact — grounded in real usage)
- new inputs to Phase 1

---

## 6. Ceremonies (Cadence)

| Ceremony | Frequency | Purpose | Output |
|----------|----------:|---------|--------|
| Customer/User Sync | weekly/biweekly | validate outcomes & direction | feedback items |
| Three Amigos Review | biweekly/monthly | quality + drift detection | score + improvements |
| Technical Review | per feature | architecture gate | pass/conditional/fail |
| Increment Review | per slice | accept increment | accepted slice |
| Documentation Review | per release | docs alignment | updated docs |

---

## 7. Quality Gates Summary

- Feature Readiness Index required before implementation
- Technical Review checklist required before “approved”
- TestPlan strategy enforced (build gate)
- Three Amigos scoring used for ongoing quality health
- Documentation update is mandatory at every increment boundary

---

## 8. Artifacts (Outputs by Phase)

| Phase | Core Artifacts |
|------:|----------------|
| 1 | Idea record, evidence links |
| 2 | Problem statement, outcome, constraints |
| 3 | Solution options, tradeoffs |
| 4 | PRD draft + initial UI/adapter plan |
| 5 | PRD dev-ready + FRI + technical review |
| 6 | Increment plan (slices) |
| 7 | Code + tests + doc updates + manifest updates |
| 8 | Review notes, QA results, TASM score |
| 9 | Release note, updated docs, published increment |
| 10 | Feedback records + next iteration inputs |
All bundled and linked into the original PRD.

---

## 9. Definition of Done (Increment)

An increment is “Done” only if:

- [ ] Acceptance criteria met
- [ ] Tests added/updated according to TestPlan
- [ ] Build pipeline passes
- [ ] Documentation updated (PRD + user-facing + architecture if impacted)
- [ ] Manifests updated (layout/component/tab) if impacted
- [ ] No architectural boundary violations introduced
- [ ] Improvement items captured (if found)

---

## 10. Mental Model — From Domain to Delivery

This section describes the conceptual flow that drives the entire lifecycle. It answers: *How does an observation in a domain become a delivered solution?*

### The Starting Point: A Domain

Everything begins inside a **Domain** — a bounded context where real work happens. Domains are the natural unit of organization in Flowti. They have Actors, Services, Events, and documented knowledge.

### Observe: Jobs to be Done

While working inside a Domain, we **discover or observe Jobs to be Done** performed by **Actors**. These are the real tasks, workflows, and struggles that people encounter. We don't invent problems in the abstract — we observe them in context.

A user struggling to find related events. An architect unable to trace a file operation. A maintainer who can't tell which docs are stale. These are Jobs to be Done that signal an opportunity.

### Capture: User Voice as User Stories

When we observe a Job to be Done, we capture the **User Voice** as a **User Story**. User Stories are the primary feedback artifact throughout the lifecycle — not just at the beginning. They emerge continuously as users work with existing solutions.

> "As a vault maintainer, I want to see where each feature stands so that I can decide what to work on next."

User Stories are grounded in real usage. They carry the Actor's perspective, the context of the Domain, and the friction that triggered the observation.

### Define: PRD as Solution Boundary

When enough User Stories cluster around a common problem, we define a **Solution** and document it as a **PRD** (Product Requirements Document).

A PRD is **tool-agnostic** in its first draft. Before thinking about tabs, events, or adapters, we:

1. **Scope the Domain** — which bounded context does this problem live in?
2. **Define the Problem** — what breaks, who is affected, why it matters?
3. **Set Boundaries** — what's in scope, what's deliberately excluded?

The PRD defines a single solution for a single problem. It doesn't prescribe implementation yet — it captures *what* needs to change and *why*.

### Name: Solution as Product

As the PRD matures, we give the Solution a **Product Name**. This name becomes the anchor for all related artifacts. A PRD can be **attached to a Product** later — Products are the user-facing containers that group related solutions.

The relationship: **Products contain Features, Features are defined by PRDs, PRDs solve problems observed through User Stories.**

### Decompose: Features → PBIs → Use Cases

Once the PRD is scoped:

1. **Break into Features** — identify the distinct capabilities the solution provides
2. **Chunk into PBIs** (Product Backlog Items) — each PBI is a vertical slice of value that can be implemented, tested, and documented independently
3. **Design Use Cases** — each PBI drives one or more Use Cases that describe the user's interaction step by step
4. **Link User Stories** — each PBI and Use Case traces back to the User Stories that motivated it

### The Decomposition Hierarchy

```
Domain
└── Jobs to be Done (observed from Actors)
    └── User Stories (captured user voice)
        └── Solution / PRD (tool-agnostic problem boundary)
            └── Product (named solution, user-facing container)
                └── Features (distinct capabilities)
                    └── PBIs (vertical slices of value)
                        └── Use Cases + User Stories (interaction design)
```

### The Feedback Loop

The hierarchy is not a one-way waterfall. At every level, **User Stories flow back up**:

- Using the delivered Use Case generates new User Stories (friction, improvements, ideas)
- New stories may refine the PBI, expand the Feature, or spawn an entirely new PRD
- The Domain's documented knowledge grows with every cycle

This is why PRDs are **tokens through the process** — they carry context forward and accumulate knowledge as they advance through stages. And this is why **Sessions** matter: each session picks a PRD, advances it one step, and the work done is documented automatically. Knowledge builds over time.

---

## 11. Execution Recap — User Hub First Increment (2026-02-15)

This section traces how the **User Hub (PBI-001)** — the first domain Hub — moved through every lifecycle phase. It serves as a concrete reference for how the process works in practice.

### Feature Context

| | |
|---|---|
| **PRD** | [[Hubs PRD]] — Domain-Centric Workspaces |
| **PBI** | [[PBI-001 User Hub]] — Personal cockpit with dashboard, inbox, activity |
| **Phase** | Phase 3 of the Hubs implementation roadmap |
| **Prerequisites** | BaseHubView (Phase 1), System Hub migration (Phase 2), HubRegistry + Navigation (Phase 2.5) |

---

### Phase 1 — Feedback & Idea Intake

**What happened**: The Hubs concept emerged from observing that the Event Catalog and Data Exchange Hub were isolated views with duplicated shell logic. Users had no personal cockpit for cross-domain overview. These observations were captured as User Stories in the Hubs PRD problem statement.

**Artifact**: [[Hubs PRD]] Section 1 (Problem Statement), PBI-001 User Story ("As a knowledge worker, I want a personal cockpit hub...")

---

### Phase 2 — Discovery (Problem Space)

**What happened**: Problem analysis identified 4 user pains: no aggregated activity view, no inbox for actionable notifications, no "today" summary, must open multiple views to understand system state. Success outcomes were defined as measurable criteria.

**Artifact**: PBI-001 "User Pains" and "User Needs" sections

---

### Phase 3 — Solution Exploration

**What happened**: Alternative approaches considered:
1. Adapter-based (HubAdapter interface with getDashboardData/getEntities) — rejected as premature
2. Inheritance-based (BaseHubView abstract class with simpler abstract methods) — chosen
3. Cross-hub data: HubDashboardProvider interface + HubRegistry — lightweight enough to ship

**Artifact**: Pre-Feature Development Review (gap analysis), ADR-024

---

### Phase 4 — Solution Design + PRD Drafting

**What happened**: Hubs PRD drafted with full scope: shell layout, layouts, adapters, tab definitions, 4 PBIs, 7 TD prerequisites, 4-phase implementation plan. FRI scored at 23/35.

**Artifact**: [[Hubs PRD]] (all 13 sections), [[PBI-001 User Hub]] (functional + technical requirements)

---

### Phase 5 — PRD → Development Ready

**What happened**: Technical Review performed (result: Pass). FRI refined from 23 → 24. The Pre-Feature Development Review identified 5 gaps and 2 blockers. Blockers resolved (HubRegistry + hub.navigate). PRD moved to `approved` stage.

**Artifacts**:
- [[Technical Review 2026-02-15]] (pass)
- [[Pre-Feature Development Review 2026-02-15]] (gap analysis, 2 blockers identified)
- [[Three Amigos Review - HubRegistry + Navigation 2026-02-15]] (blockers resolved)

---

### Phase 6 — Delivery Planning + Chunking

**What happened**: PBI-001 was chunked into 3 increments:
1. **Increment 1**: Working shell — Dashboard (cross-hub summaries), Inbox (placeholder), Activity (live event feed)
2. **Increment 2**: Inbox population from subscription/ingestion events, persistent state
3. **Increment 3**: User preferences, activity filtering

An implementation plan was written listing all 11 files, their purpose, estimated LOC, and implementation order. The plan was reviewed and approved before any code was written.

**Artifact**: Implementation plan (approved in-session)

---

### Phase 7 — Iterative Implementation (Increment 1)

**What happened** (step by step):

| Step | Action | Files | LOC |
|------|--------|-------|-----|
| 1 | Created type definitions | `src/ui/userHub/types.ts` | 50 |
| 2 | Created hub provider | `src/domain/hub/UserHubProvider.ts` | 41 |
| 3 | Created dashboard component | `src/ui/userHub/UserHubDashboard.ts` | 98 |
| 4 | Created inbox component | `src/ui/userHub/UserHubInbox.ts` | 117 |
| 5 | Created activity component | `src/ui/userHub/UserHubActivity.ts` | 173 |
| 6 | Created view orchestrator | `src/ui/UserHubView.ts` | 138 |
| 7 | Added `ui.openUserHub` event | `src/infrastructure/ui/events.ts` | +3 |
| 8 | Added catalog entry | `src/infrastructure/events/catalog.ts` | +1 |
| 9 | Added UiCommandService listener | `src/infrastructure/ui/UiCommandService.ts` | +7 |
| 10 | Wired in main.ts (view, provider, ribbon, command) | `src/main.ts` | +8 |
| 11 | Full `npm run build` | — | green |

**Total**: 6 new files (648 LOC), 5 modified files (+43 LOC). Build pipeline passed on first attempt.

---

### Phase 8 — Review + Quality Assurance

**What happened** (step by step):

| Step | Action | Finding | Resolution |
|------|--------|---------|------------|
| 1 | Three Amigos Review (code quality) | 3 issues found: dead field, duplicated function, nested stat grids | All 3 fixed same session |
| 2 | Bug identified: stat card clicks | Stat cards navigated to hub dashboard, not specific tab | Added `tabId` to `HubStat`, populated in providers, passed in dashboard onClick |
| 3 | Test gap identified | No unit tests for new code | 5 test files created (63 tests): HubRegistry (11), providers (15), Activity (16), Inbox (11), Dashboard (10) |
| 4 | Test failures resolved | 3 failures: wrong category name, missing mock methods, invalid event type | Fixed: updated expected strings, added mock methods, corrected event payload |
| 5 | Full `npm run build` | — | 1,725 tests across 77 suites, green pipeline |
| 6 | TASM scoring | Initial: 30/35 (Strong) → Final: 33/35 (Excellent) | Scores raised after tests + bug fix resolved gaps |

**Artifacts**:
- [[Three Amigos Review - User Hub First Increment 2026-02-15]] (TASM 33/35)
- 5 test files under `tests/domain/hub/` and `tests/ui/userHub/`

---

### Phase 9 — Documentation + Publication

**What happened** (step by step):

| Step | Action | Artifact |
|------|--------|----------|
| 1 | Updated TD-27 (UI component testing) | Test counts, User Hub coverage section |
| 2 | Updated TD-30 (untested domain logic) | Hub domain coverage table |
| 3 | Updated TD-12 (wildcard listeners) | 7th listener added (UserHubActivity) |
| 4 | Updated Technical Debt Review summary | Scope metrics, wildcard count, test coverage |
| 5 | Created sitemap entry | `docs/sitemap/User Hub View.md` |
| 6 | Created 4 component docs | UserHubView, UserHubDashboard, UserHubInbox, UserHubActivity |
| 7 | Updated Hubs PRD | Stage `approved` → `in-progress`, FRI 24 → 31, checked off completed requirements, updated phases + stage history |

---

### Phase 10 — Post-Release Feedback Loop

**What happened**: Improvement backlog captured during review:
- **Open**: Optimize Activity state updates when tab isn't visible (performance)
- **Open**: Populate Inbox from subscription/ingestion events (PBI-001 increment 2)
- **Open**: Extract formatTimestamp to shared utility (refactor)
- **Open**: User preference for Activity cap size (feature)

These items feed into PBI-001 increment 2 planning (back to Phase 6).

---

### Key Learnings

1. **Plan before code**: The approved implementation plan prevented scope creep and made the Three Amigos review straightforward — reviewers could compare actual vs planned.
2. **Incremental delivery works**: Delivering a "working shell" with placeholder Inbox was the right call. The Activity tab provided immediate value, and the empty Inbox has a clear path to increment 2.
3. **Review catches real issues**: 3 code quality problems and 1 bug (stat card deep-linking) were found during review — none would have been caught by automated tests alone.
4. **Tests close the loop**: Adding tests after review (not during implementation) served as a verification pass. The 3 test failures revealed real mismatches (wrong category string, missing interface methods, invalid event type).
5. **Documentation alongside delivery**: Updating tech debt docs, sitemap, and component docs immediately after implementation keeps the knowledge base accurate. Deferring documentation creates debt that compounds.

---

## 12. Execution Recap — Documentation Sessions (PBI-002, 2026-02-16)

This section traces how **PBI-002 Documentation Sessions** — the second PBI of the Hubs feature — moved through lifecycle phases 7–10 across two increments. Phases 1–6 were shared with the parent Hubs PRD (already completed and documented in Section 11).

### Feature Context

| | |
|---|---|
| **PRD** | [[Hubs PRD]] — Domain-Centric Workspaces |
| **PBI** | [[PBI-002 Documentation Sessions]] — Time-boxed workflows with Pomodoro timer |
| **Phase** | Phase 4 of the Hubs implementation roadmap |
| **Prerequisites** | SessionService domain not yet implemented; User Hub already has Inbox + Preferences tabs from PBI-001 |

---

### Phase 7 — Iterative Implementation

PBI-002 was delivered across **five increments** (core delivery complete):

#### Increment 1: Session Domain Core

| Step | Action | Files | LOC |
|------|--------|-------|-----|
| 1 | Created session type definitions | `src/domain/session/types.ts` | ~70 |
| 2 | Created session events (19 events: 8 commands + 11 facts) | `src/domain/session/events.ts` | ~90 |
| 3 | Created SessionService with lifecycle state machine | `src/domain/session/SessionService.ts` | ~280 |
| 4 | Created pure helpers (formatDuration, computeRemainingMs, etc.) | `src/domain/session/helpers.ts` | ~50 |
| 5 | Registered 19 events in catalog | `src/infrastructure/events/catalog.ts` | +19 entries |
| 6 | Composed SessionEventMap into FlowtiEventMap | `src/infrastructure/events/events.ts` | +1 import |
| 7 | Wired SessionService in main.ts | `src/main.ts` | +8 |
| 8 | Full `npm run build` | — | green |

**Total**: 4 new files (~490 LOC), 3 modified files (+28 LOC). Build pipeline passed.

#### Increment 2: Sessions Tab + Session Creation UI

| Step | Action | Files | LOC |
|------|--------|-------|-----|
| 1 | Extended UserHubTab, UserHubState, UserHubComponentDeps | `src/ui/userHub/types.ts` | +30 |
| 2 | Created Sessions tab component (master list, detail panel, timer, actions) | `src/ui/userHub/UserHubSessions.ts` | 316 |
| 3 | Wired sessions tab in UserHubView (9 event listeners, timer tick, refreshSessionState) | `src/ui/UserHubView.ts` | 259→273 |
| 4 | Added active session card + "Sessions" quick action to dashboard | `src/ui/userHub/UserHubDashboard.ts` | +35 |
| 5 | Created NewSessionModal (title, type dropdown, duration dropdown) | `src/ui/modals.ts` | +70 |
| 6 | Wired openNewSessionModal in buildComponentDeps | `src/ui/UserHubView.ts` | +10 |
| 7 | Passed sessionService to UserHubView constructor | `src/main.ts` | +1 |
| 8 | Full `npm run build` | — | green |

**Total**: 1 new file (316 LOC), 5 modified files (+146 LOC). Build pipeline passed.

#### Increment 3: Session Templates, Rerun & UX Polish

| Step | Action | Files | LOC |
|------|--------|-------|-----|
| 1 | Extended session types with `SessionTemplate`, `MAX_TEMPLATES`, optional `savedTemplates` on `SessionState` | `src/domain/session/types.ts` | +20 |
| 2 | Extended `session.loaded` payload with `savedTemplates` | `src/domain/session/events.ts` | +5 |
| 3 | Added 7 template/rerun methods to SessionService + `generateRerunTitle` helper + backward compat migration | `src/domain/session/SessionService.ts` | +85 |
| 4 | Created `SaveTemplateModal` + extended `NewSessionModal` with template chooser dropdown + prefill | `src/ui/modals.ts` | +85 |
| 5 | Added `openSaveTemplateModal` to `UserHubComponentDeps` | `src/ui/userHub/types.ts` | +3 |
| 6 | Added Rerun/Save Template buttons, template list in empty detail, actions moved under header, Start hidden when active, margin-bottom on list rows | `src/ui/userHub/UserHubSessions.ts` | +65 |
| 7 | Wired `openSaveTemplateModal`, pass templates to `openNewSessionModal`, dashboard timer tick | `src/ui/UserHubView.ts` | +15 |
| 8 | Added `updateTimerDisplay()`, contextual Pause/Resume buttons, Paused badge | `src/ui/userHub/UserHubDashboard.ts` | +30 |
| 9 | Full `npm run build` | — | green |

**Total**: 0 new files, 8 modified files (+308 LOC). Build pipeline passed.

#### Increment 4: Focus File & Vault File Picker

| Step | Action | Files | LOC |
|------|--------|-------|-----|
| 1 | Added `focusFile: string \| null` on Session, `focusFile?: string` on SessionTemplate | `src/domain/session/types.ts` | +5 |
| 2 | Updated `createSession()` to accept optional `focusFile` | `src/domain/session/helpers.ts` | +3 |
| 3 | Threaded `focusFile` through `handleCreate()`, `rerunSession()`, `createFromTemplate()`, `saveTemplateFromSession()` | `src/domain/session/SessionService.ts` | +15 |
| 4 | Added focus file text input + "Browse" button on NewSessionModal | `src/ui/modals.ts` | +25 |
| 5 | Created `VaultFilePickerModal` using `FuzzySuggestModal` | `src/ui/FilePickerModal.ts` | 22 |
| 6 | Added clickable focus file link in session detail panel | `src/ui/userHub/UserHubSessions.ts` | +15 |
| 7 | Added `openFile(path)` callback to `UserHubComponentDeps` | `src/ui/userHub/types.ts` | +3 |
| 8 | Wired `openFile` dep via `app.workspace.openLinkText()` | `src/ui/UserHubView.ts` | +5 |
| 9 | Full `npm run build` | — | green |

**Total**: 1 new file (22 LOC), 7 modified files (+71 LOC). Build pipeline passed.

#### Increment 5: Session Timeline & Pause Duration Tracking

| Step | Action | Files | LOC |
|------|--------|-------|-----|
| 1 | Added `SessionTimelineAction`, `SessionTimelineEntry`, `PauseSegment`, `TimelineSummary` types, `timeline` on Session | `src/domain/session/types.ts` | +30 |
| 2 | Added 6 pure functions: `computePauseSegments()`, `computeTotalPauseMs()`, `computeWallClockMs()`, `computeActiveTimeMs()`, `computeTimelineSummary()`, `formatDurationHuman()` | `src/domain/session/helpers.ts` | +80 |
| 3 | Added `timeline.push()` in `handleStart()`, `handlePause()`, `handleResume()`, `completeSession()` + backward compat in `load()` | `src/domain/session/SessionService.ts` | +15 |
| 4 | Added `renderTimeBreakdown()` (stat pills), `renderStatPill()`, `renderTimeline()` (chronological action log with icons) | `src/ui/userHub/UserHubSessions.ts` | +60 |
| 5 | Full `npm run build` | — | green |

**Total**: 0 new files, 4 modified files (+185 LOC). Build pipeline passed.

#### Increment 6: Goals & Notes Domain

| Step | Action | Files | LOC |
|------|--------|-------|-----|
| 1 | Added `SessionGoal` interface, `goals: SessionGoal[]` on Session, `goals?: string[]` on SessionTemplate | `src/domain/session/types.ts` | +12 |
| 2 | Added 8 new events (3 goal commands, 3 goal state, notes update/updated) + `goals?` on `session.create` | `src/domain/session/events.ts` | +16 |
| 3 | Added `createGoal()` pure helper + `goals: []` in `createSession()` | `src/domain/session/helpers.ts` | +10 |
| 4 | Added 4 handlers (`handleGoalAdd`, `handleGoalToggle`, `handleGoalRemove`, `handleNotesUpdate`) + threading through all 4 creation paths + backward compat | `src/domain/session/SessionService.ts` | +65 |
| 5 | Added 8 catalog entries for new events | `src/infrastructure/events/catalog.ts` | +8 entries |
| 6 | Full `npm run build` | — | green |

**Total**: 0 new files, 5 modified files (+103 LOC). Build pipeline passed.

---

### Phase 8 — Review + Quality Assurance

| Step | Action | Finding | Resolution |
|------|--------|---------|------------|
| 1 | Code review: SessionService lifecycle | Clean — state machine transitions correct, timer uses Date math (survives window minimize) | N/A |
| 2 | Code review: UserHubSessions | Timer optimization pattern correct (direct DOM update, no scheduleRender) | N/A |
| 3 | TSC type error identified | `NewSessionModal.onSubmit` passes `type` as `string`, but `session.create` expects `SessionType` | Fixed with `type as SessionType` cast (safe: dropdown only offers valid `SESSION_TYPES`) |
| 4 | Test coverage: Increment 1 | SessionService.test.ts created | 60 tests: lifecycle, timer, artifacts, persistence, edge cases |
| 5 | Test coverage: Increment 2 | UserHubSessions.test.ts created + UserHubDashboard.test.ts updated | 35 session tests (master, detail, actions, timer display, new session buttons) + 5 dashboard tests |
| 6 | Test coverage: Mock updates | 3 test files (Inbox, Preferences, Dashboard) missing `openNewSessionModal` mock | Updated all 3 with `openNewSessionModal: vi.fn()` |
| 7 | Full `npm run build` | — | 1,887 tests across 82 suites, green pipeline |

**Increment 3 review:**

| Step | Action | Finding | Resolution |
|------|--------|---------|------------|
| 1 | Test failure: 4 service tests | Tests used event handler approach that couldn't capture `beforeEach`-created sessions — handler registered after `session.created` already fired | Fixed by using `getSessions().find()` instead of event handler mock |
| 2 | UX review: Detail panel actions | Action buttons placed at bottom of detail (after info/artifacts) — hard to reach | Moved actions directly under header for easy access |
| 3 | UX review: Start button | Start button shown on prepared sessions even when another session is active — misleading since service rejects the action | Start button hidden when `state.activeSession` is non-null |
| 4 | UX review: List border clipping | Active session's 3px accent border clipped by adjacent rows | Added `marginBottom: 2px` to all list rows |
| 5 | Dashboard review: Timer static | Dashboard session card timer rendered once at render time — never updated on tick | Added `updateTimerDisplay()` method, wired to `session.timer.tick` in UserHubView |
| 6 | Dashboard review: Paused session | Dashboard always showed Pause + Complete — no Resume for paused sessions | Made buttons contextual: active → Pause/Complete, paused → Resume/Complete. Added Paused badge and muted border |
| 7 | Test coverage: Increment 3 | 47 new tests across 3 files | SessionService.test.ts (+30), UserHubSessions.test.ts (+12), UserHubDashboard.test.ts (+5) |
| 8 | Mock updates | 2 test files missing `openSaveTemplateModal` mock | Updated Inbox + Preferences test deps |
| 9 | Full `npm run build` | — | 1,938 tests across 82 suites, green pipeline |

**Artifacts**:
- `tests/domain/session/SessionService.test.ts` (60 → 90 tests)
- `tests/ui/userHub/UserHubSessions.test.ts` (35 → 47 tests)
- `tests/ui/userHub/UserHubDashboard.test.ts` (31 → 36 tests)
- 2 modified test files (mock updates)

**Increments 4-5 review (combined: Focus File and Timeline):**

| Step | Action | Finding | Resolution |
|------|--------|---------|------------|
| 1 | Code review: Focus file threading | `focusFile` correctly threaded through all 4 creation paths (create, rerun, template save, create-from-template) | N/A — clean |
| 2 | Code review: VaultFilePickerModal | 22 LOC using `FuzzySuggestModal` — minimal surface, correct API usage | N/A |
| 3 | Code review: Timeline types | 4 new types + `timeline[]` on Session — clean, no redundancy with existing `elapsedBeforePauseMs` (complementary, not duplicate) | N/A |
| 4 | Code review: Pure helpers | 6 new functions in helpers.ts — all pure, no side effects, trivially testable | N/A |
| 5 | Code review: Backward compat | `load()` initializes `timeline` to `[]` for legacy sessions, matching pattern from `savedTemplates` compat | N/A |
| 6 | Test coverage: Increment 4 | 9 tests added | SessionService.test.ts (+5), helpers.test.ts (+1), UserHubSessions.test.ts (+3) |
| 7 | Test coverage: Increment 5 | 35 tests added | helpers.test.ts (+20), SessionService.test.ts (+9), UserHubSessions.test.ts (+6) |
| 8 | Mock updates | `openFile: vi.fn()` added to 2 test files (Inbox, Preferences), `timeline: []` added to dashboard `makeSession` | Updated |
| 9 | TASM scoring | Combined review: 34/35 (Excellent) | Documented in [[Three Amigos Review - Focus File and Timeline 2026-02-16]] |
| 10 | Full `npm run build` | — | 1,988 tests across 82 suites, green pipeline |

**Artifacts**:
- `tests/domain/session/SessionService.test.ts` (90 → 104 tests)
- `tests/domain/session/helpers.test.ts` (+21 tests)
- `tests/ui/userHub/UserHubSessions.test.ts` (47 → 56 tests)
- `tests/ui/userHub/UserHubDashboard.test.ts` (makeSession updated)

**Increment 6 review (Goals & Notes Domain):**

| Step | Action | Finding | Resolution |
|------|--------|---------|------------|
| 1 | Code review: SessionGoal type | Clean — 4 fields, nullable `completedAt` for toggle semantics | N/A |
| 2 | Code review: Goal handlers | 4 handlers follow existing pattern (find session → validate → mutate → save → emit) | N/A |
| 3 | Code review: Goals threading | `goals` threaded through all 4 creation paths (handleCreate, rerunSession, createFromTemplate, saveTemplateFromSession) — consistent with focusFile pattern | N/A |
| 4 | Code review: Backward compat | `s.goals ??= []` in load() — matches existing pattern for timeline and savedTemplates | N/A |
| 5 | Build error: Missing catalog entries | 8 new events lacked catalog entries (TS1360) | Added 8 entries with correct direction types |
| 6 | Build error: Invalid EventDirection | Used `"UI → SessionService"` — not in EventDirection union | Changed to `"View → Plugin"` (commands) and `"Service → Listeners"` (state) |
| 7 | Build error: Missing `goals` in makeSession | 4 test files' `makeSession` helpers missing required `goals` field | Added `goals: []` to all 4 makeSession functions |
| 8 | Test coverage: Increment 6 | 29 new tests across 2 files | SessionService.test.ts (+25: goal CRUD, notes, create-with-goals, rerun-with-goals, template-with-goals, backward compat), helpers.test.ts (+4: createGoal, createSession goals) |
| 9 | Full `npm run build` | — | 2,017 tests across 82 suites, green pipeline |

**Artifacts**:
- `tests/domain/session/SessionService.test.ts` (104 → 112 tests, +8 test sections)
- `tests/domain/session/helpers.test.ts` (42 → 46 tests)
- 4 test files updated with `goals: []` in makeSession helpers

---

### Phase 9 — Documentation + Publication

| Step | Action | Artifact |
|------|--------|----------|
| 1 | Updated Frontend Architecture.md | NewSessionModal in modals table, UserHubView LOC 259→273, UserHubSessions description, test counts 1,887/82 |
| 2 | Updated component doc: UserHubSessions.md | "New" button in header, "New Session" button in empty state, openNewSessionModal dep |
| 3 | Updated component doc: UserHubView.md | NewSessionModal + SESSION_TYPES dependencies, session.create event emission |
| 4 | Created component doc: NewSessionModal.md | 3-field modal: title, type, duration; wired via openNewSessionModal callback |
| 5 | Updated sitemap: User Hub View.md | "Create a new documentation session" use case added |
| 6 | Updated Hubs PRD | Increment 2 description expanded (NewSessionModal, LOC counts, test counts), stage history entry updated |
| 7 | Updated PBI-002 backlog item | Increment 2 file list updated with modals.ts, types.ts changes, test counts |
| 8 | Updated Development Lifecycle | Increment 3 added to Phases 7–10 |
| 9 | Updated PBI-002 backlog item | Increment 3 file list, acceptance criteria, test counts (1,938/82) |
| 10 | Updated Hubs PRD | Increments 4-5 descriptions (Focus File, Timeline), test counts updated to 1,988/82 |
| 11 | Updated PBI-002 backlog item | Increments 4-5 file lists, modified files, test counts |
| 12 | Created increment docs | [[Phase 4 Inc 4 - Focus File]], [[Phase 4 Inc 5 - Timeline and Pause Tracking]] |
| 13 | Updated Development Lifecycle | Increments 4-5 added to Phases 7–10 |
| 14 | Updated Inc 6 increment doc | Stage: done, date: 2026-02-16, tests_added: 29, tests_total: 2017, acceptance criteria checked off |
| 15 | Updated PBI-002 | Inc 6 section from PLANNED to done, acceptance criteria checked (goals, notes, threading), note updated (6 done, 5 planned) |
| 16 | Updated Hubs PRD | Inc 6 description expanded, goal/notes events moved to "implemented", test counts 2,017/82, stage history entry added, product backlog table (6 done, 5 planned) |
| 17 | Updated Development Lifecycle | Increment 6 added to Phases 7–10 |

---

### Phase 10 — Post-Release Feedback Loop

**Improvement backlog captured during review:**
- **Open**: `session_focus` layout with dedicated workspace regions (PBI-002 remaining work — header, timer, workspace, notes, artifacts regions)
- **Open**: Session artifacts persist as separate markdown files (currently tracked in-memory)
- **Closed** (Increment 6): Session notes mutation events → `session.notes.update/updated` + `handleNotesUpdate`
- **Closed** (Increment 3): Session creation from Dashboard quick action → addressed via template chooser in NewSessionModal
- **Closed** (Increment 3): Rerun completed sessions without re-entering configuration → `rerunSession()` + auto-select
- **Closed** (Increment 3): Save session configs as reusable templates → `saveTemplateFromSession()` + template list in detail panel
- **Closed** (Increment 3): Dashboard timer not updating → `updateTimerDisplay()` wired to tick events
- **Closed** (Increment 3): Dashboard can't pause/resume → contextual buttons based on session status

**New feedback cycle — Session Focus Tools (post-Increment 5):**

After delivering 5 increments, a significant gap emerged: sessions treat all focus files identically. A `.canvas` file, a `.csv` file, and a `.md` file with frontmatter all show the same plain link. Real-world sessions need contextual tooling based on what the user is working on. Additionally, a single focus file is insufficient — users need companion files, follow-up sessions, and permanent records.

These observations were captured as **Session Focus Tools** — 6 new requirements added to the Hubs PRD and PBI-002:
1. **Focus File Type Detection** — detect file type and provide contextual tools
2. **Focus File Profiles** — 6 categories (markdown, canvas, pdf, image, csv, unknown) with tools per category
3. **Context Files** — attach companion files to sessions as a working set
4. **Session Spawning** — create follow-up sessions inheriting focus + context
5. **Guiding Questions** — orient users toward incremental improvement
6. **Session Document** — generate markdown summary on session completion

This feedback loop triggered a return to **Phase 6 (Delivery Planning)** — the new requirements were chunked into 3 increments:

| Increment | Scope | Est. LOC | Est. Tests |
|-----------|-------|----------|------------|
| **9: Focus File Profiles & Context Files** | Types, detection, context CRUD, events, backward compat | ~140 | ~31 |
| **10: Session Spawning & Guiding Questions** | Spawn logic, inheritable context, guiding questions | ~120 | ~18 |
| **11: Session Document Generation** | Markdown generation on completion, configurable folder | ~100 | ~15 |

**Artifacts**: [[Phase 4 Inc 9 - Focus File Profiles and Context Files]], [[PBI-002 Documentation Sessions]] (updated with Inc 9-11 planned sections + 6 new acceptance criteria)

These items feed into PBI-002's remaining increments (7-8: Workspace, Preparation) and the new Session Focus Tools increments (9-11). Increment 6 (Goals & Notes) was completed on 2026-02-16.

---

### Key Learnings

1. **Domain-first, UI-second**: Building the SessionService domain in increment 1 (with 60 tests) before any UI in increment 2 meant the UI layer was pure presentation — no business logic to debug. The service contract was stable by the time components consumed it.
2. **Timer optimization matters**: Using direct DOM updates for 1-second timer ticks (`updateTimerDisplay()`) instead of full re-renders prevents UI jank. This pattern should be applied to any future real-time display updates — including dashboard callouts (Increment 3 fix).
3. **Deps callback pattern for modals**: Rather than having components import modal classes directly, the `openNewSessionModal()` callback in `UserHubComponentDeps` keeps components testable — tests mock it as `vi.fn()` with zero modal dependencies.
4. **Type safety at boundaries**: The TSC error with `SessionType` cast at the modal→event boundary was a valid catch. Modal callbacks return `string` (generic dropdown), but domain events expect typed unions. The `as SessionType` cast is safe because the dropdown is populated from `SESSION_TYPES`, but this boundary deserves attention in any future modal → event wiring.
5. **Test mock maintenance**: Adding a new field to `UserHubComponentDeps` required updating 3 test files' mock factories. This is a known cost of the deps injection pattern — worth it for testability, but mock factories should stay in sync.
6. **Direct CRUD for configuration data**: Template management uses direct methods (no events) — matching the DataExchange saved config pattern. Configuration artifacts (templates, saved configs) don't need event-driven CRUD; they are not domain actions.
7. **Reuse existing pipelines for new features**: Both `rerunSession()` and `createFromTemplate()` call `handleCreate()` internally. This reuses the existing creation pipeline (eviction, persistence, `session.created` event) with zero duplication.
8. **UI should reflect service constraints**: The service already rejected starting a session when another is active, but the UI still showed the Start button — misleading. UI must mirror domain constraints to prevent confusion.
9. **Thread new fields through all creation paths**: When `focusFile` was added (Inc 4), it required changes in `handleCreate()`, `rerunSession()`, `createFromTemplate()`, and `saveTemplateFromSession()`. This 4-method threading pattern recurs for every new Session field — a checklist for future additions (context files, goals, etc.).
10. **Pure helpers scale safely**: Adding 6 pure functions (Inc 5) with 20 tests required zero changes to existing code. Pure functions are the cheapest code to add — no mocking, no state, no side effects. When a domain grows, reach for pure helpers first.
11. **Backward compat is the tax on persisted state**: Both Inc 4 (`focusFile`) and Inc 5 (`timeline`) needed backward-compat patches in `load()`. Every new field on a persisted entity requires a migration guard. This is a structural cost of using TypedStorage — plan for it.
12. **Feedback loops generate the best requirements**: The Session Focus Tools (Inc 9-11) weren't imagined during initial PRD drafting. They emerged from 5 increments of real usage — observing that a plain focus file link is insufficient. The lifecycle's Phase 10 → Phase 6 loop is how the best features surface.
13. **Domain-only increments build confidence**: Inc 6 (Goals & Notes) touched zero UI code — types, events, service, helpers, catalog, and tests only. This made the increment small, focused, and easy to review. When UI is built later (Inc 7-8), the domain contract is already stable and tested.

---

## 13. Appendix

- [[Testplan and Teststrategy]]
- [[Three Amigos Session Template]]
- [[PRD Template]]
- [[Feature Lifecycle PRD]]


