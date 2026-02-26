---
type: DevelopmentCycle
feature: "[[Onboarding PRD]]"
stage: planned
cycle: 47
date_planned: 2026-02-26
date_completed:
pbis:
  - "[[PBI-ONB-012 OnboardingService Extraction]]"
  - "[[PBI-ONB-010 Contextual View Callouts]]"
  - "[[PBI-ONB-011 Onboarding Reset from Settings]]"
  - "[[PBI-ONB-013 Onboarding Lifecycle Events]]"
  - "[[PBI-ONB-017 Hub Empty States]]"
bugs: []
bugs_fixed_precycle: []
bugs_fixed: []
tech_debt:
  - "TD-23: InstallerWizardModal mixes state and rendering (574 LOC)"
tech_debt_resolved: []
estimated_increments: 5
actual_increments:
estimated_tests: 55
actual_new_tests:
pre_cycle_tests: 5201
pre_cycle_suites: 219
post_cycle_tests:
post_cycle_suites:
---

# Cycle 47 — Onboarding Phase 2: Contextual Guidance

## Cycle Overview

**User Story:**

> As a new Flowti user, I want contextual guidance when I open each Hub view for the first time — so that I understand what the view does and what actions to take, without needing to read external documentation or guess my way through the interface.

**User Pains:**

- **Silent Hub views** — When a user opens the Event Catalog, Data Exchange Hub, or User Hub for the first time, the view renders without any explanation. There is no indication of what this view does, what data it shows, or what the user should do here. The user is expected to figure it out.
- **Onboarding trapped in Analytics** — The Getting Started checklist (C46) only appears on the Analytics Hub homepage. Users who navigate to other Hubs receive no onboarding guidance. The onboarding state is embedded inside `AnalyticsState`, coupling it to a single domain.
- **No way to replay onboarding** — If a user dismisses the checklist or callouts, there is no way to bring them back. New team members who inherit an existing vault never see onboarding at all.
- **No onboarding events** — The system emits no events when onboarding milestones are reached or when the user completes onboarding. This makes it impossible to track onboarding progress, trigger follow-up actions, or integrate with other domains.
- **Barren empty states** — Only the Analytics Hub has a welcoming empty state (C45). The User Hub, Data Exchange Hub, and Event Catalog show minimal empty states with no guidance on how to populate them.

**Business Trigger:** Cycle 46 delivered Phase 1: Getting Started checklist, seed dashboard, empty state redesign. Users who follow the Analytics Hub path are well-served. But users who explore other Hubs hit dead ends. Phase 2 extends onboarding across all major views, extracts onboarding into its own domain, and adds the infrastructure for future progressive discovery.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 46)

**Plugin health:**
- 5,201 tests passing, 219 test suites
- Build status: green (`npm test` clean)
- No blocking bugs from Cycle 46

**Onboarding domain status:**
- `OnboardingChecklist` embedded in `AnalyticsState.onboardingChecklist`
- 5 milestones (installed, first_source, first_query, first_dashboard, first_pin)
- Methods on AnalyticsService: `initOnboardingChecklist()`, `updateOnboardingChecklist()`, `dismissOnboardingChecklist()`, `resetOnboardingChecklist()`
- UI: collapsible checklist card on `AnalyticsDashboardPage`, empty state with welcome hero
- 9 tests covering init, persistence, merge, dismiss, reset
- **Gap:** No standalone OnboardingService — logic coupled to AnalyticsService
- **Gap:** No contextual callouts on other Hub views
- **Gap:** No way to reset onboarding from Settings
- **Gap:** No onboarding lifecycle events

**Hub views status (5 BaseHubView subclasses):**
- AnalyticsHubView: rich empty state, Getting Started checklist — well-served
- UserHubView: minimal empty state (hub summary cards only)
- DataExchangeHubView: functional but no first-visit guidance
- EventCatalogView: functional but no first-visit guidance
- TrainHubView: functional but no first-visit guidance

**Settings status:**
- `FlowtiSettingsTab`: 12 settings sections. No onboarding section.
- Analytics Hub has "Reset Analytics Hub" button in settings — pattern exists for "Reset onboarding"

---

## Backlog Refinement

### Inbox Items Processed

