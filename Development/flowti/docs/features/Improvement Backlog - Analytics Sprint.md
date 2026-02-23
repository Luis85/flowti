---
type: BacklogRefinement
date_created: 2026-02-23
last_updated: 2026-02-23
focus: Dashboards and Analytics Hub
trigger: Client demand — 3 CSV files (Items, Suppliers, Sales) arriving end of week
target_cycle: 27
---

# Backlog Refinement — Dashboards & Analytics Hub

## Context

**Client need (urgent):** By end of week we receive 3 CSV files — **Items**, **Suppliers**, **Sales**. Flowti must answer two business questions:

1. **How much cost per `item_id` per supplier, by month?**
2. **How many sales per `item_id` per supplier, by month?**

**Locale constraint:** Data arrives from the USA — US number format (`1,234.56` — comma thousands, period decimal) and US date format (`MM/DD/YYYY`). Flowti must let users **mark columns as date or number** and specify the locale so that aggregation parses values correctly. Without this, SUM on `"1,234.56"` would fail or produce wrong results in a European locale context.

**Current state:** Flowti has a mature Data Exchange Hub (DX PRD at stage `done`, FRI L4) with CSV import → Obsidian notes, export back to CSV/tab, multi-source pipelines with merge-key deduplication, and a data dictionary. But there is **zero aggregation capability** — no SUM, COUNT, GROUP BY, no joins, no pivot, no charts. After import, users must leave Obsidian to answer questions.

**Gap:** CSV import is ETL only (Extract → Transform → Load). The "T" is column mapping, not computation. There is no query engine for aggregation, no cross-file joining, no locale-aware number/date parsing, and no visualization layer.

**Opportunity:** Extend the DX Hub from import/export tool into a **lightweight analytics workbench** — keep the Obsidian-native philosophy (notes + frontmatter) but add the ability to answer business questions without leaving the vault.

---

## Architecture Assessment

### What We Have

| Capability | Status | Key Files |
|---|---|---|
| CSV parsing (auto-delimiter) | Done | `CsvParser.ts` |
| CSV → notes (row per note) | Done | `ImportService.ts` |
| Multi-CSV pipeline (merge key) | Done | `PipelineExecutor.ts` |
| Base file query engine (filter) | Done | `BaseQueryEngine.ts` |
| Notes → CSV export | Done | `ExportService.ts` |
| Data dictionary (properties) | Done | `DataDictionaryBuilder.ts` |
| DX Hub with 8 tabs | Done | `DataExchangeHubView.ts` |
| Vault query service | Done | `VaultQueryService.ts` |

### What We Need

| Capability | Gap | Effort |
|---|---|---|
| **In-memory CSV query** (avoid note round-trip) | Full gap | Medium |
| **Aggregation engine** (SUM, COUNT, AVG, GROUP BY) | Full gap | Medium |
| **Multi-CSV join** (item_id as foreign key) | Full gap | Medium |
| **Time bucketing** (month/quarter/year from date column) | Full gap | Low |
| **Locale-aware parsing** (US/EU number and date formats) | Full gap | Medium |
| **Analytics view** (table + summary cards) | Full gap | Medium |
| **Pivot-style grouping** (rows = items, cols = months) | Full gap | Medium |

### Design Decision: Notes vs In-Memory

Two approaches for analytics:

| Approach | Pro | Con |
|---|---|---|
| **A: Query imported notes** (frontmatter scan) | Leverages existing import pipeline | Slow for 10k+ notes, requires import first, can't join easily |
| **B: In-memory CSV engine** (parse + aggregate without import) | Fast, no vault pollution, joins trivial | New data path, duplicates some CsvParser work |

**Recommendation: Approach B** — In-memory CSV analytics engine. Reasons:
- Client CSVs may have 10k+ rows — creating 10k notes just to aggregate is wasteful
- Joining 3 CSVs in-memory is trivial; joining 3 folders of notes is complex
- The import pipeline remains for *master data* (items you want as notes); analytics answers *questions about* data
- We can offer "Import results as notes" as an optional step after analysis

---

