/**
 * eventCatalogGenerator.ts
 *
 * Pure functions to generate an Event Catalog reference document
 * from event catalog entries. Used by build-time scripts.
 */

export interface EventEntryInput {
	type: string;
	category: string;
	description: string;
	direction: string;
	domain: string;
	services: string;
	stability: string;
	visibility: string;
	tags: string[];
}

export interface EventCatalogReport {
	type: "EventCatalog";
	date: string;
	total_events: number;
	categories: number;
	domains: number;
}

/**
 * Group events by category, preserving the display order.
 */
export function groupByCategory(
	events: EventEntryInput[],
	categoryOrder: readonly string[],
): Map<string, EventEntryInput[]> {
	const groups = new Map<string, EventEntryInput[]>();

	// Initialize in display order
	for (const cat of categoryOrder) {
		groups.set(cat, []);
	}

	for (const event of events) {
		const existing = groups.get(event.category);
		if (existing) {
			existing.push(event);
		} else {
			// Unknown category — append at end
			groups.set(event.category, [event]);
		}
	}

	// Remove empty categories
	for (const [cat, entries] of groups) {
		if (entries.length === 0) groups.delete(cat);
	}

	return groups;
}

/**
 * Build a domain summary: domain → event count.
 */
export function buildDomainSummary(events: EventEntryInput[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const event of events) {
		counts.set(event.domain, (counts.get(event.domain) ?? 0) + 1);
	}
	return new Map([...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

/**
 * Detect phantom events: events that were in an existing list but not in generated,
 * or vice versa.
 */
export function detectPhantomEvents(
	generated: string[],
	existing: string[],
): { added: string[]; removed: string[] } {
	const genSet = new Set(generated);
	const exSet = new Set(existing);
	return {
		added: generated.filter((e) => !exSet.has(e)),
		removed: existing.filter((e) => !genSet.has(e)),
	};
}

/**
 * Generate the full Event Catalog markdown document.
 */
export function generateEventCatalog(
	events: EventEntryInput[],
	categoryOrder: readonly string[],
	date: string,
): string {
	const groups = groupByCategory(events, categoryOrder);
	const domainSummary = buildDomainSummary(events);
	const uniqueDomains = new Set(events.map((e) => e.domain));

	const fm: EventCatalogReport = {
		type: "EventCatalog",
		date,
		total_events: events.length,
		categories: groups.size,
		domains: uniqueDomains.size,
	};

	const lines: string[] = [
		"---",
		`type: ${fm.type}`,
		`date: "${fm.date}"`,
		`total_events: ${fm.total_events}`,
		`categories: ${fm.categories}`,
		`domains: ${fm.domains}`,
		"---",
		"",
		"# Event Catalog",
		"",
		`> [!info] Summary`,
		`> Total events: ${fm.total_events} | Categories: ${fm.categories} | Domains: ${fm.domains}`,
		"",
	];

	// Domain summary table
	lines.push("## Domain Summary", "");
	lines.push("| Domain | Events |");
	lines.push("|--------|--------|");
	for (const [domain, count] of domainSummary) {
		lines.push(`| ${domain} | ${count} |`);
	}
	lines.push("");

	// Category sections
	for (const [category, entries] of groups) {
		lines.push(`## ${category}`, "");
		lines.push("| Event | Description | Direction | Domain | Services | Stability | Visibility |");
		lines.push("|-------|-------------|-----------|--------|----------|-----------|------------|");
		for (const e of entries) {
			lines.push(
				`| \`${e.type}\` | ${e.description} | ${e.direction} | ${e.domain} | ${e.services} | ${e.stability} | ${e.visibility} |`,
			);
		}
		lines.push("");
	}

	return lines.join("\n");
}
