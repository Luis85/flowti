/**
 * generate-event-catalog.ts — CLI project event catalog generator.
 *
 * Reads event catalog metadata from catalog.ts source and generates
 * an Event Catalog reference document with queryable YAML frontmatter.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "./report-service.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import { extractCategories, extractCatalogEntries } from "../generators/event-catalog.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { PipelineContext } from "../../../infrastructure/pipeline/pipeline-types.js";

// ── Types ────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────

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

// ── Generator ────────────────────────────────────────────────────────

export function generateEventCatalog(projectPath: string, deps: ReportDeps, ctx?: PipelineContext): GeneratorOutput {
	const log = (msg: string) => ctx?.log(msg);
	const svc = new ReportService(projectPath, deps);
	const sourcePath = ctx?.getStepData("event-catalog")?.source as string | undefined;
	if (!sourcePath) {
		log("[cli-report] Event catalog source not configured — skipping.");
		return { success: false, outputPath: "", metrics: {}, error: "Source not configured" };
	}
	const catalogPath = deps.paths.join(projectPath, sourcePath);

	if (!deps.disk.existsSync(catalogPath)) {
		log("[cli-report] catalog.ts not found — skipping event catalog generation.");
		return { success: false, outputPath: "", metrics: {}, error: "catalog.ts not found" };
	}

	const source = deps.disk.readFileSync(catalogPath, "utf-8");
	const categories = extractCategories(source);
	const events = extractCatalogEntries(source);

	if (events.length === 0) {
		log("[cli-report] No events extracted from catalog — skipping.");
		return { success: false, outputPath: "", metrics: {}, error: "No events extracted from catalog" };
	}

	const groups = groupByCategory(categories, events);
	const sortedDomains = getDomainSummary(events);
	const uniqueDomains = new Set(events.map((e) => e.domain));

	const doc = Document.create("Event Catalog")
		.mergeFrontmatter({
			type: "EventCatalog",
			date: deps.clock.iso(),
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

	const outputPath = svc.saveReference(doc, "Event Catalog.md");

	log(`[cli-report] Event Catalog (${events.length} events)`);
	log(`  Categories: ${groups.size} | Domains: ${uniqueDomains.size}`);
	log(`  Written: ${outputPath}`);

	return {
		success: true,
		outputPath,
		metrics: { total_events: events.length, categories: groups.size, domains: uniqueDomains.size },
	};
}