## Business Questions → Technical Requirements

### Q1: Cost per item_id per supplier, by month

**Input:** Items CSV (`item_id`, `name`, `cost`, ...) + Suppliers CSV (`supplier_id`, `name`, ...) + Sales CSV (`item_id`, `supplier_id`, `date`, `quantity`, `unit_cost`, ...)

**Operation:**
1. Load Sales CSV in memory
2. Join with Items on `item_id` (for item name)
3. Join with Suppliers on `supplier_id` (for supplier name)
4. Extract month from date column
5. GROUP BY `item_id`, `supplier_id`, `month`
6. SUM `unit_cost * quantity` (or SUM `cost` if pre-computed)

**Output:** Table: `item_id | item_name | supplier | month | total_cost`

### Q2: Sales count per item_id per supplier, by month

**Operation:** Same join + grouping, but COUNT rows (or SUM quantity) instead of SUM cost.

**Output:** Table: `item_id | item_name | supplier | month | sales_count`

### Common Pattern

Both questions follow the same pattern:
1. **Load** multiple CSVs
2. **Join** on shared keys
3. **Bucket** a date column by period (month)
4. **Group** by dimensions (item, supplier, period)
5. **Aggregate** a measure (SUM cost, COUNT sales)
6. **Display** result as a table (optionally export)

This is a classic **pivot table / OLAP slice** operation.

---

## Proposed Feature: Analytics Query

### Domain Model

```
AnalyticsQuery {
  id: string
  name: string
  sources: AnalyticsSource[]        // 1-3 CSV files
  joins: JoinSpec[]                 // how to link them
  dimensions: DimensionSpec[]       // GROUP BY columns
  measures: MeasureSpec[]           // SUM/COUNT/AVG columns
  timeBucket?: TimeBucketSpec       // month/quarter/year extraction
  filters?: FilterSpec[]            // optional WHERE clauses
  createdAt: string
}

AnalyticsSource {
  id: string
  alias: string                     // "items", "suppliers", "sales"
  csvPath: string                   // vault path to CSV
  locale?: SourceLocale             // locale for number/date parsing
}

SourceLocale {
  id: "en-US" | "de-DE" | "nl-NL" | "fr-FR" | "en-GB" | "auto"
  numberFormat: {
    decimalSeparator: "." | ","     // US/GB: "."  EU: ","
    thousandsSeparator: "," | "."   // US/GB: ","  EU: "."
  }
  dateFormat: "MM/DD/YYYY"          // US
             | "DD/MM/YYYY"         // EU, UK
             | "DD.MM.YYYY"         // DE, CH
             | "YYYY-MM-DD"         // ISO
             | "auto"               // try all, pick best match
}

// Built-in locale presets:
// "en-US"  → decimal ".", thousands ",", date "MM/DD/YYYY"
// "de-DE"  → decimal ",", thousands ".", date "DD.MM.YYYY"
// "en-GB"  → decimal ".", thousands ",", date "DD/MM/YYYY"
// "nl-NL"  → decimal ",", thousands ".", date "DD-MM-YYYY"
// "fr-FR"  → decimal ",", thousands " ", date "DD/MM/YYYY"
// "auto"   → heuristic detection (default)

ColumnTypeHint {
  column: string                    // CSV column name
  type: "number" | "date" | "string"  // explicit type annotation
}

JoinSpec {
  leftSource: string                // alias
  leftColumn: string                // e.g., "item_id"
  rightSource: string               // alias
  rightColumn: string               // e.g., "item_id"
  type: "inner" | "left"
}

DimensionSpec {
  source: string                    // alias
  column: string                    // e.g., "supplier_id"
  label?: string                    // display name override
}

MeasureSpec {
  source: string
  column: string
  aggregation: "sum" | "count" | "avg" | "min" | "max"
  label?: string
}

TimeBucketSpec {
  source: string
  column: string                    // date column
  bucket: "month" | "quarter" | "year"
}
```

### Locale-Aware Parsing

