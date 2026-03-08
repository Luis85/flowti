---
domain: Flowti/Plugin
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: in-progress
version: 2
related_events:
  - installer.completed
maturity: L2
business_value: 4
implementation_cost: 3
maintenance_cost: 2
discovery_cost: 2
design_cost: 3
test_cost: 2
priority: 3
tags:
  - onboarding
  - prd
  - core
---

# Onboarding PRD

## 1. Problem Statement

After the Installer completes its first-run setup (user profile, folder scaffolding), new users are left without guidance on what to do next. The vault is structurally ready but the user does not know how to use Flowti's features -- event catalog, data exchange, documentation tabs, subscriptions, or ingestion. Without progressive onboarding, users explore randomly, miss key features, and fail to build productive habits. The gap between "installed" and "productive" needs to be bridged.

## 2. Outcome

New users receive guided, contextual onboarding that introduces Flowti's core features progressively. Rather than a single tutorial dump, the onboarding system surfaces tips, walkthroughs, and suggested actions at the right moment -- when the user first opens a view, creates their first flow, or imports their first CSV. Users reach productivity faster and discover features they would otherwise miss.

## 3. Scope

### In Scope

**Phase 1 (Delivered — C45/C46):**
- Post-installer welcome guide with Getting Started checklist (5 milestones)
- Onboarding state tracking (milestones, dismissed, collapsed)
- Analytics Hub empty state redesign (welcome hero, action cards)
- Seed supplier dashboard and welcome note on first install
- Integration with `installer.completed` event

**Phase 2 (Planned):**
- Contextual callouts on first visit to each major Hub view
- Onboarding reset from Settings
- Standalone OnboardingService with dedicated storage
- Onboarding lifecycle events (started, step.completed, completed, reset)

**Phase 3 (Delivered — C50):**
- Configurable startpage (open preferred Hub on Obsidian start) — PBI-ONB-014, Done (C50)
- Command catalog / feature discovery — PBI-ONB-016, Done (C50)
- User Hub idea capture section — PBI-ONB-019, Done (C50)
- Quick Capture per-command configuration — PBI-ONB-020, Done (C50)
- Knowledge base expansion (10 tutorials) — TD-87, Done (C50)
- Onboarding integration & polish (new milestones, callouts) — Done (C50)

**Phase 3 (Deferred):**
- Role-specific seed data service (multiple personas) — PBI-ONB-015, deferred
- Guided tours via process execution framework — PBI-ONB-018, deferred
- Hub-specific empty states beyond Analytics Hub — PBI-ONB-017, deferred

### Out of Scope

- Interactive product tours with overlay highlighting (complex UI, low ROI for Obsidian plugin)
- Video tutorials or embedded media
- AI-powered personalized onboarding paths
- Multi-language onboarding content
- Analytics or telemetry on onboarding completion
- Vault structure detection and folder mapping (see vault inbox [[PRD - Onboarding]] — separate feature if needed)
- Project Management Setup tour (see vault inbox [[PRD - Onboarding]] — separate PRD scope)

## 4. UX Entry Points

The user must be able to pause or resume to the on-boarding at any given time. He can also skip the on-boarding after installation.

- **Post-installer**: Onboarding activates after `installer.completed` event
- **Event Catalog view**: First-visit callout explaining tabs and navigation
- **Data Exchange Hub**: First-visit callout explaining import/export workflow
- **Settings**: "Reset onboarding" button to replay all tips
- **Status bar or notice**: "Getting Started" checklist accessible from plugin UI

## 5. Functional Requirements

### Phase 1 — Getting Started Checklist (Cycle 45/46 — Delivered)

