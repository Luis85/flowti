---
type: DevelopmentCycle
feature: "[[Onboarding PRD]]"
stage: completed
cycle: 47
date_planned: 2026-02-26
date_completed: 2026-02-26
pbis:
  - "[[PBI-ONB-012 OnboardingService Extraction]]"
  - "[[PBI-ONB-010 Contextual View Callouts]]"
  - "[[PBI-ONB-011 Onboarding Reset from Settings]]"
  - "[[PBI-ONB-013 Onboarding Lifecycle Events]]"
  - "[[PBI-ONB-017 Hub Empty States]]"
bugs: []
bugs_fixed_precycle: []
bugs_fixed:
  - "Event Catalog Hub crash — ViewDependencies lazy getter for OnboardingService"
  - "Floating promise warning in main.ts — added void prefix to onboardingSvc?.initChecklist()"
tech_debt:
  - "TD-23: InstallerWizardModal mixes state and rendering (now 774 LOC)"
tech_debt_resolved: []
estimated_increments: 5
actual_increments: 2
estimated_tests: 55
actual_new_tests: 82
pre_cycle_tests: 5201
pre_cycle_suites: 219
post_cycle_tests: 5283
post_cycle_suites: 221
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
- **Installer UX gaps** — Review page items have no user preferences (sample content is all-or-nothing), folder tree is too bulky with verbose descriptions, card headers are inconsistent, role selection requires a separate page adding friction, and non-interactive items show pointer cursors.

**Business Trigger:** Cycle 46 delivered Phase 1: Getting Started checklist, seed dashboard, empty state redesign. Users who follow the Analytics Hub path are well-served. But users who explore other Hubs hit dead ends. Phase 2 extends onboarding across all major views, extracts onboarding into its own domain, adds the infrastructure for future progressive discovery, and polishes the installer wizard UX based on real user feedback.

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

**Installer wizard status (post-C46):**
- InstallerWizardModal: 5 pages (Welcome → Role → Review → Progress → Complete), ~574 LOC
- Review page: flat list of folder entries with verbose descriptions
- Cards: inconsistent header sizing and icon alignment
- Role selection: separate dedicated page between Welcome and Review
- No user preference for sample content (always installed)
- Button alignment: inconsistent (all right-aligned)

---

## Backlog Refinement

### Inbox Items Processed

| Source | Item | Decision | Rationale |
|--------|------|----------|-----------|
| Onboarding PRD Phase 2 | PBI-ONB-012 OnboardingService Extraction | **IN SCOPE** (Inc 1) | Foundation: must decouple from AnalyticsService before adding cross-hub features |
| Onboarding PRD Phase 2 | PBI-ONB-010 Contextual View Callouts | **IN SCOPE** (Inc 1) | Core deliverable: first-visit callouts for Event Catalog, DX Hub, User Hub |
| Onboarding PRD Phase 2 | PBI-ONB-011 Onboarding Reset from Settings | **IN SCOPE** (Inc 1) | Enables replay and new-team-member scenario |
| Onboarding PRD Phase 2 | PBI-ONB-013 Onboarding Lifecycle Events | **IN SCOPE** (Inc 1) | Infrastructure: enables event-driven integrations |
| Onboarding PRD Phase 3 | PBI-ONB-017 Hub Empty States | **IN SCOPE** (Inc 1) | UX completeness: welcoming empty states beyond Analytics Hub |
| User feedback | Installer preferences & polish | **IN SCOPE** (Inc 2) | UX feedback: sample content toggle, compact tree, card uniformity, role on welcome page |
| C46 deferred | Full OnboardingService | **Absorbed** (Inc 1) | This IS the OnboardingService extraction |
| C46 deferred | Example domain seeding | **Deferred** | Different feature scope; not contextual guidance |
| C46 deferred | Project Manager seed content | **Deferred** | Role-specific content; separate from Phase 2 |
| Phase 3 | PBI-ONB-014 Configurable Startpage | **Deferred** | Settings UX feature; not core onboarding |
| Phase 3 | PBI-ONB-015 Role-Specific Seed Data Service | **Deferred** | Requires design cycle for multi-persona system |
| Phase 3 | PBI-ONB-016 Command Catalog | **Deferred** | Feature discovery; larger scope |
| Phase 3 | PBI-ONB-018 Guided Tours | **Deferred** | Depends on process framework maturity |

