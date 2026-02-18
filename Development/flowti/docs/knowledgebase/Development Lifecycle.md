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

How to push a single increment trough the process is described in our [[Increment Lifecycle]].

Before: [[Idea Lifecycle]]

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

> Detailed guidance: [[Delivery Planning]]

**Goal**
- break PRD into vertical slices / manageable increments

**Activities**
- define increments by value (domain-first, UI-second — [[L-01 Domain-first UI-second]])
- identify dependencies between increments
- define test coverage per slice
- define doc updates per slice
- bundle small features by theme ([[L-15 Bundle related small features into cohesive increments]])

**Outputs**
- increment plan (slices) — each slice has:
  - scope, acceptance criteria, test intent, documentation intent, estimated LOC/tests
- increment docs created from [[Increment Template]]

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

PBI-002 was delivered across **ten increments** (core delivery complete, 2 planned):

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

#### Increment 7: SessionWorkspaceView

| Step | Action | Files | LOC |
|------|--------|-------|-----|
| 1 | Created standalone `SessionWorkspaceView` extending `ItemView` (header, timer, goals, notes, focus file, artifacts, empty state, 10 event subscriptions) | `src/ui/SessionWorkspaceView.ts` | 463 |
| 2 | Added import, `registerView()`, and `addCommand("flowti:open-session-workspace")` | `src/main.ts` | +13 |
| 3 | Full `npm run build` | — | green |

**Total**: 1 new file (463 LOC), 1 modified file (+13 LOC). Build pipeline passed.

#### Increment 8: Session Workspace Enrichment

| Step | Action | Files | LOC |
|------|--------|-------|-----|
| 1 | Added `SessionLink` type, `links`, `notesFile`, `canvasFile` on Session, `SESSION_NOTES_FOLDER` constant | `src/domain/session/types.ts` | +15 |
| 2 | Added 10 new events (link, duration, notesFile, canvasFile commands + state) | `src/domain/session/events.ts` | +32 |
| 3 | Added `generateSessionSummary()` pure function + `links: []`, `notesFile: null`, `canvasFile: null` defaults | `src/domain/session/helpers.ts` | +82 |
| 4 | Added 5 handlers (link add/remove, duration, notesFile, canvasFile), auto-set `notesFile`, `getCurrentSession()`, `workspaceSessionId`, backward compat, template unlock | `src/domain/session/SessionService.ts` | +137 |
| 5 | Added 10 new catalog entries | `src/infrastructure/events/catalog.ts` | +10 |
| 6 | Added `registerSessionFileMenu()` ("Add to Session" + "Create New Session"), `writeSessionSummary()` on completion | `src/main.ts` | +79 |
| 7 | Extended workspace: links section, notes file, canvas create/link, duration editor, save template, clickable artifacts, workspace tracking, 5 new event subscriptions | `src/ui/SessionWorkspaceView.ts` | 463→737 |
| 8 | Added 4 new events in re-render array, `openSessionWorkspace` dep | `src/ui/UserHubView.ts` | +20 |
| 9 | Made active session clickable (opens workspace) | `src/ui/userHub/UserHubDashboard.ts` | +5 |
| 10 | Added "Open Workspace" button, save template all statuses, links section, clickable artifacts | `src/ui/userHub/UserHubSessions.ts` | +163 |
| 11 | Added `openSessionWorkspace` callback to deps | `src/ui/userHub/types.ts` | +4 |
| 12 | Full `npm run build` | — | green |

**Total**: 0 new files, 11 modified files (+821 LOC). Build pipeline passed. 2,125 tests across 83 suites.

#### Increment 9: Preparation Flow & Auto-Open

| Step | Action | Files | LOC |
|------|--------|-------|-----|
| 1 | Added `"vault-hygiene"` as first SessionType and SESSION_TYPES entry | `src/domain/session/types.ts` | +2 |
| 2 | Added `"vault-hygiene"` label to SESSION_TYPE_LABELS | `src/ui/userHub/types.ts` | +1 |
| 3 | Added goals repeater (Enter-to-add, x-to-remove) + title validation error to NewSessionModal | `src/ui/modals.ts` | +58/-9 |
| 4 | Updated onSubmit callback to pass goals parameter | `src/ui/UserHubView.ts` | +2/-2 |
| 5 | Updated context menu onSubmit to pass goals parameter | `src/main.ts` | (part of step 7) |
| 6 | Added `SessionFrontmatter` interface, `generateSessionFrontmatter()`, `serializeFrontmatter()`, `parseFrontmatter()`, `generateSessionSummaryBody()`, `mergeSessionNotes()`, updated `generateSessionSummary()` | `src/domain/session/helpers.ts` | +140/-27 |
| 7 | Added auto-open workspace on `session.started` via `crossCuttingListeners`, updated `writeSessionSummary()` to merge instead of overwrite | `src/main.ts` | +25/-5 |
| 8 | Added dedicated `adjacentLeaf` tracking via `getLeaf("split")`, `openInAdjacentLeaf()` method replacing 6 direct `openLinkText` calls, seed notes with `generateSessionSummary()` | `src/ui/SessionWorkspaceView.ts` | +25/-8 |
| 9 | Full `npm run build` | — | green |

