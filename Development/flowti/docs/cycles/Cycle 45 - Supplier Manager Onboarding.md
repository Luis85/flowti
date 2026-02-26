---
type: DevelopmentCycle
feature: "[[Onboarding PRD]]"
stage: planned
cycle: 45
date_planned: 2026-02-26
date_completed:
pbis:
  - "[[PBI-002 Seed Starter Content]]"
  - "[[PBI-ONB-001 Post-Install Supplier Dashboard]]"
  - "[[PBI-ONB-002 Wizard Completion Redirect]]"
bugs: []
bugs_fixed_precycle: []
bugs_fixed: []
tech_debt:
  - "TD-70: InstallerService.saveState() called once after all steps — crash between steps loses progress"
  - "TD-71: FolderScaffoldStep idempotency relies on string-matching error messages"
  - "TD-128: DashboardsTab 1,149 LOC"
tech_debt_resolved: []
estimated_increments: 3
actual_increments:
estimated_tests: 30
actual_new_tests:
pre_cycle_tests: 5123
pre_cycle_suites: 215
post_cycle_tests:
post_cycle_suites:
---

# Cycle 45 — Supplier Manager Onboarding

## Cycle Overview

**User Story:**

> As a Supplier Manager onboarding to Flowti for the first time, I want to see immediate value after installation — a populated dashboard with supplier KPIs, a sample dataset to explore, and clear guidance on what to do next — so that I understand the system's capabilities within 5 minutes instead of staring at 23 empty folders.

**User Pains:**

- **Empty vault after install** — 23 folders with `.gitkeep` files and nothing else. No content, no data, no dashboards. The system feels hollow and provides zero value until the user manually creates content. Identified as release blocker RB-4.
- **No role-specific onboarding** — a Supplier Manager gets the same empty experience as any other role. No sample data relevant to procurement, no pre-built dashboard showing cost/quality/delivery metrics, no guidance tailored to supply chain workflows.
- **Generic post-install guidance** — the wizard completion page lists developer-oriented next steps ("Open the Event Catalog", "Define event definitions") that mean nothing to a business user. The disconnect between install and first-value-moment causes early drop-off.
- **No bridge from install to analytics** — the user must manually discover the Analytics Hub, figure out CSV import, learn the query builder, and build a dashboard from scratch before seeing any visualization. This is a 30+ minute gap that kills first impressions.

**Business Trigger:** Cycle 44 delivered a mature Analytics Hub (106 FRs, date filtering, cross-tile interaction, file watcher, dashboard decomposition). The engine is ready — but new users never reach it because the onboarding flow drops them into an empty vault. This cycle focuses on bridging the gap between "installed" and "productive" with seed content, a pre-built dashboard, and a guided completion experience.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 44)

**Plugin health:**
- 5,123 tests passing, 215 test suites
- Build status: green (`npm test` clean)
- No blocking bugs, no open action items from Cycle 44

**Installer domain status:**
- InstallerService: L5 maturity, 187 LOC, fully tested
- InstallerWizardModal: 4-page wizard (Welcome → Review → Progress → Complete), 395 LOC
- 2 built-in steps: UserCreationStep (order 10), FolderScaffoldStep (order 20)
- 6 events, extensible IInstallerStep interface
- **Gap**: No SeedContentStep (PBI-002 still planned, release blocker RB-4)
- **Gap**: Completion page shows generic developer-oriented guidance

**Analytics domain status:**
- AnalyticsService: 619 LOC, createDashboard/saveQuery/addTile/updateTile APIs mature
- AnalyticsEngine: 853 LOC, pure stateless query processor
- DashboardsTab: 1,149 LOC (TD-128), TileRendererFactory with 4 sub-renderers
- 739 analytics-specific tests
- PRD v19, 106 FRs delivered
- **Ready to receive seed dashboards** — all APIs exist, just need content

**Onboarding domain status:**
- Onboarding PRD: DRAFT (L1), not yet implemented
- No OnboardingService, no OnboardingState persistence
- User Hub Dashboard exists with welcome greeting and hub summaries
- Getting Started Guide published (277 lines, 55-minute first-hour path)
- **No contextual tips, no getting-started checklist, no progressive discovery**

**User domain status:**
- UserService: 135 LOC, FlowtiUser model `{ id, name, createdAt }`
- No role field on FlowtiUser (role-based onboarding not yet possible)

---

## Backlog Refinement

### Inbox Items Processed

