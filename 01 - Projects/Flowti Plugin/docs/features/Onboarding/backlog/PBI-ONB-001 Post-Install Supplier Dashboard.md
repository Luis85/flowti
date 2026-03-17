---
type: ProductBacklogItem
feature: "[[Onboarding PRD]]"
priority: high
stage: planned
dependencies:
  - "[[PBI-002 Seed Starter Content]]"
tags:
  - onboarding
  - analytics
  - supplier-manager
planned_in: "[[Cycle 45 - Supplier Manager Onboarding]]"
user_story: "[[As Supplier-Manager, I want a seamless onboarding]]"
---

## User Story - Problemspace

As a Supplier Manager completing the Flowti first-run installer, I want to see a pre-built analytics dashboard with supplier KPIs immediately after installation so that I understand the system's value without having to build anything from scratch.

### User Pains

- After installation completes, the Analytics Hub has no dashboards — user must create everything manually
- Building a first dashboard requires learning the query builder, understanding CSV sources, and configuring tiles — a 30+ minute learning curve
- The disconnect between "install complete" and "first value moment" causes early drop-off
- No sample data means no visualizations to explore, even if the user finds the Analytics Hub

### User Needs

- Pre-built "Supplier Overview" dashboard available immediately after install
- Dashboard with meaningful KPI cards (spend, quality, delivery), charts (trend), and tables (breakdown)
- Sample queries that demonstrate the analytics capabilities
- Dashboard set as default so it loads first when opening Analytics Hub

## Solutionstatement

### Functional Requirements

- [ ] Listen to `installer.completed` event to trigger dashboard creation
- [ ] Create 2 saved analytics queries: supplier summary (by-supplier) and monthly spend trend
- [ ] Create "Supplier Overview" dashboard with description
- [ ] Add 5 tiles: 3 stat cards (Total Spend, Avg Quality, Avg OTD), 1 bar chart (Monthly Spend Trend), 1 table (Supplier Breakdown)
- [ ] Configure tile layout: stat cards in row 0 (width 1 each), chart in row 1 (width 3), table in row 2 (width 3)
- [ ] Set Total Spend stat card with currency number format
- [ ] Set table tile with `showTableKpis: true` and `tableKpiLabel: "Suppliers"`
- [ ] Set dashboard as default via `setDefaultDashboard()`
- [ ] Idempotent: skip if "Supplier Overview" dashboard already exists

### Technical Requirements

- Pure async function `seedSupplierDashboard(analyticsService)` in `src/domain/installer/seedDashboard.ts`
- Triggered via `installer.completed` event listener registered in `main.ts` after analytics service is wired
- Guard: `if (this.analyticsService)` prevents crash if analytics not yet loaded
- References `SEED_CSV_PATH` from `seedData.ts` for query source path

## Acceptance Criteria

- [ ] `installer.completed` triggers dashboard creation
- [ ] Dashboard named "Supplier Overview" with 5 tiles renders correctly
- [ ] Queries reference the seed CSV path from SeedContentStep
- [ ] Dashboard set as default
- [ ] Idempotent on re-install
- [ ] `npm test` passes

## Related

- PRD: [[Onboarding PRD]]
- Depends on: [[PBI-002 Seed Starter Content]]
- Inbox: [[As Supplier-Manager, I want a seamless onboarding]]
- Cycle: [[Cycle 45 - Supplier Manager Onboarding]]
