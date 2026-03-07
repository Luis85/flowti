/**
 * generate-cli-reference.mjs
 *
 * Reads the HELP sections from domain/help/help.mjs and generates a
 * "Flowti CLI Reference" vault note with YAML frontmatter.
 *
 * Usage: node scripts/generate-cli-reference.mjs
 */

import fs from "node:fs";
import path from "node:path";

const CLI_PROJECT = path.resolve(import.meta.dirname, "..");
const VAULT_ROOT = path.resolve(CLI_PROJECT, "..", "..");
const PLUGIN_ROOT = path.resolve(VAULT_ROOT, "Development", "flowti");

const HELP_PATH = path.join(CLI_PROJECT, "src", "domain", "help", "help.mjs");
const CONFIG_PATH = path.join(PLUGIN_ROOT, "flowti.config.json");
const PKG_PATH = path.join(PLUGIN_ROOT, "package.json");
const OUTPUT_DIR = path.join(PLUGIN_ROOT, "docs", "reference");

function yamlEscape(value) {
	if (value === null || value === undefined) return "null";
	if (typeof value === "boolean" || typeof value === "number") return String(value);
	const str = String(value);
	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(str)) return JSON.stringify(str);
	return str;
}

/** Strip ANSI escape sequences from a string. */
function stripAnsi(str) {
	return str.replace(/\x1b\[\d+(?:;\d+)*m/g, "").replace(/\$\{[A-Z_]+\}/g, "");
}

/**
 * Extract HELP sections from the help module source.
 * Returns a Map<string, string> of section name → cleaned content.
 */
function extractHelpSections(source) {
	const sections = new Map();

	// Find the HELP object: `export const HELP = {`
	const helpStart = source.indexOf("export const HELP = {");
	if (helpStart === -1) return sections;

	// Find matching closing brace
	let depth = 0;
	let helpEnd = -1;
	for (let i = source.indexOf("{", helpStart); i < source.length; i++) {
		if (source[i] === "{") depth++;
		else if (source[i] === "}") depth--;
		if (depth === 0) { helpEnd = i; break; }
	}
	if (helpEnd === -1) return sections;

	const helpBlock = source.slice(helpStart, helpEnd + 1);

	// Extract each section: `key: \`...\``
	const sectionRegex = /\t(\w+):\s*`([\s\S]*?)`/g;
	let match;
	while ((match = sectionRegex.exec(helpBlock)) !== null) {
		const key = match[1];
		let content = match[2];

		// Resolve template literals: ${BOLD}, ${RESET}, ${CYAN}, ${DIM}, etc.
		content = content
			.replace(/\$\{BOLD\}/g, "")
			.replace(/\$\{RESET\}/g, "")
			.replace(/\$\{CYAN\}/g, "")
			.replace(/\$\{DIM\}/g, "")
			.replace(/\$\{GREEN\}/g, "")
			.replace(/\$\{YELLOW\}/g, "")
			.replace(/\$\{RED\}/g, "");

		// Clean up: remove leading/trailing whitespace per line, normalize indentation
		const lines = content.split("\n");
		const cleaned = lines
			.map((l) => l.replace(/^\s{2}/, "")) // Remove 2-space indent from template
			.join("\n")
			.trim();

		sections.set(key, cleaned);
	}

	return sections;
}

/** Non-interactive CLI commands with descriptions. */
const CLI_COMMANDS = [
	{ command: "help", description: "Show help (optionally for a section)" },
	{ command: "build", description: "Fast build (esbuild only, no reports)" },
	{ command: "build:increment", description: "Full CI pipeline: check → build → test → e2e → docs → distribute" },
	{ command: "build:full", description: "Flow tests → build → all reports" },
	{ command: "build:watch", description: "Watch mode with hot-reload (add --reload)" },
	{ command: "build:distribute", description: "Build + distribute to endpoints" },
	{ command: "test", description: "Type check + lint + vitest" },
	{ command: "test:increment", description: "Check + build + vitest with coverage" },
	{ command: "test:e2e", description: "Build + flow tests + E2E suite" },
	{ command: "review", description: "List E2E journeys (interactive session)" },
	{ command: "publish", description: "Build release pipeline" },
	{ command: "publish:all", description: "Increment → E2E → release (stops on failure)" },
	{ command: "reports", description: "Generate all report notes" },
	{ command: "reports:audit", description: "Generate reports for audit review" },
	{ command: "report:{id}", description: "Generate a single report by ID (e.g. report:test)" },
	{ command: "dev:reload", description: "Reload plugin in Obsidian via CLI" },
	{ command: "dev:console", description: "Open Obsidian developer console stream" },
	{ command: "dev:errors", description: "Open Obsidian error stream" },
	{ command: "dev:check", description: "Run lint + tsc (no tests)" },
	{ command: "dev:lint", description: "Run ESLint on src/" },
	{ command: "dev:fix-frontmatter", description: "Fix missing frontmatter fields (add --dry-run)" },
	{ command: "dev:testdata", description: "Generate CSV test data for Analytics" },
	{ command: "make:hub", description: "Scaffold a new hub (--name required, --icon, --type, --tabs)" },
	{ command: "make:plugin", description: "Scaffold a new plugin (--name required, --id, --author)" },
	{ command: "info", description: "Show project stats, version, config" },
];

/**
 * Extract npm scripts from package.json.
 * Returns an array of { name, script }.
 */
function extractNpmScripts() {
	try {
		const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf-8"));
		return Object.entries(pkg.scripts || {}).map(([name, script]) => ({ name, script }));
	} catch {
		return [];
	}
}

/**
 * Extract report scripts from flowti.config.json.
 * Returns an array of { id, label, script }.
 */
function extractReportScripts() {
	try {
		const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
		return config.reports?.scripts ?? [];
	} catch {
		return [];
	}
}

/**
 * Extract make config from flowti.config.json.
 */
function extractMakeConfig() {
	try {
		const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
		return config.make ?? {};
	} catch {
		return {};
	}
}

/** Convert a help section into markdown. */
function sectionToMarkdown(title, content) {
	const lines = content.split("\n");
	const mdLines = [];

	for (const line of lines) {
		const headerMatch = line.match(/^([A-Z][A-Z\s()]+)$/);
		if (headerMatch) {
			mdLines.push(`### ${headerMatch[1].trim()}`, "");
			continue;
		}

		const optionMatch = line.match(/^(\d+)\)\s+(.+)/);
		if (optionMatch) {
			mdLines.push(`**${optionMatch[1]}) ${optionMatch[2]}**`, "");
			continue;
		}

		const letterMatch = line.match(/^([a-z])\)\s+(.+)/);
		if (letterMatch) {
			mdLines.push(`**${letterMatch[1]}) ${letterMatch[2]}**`, "");
			continue;
		}

		const arrowMatch = line.match(/^→\s+(.+)/);
		if (arrowMatch) {
			mdLines.push(`\`${arrowMatch[1]}\``, "");
			continue;
		}

		const cmdDescMatch = line.match(/^(\s{2,})(npm run \S+|node \S+|obsidian \S+)\s{2,}(.+)/);
		if (cmdDescMatch) {
			mdLines.push(`- \`${cmdDescMatch[2].trim()}\` — ${cmdDescMatch[3].trim()}`);
			continue;
		}

		const kvMatch = line.match(/^(\s{2,})(--\S+)\s{3,}(.+)/);
		if (kvMatch) {
			mdLines.push(`- \`${kvMatch[2]}\` — ${kvMatch[3].trim()}`);
			continue;
		}

		const configMatch = line.match(/^(\s{2,})(make\.\S+)\s{2,}(.+)/);
		if (configMatch) {
			mdLines.push(`- \`${configMatch[2]}\` — ${configMatch[3].trim()}`);
			continue;
		}

		const fileMatch = line.match(/^(\s{2,})(\S+\.(?:json|md))\s{2,}(.+)/);
		if (fileMatch) {
			mdLines.push(`- \`${fileMatch[2]}\` — ${fileMatch[3].trim()}`);
			continue;
		}

		const bulletMatch = line.match(/^(\s+)-\s+(.+)/);
		if (bulletMatch) {
			mdLines.push(`- ${bulletMatch[2]}`);
			continue;
		}

		mdLines.push(line);
	}

	return mdLines.join("\n");
}