**Total**: 0 new files, 7 modified files (+202 LOC net). Build pipeline passed. 2,141 tests across 84 suites.

#### Increment 10: Sidebar Workspace & Activity Consolidation

> **Cross-PBI:** This increment also delivers [[PBI-SW-001 Activity Log]] and [[PBI-SW-002 Context Bindings]] from the [[Session Workspaces PRD]].

| Step | Action | Files | LOC |
|------|--------|-------|-----|
| 1 | Added `SessionActivity`, `SessionActivityAction`, `MAX_SESSION_ACTIVITY`, `ACTIVITY_DEDUP_WINDOW_MS`, `SessionContextBinding`, `ContextBindingType`, `MAX_CONTEXT_BINDINGS`, `BINDING_TYPES` types; added `activity`, `activityFilter`, `contextBindings` on Session | `src/domain/session/types.ts` | +45 |
| 2 | Added 9 new events: activity (2), context binding (6), paths (1) | `src/domain/session/events.ts` | +28 |
| 3 | Added `isExcluded()` pure function for composable folder filtering (ADR-026) | `src/domain/session/helpers.ts` | +12 |
| 4 | Added `onActivityEvent()` (activity tracking with dedup + folder filtering), `handleContextBind/Unbind/ChangeType()`, `updateActivityFilter()`, `handleFileRenamed/handleFolderRenamed()` (path reconciliation with `session.paths.updated` emission), backward compat for activity/activityFilter/contextBindings, links→contextBindings migration | `src/domain/session/SessionService.ts` | +180 |
| 5 | Added 9 catalog entries for new events | `src/infrastructure/events/catalog.ts` | +9 entries |
| 6 | Added `sessionActivityFilterGlobal: string[]` setting | `src/domain/settings/settings.ts` | +3 |
| 7 | Extended workspace: removed artifacts section, added unified activity log with filters, added context bindings section with type cycling and file/folder reveal, added sidebar/tab toggle, added `setState()`/`getState()` for session switching, `.ft-section` on all sections, Start button guard, cross-view lifecycle sync | `src/ui/SessionWorkspaceView.ts` | 737→1017 (+280 net) |
| 8 | Added `openSessionWorkspaceInSidebar()`, `flowti:open-session-workspace-sidebar` command, start-from-sidebar guard, `registerSessionFileMenu()` extended with TFolder support | `src/main.ts` | +40 |
| 9 | Updated `openSessionWorkspace` with location parameter, singleton sidebar pattern, `setTimeout(0)` deferral | `src/ui/UserHubView.ts` | +25 |
| 10 | "Sidebar" button for prepared/active/paused sessions | `src/ui/userHub/UserHubSessions.ts` | +12 |
| 11 | Updated `openSessionWorkspace` signature with location parameter | `src/ui/userHub/types.ts` | +1 |
| 12 | Added `.ft-section`, `.ft-section-flush`, `:last-child` rule, dashboard padding fix | `styles.css` | +12 |
| 13 | Full `npm run build` | — | green |

**Total**: 0 new files, 11 modified files (+310 LOC net). Build pipeline passed. 2,177 tests across 84 suites.

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

**Increment 7 review (SessionWorkspaceView):**

| Step | Action | Finding | Resolution |
|------|--------|---------|------------|
| 1 | Code review: SessionWorkspaceView layout | Clean — 6 sections rendered in correct order: header, timer, goals, notes, focus file, artifacts | N/A |
| 2 | Code review: Event subscriptions | 10 subscriptions covering timer tick, lifecycle, goals CRUD, notes, artifacts, delete — all properly scoped to current session via ID check | N/A |
| 3 | Code review: Timer incremental update | `session.timer.tick` updates `timerEl.textContent` directly — no full re-render, matching UserHubSessions pattern | N/A |
| 4 | Code review: Notes debounce | 500ms debounce via `setTimeout`/`clearTimeout` with cleanup in `onClose()` — prevents orphaned timers | N/A |
| 5 | Build error: Unused import | `SessionArtifact` imported but not used in type annotations | Removed import |
| 6 | Build error: Invalid `placeholder` property | `createEl("input", { placeholder })` — Obsidian's DomElementInfo doesn't include `placeholder` | Set `input.placeholder` directly after creation |
| 7 | Test coverage: Increment 7 | 36 new tests in new file | SessionWorkspaceView.test.ts: view metadata (4), empty state (1), header (6), timer (3), goals (9), notes (3), focus file (3), artifacts (3), cleanup (2), lifecycle (2) |
| 8 | Full `npm run build` | — | 2,053 tests across 83 suites, green pipeline |

**Artifacts**:
- `tests/ui/SessionWorkspaceView.test.ts` (36 tests, 631 LOC — new file)

**Increment 8 review (Session Workspace Enrichment):**