**Problem:** CSV values are raw strings. `"1,234.56"` is a valid US number but would be parsed as `1` in German locale (comma = decimal). `"02/03/2026"` is Feb 3rd in US but Mar 2nd in EU.

**Solution:** Each `AnalyticsSource` carries an optional `locale` setting. The engine uses it to:
1. **Parse numbers**: strip thousands separator, replace decimal separator with `.`, then `parseFloat()`
2. **Parse dates**: apply the locale's date format to extract day/month/year
3. **Column type hints**: user marks columns as `number`, `date`, or `string` — engine skips parsing for `string` columns

**Default:** `"auto"` — heuristic detection:
- Numbers: if a column has values like `1,234.56` (comma before period), assume US; if `1.234,56`, assume EU
- Dates: if first value has month > 12 in position 1, it must be DD/MM; otherwise ambiguous → ask user

**UI:** Per-source locale dropdown in query builder (Step 1). Column type hints shown as badges after CSV column detection (Step 2). Pre-filled from locale preset, editable per column.

### PBI Breakdown

| PBI | Title | Priority | Effort | Description |
|---|---|---|---|---|
| PBI-ANA-001 | Analytics Engine Core | P0 (blocker) | High | In-memory CSV join + GROUP BY + aggregation engine. Pure domain logic, no UI. |
| PBI-ANA-002 | Analytics Query Builder UI | P0 (blocker) | High | New tab in DX Hub: source picker, join config, dimension/measure selection, time bucketing. |
| PBI-ANA-003 | Analytics Results View | P0 (blocker) | Medium | Results table + stat summary cards. Export result as CSV. |
| PBI-ANA-004 | Saved Analytics Queries | P1 | Low | Persist query configs to storage. Rerun with updated CSVs. |
| PBI-ANA-005 | Analytics Dashboard Cards | P2 | Medium | Summary stat cards on DX Hub dashboard (total cost, top supplier, trend). |

### PBI Details

#### PBI-ANA-001: Analytics Engine Core

**User Story:** As a data analyst, I want to join multiple CSV files and aggregate values so that I can answer business questions without leaving Obsidian.

**Scope:**
- `AnalyticsEngine` class in `src/domain/analytics/`
- Parse multiple CSVs via existing `CsvParser`
- In-memory hash join on specified key columns (inner + left)
- GROUP BY on multiple columns
- Aggregate functions: SUM, COUNT, AVG, MIN, MAX
- Locale-aware number parsing: US (`1,234.56`) and EU (`1.234,56`) formats via `SourceLocale`
- Locale-aware date parsing: US (`MM/DD/YYYY`), EU (`DD/MM/YYYY`, `DD.MM.YYYY`), ISO (`YYYY-MM-DD`)
- Column type hints: explicit `number` / `date` / `string` annotation per column
- Time bucketing: extract month/quarter/year from parsed dates
- Returns `AnalyticsResult { columns, rows, summary }` — plain data, no DOM

**AC:**
- [ ] Join 2 CSVs on a shared key column
- [ ] Join 3 CSVs on different key columns
- [ ] GROUP BY 1-3 dimension columns
- [ ] SUM/COUNT/AVG on numeric columns
- [ ] SUM works correctly on US-formatted numbers (`1,234.56` → 1234.56)
- [ ] SUM works correctly on EU-formatted numbers (`1.234,56` → 1234.56)
- [ ] Extract month from US date (`02/15/2026` → `2026-02`)
- [ ] Extract month from EU date (`15.02.2026` → `2026-02`)
- [ ] Extract month from ISO date (`2026-02-15` → `2026-02`)
- [ ] Column type hint "number" triggers locale-aware parsing
- [ ] Column type hint "date" triggers locale-aware date extraction
- [ ] Handle missing join keys gracefully (null/empty → "Unknown")
- [ ] 10k rows processed in < 2 seconds
- [ ] `npm test` passes

**Test intent:** ~50 tests covering join, grouping, aggregation, locale parsing (US + EU), time bucketing, edge cases.

#### PBI-ANA-002: Analytics Query Builder UI

**User Story:** As a user, I want a visual interface to configure which CSVs to analyze, how to join them, and what to measure — without writing code.