| Source | Item | Decision | Rationale |
|--------|------|----------|-----------|
| Onboarding PRD Phase 2 | PBI-ONB-012 OnboardingService Extraction | **IN SCOPE** (Inc 1) | Foundation: must decouple from AnalyticsService before adding cross-hub features |
| Onboarding PRD Phase 2 | PBI-ONB-010 Contextual View Callouts | **IN SCOPE** (Inc 2) | Core deliverable: first-visit callouts for Event Catalog, DX Hub, User Hub |
| Onboarding PRD Phase 2 | PBI-ONB-011 Onboarding Reset from Settings | **IN SCOPE** (Inc 3) | Enables replay and new-team-member scenario |
| Onboarding PRD Phase 2 | PBI-ONB-013 Onboarding Lifecycle Events | **IN SCOPE** (Inc 4) | Infrastructure: enables event-driven integrations |
| Onboarding PRD Phase 3 | PBI-ONB-017 Hub Empty States | **IN SCOPE** (Inc 5) | UX completeness: welcoming empty states beyond Analytics Hub |
| C46 deferred | Full OnboardingService | **Absorbed** (Inc 1) | This IS the OnboardingService extraction |
| C46 deferred | Example domain seeding | **Deferred** | Different feature scope; not contextual guidance |
| C46 deferred | Project Manager seed content | **Deferred** | Role-specific content; separate from Phase 2 |
| Phase 3 | PBI-ONB-014 Configurable Startpage | **Deferred** | Settings UX feature; not core onboarding |
| Phase 3 | PBI-ONB-015 Role-Specific Seed Data Service | **Deferred** | Requires design cycle for multi-persona system |
| Phase 3 | PBI-ONB-016 Command Catalog | **Deferred** | Feature discovery; larger scope |
| Phase 3 | PBI-ONB-018 Guided Tours | **Deferred** | Depends on process framework maturity |

### Scope Decision

This cycle delivers **cross-hub contextual onboarding**: a standalone OnboardingService with its own persistence, first-visit callouts for 4 Hub views, a Settings reset button, onboarding lifecycle events, and welcoming empty states for views beyond Analytics Hub. The goal is to make every first-visit to any Hub view informative and welcoming.

---

## Cycle Goals

1. **OnboardingService Extraction** — Extract onboarding logic from AnalyticsService into a standalone `OnboardingService` with its own `onboarding` storage key, migrating existing checklist state
2. **Contextual View Callouts** — Show dismissible first-visit callout banners on Event Catalog, Data Exchange Hub, User Hub, and Train Hub explaining what the view does and suggesting first actions
3. **Onboarding Reset from Settings** — Add "Reset onboarding" button to FlowtiSettingsTab that restores all callouts and the Getting Started checklist
4. **Onboarding Lifecycle Events** — Emit `onboarding.started`, `onboarding.step.completed`, `onboarding.completed`, and `onboarding.reset` events
5. **Hub Empty States** — Add welcoming empty states with clear first-action guidance to User Hub, Data Exchange Hub, and Event Catalog

---

## Scope

### In Scope

- **OnboardingService** as new domain service under `src/domain/onboarding/`
  - `OnboardingService` with `ITypedStorage<OnboardingState>` under `onboarding` key
  - Migration from `AnalyticsState.onboardingChecklist` to `OnboardingState.checklist`
  - Methods: `init()`, `markCalloutDismissed()`, `isFirstVisit()`, `resetAll()`, `getState()`
  - `OnboardingState` type: `{ checklist, dismissedCallouts, firstVisits, startedAt, completedAt }`
- **Contextual callouts** on 4 Hub views
  - Non-blocking banners at the top of the view on first visit
  - Each callout: icon, title, 1-2 sentence description, suggested first action, dismiss button
  - Callout content co-located with the Hub view (not centralised)
  - `BaseHubView` gains `renderOnboardingCallout()` protected helper
- **Settings reset**
  - "Reset onboarding" button in Flowti Settings under a new "Onboarding" section
  - Resets checklist, clears dismissed callouts, clears first-visit records
- **Onboarding events**
  - `OnboardingEventMap` extending the main `EventMap`
  - 4 events: started, step.completed, completed, reset
  - Registered in event catalog with "Onboarding" category
- **Hub empty states**
  - User Hub: welcome hero explaining Hubs, subscriptions, sessions
  - Data Exchange Hub: welcome hero explaining import/export/pipeline workflow
  - Event Catalog: welcome hero explaining events, flows, domains