| Step | Action | Finding | Resolution |
|------|--------|---------|------------|
| 1 | Code review: SessionLink type | Clean — 2 fields (path, addedAt), deduplication by path in handleLinkAdd | N/A |
| 2 | Code review: Link handlers | Follow existing pattern (find session → validate → mutate → save → emit) | N/A |
| 3 | Code review: generateSessionSummary | Pure function — covers all session fields (goals, links, artifacts, timeline, time summary, notes, canvas wikilink) | N/A |
| 4 | Code review: writeSessionSummary | Creates folder + file if missing, overwrites on re-completion, error handling via errorService | N/A |
| 5 | Code review: Canvas creation | Creates `.canvas` JSON file, emits `session.canvasFile.set`, appends `![[canvas]]` embed to notes file | N/A |
| 6 | Code review: getCurrentSession | Returns active session or workspace target — context menu uses this for "Add to Session" | N/A |
| 7 | Code review: Template unlock | Status check removed from saveTemplateFromSession — allows save from any status | N/A |
| 8 | Code review: Backward compat | 3 new fields (links, notesFile, canvasFile) all get migration guards in load() | N/A |
| 9 | Test coverage: Increment 8 | 72 new tests across 4 files | SessionService.test.ts (+33), helpers.test.ts (+11), UserHubSessions.test.ts (+25), other mock updates (+3) |
| 10 | Full `npm run build` | — | 2,125 tests across 83 suites, green pipeline |
| 11 | TASM scoring | 34/35 (Excellent) — score holds at plateau for third time in four reviews | Documented in [[Three Amigos Review - Session Workspace Enrichment 2026-02-16]] |

**Artifacts**:
- `tests/domain/session/SessionService.test.ts` (112 → 145 tests)
- `tests/domain/session/helpers.test.ts` (46 → 57 tests)
- `tests/ui/userHub/UserHubSessions.test.ts` (56 → 81 tests)
- 4 test files updated with `canvasFile: null` and `openSessionWorkspace: vi.fn()` in mock factories

**Increment 9 review (Preparation Flow & Auto-Open):**

| Step | Action | Finding | Resolution |
|------|--------|---------|------------|
| 1 | Code review: Goals repeater | Clean — Enter-to-add, x-to-remove, template goals carry-through, empty goals filtered | N/A |
| 2 | Code review: Title validation | Inline error div with CSS variables, auto-hides on input | N/A |
| 3 | Code review: Auto-open workspace | Correctly wired in main.ts (not UserHubView) — main.ts always active | N/A |
| 4 | Code review: Adjacent leaf management | 3 iterations needed: findSibling → focus fix → dedicated tracking. Final solution clean (11 LOC) | Adjacent leaf approach is Obsidian API workaround — documented |
| 5 | Code review: Session notes merge | Pure functions in helpers.ts. parseFrontmatter simplified (key:value only). mergeSessionNotes preserves user content via marker | parseFrontmatter noted as limited (no arrays/nested) — sufficient for session notes |
| 6 | Code review: writeSessionSummary | Now reads existing file and merges instead of overwriting. Error handling preserved. | N/A |
| 7 | Code review: vault-hygiene type | Added to union, SESSION_TYPES, SESSION_TYPE_LABELS — all three locations | N/A |
| 8 | Test coverage: Increment 9 | 18 new tests across 2 files | helpers.test.ts (+13: frontmatter ×3, body ×5, merge ×5), SessionWorkspaceView.test.ts (+5: mock updates) |
| 9 | Full `npm run build` | — | 2,141 tests across 84 suites, green pipeline |
| 10 | TASM scoring | 32/35 (Excellent) — slight dip from 34, within range | Documented in [[Three Amigos Review - Preparation Flow 2026-02-16]] |

**Artifacts**:
- `tests/domain/session/helpers.test.ts` (57 → 70 tests)
- `tests/ui/SessionWorkspaceView.test.ts` (36 → 41 tests)

**Increment 10 review (Sidebar Workspace & Activity Consolidation):**

| Step | Action | Finding | Resolution |
|------|--------|---------|------------|
| 1 | Code review: Activity consolidation | Artifacts section removed; `session.artifact.added` redirected to `renderActivityList()`. Unified activity log with 5 action types. ADR-025 superseded. | N/A — clean design decision |
| 2 | Code review: Folder filtering | `isExcluded()` pure function (ADR-026), global + per-session composition, prefix matching. 12 LOC, zero dependencies. | N/A |
| 3 | Code review: Context bindings | 5 types (`file\|folder\|domain\|feature\|product`), click-to-cycle, folder reveal via `revealInFileExplorer()`, max 10 per session | N/A |
| 4 | Code review: Sidebar singleton | `getLeavesOfType().find(l => l.getRoot() === rightSplit)` + `revealLeaf()`. `setTimeout(0)` deferral prevents click lag. | N/A |
| 5 | Code review: Path reconciliation | `handleFileRenamed` and `handleFolderRenamed` track `affectedIds` Set, emit `session.paths.updated` only for affected sessions. Activity log excluded (historical). | N/A |
| 6 | Code review: File collision fix | Short ID suffix `(abc123)` on notes/canvas file paths. `try-catch` on `vault.create()`. | N/A |
| 7 | Build error: `"vault"` not assignable to `FileChangeSource` | Tests used `source: "vault"` but type is `"user" \| "obsidian" \| "sync" \| "plugin" \| "unknown"` | Fixed: replaced all `"vault"` with `"obsidian"` in tests |
| 8 | Test error: UI selector mismatch | Test used `.ft-focusfile-link` but actual class is `.ft-session-workspace-focus` | Fixed: updated selector to match implementation |
| 9 | Build error: Missing catalog entry | `session.paths.updated` missing from `catalog.ts` (TS1360: `satisfies Record<>`) | Fixed: added catalog entry with `tags: ["system"]` |
| 10 | Test coverage: Increment 10 | 57 new tests across 2 files | SessionService.test.ts (+36: activity tracking, folder filtering, context binding CRUD, file/folder rename path reconciliation with event assertions), SessionWorkspaceView.test.ts (+21: activity section, context bindings, sidebar mocks, `session.paths.updated` re-render) |
| 11 | Full `npm run build` | — | 2,177 tests across 84 suites, green pipeline |

