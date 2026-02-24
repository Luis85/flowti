---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
dependencies:
  - "[[PBI-ANA-016 Dashboard First Overview]]"
tags:
  - analytics
  - homepage
  - ux
  - supplier-management
planned_in: "[[Cycle 33 - Trend Intelligence]]"
user_story: "[[I need better navigation on my Analytics Hub Homepage]]"
---

# PBI-ANA-038: Analytics Hub Homepage Polish

## User Story — Problemspace

**Persona:** Supplier Manager

**Context:** The Supplier Manager opens the Analytics Hub daily to check cost and sales KPIs. The current homepage renders either the default dashboard (full tile grid) or a fallback stats page. Four inbox items from 2026-02-24 signal daily workflow friction:
1. "I need better navigation on my Analytics Hub Homepage"
2. "I want to add up to three dashboards to the analytics hub homepage"
3. "Saved queries need to be above Query Sources on the Analytics Hub Queries List view"

**Pains:**
- Only one dashboard renders on the homepage (the default). The Supplier Manager has multiple dashboards (Cost Analysis, Revenue Trends, Inventory Status) and must navigate two clicks to reach the second and third.
- Saved queries are listed below source files in QueriesTab. The Supplier Manager who has 5 saved queries and 3 CSV sources must scroll past sources to find their queries — queries are used 10x more frequently than sources after initial setup.
- No quick way to jump from a dashboard tile to the underlying query for adjustment.

**Needs:**
- Pin up to 3 dashboards to the homepage for zero-click daily KPI access
- Saved queries appear first in the Queries tab master list
- Sources section collapsible after initial setup

## Solution Statement

### Homepage Dashboard Pinning

**Relationship with default dashboard:**
- `defaultDashboardId` renders a full dashboard with all tiles (existing behavior from Cycle 29)
- `pinnedDashboardIds` renders compact summary cards **above** the default dashboard
- Both concepts coexist — pinned = quick glance, default = full detail
- If no default is set but pinned dashboards exist, pinned cards show above the fallback stats

**Implementation:**
- Add `pinnedDashboardIds?: string[]` to `AnalyticsState` (max 3)
- `AnalyticsService.pinDashboard(id)` / `unpinDashboard(id)` — toggle pin, enforce max 3
- `AnalyticsDashboardPage.ts` (312 LOC) renders:
  - **Pinned section** (new, top): horizontal row of 1-3 compact dashboard cards. Each card shows dashboard name, tile count, 1-2 stat values from first tile. Click → navigates to that dashboard.
  - **Default dashboard** (existing, middle): full tile grid
  - **Favorites + Recent Sources** (existing, bottom): unchanged
- DashboardsTab: pin icon per dashboard row. Filled = pinned. Click to toggle.

### Queries Above Sources

**Current state:** `SavedQueryList.ts` (~150 LOC) renders an interleaved list of saved queries and source files.

**Refactor:**
- **"Saved Queries" section** (top) — with section header showing count, existing star icons, CRUD actions
- **"Sources" section** (bottom) — with collapsible toggle arrow, defaults to collapsed when ≥1 saved query exists
- This ensures the Supplier Manager sees saved queries immediately without scrolling

### Navigation Polish

- "Open in Queries" action on dashboard tile header → navigates to Queries tab with the tile's source query context via `navigateTo("queries")`

### Functional Requirements

- FR-50: Pin up to 3 dashboards to homepage; compact summary cards; persistent
- FR-51: Saved queries above sources in QueriesTab; collapsible sources section

### Architecture

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/AnalyticsDashboardPage.ts` | Render pinned dashboard cards above default dashboard | +60 |
| `src/domain/analytics/types.ts` | Add `pinnedDashboardIds` to AnalyticsState | +3 |
| `src/domain/analytics/AnalyticsService.ts` | pinDashboard/unpinDashboard methods + persist | +30 |
| `src/ui/analytics/DashboardsTab.ts` | Pin icon action in dashboard list | +20 |
| `src/ui/analytics/queries/SavedQueryList.ts` | Reorder: queries above sources, collapsible sources section | +40 |

### Acceptance Criteria

- [ ] User can pin up to 3 dashboards to the homepage via pin icon action
- [ ] Pinned dashboards render as compact summary cards above default dashboard on homepage
- [ ] Unpinning removes dashboard card from homepage
- [ ] Pinned and default dashboard coexist (pinned = compact cards, default = full tiles)
- [ ] Pin state persists in AnalyticsState across hub close/reopen
- [ ] Max 3 pin limit enforced; attempting to pin a 4th fails gracefully
- [ ] Saved queries section appears above sources section in QueriesTab master list
- [ ] Sources section is collapsible and defaults to collapsed when saved queries exist
- [ ] "Open in Queries" action on tile header navigates to Queries tab
- [ ] `npm test` passes

## Test Intent

~8 tests covering:
- 3 pin/unpin service (pin, unpin, max 3 enforcement, persistence)
- 2 homepage rendering (pinned cards render, coexistence with default)
- 3 query list ordering (queries above sources, collapsible sources, empty state)

## Related

- PRD: [[Analytics Hub PRD]] (FR-50, FR-51)
- Cycle: [[Cycle 33 - Trend Intelligence]] (Inc 4)
- Depends on: [[PBI-ANA-016 Dashboard First Overview]] (homepage rendering)
- Inbox: [[I need better navigation on my Analytics Hub Homepage]]
- Inbox: [[I want to add up to three dashboards to the anayltics hub homepage]]
- Inbox: [[Saved queries need to be above Query Sources on the Anayltics Hub Queries List view]]
