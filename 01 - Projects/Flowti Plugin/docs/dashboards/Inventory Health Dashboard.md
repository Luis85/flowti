---
type: DashboardSpecification
domain: Inventory Management
dashboard_name: Inventory Health Dashboard
tiles: 6
sources:
  - "[[Inventory]]"
  - "[[Items]]"
  - "[[PurchaseOrders]]"
  - "[[Suppliers]]"
related:
  - "[[Feature - Supplier Management]]"
  - "[[Analytics Hub PRD]]"
  - "[[Supplier Management Dashboard]]"
tags:
  - analytics
  - dashboard
  - inventory-management
---

# Inventory Health Dashboard

## Purpose

Answer: **"What is the state of my inventory and where are the risks?"**

This is THE primary dashboard for inventory oversight. It surfaces stock level trends, coverage analysis, stockout risk identification, and open purchase order visibility — the core questions from Supplier Management PRD sections 6.3 (QTY on Hand) and 6.4 (Open Purchase Orders).

## Data Sources

| Source | File | Key Columns |
|--------|------|-------------|
| Inventory | `03 - Resources/Test Data/Analytics/Inventory.csv` | snapshot_date, item_id, supplier_id, qty_on_hand, reorder_point, safety_stock, avg_daily_sales, unit_cost |
| Items | `03 - Resources/Test Data/Analytics/Items.csv` | item_id, item_name, category, unit_price |
| PurchaseOrders | `03 - Resources/Test Data/Analytics/PurchaseOrders.csv` | po_id, po_date, item_id, supplier_id, qty_ordered, unit_cost, total_cost, expected_delivery_date, status |
| Suppliers | `03 - Resources/Test Data/Analytics/Suppliers.csv` | supplier_id, supplier_name, region, country |

## Tile Specifications

### Tile 1: Total Inventory Value

| Property | Value |
|----------|-------|
| Display Mode | stat-card |
| Source | Inventory (latest month: filter snapshot_date = "05/31/2025") |
| Query | Computed: `{qty_on_hand} * {unit_cost}`, SUM |
| Computed Columns | `Value = {qty_on_hand} * {unit_cost}` |
| Conditional Formatting | None |
| Expected Value | ~$150K-200K range |

### Tile 2: Items Below Reorder Point

| Property | Value |
|----------|-------|
| Display Mode | stat-card |
| Source | Inventory (latest month: filter snapshot_date = "05/31/2025") |
| Query | Computed: `IF({qty_on_hand} < {reorder_point}, 1, 0)`, SUM |
| Computed Columns | `Below Reorder = IF({qty_on_hand} < {reorder_point}, 1, 0)` |
| Conditional Formatting | > 0 = negative (red) |
| Expected Value | 1 (ITM-001 at 180, reorder 200) |

### Tile 3: Avg Days of Coverage

| Property | Value |
|----------|-------|
| Display Mode | stat-card |
| Source | Inventory (latest month: filter snapshot_date = "05/31/2025") |
| Query | Computed: `ROUND({qty_on_hand} / {avg_daily_sales}, 0)`, AVG |
| Computed Columns | `Days Coverage = ROUND({qty_on_hand} / {avg_daily_sales}, 0)` |
| Conditional Formatting | < 14 = negative (red), < 30 = warning (yellow), >= 30 = positive (green) |
| Expected Value | ~60-80 days average across items |

### Tile 4: Stock Levels Over Time

| Property | Value |
|----------|-------|
| Display Mode | **area-chart** |
| Source | Inventory + Items (join on item_id) |
| Query | Time bucket: month on snapshot_date, group by category, SUM(qty_on_hand) |
| Chart Value Column | SUM(qty_on_hand) |
| Multi-series | Yes — one area per category (Electronics, Furniture, Office Supplies) |
| Expected Pattern | Office Supplies highest (Notebooks + Pens), Electronics mid, Furniture low; overlapping filled areas |

### Tile 5: Stockout Risk Table

| Property | Value |
|----------|-------|
| Display Mode | table |
| Source | Inventory (latest month) + Items (join on item_id) |
| Query | Computed: days_of_coverage, filtered where coverage < 30, sorted ascending |
| Computed Columns | `Days Coverage = ROUND({qty_on_hand} / {avg_daily_sales}, 0)` |
| Conditional Formatting | Days Coverage < 14 = negative (red), < 21 = warning (yellow) |
| Expected Rows | ITM-001 (34 days — close to threshold), ITM-012 (42 days), others above 30 |

### Tile 6: Open PO by Supplier

| Property | Value |
|----------|-------|
| Display Mode | bar-chart |
| Source | PurchaseOrders (filter status = "open") + Suppliers (join on supplier_id) |
| Query | Group by supplier_name, SUM(total_cost), SUM(qty_ordered) |
| Chart Value Column | SUM(total_cost) |
| Expected Pattern | SUP-A and SUP-B highest open commitment; bars per supplier |

## Saved Queries Required

1. **Inventory Value (Latest)** — Inventory filtered to 05/31/2025, computed Value, SUM
2. **Below Reorder Count** — Inventory filtered to 05/31/2025, computed Below Reorder (IF), SUM
3. **Avg Coverage** — Inventory filtered to 05/31/2025, computed Days Coverage (ROUND), AVG
4. **Stock by Category Monthly** — Inventory + Items, time bucket month, group category, SUM(qty_on_hand)
5. **Stockout Risk** — Inventory filtered to 05/31/2025 + Items, computed Days Coverage, filtered < 30, sorted asc
6. **Open POs by Supplier** — PurchaseOrders filtered status=open + Suppliers, group supplier_name, SUM(total_cost), SUM(qty_ordered)

## Intentional Data Patterns

These patterns were designed into the test data to create interesting dashboard narratives:

| Item | Pattern | Dashboard Story |
|------|---------|----------------|
| ITM-001 Wireless Mouse | Declining: 450 -> 180 | Below reorder point (200) in May — triggers "Items Below Reorder" stat |
| ITM-006 Notebook A5 | Overstocked: 2000+ | 131+ days coverage — massive stockpile relative to demand |
| ITM-010 Webcam HD | Critical dip in March (40 < reorder 100) then recovery | Demonstrates stock volatility and PO rescue pattern |
| ITM-005 Desk Lamp | Slow decline: 85 -> 55 | Approaching reorder point (40) — gradual draw-down |

## Discovery Notes

- "Latest month only" filtering works via filter: `snapshot_date = "05/31/2025"`
- Area chart (Tile 4) is the first use of the new area-chart display mode
- Days of Coverage = qty_on_hand / avg_daily_sales — watch for zero-division when avg_daily_sales = 0
- Multi-series area chart with 3 categories (Electronics, Furniture, Office Supplies) provides clear visual separation
- Conditional formatting thresholds (14/30 days) align with industry-standard safety stock windows
- Open PO analysis requires status filtering before aggregation
