/**
 * generate-command-reference.mjs
 *
 * Reads command metadata from the CommandRegistry source and generates
 * a Command Reference vault note with queryable YAML frontmatter.
 *
 * Usage: node scripts/generate-command-reference.mjs
 */

import fs from "node:fs";
import path from "node:path";
const CLI_PROJECT = path.resolve(import.meta.dirname, "..");
const VAULT_ROOT = path.resolve(CLI_PROJECT, "..", "..");
const ROOT = path.resolve(VAULT_ROOT, "Development", "flowti");

const REGISTRY_PATH = path.join(ROOT, "src", "infrastructure", "commands", "registry.ts");
const OUTPUT_DIR = path.join(ROOT, "docs", "reference");

function yamlEscape(value) {
	if (value === null || value === undefined) return "null";
	if (typeof value === "boolean" || typeof value === "number") return String(value);
	const str = String(value);
	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(str)) return JSON.stringify(str);
	return str;
}

/**
 * Extract command metadata from registry.ts source.
 * Parses both createCommandDefinitions() and getExternalCommandMeta().
 */
function extractCommandMeta(source) {
	const commands = [];

	// Extract from createCommandDefinitions()
	// These have: id, name (label), description, domain, category, icon, handler
	const defRegex = /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*description:\s*"([^"]+)",\s*domain:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*(?:icon:\s*"([^"]*)",\s*)?/g;
	let match;
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
		if (!commands.some((c) => c.id === match[1])) {
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

function capitalize(s) {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function main() {
	if (!fs.existsSync(REGISTRY_PATH)) {
		console.log("[report] CommandRegistry source not found — skipping.");
		return;
	}

	const source = fs.readFileSync(REGISTRY_PATH, "utf-8");
	const commands = extractCommandMeta(source);

	if (commands.length === 0) {
		console.log("[report] No commands extracted from registry — skipping.");
		return;
	}

	const now = new Date();
	const date = now.toISOString();

	// Group by domain
	const groups = new Map();
	for (const cmd of commands) {
		const existing = groups.get(cmd.domain) ?? [];
		existing.push(cmd);
		groups.set(cmd.domain, existing);
	}
	for (const [, cmds] of groups) {
		cmds.sort((a, b) => a.label.localeCompare(b.label));
	}
	const sortedDomains = Array.from(groups.keys()).sort();

	const fm = {
		type: "CommandReference",
		date,
		total_commands: commands.length,
		domains: sortedDomains.length,
	};

	const frontmatter = ["---", ...Object.entries(fm).map(([k, v]) => `${k}: ${yamlEscape(v)}`), "---"].join("\n");

	const bodyLines = [
		"",
		"# Command Reference",
		"",
		"> [!info] Summary",
		`> Total commands: ${fm.total_commands} | Domains: ${fm.domains}`,
		"",
	];

	for (const domain of sortedDomains) {
		const cmds = groups.get(domain);
		bodyLines.push(`## ${capitalize(domain)}`, "");
		bodyLines.push("| Command | Description | Category | Icon |");
		bodyLines.push("|---------|-------------|----------|------|");
		for (const cmd of cmds) {
			const icon = cmd.icon ?? "";
			bodyLines.push(`| ${cmd.label} | ${cmd.description} | ${cmd.category} | ${icon} |`);
		}
		bodyLines.push("");
	}

	const filename = "Command Reference.md";
	const outputPath = path.join(OUTPUT_DIR, filename);

	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	fs.writeFileSync(outputPath, frontmatter + bodyLines.join("\n"), "utf-8");

	console.log(`[report] CommandReference written (${commands.length} commands): ${outputPath}`);
}

main();
