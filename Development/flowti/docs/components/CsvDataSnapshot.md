---
type: Component
domain: Flowti
stage: done
description: "Interactive data table with column visibility chips, filtering, sorting, and row pagination"
source: "[[Development/flowti/src/ui/csv/CsvDataSnapshot.ts|CsvDataSnapshot.ts]]"
parent: "[[CsvActionView]]"
tags:
  - csv
  - component
---

# CsvDataSnapshot

## Description

CsvDataSnapshot renders an interactive preview table of the CSV file's raw data on the CsvLanding page. It provides column visibility toggles via clickable chips, a filter bar with optional column-specific filtering, sortable column headers with a three-click cycle (ascending, descending, reset), and row pagination. Display settings changes (sort, filter, hidden columns) are persisted via a callback to the parent, enabling the user's preferred view to survive re-renders and page reloads.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CsvComponentDeps` | interface | Shared dependency bag providing state access and render callbacks |
| `splitCsvLine` | utility | Parses CSV lines respecting the detected delimiter |
| `onDisplaySettingsChanged` | callback | Invoked after any sort/filter/column change to persist display settings |

## State

**Reads via `deps.getState()`:**
- `detectedDelimiter` -- used to parse CSV lines into cells
- `hiddenColumns` -- array of column names currently hidden from the table
- `previewSortColumn`, `previewSortDir` -- current sort column and direction (asc/desc)
- `filterColumn` -- specific column to filter on, or `null` for all-column search
- `filterText` -- current filter search text
- `previewMaxRows` -- maximum number of rows displayed in the table

**Writes via `deps.setState()`:**
- `hiddenColumns` -- toggled when column chips are clicked
- `previewSortColumn`, `previewSortDir` -- set when column headers are clicked
- `filterColumn` -- set from the filter dropdown
- `filterText` -- set from the filter text input

## Renders

- **Heading row**: "Data Snapshot" title, row count badge (shows filtered count when active), hidden column count badge, "Reset" button (visible only when columns are hidden)
- **Column chips**: one chip per CSV header; clickable to toggle visibility; hidden columns styled with `ft-column-hidden` class
- **Filter bar**: column selector dropdown ("All columns" or specific column), text input for filter term
- **Data table**: sortable headers with ascending/descending arrows, data rows limited to `previewMaxRows`, numeric-aware sorting via `localeCompare` with `{ numeric: true }`
- **Overflow notice**: "Showing first N of M rows" text when total rows exceed the display limit

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | CsvDataSnapshot does not interact with the event bus; all changes are communicated via state and the `onDisplaySettingsChanged` callback |

## Related

- Parent: [[CsvActionView]] (embedded by [[CsvLanding]])
- Siblings: [[CsvUsageSection]], [[CsvAssociatedBases]]