| Source | Item | Decision | Rationale |
|--------|------|----------|-----------|
| Plugin inbox (RB-4) | Installer should seed starter content on first run | **IN SCOPE** (Inc 1) | Release blocker; empty vault kills first impression |
| Vault inbox | As Supplier-Manager, I want a seamless onboarding | **IN SCOPE** (Inc 2) | Direct trigger for this cycle; seed dashboard + redirect |
| Plugin inbox | The Onboarding and Installation UX is lacking | **IN SCOPE** (Inc 3) | Wizard completion page is the first UX fix |
| Vault inbox | Train-of-thought for onboarding | **Deferred** | Nice-to-have; requires Train domain integration design |
| Vault inbox | As User, I want to set a View as Startpage | **Deferred** | Requires settings infrastructure; separate PBI |
| Vault inbox | As project-manager, easy process execution | **Deferred** | Different domain (p3.express); not onboarding-related |
| Vault inbox | As User, rebuild Dashboard from spec | **Deferred** | Analytics feature, not onboarding |
| Vault inbox | As User, document my meetings with Flowti | **Deferred** | Session template feature; potential future onboarding step |
| Onboarding PRD | Full contextual onboarding (tips, checklist, state tracking) | **Deferred** | Too large for 1 cycle; foundation first |
| Installer backlog | Guided Tour: Create First Domain | **Deferred** | Requires OnboardingService infrastructure |
| UX PRD | Guided Tour: My First Feature | **Deferred** | Depends on contextual onboarding |

### Scope Decision

This cycle delivers the **minimum viable onboarding** for a Supplier Manager demo: seed content + pre-built dashboard + guided redirect. The full Onboarding PRD (contextual tips, state tracking, progressive discovery) is deferred to a future cycle once the foundation is proven.

---

## Cycle Goals

1. **Seed Sample Data** — Create a SeedContentStep that populates the vault with supplier CSV data and a welcome note during first-run install
2. **Pre-Built Dashboard** — Automatically create a "Supplier Overview" dashboard with KPI cards, charts, and a breakdown table after installation completes
3. **Guided Completion** — Update the wizard completion page with supplier-relevant guidance and a primary "Explore Your Dashboard" action that opens the Analytics Hub

---

## Scope

### In Scope

- **SeedContentStep** (new installer step, order 30)
  - Supplier overview CSV with 3 suppliers, 8 SKUs, 6 months of data (~48 rows)
  - Welcome note personalized with user name and supplier-manager-tailored first steps
  - Idempotent: skips existing files
  - Follows FolderScaffoldStep pattern exactly
- **Post-install dashboard seeding**
  - 2 analytics queries (supplier summary by-supplier + monthly spend trend)
  - 1 dashboard with 5 tiles: 3 stat cards (spend, quality, OTD), 1 bar chart (monthly trend), 1 table (supplier breakdown)
  - Set as default dashboard
  - Triggered via `installer.completed` event listener in main.ts
  - Idempotent: skips if "Supplier Overview" dashboard already exists
- **Wizard completion page**
  - Supplier-relevant "What to do next" guidance
  - "Explore Your Dashboard" primary button → opens Analytics Hub → closes modal
  - "Close" becomes secondary button

### Out of Scope

- Role selection in wizard (no role field on FlowtiUser yet)
- Users can have multiple roles
- Auto-import/ingestion of seed CSV (user explores manually via Analytics Hub)
- Full Onboarding PRD implementation (contextual tips, checklist, state tracking)
- Guided Tours (Create First Domain, First Feature)
- OnboardingService / OnboardingState persistence
- Startpage setting
- Session templates seeding (future SeedContentStep enhancement)
- Example domain seeding (events, flows, actors — PBI-002 originally scoped this but scope reduced for time)

---

## Increments

### Inc 1: Seed Content Step (PBI-002 — partial)

**Goal:** Add a new installer step that seeds a supplier CSV and welcome note during first-run install, eliminating the empty-vault problem.

