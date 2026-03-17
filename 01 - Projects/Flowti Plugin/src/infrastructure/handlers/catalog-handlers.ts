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

	registry.registerTabHandler("catalog:events", (container: HTMLElement, ctx: TabContext) => {
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
		container.appendChild(el);
	});

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
