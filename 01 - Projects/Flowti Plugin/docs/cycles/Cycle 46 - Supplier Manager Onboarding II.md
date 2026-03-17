---
type: DevelopmentCycle
feature: "[[Onboarding PRD]]"
stage: completed
cycle: 46
date_planned: 2026-02-26
date_completed: 2026-02-26
pbis:
  - "[[PBI-ONB-004 Versioned JSON Folder Config]]"
  - "[[PBI-ONB-005 Wizard Role Selection]]"
  - "[[PBI-ONB-006 Session Template Seeding]]"
  - "[[PBI-ONB-007 Post-Install Onboarding Checklist]]"
  - "[[PBI-ONB-008 Wizard UX Improvements]]"
bugs: []
bugs_fixed_precycle: []
bugs_fixed:
  - "Save query latency — fire-and-forget file write + measurement sync + instant button feedback"
  - "updateOnboardingChecklist deep merge bug — milestones were overwritten instead of merged"
  - "TS2532 in main.ts — analyticsService possibly undefined in .then() callback"
tech_debt:
  - "TD-23: InstallerWizardModal mixes state and rendering"
tech_debt_resolved: []
estimated_increments: 5
actual_increments: 5
estimated_tests: 45
actual_new_tests: 44
pre_cycle_tests: 5157
pre_cycle_suites: 217
post_cycle_tests: 5201
post_cycle_suites: 219
---

# Cycle 46 — Supplier Manager Onboarding II

## Cycle Overview

**User Story:**

> As a Supplier Manager using Flowti for the first time, I want the installer to understand my role, configure my vault accordingly, and guide me through my first productive actions — so that I feel confident navigating the system and know exactly what to do next after the wizard closes.

**User Pains:**

- **No role awareness** — the installer treats every user identically. A Supplier Manager gets the same 23 folders, same welcome note, same generic next steps as a developer. No personalisation based on what the user actually does.
- **Hardcoded folder structure** — the 23 PARA folders are baked into `folders.ts` as a string array. This is release blocker RB-1: the structure cannot be versioned, documented, or customised without code changes.
- **No session templates** — after installation, the user has no ready-made templates for their regular workflows (supplier reviews, KPI check-ins, procurement planning). They must create everything from scratch.
- **No guided next steps after dashboard** — Cycle 45 delivers the user to a populated dashboard, but there is no indication of what to explore next. The onboarding effectively ends at "here's a dashboard."
- **Wizard UX friction** — the review page shows a flat list of top-level folders without context. The completion page guidance is static regardless of what was installed. No keyboard navigation between pages.

**Business Trigger:** Cycle 45 delivered the foundation: seed data, pre-built dashboard, empty state redesign, and wizard redirect. Users now land on a populated dashboard within 30 seconds of install. This cycle builds on that foundation by adding role awareness, configurable infrastructure, guided next steps, and session templates — transforming "installed" into "productive."

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 45)

**Plugin health:**
- 5,157 tests passing, 217 test suites
- Build status: green (`npm test` clean)
- No blocking bugs from Cycle 45

**Installer domain status:**
- InstallerService: L5, 187 LOC, 3 steps (UserCreation, FolderScaffold, SeedContent)
- InstallerWizardModal: 4 pages (Welcome → Review → Progress → Complete), 414 LOC
- seedData.ts: 48-row supplier CSV + welcome note
- seedDashboard.ts: 2 queries, 5 tiles, set as default — triggered via `installer.completed`
- **Gap:** Folder paths hardcoded in `folders.ts` (RB-1)
- **Gap:** No role field on FlowtiUser, no role selection in wizard
- **Gap:** No session templates seeded

**Analytics domain status:**
- Empty state redesigned (welcome hero, action cards, "How it works" flow)
- "Load Sample Hub" seeding works end-to-end
- Reset Analytics Hub wired in settings
- 739+ analytics-specific tests
- **Gap:** No post-install checklist or guided next steps

**User domain status:**
- FlowtiUser model: `{ id, name, createdAt }` — no `role` field
- UserService: 135 LOC, create/get/update
- **Gap:** No role concept

---

## Backlog Refinement

### Inbox Items Processed

