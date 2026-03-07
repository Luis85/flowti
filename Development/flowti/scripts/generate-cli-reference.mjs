/**
 * generate-cli-reference.mjs
 *
 * Reads the HELP sections and non-interactive commands from flowti-cli.mjs
 * and generates a "Flowti CLI Reference" vault note with YAML frontmatter.
 *
 * Usage: node scripts/generate-cli-reference.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CLI_PATH = path.join(ROOT, "scripts", "flowti-cli.mjs");
const CONFIG_PATH = path.join(ROOT, "flowti.config.json");
const PKG_PATH = path.join(ROOT, "package.json");
const OUTPUT_DIR = path.join(ROOT, "docs", "reference");

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
 * Extract HELP sections from the CLI source.
 * Returns a Map<string, string> of section name → cleaned content.
 */
function extractHelpSections(source) {
	const sections = new Map();

	// Find the HELP object: `const HELP = {`
	const helpStart = source.indexOf("const HELP = {");
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

/** Human-readable descriptions for non-interactive commands. */
const COMMAND_DESCRIPTIONS = {
	help: "Show help (optionally for a section)",
	build: "Fast build (esbuild only, no reports)",
	"build:increment": "Full CI pipeline: check → build → test → e2e → docs → distribute",
	"build:full": "Flow tests → build → all reports",
	"build:watch": "Watch mode with hot-reload (add --reload)",
	"build:distribute": "Build + distribute to endpoints",
	test: "Type check + lint + vitest",
	"test:increment": "Check + build + vitest with coverage",
	"test:e2e": "Build + flow tests + E2E suite",
	review: "List E2E journeys (interactive session)",
	publish: "Build release pipeline",
	"publish:all": "Increment → E2E → release (stops on failure)",
	reports: "Generate all 13 report notes",
	"reports:audit": "Generate reports for audit review",
	"dev:reload": "Reload plugin in Obsidian via CLI",
	"dev:console": "Open Obsidian developer console stream",
	"dev:errors": "Open Obsidian error stream",
	"dev:check": "Run lint + tsc (no tests)",
	"dev:lint": "Run ESLint on src/",
	"dev:fix-frontmatter": "Fix missing frontmatter fields (add --dry-run)",
	"dev:testdata": "Generate CSV test data for Analytics",
	"make:hub": "Scaffold a new hub (--name required, --icon, --type, --tabs)",
	"make:plugin": "Scaffold a new plugin (--name required, --id, --author)",
	info: "Show project stats, version, config",
	"report:{id}": "Generate a single report by ID (e.g. report:test)",
};

/**
 * Extract non-interactive commands from handleCliArgs().
 * Returns an array of { command, description }.
 */
function extractNonInteractiveCommands(source) {
	const commands = [];

	// Find handleCliArgs function
	const funcStart = source.indexOf("async function handleCliArgs()");
	if (funcStart === -1) return commands;

	// Extract command patterns: `if (command === "xyz")`
	const cmdRegex = /if\s*\(command\s*===\s*"([^"]+)"\)/g;
	cmdRegex.lastIndex = funcStart;

	let match;
	while ((match = cmdRegex.exec(source)) !== null) {
		const cmd = match[1];
		commands.push({
			command: cmd,
			description: COMMAND_DESCRIPTIONS[cmd] ?? cmd,
		});
	}

	// Also extract `command?.startsWith("report:")` pattern
	if (source.includes('command?.startsWith("report:")')) {
		commands.push({
			command: "report:{id}",
			description: COMMAND_DESCRIPTIONS["report:{id}"],
		});
	}

	return commands;
}

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
		// Convert section headers (USAGE, OPTIONS, etc.) to ### headers
		const headerMatch = line.match(/^([A-Z][A-Z\s()]+)$/);
		if (headerMatch) {
			mdLines.push(`### ${headerMatch[1].trim()}`, "");
			continue;
		}

		// Convert numbered options (1) Foo) to bold list items
		const optionMatch = line.match(/^(\d+)\)\s+(.+)/);
		if (optionMatch) {
			mdLines.push(`**${optionMatch[1]}) ${optionMatch[2]}**`, "");
			continue;
		}

		// Convert letter options (a) Foo) to bold list items
		const letterMatch = line.match(/^([a-z])\)\s+(.+)/);
		if (letterMatch) {
			mdLines.push(`**${letterMatch[1]}) ${letterMatch[2]}**`, "");
			continue;
		}

		// Convert dim arrows (→ commands) to code
		const arrowMatch = line.match(/^→\s+(.+)/);
		if (arrowMatch) {
			mdLines.push(`\`${arrowMatch[1]}\``, "");
			continue;
		}

		// Convert command-style lines (indented commands with descriptions)
		const cmdDescMatch = line.match(/^(\s{2,})(npm run \S+|node \S+|obsidian \S+)\s{2,}(.+)/);
		if (cmdDescMatch) {
			mdLines.push(`- \`${cmdDescMatch[2].trim()}\` — ${cmdDescMatch[3].trim()}`);
			continue;
		}

		// Convert key=value style lines
		const kvMatch = line.match(/^(\s{2,})(--\S+)\s{3,}(.+)/);
		if (kvMatch) {
			mdLines.push(`- \`${kvMatch[2]}\` — ${kvMatch[3].trim()}`);
			continue;
		}

		// Convert config path lines (make.hub.ui, etc.)
		const configMatch = line.match(/^(\s{2,})(make\.\S+)\s{2,}(.+)/);
		if (configMatch) {
			mdLines.push(`- \`${configMatch[2]}\` — ${configMatch[3].trim()}`);
			continue;
		}

		// Convert file config lines (flowti.config.json, etc.)
		const fileMatch = line.match(/^(\s{2,})(\S+\.(?:json|md))\s{2,}(.+)/);
		if (fileMatch) {
			mdLines.push(`- \`${fileMatch[2]}\` — ${fileMatch[3].trim()}`);
			continue;
		}

		// Bullet points starting with -
		const bulletMatch = line.match(/^(\s+)-\s+(.+)/);
		if (bulletMatch) {
			mdLines.push(`- ${bulletMatch[2]}`);
			continue;
		}

		// Pass through other lines
		mdLines.push(line);
	}

	return mdLines.join("\n");
}

