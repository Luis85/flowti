/**
 * event-catalog.ts — Project Event Catalog for the Flowti CLI.
 *
 * Manages domain events as markdown files in docs/events/.
 * Each event bridges systems, services, components, and journeys
 * via structured frontmatter.
 *
 * Interactive: Events submenu (list, add, view)
 * Non-interactive: events:add --name="..." --domain="..."
 */

import { Document } from "../../infrastructure/document.js";
import { parseFrontmatterStrings } from "../../infrastructure/frontmatter.js";
import { toKebab } from "../make/naming.js";
import { renderVersionHistory } from "./event-versioning.js";
import type { CliDeps } from "../../infrastructure/deps.js";

// ── Types ──────────────────────────────────────────────────────────

export interface EventDefinition {
	name: string;
	domain: string;
	version: string;
	description: string;
	producers: string[];
	consumers: string[];
	payload: EventPayloadField[];
	previousVersion?: string;
	migrationNotes?: string;
}

export interface EventPayloadField {
	name: string;
	type: string;
	required: boolean;
	description: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function eventsDir(deps: Pick<CliDeps, "paths">, projectPath: string): string {
	return deps.paths.join(projectPath, "docs", "events");
}

function sanitizeFilename(name: string): string {
	return name
		.replace(/[:/\\?*"<>|]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 80);
}

export function parseCommaSeparated(value: string): string[] {
	return value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Read all event markdown files from docs/events/ and extract frontmatter. */
export function listEvents(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string): { name: string; domain: string; version: string; file: string }[] {
	const dir = eventsDir(deps, projectPath);
	if (!deps.disk.existsSync(dir)) return [];

	const files = deps.disk.readdirSync(dir).filter((f: string) => f.endsWith(".md"));
	const events: { name: string; domain: string; version: string; file: string }[] = [];

	for (const file of files) {
		const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
		const fm = parseFrontmatterStrings(content);
		events.push({
			name: fm.name ?? file.replace(/\.md$/, ""),
			domain: fm.domain ?? "",
			version: fm.version ?? "1.0.0",
			file,
		});
	}

	return events.sort((a, b) => a.name.localeCompare(b.name));
}

interface SiblingLinks {
	tests: string[];
	sources: string[];
	configs: string[];
	definitions: string[];
	components: string[];
	journeys: string[];
}

/** Discover related files in the project that match the event's kebab name. */
function discoverSiblingLinks(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, kebab: string): SiblingLinks {
	const links: SiblingLinks = { tests: [], sources: [], configs: [], definitions: [], components: [], journeys: [] };

	const candidates: { dir: string; category: keyof SiblingLinks; patterns: string[] }[] = [
		{ dir: "tests", category: "tests", patterns: [`${kebab}.test.ts`, `${kebab}.test.js`, `${kebab}.spec.ts`] },
		{ dir: "src", category: "sources", patterns: [`${kebab}.ts`, `${kebab}.js`] },
		{ dir: "configs", category: "configs", patterns: [`${kebab}.json`, `${kebab}.config.json`] },
		{ dir: deps.paths.join("components", kebab), category: "definitions", patterns: [`${kebab}.json`] },
		{ dir: deps.paths.join("components", kebab), category: "components", patterns: [`${kebab}.md`] },
		{ dir: "docs/journeys", category: "journeys", patterns: [] },
	];

	for (const { dir, category, patterns } of candidates) {
		const fullDir = deps.paths.join(projectPath, dir);
		if (!deps.disk.existsSync(fullDir)) continue;

		for (const pattern of patterns) {
			const filePath = deps.paths.join(fullDir, pattern);
			if (deps.disk.existsSync(filePath)) {
				links[category].push(deps.paths.relative(projectPath, filePath).replace(/\\/g, "/"));
			}
		}

		// For journeys: scan for any .md file that mentions the event name
		if (category === "journeys") {
			try {
				const files = deps.disk.readdirSync(fullDir).filter((f: string) => f.endsWith(".md"));
				for (const file of files) {
					const content = deps.disk.readFileSync(deps.paths.join(fullDir, file), "utf-8");
					if (content.includes(kebab)) {
						links.journeys.push(file.replace(/\.md$/, ""));
					}
				}
			} catch {
				// Directory may not exist or be readable
			}
		}
	}

	return links;
}

function renderListOrPlaceholder(doc: Document, items: string[], placeholder: string): void {
	if (items.length > 0) {
		doc.list(items);
	} else {
		doc.text(placeholder);
	}
}

function collectFileLinks(links: SiblingLinks): string[] {
	const fileLinks: string[] = [];
	for (const rel of links.tests) fileLinks.push(`- [[${rel}|Test]]`);
	for (const rel of links.sources) fileLinks.push(`- [[${rel}|Source]]`);
	for (const rel of links.configs) fileLinks.push(`- [[${rel}|Config]]`);
	for (const rel of links.definitions) fileLinks.push(`- [[${rel}|Definition]]`);
	return fileLinks;
}

export interface CreateEventResult {
	filePath: string | null;
	alreadyExists: boolean;
	filename?: string;
}

/** Create an event markdown file from a definition. */
export function createEventFile(deps: Pick<CliDeps, "disk" | "paths" | "clock">, projectPath: string, def: EventDefinition): string | null {
	const dir = eventsDir(deps, projectPath);
	deps.disk.mkdirSync(dir, { recursive: true });

	const kebab = toKebab(def.name);
	const filename = sanitizeFilename(kebab) + ".md";
	const filePath = deps.paths.join(dir, filename);

	if (deps.disk.existsSync(filePath)) {
		return null;
	}

	const frontmatter: Record<string, string> = {
		type: "Event",
		name: def.name,
		domain: def.domain,
		version: def.version,
		status: "draft",
		date: deps.clock.iso(),
		producers: def.producers.join(", "),
		consumers: def.consumers.join(", "),
	};
	if (def.previousVersion) frontmatter.previous_version = def.previousVersion;
	if (def.migrationNotes) frontmatter.migration_notes = def.migrationNotes;

	const doc = Document.create(def.name)
		.mergeFrontmatter(frontmatter)
		.addBlank()
		.heading(1, def.name)
		.addBlank();

	if (def.description) {
		doc.text(def.description).addBlank();
	}

	doc.heading(2, "Producers").addBlank();
	renderListOrPlaceholder(doc, def.producers, "<!-- List systems/services that emit this event. -->");
	doc.addBlank();

	doc.heading(2, "Consumers").addBlank();
	renderListOrPlaceholder(doc, def.consumers, "<!-- List systems/services that subscribe to this event. -->");
	doc.addBlank();

	doc.heading(2, "Payload").addBlank();
	if (def.payload.length > 0) {
		doc.table(
			["Field", "Type", "Required", "Description"],
			def.payload.map((f) => [f.name, f.type, f.required ? "yes" : "no", f.description]),
		);
	} else {
		doc.text("<!-- Define the event payload fields. -->");
	}
	doc.addBlank();

	renderVersionHistory(deps, doc, def);

	const links = discoverSiblingLinks(deps, projectPath, kebab);

	doc.heading(2, "Related Components").addBlank();
	renderListOrPlaceholder(doc, links.components.map((c) => `[[${c}]]`), "<!-- Link components that produce or consume this event. -->");
	doc.addBlank();

	doc.heading(2, "Journeys").addBlank();
	renderListOrPlaceholder(doc, links.journeys.map((j) => `[[${j}]]`), "<!-- Link user journeys where this event plays a role. -->");
	doc.addBlank();

	doc.heading(2, "Related Files").addBlank();
	const fileLinks = collectFileLinks(links);
	renderListOrPlaceholder(doc, fileLinks, "<!-- Related test, source, config, and definition files will be linked here. -->");
	doc.addBlank();

	doc.save(filePath, deps.disk);
	return filePath;
}