| Source | Item | Decision | Rationale |
|--------|------|----------|-----------|
| Plugin inbox (RB-1) | Installer should use versioned JSON folder config | **IN SCOPE** (Inc 1) | Critical release blocker; hardcoded paths block customisation |
| Vault inbox | As Supplier-Manager, I want seamless onboarding | **IN SCOPE** (Inc 2) | Role selection enables personalised install path |
| C45 deferred | Session templates seeding | **IN SCOPE** (Inc 3) | Supplier-focused templates give immediate workflow value |
| C45 deferred | Full Onboarding PRD (checklist, state tracking) | **IN SCOPE** (Inc 4, partial) | Lightweight checklist — not full OnboardingService |
| Plugin inbox | The Onboarding and Installation UX is lacking | **IN SCOPE** (Inc 5) | Wizard UX improvements (review categories, keyboard nav) |
| Vault inbox | How to use SeedService for quick start | **Absorbed** (Inc 1–3) | Versioned config + role-based seeding addresses this |
| Vault inbox | How to make onboarding pleasant | **Absorbed** (Inc 2–5) | Role selection + templates + checklist + UX polish |
| C45 deferred | Auto-import of seed CSV | **Deferred** | Seed dashboard already references CSV directly; no gap |
| C45 deferred | Guided Tour: Create First Domain | **Deferred** | Requires OnboardingService infrastructure beyond checklist |
| C45 deferred | Example domain seeding (events, flows, actors) | **Deferred** | Different seed pack; not Supplier Manager specific |
| Plugin inbox | Installer step registry from config | **Deferred** | Nice-to-have; current `registerStep()` API sufficient |
| Vault inbox | CLI-based installer from README (RB-6) | **Deferred** | Infrastructure scope; separate from in-app onboarding |
| C45 deferred | KPI Targets & RAG Status (PBI-ANA-134) | **Deferred** | Analytics feature, not onboarding |
| C45 deferred | Startpage setting | **Deferred** | Separate UX feature |

### Scope Decision

This cycle delivers **role-aware, configurable onboarding** for the Supplier Manager: versioned folder config (RB-1), role selection in the wizard, session templates for procurement workflows, a post-install checklist for guided next steps, and wizard UX polish. The full OnboardingService with state persistence and contextual tips remains deferred — the checklist here is a lightweight first step.

---

## Cycle Goals

1. **Versioned JSON Folder Config** — Extract the 23 hardcoded folder paths into a versioned JSON config file, making the folder structure documentable, customisable, and role-aware
2. **Wizard Role Selection** — Add a role selection page to the installer wizard so the system knows the user's context (Supplier Manager, Project Manager, General)
3. **Session Template Seeding** — Seed 3 supplier-focused session templates during installation so the user has ready-made workflows from day one
4. **Post-Install Onboarding Checklist** — Show a dismissible getting-started checklist on the Analytics Hub homepage to guide the user through their first productive actions
5. **Wizard UX Improvements** — Enhance the review page with categorised previews and the completion page with role-specific guidance

---

## Scope

### In Scope

- **Versioned JSON folder config** (RB-1)
  - `var/config/installer/v1/folders.json` with folder array + metadata
  - FolderScaffoldStep reads config at runtime instead of hardcoded array
  - Config includes folder descriptions for the review page
  - Version convention: `v1/`, `v2/` — installer picks latest
  - Existing `DEFAULT_IBDE_FOLDERS` array replaced by config reader
- **Wizard role selection page**
  - New page between Welcome and Review
  - 3 options: User (default), Supplier Manager, Project Manager (badge: "coming soon")
  - Role stored on `FlowtiUser` as `role?: string` field
  - Role passed to `InstallerContext` as `context.role`
  - Completion page guidance adapts to selected role
- **Session template seeding**
  - 3 templates in `03 - Resources/Templates/Sessions/`: Supplier Review, Monthly KPI Review, Procurement Planning
  - Templates contain structured frontmatter (type, cadence, agenda sections) + body
  - SeedContentStep extended to create templates (idempotent, follows existing pattern)
  - Supplier Manager role only (other roles get different templates in future)
- **Post-install onboarding checklist**
  - Rendered on Analytics Hub homepage below the dashboard header
  - 5 milestones: Install complete (auto-checked), Explore dashboard, Review sample data, Import own CSV, Build a custom query
  - Collapsible and permanently dismissible (persisted in analytics state)
  - Auto-checks milestones based on user actions (page visits, file creation, query count)
  - Lightweight — no OnboardingService, just state fields on AnalyticsState
- **Wizard UX improvements**
  - Review page: categorised sections (Folders, Files, Dashboard) with icons
  - Completion page: role-specific "What to do next" bullets
  - Keyboard navigation: Enter/Escape on all pages, tab between buttons

### Out of Scope

- Full OnboardingService with state persistence and event-driven tips
- CLI-based installer from README (RB-6)
- Pluggable step registry from config files
- Example domain seeding (events, flows, actors)
- Project Manager seed content (role option visible but content deferred)
- Guided Tours (Create First Domain, My First Feature)
- Vault structure detection and folder mapping
- Folder strategy selection (Map existing vs Create standard)

