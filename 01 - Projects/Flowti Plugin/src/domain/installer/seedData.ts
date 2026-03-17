/**
 * Seed data constants for the SeedContentStep.
 *
 * Contains the supplier overview CSV and file path constant
 * used by both SeedContentStep (file creation) and seedDashboard (query source).
 */

/** Path where the seed CSV is written during installation. */
export const SEED_CSV_PATH = "03 - Resources/Sample Data/supplier-overview.csv";

/** Path where the welcome note is written during installation. */
export const WELCOME_NOTE_PATH = "00 - Connectivity/inbox/Welcome to Flowti.md";

/**
 * Supplier overview CSV — 3 suppliers, 8 SKUs, 6 months (Sep 2025 — Feb 2026).
 *
 * Columns: Month, Supplier, SKU, Category, Unit Price, Quantity, Total,
 *          Lead Time Days, Quality Score, On Time Delivery
 *
 * Numbers use en-US locale (dot decimal, no thousands separator).
 */
// ── Session template paths (Cycle 46, PBI-ONB-006) ───────────────

export const SESSION_TEMPLATE_PATHS = {
	supplierReview: "03 - Resources/Templates/Sessions/Supplier Review.md",
	kpiReview: "03 - Resources/Templates/Sessions/Monthly KPI Review.md",
	procurementPlanning: "03 - Resources/Templates/Sessions/Procurement Planning.md",
} as const;

export const SUPPLIER_REVIEW_TEMPLATE = `---
type: SessionTemplate
cadence: weekly
domain: supplier-management
role: supplier-manager
---

# Supplier Review

## Objective
Review supplier performance metrics and address quality or delivery concerns.

## Agenda
- [ ] Review KPI dashboard (Quality Score, OTD, Lead Time)
- [ ] Flag suppliers below threshold
- [ ] Discuss open purchase orders
- [ ] Action items from last review

## Notes

## Decisions

## Action Items
- [ ] `;

export const KPI_REVIEW_TEMPLATE = `---
type: SessionTemplate
cadence: monthly
domain: supplier-management
role: supplier-manager
---

# Monthly KPI Review

## Objective
Analyse monthly supplier KPIs, identify trends, and adjust procurement strategy.

## Agenda
- [ ] Compare month-over-month spend trends
- [ ] Review quality score and on-time delivery rates
- [ ] Identify cost-saving opportunities
- [ ] Evaluate lead time changes
- [ ] Update supplier scorecards

## Notes

## Decisions

## Action Items
- [ ] `;

export const PROCUREMENT_PLANNING_TEMPLATE = `---
type: SessionTemplate
cadence: quarterly
domain: supplier-management
role: supplier-manager
---

# Procurement Planning

## Objective
Plan upcoming procurement activities, review budgets, and align supplier strategy.

## Agenda
- [ ] Review current quarter spend vs budget
- [ ] Forecast next quarter demand
- [ ] Evaluate supplier diversification needs
- [ ] Plan contract renewals and negotiations
- [ ] Assess inventory levels and reorder points

## Notes

## Decisions

## Action Items
- [ ] `;

// ── Supplier CSV ────────────────────────────────────────────────

