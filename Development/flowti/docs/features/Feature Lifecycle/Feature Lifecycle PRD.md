---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: approved
related_events:
  - feature.stage.changed
  - feature.gate.passed
  - feature.gate.failed
  - feature.session.started
  - feature.session.ended
  - feature.scored
  - review.session.created
  - review.session.scored
maturity: L2
maturity_score_strategy: 5
maturity_score_scope: 5
maturity_score_architecture: 4
maturity_score_event_integration: 4
maturity_score_data_model: 4
maturity_score_ui_consistency: 3
maturity_score_validation_testing: 2
business_value: 5
implementation_cost: 4
maintenance_cost: 2
discovery_cost: 1
design_cost: 3
test_cost: 3
priority: 2
---

# Feature: Feature Lifecycle

> Process reference: [[Development Lifecycle]]

---

## 1. Problem Statement

The Flowti Development Lifecycle defines a 10-phase process that turns ideas into tested, documented, published increments. The mental model is simple: we work inside a **Domain**, observe **Jobs to be Done** from **Actors**, capture the user voice as **User Stories**, and document solutions as **PRDs**. PRDs are tool-agnostic tokens that flow through the process — from initial problem scoping through exploration, design, implementation, review, and publication. Each PRD can be attached to a **Product**, broken into **Features**, chunked into **PBIs**, and refined into **Use Cases** with corresponding User Stories.

Today, this process exists only as a guidance document — none of it is visible, traceable, or manageable inside Flowti itself.

- **Who is affected?** Anyone maintaining a Flowti vault — solo developers tracking their own features, small teams coordinating across domains, architects reviewing quality.
- **What breaks?** PRDs accumulate in inconsistent stages (`idea`, `draft`, `open`, `new`, `development` — 10+ different values in use today). Nobody knows which PRD needs what to advance. Quality gates (FRI, Technical Review, Three Amigos) are templates that get filled once and forgotten. Feedback captured as User Stories while using solutions has no structured path back into the lifecycle. The process is invisible — users must manually track where each feature stands.
- **Why it matters:** The Development Lifecycle is the codified process that ensures every feature is implemented, tested, documented, and published. If the process itself isn't visible in the tool, it doesn't get followed. Making the process the data model means Flowti documents its own development as users work — and User Stories captured during usage flow naturally back into the next iteration.

---

## 2. Outcome

- **User can** open a Feature Pipeline view and see every PRD positioned at its current lifecycle phase, with clear indicators of what's needed to advance to the next gate.
- **User can** start a focused session on a specific PRD, work on it (create docs, write code, update frontmatter), and have the session's progress documented automatically.
- **User can** score a feature using FRI (pre-implementation readiness) and TASM (post-implementation quality) and see scores tracked over time.
- **User can** run a Three Amigos review session with structured scoring and have the results linked to the PRD and captured as vault artifacts.
- **System can** compute gate readiness from vault state — checking whether a PRD has a problem statement, acceptance criteria, tests, docs, and other phase-specific requirements.
- **Domain gains** a first-class PRD lifecycle that makes the development process visible, enforces quality gates through automated checks, and builds knowledge incrementally session by session. User Stories captured while using solutions feed back into the lifecycle as input for new PRDs or refinements to existing ones.

Measurable success:
- Every PRD has a consistent, validated `stage` value from a defined set
- Gate readiness is computable — users see exactly what's missing before advancing
- Session history shows the trajectory of each feature over time
- FRI and TASM scores are persisted per PRD and trackable across reviews

---

## 3. Scope

### In Scope

- **PRD as first-class entity**: scan `docs/features/*/` for PRD files, extract stage, maturity, scores, and backlog from frontmatter
- **Standardized stages**: `idea → draft → approved → in-progress → review → done` — validated and enforced
- **Phase mapping**: map the 6 stages to the 10 Development Lifecycle phases for display
- **Gate readiness checks**: automated checks per stage that determine what's needed to advance (inspired by Health checks pattern)
- **Feature Pipeline view**: master/detail layout showing all PRDs grouped by stage, with gate status and readiness indicators
- **Feature detail panel**: PRD overview, current gate checklist, backlog items (PBIs + use cases), score history, session log
- **FRI scoring**: compute Feature Readiness Index from PRD frontmatter dimensions (7 dimensions, 0-5 each, max 35)
- **Session tracking**: start/end a session focused on a PRD, log which files were created/modified during the session, persist session records
- **Review session integration**: create Three Amigos review sessions linked to features, capture TASM scores, persist as vault artifacts
- **Stage transitions**: advance PRD to next stage via action button; validate gate criteria before allowing transition
- **Event integration**: emit events for stage changes, gate results, session lifecycle, and scoring
- The underlying Lifecycle must be manageable and substitiuteable like a process 