- [x] FR-1: Listen to `installer.completed` event to trigger onboarding start — `initOnboardingChecklist()` called after installer completes and supplier dashboard seeds
- [x] FR-2: Display a "Getting Started" checklist with 5 milestone items (installed, first_source, first_query, first_dashboard, first_pin) — rendered as collapsible card on Analytics Hub homepage
- [x] FR-4: Track which onboarding milestones have been completed or dismissed — `OnboardingChecklist.milestones` object with per-milestone boolean flags
- [x] FR-5: Persist onboarding state so dismissed tips do not reappear — `OnboardingChecklist` stored in `AnalyticsState` via TypedStorage
- [x] FR-7: Provide non-intrusive UI (dismissible callouts, not blocking modals) — checklist is collapsible and dismissible
- [x] FR-8: Mark checklist items as complete when the user performs the associated action — auto-milestone checking via `updateOnboardingChecklist()` deep merge
- [x] FR-9: Analytics Hub empty state shows welcome hero with "Build a Query" and "Load Sample Hub" action cards + "How it works" 3-step progression
- [x] FR-10: Seed supplier dashboard with 5 tiles (3 stat-cards, 1 bar chart, 1 table) and 2 queries on first install, set as default dashboard
- [x] FR-11: Seed welcome note (`Welcome to Flowti.md`) with first steps, key concepts, and command palette tip
- [x] FR-12: Emit onboarding-related events: `installer.completed` triggers `initOnboardingChecklist()`; milestones auto-update on user actions

### Phase 2 — Contextual Guidance (Planned)

- [ ] FR-3: Show contextual callouts on first visit to: Event Catalog, Data Exchange Hub, User Hub, Analytics Hub (non-checklist views)
- [ ] FR-6: Allow users to reset onboarding from Settings — "Reset onboarding" button clears checklist, re-shows all callouts
- [ ] FR-13: Emit `onboarding.started`, `onboarding.step.completed`, `onboarding.completed`, and `onboarding.reset` events with appropriate payloads
- [ ] FR-14: Onboarding state extracted to standalone `OnboardingService` with own `onboarding` storage key (decoupled from AnalyticsState)
- [ ] FR-15: Each Hub view checks onboarding state on open — if first visit, render a dismissible callout banner explaining the view's purpose and key actions

### Phase 3 — Progressive Discovery (C50 — Partially Delivered)

- [x] FR-16: Configurable startpage — user sets preferred Hub view to open on Obsidian start; `StartpageHandler` listens to `layout-ready` event (C50 Inc 3)
- [ ] FR-17: Role-specific seed data service — generalise `seedSupplierDashboard()` into a configurable seed service supporting multiple personas with different demo datasets (deferred)
- [x] FR-18: Command catalog — browsable Command Catalog tab in User Hub showing all 40+ Flowti commands grouped by domain with descriptions, icons, and click-to-execute (C50 Inc 1–2)
- [ ] FR-19: Guided tours via process execution framework — multi-step interactive flows that walk users through key workflows (deferred)
- [ ] FR-20: Hub-specific empty states — each Hub view has a welcoming empty state with clear first-action guidance (deferred)

## 6. Data Model Impact

### Current (Phase 1 — C46)

| Entity | Fields | Storage |
|--------|--------|---------|
| `OnboardingChecklist` | dismissed (boolean), collapsed (boolean), milestones: `OnboardingMilestones` | `analytics` storage key (nested in `AnalyticsState`) |
| `OnboardingMilestones` | installed, first_source, first_query, first_dashboard, first_pin (all boolean) | nested in `OnboardingChecklist` |

> **Design note (C46):** Onboarding state is stored inside `AnalyticsState.onboardingChecklist` rather than a separate storage key, because the initial onboarding flow is Analytics Hub-scoped.

### Planned (Phase 2)

| Entity | Fields | Storage |
|--------|--------|---------|
| `OnboardingState` | checklist: `OnboardingChecklist`, dismissedCallouts: `string[]`, firstVisits: `Record<string, string>`, startedAt: timestamp, completedAt?: timestamp | `onboarding` storage key |
| `OnboardingCallout` | id, targetView (`string`), title, content, dismissible (boolean) | Constant definition |

> **Migration plan:** Phase 2 introduces a standalone `OnboardingService` with its own `onboarding` storage key. The existing `AnalyticsState.onboardingChecklist` is migrated to `OnboardingState.checklist` on first load (same pattern as analytics migration from DX Hub).

## 7. Event Impact

### Produced

- `onboarding.started` -- Onboarding activated after installer
- `onboarding.step.completed` -- User completed a checklist action
- `onboarding.tip.dismissed` -- User dismissed a contextual tip
- `onboarding.completed` -- All checklist items completed
- `onboarding.reset` -- Onboarding state reset from Settings

### Consumed

- `installer.completed` -- Triggers onboarding activation
- View lifecycle events -- Detects first visit to views for contextual tips

## 8. UI Layout Impact

