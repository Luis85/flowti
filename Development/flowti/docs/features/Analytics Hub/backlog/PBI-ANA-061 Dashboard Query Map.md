---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: high
dependencies:
  - "[[PBI-ANA-060 Query-by-Source Service]]"
tags:
  - analytics
  - dashboard
  - component
planned_in: "[[Cycle 37 - Cross-Domain Analytics]]"
delivered_in: "[[Cycle 37 - Cross-Domain Analytics]]"
---

# PBI-ANA-061: Dashboard Query Map

## User Story

As a Supplier Manager, I want to see which queries feed into my dashboard and which CSV sources each tile uses, so that I can understand the data lineage of my dashboard at a glance.

## Solution Statement

Add a collapsible "Queries" section to the dashboard detail view that shows the query map — which saved queries are used by the dashboard's tiles, with tile counts. Additionally, add a source CSV subtitle to tile headers for inline data lineage.

**Implementation details:**
- Collapsible query map component in the dashboard detail panel, using `getDashboardQueryMap()` from ANA-060
- Each query entry shows query name, source CSV path, and number of tiles using it
- Tile headers display a subtle source CSV subtitle beneath the tile title
- Query entries are clickable to navigate to the query in the Queries tab

## Acceptance Criteria

- [x] Dashboard detail shows collapsible "Queries" section with query map
- [x] Each query entry displays query name, source, and tile count
- [x] Tile headers show source CSV subtitle
- [x] Query entries navigate to the Queries tab on click
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v12)
- Cycle: [[Cycle 37 - Cross-Domain Analytics]] (Inc 2)
- Depends on: [[PBI-ANA-060 Query-by-Source Service]] (getDashboardQueryMap)