**Scope:**
- New "Analytics" tab in DX Hub (9th tab)
- Step 1: Select CSV sources (1-3 files from vault) **+ locale dropdown per source** (en-US, de-DE, en-GB, nl-NL, fr-FR, auto)
- Step 2: Define joins (dropdowns for left/right column matching) + **column type hints** (number/date/string badges per column)
- Step 3: Pick dimensions (GROUP BY columns) + measures (aggregation)
- Step 4: Optional time bucket config (date column + period)
- "Run Query" button → delegates to AnalyticsEngine
- Locale preset auto-fills column type hints (number columns detected from sample values)

**AC:**
- [ ] Analytics tab visible in DX Hub
- [ ] Can select 1-3 CSV files as sources
- [ ] Locale dropdown per source with presets (en-US, de-DE, en-GB, nl-NL, fr-FR, auto)
- [ ] Column type hints shown as badges (number/date/string) after CSV detection
- [ ] Type hints pre-filled from locale + sample value heuristic
- [ ] User can override type hints per column
- [ ] Auto-detect columns from each CSV
- [ ] Join configuration with column dropdowns
- [ ] Dimension and measure selection
- [ ] Time bucket toggle with date column picker
- [ ] Validation: at least 1 source, 1 dimension, 1 measure
- [ ] `npm test` passes

**Test intent:** ~30 tests covering UI state, validation, column detection, locale selection.

#### PBI-ANA-003: Analytics Results View

**User Story:** As a user, I want to see analytics results in a clear table with summary stats, and optionally export them.

**Scope:**
- Results table below query builder (or replacing it after run)
- Column headers from dimensions + measures
- Sortable columns (click header)
- Summary stat cards: total rows, sum of primary measure, unique dimension values
- "Export as CSV" button (reuses ExportService)
- "Import as Notes" button (optional — creates one note per result row)

**AC:**
- [ ] Results table renders with correct columns and values
- [ ] Columns are sortable
- [ ] Summary stat cards show key aggregates
- [ ] Export to CSV works
- [ ] "Import as Notes" creates notes from result rows
- [ ] `npm test` passes

**Test intent:** ~15 tests for rendering, sorting, export.

#### PBI-ANA-004: Saved Analytics Queries

**User Story:** As a user, I want to save analytics queries so I can rerun them when CSVs are updated.

**Scope:**
- Persist `AnalyticsQuery` configs to `DataExchangeState.savedAnalyticsQueries`
- List saved queries in Analytics tab sidebar
- Load → edit → rerun flow
- Delete saved query

**AC:**
- [ ] Save a query with name
- [ ] Load saved query and rerun
- [ ] Delete saved query
- [ ] Queries survive plugin reload
- [ ] `npm test` passes

**Test intent:** ~10 tests for CRUD + persistence.

#### PBI-ANA-005: Analytics Dashboard Cards

**User Story:** As a user, I want to see key analytics insights on the DX Hub dashboard.

**Scope:**
- New "Analytics" section on HubDashboard
- Shows saved query count + last run timestamp
- Optional: pinned result summary (e.g., "Total Cost This Month: €12,340")

**AC:**
- [ ] Analytics section visible on dashboard when queries exist
- [ ] Shows query count and last run info
- [ ] `npm test` passes

**Test intent:** ~5 tests.

---

## Cycle 27 Scope Recommendation

**Theme:** "Analytics Sprint — CSV Intelligence"

Given the client deadline (end of week), propose a focused 5-increment cycle:

| Inc | PBI | What | Tests |
|---|---|---|---|
| 1 | ANA-001 (core) | AnalyticsEngine: join + aggregate + locale-aware parsing + time bucket | ~50 |
| 2 | ANA-001 (types/events) | Types, events, domain wiring | ~10 |
| 3 | ANA-002 | Query Builder UI in DX Hub (with locale picker + column type hints) | ~30 |
| 4 | ANA-003 | Results View + export | ~15 |
| 5 | ANA-004 + integration | Saved queries + flow tests | ~15 |