**Artifacts**:
- `tests/domain/session/SessionService.test.ts` (145 → 181 tests)
- `tests/ui/SessionWorkspaceView.test.ts` (41 → 62 tests)

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
| 18 | Updated Inc 7 increment doc | Stage: done, date: 2026-02-16, tests_added: 36, tests_total: 2053, test_suites: 83, acceptance criteria checked off, tests section with actuals |
| 19 | Updated PBI-002 | Inc 7 section from PLANNED to done, acceptance criteria checked (SessionWorkspaceView), note updated (7 done, 4 planned), test counts |
| 20 | Updated Hubs PRD | Inc 7 description expanded, SessionWorkspaceView functional requirement checked, test counts 2,053/83, stage history entry, product backlog table (7 done, 4 planned) |
| 21 | Updated Development Lifecycle | Increment 7 added to Phases 7–10 |
| 22 | Created Inc 8 increment doc | [[Phase 4 Inc 8 - Session Workspace Enrichment]]: stage done, date 2026-02-16, tests_added 72, tests_total 2125 |
| 23 | Updated PBI-002 | Inc 8 section added, acceptance criteria checked (links, notes persistence, canvas, duration, template unlock, workspace), note updated (8 done, 3 planned), planned increments renumbered |
| 24 | Updated Hubs PRD | Inc 8 description, 10 new events in Produced section, functional requirements checked (links, notes, canvas, duration, template, workspace, session document), test counts 2,125/83, stage history entry, PBI-002 status (8 done, 3 planned) |
| 25 | Updated Development Lifecycle | Increment 8 added to Phases 7–10 |
| 26 | Three Amigos Review | [[Three Amigos Review - Session Workspace Enrichment 2026-02-16]]: TASM 34/35 (Excellent). 9 decisions documented. 7 action items completed. 3 watch/open items. |
| 27 | Updated Inc 9 increment doc | Stage: in-review → done, TASM 32/35, +202 LOC, +18 tests, 6 deviations documented |
| 28 | Updated PBI-002 | Inc 9 section from PLANNED to done, acceptance criteria checked (goals, auto-open, merge, validation, vault-hygiene), note updated (9 done, 2 planned) |
| 29 | Updated Hubs PRD | Inc 9 description expanded, test counts 2,141/84, stage history entry, PBI-002 status (9 done, 2 planned), review link added |
| 30 | Updated Development Lifecycle | Increment 9 added to Phases 7–10 |
| 31 | Three Amigos Review | [[Three Amigos Review - Preparation Flow 2026-02-16]]: TASM 32/35 (Excellent). 7 decisions documented. 9 action items completed. 5 watch/open items. |
| 32 | Updated Inc 10 increment doc | [[Phase 4 Inc 9 - Sidebar Workspace and Activity Consolidation]]: stage in-review, date 2026-02-17, tests_added 57, tests_total 2177, 16 capabilities, 22 acceptance criteria |
| 33 | Updated Session Workspaces PRD | Stage `approved` → `in-progress`, v3, FR-01/02 checked off, data model updated to match actual types, event model split into delivered/planned, PBI-SW-001/002 marked Done, 3 ADRs linked |
| 34 | Updated Development Lifecycle | Increment 10 added to Phases 7–10, Key Learnings 18-20 |

---

### Phase 10 — Post-Release Feedback Loop

**Improvement backlog captured during review:**
- **Closed** (Increment 8): Session links — attach files to sessions via right-click context menu + links UI in workspace and sessions tab
- **Closed** (Increment 8): Session notes persistence — auto-create notes file, generate Markdown summary on completion at `03 - Resources/Sessions/`
- **Closed** (Increment 8): Session canvas — create `.canvas` file from workspace, auto-embed in notes
- **Closed** (Increment 8): Duration editing for prepared sessions in workspace
- **Closed** (Increment 8): Save as Template for all session statuses (not just completed/archived)
- **Closed** (Increment 8): "Open Workspace" button in sessions tab + dashboard — workspace for any session state
- **Closed** (Increment 8): Session Document generation → `generateSessionSummary()` + `writeSessionSummary()` (delivered from planned Inc 11)
- **Closed** (Increment 9): Goals repeater in NewSessionModal — Enter-to-add, x-to-remove, template goals carry-through
- **Closed** (Increment 9): Auto-open workspace on session.started — main.ts crossCuttingListeners, focus file in adjacent split
- **Closed** (Increment 9): Title validation — inline "Title is required" error on empty Create
- **Closed** (Increment 9): Session notes merge — `mergeSessionNotes()` preserves user-added frontmatter and markdown content
- **Closed** (Increment 9): Vault-hygiene session type — first option in dropdown
- **Closed** (Increment 9): Adjacent leaf management — dedicated tracking via `getLeaf("split")`, reuse across link clicks
- **Closed** (Increment 7): Dedicated workspace for active sessions → `SessionWorkspaceView` (463 LOC, standalone ItemView with header, timer, goals, notes, focus file, artifacts)
- **Closed** (Increment 10): Activity log — unified activity log with 5 action types, replacing separate artifacts section (ADR-025 superseded)
- **Closed** (Increment 10): Folder filtering — `isExcluded()` pure function with global + per-session composition (ADR-026)
- **Closed** (Increment 10): Context bindings — 5 types (file/folder/domain/feature/product) with click-to-cycle, max 10 per session
- **Closed** (Increment 10): Sidebar workspace — right sidebar singleton with session switching via `setState()`/`getState()`
- **Closed** (Increment 10): File/folder rename path reconciliation — `session.paths.updated` event, live UI re-render
- **Closed** (Increment 10): File collision fix — short ID suffix `(abc123)` on notes/canvas files
- **Closed** (Increment 10): Folder context reveal — `revealInFileExplorer()` instead of `openLinkText()`
- **Closed** (Increment 10): Folder context menu — right-click TFolder shows "Add to {session}"
- **Closed** (Increment 10): CSS section standardization — `.ft-section` classes replace inline padding
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