### Scope Decision

This cycle delivers **cross-hub contextual onboarding** and **installer UX polish**: a standalone OnboardingService with its own persistence, first-visit callouts for 4 Hub views, a Settings reset button, onboarding lifecycle events, welcoming empty states for views beyond Analytics Hub, plus optional sample content preference, compact folder tree, card uniformity, and a streamlined 4-page wizard with role selection on the welcome page.

---

## Cycle Goals

1. **OnboardingService Extraction** — Extract onboarding logic from AnalyticsService into a standalone `OnboardingService` with its own `onboarding` storage key, migrating existing checklist state
2. **Contextual View Callouts** — Show dismissible first-visit callout banners on Event Catalog, Data Exchange Hub, User Hub, and Train Hub explaining what the view does and suggesting first actions
3. **Onboarding Reset from Settings** — Add "Reset onboarding" button to FlowtiSettingsTab that restores all callouts and the Getting Started checklist
4. **Onboarding Lifecycle Events** — Emit `onboarding.started`, `onboarding.step.completed`, `onboarding.completed`, and `onboarding.reset` events
5. **Hub Empty States** — Add welcoming empty states with clear first-action guidance to User Hub, Data Exchange Hub, and Event Catalog
6. **Installer Preferences & Polish** — Optional sample content toggle, compact folder tree, uniform card headers, role selector on welcome page, button alignment, cursor and layout fixes

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
- **Installer preferences & polish** (reactive to user feedback)
  - Optional sample content toggle on Review page
  - Compact folder tree (name-only child rows, no descriptions, tighter spacing)
  - Uniform card headers via `renderCardHeader()` helper (14px icon + small bold label)
  - Role selector merged into welcome page (4-page wizard instead of 5)
  - Button alignment: cancel/back left, progress/primary right
  - `cursor:default` on non-interactive list items
  - Complete page: headline first, then icon
  - Complete page tips adapt to `includeSampleContent` preference

### Out of Scope

- Configurable startpage (PBI-ONB-014) — separate UX feature
- Role-specific seed data service (PBI-ONB-015) — requires design
- Command catalog (PBI-ONB-016) — larger feature scope
- Guided tours (PBI-ONB-018) — depends on process framework
- Train Hub empty state — already has minimal canvas guidance
- Onboarding for non-Hub views (Settings, modals)

---

## Increments

### Inc 1: Onboarding Infrastructure & Cross-Hub Guidance (PBI-ONB-012, ONB-010, ONB-011, ONB-013, ONB-017)

**Goal:** Deliver all 5 planned onboarding PBIs in a single increment: OnboardingService extraction, contextual callouts, settings reset, lifecycle events, and hub empty states.

