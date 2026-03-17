/**
 * State query and category helpers for catalog entries.
 *
 * Functions for resolving, filtering, and counting catalog entries
 * based on settings, discovery state, and subscription/definition config.
 */

import {
	EVENT_CATALOG,
	EVENT_CATEGORIES,
	type EventCatalogEntry,
} from "../../../infrastructure/events/catalog";
import type { IVaultQueryService } from "../../../infrastructure/services/VaultQueryService";
import type { DiscoveredEvent } from "../../../domain/discovery/types";
import type { CatalogCategoryConfig } from "../../../domain/settings/settings";
import type { Subscription } from "../../../domain/subscription/types";
import type { EventDefinition } from "../../../domain/eventDefinition/types";
import { getEventDocPathResolved } from "../../eventDocTemplate";
import { UNCATEGORIZED_CATEGORY, readFrontmatter, fmString } from "./frontmatter";

export function isConfigured(
	eventType: string,
	subscriptions: Subscription[],
	definitions: EventDefinition[],
): boolean {
	return (
		subscriptions.some((s) => s.eventType === eventType) ||
		definitions.some((d) => d.sourceEventType === eventType)
	);
}

export function isSystemOnly(events: EventCatalogEntry[]): boolean {
	return events.length > 0 && events.every((e) => e.tags.includes("system"));
}

export function getOrderedCategories(catalogCategories: CatalogCategoryConfig[]): CatalogCategoryConfig[] {
	const knownNames = new Set<string>(EVENT_CATEGORIES as readonly string[]);
	const result = catalogCategories.filter((c) => knownNames.has(c.name));
	const settingsNames = new Set(result.map((c) => c.name));
	for (const cat of EVENT_CATEGORIES) {
		if (!settingsNames.has(cat)) {
			result.push({ name: cat, visible: true });
		}
	}
	return result;
}

export function discoveredToCatalogEntries(
	discoveredEvents: DiscoveredEvent[],
	vaultQuery: IVaultQueryService,
	eventsFolder: string,
): EventCatalogEntry[] {
	return discoveredEvents.map((d) => {
		const sourceFm = readFrontmatter(vaultQuery, d.sourcePath);
		const docPath = getEventDocPathResolved(eventsFolder, d.eventName);
		const docFm = readFrontmatter(vaultQuery, docPath);

		return {
			type: d.eventName,
			category:
				fmString(docFm, "category") ??
				d.category ??
				UNCATEGORIZED_CATEGORY,
			description:
				fmString(docFm, "description") ??
				fmString(sourceFm, "description") ??
				`Custom event (triggered ${d.triggerCount}x)`,
			direction:
				fmString(docFm, "direction") ?? "User → EventBus",
			domain:
				fmString(docFm, "domain") ?? "custom",
			services:
				fmString(docFm, "services") ?? "Discovery",
			stability: (fmString(docFm, "stability") as EventCatalogEntry["stability"]) ?? "experimental",
			visibility: (fmString(docFm, "visibility") as EventCatalogEntry["visibility"]) ?? "user-facing",
			tags: [],
		};
	});
}

export function getVisibleEntries(
	catalogCategories: CatalogCategoryConfig[],
	showSystemEvents: boolean,
	discoveredEvents: DiscoveredEvent[],
	vaultQuery: IVaultQueryService,
	eventsFolder: string,
): EventCatalogEntry[] {
	const discoveredEntries = discoveredToCatalogEntries(discoveredEvents, vaultQuery, eventsFolder);
	const allEntries = [...EVENT_CATALOG, ...discoveredEntries];
	const visibleCats = new Set(
		getOrderedCategories(catalogCategories).filter((c) => c.visible).map((c) => c.name),
	);
	// All user categories are always visible
	for (const entry of discoveredEntries) visibleCats.add(entry.category);
	// All EVENT_CATALOG entries originate from plugin code → system
	const discoveredTypes = new Set(discoveredEntries.map((e) => e.type));
	return allEntries.filter((e) => {
		if (!visibleCats.has(e.category)) return false;
		if (!showSystemEvents && !discoveredTypes.has(e.type)) return false;
		return true;
	});
}

export function resolveEntry(
	eventType: string,
	discoveredEvents: DiscoveredEvent[],
	vaultQuery: IVaultQueryService,
	eventsFolder: string,
): EventCatalogEntry | undefined {
	const system = EVENT_CATALOG.find((e) => e.type === eventType);
	if (system) return system;
	const discovered = discoveredToCatalogEntries(discoveredEvents, vaultQuery, eventsFolder)
		.find((e) => e.type === eventType);
	return discovered;
}

export function getConfiguredCount(
	catalogCategories: CatalogCategoryConfig[],
	showSystemEvents: boolean,
	discoveredEvents: DiscoveredEvent[],
	vaultQuery: IVaultQueryService,
	eventsFolder: string,
	subscriptions: Subscription[],
	definitions: EventDefinition[],
): number {
	return getVisibleEntries(catalogCategories, showSystemEvents, discoveredEvents, vaultQuery, eventsFolder)
		.filter((e) => isConfigured(e.type, subscriptions, definitions)).length;
}

export function getFollowedCount(
	catalogCategories: CatalogCategoryConfig[],
	showSystemEvents: boolean,
	discoveredEvents: DiscoveredEvent[],
	vaultQuery: IVaultQueryService,
	eventsFolder: string,
	notifiedTypes: Set<string>,
): number {
	return getVisibleEntries(catalogCategories, showSystemEvents, discoveredEvents, vaultQuery, eventsFolder)
		.filter((e) => notifiedTypes.has(e.type)).length;
}