This feedback loop triggered a return to **Phase 6 (Delivery Planning)** — the new requirements were chunked into increments. Session Document Generation (originally planned as Inc 11) was delivered early as part of Increment 8.

| Increment | Scope | Est. LOC | Est. Tests | Status |
|-----------|-------|----------|------------|--------|
| ~~**9: Preparation Flow & Auto-Open**~~ | ~~Goals repeater, auto-open, notes merge~~ | ~~111~~ → 202 | ~~6~~ → 18 | **Done** (TASM 32/35) |
| ~~**10: Sidebar Workspace & Activity Consolidation**~~ | ~~Activity log, context bindings, sidebar, path reconciliation, CSS~~ | ~~250~~ → 310 | ~~39~~ → 57 | **Done** (TASM pending) |
| **11: Focus File Profiles & Context Files** | Types, detection, context CRUD, events, backward compat | ~140 | ~31 | Planned |
| **12: Session Spawning & Guiding Questions** | Spawn logic, inheritable context, guiding questions | ~120 | ~18 | Planned |

> **New feedback cycle — Session Workspaces PRD (post-Increment 9):**
>
> After delivering 9 increments, the Session Workspaces PRD (L2 feature) was created to capture the remaining gaps: activity tracking, context bindings, decision recording, session summaries, type orchestration, and state restoration. Increment 10 delivered FR-01 (Activity Log) and FR-02 (Context Bindings) as a cross-PBI delivery — PBI-SW-001 and PBI-SW-002 from the Session Workspaces PRD were delivered within PBI-002's increment structure. This kept the delivery pipeline unified while making progress on the new PRD's requirements.

**Artifacts**: [[Phase 4 Inc 8 - Session Workspace Enrichment]], [[Phase 4 Inc 8 - Preparation Flow]], [[Phase 4 Inc 9 - Sidebar Workspace and Activity Consolidation]], [[Phase 4 Inc 9 - Focus File Profiles and Context Files]], [[Session Workspaces PRD]], [[PBI-002 Documentation Sessions]]

Increment 10 (Sidebar Workspace & Activity Consolidation) delivered on 2026-02-17. Remaining planned: Inc 11 (Focus Profiles), Inc 12 (Spawning).

---

### Key Learnings

Extracted to individual notes in `docs/learnings/` for reuse across features. See each note for detailed pattern guidance.

| # | Learning | Domain | Inc |
|---|---------|--------|-----|
| [[L-01 Domain-first UI-second\|L-01]] | Domain-first, UI-second | Architecture | 1 |
| [[L-02 Timer optimization matters\|L-02]] | Timer optimization matters | UI | 3 |
| [[L-03 Deps callback pattern for modals\|L-03]] | Deps callback pattern for modals | UI | 2 |
| [[L-04 Type safety at boundaries\|L-04]] | Type safety at boundaries | Architecture | 2 |
| [[L-05 Test mock maintenance\|L-05]] | Test mock maintenance | Testing | 2 |
| [[L-06 Direct CRUD for configuration data\|L-06]] | Direct CRUD for configuration data | Architecture | 3 |
| [[L-07 Reuse existing pipelines for new features\|L-07]] | Reuse existing pipelines | Architecture | 3 |
| [[L-08 UI should reflect service constraints\|L-08]] | UI should reflect service constraints | UI | 3 |
| [[L-09 Thread new fields through all creation paths\|L-09]] | Thread new fields through all creation paths | Architecture | 4 |
| [[L-10 Pure helpers scale safely\|L-10]] | Pure helpers scale safely | Architecture | 5 |
| [[L-11 Backward compat is the tax on persisted state\|L-11]] | Backward compat tax on persisted state | Infrastructure | 4 |
| [[L-12 Feedback loops generate the best requirements\|L-12]] | Feedback loops generate best requirements | Process | 5 |
| [[L-13 Domain-only increments build confidence\|L-13]] | Domain-only increments build confidence | Architecture | 6 |
| [[L-14 Standalone views dont need BaseHubView\|L-14]] | Standalone views don't need BaseHubView | UI | 7 |
| [[L-15 Bundle related small features into cohesive increments\|L-15]] | Bundle related small features | Process | 8 |
| [[L-16 Planned increments shift as reality unfolds\|L-16]] | Planned increments shift as reality unfolds | Process | 8 |
| [[L-17 Auto-linking artifacts builds the knowledge graph\|L-17]] | Auto-linking builds knowledge graph | Architecture | 8 |
| [[L-18 Cross-PBI delivery keeps momentum\|L-18]] | Cross-PBI delivery keeps momentum | Process | 10 |
| [[L-19 Superseding ADRs is a healthy sign\|L-19]] | Superseding ADRs is a healthy sign | Architecture | 10 |
| [[L-20 Pure functions for filtering compose cleanly\|L-20]] | Pure functions for filtering compose cleanly | Architecture | 10 |

