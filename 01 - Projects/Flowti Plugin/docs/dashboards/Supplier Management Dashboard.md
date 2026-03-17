---
type: DashboardSpecification
domain: Supplier Management
dashboard_name: Supplier Management Dashboard
tiles: 6
sources:
  - "[[Sales]]"
  - "[[Items]]"
  - "[[Suppliers]]"
related:
  - "[[Feature - Supplier Management]]"
  - "[[Analytics Hub PRD]]"
  - "[[Inventory Health Dashboard]]"
tags:
  - analytics
  - dashboard
  - supplier-management
---

# Supplier Management Dashboard

## Purpose

Answer: **"How is procurement performing across my suppliers?"**

This is THE primary dashboard for the Supplier Manager persona. It surfaces procurement cost trends, revenue analysis, gross margin health, and supplier-level comparison — the core questions from Supplier Management PRD sections 6.1 (MoM Cost Change) and 6.2 (Supplier Comparison).

## Data Sources

| Source | File | Key Columns |
|--------|------|-------------|
| Sales | `03 - Resources/Test Data/Analytics/Sales.csv` | sale_date, item_id, supplier_id, quantity, unit_cost, total_cost |
| Items | `03 - Resources/Test Data/Analytics/Items.csv` | item_id, item_name, category, unit_price |
| Suppliers | `03 - Resources/Test Data/Analytics/Suppliers.csv` | supplier_id, supplier_name, region, country |

## Tile Specifications

### Tile 1: Total Procurement Cost

| Property | Value |
|----------|-------|
| Display Mode | stat-card |
| Source | Sales |
| Query | SUM(total_cost), no grouping |
| Computed Columns | None |
| Conditional Formatting | None |
| Expected Value | ~$100K range |

### Tile 2: Total Revenue

| Property | Value |
|----------|-------|
| Display Mode | stat-card |
| Source | Sales + Items (join on item_id) |
| Query | Computed: `{quantity} * {unit_price}`, SUM |
| Computed Columns | `Revenue = {quantity} * {unit_price}` |
| Conditional Formatting | None |
| Expected Value | Higher than total cost (positive margin) |

### Tile 3: Gross Margin %

| Property | Value |
|----------|-------|
| Display Mode | stat-card |
| Source | Sales + Items (join on item_id) |
| Query | Computed: `ROUND(({Revenue} - {total_cost}) / {Revenue} * 100, 1)` |
| Computed Columns | `Revenue = {quantity} * {unit_price}`, `Margin = ROUND(({Revenue} - {total_cost}) / {Revenue} * 100, 1)` |
| Conditional Formatting | < 20 = negative (red), >= 30 = positive (green) |
| Expected Value | ~25-35% range |

### Tile 4: Cost by Supplier per Month

| Property | Value |
|----------|-------|
| Display Mode | line-chart |
| Source | Sales + Suppliers (join on supplier_id) |
| Query | Time bucket: month on sale_date, group by supplier_name, SUM(total_cost) |
| Chart Value Column | SUM(total_cost) |
| Multi-series | Yes — one line per supplier |
| Expected Pattern | 5 supplier lines, Jan-May trend |

### Tile 5: Revenue by Supplier per Month

| Property | Value |
|----------|-------|
| Display Mode | bar-chart |
| Source | Sales + Suppliers + Items (join on supplier_id, item_id) |
| Query | Time bucket: month on sale_date, group by supplier_name, SUM(revenue) |
| Computed Columns | `Revenue = {quantity} * {unit_price}` |
| Chart Value Column | SUM(Revenue) |
| Multi-series | Yes — grouped bars per supplier |

### Tile 6: Supplier Comparison Table

| Property | Value |
|----------|-------|
| Display Mode | table |
| Source | Sales + Suppliers (join on supplier_id) |
| Query | Group by supplier_name, SUM(total_cost), AVG(unit_cost), COUNT(sale_date) |
| Conditional Formatting | AVG(unit_cost) > 50 = warning (yellow) |
| Expected | 5 rows, one per supplier, sorted by total cost desc |

## Saved Queries Required

1. **Procurement Cost Total** — Sales, SUM(total_cost), no grouping
2. **Revenue with Margin** — Sales + Items, computed Revenue + Margin columns, SUM
3. **Cost by Supplier Monthly** — Sales + Suppliers, time bucket month, group supplier_name, SUM(total_cost)
4. **Revenue by Supplier Monthly** — Sales + Suppliers + Items, time bucket month, group supplier_name, SUM(Revenue)
5. **Supplier Comparison** — Sales + Suppliers, group supplier_name, SUM/AVG/COUNT

## Discovery Notes

- Gross margin calculation requires join between Sales (cost) and Items (unit_price for revenue)
- Multi-source joins work correctly for enriched views
- Conditional formatting thresholds (margin < 20% = red) align with Supplier Management PRD section 6.1
- Time bucket on sale_date produces YYYY-MM format, correctly sorted chronologically