function main() {
	if (!fs.existsSync(HELP_PATH)) {
		console.log("[report] help.mjs not found — skipping CLI reference.");
		return;
	}

	const source = fs.readFileSync(HELP_PATH, "utf-8");
	const helpSections = extractHelpSections(source);
	const cliCommands = CLI_COMMANDS;
	const npmScripts = extractNpmScripts();
	const reportScripts = extractReportScripts();
	const makeConfig = extractMakeConfig();

	const now = new Date();
	const date = now.toISOString();

	const sectionCount = helpSections.size;
	const commandCount = cliCommands.length;
	const scriptCount = npmScripts.length;
	const reportCount = reportScripts.length;

	const fm = {
		type: "CLIReference",
		date,
		sections: sectionCount,
		cli_commands: commandCount,
		npm_scripts: scriptCount,
		report_generators: reportCount,
	};

	const frontmatter = [
		"---",
		...Object.entries(fm).map(([k, v]) => `${k}: ${yamlEscape(v)}`),
		"---",
	].join("\n");

	const body = [];

	body.push("");
	body.push("# Flowti CLI Reference");
	body.push("");
	body.push("> [!info] Summary");
	body.push(`> CLI commands: ${commandCount} | Help sections: ${sectionCount} | npm scripts: ${scriptCount} | Report generators: ${reportCount}`);
	body.push("");
	body.push("---");
	body.push("");

	body.push("## Quick Start");
	body.push("");
	body.push("```bash");
	body.push("npm run flowti              # Interactive menu");
	body.push("npm run flowti -- build     # Non-interactive: fast build");
	body.push("npm run flowti -- help      # Show full help");
	body.push("npm run flowti -- info      # Project stats");
	body.push("```");
	body.push("");

	const sectionTitles = {
		main: "Overview",
		make: "Make (Scaffolding)",
		build: "Build",
		review: "Review (E2E)",
		publish: "Publish",
		reports: "Reports",
		devtools: "Dev Tools",
		info: "Info",
	};

	for (const [key, content] of helpSections) {
		if (key === "main") continue;
		const title = sectionTitles[key] ?? key;
		body.push(`## ${title}`);
		body.push("");
		body.push(sectionToMarkdown(title, content));
		body.push("");
	}

	body.push("## Non-Interactive Commands");
	body.push("");
	body.push("All commands can be run directly without the interactive menu:");
	body.push("");
	body.push("| Command | Description |");
	body.push("|---------|-------------|");
	for (const cmd of cliCommands) {
		body.push(`| \`npm run flowti -- ${cmd.command}\` | ${cmd.description} |`);
	}
	body.push("");

	body.push("## npm Scripts");
	body.push("");
	body.push("| Script | Command |");
	body.push("|--------|---------|");
	for (const s of npmScripts) {
		body.push(`| \`${s.name}\` | \`${s.script}\` |`);
	}
	body.push("");

	body.push("## Report Generators");
	body.push("");
	body.push(`${reportCount} report generators are configured in \`flowti.config.json\`:`);
	body.push("");
	body.push("| ID | Label | Script |");
	body.push("|----|-------|--------|");
	for (const r of reportScripts) {
		body.push(`| ${r.id} | ${r.label} | \`${r.script}\` |`);
	}
	body.push("");

	body.push("## Make Configuration");
	body.push("");
	body.push("Scaffold output paths (`flowti.config.json` → `make`):");
	body.push("");
	if (makeConfig.hub) {
		body.push("### Hub Paths");
		body.push("");
		body.push("| Key | Path |");
		body.push("|-----|------|");
		for (const [k, v] of Object.entries(makeConfig.hub)) {
			body.push(`| \`make.hub.${k}\` | \`${v}\` |`);
		}
		body.push("");
	}
	if (makeConfig.plugin) {
		body.push("### Plugin Paths");
		body.push("");
		body.push("| Key | Path |");
		body.push("|-----|------|");
		for (const [k, v] of Object.entries(makeConfig.plugin)) {
			body.push(`| \`make.plugin.${k}\` | \`${v}\` |`);
		}
		body.push("");
	}

	body.push("## Configuration Files");
	body.push("");
	body.push("| File | Purpose |");
	body.push("|------|---------|");
	body.push("| `flowti.config.json` | CLI config: paths, build settings, report scripts, make paths |");
	body.push("| `build-endpoints.json` | Distribution endpoints for multi-vault deploy |");
	body.push("| `manifest.json` | Obsidian plugin metadata (id, version, author) |");
	body.push("| `package.json` | npm scripts, dependencies |");
	body.push("");

	const filename = "Flowti CLI Reference.md";
	const outputPath = path.join(OUTPUT_DIR, filename);

	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	fs.writeFileSync(outputPath, frontmatter + body.join("\n"), "utf-8");

	console.log(
		`[report] CLIReference written (${commandCount} commands, ${sectionCount} sections): ${outputPath}`,
	);
}

main();