**Commit:** `8568cd7` — 32 files changed, +1,626 / -184

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/onboarding/types.ts` | **New** — `OnboardingState`, `OnboardingCallout`, `IOnboardingService` | +42 |
| `src/domain/onboarding/OnboardingService.ts` | **New** — service with init, callout tracking, first-visit, reset, persistence, lifecycle events | +213 |
| `src/domain/onboarding/events.ts` | **New** — `OnboardingEventMap` with 4 events | +32 |
| `src/infrastructure/events/events.ts` | Extend `FlowtiEventMap` with `OnboardingEventMap` | +3 |
| `src/infrastructure/events/catalog.ts` | Register 8 onboarding events in "Onboarding" category | +8 |
| `src/infrastructure/services/registry.ts` | Register OnboardingService in service registry | +16 |
| `src/infrastructure/views/registry.ts` | Pass OnboardingService to view dependencies | +4 |
| `src/domain/analytics/AnalyticsService.ts` | Remove onboarding methods, delegate to OnboardingService | +39/-some |
| `src/domain/settings/FlowtiSettingTab.ts` | Add "Onboarding" section with Reset button | +26 |
| `src/domain/settings/settings.ts` | Add `showOnboardingCallouts` setting | +1 |
| `src/main.ts` | Register OnboardingService, wire `installer.completed` handler | +26 |
| `src/ui/BaseHubView.ts` | Add `renderOnboardingCallout()` protected helper | +51 |
| `src/ui/AnalyticsHubView.ts` | Add callout + empty state integration | +5 |
| `src/ui/DataExchangeHubView.ts` | Add callout content + render on first visit | +12 |
| `src/ui/EventCatalogView.ts` | Add callout content + enhanced empty state | +13 |
| `src/ui/UserHubView.ts` | Add callout content + render on first visit | +12 |
| `src/ui/train/TrainHubView.ts` | Add callout content + render on first visit | +12 |
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Read checklist from OnboardingService | +15 |
| `src/ui/analytics/types.ts` | Add OnboardingService to analytics deps | +2 |
| `src/ui/catalog/CatalogDashboard.ts` | Enhanced dashboard with onboarding awareness | +69 |
| `src/ui/hub/HubDashboard.ts` | **New** — base hub dashboard component | +82 |
| `src/ui/userHub/UserHubDashboard.ts` | **New** — User Hub dashboard with empty state | +80 |
| `src/dataExchangeSetup.ts` | Wire onboarding callout | +3 |
| `tests/domain/onboarding/OnboardingService.test.ts` | **New** — init, migration, callout, first-visit, reset, events | +516 |
| `tests/ui/BaseHubView.callout.test.ts` | **New** — callout rendering, dismiss, first-visit | +136 |
| `tests/ui/userHub/UserHubDashboard.test.ts` | **New** — empty state rendering | +98 |
| `tests/domain/settings/FlowtiSettingTab.test.ts` | Test settings section renders, reset button | +31 |
| `tests/domain/analytics/AnalyticsService.test.ts` | Remove migrated onboarding tests | -89/+some |
| `tests/ui/catalog/CatalogDashboard.test.ts` | Update for enhanced dashboard | +37 |
| `tests/ui/hub/HubDashboard.test.ts` | Update for hub dashboard | +76 |
| `tests/ui/train/TrainHubView.test.ts` | Add callout tests | +60 |
| `tests/ui/catalog/helpers.test.ts` | Minor update | +1 |

**AC:**

- [x] `OnboardingService` created in `src/domain/onboarding/` with own storage key
- [x] Existing checklist state migrated from AnalyticsState on first load
- [x] AnalyticsService no longer owns onboarding methods
- [x] `AnalyticsDashboardPage` reads checklist from OnboardingService (not AnalyticsService)
- [x] 8 onboarding events registered in event catalog
- [x] All existing onboarding behaviour preserved (checklist renders, milestones auto-check)
- [x] First visit to Event Catalog shows a dismissible callout banner
- [x] First visit to Data Exchange Hub shows a dismissible callout banner
- [x] First visit to User Hub shows a dismissible callout banner
- [x] First visit to Train Hub shows a dismissible callout banner
- [x] Dismissing a callout persists — does not reappear
- [x] "Onboarding" section appears in Flowti Settings with "Reset Onboarding" button
- [x] `onboarding.started`, `.step.completed`, `.completed`, `.reset` events emit correctly
- [x] User Hub, DX Hub, Event Catalog show welcoming empty states
- [x] `npm test` passes

**Tests:** 48 new

---

### Bug Fix: Event Catalog Hub Crash

**Commit:** `d305873` — 2 files changed, +3 / -3

**Problem:** Event Catalog Hub crashed on load because `ViewDependencies` eagerly resolved `OnboardingService` before it was registered.

**Fix:** Changed `ViewDependencies` to use a lazy getter `getOnboardingService: () => OnboardingService` instead of direct property access. Updated `main.ts` to wire the lazy getter.

| File | Action |
|------|--------|
| `src/infrastructure/views/registry.ts` | Use lazy getter for OnboardingService |
| `src/main.ts` | Wire lazy getter in view dependency setup |

---

### Inc 2: Installer Preferences & Polish (User Feedback)

**Goal:** Address user feedback on the installer wizard: add optional sample content preference, compact the folder tree, make cards uniform, merge role selection into the welcome page, fix button alignment and cursor behaviour, and refine the complete page layout.

**Commit:** `383bc40` — 7 files changed, +695 / -187

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/installer/InstallerWizardModal.ts` | Major overhaul — role on welcome page (4 pages), sample content toggle, compact tree, card uniformity, button alignment, cursor fix, complete page layout | +500/-187 |
| `src/domain/installer/InstallerService.ts` | Pass `includeSampleContent` in `installer.completed` event payload | +5 |
| `src/domain/installer/events.ts` | Extend `installer.completed` payload with `includeSampleContent?: boolean` | +2 |
| `src/domain/installer/steps/SeedContentStep.ts` | Early return when `context.includeSampleContent === false` (skip) | +4 |
| `src/main.ts` | Check `includeSampleContent !== false` before calling `seedSupplierDashboard` | +6 |
| `tests/domain/installer/InstallerWizardModal.test.ts` | Comprehensive wizard tests (39 total, 31→39) | +331/-some |
| `tests/domain/installer/steps/SeedContentStep.test.ts` | 3 new tests for skip preference | +34 |