### Out of Scope (future phases)

- TASM trend tracking and historical charts (see Tracking and Reporting feature)
- Architecture Stability Index (ASI) computation (separate concern, needs codebase analysis)
- Automated CI/CD integration (build pipeline results fed into gate checks)
- Multi-user session coordination (see Multiplayer feature)
- Kanban board drag-and-drop for stage transitions (see User Story Mapping feature)
- Custom lifecycle phases defined by users

---

## 4. UX Entry Points

| Entry Point | What the User Sees |
|---|---|
| **Event Catalog tab** | "Features" tab in the tab bar (replaces no existing tab — new addition) |
| **Feature Pipeline** | Master panel: PRDs grouped by stage columns (idea → draft → approved → in-progress → review → done) |
| **Feature detail** | Detail panel: PRD overview, gate checklist, backlog, scores, sessions |
| **Start Session** | Button on feature detail: "Start Session" → begins tracking file changes for this PRD |
| **Advance Stage** | Button on feature detail: "Advance to [next stage]" → validates gates, transitions if passed |
| **Score Feature** | Action on feature detail: "Score FRI" → opens scoring form with 7 dimensions |
| **Review Session** | Action on feature detail: "New Review" → creates Three Amigos session doc from template |
| **Command palette** | `flowti:feature-pipeline` — open Feature Pipeline view |
| **Dashboard** | Features card on Event Catalog dashboard showing stage distribution |

---

## 5. Functional Requirements

### PRD Discovery & Stage Management

- [ ] Scan `docs/features/*/` for files with `type: ProductRequirementsDocument` frontmatter
- [ ] Extract and validate `stage` field against allowed values: `idea`, `draft`, `approved`, `in-progress`, `review`, `done`
- [ ] Normalize legacy stage values on first scan (e.g., `open` → `draft`, `development` → `in-progress`, `new` → `idea`, `planned` → `approved`)
- [ ] Display PRDs grouped by stage in the master panel
- [ ] Each PRD row shows: name, stage badge, maturity level, FRI score (if scored), gate readiness indicator (green/yellow/red)

### Phase Mapping

- [ ] Map the 6 stages to the 10 Development Lifecycle phases for contextual display:

| Stage | Lifecycle Phases | Gate Name |
|---|---|---|
| idea | 1. Feedback & Intake, 2. Discovery | Problem Gate |
| draft | 3. Solution Exploration, 4. Solution Design | Design Gate |
| approved | 5. Development Ready | Readiness Gate |
| in-progress | 6. Delivery Planning, 7. Implementation | Build Gate |
| review | 8. Review + QA | Quality Gate |
| done | 9. Publication, 10. Feedback Loop | Release Gate |

### Gate Readiness Checks

- [ ] Each stage has a set of automated gate checks (pure functions, like Health checks):

**Problem Gate** (idea → draft):
- PRD file exists with problem statement section
- Outcome section filled
- At least one domain or service linked

**Design Gate** (draft → approved):
- Scope section (in-scope + out-of-scope) filled
- Functional requirements listed (at least 3)
- Event impact section filled (produced or consumed events)
- FRI score >= 11 (Conceptual)

**Readiness Gate** (approved → in-progress):
- Acceptance criteria listed (at least 3)
- Data model section filled
- Technical review completed (linked review session doc with `result: pass` or `conditional_pass`)
- FRI score >= 19 (Technically Ready)

**Build Gate** (in-progress → review):
- At least one PBI exists in backlog with `stage: done`
- Build pipeline passes (`npm run build` — manual confirmation)
- Tests exist for the feature (manual confirmation or detected via backlog)

**Quality Gate** (review → done):
- All acceptance criteria checked (`[x]`)
- Documentation updated (Definition of Done items checked)
- Three Amigos review session exists with TASM score >= 19 (Stable)

**Release Gate** (automatic on done):
- All checks above passed
- `maturity` field updated to reflect actual level

- [ ] Gate check results shown as checklist in feature detail panel
- [ ] Overall gate readiness: all checks pass → green "Ready to advance", some fail → yellow "N items remaining", critical fail → red "Blocked"

### FRI Scoring