### Out of Scope

- Configurable startpage (PBI-ONB-014) — separate UX feature
- Role-specific seed data service (PBI-ONB-015) — requires design
- Command catalog (PBI-ONB-016) — larger feature scope
- Guided tours (PBI-ONB-018) — depends on process framework
- Train Hub empty state — already has minimal canvas guidance
- Onboarding for non-Hub views (Settings, modals)

---

## Increments

### Inc 1: OnboardingService Extraction (PBI-ONB-012)

**Goal:** Extract onboarding state management from AnalyticsService into a standalone `OnboardingService` with its own storage key, migrating existing checklist state.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/onboarding/types.ts` | **New** — `OnboardingState`, `OnboardingCallout`, `IOnboardingService` interface | +40 |
| `src/domain/onboarding/OnboardingService.ts` | **New** — service with init, callout tracking, first-visit, reset, persistence | +120 |
| `src/domain/onboarding/events.ts` | **New** — `OnboardingEventMap` with 4 events | +25 |
| `src/infrastructure/events/events.ts` | Extend `FlowtiEventMap` with `OnboardingEventMap` | +2 |
| `src/infrastructure/events/catalog.ts` | Register 4 onboarding events in "Onboarding" category | +15 |
| `src/domain/analytics/AnalyticsService.ts` | Remove onboarding methods, delegate to OnboardingService | -40 |
| `src/domain/analytics/types.ts` | Keep `OnboardingChecklist` type (shared), remove from `AnalyticsState` after migration | -5 |
| `src/main.ts` | Register OnboardingService, wire migration, update `installer.completed` handler | +15 |
| `tests/domain/onboarding/OnboardingService.test.ts` | **New** — init, migration, callout tracking, first-visit, reset, persistence | +100 |
| `tests/domain/analytics/AnalyticsService.test.ts` | Remove onboarding checklist tests (moved to OnboardingService tests) | -40 |

**Design:**

- **OnboardingState type:**
  ```typescript
  interface OnboardingState {
    checklist: OnboardingChecklist;      // migrated from AnalyticsState
    dismissedCallouts: string[];         // callout IDs that were dismissed
    firstVisits: Record<string, string>; // viewType → ISO timestamp
    startedAt: string;                   // ISO timestamp
    completedAt?: string;                // set when all milestones done
  }
  ```

- **Migration strategy:**
  1. `OnboardingService.load()` checks if `onboarding` key exists
  2. If not, reads `AnalyticsState.onboardingChecklist` (via callback)
  3. If checklist found, creates `OnboardingState` with migrated checklist
  4. Saves to `onboarding` key
  5. AnalyticsService clears `onboardingChecklist` field on next save
  6. Idempotent: if `onboarding` key already exists, skip migration

- **Service registration:**
  - Created in `main.ts` with its own `ITypedStorage<OnboardingState>`
  - Passed to AnalyticsDashboardPage (replacing direct checklist access)
  - Passed to BaseHubView subclasses (for callout rendering)

**AC:**

- [ ] `OnboardingService` created in `src/domain/onboarding/` with own storage key
- [ ] Existing checklist state migrated from AnalyticsState on first load
- [ ] AnalyticsService no longer owns onboarding methods
- [ ] `AnalyticsDashboardPage` reads checklist from OnboardingService (not AnalyticsService)
- [ ] 4 onboarding events registered in event catalog
- [ ] All existing onboarding behaviour preserved (checklist renders, milestones auto-check)
- [ ] `npm test` passes

**Tests:** ~12 new (migration, init, callout CRUD, first-visit tracking, reset, persistence)

---

### Inc 2: Contextual View Callouts (PBI-ONB-010)

**Goal:** Show dismissible first-visit callout banners on Event Catalog, Data Exchange Hub, User Hub, and Train Hub.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/BaseHubView.ts` | Add `renderOnboardingCallout()` protected helper | +40 |
| `src/ui/EventCatalogView.ts` | Add callout content + render on first visit | +15 |
| `src/ui/DataExchangeHubView.ts` | Add callout content + render on first visit | +15 |
| `src/ui/UserHubView.ts` | Add callout content + render on first visit | +15 |
| `src/ui/train/TrainHubView.ts` | Add callout content + render on first visit | +15 |
| `src/domain/onboarding/OnboardingService.ts` | Add `recordFirstVisit()`, `hasVisited()` methods | +15 |
| `tests/ui/onboarding/callouts.test.ts` | **New** — callout rendering, dismiss persistence, first-visit detection | +80 |