**Design Decisions:**

- **4-page wizard** — Merged role selection into the welcome page. Users choose name + role on one page, reducing friction. `WizardPage = "welcome" | "review" | "progress" | "complete"`. Step indicator shows 4 steps (Welcome, Review, Install, Done).

- **Role cards with icons** — Each role option (`RoleOption`) has an `icon` field. Cards show 18px icon + label + optional badge + description. Selected card has accent border. Project Manager is disabled with "Coming Soon" badge.

- **Optional sample content** — `includeSampleContent` boolean field (default `true`). Review page shows a `Setting` toggle "Include sample data". When off: Sample Content card shows "Sample data will not be installed", Dashboard card hidden entirely. `SeedContentStep` returns `{ status: "skipped" }` when false.

- **Compact folder tree** — Child rows show name only (no description), smaller font (`var(--font-ui-smaller)`), tighter padding (`0.1rem`). Top-level rows have no descriptions either. Arrows and badges use `0.65rem` font. Card padding reduced from `ft-p-3` to `ft-p-2`.

- **Uniform card headers** — `renderCardHeader()` helper renders 14px setIcon + `var(--font-ui-small)` bold label span. Replaced all `h3` headings with this pattern. Content cards use `text-align: left`.

- **Button alignment** — Cancel/Back on left, Next/Install/primary on right via `ft-justify-between`. Close on left, Retry/Explore on right for complete page.

- **Cursor fix** — Added `cursor:default` to folder list, content list, and dashboard list containers. Only expandable folder toggles retain `cursor:pointer`.

- **Complete page layout** — Heading renders before hero icon (centered). Tips adapt to `includeSampleContent`: when false, omits dashboard and sample data tips; shows 2 generic tips instead of 4. "Explore Your Dashboard" button hidden when samples skipped.

**AC:**