- [ ] Score form with 7 dimensions (Strategy, Scope, Architecture, Event Integration, Data Model, UI Consistency, Validation & Testing)
- [ ] Each dimension scored 0-5 via slider or number input
- [ ] Individual dimension scores persisted to PRD frontmatter (`maturity_score_*` fields)
- [ ] Total and readiness level computed by Base formulas: Not Ready (0-10), Conceptual (11-18), Technically Ready (19-25), Integration Ready (26-30), Production Ready (31-35)
- [ ] Score history tracked via `feature.scored` events

### Prioritization Scoring

- [ ] Each feature scored across 7 prioritization dimensions: `business_value`, `implementation_cost`, `maintenance_cost`, `discovery_cost`, `design_cost`, `test_cost`, `priority` (all 0-5 or null)
- [ ] Scores persisted in PRD frontmatter
- [ ] Feature Pipeline view supports sorting by priority, business_value, or computed value-to-cost ratio
- [ ] Priority signal computed as advisory: `business_value - ((discovery_cost + design_cost + implementation_cost + test_cost + maintenance_cost) / 5).round()`
- [ ] Prioritization scores shown in feature detail panel alongside FRI scores
- [ ] Pipeline master view shows priority badge (color-coded: 5=red/urgent, 4=orange, 3=yellow, 2=blue, 1=gray, 0=dimmed)

### Session Tracking

- [ ] "Start Session" creates a session record: `{ featureName, startTime, filesCreated[], filesModified[], notes }`
- [ ] While session is active, listen to `file.created` and `file.modified` events — if the file is under the feature's folder or references the feature, log it
- [ ] "End Session" finalizes the record with endTime, summary, and persists to storage
- [ ] Session log displayed in feature detail panel with timestamps, duration, and file change list
- [ ] Sessions persisted under storage key `featureLifecycle`

### Review Session Integration

- [ ] "New Review" action creates a Three Amigos session doc from template in the feature's backlog folder
- [ ] Review doc linked to feature via frontmatter (`related_features`)
- [ ] TASM scores extracted from review doc frontmatter (`scores_*` fields)
- [ ] Most recent TASM score shown in feature detail panel
- [ ] `review.session.scored` event emitted when review doc is saved with scores

### Stage Transitions

- [ ] "Advance to [next stage]" button visible when gate checks indicate readiness
- [ ] Clicking advance: validate all gate checks → if passed, update PRD frontmatter `stage` field → emit `feature.stage.changed`
- [ ] If gate checks fail: show which checks are blocking with explanations
- [ ] Stage transition history logged in session records

### Dashboard Integration

- [ ] Features card on Event Catalog dashboard showing: total PRDs, stage distribution (e.g., "3 idea, 5 draft, 2 in-progress, 4 done")
- [ ] Click navigates to Features tab

---

## 6. Data Model Impact

### Decomposition Hierarchy

The Feature Lifecycle implements the mental model described in the [[Development Lifecycle]]. Each level maps to existing Flowti entities:

```
Domain (DomainDoc)
└── Jobs to be Done (observed from Actors)
    └── User Stories (captured user voice — primary feedback artifact)
        └── Solution / PRD (ProductRequirementsDocument — tool-agnostic problem boundary)
            └── Product (ProductDoc — named solution, user-facing container)
                └── Features (PRD sections / functional requirement groups)
                    └── PBIs (ProductBacklogItem — vertical slices of value)
                        └── Use Cases + User Stories (interaction design + traceability)
```

PRDs are **tool-agnostic** in their first draft — they scope the Domain and Problem before prescribing implementation. A PRD can be attached to a Product at any point via the `product` frontmatter field.

### New Entities (file-driven)

| Entity | Source | Key Fields |
|---|---|---|
| `FeatureEntry` | PRD frontmatter scan | `name`, `stage`, `maturity`, `friScore`, `friLevel`, `backlogPath`, `gateStatus`, `sessions[]`, `reviews[]`, `businessValue`, `implementationCost`, `maintenanceCost`, `discoveryCost`, `designCost`, `testCost`, `priority` |
| `GateCheckResult` | Computed on render | `gateId`, `title`, `passed`, `reason`, `severity` |
| `SessionRecord` | Persisted in storage | `featureName`, `startTime`, `endTime`, `filesCreated[]`, `filesModified[]`, `notes`, `stageAtStart`, `stageAtEnd` |
| `ReviewRecord` | Three Amigos doc scan | `featureName`, `date`, `tasmScore`, `healthLevel`, `driftDetected`, `filePath` |

