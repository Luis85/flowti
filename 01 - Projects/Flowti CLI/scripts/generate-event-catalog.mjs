/**
 * generate-event-catalog.mjs
 *
 * Reads event catalog metadata from catalog.ts source and generates
 * an Event Catalog reference document with queryable YAML frontmatter.
 *
 * Usage: node scripts/generate-event-catalog.mjs
 */

import fs from "node:fs";
import path from "node:path";
const CLI_PROJECT = path.resolve(import.meta.dirname, "..");
const VAULT_ROOT = path.resolve(CLI_PROJECT, "..", "..");
const ROOT = path.resolve(VAULT_ROOT, "Development", "flowti");

const CATALOG_PATH = path.join(ROOT, "src", "infrastructure", "events", "catalog.ts");
const OUTPUT_DIR = path.join(ROOT, "docs", "reference");

function yamlEscape(value) {
	if (value === null || value === undefined) return "null";
	if (typeof value === "boolean" || typeof value === "number") return String(value);
	const str = String(value);
	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(str)) return JSON.stringify(str);
	return str;
}

/**
 * Extract EVENT_CATEGORIES from the source.
 */
function extractCategories(source) {
	const match = source.match(/export const EVENT_CATEGORIES\s*=\s*\[([\s\S]*?)\]\s*as const/);
	if (!match) return [];
	return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/**
 * Extract catalog entries from CATALOG_DATA.
 * Each entry is on a single line: "event.type": { category: "...", description: "...", ... }
 */
function extractCatalogEntries(source) {
	const entries = [];

	// Find the CATALOG_DATA block
	const dataStart = source.indexOf("const CATALOG_DATA");
	if (dataStart === -1) return entries;

	const dataSection = source.slice(dataStart);

	// Match each entry line: "event.type": { ... }
	const entryRegex = /"([\w.]+)":\s*\{([^}]+)\}/g;
	let match;
	while ((match = entryRegex.exec(dataSection)) !== null) {
		const type = match[1];
		const body = match[2];

		const get = (key) => {
			const m = body.match(new RegExp(`${key}:\\s*"([^"]*?)"`));
			return m ? m[1] : "";
		};

		const tags = [];
		const tagsMatch = body.match(/tags:\s*\[([^\]]*)\]/);
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

function main() {
	if (!fs.existsSync(CATALOG_PATH)) {
		console.log("[report] catalog.ts not found — skipping event catalog generation.");
		return;
	}

	const source = fs.readFileSync(CATALOG_PATH, "utf-8");
	const categories = extractCategories(source);
	const events = extractCatalogEntries(source);

	if (events.length === 0) {
		console.log("[report] No events extracted from catalog — skipping.");
		return;
	}

	const now = new Date();
	const date = now.toISOString();

	// Group by category in display order
	const groups = new Map();
	for (const cat of categories) groups.set(cat, []);
	for (const event of events) {
		const list = groups.get(event.category);
		if (list) list.push(event);
		else groups.set(event.category, [event]);
	}
	// Remove empty categories
	for (const [cat, entries] of groups) {
		if (entries.length === 0) groups.delete(cat);
	}

	// Domain summary
	const domainCounts = new Map();
	for (const e of events) {
		domainCounts.set(e.domain, (domainCounts.get(e.domain) ?? 0) + 1);
	}
	const sortedDomains = [...domainCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	const uniqueDomains = new Set(events.map((e) => e.domain));

	const fm = {
		type: "EventCatalog",
		date,
		total_events: events.length,
		categories: groups.size,
		domains: uniqueDomains.size,
	};

	const frontmatter = ["---", ...Object.entries(fm).map(([k, v]) => `${k}: ${yamlEscape(v)}`), "---"].join("\n");

	const bodyLines = [
		"",
		"# Event Catalog",
		"",
		"> [!info] Summary",
		`> Total events: ${fm.total_events} | Categories: ${fm.categories} | Domains: ${fm.domains}`,
		"",
		"## Domain Summary",
		"",
		"| Domain | Events |",
		"|--------|--------|",
	];

	for (const [domain, count] of sortedDomains) {
		bodyLines.push(`| ${domain} | ${count} |`);
	}
	bodyLines.push("");

	for (const [category, entries] of groups) {
		bodyLines.push(`## ${category}`, "");
		bodyLines.push("| Event | Description | Direction | Domain | Services | Stability | Visibility |");
		bodyLines.push("|-------|-------------|-----------|--------|----------|-----------|------------|");
		for (const e of entries) {
			bodyLines.push(
				`| \`${e.type}\` | ${e.description} | ${e.direction} | ${e.domain} | ${e.services} | ${e.stability} | ${e.visibility} |`,
			);
		}
		bodyLines.push("");
	}

	const filename = "Event Catalog.md";
	const outputPath = path.join(OUTPUT_DIR, filename);

	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	fs.writeFileSync(outputPath, frontmatter + bodyLines.join("\n"), "utf-8");

	console.log(`[report] EventCatalog written (${events.length} events): ${outputPath}`);
}

main();