---

## 13. Execution Recap — Session Workspaces PRD (2026-02-17)

This section traces how the **Session Workspaces PRD** — the first standalone L2 feature PRD — moved through every lifecycle phase. Unlike Sections 11–12 which track individual PBIs, this recap tracks a **feature-level PRD** that emerged from a parent PBI's delivery, went through all 10 phases, and demonstrates cross-PBI delivery, backlog refinement from learnings, and priority-based planning.

### Feature Context

| | |
|---|---|
| **PRD** | [[Session Workspaces PRD]] — Context-Aware Working Environments |
| **Maturity** | L2 (single-user structured sessions) |
| **Foundation** | [[PBI-002 Documentation Sessions]] (10 increments delivered) |
| **Scope** | 6 FRs: Activity Log, Context Bindings, Decision Log, Session Summary, Type Orchestration, State Restoration |
| **PBIs** | 9 total (2 done, 1 partial, 6 planned) |
| **Origin** | Gap analysis after PBI-002 Inc 8 — inbox feedback identified 7 missing capabilities |

---

### Phase 1 — Feedback & Idea Intake

**What happened**: During PBI-002 delivery (increments 5–10), users captured friction points as inbox items. Six user stories emerged from real usage of the session workspace:

| Inbox Item | Domain | Signal |
|------------|--------|--------|
| [[I want to filter folders to not appear in my sessions activity log]] | Activity | System folders (.obsidian/) polluting activity view |
| [[I want to have a Domain Design Session, so that I can easily document a new domain]] | Types | No guided workflow for domain decomposition |
| [[I want to automatically start a Day Session to track my usage]] | Automation | Day-to-day vault activity goes untracked |
| [[I want to create an event type document out of a session to prepare an invite for a follow up]] | Output | No structured output from completed sessions |
| [[I want to easily start a new session while working inside Obsidian]] | Automation | Users forget to start sessions |
| [[When changing a file which is attached to a session, the session still links to the old path also prevalent in templates]] | Stability | File renames break session paths |

**Artifact**: 6 inbox items linked to Session domain, prioritized by user impact.

---

### Phase 2 — Discovery (Problem Space)

**What happened**: Problem analysis against the PBI-002 foundation identified 7 missing capabilities despite a working session infrastructure with 29 events, SessionService state machine, and SessionWorkspaceView:

1. No activity tracking — file changes during sessions invisible
2. No folder filtering — system folder noise in activity view
3. No context binding — sessions unlinked from features/domains
4. No decision capture — decisions buried in unstructured notes
5. No structured summary — completion produces raw notes only
6. No type orchestration — all session types share identical workspace
7. No state restoration — workspace layout lost on pause/resume

**Artifact**: Problem statement and 7 success outcomes in [[Session Workspaces PRD]] Section 2.

---

### Phase 3 — Solution Exploration

**What happened**: Two approaches considered:

1. **Extend Hubs PRD** — add Session Workspaces as new PBIs under the existing Hubs feature. Rejected: Session Workspaces is an L2 capability with its own FRs, data model, and backlog — it outgrew a single PBI.
2. **Standalone PRD** — create a dedicated feature PRD with its own lifecycle. Chosen: the scope (6 FRs, 16 events, 6+ PBIs) warrants independent tracking.

L2 (single-user) scope selected. L3 (multi-user collaboration, real-time sync, role-based access) explicitly deferred.

**Artifact**: Solution concept in [[Session Workspaces PRD]] Section 7.

---

### Phase 4 — Solution Design + PRD Drafting

**What happened**: PRD v2 drafted with full scope:

| Dimension | Content |
|-----------|---------|
| Functional Requirements | 6 FRs covering activity, context, decisions, summary, types, state |
| Event Model | 16 planned events (command/state pairs for each capability) |
| Data Model | 4 new types: `SessionActivity`, `SessionContextBinding`, `SessionDecision`, `SessionTypeConfig` |
| PBIs | 6 backlog items (SW-001 through SW-006), dependency-ordered |
| UI Concept | Workspace layout with guiding questions, activity panel, decision log, context header |
| Non-Functional | Performance budgets (activity <16ms, restore <300ms), scalability caps (1000 activity, 100 decisions, 10 bindings) |

**Artifact**: [[Session Workspaces PRD]] v2 (Sections 1–17).

---

### Phase 5 — PRD → Development Ready

**What happened**: FRI scored at 29/35. Technical Review result: Pass.