- **Getting Started checklist**: Small panel or modal accessible from the main view
- **Contextual callouts**: Non-blocking banners at the top of views on first visit
- **Settings addition**: "Reset onboarding" button in Flowti settings
- **Checklist items**: Checkbox list with action descriptions and status indicators

## 9. Adapter Impact

### Current (Phase 1 — embedded in AnalyticsService)

- `AnalyticsService`: Owns `initOnboardingChecklist()`, `updateOnboardingChecklist()`, `dismissOnboardingChecklist()`, `resetOnboardingChecklist()`
- `AnalyticsDashboardPage`: Renders checklist card (`renderOnboardingChecklist()`) and empty state (`renderEmptyState()`)
- `main.ts`: `installer.completed` → `seedSupplierDashboard()` → `initOnboardingChecklist()`

### Planned (Phase 2 — standalone OnboardingService)

- `OnboardingService`: State management, callout tracking, tip tracking, persistence under `onboarding` key
- `IStorageProvider`: Persists `OnboardingState` under `onboarding` key
- View integration: Each `BaseHubView` subclass checks onboarding state on render to show/hide first-visit callouts
- EventBus: Subscribes to `installer.completed` and user action events; emits `onboarding.*` events
- Settings: `FlowtiSettingsTab` gains "Reset onboarding" button

## 10. Non-Functional Requirements

- Onboarding UI must not block user workflow (dismissible, non-modal)
- State persistence must survive plugin reload
- Callouts must render within 100ms of view open
- Onboarding must degrade gracefully if installer was skipped (manual setup)
- Total onboarding content must be completable within 10 minutes

## 11. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Users find onboarding annoying or intrusive | High | Make all tips dismissible; keep content concise |
| Onboarding tips become stale as features evolve | Medium | Co-locate tip content with feature code; review on feature changes |
| Installer skipped (manual setup) leaves onboarding in limbo | Medium | Allow manual onboarding trigger from Settings |
| Too many tips overwhelm the user | Medium | Progressive disclosure; max 1 tip per view visit |

## 12. Acceptance Criteria

### Phase 1 (Delivered)

- [x] After installer completes, a "Getting Started" checklist appears on Analytics Hub homepage
- [x] Checklist shows 5 milestones with auto-completion based on user actions
- [x] Dismissing the checklist persists — it does not reappear on next visit
- [x] Completing a checklist action marks it as done (auto-milestone checking)
- [x] Onboarding does not block any user workflow (collapsible, dismissible)
- [x] Onboarding state survives plugin reload (persisted in AnalyticsState)
- [x] Analytics Hub shows welcoming empty state when no dashboards exist
- [x] "Load Sample Hub" seeds supplier dashboard and shows it immediately

### Phase 2 (Planned)

- [ ] First visit to Event Catalog shows a contextual callout
- [ ] First visit to Data Exchange Hub shows a contextual callout
- [ ] First visit to User Hub shows a contextual callout
- [ ] Dismissing a callout persists — it does not reappear on next visit
- [ ] "Reset onboarding" in Settings restores all callouts and checklist items
- [ ] Onboarding events emit with correct payloads (started, step.completed, completed, reset)
- [ ] OnboardingService operates independently from AnalyticsService

## 13. Definition of Done

- All acceptance criteria verified manually
- OnboardingService unit tested (state transitions, persistence, reset)
- Contextual tip rendering tested
- Integration with installer.completed event tested
- `npm run build` passes (vitest, tsc, eslint, esbuild)

## 14. Extended Backlog

