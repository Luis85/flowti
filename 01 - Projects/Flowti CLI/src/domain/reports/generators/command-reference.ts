/**
 * generate-command-reference.ts
 *
 * Reads command metadata from the CommandRegistry source and generates
 * a Command Reference vault note with queryable YAML frontmatter.
 *
 * Usage: npm run report:cli-reference (part of reports pipeline)
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { PLUGIN_ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";
import { log } from "../../../infrastructure/logger.js";
import { clock } from "../../../infrastructure/clock.js";

interface CommandMeta {
	id: string;
	label: string;
	description: string;
	domain: string;
	category: string;
	icon?: string;
}

const REGISTRY_PATH: string = paths.join(PLUGIN_ROOT, "src", "infrastructure", "commands", "registry.ts");
const OUTPUT_DIR: string = paths.join(PLUGIN_ROOT, "docs", "reference");

/**
 * Extract command metadata from registry.ts source.
 * Parses both createCommandDefinitions() and getExternalCommandMeta().
 */
function extractCommandMeta(source: string): CommandMeta[] {
	const commands: CommandMeta[] = [];

	// Extract from createCommandDefinitions()
	// These have: id, name (label), description, domain, category, icon, handler
	const defRegex = /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*description:\s*"([^"]+)",\s*domain:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*(?:icon:\s*"([^"]*)",\s*)?/g;
	let match: RegExpExecArray | null;
	while ((match = defRegex.exec(source)) !== null) {
		commands.push({
			id: match[1],
			label: match[2],
			description: match[3],
			domain: match[4],
			category: match[5],
			icon: match[6] || undefined,
		});
	}

	// Extract from getExternalCommandMeta()
	// These have: id, label, description, domain, category, icon
	const metaRegex =
		/\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*description:\s*"([^"]+)",\s*domain:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*(?:icon:\s*"([^"]*)",?\s*)?/g;
	// Reset lastIndex since we're searching the same source
	metaRegex.lastIndex = source.indexOf("getExternalCommandMeta");
	while ((match = metaRegex.exec(source)) !== null) {
		// Avoid duplicates
		if (!commands.some((c) => c.id === match![1])) {
			commands.push({
				id: match[1],
				label: match[2],
				description: match[3],
				domain: match[4],
				category: match[5],
				icon: match[6] || undefined,
			});
		}
	}

	return commands;
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function main(): void {
	if (!disk.existsSync(REGISTRY_PATH)) {
		log("[report] CommandRegistry source not found — skipping.");
		return;
	}

	const source: string = disk.readFileSync(REGISTRY_PATH, "utf-8");
	const commands: CommandMeta[] = extractCommandMeta(source);

	if (commands.length === 0) {
		log("[report] No commands extracted from registry — skipping.");
		return;
	}

	const date: string = clock.iso();

	// Group by domain
	const groups: Map<string, CommandMeta[]> = new Map();
	for (const cmd of commands) {
		const existing: CommandMeta[] = groups.get(cmd.domain) ?? [];
		existing.push(cmd);
		groups.set(cmd.domain, existing);
	}
	for (const [, cmds] of groups) {
		cmds.sort((a: CommandMeta, b: CommandMeta) => a.label.localeCompare(b.label));
	}
	const sortedDomains: string[] = Array.from(groups.keys()).sort();

	const fm = {
		type: "CommandReference",
		date,
		total_commands: commands.length,
		domains: sortedDomains.length,
	};

	const doc = Document.create("Command Reference")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "Command Reference")
		.addBlank()
		.callout("info", "Summary", [
			`Total commands: ${fm.total_commands} | Domains: ${fm.domains}`,
		])
		.addBlank();

	for (const domain of sortedDomains) {
		const cmds: CommandMeta[] = groups.get(domain)!;
		doc.heading(2, capitalize(domain)).addBlank();
		doc.table(
			["Command", "Description", "Category", "Icon"],
			cmds.map((cmd: CommandMeta) => [cmd.label, cmd.description, cmd.category, cmd.icon ?? ""]),
		);
		doc.addBlank();
	}

	const filename: string = "Command Reference.md";
	const outputPath: string = paths.join(OUTPUT_DIR, filename);

	doc.save(outputPath);

	log(`[report] CommandReference written (${commands.length} commands): ${outputPath}`);
}

main();