- [x] Toggle renders on review page (`.setting-item` with "Include sample data")
- [x] When `includeSampleContent` is false, Sample Content card shows "Sample data will not be installed"
- [x] When `includeSampleContent` is false, Dashboard card is not rendered
- [x] When `includeSampleContent` is true (default), both cards show full detail
- [x] SeedContentStep returns "skipped" when `context.includeSampleContent === false`
- [x] `installer.completed` event carries `includeSampleContent` flag
- [x] `seedSupplierDashboard` skipped when `includeSampleContent === false`
- [x] Role selection on welcome page with icon cards (3 roles)
- [x] Wizard has 4 pages (Welcome → Review → Install → Done)
- [x] Step indicator shows 4 steps with correct active/completed state
- [x] Buttons: cancel/back left, progress/primary right on all pages
- [x] Folder tree: compact entries with name-only children, no descriptions
- [x] Card headers: uniform 14px icon + small bold label via `renderCardHeader()`
- [x] Non-interactive list items use `cursor:default`
- [x] Complete page: headline first (centered), then icon, then content
- [x] Complete page tips adapt to sample content preference
- [x] Keyboard navigation: Enter advances, Escape goes back on all pages
- [x] `npm test` passes — 5,283 tests, 221 suites

**Tests:** 34 new (8 modal tests + 3 SeedContentStep tests + updates to 23 existing tests)

---

## Dependency Graph

```
Inc 1 (Onboarding Infrastructure) ── foundation
    |
    +──> Bug Fix (Event Catalog crash) ── depends on Inc 1 (lazy getter for OnboardingService)
    |
Inc 2 (Installer Preferences & Polish) ── independent (wizard UI, user feedback)
```

**Execution order:** Inc 1 → Bug Fix → Inc 2
**Critical path:** Inc 1 (all onboarding depends on it)
**Inc 2** was reactive to user feedback and independent of the onboarding work.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration from AnalyticsState loses existing checklist data | High | Idempotent migration: read from analytics, write to onboarding, clear analytics only after confirmed save |
| BaseHubView callout helper adds complexity to base class | Medium | Keep helper minimal (~51 LOC); callout content is defined per subclass, not in base |
| Callouts feel intrusive on views that already have content | Medium | Callouts only show on first visit; auto-hide if view has content; always dismissible |
| Settings reset causes confusion (user accidentally resets) | Low | Confirmation dialog before reset; button text clearly states what will happen |
| Empty states flash briefly before content loads | Low | Check content count before rendering empty state; render behind loading guard |
| OnboardingService adds a new storage key (breaks clean installs?) | Low | Fresh install creates `onboarding` state via `init()`; no pre-existing data to corrupt |
| InstallerWizardModal grows beyond maintainable size | Medium | TD-23 still open; 774 LOC with rendering + state. Mitigated by `renderCardHeader()` helper extraction |

---

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| New tests | ~55 | 82 |
| Post-cycle total tests | ~5,256 | 5,283 |
| Post-cycle suites | ~222 | 221 |
| Increments | 5 | 2 (batched: Inc 1 delivered 5 PBIs, Inc 2 delivered installer polish) |
| New source files | 3 | 5 (OnboardingService.ts, types.ts, events.ts, HubDashboard.ts, UserHubDashboard.ts) |
| Onboarding events registered | 4 | 8 |
| Hub views with empty states | 4 | 4 (Analytics + User + DX + Event Catalog) |
| Hub views with first-visit callouts | 4 | 4 (Event Catalog + DX + User + Train) |
| Wizard pages | 5 (existing) | 4 (merged role into welcome page) |
| InstallerWizardModal LOC | — | 774 (was 574 pre-cycle) |

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
| TD-23 InstallerWizardModal decomposition | 774 LOC; needs page renderer extraction | Cycle 48+ |

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

## Definition of Done

### 1. All Increments Completed
- [x] 2 increments delivered, all PBIs addressed
- [x] 5 planned PBIs delivered in Inc 1 (batched)
- [x] Inc 2 reactive to user feedback (installer polish)
- [x] 1 bug fix (Event Catalog crash)