**Design:**

- **Callout UI pattern:**
  ```
  ┌──────────────────────────────────────────────────────── [✕] ─┐
  │  📋 Welcome to the Event Catalog                              │
  │                                                                │
  │  This is where all your vault events live — file changes,     │
  │  imports, subscriptions, and domain events. Use the tabs to   │
  │  filter by category.                                          │
  │                                                                │
  │  → Try browsing the "Lifecycle" category to see install events │
  └────────────────────────────────────────────────────────────────┘
  ```

- **BaseHubView integration:**
  - `renderOnboardingCallout(container, calloutDef)` renders the banner if:
    1. OnboardingService reports this view has NOT been visited before
    2. The callout for this view has NOT been dismissed
  - After rendering, `recordFirstVisit(viewType)` is called
  - Dismiss button calls `markCalloutDismissed(calloutId)` and removes the element

- **Callout definitions (co-located per view):**
  - Event Catalog: "Events drive everything in Flowti. Browse categories to see file changes, imports, and domain events."
  - DX Hub: "Import CSVs, export data, build pipelines. Start by dropping a CSV into your imports folder."
  - User Hub: "Your personal dashboard. See hub summaries, manage subscriptions, and start sessions."
  - Train Hub: "Build knowledge graphs on canvas. Create a train of thought to connect ideas visually."

**AC:**

- [ ] First visit to Event Catalog shows a dismissible callout banner
- [ ] First visit to Data Exchange Hub shows a dismissible callout banner
- [ ] First visit to User Hub shows a dismissible callout banner
- [ ] First visit to Train Hub shows a dismissible callout banner
- [ ] Dismissing a callout persists — does not reappear
- [ ] Second visit to any view does NOT show the callout (even if not dismissed)
- [ ] Callouts do not appear if onboarding was already completed or dismissed
- [ ] `npm test` passes

**Tests:** ~12 new (4 views × 3 scenarios: first-visit render, dismiss persist, no-show on second visit)

---

### Inc 3: Onboarding Reset from Settings (PBI-ONB-011)

**Goal:** Add a "Reset onboarding" button to FlowtiSettingsTab that restores all callouts and the Getting Started checklist.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/FlowtiSettingsTab.ts` | Add "Onboarding" section with Reset button and description | +25 |
| `src/domain/onboarding/OnboardingService.ts` | Ensure `resetAll()` clears checklist, callouts, first-visits; emits `onboarding.reset` | +5 |
| `tests/domain/onboarding/OnboardingService.test.ts` | Test reset clears all state, emits event | +15 |
| `tests/ui/FlowtiSettingsTab.test.ts` | Test settings section renders, button triggers reset | +20 |

**Design:**

- **Settings UI:**
  ```
  ── Onboarding ──────────────────────────────────────────

  Getting Started guides and contextual tips help you     [Reset Onboarding]
  learn Flowti's features. Reset to see them again.
  ```

- **Reset behaviour:**
  1. `OnboardingService.resetAll()` called
  2. Creates fresh `OnboardingState` with `installed: true` milestone only
  3. Clears `dismissedCallouts` and `firstVisits`
  4. Emits `onboarding.reset` event
  5. Button shows "Reset" → "Resetting..." → "Done" feedback

- **Edge case:** If Analytics Hub is open when reset is triggered, the checklist should reappear on next render. This works naturally via `scheduleRender()`.

**AC:**

- [ ] "Onboarding" section appears in Flowti Settings
- [ ] "Reset Onboarding" button triggers full reset
- [ ] After reset, Getting Started checklist reappears on Analytics Hub
- [ ] After reset, Hub callouts reappear on next first visit
- [ ] Reset emits `onboarding.reset` event
- [ ] Button shows feedback during reset
- [ ] `npm test` passes

**Tests:** ~8 new

---

### Inc 4: Onboarding Lifecycle Events (PBI-ONB-013)

**Goal:** Emit onboarding lifecycle events so other domains can react to onboarding progress.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/onboarding/OnboardingService.ts` | Wire event emission into init, milestone update, completion, reset | +20 |
| `src/domain/onboarding/events.ts` | Define payloads for 4 events | +10 |
| `tests/domain/onboarding/OnboardingService.test.ts` | Test event emission on each lifecycle transition | +30 |

