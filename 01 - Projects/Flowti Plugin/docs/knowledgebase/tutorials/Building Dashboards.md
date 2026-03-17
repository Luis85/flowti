---
type: KnowledgeBase
domain: Flowti
stage: done
description: How to create dashboards with tiles, stat cards, tables, and charts to visualize your vault data.
tags:
  - tutorial
  - analytics
  - dashboards
---

# Building Dashboards

> Dashboards turn your query results into a visual overview you can glance at and understand immediately. This tutorial shows you how to create dashboards, add tiles, and configure different display modes.

---

## What Is a Dashboard?

A dashboard is a collection of **tiles** arranged on a single screen. Each tile displays the results of a saved query in a specific format — a table, a stat card, a bar chart, a line chart, or more. Dashboards give you a bird's-eye view of your vault data without having to run queries one by one.

Think of a dashboard as a wall of monitors in a control room. Each monitor shows a different piece of information, and together they tell a complete story.

---

## Creating a Dashboard

1. Open the command palette and search for **Open analytics hub**
2. Switch to the **Dashboards** tab
3. Click **+** to create a new dashboard
4. Give it a name — something descriptive like "Weekly Operations Overview" or "Supplier Health"

Your new dashboard starts empty. The next step is to add tiles.

---

## Adding Tiles

A tile is a single visual element on your dashboard. Each tile is powered by a saved query (see [[Creating Analytics Queries]]).

To add a tile:

1. Click the **Add tile** button on your dashboard
2. Select a **saved query** from the list — this is the data source for the tile
3. Choose a **display mode** — how the data should be presented
4. Optionally give the tile a **custom title**
5. The tile appears on your dashboard, showing live results

You can add as many tiles as you need. Mix and match display modes to create a dashboard that tells your story at a glance.

---

## Display Modes

Each tile can show data in one of six display modes:

| Mode | Best For |
|------|----------|
| **Table** | Detailed data with rows and columns. Supports pagination (10, 15, 25, 50 rows per page, or All). Best when you need to see individual records |
| **Stat Card** | A single prominent number — a count, a sum, an average. Best for KPIs and headline figures. The label is configurable |
| **Bar Chart** | Comparing values across categories. Best for "which region has the most orders" or "revenue by product line" |
| **Line Chart** | Trends over time. Best for "orders per month" or "session count by week" |
| **Area Chart** | Like a line chart with a filled area beneath. Best for cumulative or volume-based trends |
| **Pie Chart** | Proportions of a whole. Best for "percentage of orders by status" or "distribution by type" |

You can change the display mode of any tile at any time. The data stays the same — only the presentation changes.

---

## Configuring Tiles

Once a tile is on your dashboard, you can fine-tune it:

### Table Tiles

- Choose which columns to show
- Set the page size (default is 15 rows)
- Sort by clicking column headers
- Use cross-tile filtering — click a value in one tile and other tiles on the same dashboard filter to match

### Stat Card Tiles

- Choose which aggregated value to display
- Set a custom label (e.g., "Total Revenue" or "Active Customers")
- Configure number formatting — plain numbers, currency with a symbol, or percentages

### Chart Tiles

- The first dimension becomes the x-axis (or the pie segments)
- Measures become the y-axis values (or the pie values)
- Colors are assigned automatically

All tile types support a **date range filter** with 12 presets: Today, Yesterday, This Week, Last Week, Last 7 Days, This Month, Last Month, Last 30 Days, This Quarter, Last Quarter, This Year, and Last Year. You can also set a custom date range.

---

## Cross-Tile Filtering

One of the most powerful dashboard features is **cross-tile filtering**. When you click a value in one tile — say, a region name in a table — all other tiles on the same dashboard filter to show only data matching that value.

This turns your dashboard into an interactive exploration tool. Click "Europe" in the region table, and the revenue chart, order count stat card, and supplier list all update to show only European data. Click again to clear the filter.

---

## Dashboard Templates

If you have a dashboard layout that works well, you can save it as a **template**. Templates capture the tile arrangement, display modes, and query selections — but not the data itself. Share a template with a colleague, and they can create their own dashboard with the same structure but pointed at their own data.

---

## Tips for Effective Dashboards

**Lead with stat cards.** Place your most important KPIs at the top as stat cards. They are the first thing your eye will land on.

**Limit tiles per dashboard.** Five to eight tiles is a sweet spot. Too many tiles create visual noise. If you need more, create a second dashboard for a different focus area.

**Name your tiles clearly.** A tile called "Revenue by Region (Q1)" is immediately understandable. A tile called "Query 7 — table" is not.

**Use date range filters.** Dashboards are most useful when they show a relevant time window. Set the date range to "This Month" or "Last 30 Days" to keep the view current.

**Combine with queries.** Dashboards are the presentation layer. If you need to dig deeper, go back to the [[Creating Analytics Queries|Queries tab]] and explore the raw data.

---

## Next Steps

- [[Creating Analytics Queries]] — Build the queries that power your dashboard tiles
- [[Importing CSV Data]] — Bring in the data your dashboards will visualize
- [[Understanding Domains and Events]] — Understand the data model behind your vault