**Note:** This is a focused subset of PBI-002. The original PBI scoped example domains, session templates, and welcome notes. This increment delivers the CSV seed data and welcome note only — sufficient for the Supplier Manager demo. Remaining PBI-002 scope (example domain, session templates) is deferred to a follow-up cycle.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/installer/seedData.ts` | **New** — `SUPPLIER_OVERVIEW_CSV` constant (48 rows), `SEED_CSV_PATH` constant | +60 |
| `src/domain/installer/steps/SeedContentStep.ts` | **New** — `IInstallerStep` implementation (order 30), creates CSV + welcome note | +75 |
| `src/infrastructure/services/registry.ts` | Register `SeedContentStep` after `FolderScaffoldStep` | +2 |
| `tests/domain/installer/steps/SeedContentStep.test.ts` | **New** — unit tests following FolderScaffoldStep.test.ts pattern | +100 |
| `tests/domain/installer/InstallerJourney.test.ts` | Add SeedContentStep registration to `buildInstaller` helper | +5 |
| `tests/flows/01-FirstRunOnboarding.test.ts` | Add SeedContentStep registration + update assertions | +5 |

**Design:**

- **seedData.ts** — Extracted data constant (follows `folders.ts` pattern for `DEFAULT_IBDE_FOLDERS`). Contains `SUPPLIER_OVERVIEW_CSV` string and `SEED_CSV_PATH = "03 - Resources/Sample Data/supplier-overview.csv"`.

- **CSV data design** — 3 suppliers (Acme Components, Nordic Electronics, Pacific Materials), 2-3 SKUs each, 6 months (Sep 2025 — Feb 2026). Columns: Month, Supplier, SKU, Category, Unit Price, Quantity, Total, Lead Time Days, Quality Score, On Time Delivery. Numbers use en-US locale (dot decimal). Realistic variance in prices and scores to make charts meaningful.

- **SeedContentStep** — Follows exact pattern from FolderScaffoldStep:
  1. `id: "seed-content"`, `order: 30`
  2. Iterates over seed files array
  3. For each: `fileExists()` check → skip or `createFile(path, content, { createFolders: true })`
  4. Sets `context.seededFiles: string[]` on success
  5. Returns partial progress on failure

- **Welcome note** — Personalized with `context.userName`. Contains: greeting, 5-step quickstart for Supplier Managers (explore dashboard, review sample data, import own data, create subscriptions, build queries), key concepts (events, dashboards, sessions).

**AC:**

- [ ] SeedContentStep has `id: "seed-content"`, `order: 30`, registered after FolderScaffoldStep
- [ ] First-run creates `03 - Resources/Sample Data/supplier-overview.csv` with ~48 rows of supplier data
- [ ] First-run creates `00 - Connectivity/inbox/Welcome to Flowti.md` with personalized guidance
- [ ] Step is idempotent — re-running skips existing files
- [ ] `context.seededFiles` populated with created file paths
- [ ] Partial progress saved on failure
- [ ] InstallerJourney and FirstRunOnboarding flow tests updated
- [ ] `npm test` passes

**Tests:** ~10 new

---

### Inc 2: Post-Install Supplier Dashboard (PBI-ONB-001)

**Goal:** Automatically create a "Supplier Overview" dashboard with pre-configured queries and tiles when installation completes, so the Supplier Manager sees immediate value.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/installer/seedDashboard.ts` | **New** — `seedSupplierDashboard(analyticsService)` function | +100 |
| `src/main.ts` | Add `installer.completed` listener after analytics service wiring (~line 792) | +8 |
| `tests/domain/installer/seedDashboard.test.ts` | **New** — unit tests with mocked AnalyticsService | +120 |

**Design:**

- **Why separate from installer pipeline**: `InstallerStepDeps` only has `{ fileSystem, eventBus, userService }` — no analytics access. In main.ts, the installer loads at line 624 but analytics loads at line 767. The wizard modal is non-blocking, so by the time the user clicks "Install", analytics IS loaded. Using an `installer.completed` event listener is the clean solution.

- **seedDashboard.ts** — Pure async function, no class:
  1. Idempotency: `analyticsService.listDashboards().find(d => d.name === "Supplier Overview")` → return if exists
  2. Create query "Supplier Overview - Monthly" — GROUP BY Supplier, measures: SUM(Total), SUM(Quantity), AVG(Quality Score), AVG(On Time Delivery), AVG(Lead Time Days), sorted by Total Spend desc
  3. Create query "Supplier Trend - Monthly Spend" — GROUP BY Month, measures: SUM(Total), sorted by Month asc
  4. Create dashboard "Supplier Overview"
  5. Add 5 tiles:
     - Row 0: 3 stat cards (Total Spend with currency format, Avg Quality Score, Avg On-Time Delivery) — width 1 each
     - Row 1: Bar chart "Monthly Spend Trend" — width 3, chartValueColumn: "Monthly Spend"
     - Row 2: Table "Supplier Breakdown" — width 3, currency format, showTableKpis: true, tableKpiLabel: "Suppliers"
  6. Set as default dashboard

- **Tile layout (3-column grid):**

```
┌─────────────┬─────────────┬─────────────┐
│ Total Spend │ Avg Quality │   Avg OTD   │  ← stat cards
├─────────────┴─────────────┴─────────────┤
│        Monthly Spend Trend (bar)        │  ← bar chart
├─────────────────────────────────────────┤
│        Supplier Breakdown (table)       │  ← table with KPIs
└─────────────────────────────────────────┘
```