### Frontmatter Schema (PRD files — already partially in use)

```yaml
stage: idea | draft | approved | in-progress | review | done
maturity: L0 | L1 | L2 | L3 | L4 | L5
maturity_score_strategy: 0-5
maturity_score_scope: 0-5
maturity_score_architecture: 0-5
maturity_score_event_integration: 0-5
maturity_score_data_model: 0-5
maturity_score_ui_consistency: 0-5
maturity_score_validation_testing: 0-5
# maturity_score_total and maturity_score_status are computed by Base formulas, not stored in frontmatter
business_value: null | 0-5
implementation_cost: null | 0-5
maintenance_cost: null | 0-5
discovery_cost: null | 0-5
design_cost: null | 0-5
test_cost: null | 0-5
priority: null | 0-5
```

### Storage Schema

```
featureLifecycle: {
  sessions: SessionRecord[],
  activeSession: { featureName, startTime } | null
}
```

---

## 7. Event Impact

### Produced

| Event | Payload | When |
|---|---|---|
| `feature.stage.changed` | `{ featureName, previousStage, newStage, timestamp }` | PRD stage updated via advance action |
| `feature.gate.passed` | `{ featureName, gateName, stage }` | All gate checks pass for a stage |
| `feature.gate.failed` | `{ featureName, gateName, failedChecks[] }` | Gate check run with failures |
| `feature.scored` | `{ featureName, friScore, friLevel, dimensions }` | FRI score saved to frontmatter |
| `feature.session.started` | `{ featureName, startTime }` | User starts a session |
| `feature.session.ended` | `{ featureName, endTime, duration, filesChanged }` | User ends a session |
| `review.session.created` | `{ featureName, filePath }` | Three Amigos doc created |
| `review.session.scored` | `{ featureName, tasmScore, healthLevel }` | TASM scores detected in review doc |

### Consumed

| Event | Purpose |
|---|---|
| `file.created` | Track files created during active session |
| `file.modified` | Track files modified during active session |
| `settings.changed` | Respect `docsRootPath` for feature folder scanning |
| `doc.created` | Track when backlog items are created for a feature |

---

## 8. UI Layout Impact

### Features Tab (new tab in Event Catalog)

- **Tab position**: after Products (Domains | Services | Events | Flows | Systems | Actors | Products | Features | Health)
- **Master panel**: Feature Pipeline — PRDs listed and grouped by stage
  - Stage headers with count badges
  - Each row: feature name, stage badge, maturity dot, FRI score, gate indicator
  - Search/filter bar
  - Active session indicator (pulsing dot on the feature being worked on)
- **Detail panel**: Feature Detail
  - Header: feature name, stage badge, maturity level
  - Gate Checklist: automated checks for current stage with pass/fail indicators
  - Advance button (enabled when all gates pass)
  - Backlog section: PBIs and use cases linked to this feature
  - Scores section: FRI score breakdown + most recent TASM score
  - Session Log: chronological list of sessions with duration, files changed, notes
  - Actions: Start Session, Score FRI, New Review, Open PRD

### Dashboard Updates

- Features stat card in Event Catalog dashboard grid
- Quick action: "Start Feature Session" (if no active session)

---

## 9. Adapter Impact

### New Service: `FeatureLifecycleService`

```
FeatureLifecycleService
├── scanFeatures(): FeatureEntry[]           (scan PRD files, extract frontmatter)
├── getGateChecks(stage): GateCheckResult[]  (run gate checks for a stage)
├── advanceStage(featureName): Promise<void> (validate + update frontmatter)
├── scoreFRI(featureName, scores): void      (persist FRI scores to frontmatter)
├── startSession(featureName): void          (begin tracking)
├── endSession(notes?): void                 (finalize + persist)
├── getActiveSession(): SessionRecord | null
├── getSessions(featureName): SessionRecord[]
├── getReviews(featureName): ReviewRecord[]  (scan review docs)
├── createReviewDoc(featureName): Promise<string> (create from template)
└── load(): void                             (restore persisted state)
```

### Gate Check Functions (pure, testable)

```
checkProblemGate(entry, prdContent): GateCheckResult[]
checkDesignGate(entry, prdContent): GateCheckResult[]
checkReadinessGate(entry, prdContent, reviewDocs): GateCheckResult[]
checkBuildGate(entry, backlogItems): GateCheckResult[]
checkQualityGate(entry, prdContent, reviewDocs): GateCheckResult[]
runGateChecks(entry, context): { gate, checks[], passed }
```

