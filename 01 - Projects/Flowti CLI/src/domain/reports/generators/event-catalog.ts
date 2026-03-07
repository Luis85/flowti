/**
 * generate-event-catalog.ts
 *
 * Reads event catalog metadata from catalog.ts source and generates
 * an Event Catalog reference document with queryable YAML frontmatter.
 *
 * Usage: npx tsx scripts/generate-event-catalog.ts
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";
import { log } from "../../../infrastructure/logger.js";

interface CatalogEntry {
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

const CATALOG_PATH: string = paths.join(ROOT, "src", "infrastructure", "events", "catalog.ts");
const OUTPUT_DIR: string = paths.join(ROOT, "docs", "reference");

/**
 * Extract EVENT_CATEGORIES from the source.
 */
function extractCategories(source: string): string[] {
	const match: RegExpMatchArray | null = source.match(/export const EVENT_CATEGORIES\s*=\s*\[([\s\S]*?)\]\s*as const/);
	if (!match) return [];
	return [...match[1].matchAll(/"([^"]+)"/g)].map((m: RegExpMatchArray) => m[1]);
}

/**
 * Extract catalog entries from CATALOG_DATA.
 * Each entry is on a single line: "event.type": { category: "...", description: "...", ... }
 */
function extractCatalogEntries(source: string): CatalogEntry[] {
	const entries: CatalogEntry[] = [];

	// Find the CATALOG_DATA block
	const dataStart: number = source.indexOf("const CATALOG_DATA");
	if (dataStart === -1) return entries;

	const dataSection: string = source.slice(dataStart);

	// Match each entry line: "event.type": { ... }
	const entryRegex = /"([\w.]+)":\s*\{([^}]+)\}/g;
	let match: RegExpExecArray | null;
	while ((match = entryRegex.exec(dataSection)) !== null) {
		const type: string = match[1];
		const body: string = match[2];

		const get = (key: string): string => {
			const m: RegExpMatchArray | null = body.match(new RegExp(`${key}:\\s*"([^"]*?)"`));
			return m ? m[1] : "";
		};

		const tags: string[] = [];
		const tagsMatch: RegExpMatchArray | null = body.match(/tags:\s*\[([^\]]*)\]/);
		if (tagsMatch) {
			for (const t of tagsMatch[1].matchAll(/"([^"]+)"/g)) {
				tags.push(t[1]);
			}
		}

		entries.push({
			type,
			category: get("category"),
			description: get("description"),
			direction: get("direction"),
			domain: get("domain"),
			services: get("services"),
			stability: get("stability") || "stable",
			visibility: get("visibility") || "system-internal",
			tags,
		});
	}

	return entries;
}

function groupByCategory(categories: string[], events: CatalogEntry[]): Map<string, CatalogEntry[]> {
	const groups: Map<string, CatalogEntry[]> = new Map();
	for (const cat of categories) groups.set(cat, []);
	for (const event of events) {
		const list = groups.get(event.category);
		if (list) list.push(event);
		else groups.set(event.category, [event]);
	}
	for (const [cat, entries] of groups) {
		if (entries.length === 0) groups.delete(cat);
	}
	return groups;
}

function getDomainSummary(events: CatalogEntry[]): [string, number][] {
	const counts: Map<string, number> = new Map();
	for (const e of events) counts.set(e.domain, (counts.get(e.domain) ?? 0) + 1);
	return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function main(): void {
	if (!disk.existsSync(CATALOG_PATH)) {
		log("[report] catalog.ts not found — skipping event catalog generation.");
		return;
	}

	const source = disk.readFileSync(CATALOG_PATH, "utf-8");
	const categories = extractCategories(source);
	const events = extractCatalogEntries(source);

	if (events.length === 0) {
		log("[report] No events extracted from catalog — skipping.");
		return;
	}

	const groups = groupByCategory(categories, events);
	const sortedDomains = getDomainSummary(events);
	const uniqueDomains = new Set(events.map((e) => e.domain));

	const doc = Document.create("Event Catalog")
		.mergeFrontmatter({
			type: "EventCatalog",
			date: new Date().toISOString(),
			total_events: events.length,
			categories: groups.size,
			domains: uniqueDomains.size,
		})
		.addBlank()
		.heading(1, "Event Catalog")
		.addBlank()
		.callout("info", "Summary", [
			`Total events: ${events.length} | Categories: ${groups.size} | Domains: ${uniqueDomains.size}`,
		])
		.addBlank()
		.heading(2, "Domain Summary")
		.addBlank()
		.table(["Domain", "Events"], sortedDomains.map(([domain, count]) => [domain, String(count)]))
		.addBlank();

	for (const [category, entries] of groups) {
		doc.heading(2, category).addBlank();
		doc.table(
			["Event", "Description", "Direction", "Domain", "Services", "Stability", "Visibility"],
			entries.map((e) => [`\`${e.type}\``, e.description, e.direction, e.domain, e.services, e.stability, e.visibility]),
		);
		doc.addBlank();
	}

	const outputPath = paths.join(OUTPUT_DIR, "Event Catalog.md");
	doc.save(outputPath);
	log(`[report] EventCatalog written (${events.length} events): ${outputPath}`);
}

main();