- **main.ts wiring** — Register listener after analytics service is fully wired (after setBaseAdapter, setListFolder, etc.):
  ```
  this.crossCuttingListeners.push(
      this.eventBus.on("installer.completed", () => {
          if (this.analyticsService) {
              void seedSupplierDashboard(this.analyticsService);
          }
      }),
  );
  ```

**AC:**

- [ ] `installer.completed` triggers dashboard creation
- [ ] Dashboard named "Supplier Overview" with description
- [ ] 2 saved queries: supplier summary (by-supplier) and monthly trend
- [ ] 5 tiles: 3 stat cards (row 0), 1 bar chart (row 1), 1 table (row 2)
- [ ] Stat cards use width 1, chart and table use width 3
- [ ] Total Spend stat card has currency number format
- [ ] Table tile has `showTableKpis: true` and `tableKpiLabel: "Suppliers"`
- [ ] Dashboard set as default
- [ ] Idempotent: skips if "Supplier Overview" dashboard already exists
- [ ] Guard: `if (this.analyticsService)` prevents crash if analytics not yet loaded
- [ ] `npm test` passes

**Tests:** ~8 new

---

### Inc 3: Wizard Completion Redirect (PBI-ONB-002)

**Goal:** Replace the generic wizard completion page with supplier-relevant guidance and an "Explore Your Dashboard" action that opens the Analytics Hub.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/installer/InstallerWizardModal.ts` | Modify `renderCompletePage()` success path (lines 330-383) | +10, -10 |

**Design:**

- **"What to do next" bullets** — Replace the 4 generic developer-oriented bullets with supplier-relevant guidance:
  1. "Explore your Supplier Overview dashboard with live charts and KPI cards"
  2. "Review the sample supplier data in `03 - Resources/Sample Data/`"
  3. "Import your own CSV files by dropping them into `00 - Connectivity/imports/`"
  4. "Build custom queries and dashboards in the Analytics Hub"

- **Navigation buttons** — Replace the single "Close" button with:
  - "Close" as `ft-btn-secondary` (secondary, left position)
  - "Explore Your Dashboard" as `ft-btn-primary` (primary, right position) — on click: `void this.eventBus.emit("ui.openAnalyticsHub", {})` then `this.close()`
  - The modal already has `this.eventBus` as constructor-injected property — no new wiring needed

- **No test changes needed** — InstallerWizardModal is UI code tested via manual verification (Obsidian Modal rendering). The existing test suites don't test modal rendering.

**AC:**

- [ ] Completion page shows 4 supplier-relevant "What to do next" bullets
- [ ] "Explore Your Dashboard" button is primary (right-positioned, `ft-btn-primary`)
- [ ] "Close" button is secondary (left-positioned, `ft-btn-secondary`)
- [ ] Clicking "Explore Your Dashboard" opens Analytics Hub via `ui.openAnalyticsHub` event
- [ ] Clicking "Explore Your Dashboard" closes the modal
- [ ] Retry button still works on failure path (unchanged)
- [ ] `npm test` passes

**Tests:** 0 new (UI-only change, verified manually)

---

## Dependency Graph

```
Inc 1 (SeedContentStep) ── independent (installer pipeline, file system only)
    |
    v
