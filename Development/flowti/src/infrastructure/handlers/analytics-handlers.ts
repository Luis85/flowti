/**
 * Handler registration for AnalyticsHub tabs.
 *
 * Bridges AnalyticsService + TileResultCache + OnboardingService → Lit components.
 * Each handler creates a Lit element, sets properties from service data,
 * and wires CustomEvent listeners to eventBus calls.
 */

import type { PluginHandlerRegistry, TabContext } from "./plugin-handler-registry";
import type { IEventBus } from "../events/types";
import { setProps } from "./handler-utils";

export interface AnalyticsHandlerDeps {
	analyticsService: {
		listQueries: () => readonly unknown[];
		listDashboards: () => readonly unknown[];
		listMeasurements: () => readonly unknown[];
		getQuery: (id: string) => unknown | null;
		getDashboardQueryMap: (id: string) => Map<string, unknown>;
		getDefaultDashboard: () => unknown | null;
		runSavedQuery: (id: string) => unknown;
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

	registry.registerTabHandler("analytics:dashboards", (container: HTMLElement) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-analytics-dashboard");

		const dashboards = deps.analyticsService.listDashboards() as Array<{ id: string; name: string; tiles: unknown[] }>;
		const defaultDash = deps.analyticsService.getDefaultDashboard() as { id: string } | null;
		const selectedDashboard = defaultDash
			? dashboards.find((d) => d.id === defaultDash.id) ?? dashboards[0]
			: dashboards[0];

		if (selectedDashboard) {
			setProps(el, {
				dashboard: selectedDashboard,
				tiles: selectedDashboard.tiles ?? [],
			});
		}

		el.addEventListener("add-tile", () => {
			void deps.eventBus.emit("analytics.ui.addTile" as never, {} as never);
		});
		el.addEventListener("remove-tile", ((e: CustomEvent) => {
			void deps.eventBus.emit("analytics.ui.removeTile" as never, e.detail as never);
		}) as EventListener);
		el.addEventListener("rename-dashboard", ((e: CustomEvent) => {
			void deps.eventBus.emit("analytics.ui.renameDashboard" as never, e.detail as never);
		}) as EventListener);
		el.addEventListener("navigate-breadcrumb", ((e: CustomEvent) => {
			void deps.eventBus.emit("analytics.ui.navigateBreadcrumb" as never, e.detail as never);
		}) as EventListener);

		container.appendChild(el);
	});

	// ── Queries handler ──────────────────────────────────

	registry.registerTabHandler("analytics:queries", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-analytics-queries");

		const savedQueries = deps.analyticsService.listQueries();
		setProps(el, { savedQueries, sources: [] });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });

		el.addEventListener("run-query", () => {
			void deps.eventBus.emit("analytics.ui.runQuery" as never, {} as never);
		});
		el.addEventListener("save-query", ((e: CustomEvent) => {
			void deps.eventBus.emit("analytics.ui.saveQuery" as never, e.detail as never);
		}) as EventListener);
		el.addEventListener("delete-query", ((e: CustomEvent) => {
			void deps.eventBus.emit("analytics.ui.deleteQuery" as never, e.detail as never);
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
			void deps.eventBus.emit("analytics.ui.measurementSelected" as never, e.detail as never);
		}) as EventListener);
		el.addEventListener("create", () => {
			void deps.eventBus.emit("analytics.ui.createMeasurement" as never, {} as never);
		});
		el.addEventListener("delete", ((e: CustomEvent) => {
			void deps.eventBus.emit("analytics.ui.deleteMeasurement" as never, e.detail as never);
		}) as EventListener);

		container.appendChild(el);
	});
}
