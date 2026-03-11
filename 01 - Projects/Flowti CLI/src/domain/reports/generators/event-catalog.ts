/**
 * generate-event-catalog.ts
 *
 * Pure helper functions for event catalog generation.
 */

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

/**
 * Extract EVENT_CATEGORIES from the source.
 */
export function extractCategories(source: string): string[] {
	const match: RegExpMatchArray | null = source.match(/export const EVENT_CATEGORIES\s*=\s*\[([\s\S]*?)\]\s*as const/);
	if (!match) return [];
	return [...match[1].matchAll(/"([^"]+)"/g)].map((m: RegExpMatchArray) => m[1]);
}

/**
 * Extract catalog entries from CATALOG_DATA.
 * Each entry is on a single line: "event.type": { category: "...", description: "...", ... }
 */
export function extractCatalogEntries(source: string): CatalogEntry[] {
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
