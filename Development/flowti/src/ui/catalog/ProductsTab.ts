import type { EventCatalogEntry } from "../../infrastructure/events/catalog";
import { findRelatedFlows, findRelatedSystems, findRelatedActors } from "./helpers";
import { getProductDocPathResolved } from "../eventDocTemplate";
import type { CatalogComponentDeps, ProductEntry } from "./types";
import { BaseEntityTab } from "./BaseEntityTab";
import type { EntityTabConfig } from "./BaseEntityTab";

// ─────────────────────────────────────────────────────────────
// Events section renderer (string-based events with resolution)
// ─────────────────────────────────────────────────────────────

function renderResolvedEventsSection(
	container: HTMLElement,
	entry: { events: string[]; resolvedEvents: EventCatalogEntry[] },
	deps: CatalogComponentDeps,
): void {
	const section = container.createDiv({ cls: "ft-detail-section" });
	const sectionHeader = section.createDiv({ cls: "ft-detail-section-header" });
	sectionHeader.createSpan({
		text: `Events (${entry.events.length})`,
		cls: "ft-heading ft-heading-sm",
	});

	for (const eventType of entry.events) {
		const resolved = entry.resolvedEvents.find((e) => e.type === eventType);
		const row = section.createDiv({ cls: "ft-catalog-row" });
		row.createSpan({ text: eventType, cls: "ft-event-type" });
		if (resolved) {
			row.addClass("ft-cursor-pointer");
			row.createSpan({ text: resolved.category, cls: "ft-catalog-meta" });
			row.addEventListener("click", () => {
				deps.navigation.navigateToEvent(eventType);
			});
		} else {
			row.createSpan({ text: "unresolved", cls: "ft-catalog-meta ft-text-muted" });
		}
	}
}

// ─────────────────────────────────────────────────────────────
// Tab configuration
// ─────────────────────────────────────────────────────────────

const PRODUCT_CONFIG: EntityTabConfig<ProductEntry> = {
	label: "Products",
	singular: "product",
	icon: "package",
	entityType: "products",
	docType: "ProductDoc",
	source: "ProductsTab",
	pathResolver: getProductDocPathResolved,

	scanConfig: {
		entityType: "products",
		nameFields: ["product", "name"],
		docType: "ProductDoc",
		normalizeNameKey: "product",
	},
	mapEntry: (raw, ctx) => ({
		...raw,
		resolvedEvents: raw.events
			.map((t) => ctx.entryMap.get(t))
			.filter((e): e is EventCatalogEntry => e !== undefined),
	}),

	getItemCount: (entry) => entry.resolvedEvents.length,
	filterIncludesEvents: true,

	renderEventsSection: renderResolvedEventsSection,

	relatedSections: [
		{
			title: "Related Flows",
			stateKey: "flowEntries",
			findFn: findRelatedFlows as (entries: unknown[], criteria: { events?: string[]; domains?: string[]; services?: string[] }) => Array<{ name: string }>,
			navigate: (deps, name) => deps.navigation.navigateToFlow(name),
		},
		{
			title: "Related Systems",
			stateKey: "systemEntries",
			findFn: findRelatedSystems as (entries: unknown[], criteria: { events?: string[]; domains?: string[]; services?: string[] }) => Array<{ name: string }>,
			navigate: (deps, name) => deps.navigation.navigateToSystem(name),
		},
		{
			title: "Related Actors",
			stateKey: "actorEntries",
			findFn: findRelatedActors as (entries: unknown[], criteria: { events?: string[]; domains?: string[]; services?: string[] }) => Array<{ name: string }>,
			navigate: (deps, name) => deps.navigation.navigateToActor(name),
		},
	],

	buildCriteria: (entry) => ({
		events: entry.events,
		domains: entry.domains,
		services: entry.services,
	}),

	getQuickStats: (entries) => [
		{ value: `${entries.length}`, label: "products" },
		{ value: `${entries.reduce((sum, p) => sum + p.events.length, 0)}`, label: "events" },
		{ value: `${new Set(entries.flatMap((p) => p.domains)).size}`, label: "domains" },
	],
};

// ─────────────────────────────────────────────────────────────
// Thin subclass for backward compatibility
// ─────────────────────────────────────────────────────────────

export class ProductsTab extends BaseEntityTab<ProductEntry> {
	constructor(masterEl: HTMLElement, detailEl: HTMLElement, deps: CatalogComponentDeps) {
		super(masterEl, detailEl, deps, PRODUCT_CONFIG);
	}

	getSelectedProduct(): string | null { return this.selected; }
	setSelectedProduct(name: string | null): void { this.selected = name; }
}
