/**
 * generate-event-catalog.ts
 *
 * Reads event catalog metadata from catalog.ts source and generates
 * an Event Catalog reference document with queryable YAML frontmatter.
 *
 * Usage: npx tsx scripts/generate-event-catalog.ts
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../src/infrastructure/config.js";
import { Document } from "../src/infrastructure/document.js";

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

const CATALOG_PATH: string = path.join(ROOT, "src", "infrastructure", "events", "catalog.ts");
const OUTPUT_DIR: string = path.join(ROOT, "docs", "reference");

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

function main(): void {
	if (!fs.existsSync(CATALOG_PATH)) {
		console.log("[report] catalog.ts not found — skipping event catalog generation.");
		return;
	}

	const source: string = fs.readFileSync(CATALOG_PATH, "utf-8");
	const categories: string[] = extractCategories(source);
	const events: CatalogEntry[] = extractCatalogEntries(source);

	if (events.length === 0) {
		console.log("[report] No events extracted from catalog — skipping.");
		return;
	}

	const now: Date = new Date();
	const date: string = now.toISOString();

	// Group by category in display order
	const groups: Map<string, CatalogEntry[]> = new Map();
	for (const cat of categories) groups.set(cat, []);
	for (const event of events) {
		const list: CatalogEntry[] | undefined = groups.get(event.category);
		if (list) list.push(event);
		else groups.set(event.category, [event]);
	}
	// Remove empty categories
	for (const [cat, entries] of groups) {
		if (entries.length === 0) groups.delete(cat);
	}

	// Domain summary
	const domainCounts: Map<string, number> = new Map();
	for (const e of events) {
		domainCounts.set(e.domain, (domainCounts.get(e.domain) ?? 0) + 1);
	}
	const sortedDomains: [string, number][] = [...domainCounts.entries()].sort((a: [string, number], b: [string, number]) => a[0].localeCompare(b[0]));
	const uniqueDomains: Set<string> = new Set(events.map((e: CatalogEntry) => e.domain));

	const fm = {
		type: "EventCatalog",
		date,
		total_events: events.length,
		categories: groups.size,
		domains: uniqueDomains.size,
	};

	const doc = Document.create("Event Catalog")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "Event Catalog")
		.addBlank()
		.callout("info", "Summary", [
			`Total events: ${fm.total_events} | Categories: ${fm.categories} | Domains: ${fm.domains}`,
		])
		.addBlank()
		.heading(2, "Domain Summary")
		.addBlank()
		.table(
			["Domain", "Events"],
			sortedDomains.map(([domain, count]: [string, number]) => [domain, String(count)]),
		)
		.addBlank();

	for (const [category, entries] of groups) {
		doc.heading(2, category).addBlank();
		doc.table(
			["Event", "Description", "Direction", "Domain", "Services", "Stability", "Visibility"],
			entries.map((e: CatalogEntry) => [`\`${e.type}\``, e.description, e.direction, e.domain, e.services, e.stability, e.visibility]),
		);
		doc.addBlank();
	}

	const filename: string = "Event Catalog.md";
	const outputPath: string = path.join(OUTPUT_DIR, filename);

	doc.save(outputPath);

	console.log(`[report] EventCatalog written (${events.length} events): ${outputPath}`);
}

main();