| FRI Dimension | Score |
|---------------|-------|
| Strategy | 5/5 |
| Scope | 5/5 |
| Architecture | 4/5 |
| Event Integration | 5/5 |
| Data Model | 4/5 |
| UI Consistency | 3/5 |
| Validation & Testing | 3/5 |

Architecture score (4/5): deducted because component extraction threshold for SessionWorkspaceView (~1017 LOC) was noted but not yet addressed.

UI Consistency (3/5): workspace layout concept not yet validated against BaseHubView patterns.

**Artifact**: PRD stage moved to `approved`, FRI 29/35.

---

### Phase 6 — Delivery Planning + Chunking

**What happened**: PRD decomposed into PBIs, then refined through two planning cycles:

**Initial planning (2026-02-17):**
- 6 PBIs defined (SW-001 through SW-006)
- Dependency chain: SW-001 → SW-002 (activity before context), SW-004 → SW-005 (decisions before summary), SW-003 independent
- Cross-PBI delivery decided: SW-001 and SW-002 would be delivered via PBI-002 Inc 10 rather than standalone increments — activity log and context bindings share workspace surface area

**Backlog refinement (2026-02-18):**
- PBI-SW-001/002 closed as done
- PBI-SW-005 updated to reflect partial delivery (Inc 8-9 summary functions)
- PBI-SW-003 promoted to High priority (bundles global filter settings UI, enables SW-009)
- PBI-SW-004/006 refined with learnings (L-01, L-09, L-10, L-11, L-13, L-14, L-17, L-20)
- 3 new PBIs created from inbox discoveries (SW-007, SW-008, SW-009)
- Priority ranking established: interleaved by user value, not sequential order

**Artifact**: 9 PBIs in `backlog/PBI-SW-*.md`, priority table in PRD §13.

---

### Phase 7 — Iterative Implementation

**What happened**: Two FRs delivered via cross-PBI delivery (PBI-002 Inc 10), one FR partially delivered:

#### FR-01: Activity Log (delivered via PBI-002 Inc 10)

| Capability | Implementation |
|------------|---------------|
| Activity tracking | `onActivityEvent()` in SessionService — intercepts file.created/modified/deleted/renamed during active sessions |
| Folder filtering | `isExcluded()` pure function — ADR-026 (composable prefix matching) |
| Deduplication | 1-second window, same path + action |
| Cap | 1000 entries per session, oldest-first eviction |
| Persistence | `activity: SessionActivity[]` on Session via TypedStorage |
| UI | Unified activity timeline in SessionWorkspaceView (replaced artifacts section, superseding ADR-025) |

#### FR-02: Context Bindings (delivered via PBI-002 Inc 8.5/10)

| Capability | Implementation |
|------------|---------------|
| Binding CRUD | `handleContextBind/Unbind/ChangeType()` in SessionService |
| Types | 5 binding types: file, folder, domain, feature, product |
| UI | Badge section with click-to-cycle type, fuzzy vault picker, max 10 bindings |
| Folder handling | `revealInFileExplorer()` for folder bindings (not `openLinkText()`) |

#### FR-04: Session Summary (partially delivered via Inc 8-9)

| Capability | Implementation |
|------------|---------------|
| Summary generation | `generateSessionSummary()` pure function |
| File writing | `writeSessionSummary()` writes to `notesFile` path |
| Notes merge | `mergeSessionNotes()` preserves user-added content |
| Remaining | Decisions section blocked by FR-03 (PBI-SW-004) |
| Design decision | No separate `summaryFile` — `notesFile` serves dual purpose. No dedicated events — synchronous on completion. |

**Additional cross-cutting delivery (Inc 10):**
- File/folder rename path reconciliation: `handleFileRenamed()` + `handleFolderRenamed()` with `session.paths.updated` emission
- File collision fix: short ID suffix `(abc123)` on notes/canvas file paths
- Sidebar workspace: singleton pattern with `setState()`/`getState()` session switching
- Folder context menu: TFolder right-click shows "Add to {session}"
- CSS section standardization: `.ft-section` classes

**Totals**: 9 new events registered, ~310 LOC net (Inc 10), 57 tests added. Build: 2,177 tests across 84 suites.

---

### Phase 8 — Review + Quality Assurance

**What happened**: Inc 10 underwent full review:

| Step | Action | Finding | Resolution |
|------|--------|---------|------------|
| 1 | Code review: Activity consolidation | Clean — artifacts merged into unified log. ADR-025 superseded. | N/A |
| 2 | Code review: Folder filtering | `isExcluded()` pure function (ADR-026), 12 LOC, zero dependencies | N/A |
| 3 | Code review: Context bindings | 5 types, click-to-cycle, folder reveal correct | N/A |
| 4 | Code review: Path reconciliation | `affectedIds` Set ensures `session.paths.updated` only emitted for affected sessions | N/A |
| 5 | Build error: `"vault"` not assignable to `FileChangeSource` | Tests used `source: "vault"` | Fixed: replaced with `"obsidian"` |
| 6 | Build error: Missing catalog entry | `session.paths.updated` missing | Fixed: added with `tags: ["system"]` |
| 7 | Test coverage | 57 tests across SessionService (+36) and SessionWorkspaceView (+21) | All passing |

**Architecture decisions during PRD lifecycle:**