| PBI | Title | Status | Priority | Source |
|-----|-------|--------|----------|--------|
| [[PBI-ONB-001 Post-Install Supplier Dashboard]] | Seed 5-tile supplier dashboard on first install | Done (C45) | Critical | [[Installer should seed starter content on first run]] |
| [[PBI-ONB-002 Wizard Completion Redirect]] | Completion page shows "Explore Your Dashboard" action | Done (C45) | High | Cycle 45 Inc 3 |
| [[PBI-ONB-003 Analytics Hub Empty State Redesign]] | Welcome hero, action cards, "How it works" flow | Done (C45) | High | Cycle 45 Inc 4 |
| [[PBI-ONB-004 Versioned JSON Folder Config]] | `DEFAULT_FOLDER_CONFIG` v1 with descriptions | Done (C46) | High | [[I want the installer to use a versioned JSON folder config instead of hardcoded paths]] |
| [[PBI-ONB-005 Wizard Role Selection]] | User/Supplier Manager role selection page | Done (C46) | High | Cycle 46 Inc 2 |
| [[PBI-ONB-006 Session Template Seeding]] | 3 supplier session templates, role-conditional | Done (C46) | High | Cycle 46 Inc 3 |
| [[PBI-ONB-007 Post-Install Onboarding Checklist]] | 5-milestone checklist on Analytics Hub homepage | Done (C46) | Critical | FR-1, FR-2, FR-4, FR-5, FR-7, FR-8 |
| [[PBI-ONB-008 Wizard UX Improvements]] | Categorised review + keyboard navigation | Done (C46) | Medium | Cycle 46 Inc 5 |
| [[PBI-ONB-010 Contextual View Callouts]] | First-visit dismissible callouts for Event Catalog, DX Hub, User Hub | Planned | High | FR-3, FR-15 |
| [[PBI-ONB-011 Onboarding Reset from Settings]] | "Reset onboarding" button in Settings, restores all callouts + checklist | Planned | Medium | FR-6 |
| [[PBI-ONB-012 OnboardingService Extraction]] | Standalone service with own `onboarding` storage key, migrating from AnalyticsState | Planned | High | FR-14 |
| [[PBI-ONB-013 Onboarding Lifecycle Events]] | Emit onboarding.started/.step.completed/.completed/.reset events | Planned | Medium | FR-13, §7 |
| [[PBI-ONB-014 Configurable Startpage]] | User-configurable preferred Hub view opens on Obsidian start | Done (C50) | Medium | [[As user, I want to set a View as Startpage]] |
| [[PBI-ONB-015 Role-Specific Seed Data Service]] | Generalise seed data beyond supplier-manager, configurable per persona | Discovery | Medium | [[How can we integrate a TestData or SeedData Service into Flowti to test or simulate things and help onboarding]] |
| [[PBI-ONB-016 Command Catalog]] | Browsable Command Catalog tab in User Hub, domain-grouped, searchable, click-to-execute | Done (C50) | Low | [[As user, I want to have an approachable command-catalog to act as documentation and user-manual about what is possible with the app]] |
| [[PBI-ONB-017 Hub Empty States]] | Welcoming empty states for User Hub, DX Hub, Event Catalog (not just Analytics Hub) | Discovery | Medium | FR-20 |
| [[PBI-ONB-018 Guided Tours]] | Multi-step interactive flows via process execution framework | Discovery | Low | [[How can we use the Flowti Process Execution Framework to guide Onboarding or Improve overall user-experience with guided tours]] |
| PBI-ONB-019 | User Hub Idea Capture — prominent idea input on User Hub dashboard leveraging Quick Capture | Done (C50) | Medium | Cycle 50 planning — idea capture is central to IBDE but has no User Hub affordance |
| PBI-ONB-020 | Quick Capture Configuration — per-command folder/template settings with modal selectors | Done (C50) | Medium | Cycle 50 planning — Quick Capture exists but is unconfigurable |

> **Backlog refinement (2026-02-26):** 13 inbox items triaged. 8 PBIs delivered (C45/C46), 4 PBIs planned for Phase 2, 5 PBIs in discovery for Phase 3. Phase 2 candidates for next onboarding cycle: PBI-ONB-010 (contextual callouts), PBI-ONB-011 (Settings reset), PBI-ONB-012 (service extraction), PBI-ONB-013 (events). Phase 3 items need further discovery and design.
>
> **Cycle 50 planning (2026-02-27):** 2 new PBIs added: PBI-ONB-019 (User Hub Idea Capture) and PBI-ONB-020 (Quick Capture Configuration). Both identified during Cycle 50 scoping — User Hub lacks an idea capture affordance despite ideas being central to IBDE, and Quick Capture lacks per-command configuration. Both assigned to Cycle 50. Backlog total: 19 PBIs (8 done, 4 Phase 2 planned, 7 Phase 3/discovery).

## 15. Inbox Refinement Results (2026-02-26)

