/**
 * generate-command-reference.ts
 *
 * Reads command metadata from the CommandRegistry source and generates
 * a Command Reference vault note with queryable YAML frontmatter.
 *
 * Usage: npx tsx scripts/generate-command-reference.ts
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../src/infrastructure/config.js";
import { Document } from "../src/infrastructure/document.js";

interface CommandMeta {
	id: string;
	label: string;
	description: string;
	domain: string;
	category: string;
	icon?: string;
}

const REGISTRY_PATH: string = path.join(ROOT, "src", "infrastructure", "commands", "registry.ts");
const OUTPUT_DIR: string = path.join(ROOT, "docs", "reference");

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
	if (!fs.existsSync(REGISTRY_PATH)) {
		console.log("[report] CommandRegistry source not found — skipping.");
		return;
	}

	const source: string = fs.readFileSync(REGISTRY_PATH, "utf-8");
	const commands: CommandMeta[] = extractCommandMeta(source);

	if (commands.length === 0) {
		console.log("[report] No commands extracted from registry — skipping.");
		return;
	}

	const now: Date = new Date();
	const date: string = now.toISOString();

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
	const outputPath: string = path.join(OUTPUT_DIR, filename);

	doc.save(outputPath);

	console.log(`[report] CommandReference written (${commands.length} commands): ${outputPath}`);
}

main();