**Deferred to Cycle 28+:**
- PBI-ANA-005 (Dashboard cards) — polish, not urgent
- Column mapping/aliasing on sources — not needed for the 3 clean CSVs, essential for messy data
- Column transforms (strip currency, whitespace) — same: clean CSVs first, messy later
- `.base` file generation from results — leverage Obsidian Bases as exploration layer
- Base formula columns as calculated fields — delegate to Obsidian instead of building our own
- Chart/visualization — nice-to-have, tables answer the immediate questions
- Calculated columns / formulas — not needed for current client questions; Base formulas cover some
- Scheduled re-analysis — future automation
- CSV parser improvements (multi-row headers, skip rows, header normalization) — not needed for MVP

**Estimated:** ~120 tests, ~900-1100 LOC domain + ~700-900 LOC UI

---

## Strategic Vision: Replace Excel Before It's Needed

### The Thesis

The 3 well-defined client CSVs are the MVP catalyst, but the real opportunity is making Flowti the go-to tool for **data analytics questions that would otherwise require Excel**. The architecture must satisfy two timelines:

1. **Now (Cycle 27):** 3 known CSVs with clean schemas → join + aggregate → answer 2 questions
2. **Next (Cycle 28+):** Unknown CSVs with messy schemas → column mapping + Obsidian Bases evaluation → answer ad-hoc questions

### CSV Parser Improvements (Post-MVP)

The current `CsvParser` (papaparse wrapper) handles delimiter auto-detection but has no concept of column semantics. For real-world CSVs:

| Gap | Problem | Solution |
|---|---|---|
| **Column mapping/renaming** | Client CSV has `"Product #"` but we need `"item_id"` | Column alias map per source (like existing import column mapping) |
| **Column transformation** | `"$1,234.56"` has currency prefix | Strip rules per column (regex or predefined: currency, %, whitespace) |
| **Header normalization** | `"  Item ID "` has whitespace, case variations | Auto-trim + optional case normalization |
| **Multi-row headers** | Some CSVs have 2-row headers (category + column) | Header row selector (row index, default 0) |
| **Skip rows** | Summary rows at top/bottom of exported reports | Skip-first-N / skip-last-N options |

**Recommendation:** Add `ColumnAlias` and `ColumnTransform` to `AnalyticsSource` in a future increment. For the MVP, the 3 clean CSVs don't need this — but the type system should leave room for it.

### Obsidian Bases as Evaluation Engine

Obsidian Bases (`.base` files) already provide a **filter + view engine** that we integrate via `BaseQueryEngine`. The strategic play:

1. **Analytics results → .base file**: After running a query, generate a `.base` file that defines a view over the result notes (if imported)
2. **Base formulas as derived columns**: Obsidian Bases support `formula` columns — these can compute derived values (e.g., `cost * quantity`) without our engine needing a formula system
3. **Base views for drill-down**: Analytics result is the summary; the `.base` view over imported notes is the detail — click a row to see the underlying records
4. **Base as saved query visualization**: Instead of our own results table, a `.base` file with the right filters and columns IS the dashboard

**Architecture implication:** The analytics engine produces the *aggregated data*. Obsidian Bases provide the *exploration layer* for the underlying detail records. These complement each other:

```
Analytics Engine (in-memory)          Obsidian Base (vault-native)
├── JOIN + GROUP BY + SUM             ├── Filter by folder/frontmatter
├── Produces summary table            ├── Show individual records
├── Answers "how much / how many"     ├── Answers "show me which ones"
└── Export as CSV                     └── Sort, formula columns, views
```

**Cycle 27 touchpoint:** "Import as Notes" in Inc 4 already creates notes from result rows. Add optional `.base` file generation (reuse existing `createBase` from ImportService) to give the user an instant Base view of the analytics output.

**Cycle 28+ vision:**
- Base-backed analytics: run query → import results → generate `.base` → Obsidian takes over for exploration
- Bidirectional: edit values in Base view → re-export → feed back into analytics
- Base formula columns as "calculated columns" (delegated to Obsidian, not our engine)