export const SUPPLIER_OVERVIEW_CSV = `Month,Supplier,SKU,Category,Unit Price,Quantity,Total,Lead Time Days,Quality Score,On Time Delivery
2025-09,Acme Components,AC-1001,Fasteners,2.45,1200,2940.00,12,96.2,98.1
2025-09,Acme Components,AC-1002,Brackets,8.70,340,2958.00,14,94.8,97.3
2025-09,Acme Components,AC-1003,Housings,24.50,85,2082.50,18,97.1,95.0
2025-09,Nordic Electronics,NE-2001,Sensors,15.30,420,6426.00,10,98.5,99.2
2025-09,Nordic Electronics,NE-2002,Controllers,42.00,110,4620.00,16,97.3,96.8
2025-09,Pacific Materials,PM-3001,Raw Aluminum,3.20,2800,8960.00,7,95.0,99.5
2025-09,Pacific Materials,PM-3002,Steel Sheets,5.80,1500,8700.00,9,93.8,98.0
2025-09,Pacific Materials,PM-3003,Copper Wire,12.40,350,4340.00,11,96.5,97.2
2025-10,Acme Components,AC-1001,Fasteners,2.45,1350,3307.50,11,96.5,98.4
2025-10,Acme Components,AC-1002,Brackets,8.75,310,2712.50,13,95.2,97.8
2025-10,Acme Components,AC-1003,Housings,24.50,90,2205.00,17,97.0,96.2
2025-10,Nordic Electronics,NE-2001,Sensors,15.30,450,6885.00,10,98.8,99.0
2025-10,Nordic Electronics,NE-2002,Controllers,42.50,120,5100.00,15,97.5,97.1
2025-10,Pacific Materials,PM-3001,Raw Aluminum,3.25,2600,8450.00,8,95.2,99.0
2025-10,Pacific Materials,PM-3002,Steel Sheets,5.85,1400,8190.00,9,94.1,98.3
2025-10,Pacific Materials,PM-3003,Copper Wire,12.60,380,4788.00,10,96.8,97.5
2025-11,Acme Components,AC-1001,Fasteners,2.50,1100,2750.00,13,95.8,97.5
2025-11,Acme Components,AC-1002,Brackets,8.80,290,2552.00,15,94.5,96.9
2025-11,Acme Components,AC-1003,Housings,25.00,80,2000.00,19,96.8,94.8
2025-11,Nordic Electronics,NE-2001,Sensors,15.50,400,6200.00,11,98.2,98.8
2025-11,Nordic Electronics,NE-2002,Controllers,43.00,105,4515.00,17,97.0,96.5
2025-11,Pacific Materials,PM-3001,Raw Aluminum,3.30,2900,9570.00,7,95.5,99.3
2025-11,Pacific Materials,PM-3002,Steel Sheets,5.90,1550,9145.00,8,94.5,98.6
2025-11,Pacific Materials,PM-3003,Copper Wire,12.80,340,4352.00,12,96.2,97.0
2025-12,Acme Components,AC-1001,Fasteners,2.50,950,2375.00,14,96.0,97.8
2025-12,Acme Components,AC-1002,Brackets,8.85,260,2301.00,16,95.0,97.0
2025-12,Acme Components,AC-1003,Housings,25.00,70,1750.00,20,97.2,94.5
2025-12,Nordic Electronics,NE-2001,Sensors,15.50,380,5890.00,12,98.0,98.5
2025-12,Nordic Electronics,NE-2002,Controllers,43.00,95,4085.00,18,96.8,96.0
2025-12,Pacific Materials,PM-3001,Raw Aluminum,3.35,2500,8375.00,8,94.8,99.1
2025-12,Pacific Materials,PM-3002,Steel Sheets,6.00,1350,8100.00,10,93.5,98.0
2025-12,Pacific Materials,PM-3003,Copper Wire,13.00,320,4160.00,13,96.0,96.8
2026-01,Acme Components,AC-1001,Fasteners,2.55,1250,3187.50,12,96.8,98.5
2026-01,Acme Components,AC-1002,Brackets,8.90,320,2848.00,14,95.5,97.5
2026-01,Acme Components,AC-1003,Housings,25.50,88,2244.00,18,97.5,95.5
2026-01,Nordic Electronics,NE-2001,Sensors,15.80,440,6952.00,10,98.9,99.3
2026-01,Nordic Electronics,NE-2002,Controllers,43.50,115,5002.50,16,97.8,97.2
2026-01,Pacific Materials,PM-3001,Raw Aluminum,3.40,2700,9180.00,7,95.8,99.5
2026-01,Pacific Materials,PM-3002,Steel Sheets,6.10,1450,8845.00,9,94.8,98.5
2026-01,Pacific Materials,PM-3003,Copper Wire,13.20,360,4752.00,11,97.0,97.5
2026-02,Acme Components,AC-1001,Fasteners,2.55,1300,3315.00,11,97.0,98.8
2026-02,Acme Components,AC-1002,Brackets,8.95,330,2953.50,13,95.8,98.0
2026-02,Acme Components,AC-1003,Housings,25.50,92,2346.00,17,97.8,96.0
2026-02,Nordic Electronics,NE-2001,Sensors,16.00,460,7360.00,9,99.1,99.5
2026-02,Nordic Electronics,NE-2002,Controllers,44.00,125,5500.00,15,98.0,97.5
2026-02,Pacific Materials,PM-3001,Raw Aluminum,3.45,2850,9832.50,6,96.0,99.8
2026-02,Pacific Materials,PM-3002,Steel Sheets,6.15,1500,9225.00,8,95.0,98.8
2026-02,Pacific Materials,PM-3003,Copper Wire,13.40,370,4958.00,10,97.2,98.0`;
