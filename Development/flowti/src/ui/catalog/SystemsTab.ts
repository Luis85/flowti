import { findRelatedFlows, findRelatedActors } from "./helpers";
import { getSystemDocPathResolved } from "../eventDocTemplate";
import type { CatalogComponentDeps, SystemEntry } from "./types";
import { BaseEntityTab } from "./BaseEntityTab";
import type { EntityTabConfig } from "./BaseEntityTab";

// ─────────────────────────────────────────────────────────────
// Events section renderer (EventCatalogEntry-based, no resolution)
// ─────────────────────────────────────────────────────────────

function renderDirectEventsSection(
	container: HTMLElement,
	entry: SystemEntry,
	deps: CatalogComponentDeps,
): void {
	const section = container.createDiv({ cls: "ft-detail-section" });
	const sectionHeader = section.createDiv({ cls: "ft-detail-section-header" });
	sectionHeader.createSpan({
		text: `Events (${entry.events.length})`,
		cls: "ft-heading ft-heading-sm",
	});

	for (const catalogEntry of entry.events) {
		const row = section.createDiv({ cls: "ft-catalog-row" });
		row.addClass("ft-cursor-pointer");
		row.createSpan({ text: catalogEntry.type, cls: "ft-event-type" });
		row.createSpan({ text: catalogEntry.category, cls: "ft-catalog-meta" });
		row.addEventListener("click", () => {
			deps.navigation.navigateToEvent(catalogEntry.type);
		});
	}
}

// ─────────────────────────────────────────────────────────────
// Tab configuration
// ─────────────────────────────────────────────────────────────

const SYSTEM_CONFIG: EntityTabConfig<SystemEntry> = {
	label: "Systems",
	singular: "system",
	icon: "layout-grid",
	entityType: "systems",
	docType: "SystemDoc",
	source: "SystemsTab",
	pathResolver: getSystemDocPathResolved,

	scanConfig: {
		entityType: "systems",
		nameFields: ["system", "name"],
		docType: "SystemDoc",
		normalizeNameKey: "system",
		extraServiceFields: ["Systems"],
		extraDomainFields: ["Domains"],
		readEvents: false,
	},
	mapEntry: (raw, ctx) => {
		const domainSet = new Set(raw.domains);
		const serviceSet = new Set(raw.services);
		const events = ctx.allEntries.filter(
			(e) => domainSet.has(e.domain) || serviceSet.has(e.services),
		);
		return {
			name: raw.name,
			description: raw.description,
			domains: raw.domains,
			services: raw.services,
			filePath: raw.filePath,
			events,
		};
	},

	getItemCount: (entry) => entry.events.length,
	filterIncludesEvents: false,

	renderEventsSection: renderDirectEventsSection,

	relatedSections: [
		{
			title: "Related Flows",
			stateKey: "flowEntries",
			findFn: findRelatedFlows as (entries: unknown[], criteria: { events?: string[]; domains?: string[]; services?: string[] }) => Array<{ name: string }>,
			navigate: (deps, name) => deps.navigation.navigateToFlow(name),
		},
		{
			title: "Related Actors",
			stateKey: "actorEntries",
			findFn: findRelatedActors as (entries: unknown[], criteria: { events?: string[]; domains?: string[]; services?: string[] }) => Array<{ name: string }>,
			navigate: (deps, name) => deps.navigation.navigateToActor(name),
		},
	],

	buildCriteria: (entry) => ({
		domains: entry.domains,
		services: entry.services,
	}),

	getQuickStats: (entries) => [
		{ value: `${entries.length}`, label: "systems" },
		{ value: `${entries.reduce((sum, s) => sum + s.events.length, 0)}`, label: "events" },
		{ value: `${new Set(entries.flatMap((s) => s.domains)).size}`, label: "domains" },
	],
};

// ─────────────────────────────────────────────────────────────
// Thin subclass for backward compatibility
// ─────────────────────────────────────────────────────────────

export class SystemsTab extends BaseEntityTab<SystemEntry> {
	constructor(masterEl: HTMLElement, detailEl: HTMLElement, deps: CatalogComponentDeps) {
		super(masterEl, detailEl, deps, SYSTEM_CONFIG);
	}

	getSelectedSystem(): string | null { return this.selected; }
	setSelectedSystem(name: string | null): void { this.selected = name; }
}