**Design:**

- **Events:**

  | Event | Payload | Trigger |
  |-------|---------|---------|
  | `onboarding.started` | `{ startedAt: string }` | `init()` creates fresh state (first install) |
  | `onboarding.step.completed` | `{ milestone: string, completedCount: number, totalCount: number }` | Milestone flips from false to true |
  | `onboarding.completed` | `{ completedAt: string, duration: number }` | All 5 milestones true |
  | `onboarding.reset` | `{}` | `resetAll()` called from Settings |

- **Milestone update hook:** `updateChecklist()` compares before/after milestones. For each newly-true milestone, emits `onboarding.step.completed`. If all 5 are true and `completedAt` is not set, emits `onboarding.completed`.

- **Event catalog registration:** Category "Onboarding", no `["system"]` tags (user-facing events).

**AC:**

- [ ] `onboarding.started` emits when checklist is first initialised
- [ ] `onboarding.step.completed` emits for each newly completed milestone
- [ ] `onboarding.completed` emits when all milestones are true
- [ ] `onboarding.reset` emits when reset from Settings
- [ ] Events appear in Event Catalog under "Onboarding" category
- [ ] Events do NOT emit on load (only on state transitions)
- [ ] `npm test` passes

**Tests:** ~10 new (4 event types × 2-3 scenarios: emit on transition, no-emit on reload, payload correctness)

---

### Inc 5: Hub Empty States (PBI-ONB-017)

**Goal:** Add welcoming empty states with clear first-action guidance to User Hub, Data Exchange Hub, and Event Catalog.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/UserHubView.ts` | Add `renderEmptyState()` — welcome hero with hub explanation and first actions | +50 |
| `src/ui/DataExchangeHubView.ts` | Add or enhance empty state — welcome hero with import/export guidance | +50 |
| `src/ui/EventCatalogView.ts` | Add empty state for zero-events scenario — explanation + "events will appear as you use Flowti" | +40 |
| `tests/ui/UserHubView.test.ts` | Test empty state renders with correct content | +20 |
| `tests/ui/DataExchangeHubView.test.ts` | Test empty state renders | +20 |
| `tests/ui/EventCatalogView.test.ts` | Test empty state renders | +20 |

**Design:**

- **User Hub empty state:**
  ```
  ┌──────────────────────────────────────────────────────┐
  │           (user icon, 2.5rem)                        │
  │                                                      │
  │        Welcome to Your Hub                           │
  │   Your personal dashboard showing hub summaries,     │
  │   active sessions, and subscriptions.                │
  │                                                      │
  │   ┌──────────────────┐  ┌──────────────────────────┐ │
  │   │ Open Analytics   │  │ Start a Session          │ │
  │   │ Hub              │  │                          │ │
  │   │ Explore your     │  │ Begin a focused work     │ │
  │   │ dashboards and   │  │ session to capture       │ │
  │   │ query data       │  │ notes and decisions      │ │
  │   └──────────────────┘  └──────────────────────────┘ │
  └──────────────────────────────────────────────────────┘
  ```

- **DX Hub empty state:**
  - Icon: `file-input`, heading: "Data Exchange Hub"
  - Subtitle: "Import CSVs, export data, and build automated pipelines."
  - Action cards: "Import a CSV" (navigate to imports tab) | "Browse Templates" (navigate to templates tab)

- **Event Catalog empty state:**
  - Icon: `activity`, heading: "Event Catalog"
  - Subtitle: "Events appear as you use Flowti — file changes, imports, sessions, and more."
  - Single info card: "Events will populate automatically. Try importing a CSV or starting a session."

- **Pattern:** Reuse the same visual pattern as the Analytics Hub empty state (`ft-stat-card` CSS, icon + heading + subtitle + action cards grid).

**AC:**

- [ ] User Hub shows welcoming empty state when no content exists
- [ ] DX Hub shows welcoming empty state when no imports/exports exist
- [ ] Event Catalog shows informative empty state when no events exist
- [ ] Empty states include clear first-action guidance
- [ ] Empty states use consistent visual pattern (icon + heading + action cards)
- [ ] Empty states disappear once content exists
- [ ] `npm test` passes

**Tests:** ~13 new

---

## Dependency Graph

```
Inc 1 (OnboardingService Extraction) ── foundation for all other increments
    |
    +──> Inc 2 (Contextual Callouts) ── depends on Inc 1 (needs OnboardingService.isFirstVisit/markCalloutDismissed)
    |
    +──> Inc 3 (Settings Reset) ── depends on Inc 1 (needs OnboardingService.resetAll)
    |
    +──> Inc 4 (Lifecycle Events) ── depends on Inc 1 (events emitted from OnboardingService methods)
    |