### 2. Quality Gates
- [x] `npm test` passes — 5,283 tests, 221 suites, all green
- [x] `npm run check` passes — no lint or type errors
- [x] All 82 new tests exercise the features they validate

### 3. Architecture
- [x] OnboardingService extracted to `src/domain/onboarding/` with own storage key
- [x] BaseHubView gains `renderOnboardingCallout()` helper for cross-hub callouts
- [x] Installer event payload extended with `includeSampleContent?: boolean`
- [x] SeedContentStep respects `includeSampleContent` context flag
- [x] InstallerWizardModal reduced from 5 to 4 pages (role merged into welcome)

### 4. User Experience
- [x] 4 Hub views show first-visit callouts (dismissible, persistent)
- [x] 4 Hub views show welcoming empty states
- [x] Settings: "Reset onboarding" button restores callouts and checklist
- [x] Wizard: 4-page flow (Welcome → Review → Install → Done)
- [x] Wizard: role selector with icon cards on welcome page
- [x] Wizard: optional sample content toggle on review page
- [x] Wizard: compact folder tree with expandable sections
- [x] Wizard: uniform card headers across all review sections
- [x] Wizard: cancel/back left, progress/primary right button alignment
- [x] Wizard: complete page headline-first layout with adaptive tips
- [x] Wizard: no pointer cursor on non-interactive items

### 5. Release Readiness
- [x] All tests pass (`npm test` — 5,283 tests, 221 suites)
- [ ] Demo script: reset → wizard → select role → toggle sample content → install → see dashboard → Hub callouts
- [ ] Verified via manual walkthrough

---

## DoD Verification (vs Definition of Done (Cycle))

### 1. All Increments Completed
- [x] Each increment satisfies its own DoD — all ACs checked off
- [x] No increment left in partial state — all fully delivered
- [x] Deferred items documented

### 2. Build & Test Quality
- [x] Build pipeline green — `npm test` passes (tsc + eslint + vitest, verified 2026-02-26)
- [x] Test count exceeds target — 82 new tests (target ~55)
- [x] No test regressions — all 5,283 tests pass
- [x] No skipped tests introduced — 32 pre-existing skips, no new ones
- [x] Test coverage per TestPlan — domain (OnboardingService 516 LOC), UI (callouts, hub dashboards, wizard), integration (SeedContentStep skip)

### 3. Three Amigos Review
- [ ] Cycle-level review conducted
- [ ] All three perspectives represented
- [ ] All blocker findings resolved
- [ ] TASM scores recorded
- [ ] Observations documented

### 4. PRD & Backlog Updates
- [ ] Onboarding PRD updated — FRs checked off, version incremented, stage history entry
- [ ] PBIs updated — ONB-010 through ONB-013, ONB-017 marked done
- [ ] Event model current — 8 new onboarding events added

### 5. Documentation
- [x] Component docs — OnboardingService, HubDashboard, UserHubDashboard documented in code
- [x] Architecture docs — onboarding domain established under `src/domain/onboarding/`
- [x] Flow docs — wizard 4-page flow documented in cycle plan
- [ ] Technical debt register — TD-23 still open (InstallerWizardModal 774 LOC)
- [x] ADRs — no new architectural decisions required

### 6. Cycle Plan Completion
- [x] Frontmatter updated — actual_increments, actual_new_tests, post_cycle_tests, post_cycle_suites, date_completed, stage
- [x] Success metrics verified — all metrics have actuals
- [x] Deviations documented — 5 PBIs batched into 1 increment; reactive Inc 2 for installer polish
- [x] Risks reviewed — see below

### 7. Cycle Retrospective
See Retrospective section below.

### 8. Inbox & Feedback Loop
- [x] Inbox items reviewed — all Phase 2 PBIs addressed
- [x] New feedback captured — installer UX feedback drove Inc 2
- [x] Next cycle inputs identified — see Deferred Items