### Column Mapping — The Bridge to Messy Data

For the MVP (3 clean CSVs), column names match across files — `item_id` in Sales matches `item_id` in Items. Real-world data won't be this clean.

**Future `ColumnMapping` on `AnalyticsSource`:**
```
AnalyticsSource {
  ...existing fields...
  columnMappings?: ColumnAlias[]     // rename before join/aggregate
  columnTransforms?: ColumnTransform[]  // clean before parse
}

ColumnAlias {
  csvColumn: string        // "Product #"
  alias: string            // "item_id"
}

ColumnTransform {
  column: string           // "price"
  strip: string[]          // ["$", "€", " "]
  regex?: string           // custom regex replacement
}
```

This reuses the pattern from the existing import `ColumnMapping` interface — same concept, different context (analytics vs import).

---

## Client Delivery Plan

### End of Week: CSV Files Arrive

1. **Import** Items, Suppliers, Sales CSVs into vault (existing capability)
2. **Configure** analytics query:
   - Sources: Items.csv, Suppliers.csv, Sales.csv
   - Join: Sales.item_id → Items.item_id, Sales.supplier_id → Suppliers.supplier_id
   - Dimensions: item_id (from Items), supplier_name (from Suppliers), month (from Sales.date)
   - Measures: SUM(cost), COUNT(rows)
3. **Run** query → results table
4. **Export** as CSV for client delivery

### What the Client Sees

Two tables answering their questions:

**Table 1: Cost per Item per Supplier by Month**
| item_id | item_name | supplier | month | total_cost |
|---|---|---|---|---|
| ITM-001 | Widget A | Acme Corp | 2026-01 | €4,230 |
| ITM-001 | Widget A | Acme Corp | 2026-02 | €3,890 |
| ITM-002 | Gadget B | Beta Ltd | 2026-01 | €1,120 |

**Table 2: Sales Count per Item per Supplier by Month**
| item_id | item_name | supplier | month | sales_count |
|---|---|---|---|---|
| ITM-001 | Widget A | Acme Corp | 2026-01 | 42 |
| ITM-001 | Widget A | Acme Corp | 2026-02 | 38 |
| ITM-002 | Gadget B | Beta Ltd | 2026-01 | 15 |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| CSV column names unknown until files arrive | Medium | Build flexible column picker — no hardcoded schemas |
| US locale: `1,234.56` numbers and `MM/DD/YYYY` dates | High | Per-source locale dropdown with 5 presets + auto-detect; column type hints |
| Ambiguous dates (`01/02/2026` = Jan 2 or Feb 1?) | Medium | Locale makes it unambiguous; auto-detect flags ambiguous cases for user |
| Mixed locales across CSVs (US sales + EU items) | Medium | Locale is per-source — each CSV gets its own locale setting |
| Large CSV (50k+ rows) blocks UI thread | High | Process in chunks, show progress, consider Web Worker |
| Join produces cartesian explosion | Medium | Validate join keys are non-null, warn on high-cardinality joins |
| Client needs chart, not just table | Low | Defer to v2 — table + CSV export covers immediate need |
| 3-CSV join complexity | Low | Hash join is O(n) — well within JS limits for 10k rows |

---

## Dependencies

- Existing `CsvParser` — reused for parsing (no changes needed)
- Existing `ExportService` — reused for "Export results as CSV"
- Existing DX Hub tab infrastructure — `BaseHubView` tab registration
- New domain: `src/domain/analytics/` (types, engine, events)
- New UI: `src/ui/hub/AnalyticsTab.ts` + `src/ui/hub/AnalyticsResultsPanel.ts`

---

## Related Items

- PRD: [[Data Exchange Hub PRD]] (parent)
- Inbox: [[When opening a CSV with Flowti, I want to be able to make an easy dashboard]]
- PRD: [[Tracking and Reporting PRD]] (vision — different scope but overlapping dashboard concept)
- Improvement Backlog: Q-8 (TD-48: CSV parsing blocks UI thread)
- Improvement Backlog: Q-9 (TD-69: Import runs sequentially)
