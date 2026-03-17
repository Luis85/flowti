---
type: Persona
stage: done
description: "Non-technical operations user who needs daily metrics visibility from CSV reports — item master, supplier master, sales facts"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
roles:
  - user
related_domains:
  - analytics
  - data-exchange
related_features:
  - Analytics Hub
---
# Supplier Manager

## Identity

### Name & Role

Supplier Manager — Operations user who monitors supplier performance, item costs, and sales metrics to ensure daily business health.

### Archetype

Non-technical. Receives structured data (CSV reports) on a daily basis and needs to answer "is everything in order?" as fast as possible. Does not want to build queries, configure joins, or understand data pipelines. Wants a cockpit that shows numbers, not an engine room that requires assembly.

### Quote

> "I don't care how the data gets here. I just need to see my numbers — costs, sales, profit — and know if something is off."

### Profile Summary

The Supplier Manager receives three daily CSV reports: item master (product catalog with costs), supplier master (supplier details and terms), and sales facts (transactions with quantities and revenue). These reports come from ERP or procurement systems. The manager imports them into the vault via the Data Exchange Hub, builds analytics queries in the Analytics Hub to join and aggregate the data, and views the results on a default dashboard that loads automatically when the hub opens. Favorites let them pin their most-used queries and dashboards for instant access.

## Core Goals

- Confirm daily business health at a glance ("is everything in order?")
- Track Sales per Item per Supplier by Month with cost and profit visibility
- Identify anomalies — missing suppliers, cost spikes, declining margins
- Minimize time-to-insight: open hub → see numbers → done
- Avoid technology overhead: no query building during daily checks

## Goals & Motivations

### Primary Goals

| Goal | Priority | Related Feature |
|---|---|---|
| See default dashboard on hub open | Critical | [[Analytics Hub]] (dashboard-first overview) |
| Track Sales × Item × Supplier by Month | Critical | [[Analytics Hub]] (multi-source joins, time bucketing) |
| Import daily CSV reports effortlessly | High | [[Data Exchange Hub]] (CSV import) |
| Favorite important dashboards and queries | High | [[Analytics Hub]] (favorites, star icons) |
| Refresh stale data with one click | Medium | [[Analytics Hub]] (per-tile refresh) |
| Name dashboards meaningfully | Medium | [[Analytics Hub]] (name prompt on create) |

### Success Criteria

- Hub overview shows default dashboard tiles immediately on open (zero-click to metrics)
- Sales/cost/profit metrics visible in stat-card and table tiles
- Favorited dashboards and queries appear first in lists and on overview
- Per-tile refresh re-executes queries with latest CSV data
- Daily workflow completes in under 30 seconds: open hub → scan dashboard → done

## Jobs To Be Done

- Open Analytics Hub and immediately see default dashboard with key metrics (Sales per Item per Supplier, costs, profit margins)
- Refresh individual tiles when daily CSV reports have been updated
- Navigate to Queries tab only when building or modifying a query (rare — setup phase only)
- Favorite the "Daily Supplier Dashboard" so it stays at the top of the list
- Set the daily dashboard as default so it loads automatically every time
- Scan stat-card tiles for anomalies (cost spikes, missing data, zero rows)

## Pain Points

| Pain Point | Severity | Current Workaround | Flowti Feature |
|---|---|---|---|
| Reports scattered across email, ERP, spreadsheets | Critical | Manual consolidation | [[Data Exchange Hub]] (CSV import) ✓, [[Analytics Hub]] (multi-source joins) ✓ |
| No consolidated dashboard for daily metrics | Critical | Open multiple spreadsheets | [[Analytics Hub]] (dashboard tile grid) ✓ |
| Hub opens to bare stats, not metrics | High | Navigate 4-7 clicks to dashboard | [[Analytics Hub]] (dashboard-first overview, default dashboard) — Cycle 29 |
| Cannot find important dashboards quickly | Medium | Remember dashboard names | [[Analytics Hub]] (favorites, star icons) — Cycle 29 |
| Stale data after CSV re-import | Medium | Close and reopen hub | [[Analytics Hub]] (per-tile refresh) — Cycle 29 |
| Dashboards auto-named "Dashboard 1" | Low | Rename after creation | [[Analytics Hub]] (name prompt on create) — Cycle 29 |
| Technology overwhelm — joins, dimensions, measures | Low | Ask for help | Query builder is setup-once; daily use is dashboard-only |

## What Flowti Delivers

- **Analytics Hub** — Dedicated hub for building queries and viewing dashboards. Dashboard-first overview renders default dashboard tiles on hub open (Cycle 29). Two tabs: Dashboards (tile grid) and Queries (query builder). ✓
- **Data Exchange Hub** — CSV import for daily reports (item master, supplier master, sales facts). Supports locale-aware parsing for number/date formats. ✓
- **Dashboard Tile Grid** — Named dashboards with CSS Grid tile layout. Table and stat-card display modes. Async tile loading with result caching. ✓
- **Multi-Source Joins** — Analytics engine supports inner/left joins across CSV and .base sources with column type hints and locale-aware parsing. ✓
- **Favorites & Default Dashboard** — Star toggle on dashboards and queries, sort favorites first, set one dashboard as default for automatic overview rendering. — Cycle 29
- **Per-Tile Refresh** — Refresh button on each tile to re-execute its query with latest data. — Cycle 29

### Not Yet Delivered

- Dashboard auto-refresh / scheduled polling
- Charts or visualizations (bar charts, line graphs)
- Drag-and-drop tile reordering
- Dashboard templates or sharing
- Calculated columns or derived measures

## Domain Interaction Map

| Domain | Interaction Level | Primary Use |
|---|---|---|
| analytics | Heavy | Query building, dashboard viewing, tile rendering, favorites |
| data-exchange | Moderate | CSV import for daily reports, source scanning |
| hub | Light | Hub navigation, command palette |
| user-hub | Light | Analytics Hub cross-hub card |

## Related Artifacts

### Jobs To Be Done

- [[JTBD - Monitor Daily Business Metrics]]
- [[JTBD - Import External Reports]]

### Features Used

- [[Analytics Hub]]
- [[Data Exchange Hub]]
- [[User Hub]]
