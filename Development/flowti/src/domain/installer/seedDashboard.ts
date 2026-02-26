/**
 * Seeds a "Supplier Overview" dashboard after first-run installation.
 *
 * Pure async function — no class, no side effects beyond AnalyticsService API calls.
 * Called via `installer.completed` event listener in main.ts.
 *
 * Idempotent: skips if a dashboard named "Supplier Overview" already exists.
 */

import type { AnalyticsService } from "../analytics/AnalyticsService";
import { SEED_CSV_PATH } from "./seedData";

export async function seedSupplierDashboard(
	analyticsService: AnalyticsService,
): Promise<void> {
	// Idempotency guard
	const existing = analyticsService
		.listDashboards()
		.find((d) => d.name === "Supplier Overview");
	if (existing) return;

	// ── Queries ──────────────────────────────────────────────

	const source = {
		alias: "suppliers",
		csvPath: SEED_CSV_PATH,
	};

	const supplierSummaryQuery = await analyticsService.saveQuery(
		"Supplier Overview - By Supplier",
		[source],
		{
			joins: [],
			columnTypeHints: [],
			dimensions: [{ column: "Supplier" }],
			measures: [
				{ column: "Total", function: "SUM", label: "Total Spend" },
				{ column: "Quantity", function: "SUM", label: "Total Quantity" },
				{
					column: "Quality Score",
					function: "AVG",
					label: "Avg Quality Score",
				},
				{
					column: "On Time Delivery",
					function: "AVG",
					label: "Avg On-Time Delivery",
				},
				{
					column: "Lead Time Days",
					function: "AVG",
					label: "Avg Lead Time",
				},
			],
			sort: [{ column: "Total Spend", direction: "desc" }],
		},
	);

	const monthlyTrendQuery = await analyticsService.saveQuery(
		"Supplier Trend - Monthly Spend",
		[source],
		{
			joins: [],
			columnTypeHints: [],
			dimensions: [{ column: "Month" }],
			measures: [
				{ column: "Total", function: "SUM", label: "Monthly Spend" },
			],
			sort: [{ column: "Month", direction: "asc" }],
		},
	);

	// ── Dashboard ────────────────────────────────────────────

	const dashboard = await analyticsService.createDashboard(
		"Supplier Overview",
		"Pre-built supplier KPIs — spend, quality, and delivery metrics from sample data.",
	);

	// ── Stat cards (row 0) ───────────────────────────────────

	const totalSpendTile = await analyticsService.addTile(
		dashboard.id,
		supplierSummaryQuery.id,
		"stat-card",
		"Total Spend",
	);
	if (totalSpendTile) {
		await analyticsService.updateTile(dashboard.id, totalSpendTile.id, {
			row: 0,
			col: 0,
			width: 1,
			height: 1,
			numberFormat: { style: "currency", symbol: "$", decimals: 0 },
		});
	}

	const qualityTile = await analyticsService.addTile(
		dashboard.id,
		supplierSummaryQuery.id,
		"stat-card",
		"Avg Quality Score",
	);
	if (qualityTile) {
		await analyticsService.updateTile(dashboard.id, qualityTile.id, {
			row: 0,
			col: 1,
			width: 1,
			height: 1,
		});
	}

	const otdTile = await analyticsService.addTile(
		dashboard.id,
		supplierSummaryQuery.id,
		"stat-card",
		"Avg On-Time Delivery",
	);
	if (otdTile) {
		await analyticsService.updateTile(dashboard.id, otdTile.id, {
			row: 0,
			col: 2,
			width: 1,
			height: 1,
		});
	}

	// ── Bar chart (row 1) ────────────────────────────────────

	const chartTile = await analyticsService.addTile(
		dashboard.id,
		monthlyTrendQuery.id,
		"bar-chart",
		"Monthly Spend Trend",
	);
	if (chartTile) {
		await analyticsService.updateTile(dashboard.id, chartTile.id, {
			row: 1,
			col: 0,
			width: 3,
			height: 1,
			chartValueColumn: "Monthly Spend",
		});
	}

	// ── Table (row 2) ────────────────────────────────────────

	const tableTile = await analyticsService.addTile(
		dashboard.id,
		supplierSummaryQuery.id,
		"table",
		"Supplier Breakdown",
	);
	if (tableTile) {
		await analyticsService.updateTile(dashboard.id, tableTile.id, {
			row: 2,
			col: 0,
			width: 3,
			height: 1,
			numberFormat: { style: "currency", symbol: "$", decimals: 0 },
			showTableKpis: true,
			tableKpiLabel: "Suppliers",
		});
	}

	// ── Set as default ───────────────────────────────────────

	await analyticsService.setDefaultDashboard(dashboard.id);
}