### New UI Component: `FeaturesTab`

Follows the existing `BaseEntityTab` pattern (if extracted) or matches the HealthTab/ProductsTab pattern:
- `renderMaster()` — pipeline view with stage grouping
- `renderDetail()` — feature detail with gates, backlog, scores, sessions

---

## 10. Non-Functional Requirements

- **Performance**: Feature scan completes in < 200ms for 50 PRDs; gate checks are pure functions with no I/O
- **Purity**: Gate check functions are side-effect-free — testable with mock data, no DOM, no Obsidian imports
- **Freshness**: Features re-scanned on tab activation (same pattern as Flows, Systems, etc.)
- **Session isolation**: Only one active session at a time; session state survives plugin reload
- **Non-blocking**: Session tracking via event listeners — zero overhead on normal file operations
- **Progressive disclosure**: Pipeline overview first, detail on click, scores and sessions one more click deep

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PRD frontmatter schema varies across features | High | Medium | Forgiving parsing with `fmString()` pattern; auto-normalize on first scan |
| Gate checks too strict for early-stage PRDs | Medium | Medium | Gates are advisory, not enforced — user can override with confirmation |
| Session tracking overhead during rapid file changes | Low | Low | Session only logs files matching feature folder; debounced append |
| Users skip sessions and just edit frontmatter directly | Medium | Low | That's fine — manual stage changes still emit events and are tracked |
| Tab count grows too large (9th tab) | Medium | Medium | Future Hub architecture will distribute tabs; for now, Features is essential |
| Three Amigos template changes break score extraction | Low | Medium | Forgiving frontmatter parsing; fallback to 0 for missing scores |

---

## 12. Acceptance Criteria

- [ ] Features tab shows all PRDs discovered from `docs/features/*/` grouped by stage
- [ ] Each feature shows gate readiness indicator (green/yellow/red) based on automated checks
- [ ] Clicking a feature shows detail panel with gate checklist, backlog, and scores
- [ ] "Advance to [next stage]" validates gates and updates PRD frontmatter on success
- [ ] FRI scoring form persists dimension scores to PRD frontmatter
- [ ] "Start Session" begins tracking file changes; "End Session" persists the session record
- [ ] Session log shows chronological history of sessions per feature
- [ ] "New Review" creates a Three Amigos doc from template linked to the feature
- [ ] TASM scores extracted from review docs and displayed in feature detail
- [ ] Stage distribution shown on Event Catalog dashboard
- [ ] `npm run build` passes

---

## 13. Definition of Done

- [ ] `FeatureLifecycleService` implemented with scan, gate checks, scoring, session tracking, and review integration
- [ ] Gate check functions implemented as pure functions with full test coverage
- [ ] `FeaturesTab` component with pipeline master view and feature detail panel
- [ ] Event definitions added to `FlowtiEventMap` (8 events under `feature.*` and `review.*`)
- [ ] Storage persistence for sessions and active session state
- [ ] Stage normalization handles all legacy stage values
- [ ] FRI scoring persists to frontmatter
- [ ] Three Amigos review doc creation from template
- [ ] Dashboard integration (Features stat card + quick action)
- [ ] Unit tests for all gate check functions and service methods
- [ ] Use cases documented
- [ ] `npm run build` passes

---

## Stage History

| Date | Transition | Gate | FRI | Reviewer | Notes |
|---|---|---|---|---|---|
| 2026-02-15 | → idea | — | — | — | PRD concept created from Development Lifecycle process document |
| 2026-02-15 | idea → draft | Problem Gate | 21 | — | Problem statement, outcome, scope, requirements, events, data model, UI layout, adapter API all defined. 3 PBIs, 6 use cases, 3 user stories created. |
| 2026-02-15 | draft → approved | Design Gate | 27 | Technical Architect | FRI re-scored (21 → 27, Integration Ready). Technical Review: Pass. All Design Gate criteria met. PRD is development-ready. |

---

## Related

- Process: [[Development Lifecycle]]
- Template: [[PRD Template]] (defines FRI scoring dimensions)
- Template: [[Three Amigos Session Template]] (defines TASM scoring dimensions)
- Technical Review: [[Technical Review 2026-02-15]]
- Phantom events: `prd.created`, `prd.updated` (referenced by Designer + Guided Tours PRDs — this feature provides the actual implementation)
