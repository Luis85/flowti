/**
 * Handler registration for AnalyticsHub tabs.
 *
 * Bridges AnalyticsService + TileResultCache + OnboardingService → Lit components.
 * Each handler creates a Lit element, sets properties from service data,
 * and wires CustomEvent listeners to eventBus calls.
 */

import type { PluginHandlerRegistry, TabContext } from "./plugin-handler-registry";
import type { IEventBus } from "../events/types";
import type { FlowtiEventMap } from "../events/events";
import { setProps } from "./handler-utils";

// Side-effect imports: register Lit custom elements
import "../../components/analytics/flowti-analytics-dashboard.js";
import "../../components/analytics/flowti-analytics-tile.js";
import "../../components/analytics/flowti-analytics-queries.js";
import "../../components/analytics/flowti-analytics-measurements.js";

/** Shape of an analytics result returned by runSavedQuery. */
interface AnalyticsResultShape {
	columns: string[];
	rows: Array<Record<string, string | number>>;
	groupCount: number;
	sourceRowCount: number;
}

/** Enriched tile slot with query result data for the Lit dashboard component. */
interface EnrichedTileSlot {
	id: string;
	queryId: string;
	title?: string;
	displayMode: string;
	row: number;
	col: number;
	width: number;
	height: number;
	tileData: { value: string | number; label?: string } | { columns: string[]; rows: Array<Record<string, string | number>> } | null;
}

export interface AnalyticsHandlerDeps {
	analyticsService: {
		listQueries: () => readonly unknown[];
		listDashboards: () => readonly unknown[];
		listMeasurements: () => readonly unknown[];
		getQuery: (id: string) => unknown | null;
		getDashboardQueryMap: (id: string) => Map<string, unknown>;
		getDefaultDashboard: () => unknown | null;
		runSavedQuery: (id: string) => Promise<AnalyticsResultShape> | undefined;
	};
	tileResultCache: {
		tryRun: (key: string, fn: () => unknown, cb: () => void) => unknown;
		getTimestamp: (key: string) => number | undefined;
		clear: () => void;
		clearByQueryId: (id: string) => void;
	};
	onboardingService: {
		isCalloutDismissed: (id: string) => boolean;
		dismissCallout: (id: string) => void;
		shouldShowCallout: (id: string) => boolean;
	};
	eventBus: IEventBus;
}

export function registerAnalyticsHandlers(
	registry: PluginHandlerRegistry,
	deps: AnalyticsHandlerDeps,
): void {
	// ── Dashboards handler ───────────────────────────────

	const dashboardHandler = (container: HTMLElement) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-analytics-dashboard");

		const dashboards = deps.analyticsService.listDashboards() as Array<{ id: string; name: string; tiles: Array<{ id: string; queryId: string; title?: string; displayMode: string; row: number; col: number; width: number; height: number }> }>;
		const defaultDash = deps.analyticsService.getDefaultDashboard() as { id: string } | null;
		const selectedDashboard = defaultDash
			? dashboards.find((d) => d.id === defaultDash.id) ?? dashboards[0]
			: dashboards[0];

		if (selectedDashboard) {
			// Set layout-only tiles immediately so the grid renders
			const rawTiles = selectedDashboard.tiles ?? [];
			setProps(el, {
				dashboard: selectedDashboard,
				tiles: rawTiles,
				breadcrumbs: [{ level: "dashboard", label: selectedDashboard.name }],
			});

			// Enrich tiles with query result data asynchronously
			if (rawTiles.length > 0) {
				void Promise.all(
					rawTiles.map(async (tile) => {
						let tileData: EnrichedTileSlot["tileData"] = null;
						try {
							const result = await deps.analyticsService.runSavedQuery(tile.queryId);
							if (result && result.rows.length > 0) {
								const mode = tile.displayMode;
								if (mode === "stat-card") {
									// Extract first numeric value from first row as the stat
									const firstRow = result.rows[0];
									const numericCol = result.columns.find((c) => typeof firstRow[c] === "number");
									const value = numericCol ? firstRow[numericCol] : Object.values(firstRow)[0] ?? 0;
									const label = numericCol ?? result.columns[0] ?? undefined;
									tileData = { value: value as string | number, label };
								} else {
									// table and chart modes both use columns + rows
									tileData = { columns: result.columns, rows: result.rows };
								}
							}
						} catch {
							// Query failed — tile will show "No data"
						}
						return {
							id: tile.id,
							queryId: tile.queryId,
							title: tile.title,
							displayMode: tile.displayMode,
							row: tile.row,
							col: tile.col,
							width: tile.width,
							height: tile.height,
							tileData,
						};
					}),
				).then((enrichedTiles) => {
					setProps(el, { tiles: enrichedTiles });
				});
			}
		}

		el.addEventListener("add-tile", () => {
			void deps.eventBus.emit("analytics.ui.addTile", {});
		});
		el.addEventListener("remove-tile", ((e: CustomEvent) => {
			void deps.eventBus.emit("analytics.ui.removeTile", e.detail as FlowtiEventMap["analytics.ui.removeTile"]);
		}) as EventListener);
		el.addEventListener("rename-dashboard", ((e: CustomEvent) => {
			void deps.eventBus.emit("analytics.ui.renameDashboard", e.detail as FlowtiEventMap["analytics.ui.renameDashboard"]);
		}) as EventListener);
		el.addEventListener("navigate-breadcrumb", ((e: CustomEvent) => {
			void deps.eventBus.emit("analytics.ui.navigateBreadcrumb", e.detail as FlowtiEventMap["analytics.ui.navigateBreadcrumb"]);
		}) as EventListener);

		container.appendChild(el);
	};
	registry.registerTabHandler("analytics:dashboards", dashboardHandler);
	registry.registerTabHandler("analytics:dashboard", dashboardHandler);

	// ── Queries handler ──────────────────────────────────

	registry.registerTabHandler("analytics:queries", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-analytics-queries");

		const savedQueries = deps.analyticsService.listQueries();
		setProps(el, { savedQueries });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });

		el.addEventListener("run-query", () => {
			void deps.eventBus.emit("analytics.ui.runQuery", {});
		});
		el.addEventListener("save-query", ((e: CustomEvent) => {
			void deps.eventBus.emit("analytics.ui.saveQuery", e.detail as FlowtiEventMap["analytics.ui.saveQuery"]);
		}) as EventListener);
		el.addEventListener("delete-query", ((e: CustomEvent) => {
			void deps.eventBus.emit("analytics.ui.deleteQuery", e.detail as FlowtiEventMap["analytics.ui.deleteQuery"]);
		}) as EventListener);

		container.appendChild(el);
	});

	// ── Measurements handler ─────────────────────────────

	registry.registerTabHandler("analytics:measurements", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-analytics-measurements");

		const measurements = deps.analyticsService.listMeasurements();
		setProps(el, { measurements });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });

		el.addEventListener("measurement-selected", ((e: CustomEvent) => {
			void deps.eventBus.emit("analytics.ui.measurementSelected", e.detail as FlowtiEventMap["analytics.ui.measurementSelected"]);
		}) as EventListener);
		el.addEventListener("create", () => {
			void deps.eventBus.emit("analytics.ui.createMeasurement", {});
		});
		el.addEventListener("delete", ((e: CustomEvent) => {
			void deps.eventBus.emit("analytics.ui.deleteMeasurement", e.detail as FlowtiEventMap["analytics.ui.deleteMeasurement"]);
		}) as EventListener);

		container.appendChild(el);
	});
}
