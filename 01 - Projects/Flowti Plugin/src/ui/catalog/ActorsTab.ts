import type { EventCatalogEntry } from "../../infrastructure/events/catalog";
import { findRelatedFlows, findRelatedSystems } from "./helpers";
import { getActorDocPathResolved } from "../eventDocTemplate";
import type { CatalogComponentDeps, ActorEntry } from "./types";
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

const ACTOR_CONFIG: EntityTabConfig<ActorEntry> = {
	label: "Actors",
	singular: "actor",
	icon: "users",
	entityType: "actors",
	docType: "ActorDoc",
	source: "ActorsTab",
	pathResolver: getActorDocPathResolved,

	scanConfig: {
		entityType: "actors",
		nameFields: ["actor", "name"],
		docType: "ActorDoc",
		normalizeNameKey: "actor",
		extraServiceFields: ["Systems"],
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
	],

	buildCriteria: (entry) => ({
		events: entry.events,
		domains: entry.domains,
		services: entry.services,
	}),

	getQuickStats: (entries) => [
		{ value: `${entries.length}`, label: "actors" },
		{ value: `${entries.reduce((sum, p) => sum + p.events.length, 0)}`, label: "events" },
		{ value: `${new Set(entries.flatMap((p) => p.domains)).size}`, label: "domains" },
	],
};

// ─────────────────────────────────────────────────────────────
// Thin subclass for backward compatibility
// ─────────────────────────────────────────────────────────────

export class ActorsTab extends BaseEntityTab<ActorEntry> {
	constructor(masterEl: HTMLElement, detailEl: HTMLElement, deps: CatalogComponentDeps) {
		super(masterEl, detailEl, deps, ACTOR_CONFIG);
	}

	getSelectedActor(): string | null { return this.selected; }
	setSelectedActor(name: string | null): void { this.selected = name; }
}
