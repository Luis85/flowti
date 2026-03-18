/**
 * Handler registration for EventCatalog tabs.
 *
 * Bridges ViewStateProvider → Lit components.
 * Each handler creates a Lit element, sets properties from provider data,
 * and wires CustomEvent listeners to service/eventBus calls.
 */

import type { PluginHandlerRegistry, TabContext } from "./plugin-handler-registry";
import type { IEventBus } from "../events/types";
import type { EventType, FlowtiEventMap } from "../events/events";
import { setProps } from "./handler-utils";

// Side-effect imports: register Lit custom elements
import "../../components/catalog/flowti-catalog-events.js";
import "../../components/catalog/flowti-entity-scanner.js";

export interface CatalogViewStateProvider {
	getDiscoveredEvents: () => readonly unknown[];
	getExcludedTypes: () => string[];
	getNotifiedTypes: () => string[];
	getDomainEntries: () => readonly unknown[];
	getServiceEntries: () => readonly unknown[];
	getFlowEntries: () => readonly unknown[];
	getSystemEntries: () => readonly unknown[];
	getActorEntries: () => readonly unknown[];
	getCategories: () => readonly unknown[];
}

export interface CatalogHandlerDeps {
	viewState: CatalogViewStateProvider;
	eventBus: IEventBus;
}

export function registerCatalogHandlers(
	registry: PluginHandlerRegistry,
	deps: CatalogHandlerDeps,
): void {
	// ── Events handler ───────────────────────────────────────

	const collapsedCategories = new Set<string>();

	const eventsHandler = (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-catalog-events");
		const events = deps.viewState.getDiscoveredEvents();
		const excludedTypes = new Set(deps.viewState.getExcludedTypes());
		const notifiedTypes = new Set(deps.viewState.getNotifiedTypes());
		const categories = deps.viewState.getCategories();

		setProps(el, {
			events,
			excludedTypes,
			notifiedTypes,
			categories,
		});
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });

		el.addEventListener("toggle-category", ((e: CustomEvent<{ category: string; collapsed: boolean }>) => {
			if (e.detail.collapsed) {
				collapsedCategories.add(e.detail.category);
			} else {
				collapsedCategories.delete(e.detail.category);
			}
			const eventType = "settings.updateCollapsedCategories" as EventType;
			void deps.eventBus.emit(eventType, {
				collapsed: [...collapsedCategories],
			} as FlowtiEventMap[typeof eventType]);
		}) as EventListener);

		el.addEventListener("toggle-setting", (() => {
			// Settings panel toggle is UI-local state managed by the Lit component.
			// No service-level persistence needed; listener wired to acknowledge the event.
		}) as EventListener);

		container.appendChild(el);
	};
	registry.registerTabHandler("catalog:events", eventsHandler);
	registry.registerTabHandler("event-catalog:dashboard", eventsHandler);

	// ── Entity scanner handlers (shared pattern) ─────────────

	const entityHandlers: Array<{
		handlerId: string;
		entityType: string;
		getEntries: () => readonly unknown[];
	}> = [
		{ handlerId: "catalog:domains", entityType: "domains", getEntries: () => deps.viewState.getDomainEntries() },
		{ handlerId: "catalog:services", entityType: "services", getEntries: () => deps.viewState.getServiceEntries() },
		{ handlerId: "catalog:flows", entityType: "flows", getEntries: () => deps.viewState.getFlowEntries() },
		{ handlerId: "catalog:systems", entityType: "systems", getEntries: () => deps.viewState.getSystemEntries() },
		{ handlerId: "catalog:actors", entityType: "actors", getEntries: () => deps.viewState.getActorEntries() },
	];

	for (const config of entityHandlers) {
		registry.registerTabHandler(config.handlerId, (container: HTMLElement, ctx: TabContext) => {
			container.innerHTML = "";
			const el = document.createElement("flowti-entity-scanner");
			const entities = config.getEntries();

			setProps(el, {
				entities,
				entityType: config.entityType,
			});
			if (ctx.searchText) setProps(el, { searchText: ctx.searchText });

			el.addEventListener("entity-selected", ((e: CustomEvent) => {
				const eventName = `catalog.${config.entityType}.selected` as EventType;
				void deps.eventBus.emit(eventName, e.detail as FlowtiEventMap[typeof eventName]);
			}) as EventListener);

			container.appendChild(el);
		});
	}
}
