---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
dependencies:
  - "[[PBI-ANA-032 Conditional Formatting]]"
tags:
  - analytics
  - conditional-formatting
  - ui
  - supplier-management
planned_in: "[[Cycle 33 - Trend Intelligence]]"
user_story: "[[Feature - Supplier Management]]"
---

# PBI-ANA-037: Conditional Formatting Rule Builder UI

## User Story — Problemspace

**Persona:** Supplier Manager

**Context:** Cycle 32 delivered the conditional formatting type system (`ConditionalRule`), evaluator (`evaluateConditionalRules`), and renderer (color application to stat-card text and table cell backgrounds). However, the UI to configure these rules was deferred (DEV-2). Rules can only be set programmatically — there is no visual way for the Supplier Manager to say "color cost increases red."

**Pains:**
- Conditional formatting exists in the engine but is invisible to the user — no UI to create rules
- The Supplier Management PRD (§10) explicitly requires "Conditional coloring: Cost increase (red), Margin improvement (green), Low coverage warning (orange)"
- Rules must be configured per tile, but DashboardsTab has no tile settings area — all controls are inline in the tile header bar
- After Inc 1-2, computed columns like `PCT_CHANGE({Cost})` exist but can't be color-coded without manual rule configuration

**Needs:**
- Visual rule builder: column dropdown → operator → threshold → color preset
- Rule configuration accessible per tile without leaving the dashboard
- Computed columns (including trend functions) available in the column dropdown
- Immediate visual feedback when rules are applied

## Solution Statement

### New UI Pattern: Collapsible Tile Settings Panel

DashboardsTab currently renders tiles with an inline header bar: title, freshness badge, mode toggle, move buttons, refresh, remove. There is no expandable settings area.

**New pattern:**
- Gear icon (⚙) in tile header bar → toggles a collapsible settings panel below the tile header, above the tile body
- CSS transition for smooth open/close (consistent with collapsible patterns in QueriesTab)
- Panel is extensible for future per-tile settings (axis config, custom labels, etc.)
- Only content in v1: "Formatting Rules" section

### Formatting Rules Section

- "Add Rule" button → appends new rule row
- Per rule row:
  - **Column dropdown** — populated from the tile's query result columns (headers + computed columns). String-typed computed columns (from IF) are excluded (conditional rules only apply to numeric values).
  - **Operator dropdown**: `>`, `<`, `>=`, `<=`, `=`, `!=`
  - **Threshold input**: number field
  - **Color preset picker**: 3 buttons (green ✓ = positive, red ✗ = negative, amber ⚠ = warning) + text input for custom CSS color string
  - **Remove (×) button**
- Rules ordered top-to-bottom = evaluation priority (first match wins)
- Changes persist immediately via existing `analytics.dashboard.tile.updated` event
- Uses existing `evaluateConditionalRules()` and `resolveColor()` from `conditionalFormatting.ts`

### Visual Indicators

- Tile header: small colored dot when tile has ≥1 conditional rule configured
- Gear icon gets subtle highlight when settings panel is open

### Functional Requirements

- FR-49: Visual rule builder with column dropdown (including computed columns), operator, threshold, color presets

### Architecture

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardsTab.ts` | Add gear icon + collapsible settings panel + formatting rules section | +120 |
| `src/ui/analytics/DashboardTileRenderer.ts` | Add conditional rule indicator dot in tile header | +10 |

### Acceptance Criteria

- [ ] Tile header shows gear icon that toggles a collapsible settings panel
- [ ] Settings panel contains "Formatting Rules" section with "Add Rule" button
- [ ] Rule row renders: column dropdown (including computed columns), operator dropdown, threshold input, color picker
- [ ] User can add multiple rules per tile
- [ ] User can remove individual rules via × button
- [ ] Color preset buttons set positive/negative/warning; custom input accepts CSS color strings
- [ ] Rules persist in tile configuration (survive hub close/reopen)
- [ ] Configured rules apply immediately on tile render
- [ ] Tile header shows colored indicator dot when rules are configured
- [ ] String-valued computed columns excluded from column dropdown
- [ ] `npm test` passes

## Test Intent

~8 tests covering:
- 3 rule builder rendering (add rule, remove rule, multiple rules)
- 2 persistence (persist across close/reopen, conditional rules array)
- 2 integration (rules apply color on render, preset resolution)
- 1 computed column dropdown (includes numeric computed, excludes string computed)

## Related

- PRD: [[Analytics Hub PRD]] (FR-49)
- Cycle: [[Cycle 33 - Trend Intelligence]] (Inc 3)
- Completes: Cycle 32 DEV-2 (conditional formatting UI deferred)
- Depends on: [[PBI-ANA-032 Conditional Formatting]] (type system + evaluator)
- Supplier PRD: [[Feature - Supplier Management]] (§10 Conditional coloring)