| ADR | Title | Status | Impact |
|-----|-------|--------|--------|
| ADR-025 | Activity Log Separate from Artifacts | Superseded | Inc 10 consolidated into unified log |
| ADR-026 | Composable Folder Filtering | Accepted | `isExcluded()` pure function pattern |
| ADR-029 | ISO Date Prefix for Session Files | Proposed | Not yet implemented — session file naming |

**Artifact**: [[Three Amigos Review - Sidebar Workspace and Activity Consolidation 2026-02-17]] (TASM pending).

---

### Phase 9 — Documentation + Publication

**What happened** (step by step):

| Step | Action | Artifact |
|------|--------|----------|
| 1 | Created Session Workspaces PRD | [[Session Workspaces PRD]] v2 — 6 FRs, 16 events, data model, PBI table |
| 2 | Updated PRD to v3 | FR-01/02 checked off, data model updated to match actual types, event model split into delivered/planned |
| 3 | Created 6 PBIs | PBI-SW-001 through PBI-SW-006 in `backlog/` |
| 4 | Updated PBI-002 increment doc | [[Phase 4 Inc 9 - Sidebar Workspace and Activity Consolidation]] — 16 capabilities documented |
| 5 | Updated Hubs PRD | Inc 10 description, test counts, stage history, PBI-002 status |
| 6 | Closed PBI-SW-001/002 | Stage → done, delivery metadata, delivery status sections updated |
| 7 | Updated PBI-SW-005 | Stage → in-progress, design decisions documented, partial delivery reflected |
| 8 | Refined PBI-SW-003/004/006 | Learnings applied, size estimates, implementation approach sections added |
| 9 | Created 3 new PBIs | PBI-SW-007 (Auto-Session), PBI-SW-008 (Output Artifacts), PBI-SW-009 (Domain Design) |
| 10 | Updated PRD to v4 | 9-PBI table with priority ranking, stage history entry, delivery planning updated |
| 11 | Updated Development Lifecycle | This section (Section 13) — full PRD lifecycle recap |

---

### Phase 10 — Post-Release Feedback Loop

**What happened**: Three inbox items from post-Inc 10 usage became new PBIs:

| Inbox Item | New PBI | Priority |
|------------|---------|----------|
| Auto-start daily session + session nudges | PBI-SW-007 | Medium |
| Generate typed output documents from sessions | PBI-SW-008 | Low |
| Guided domain design workflow | PBI-SW-009 | Medium |

These feed directly into the next planning cycle. PBI-SW-003 (Session Types & Orchestration) is the top-priority next delivery — it provides the foundation for PBI-SW-009 (Domain Design Session) and bundles the remaining global filter settings UI from PBI-SW-001.

**Priority ranking** (interleaved by value):

| Rank | PBI | Title | Priority | Rationale |
|------|-----|-------|----------|-----------|
| 1 | PBI-SW-003 | Session Types & Orchestration | High | Foundation for type-specific tooling; bundles global filter; enables SW-009 |
| 2 | PBI-SW-004 | Decision Log | Medium | Independent, high user value; unblocks SW-005 completion |
| 3 | PBI-SW-007 | Auto-Session & Nudges | Medium | High quality-of-life; independent |
| 4 | PBI-SW-009 | Domain Design Session | Medium | Rich workflow; depends on SW-003 |
| 5 | PBI-SW-005 | Session Summary (completion) | Low | Mostly done; remaining = decisions section |
| 6 | PBI-SW-008 | Session Output Artifacts | Low | Extends summary capability |
| 7 | PBI-SW-006 | State Restoration | Low | No user demand yet (L-12) |

---

### Key Learnings

| # | Learning | Pattern |
|---|---------|---------|
| 1 | **Cross-PBI delivery keeps momentum** (L-18) | Delivering SW-001/002 within PBI-002 Inc 10 avoided setup overhead. When PBIs share workspace surface area, bundle them into the active delivery stream. |
| 2 | **Standalone PRDs emerge naturally from parent PBI gaps** | After 8+ increments, PBI-002 had accumulated enough unaddressed feedback to warrant a separate feature PRD. This is not scope creep — it's healthy decomposition. |
| 3 | **Backlog refinement with learnings produces sharper PBIs** | Applying L-01 (domain-first), L-09 (field threading), L-11 (backward compat) to PBI specs before implementation prevents mid-increment design pivots. |
| 4 | **Priority ranking by value, not sequence** | Interleaving PBIs by user value (SW-003 → SW-004 → SW-007) rather than technical dependency order (SW-003 → SW-009 → SW-004) delivers more value sooner. |
| 5 | **Superseding ADRs is healthy** (L-19) | ADR-025 was superseded by Inc 10's activity consolidation. This validates that ADRs are living decisions — not permanent constraints. |
| 6 | **Design decisions during implementation reduce planned scope** | `summaryFile` and `session.summary.*` events were planned but proved unnecessary. Documenting the design decision (not the absence) keeps the PRD accurate. |

---

## 14. Appendix

- [[Testplan and Teststrategy]]
- [[Three Amigos Session Template]]
- [[PRD Template]]
- [[Product Backlog Item Template]]
- [[Feature Lifecycle PRD]]
- [[Increment Lifecycle]]
- [[Delivery Planning]]