Inc 2 (Supplier Dashboard) ── depends on Inc 1 (dashboard query references seed CSV path)
Inc 3 (Wizard Redirect) ── independent (UI-only modal change)
```

**Execution order:** Inc 1 → Inc 2 → Inc 3
**Critical path:** Inc 1 → Inc 2 (CSV must exist before dashboard references it)
**Parallelizable:** Inc 1 + Inc 3 (independent)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Analytics not loaded when `installer.completed` fires | High | Guard `if (this.analyticsService)`; wizard is non-blocking so analytics loads while user navigates wizard pages |
| CSV path mismatch between SeedContentStep and seedDashboard | Medium | Share `SEED_CSV_PATH` constant from `seedData.ts`; test verifies path match |
| Existing journey/flow tests break due to new step | Medium | Update `buildInstaller` helpers to register SeedContentStep; adjust step count assertions |
| Seed dashboard tile auto-positioning incorrect | Low | Override positions explicitly via `updateTile()` with row/col after `addTile()` |
| Demo user already has installed state | Low | Use `installerService.reset()` from Settings before demo; document in demo prep |
| Welcome note content becomes stale | Low | Co-located with step code; easy to update |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~18 |
| Post-cycle total tests | ~5,141 |
| Post-cycle suites | ~217 |
| New source files | 4 (seedData.ts, SeedContentStep.ts, seedDashboard.ts, + test files) |
| Seed CSV rows | ~48 |
| Dashboard tiles | 5 |
| Saved queries | 2 |
| Time from install to first dashboard view | < 30 seconds (wizard → click "Explore") |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Full Onboarding PRD (contextual tips, checklist, state tracking) | Too large for 1 cycle; needs OnboardingService infrastructure | Cycle 46+ |
| Role selection in wizard | Requires FlowtiUser schema change (add role field) | Cycle 46+ |
| Auto-import of seed CSV | Adds complexity; user can explore import manually | Cycle 46+ |
| Guided Tour: Create First Domain | Requires OnboardingService for state tracking | Cycle 46+ |
| Guided Tour: My First Feature | Depends on contextual onboarding infrastructure | Cycle 47+ |
| Train-of-thought in onboarding | Requires design; how does a train fit first-run? | Future |
| Session templates seeding | PBI-002 original scope; deferred to follow-up | Cycle 46 |
| Example domain seeding (events, flows, actors) | PBI-002 original scope; deferred to follow-up | Cycle 46 |
| Startpage setting | Separate UX feature; not onboarding-specific | Future |
| KPI Targets & RAG Status (PBI-ANA-134) | Analytics feature, not onboarding | Cycle 46+ |
| Supplier Management full PRD (512 lines) | Domain-level feature; requires data model design | Future |

---

## Definition of Ready (Pre-Cycle)

- [x] Cycle 44 delivered — all tests green, no blocking bugs
- [x] `npm test` passes (5,123 tests, 215 suites)
- [x] InstallerService extensible via `registerStep()` (verified in C1)
- [x] `InstallerStepDeps` provides `fileSystem` with `createFile()` and `fileExists()` methods
- [x] `InstallerContext` supports extensible keys via index signature `[key: string]: unknown`
- [x] AnalyticsService `createDashboard()`, `saveQuery()`, `addTile()`, `updateTile()`, `setDefaultDashboard()`, `listDashboards()` APIs exist and tested
- [x] `DashboardTile` supports all needed fields: `displayMode`, `row`, `col`, `width`, `height`, `numberFormat`, `chartValueColumn`, `showTableKpis`, `tableKpiLabel`
- [x] `TILE_MUTABLE_KEYS` whitelist includes all tile fields needed for seed tiles
- [x] `ui.openAnalyticsHub` event registered in UiCommandService (opens Analytics Hub)
- [x] `FolderScaffoldStep.test.ts` exists as pattern reference for SeedContentStep tests
- [x] `InstallerJourney.test.ts` and `01-FirstRunOnboarding.test.ts` both use `buildInstaller` helpers that can be extended
- [x] PBI-002 Seed Starter Content exists in backlog with acceptance criteria
- [x] Onboarding PRD exists in DRAFT state at `docs/features/Onboarding/Onboarding PRD.md`
- [x] Supplier overview CSV data structure designed (columns, rows, suppliers, date range)

## Definition of Done

### 1. All Increments Completed
- [ ] 3 increments delivered, no partial state

### 2. Quality Gates
- [ ] `npm test` passes — all tests green (target ~5,141)
- [ ] `npm run check` passes — no lint or type errors
- [ ] All new tests exercise the features they validate

### 3. Architecture
- [ ] SeedContentStep follows exact FolderScaffoldStep pattern (idempotent, context accumulation, createFolders: true)
- [ ] seedDashboard.ts is a pure function with no class or side effects beyond AnalyticsService API calls
- [ ] InstallerWizardModal changes are confined to renderCompletePage() success path
- [ ] `installer.completed` listener registered after analytics service wiring (timing-safe)
- [ ] No new dependencies added to InstallerStepDeps (seed dashboard handled via event, not pipeline)

### 4. User Experience
- [ ] First-run install seeds supplier CSV and welcome note
- [ ] Wizard completion page shows supplier-relevant guidance
- [ ] "Explore Your Dashboard" button opens Analytics Hub with pre-built dashboard
- [ ] Dashboard shows 5 tiles: 3 stat cards, 1 bar chart, 1 table
- [ ] Dashboard renders with realistic supplier data from seed CSV
- [ ] Entire flow from install to dashboard view takes < 30 seconds

### 5. Demo Readiness
- [ ] Demo script: reset installer → run wizard → enter name → install → click "Explore Your Dashboard" → see populated dashboard
- [ ] Verified via manual walkthrough before demo