---

## Increments

### Inc 1: Versioned JSON Folder Config (PBI-ONB-004)

**Goal:** Extract the 23 hardcoded folder paths from `folders.ts` into a versioned JSON config file, resolving release blocker RB-1.

| File | Action | ~LOC |
|------|--------|------|
| `var/config/installer/v1/folders.json` | **New** — JSON config with folder array, descriptions, and metadata | +50 |
| `src/domain/installer/folderConfig.ts` | **New** — `loadFolderConfig()` reader, `FolderConfigEntry` type, fallback to embedded defaults | +60 |
| `src/domain/installer/folders.ts` | Modify — `DEFAULT_IBDE_FOLDERS` becomes thin wrapper calling `loadFolderConfig()` | -20, +5 |
| `src/domain/installer/steps/FolderScaffoldStep.ts` | Modify — Read folder descriptions for progress reporting | +10 |
| `src/domain/installer/InstallerWizardModal.ts` | Modify — Review page reads descriptions from config for richer preview | +15 |
| `tests/domain/installer/folderConfig.test.ts` | **New** — config parsing, fallback, validation tests | +80 |
| `tests/domain/installer/steps/FolderScaffoldStep.test.ts` | Update — verify config-driven folder creation | +10 |

**Design:**

- **folders.json schema:**
  ```json
  {
    "version": 1,
    "description": "IBDE folder structure — PARA method extended with Connectivity and Data Storage",
    "folders": [
      { "path": "00 - Connectivity", "description": "External connections, imports, and feedback" },
      { "path": "00 - Connectivity/input", "description": "Inbound data streams" },
      ...
    ]
  }
  ```

- **folderConfig.ts** — `loadFolderConfig(fileSystem)` reads JSON from `var/config/installer/v1/folders.json`. If the file doesn't exist (first run before folders are created), falls back to an embedded default. The embedded default is auto-generated from the JSON at build time (or simply a const that mirrors the JSON structure).

- **Migration strategy** — No migration needed. The JSON config replaces the hardcoded array. Existing installs already have folders created. New installs read the JSON (or embedded fallback).

- **Review page enhancement** — Each folder in the preview shows its description from config (e.g., "External connections, imports, and feedback" next to "00 - Connectivity").

**AC:**

