/**
 * Dashboard provider for the Event Catalog hub.
 *
 * Queries the static EVENT_CATALOG and live ViewStateProvider
 * to produce summary stats without requiring the view to be open.
 */

import { EVENT_CATALOG } from "../../infrastructure/events/catalog";
import type { ViewStateProvider } from "../../infrastructure/views/registry";
import { VIEW_TYPE_EVENT_CATALOG, type HubDashboardProvider, type HubSummary } from "./types";

export class EventCatalogProvider implements HubDashboardProvider {
	constructor(private state: ViewStateProvider) {}

	getHubId(): string {
		return "event-catalog";
	}

	getViewType(): string {
		return VIEW_TYPE_EVENT_CATALOG;
	}

	getDisplayName(): string {
		return "Event Catalog";
	}

	getIcon(): string {
		return "list";
	}

	getSummary(): HubSummary {
		const discovered = this.state.getDiscoveredEvents();
		const totalEvents = EVENT_CATALOG.length + discovered.length;
		const domains = new Set(EVENT_CATALOG.map((e) => e.domain));
		const services = new Set(EVENT_CATALOG.map((e) => e.services));
		return {
			stats: [
				{ label: "Domains", value: String(domains.size), icon: "boxes", tabId: "domains" },
				{ label: "Services", value: String(services.size), icon: "server", tabId: "services" },
				{ label: "Events", value: String(totalEvents), icon: "list", tabId: "events" },
			],
			healthLevel: "healthy",
			actionItemCount: 0,
		};
	}
}
