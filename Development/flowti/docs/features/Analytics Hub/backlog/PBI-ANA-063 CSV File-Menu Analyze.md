---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: high
dependencies:
  - "[[PBI-ANA-060 Query-by-Source Service]]"
tags:
  - analytics
  - csv
  - file-menu
planned_in: "[[Cycle 37 - Cross-Domain Analytics]]"
delivered_in: "[[Cycle 37 - Cross-Domain Analytics]]"
---

# PBI-ANA-063: CSV File-Menu Analyze

## User Story

As a Supplier Manager, I want a right-click menu option on CSV files to quickly open the Analytics Hub with that file as the pre-selected source, so that I can start analyzing data with minimal clicks.

## Solution Statement

Add an "Analyze in Analytics Hub" menu item to the Obsidian file-menu context menu for CSV files. Clicking the menu item opens the Analytics Hub and pre-selects the CSV file as the query source.

**Implementation details:**
- Register file-menu item via Obsidian's `file-menu` event
- Menu item only appears for `.csv` files
- On click: opens the Analytics Hub leaf (or reveals existing), then navigates to the Queries tab with the source pre-selected
- Uses the `navigateToEntity` pattern with the CSV path as the entity identifier

## Acceptance Criteria

- [x] Right-click on a CSV file shows "Analyze in Analytics Hub" menu item
- [x] Menu item only appears for CSV files (not other file types)
- [x] Clicking the menu item opens the Analytics Hub with the source pre-selected
- [x] Works with both new and existing Analytics Hub leaves
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v12)
- Cycle: [[Cycle 37 - Cross-Domain Analytics]] (Inc 4)
- Depends on: [[PBI-ANA-060 Query-by-Source Service]] (cross-domain lookup)
- Related: [[PBI-ANA-064 Source Pre-Selection]] (pre-selection target in Analytics Hub)