| Inbox Item | Decision | Rationale |
|-----------|----------|-----------|
| Installer should seed starter content on first run | **Delivered** (C45/C46) | SeedContentStep + seedSupplierDashboard. Release blocker RB-4 resolved. |
| As Supplier-Manager, I want a seamless onboarding | **Delivered** (C45/C46) | Role selection, seed data, dashboard, wizard redirect |
| The Onboarding and Installation UX is lacking | **Partially delivered** (C45/C46) | Major improvements; contextual callouts and Settings reset remain |
| How can we make the onboarding experience pleasant | **Partially delivered** (C45/C46) | Wizard UX, empty states, checklist delivered; guided tours remain |
| PRD - Onboarding (vault inbox) | **Partially superseded** | Core concepts delivered; vault detection + PM tour = future scope |
| How can we integrate a TestData/SeedData Service | **Partially delivered** | seedSupplierDashboard exists; generic service = PBI-ONB-015 |
| How can we use the SeedService to help quick start | **Partially delivered** | SeedContentStep exists; broader service = PBI-ONB-015 |
| How can we use the Process Framework for guided tours | **Backlog** | Future scope; depends on process framework maturity → PBI-ONB-018 |
| Train-of-thought in onboarding | **Backlog** | Creative but depends on Train Hub stability → future |
| As user, I want to set a View as Startpage | **Delivered** (C50) | StartpageHandler + settings dropdown → PBI-ONB-014 |
| Command catalog as documentation | **Delivered** (C50) | Command Catalog tab in User Hub, 40+ commands cataloged → PBI-ONB-016 |
| How can I make the whole UX pleasant | **Observation** | Strategic question spanning all domains; not a single feature |
| How can we use Process Framework to guide Onboarding | **Backlog** | Guided tours via framework → PBI-ONB-018 |

## 16. Stage History

> **Backlog refinement v2 (2026-02-26):** 13 onboarding-related inbox items triaged. PRD expanded to 20 FRs across 3 phases. 17 PBIs in backlog (8 done, 4 planned, 5 discovery). Version bumped to 2. Scope, data model, acceptance criteria, and adapter impact updated for Phase 2 plan. Inbox items updated with delivery status, parent links, and refinement notes.
> **Cycle 46 — Supplier Manager Onboarding II (2026-02-26):** First implementation pass. OnboardingChecklist added to AnalyticsState with 5 milestones (installed, first_source, first_query, first_dashboard, first_pin). `initOnboardingChecklist()` triggered by `installer.completed` event after supplier dashboard seeding. Deep merge for partial milestone updates. Collapsible/dismissible checklist card on Analytics Hub homepage. 9 unit tests covering init, persistence, merge, dismiss, and reset. FRs delivered: FR-1, FR-2, FR-4, FR-5, FR-7, FR-8. Deferred: FR-3 (contextual view callouts), FR-6 (Settings reset). Stage: draft → in-progress.
> **Cycle 50 — User Activation (2026-02-27):** Phase 3 partially delivered. 4 PBIs done: PBI-ONB-014 (configurable startpage via `StartpageHandler`), PBI-ONB-016 (Command Catalog tab in User Hub with 40+ commands), PBI-ONB-019 (User Hub idea capture via `IdeaCaptureSection`), PBI-ONB-020 (Quick Capture per-command config via `resolveCaptureConfig`). TD-87 resolved (10 tutorials). FR-16 and FR-18 delivered. Onboarding milestones extended with `catalog_explored` and `startpage_configured`. Dashboard redesigned (unplanned — KPI strip removed, hybrid layout adopted). 97 new tests. TASM 32/35. Backlog: 19 PBIs (12 done, 4 Phase 2 planned, 3 deferred).

## Related

- Installer PRD: [[Installer PRD]] (wizard, role selection, seed content)
- Analytics Hub PRD: [[Analytics Hub PRD]] (onboarding checklist on AnalyticsState, empty state redesign)
- Cycle: [[Cycle 45 - Supplier Manager Onboarding]] (seed dashboard, empty state, wizard redirect)
- Cycle: [[Cycle 46 - Supplier Manager Onboarding II]] (role selection, folder config, templates, checklist, keyboard nav)
- Cycle: [[Cycle 50 - User Activation]] (command catalog, startpage, idea capture, capture config, 10 tutorials, dashboard redesign)
- Flow: [[First-Run Onboarding]] (event sequence: installer → seed → onboarding init)
- Tutorial: [[User Guide - Getting Started]] (277-line walkthrough, 55-minute first-hour path)
- Vault Inbox: [[PRD - Onboarding]] (comprehensive draft PRD — vault detection, PM tour, partially superseded)
- Persona: [[Supplier Manager]] (primary persona driving C45/C46 onboarding direction)