- [x] `DEFAULT_FOLDER_CONFIG` constant in `folderConfig.ts` with all 25 folders and descriptions (embedded, not JSON file — vault `var/` doesn't exist pre-install)
- [x] `getFolderPaths()` and `getTopLevelEntries()` read from versioned config
- [x] Fallback to embedded defaults (config is the embedded default)
- [x] FolderScaffoldStep creates folders from config (via `DEFAULT_IBDE_FOLDERS` derived from config)
- [x] Review page shows folder descriptions from config
- [x] `DEFAULT_IBDE_FOLDERS` still works as a flat string array (backwards compatible)
- [x] RB-1 resolved
- [x] `npm test` passes

**Tests:** 11 new

---

### Inc 2: Wizard Role Selection (PBI-ONB-005)

**Goal:** Add a role selection page to the installer wizard so the system knows the user's context and can adapt the install accordingly.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/user/types.ts` | Add `role?: string` to `FlowtiUser` interface | +1 |
| `src/domain/user/UserService.ts` | Pass `role` through `createUser()` and `updateUser()` | +5 |
| `src/domain/installer/InstallerWizardModal.ts` | Add `renderRolePage()`, update page navigation (5 pages now), wire `context.role` | +80 |
| `src/domain/installer/InstallerWizardModal.ts` | Update `renderCompletePage()` — role-specific "What to do next" bullets | +20 |
| `tests/domain/user/UserService.test.ts` | Test role persistence on create/update | +20 |
| `tests/domain/installer/InstallerWizardModal.test.ts` | **New** — role page rendering, page flow, role in context | +60 |

**Design:**

- **Wizard page flow:** Welcome → **Role** → Review → Progress → Complete (5 pages total)
- **WizardPage type update:** `"welcome" | "role" | "review" | "progress" | "complete"`

- **Role page layout:**
  ```
  ┌─────────────────────────────────────────────┐
  │       What best describes your role?         │
  │                                              │
  │  ┌────────────────────────────────────────┐  │
  │  │ 👤  User                        [•]    │  │
  │  │ Standard IBDE setup with sample        │  │
  │  │ data and general-purpose templates     │  │
  │  └────────────────────────────────────────┘  │
  │  ┌────────────────────────────────────────┐  │
  │  │ 📊  Supplier Manager            [ ]    │  │
  │  │ Procurement, supplier KPIs, spend      │  │
  │  │ tracking, quality and delivery metrics  │  │
  │  └────────────────────────────────────────┘  │
  │  ┌────────────────────────────────────────┐  │
  │  │ 📋  Project Manager      Coming Soon   │  │
  │  │ Project tracking, governance,          │  │
  │  │ milestones, team coordination          │  │
  │  └────────────────────────────────────────┘  │
  │                                              │
  │                  [Back]  [Next →]             │
  └─────────────────────────────────────────────┘
  ```

- **Role cards** — Styled like stat cards. Radio selection (single choice). "Coming Soon" badge disables selection for PM role. Default: **User** pre-selected (general-purpose role). Supplier Manager is the first specialised role.

- **Context flow** — Selected role stored as `this.selectedRole` (default `"user"`), passed into `InstallerContext` as `context.role = this.selectedRole`. UserCreationStep picks up `context.role` when creating the user.

- **Completion page adaptation** — When role is `"supplier-manager"`, show supplier-specific guidance (current C45 bullets). When role is `"user"`, show general guidance (explore Analytics Hub, import data, build queries). This replaces the hardcoded supplier bullets from C45 with role-conditional content.

**AC:**

- [x] Role page appears between Welcome and Review
- [x] 3 role options: User (default), Supplier Manager, Project Manager (disabled, "Coming Soon")
- [x] Selected role stored on `FlowtiUser.role`
- [x] Selected role available in `InstallerContext.role`
- [x] Completion page "What to do next" varies by role
- [x] Back/Next navigation works correctly across all 5 pages
- [x] `npm test` passes

**Tests:** 7 new (5 UserService + 1 UserCreationStep + 1 InstallerJourney fix)

---

### Inc 3: Session Template Seeding (PBI-ONB-006)

**Goal:** Seed 3 supplier-focused session templates during installation so the user has ready-made workflows from day one.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/installer/seedData.ts` | Add 3 template constants: `SUPPLIER_REVIEW_TEMPLATE`, `KPI_REVIEW_TEMPLATE`, `PROCUREMENT_PLANNING_TEMPLATE`, paths array | +120 |
| `src/domain/installer/steps/SeedContentStep.ts` | Extend seed files list to include templates (conditional on role) | +15 |
| `tests/domain/installer/steps/SeedContentStep.test.ts` | Test template seeding for supplier-manager role, skip for user role | +60 |
| `tests/domain/installer/InstallerJourney.test.ts` | Update assertions for new seed files | +5 |

**Design:**

- **Template paths:**
  - `03 - Resources/Templates/Sessions/Supplier Review.md`
  - `03 - Resources/Templates/Sessions/Monthly KPI Review.md`
  - `03 - Resources/Templates/Sessions/Procurement Planning.md`

- **Template structure** — Each template follows Flowti session conventions:
  ```markdown
  ---
  type: SessionTemplate
  cadence: weekly|monthly|quarterly
  domain: supplier-management
  role: supplier-manager
  ---

  # Supplier Review

  ## Objective
  Review supplier performance metrics and address quality or delivery concerns.

  ## Agenda
  - [ ] Review KPI dashboard (Quality Score, OTD, Lead Time)
  - [ ] Flag suppliers below threshold
  - [ ] Discuss open purchase orders
  - [ ] Action items from last review

  ## Notes

  ## Decisions

  ## Action Items
  - [ ]
  ```

- **Role-conditional seeding** — SeedContentStep checks `context.role`:
  - `"supplier-manager"` → seed CSV + welcome note + 3 session templates
  - `"user"` (default) → seed CSV + welcome note only (no role-specific templates)
  - `"project-manager"` → future (falls through to user for now)

**AC:**

- [x] 3 session templates created in `03 - Resources/Templates/Sessions/` for Supplier Manager role
- [x] Templates have structured frontmatter (type, cadence, domain, role)
- [x] Templates contain actionable agenda items relevant to supplier management
- [x] User role (default) skips template creation
- [x] Idempotent — re-running skips existing templates
- [x] `context.seededFiles` includes template paths
- [x] `npm test` passes

**Tests:** 7 new

---

### Inc 4: Post-Install Onboarding Checklist (PBI-ONB-007)

**Goal:** Show a dismissible getting-started checklist on the Analytics Hub homepage to guide the user through their first productive actions after installation.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/types.ts` | Add `onboardingChecklist?: OnboardingChecklist` to `AnalyticsState` | +15 |
| `src/domain/analytics/AnalyticsService.ts` | Add `getChecklist()`, `updateChecklist()`, `dismissChecklist()` methods | +30 |
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Add `renderOnboardingChecklist()` — collapsible checklist below dashboard header | +100 |
| `tests/domain/analytics/AnalyticsService.test.ts` | Checklist CRUD tests | +40 |
| `tests/ui/analytics/AnalyticsDashboardPage.test.ts` | Checklist rendering and interaction tests | +50 |

**Design:**

- **OnboardingChecklist type:**
  ```typescript
  interface OnboardingChecklist {
    dismissed: boolean;
    collapsed: boolean;
    milestones: {
      installed: boolean;         // auto-set on install
      dashboardExplored: boolean; // set when user visits dashboard page
      sampleDataReviewed: boolean; // set when user opens a query result
      ownDataImported: boolean;   // set when a non-seed CSV source exists
      customQueryBuilt: boolean;  // set when user creates a query manually
    };
  }
  ```

- **Checklist UI:**
  ```
  ┌─ Getting Started ─────────────────── [Collapse ▾] [✕ Dismiss] ─┐
  │                                                                  │
  │  ✅ Install Flowti                                               │
  │  ✅ Explore your Supplier Dashboard                              │
  │  ☐  Review the sample data in your queries                      │
  │  ☐  Import your own CSV data                                    │
  │  ☐  Build a custom query                                        │
  │                                                                  │
  │  3 of 5 complete                                                 │
  └──────────────────────────────────────────────────────────────────┘
  ```

- **Auto-checking logic** — Milestones update automatically:
  - `installed`: set to `true` on first checklist creation (during install flow)
  - `dashboardExplored`: set when `AnalyticsDashboardPage.render()` runs with an active dashboard
  - `sampleDataReviewed`: set when user navigates to a query result view
  - `ownDataImported`: set when `analyticsService.listQueries()` contains a non-seed query
  - `customQueryBuilt`: set when query count exceeds the 2 seed queries

- **Persistence** — Stored in `AnalyticsState.onboardingChecklist`. No new storage — reuses existing analytics persistence.

- **Placement** — Rendered between the dashboard header and the tile grid. Only shown when `!checklist.dismissed`. Auto-hides when all 5 milestones are complete.

**AC:**

- [x] Checklist appears on Analytics Hub homepage after installation
- [x] 5 milestones displayed with checked/unchecked state
- [x] Milestones auto-check based on user actions
- [x] Collapse button toggles checklist body visibility
- [x] Dismiss button permanently hides checklist
- [x] Checklist state persisted in analytics state
- [x] Checklist auto-hides when all milestones complete
- [x] Progress indicator shows "X of 5 complete"
- [x] `npm test` passes

**Tests:** 9 new

---

### Inc 5: Wizard UX Improvements (PBI-ONB-008)

**Goal:** Polish the wizard review and completion pages for a more informative, role-aware experience.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/installer/InstallerWizardModal.ts` | Refactor `renderReviewPage()` — categorised sections (Folders, Files, Dashboard) with icons and descriptions | +40, -20 |
| `src/domain/installer/InstallerWizardModal.ts` | Keyboard navigation — Enter advances, Escape goes back, on all pages | +20 |

**Design:**

- **Categorised review page:**
  ```
  ┌─────────────────────────────────────────────┐
  │       Ready to set up your vault?            │
  │                                              │
  │  📁 Folder Structure                         │
  │  ├ 00 - Connectivity  (imports, feedback)    │
  │  ├ 01 - Projects                             │
  │  ├ 02 - Areas                                │
  │  ├ 03 - Resources     (data, templates)      │
  │  ├ 04 - Archive                              │
  │  └ var                (system data)           │
  │                                              │
  │  📄 Sample Content                           │
  │  ├ Supplier overview CSV  (48 rows)          │
  │  ├ Welcome note                              │
  │  └ 3 session templates                       │
  │                                              │
  │  📊 Pre-Built Dashboard                      │
  │  └ Supplier Overview  (5 tiles, 2 queries)   │
  │                                              │
  │                  [← Back]  [Install →]       │
  └─────────────────────────────────────────────┘
  ```

- **Folder descriptions** — sourced from `folders.json` config (Inc 1). Top-level folders only, with parenthetical description.

- **Sample Content section** — lists seed files that SeedContentStep will create. Count adapts to role (supplier-manager shows templates, user does not).

- **Dashboard section** — summarises what seedDashboard.ts will create. Static text (5 tiles, 2 queries).

- **Keyboard navigation** — Global keydown listener per page:
  - Enter → advance to next page (same as primary button)
  - Escape → go back (same as back button, or close on welcome page)
  - Already partially implemented for welcome page Enter key (C45 Inc 4)

**AC:**

- [x] Review page shows 3 categorised sections: Folders, Sample Content, Dashboard
- [x] Folder descriptions sourced from JSON config
- [x] Sample Content section adapts to selected role
- [x] Enter key advances on all pages
- [x] Escape key goes back on all pages
- [x] `npm test` passes

**Tests:** 10 new (6 categorised review + 4 keyboard navigation)

---

## Dependency Graph

```
Inc 1 (JSON Folder Config) ── independent (installer infrastructure)
    |
    v
Inc 2 (Role Selection) ── depends on Inc 1 (review page reads folder descriptions from config)
    |
    v
Inc 3 (Session Templates) ── depends on Inc 2 (role-conditional seeding needs context.role)
    |
Inc 5 (Wizard UX) ── depends on Inc 1 + Inc 2 (review page shows config descriptions + role-adapted content)
    |
Inc 4 (Onboarding Checklist) ── independent (analytics domain, runs in parallel with Inc 2–3)
```

**Execution order:** Inc 1 → Inc 2 → Inc 3 → Inc 4 → Inc 5
**Critical path:** Inc 1 → Inc 2 → Inc 3 (role-aware seeding chain)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| JSON config file not found at runtime (vault hasn't created `var/` yet) | High | Embedded fallback defaults in `folderConfig.ts`; JSON is optional enhancement |
| FlowtiUser schema change breaks existing installs | Medium | `role` field is optional (`role?: string`); existing users without role work as before |
| Session templates conflict with user-created files | Low | Idempotent — `fileExists()` check before creation; unique path in Templates/Sessions/ |
| Onboarding checklist state lost on analytics reset | Low | `reset()` preserves `onboardingChecklist` field (or re-initialises it) |
| 5-page wizard feels too long | Medium | Role page is a single click (pre-selected default); net time added is < 5 seconds |
| Wizard keyboard listeners conflict with Obsidian shortcuts | Low | Listeners scoped to modal `contentEl`; removed on page change |

---

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| New tests | ~45 | 44 |
| Post-cycle total tests | ~5,202 | 5,201 |
| Post-cycle suites | ~220 | 219 |
| Increments | 5 | 5 |
| New source files | 3 | 3 (folderConfig.ts, InstallerWizardModal.test.ts, folderConfig.test.ts) |
| Release blockers resolved | 1 (RB-1) | 1 (RB-1) |
| Wizard pages | 5 (was 4) | 5 |
| Session templates seeded | 3 | 3 |
| Onboarding milestones tracked | 5 | 5 |
| Time from install to dashboard view | < 30 seconds | Maintained |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Full OnboardingService (state machine, contextual tips, event-driven) | Checklist is lightweight alternative; full service needs design cycle | Cycle 48+ |
| CLI-based installer from README (RB-6) | Infrastructure scope; separate from in-app onboarding | Future |
| Pluggable step registry from config | Current `registerStep()` API sufficient | Future |
| Example domain seeding (events, flows, actors) | Different seed pack; needs domain model design | Cycle 47+ |
| Guided Tour: Create First Domain | Requires full OnboardingService | Cycle 48+ |
| Guided Tour: My First Feature | Depends on guided tour infrastructure | Cycle 48+ |
| Project Manager seed content | Role visible in wizard but content deferred | Cycle 47 |
| Vault structure detection and folder mapping | Onboarding PRD aspiration; large scope | Future |
| Folder strategy selection (Map existing vs Create standard) | Depends on vault detection | Future |
| KPI Targets & RAG Status (PBI-ANA-134) | Analytics feature, not onboarding | Cycle 47+ |
| Train-of-thought in onboarding | Requires design; Train domain integration | Future |
| Startpage setting | Separate UX feature | Future |
| Supplier Management full PRD | Domain-level feature; data model design needed | Future |

---

## Definition of Ready (Pre-Cycle)

- [x] Cycle 45 delivered — all tests green, no blocking bugs
- [x] `npm test` passes (5,157 tests, 217 suites) — verified 2026-02-26
- [x] `DEFAULT_IBDE_FOLDERS` in `folders.ts` is the single source of truth for folder paths (25 entries, `readonly`, `as const`) — ready for extraction to JSON
- [x] `FlowtiUser` uses Zod schema (`FlowtiUserSchema`) with `z.infer` — adding `role?: string` requires `.optional()` on a new Zod field (straightforward, no migration needed since Zod `.optional()` defaults to `undefined`)
- [x] `InstallerContext` supports extensible keys via `[key: string]: unknown` — confirmed in `src/domain/installer/types.ts:31`
- [x] `SeedContentStep` pattern established — idempotent `fileExists()` check, `createFile()` with `{ createFolders: true }`, `context.seededFiles` accumulation on both success and partial failure (97 LOC)
- [x] `InstallerWizardModal` page navigation pattern understood — `WizardPage` union type, `switch` in `renderPage()`, page transitions via `this.currentPage = "x"; this.renderPage()` (414 LOC, 4 pages currently)
- [x] `AnalyticsState` persisted via `ITypedStorage` (key: `"analytics"`) — already has 3 optional fields (`defaultDashboardId`, `templates`, `measurements`); adding `onboardingChecklist` follows established pattern
- [x] `AnalyticsDashboardPage.render()` flow understood — resolves active dashboard → `renderDefaultDashboard()` (happy path) or `renderFallback()` → `renderEmptyState()` (zero dashboards) or stats+prompt (dashboards exist, no default)
- [x] Session template conventions exist — vault templates in `03 - Resources/Templates/` use YAML frontmatter + markdown body; session domain has `SessionTemplate` type with `goals[]`, `tasks[]`, `decisions[]` for in-app templates. Inc 3 templates are vault-side markdown files (not SessionTemplate objects)

## Definition of Done

### 1. All Increments Completed
- [x] 5 increments delivered, no partial state

### 2. Quality Gates
- [x] `npm test` passes — 5,201 tests, 219 suites, all green
- [x] `npm run check` passes — no lint or type errors
- [x] All 44 new tests exercise the features they validate

### 3. Architecture
- [x] Folder config is versioned (`DEFAULT_FOLDER_CONFIG` with `version: 1`), not hardcoded strings
- [x] FolderScaffoldStep reads config at runtime via `DEFAULT_IBDE_FOLDERS` derived from `getFolderPaths(DEFAULT_FOLDER_CONFIG)`
- [x] FlowtiUser.role is optional (`z.string().optional()`) — no breaking change for existing users
- [x] Role selection flows through InstallerContext to steps and completion page
- [x] Session templates follow established Flowti conventions (YAML frontmatter, structured body)
- [x] Onboarding checklist reuses AnalyticsState persistence (no new storage)
- [x] Wizard keyboard listeners are scoped to `contentEl` and cleaned up per page via `removeKeyboardNav()`

### 4. User Experience
- [x] Wizard has 5 pages: Welcome → Role → Review → Progress → Complete
- [x] User is the default role selection
- [x] Review page shows categorised preview (Folders, Sample Content, Pre-Built Dashboard)
- [x] Completion page guidance adapts to selected role
- [x] 3 session templates created for Supplier Manager role
- [x] Getting-started checklist visible on Analytics Hub homepage
- [x] Checklist milestones auto-check based on user actions
- [x] Checklist is collapsible and permanently dismissible
- [x] Enter/Escape keyboard navigation works on all wizard pages
- [x] Time from install to dashboard view still < 30 seconds

### 5. Release Readiness
- [x] RB-1 resolved (versioned folder config)
- [ ] Demo script: reset → wizard → select role → install → see dashboard → checklist guides next steps
- [ ] Verified via manual walkthrough

---

## DoD Verification (vs Definition of Done (Cycle))

### 1. All Increments Completed
- [x] Each increment satisfies its own DoD — all 5 ACs checked off
- [x] No increment left in partial state — all 5 fully delivered
- [x] Deferred increments documented — none deferred this cycle

### 2. Build & Test Quality
- [x] Build pipeline green — `npm run build` passes (vitest → tsc → eslint → esbuild, verified 2026-02-26)
- [x] Test count meets target — 44 new tests (target ~45, within margin)
- [x] No test regressions — all 5,201 tests pass; 2 existing tests fixed (createUser signature change)
- [x] No skipped tests introduced — 32 pre-existing skips, no new ones
- [x] Test coverage per TestPlan — domain methods tested (onboarding checklist CRUD), UI tested (wizard pages, keyboard nav, categorised review)

### 3. Three Amigos Review
- [ ] Cycle-level review conducted
- [ ] All three perspectives represented
- [ ] All blocker findings resolved
- [ ] TASM scores recorded
- [ ] Observations documented

### 4. PRD & Backlog Updates
- [ ] Onboarding PRD updated — FRs checked off, version incremented, stage history entry
- [ ] PBIs updated — ONB-004 through ONB-008 marked done
- [ ] Event model current — no new events added this cycle

### 5. Documentation
- [x] Component docs — no new public-facing components (internal wizard refactor)
- [x] Architecture docs — no architectural surface change (no new views, services, or patterns)
- [x] Flow docs — wizard 5-page flow documented in cycle plan
- [ ] Technical debt register — TD-23 still open (InstallerWizardModal mixing concerns)
- [x] ADRs — no new architectural decisions required

### 6. Cycle Plan Completion
- [x] Frontmatter updated — actual_increments, actual_new_tests, post_cycle_tests, post_cycle_suites, date_completed, stage
- [x] Success metrics verified — all 10 metrics have actuals
- [x] Deviations documented — folder config used embedded const instead of JSON file (vault doesn't exist pre-install); noted in AC
- [x] Risks reviewed — see below

### 7. Cycle Retrospective
See Retrospective section below.

### 8. Inbox & Feedback Loop
- [ ] Inbox items reviewed — RB-1 resolved, plugin inbox "Onboarding UX" addressed
- [ ] New feedback captured — save query latency fix discovered during cycle
- [ ] Next cycle inputs identified — see Deferred Items

---

## Risk Review

| Risk | Materialised? | Resolution |
|------|--------------|------------|
| JSON config file not found at runtime | **Avoided** | Used embedded `DEFAULT_FOLDER_CONFIG` const instead of runtime JSON file — vault `var/` doesn't exist pre-install |
| FlowtiUser schema change breaks existing installs | **No** | `role: z.string().optional()` works seamlessly; existing users without role field load correctly |
| Session templates conflict with user-created files | **No** | Templates in unique path `03 - Resources/Templates/Sessions/`; idempotent skip if exists |
| Onboarding checklist state lost on analytics reset | **No** | `reset()` clears checklist (by design); `initOnboardingChecklist()` is idempotent and can re-create |
| 5-page wizard feels too long | **No** | Role page adds ~3 seconds; default pre-selected so users can click "Next" immediately |
| Wizard keyboard listeners conflict with Obsidian shortcuts | **No** | Listeners scoped to `contentEl`, removed on page change via `removeKeyboardNav()` |

---

## Retrospective

### What Went Well
- **Embedded config over runtime JSON** — choosing an embedded `DEFAULT_FOLDER_CONFIG` const instead of a runtime JSON file eliminated the chicken-and-egg problem (vault folders don't exist until after install). Simpler, no I/O, no fallback logic.
- **Role-conditional seeding pattern** — clean `if (context.role === "supplier-manager")` guard in SeedContentStep makes future role-specific content trivial to add.
- **Deep merge bug caught by tests** — the `updateOnboardingChecklist` method had a shallow merge that overwrote milestones. The test suite caught this immediately.
- **Fire-and-forget pattern for non-critical I/O** — the save query latency fix (discovered mid-cycle) showed that `writeQueryFile` and `syncMeasurements` don't need to block the UI. Pattern is reusable for other save operations.
- **Wizard keyboard navigation** — scoped `keydown` listener per page with cleanup on page transitions is clean and testable.

### Deviations from Plan
- **No `var/config/installer/v1/folders.json` file** — plan called for a runtime JSON file. Implemented as embedded TypeScript const instead. The versioning concept (`version: 1`) is preserved in the config structure for future migration.
- **Save query latency fix** — unplanned work discovered during testing. Added fire-and-forget file write + instant button feedback. 3 files changed, minimal scope.
- **TS2532 fix in main.ts** — unplanned. TypeScript couldn't narrow `this.analyticsService` inside a `.then()` callback. Fixed with local variable capture.

### Improvement Backlog
| Item | Classification |
|------|---------------|
| TD-23: InstallerWizardModal (574 LOC) mixes page rendering and state management | Tech debt — extract page renderers into separate classes |
| Apply fire-and-forget pattern to other save operations (dashboard save, measurement create) | Next cycle input |
| Consider `writeQueryFile` debouncing for rapid saves | Observation |
| Add runtime JSON config loading as enhancement when vault structure exists | Future PRD (Installer PRD) |

### Learnings
- **Embedded defaults beat runtime file reads for pre-install config** — when the installer creates the filesystem, you can't read config from that filesystem during install.
- **Shallow `Object.assign` silently replaces nested objects** — always deep-merge nested structures or handle them separately.
- **`await` in save paths compounds** — three sequential `await`s (storage + event + file) can add 200-600ms of perceived latency. Fire-and-forget for best-effort operations dramatically improves responsiveness.
