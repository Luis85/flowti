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

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { RESET, DIM, GREEN, RED, YELLOW, CYAN, BOLD, printHeader } from "../../infrastructure/ui.js";
import { input } from "../../infrastructure/input.js";
import { Document } from "../../infrastructure/document.js";
import { clock } from "../../infrastructure/clock.js";
import { runMenu } from "../../infrastructure/menu.js";
import { toKebab } from "../make/naming.js";
import { log } from "../../infrastructure/logger.js";
import type { MenuResult, MenuEntry, ProjectContext } from "../../infrastructure/types.js";

// ── Types ──────────────────────────────────────────────────────────

export interface EventDefinition {
	name: string;
	domain: string;
	version: string;
	description: string;
	producers: string[];
	consumers: string[];
	payload: EventPayloadField[];
}

export interface EventPayloadField {
	name: string;
	type: string;
	required: boolean;
	description: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function eventsDir(projectPath: string): string {
	return paths.join(projectPath, "docs", "events");
}

function sanitizeFilename(name: string): string {
	return name
		.replace(/[:/\\?*"<>|]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 80);
}

function parseCommaSeparated(value: string): string[] {
	return value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Read all event markdown files from docs/events/ and extract frontmatter. */
export function listEvents(projectPath: string): { name: string; domain: string; version: string; file: string }[] {
	const dir = eventsDir(projectPath);
	if (!disk.existsSync(dir)) return [];

	const files = disk.readdirSync(dir).filter((f: string) => f.endsWith(".md"));
	const events: { name: string; domain: string; version: string; file: string }[] = [];

	for (const file of files) {
		const content = disk.readFileSync(paths.join(dir, file), "utf-8");
		const fm = extractFrontmatter(content);
		events.push({
			name: fm.name ?? file.replace(/\.md$/, ""),
			domain: fm.domain ?? "",
			version: fm.version ?? "1.0.0",
			file,
		});
	}

	return events.sort((a, b) => a.name.localeCompare(b.name));
}

function extractFrontmatter(content: string): Record<string, string> {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return {};

	const result: Record<string, string> = {};
	for (const line of match[1].split("\n")) {
		const idx = line.indexOf(":");
		if (idx > 0) {
			const key = line.slice(0, idx).trim();
			const value = line.slice(idx + 1).trim();
			result[key] = value;
		}
	}
	return result;
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
function discoverSiblingLinks(projectPath: string, kebab: string): SiblingLinks {
	const links: SiblingLinks = { tests: [], sources: [], configs: [], definitions: [], components: [], journeys: [] };

	const candidates: { dir: string; category: keyof SiblingLinks; patterns: string[] }[] = [
		{ dir: "tests", category: "tests", patterns: [`${kebab}.test.ts`, `${kebab}.test.js`, `${kebab}.spec.ts`] },
		{ dir: "src", category: "sources", patterns: [`${kebab}.ts`, `${kebab}.js`] },
		{ dir: "configs", category: "configs", patterns: [`${kebab}.json`, `${kebab}.config.json`] },
		{ dir: paths.join("src", "components", kebab), category: "definitions", patterns: [`${kebab}.json`] },
		{ dir: "docs/components", category: "components", patterns: [`${kebab}.md`] },
		{ dir: "docs/journeys", category: "journeys", patterns: [] },
	];

	for (const { dir, category, patterns } of candidates) {
		const fullDir = paths.join(projectPath, dir);
		if (!disk.existsSync(fullDir)) continue;

		for (const pattern of patterns) {
			const filePath = paths.join(fullDir, pattern);
			if (disk.existsSync(filePath)) {
				links[category].push(paths.relative(projectPath, filePath).replace(/\\/g, "/"));
			}
		}

		// For journeys: scan for any .md file that mentions the event name
		if (category === "journeys") {
			try {
				const files = disk.readdirSync(fullDir).filter((f: string) => f.endsWith(".md"));
				for (const file of files) {
					const content = disk.readFileSync(paths.join(fullDir, file), "utf-8");
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

/** Create an event markdown file from a definition. */
export function createEventFile(projectPath: string, def: EventDefinition): string | null {
	const dir = eventsDir(projectPath);
	disk.mkdirSync(dir, { recursive: true });

	const kebab = toKebab(def.name);
	const filename = sanitizeFilename(kebab) + ".md";
	const filePath = paths.join(dir, filename);

	if (disk.existsSync(filePath)) {
		log(`\n  ${YELLOW}Event already exists:${RESET} ${filename}`);
		return null;
	}

	const doc = Document.create(def.name)
		.mergeFrontmatter({
			type: "Event",
			name: def.name,
			domain: def.domain,
			version: def.version,
			status: "draft",
			date: clock.iso(),
			producers: def.producers.join(", "),
			consumers: def.consumers.join(", "),
		})
		.addBlank()
		.heading(1, def.name)
		.addBlank();

	if (def.description) {
		doc.text(def.description).addBlank();
	}

	// Producers & Consumers
	doc.heading(2, "Producers").addBlank();
	if (def.producers.length > 0) {
		doc.list(def.producers);
	} else {
		doc.text("<!-- List systems/services that emit this event. -->");
	}
	doc.addBlank();

	doc.heading(2, "Consumers").addBlank();
	if (def.consumers.length > 0) {
		doc.list(def.consumers);
	} else {
		doc.text("<!-- List systems/services that subscribe to this event. -->");
	}
	doc.addBlank();

	// Payload schema
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

	// Sibling wikilinks — auto-discover related files
	const links = discoverSiblingLinks(projectPath, kebab);

	doc.heading(2, "Related Components").addBlank();
	if (links.components.length > 0) {
		doc.list(links.components.map((c) => `[[${c}]]`));
	} else {
		doc.text("<!-- Link components that produce or consume this event. -->");
	}
	doc.addBlank();

	doc.heading(2, "Journeys").addBlank();
	if (links.journeys.length > 0) {
		doc.list(links.journeys.map((j) => `[[${j}]]`));
	} else {
		doc.text("<!-- Link user journeys where this event plays a role. -->");
	}
	doc.addBlank();

	doc.heading(2, "Related Files").addBlank();
	const fileLinks: string[] = [];
	for (const rel of links.tests) fileLinks.push(`- [[${rel}|Test]]`);
	for (const rel of links.sources) fileLinks.push(`- [[${rel}|Source]]`);
	for (const rel of links.configs) fileLinks.push(`- [[${rel}|Config]]`);
	for (const rel of links.definitions) fileLinks.push(`- [[${rel}|Definition]]`);
	if (fileLinks.length > 0) {
		doc.text(fileLinks.join("\n"));
	} else {
		doc.text("<!-- Related test, source, config, and definition files will be linked here. -->");
	}
	doc.addBlank();

	doc.save(filePath);
	return filePath;
}

// ── Interactive flow ───────────────────────────────────────────────

async function addEventInteractive(projectPath: string): Promise<void> {
	printHeader("Add Event");

	const name = await input.ask("Event name");
	if (!name) return;

	const domain = await input.ask("Domain", "core");
	const version = await input.ask("Version", "1.0.0");
	const description = await input.ask("Description", "");
	const producersRaw = await input.ask("Producers (comma-separated)", "");
	const consumersRaw = await input.ask("Consumers (comma-separated)", "");

	const def: EventDefinition = {
		name,
		domain,
		version,
		description,
		producers: parseCommaSeparated(producersRaw),
		consumers: parseCommaSeparated(consumersRaw),
		payload: [],
	};

	const filePath = createEventFile(projectPath, def);
	if (filePath) {
		const relPath = paths.relative(projectPath, filePath);
		log(`\n  ${GREEN}✓${RESET} Created: ${relPath}`);
		log(`  ${DIM}Edit the file to add payload fields and link components/journeys.${RESET}\n`);
	}
}

function listEventsInteractive(projectPath: string): void {
	const events = listEvents(projectPath);

	if (events.length === 0) {
		log(`\n  ${DIM}No events defined yet. Use "Add Event" to create one.${RESET}\n`);
		return;
	}

	log(`\n  ${BOLD}Events (${events.length})${RESET}\n`);
	for (const evt of events) {
		const domainTag = evt.domain ? ` ${DIM}[${evt.domain}]${RESET}` : "";
		log(`  ${CYAN}▸${RESET} ${evt.name}${domainTag} ${DIM}v${evt.version}${RESET}`);
	}
	log();
}

// ── Interactive menu ───────────────────────────────────────────────

export async function eventCatalogMenu(projectPath: string): Promise<MenuResult> {
	const items: MenuEntry[] = [
		{
			key: "1",
			label: "List Events",
			action: () => {
				listEventsInteractive(projectPath);
				return "main" as const;
			},
		},
		{
			key: "2",
			label: "Add Event",
			action: async () => {
				await addEventInteractive(projectPath);
				return "main" as const;
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	];

	return runMenu("Event Catalog", items);
}

// ── Non-interactive commands ───────────────────────────────────────

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
	"events:list": (_flags, _rawArgs, _command, project) => {
		if (!project) return;
		const events = listEvents(project.path);
		if (events.length === 0) {
			log(`\n  ${DIM}No events defined.${RESET}\n`);
			return;
		}
		for (const evt of events) {
			log(`  ${evt.name} [${evt.domain}] v${evt.version}`);
		}
	},
	"events:add": (flags, _rawArgs, _command, project) => {
		if (!project) return;
		const name = flags.name;
		if (!name || typeof name !== "string") {
			log(`\n  ${RED}Missing --name flag.${RESET}`);
			log(`  ${DIM}Usage: npm run flowti -- events:add --name="user.created" --domain="user"${RESET}\n`);
			return;
		}
		const domain = typeof flags.domain === "string" ? flags.domain : "core";
		const version = typeof flags.version === "string" ? flags.version : "1.0.0";
		const description = typeof flags.description === "string" ? flags.description : "";
		const producers = typeof flags.producers === "string" ? parseCommaSeparated(flags.producers) : [];
		const consumers = typeof flags.consumers === "string" ? parseCommaSeparated(flags.consumers) : [];

		const def: EventDefinition = { name, domain, version, description, producers, consumers, payload: [] };
		const filePath = createEventFile(project.path, def);
		if (filePath) {
			log(`\n  ${GREEN}✓${RESET} Created: ${paths.relative(project.path, filePath)}\n`);
		}
	},
};