---

## Risk Review

| Risk | Materialised? | Resolution |
|------|--------------|------------|
| Migration from AnalyticsState loses checklist data | **No** | Idempotent migration with callback pattern; clean separation |
| BaseHubView callout helper adds complexity | **No** | Helper is 51 LOC, minimal; callout content co-located per view |
| Callouts feel intrusive | **No** | First-visit only, dismissible, persistent state |
| Settings reset causes confusion | **No** | Clear button text; onboarding state only (no data loss) |
| Empty states flash briefly | **No** | Content count check before rendering |
| OnboardingService storage key breaks clean installs | **No** | Fresh install creates via `init()`; idempotent |
| InstallerWizardModal grows beyond maintainable size | **Partially** | Now 774 LOC (was 574). `renderCardHeader()` helper extracted. TD-23 remains open for full decomposition |
| Event Catalog crash from eager OnboardingService resolution | **Yes** | Fixed immediately — lazy getter pattern in ViewDependencies |

---

## Retrospective

### What Went Well
- **Batched delivery of 5 PBIs in Inc 1** — OnboardingService, callouts, settings reset, lifecycle events, and hub empty states were all interconnected. Delivering them together avoided integration friction and ensured consistent behaviour across all 4 Hub views.
- **Reactive Inc 2 driven by user feedback** — Real user testing of the installer revealed UX issues (verbose folder tree, no sample content preference, inconsistent cards). Addressing them immediately in the same cycle kept feedback loops tight.
- **renderCardHeader() helper** — Small extraction that brought visual consistency to all review page cards. Reusable pattern for future card-based UI.
- **4-page wizard reduction** — Merging role selection into the welcome page eliminated one navigation step. Role cards with icons are more visually engaging than a separate page.
- **SeedContentStep skip pattern** — Clean `context.includeSampleContent === false` guard is the right pattern for user preferences flowing through the installer pipeline.

### Deviations from Plan
- **5 PBIs batched into Inc 1** — Plan called for 5 separate increments. All 5 were delivered in a single commit due to their interdependency. This is reflected as `actual_increments: 2` vs `estimated_increments: 5`.
- **Reactive Inc 2 was unplanned** — Installer preferences and polish were not in the original plan. User feedback after Inc 1 drove this additional work.
- **Event Catalog crash** — Unplanned bug from Inc 1's OnboardingService integration. Fixed immediately in a separate commit.
- **Wizard reduced from 5 to 4 pages** — Original plan preserved the 5-page flow from C46. User feedback led to merging role selection into the welcome page.
- **82 tests vs 55 target** — Exceeded target by 49% due to the unplanned Inc 2 adding 34 installer tests and the comprehensive OnboardingService test suite (516 LOC).

### Improvement Backlog
| Item | Classification |
|------|---------------|
| TD-23: InstallerWizardModal (774 LOC) — extract page renderers into separate classes | Tech debt |
| Consider BaseHubView callout content registry (centralised instead of co-located) | Future enhancement |
| OnboardingService: add progressive discovery (feature-gated tips) | Future PRD |
| InstallerWizardModal: add animation/transitions between pages | UX enhancement |

### Learnings
- **Batching interconnected PBIs reduces integration overhead** — When 5 features share the same service, delivering them together avoids 4 rounds of "wire up, test, fix integration, test again".
- **User testing during the cycle is invaluable** — The installer UX issues (verbose tree, missing preferences, cursor bugs) were only visible through actual use. Plan for at least one user testing round per cycle.
- **Lazy getters prevent service registration order bugs** — Eager resolution of services during setup causes crashes when services depend on each other. Lazy getters (`() => service`) break the cycle cleanly.
- **`cursor:default` should be the default for informational lists** — CSS frameworks and class inheritance can inadvertently set `cursor:pointer` on non-interactive elements. Explicitly set `cursor:default` on list containers.