function main() {
	if (!fs.existsSync(CLI_PATH)) {
		console.log("[report] flowti-cli.mjs not found — skipping CLI reference.");
		return;
	}

	const source = fs.readFileSync(CLI_PATH, "utf-8");
	const helpSections = extractHelpSections(source);
	const cliCommands = extractNonInteractiveCommands(source);
	const npmScripts = extractNpmScripts();
	const reportScripts = extractReportScripts();
	const makeConfig = extractMakeConfig();

	const now = new Date();
	const date = now.toISOString();

	// Count stats
	const sectionCount = helpSections.size;
	const commandCount = cliCommands.length;
	const scriptCount = npmScripts.length;
	const reportCount = reportScripts.length;

	// Build frontmatter
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

	// Build body
	const body = [];

	body.push("");
	body.push("# Flowti CLI Reference");
	body.push("");
	body.push("> [!info] Summary");
	body.push(`> CLI commands: ${commandCount} | Help sections: ${sectionCount} | npm scripts: ${scriptCount} | Report generators: ${reportCount}`);
	body.push("");
	body.push("---");
	body.push("");

	// ── Quick Start ──
	body.push("## Quick Start");
	body.push("");
	body.push("```bash");
	body.push("npm run flowti              # Interactive menu");
	body.push("npm run flowti -- build     # Non-interactive: fast build");
	body.push("npm run flowti -- help      # Show full help");
	body.push("npm run flowti -- info      # Project stats");
	body.push("```");
	body.push("");

	// ── Help sections ──
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
		if (key === "main") continue; // Handled separately as overview
		const title = sectionTitles[key] ?? key;
		body.push(`## ${title}`);
		body.push("");
		body.push(sectionToMarkdown(title, content));
		body.push("");
	}

	// ── Non-interactive commands table ──
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

	// ── npm scripts table ──
	body.push("## npm Scripts");
	body.push("");
	body.push("| Script | Command |");
	body.push("|--------|---------|");
	for (const s of npmScripts) {
		body.push(`| \`${s.name}\` | \`${s.script}\` |`);
	}
	body.push("");

	// ── Report generators table ──
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

	// ── Make configuration ──
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

	// ── Configuration files ──
	body.push("## Configuration Files");
	body.push("");
	body.push("| File | Purpose |");
	body.push("|------|---------|");
	body.push("| `flowti.config.json` | CLI config: paths, build settings, report scripts, make paths |");
	body.push("| `build-endpoints.json` | Distribution endpoints for multi-vault deploy |");
	body.push("| `manifest.json` | Obsidian plugin metadata (id, version, author) |");
	body.push("| `package.json` | npm scripts, dependencies |");
	body.push("");

	// Write output
	const filename = "Flowti CLI Reference.md";
	const outputPath = path.join(OUTPUT_DIR, filename);

	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	fs.writeFileSync(outputPath, frontmatter + body.join("\n"), "utf-8");

	console.log(
		`[report] CLIReference written (${commandCount} commands, ${sectionCount} sections): ${outputPath}`,
	);
}

main();