Inc 5 (Hub Empty States) ── independent (UI-only, no OnboardingService dependency)
```

**Execution order:** Inc 1 → Inc 2 → Inc 3 → Inc 4 → Inc 5
**Critical path:** Inc 1 (all others depend on it except Inc 5)
**Parallelism:** Inc 5 can run in parallel with Inc 2–4

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration from AnalyticsState loses existing checklist data | High | Idempotent migration: read from analytics, write to onboarding, clear analytics only after confirmed save |
| BaseHubView callout helper adds complexity to base class | Medium | Keep helper minimal (~40 LOC); callout content is defined per subclass, not in base |
| Callouts feel intrusive on views that already have content | Medium | Callouts only show on first visit; auto-hide if view has content; always dismissible |
| Settings reset causes confusion (user accidentally resets) | Low | Confirmation dialog before reset; button text clearly states what will happen |
| Empty states flash briefly before content loads | Low | Check content count before rendering empty state; render behind loading guard |
| OnboardingService adds a new storage key (breaks clean installs?) | Low | Fresh install creates `onboarding` state via `init()`; no pre-existing data to corrupt |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~55 |
| Post-cycle total tests | ~5,256 |
| Post-cycle suites | ~222 |
| Increments | 5 |
| New source files | 3 (OnboardingService.ts, types.ts, events.ts) |
| Onboarding events registered | 4 |
| Hub views with empty states | 4 (Analytics + User + DX + Event Catalog) |
| Hub views with first-visit callouts | 4 (Event Catalog + DX + User + Train) |
| Onboarding FRs delivered | FR-3, FR-6, FR-13, FR-14, FR-15, FR-20 (6 FRs) |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| PBI-ONB-014 Configurable Startpage | Settings UX feature; not core onboarding | Future |
| PBI-ONB-015 Role-Specific Seed Data Service | Requires design for multi-persona system | Future |
| PBI-ONB-016 Command Catalog | Larger feature scope; needs design cycle | Future |
| PBI-ONB-018 Guided Tours | Depends on process framework maturity | Future |
| Project Manager seed content | Role visible in wizard but content deferred | Cycle 48+ |
| Example domain seeding (events, flows, actors) | Different seed pack; needs domain design | Cycle 48+ |
| Train Hub empty state enhancement | Current canvas guidance sufficient | Future |
| Onboarding analytics/telemetry | Out of scope per PRD | Out of scope |

---

## Definition of Ready (Pre-Cycle)

- [x] Cycle 46 delivered — all tests green, no blocking bugs
- [x] `npm test` passes (5,201 tests, 219 suites) — verified 2026-02-26
- [x] Onboarding PRD v2 approved — 20 FRs across 3 phases, 17 PBIs in backlog
- [x] Phase 2 PBIs defined (PBI-ONB-010 through PBI-ONB-013, PBI-ONB-017) — each has problem, approach, and AC in cycle plan
- [x] `AnalyticsState.onboardingChecklist` structure understood — migration target is new `OnboardingState` type
- [x] `BaseHubView` extension pattern established — protected helpers (`addUnsubscribe`, `scheduleRender`, `navigateTo`) are the integration point for callouts
- [x] `FlowtiSettingsTab` extension pattern established — sections added via `containerEl.createEl()` chains, `Setting` component for controls
- [x] Event registration pattern established — `EventMap` extension via interface merging, catalog registration with category/tags
- [x] Analytics Hub empty state pattern established (C45) — icon + heading + subtitle + action cards grid using `ft-stat-card` CSS
- [x] Backlog refinement completed (2026-02-26) — 13 inbox items triaged, all Phase 2 items scoped
