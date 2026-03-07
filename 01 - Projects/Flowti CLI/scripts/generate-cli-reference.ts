/**
 * generate-cli-reference.ts
 *
 * Reads the HELP sections from domain/help/help.ts and generates a
 * "Flowti CLI Reference" vault note with YAML frontmatter.
 *
 * Usage: npx tsx scripts/generate-cli-reference.ts
 */

import fs from "node:fs";
import path from "node:path";
import { CLI_PROJECT, PLUGIN_ROOT } from "../src/infrastructure/config.js";
import { Document } from "../src/infrastructure/document.js";

interface CliCommand {
	command: string;
	description: string;
}

interface NpmScript {
	name: string;
	script: string;
}

interface ReportScript {
	id: string;
	label: string;
	script: string;
}

const HELP_PATH: string = path.join(CLI_PROJECT, "src", "domain", "help", "help.ts");
const CONFIG_PATH: string = path.join(PLUGIN_ROOT, "flowti.config.json");
const PKG_PATH: string = path.join(PLUGIN_ROOT, "package.json");
const OUTPUT_DIR: string = path.join(CLI_PROJECT, "docs");

/** Strip ANSI escape sequences from a string. */
function stripAnsi(str: string): string {
	return str.replace(/\x1b\[\d+(?:;\d+)*m/g, "").replace(/\$\{[A-Z_]+\}/g, "");
}

/**
 * Extract HELP sections from the help module source.
 * Returns a Map<string, string> of section name -> cleaned content.
 */
function extractHelpSections(source: string): Map<string, string> {
	const sections: Map<string, string> = new Map();

	// Find the HELP object: `export const HELP = {`
	const helpStart: number = source.indexOf("export const HELP = {");
	if (helpStart === -1) return sections;

	// Find matching closing brace
	let depth: number = 0;
	let helpEnd: number = -1;
	for (let i: number = source.indexOf("{", helpStart); i < source.length; i++) {
		if (source[i] === "{") depth++;
		else if (source[i] === "}") depth--;
		if (depth === 0) { helpEnd = i; break; }
	}
	if (helpEnd === -1) return sections;

	const helpBlock: string = source.slice(helpStart, helpEnd + 1);

	// Extract each section: `key: \`...\``
	const sectionRegex = /\t(\w+):\s*`([\s\S]*?)`/g;
	let match: RegExpExecArray | null;
	while ((match = sectionRegex.exec(helpBlock)) !== null) {
		const key: string = match[1];
		let content: string = match[2];

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
		const lines: string[] = content.split("\n");
		const cleaned: string = lines
			.map((l: string) => l.replace(/^\s{2}/, "")) // Remove 2-space indent from template
			.join("\n")
			.trim();

		sections.set(key, cleaned);
	}

	return sections;
}

/** Non-interactive CLI commands with descriptions. */
const CLI_COMMANDS: CliCommand[] = [
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
function extractNpmScripts(): NpmScript[] {
	try {
		const pkg: Record<string, unknown> = JSON.parse(fs.readFileSync(PKG_PATH, "utf-8"));
		const scripts: Record<string, string> = (pkg.scripts as Record<string, string>) || {};
		return Object.entries(scripts).map(([name, script]: [string, string]) => ({ name, script }));
	} catch {
		return [];
	}
}

/**
 * Extract report scripts from flowti.config.json.
 * Returns an array of { id, label, script }.
 */
function extractReportScripts(): ReportScript[] {
	try {
		const config: Record<string, unknown> = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
		const reports = config.reports as Record<string, unknown> | undefined;
		return (reports?.scripts as ReportScript[]) ?? [];
	} catch {
		return [];
	}
}

/**
 * Extract make config from flowti.config.json.
 */
function extractMakeConfig(): Record<string, Record<string, string>> {
	try {
		const config: Record<string, unknown> = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
		return (config.make as Record<string, Record<string, string>>) ?? {};
	} catch {
		return {};
	}
}

/** Convert a help section into markdown. */
function sectionToMarkdown(title: string, content: string): string {
	const lines: string[] = content.split("\n");
	const mdLines: string[] = [];

	for (const line of lines) {
		const headerMatch: RegExpMatchArray | null = line.match(/^([A-Z][A-Z\s()]+)$/);
		if (headerMatch) {
			mdLines.push(`### ${headerMatch[1].trim()}`, "");
			continue;
		}

		const optionMatch: RegExpMatchArray | null = line.match(/^(\d+)\)\s+(.+)/);
		if (optionMatch) {
			mdLines.push(`**${optionMatch[1]}) ${optionMatch[2]}**`, "");
			continue;
		}

		const letterMatch: RegExpMatchArray | null = line.match(/^([a-z])\)\s+(.+)/);
		if (letterMatch) {
			mdLines.push(`**${letterMatch[1]}) ${letterMatch[2]}**`, "");
			continue;
		}

		const arrowMatch: RegExpMatchArray | null = line.match(/^→\s+(.+)/);
		if (arrowMatch) {
			mdLines.push(`\`${arrowMatch[1]}\``, "");
			continue;
		}

		const cmdDescMatch: RegExpMatchArray | null = line.match(/^(\s{2,})(npm run \S+|node \S+|obsidian \S+)\s{2,}(.+)/);
		if (cmdDescMatch) {
			mdLines.push(`- \`${cmdDescMatch[2].trim()}\` — ${cmdDescMatch[3].trim()}`);
			continue;
		}

		const kvMatch: RegExpMatchArray | null = line.match(/^(\s{2,})(--\S+)\s{3,}(.+)/);
		if (kvMatch) {
			mdLines.push(`- \`${kvMatch[2]}\` — ${kvMatch[3].trim()}`);
			continue;
		}

		const configMatch: RegExpMatchArray | null = line.match(/^(\s{2,})(make\.\S+)\s{2,}(.+)/);
		if (configMatch) {
			mdLines.push(`- \`${configMatch[2]}\` — ${configMatch[3].trim()}`);
			continue;
		}

		const fileMatch: RegExpMatchArray | null = line.match(/^(\s{2,})(\S+\.(?:json|md))\s{2,}(.+)/);
		if (fileMatch) {
			mdLines.push(`- \`${fileMatch[2]}\` — ${fileMatch[3].trim()}`);
			continue;
		}

		const bulletMatch: RegExpMatchArray | null = line.match(/^(\s+)-\s+(.+)/);
		if (bulletMatch) {
			mdLines.push(`- ${bulletMatch[2]}`);
			continue;
		}

		mdLines.push(line);
	}

	return mdLines.join("\n");
}

function main(): void {
	if (!fs.existsSync(HELP_PATH)) {
		console.log("[report] help.ts not found — skipping CLI reference.");
		return;
	}

	const source: string = fs.readFileSync(HELP_PATH, "utf-8");
	const helpSections: Map<string, string> = extractHelpSections(source);
	const cliCommands: CliCommand[] = CLI_COMMANDS;
	const npmScripts: NpmScript[] = extractNpmScripts();
	const reportScripts: ReportScript[] = extractReportScripts();
	const makeConfig: Record<string, Record<string, string>> = extractMakeConfig();

	const now: Date = new Date();
	const date: string = now.toISOString();

	const sectionCount: number = helpSections.size;
	const commandCount: number = cliCommands.length;
	const scriptCount: number = npmScripts.length;
	const reportCount: number = reportScripts.length;

	const doc = Document.create("Flowti CLI Reference")
		.mergeFrontmatter({
			type: "CLIReference",
			date,
			sections: sectionCount,
			cli_commands: commandCount,
			npm_scripts: scriptCount,
			report_generators: reportCount,
		})
		.addBlank()
		.heading(1, "Flowti CLI Reference")
		.addBlank()
		.callout("info", "Summary", [
			`CLI commands: ${commandCount} | Help sections: ${sectionCount} | npm scripts: ${scriptCount} | Report generators: ${reportCount}`,
		])
		.addBlank()
		.addSeparator()
		.addBlank()
		.heading(2, "Quick Start")
		.addBlank()
		.codeBlock("bash", [
			"npm run flowti              # Interactive menu",
			"npm run flowti -- build     # Non-interactive: fast build",
			"npm run flowti -- help      # Show full help",
			"npm run flowti -- info      # Project stats",
		].join("\n"))
		.addBlank();

	const sectionTitles: Record<string, string> = {
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
		const title: string = sectionTitles[key] ?? key;
		doc.heading(2, title).addBlank();
		doc.text(sectionToMarkdown(title, content)).addBlank();
	}

	doc.heading(2, "Non-Interactive Commands").addBlank();
	doc.text("All commands can be run directly without the interactive menu:").addBlank();
	doc.table(
		["Command", "Description"],
		cliCommands.map((cmd: CliCommand) => [`\`npm run flowti -- ${cmd.command}\``, cmd.description]),
	);
	doc.addBlank();

	doc.heading(2, "npm Scripts").addBlank();
	doc.table(
		["Script", "Command"],
		npmScripts.map((s: NpmScript) => [`\`${s.name}\``, `\`${s.script}\``]),
	);
	doc.addBlank();

	doc.heading(2, "Report Generators").addBlank();
	doc.text(`${reportCount} report generators are configured in \`flowti.config.json\`:`).addBlank();
	doc.table(
		["ID", "Label", "Script"],
		reportScripts.map((r: ReportScript) => [r.id, r.label, `\`${r.script}\``]),
	);
	doc.addBlank();

	doc.heading(2, "Make Configuration").addBlank();
	doc.text("Scaffold output paths (`flowti.config.json` → `make`):").addBlank();
	if (makeConfig.hub) {
		doc.heading(3, "Hub Paths").addBlank();
		doc.table(
			["Key", "Path"],
			Object.entries(makeConfig.hub).map(([k, v]: [string, string]) => [`\`make.hub.${k}\``, `\`${v}\``]),
		);
		doc.addBlank();
	}
	if (makeConfig.plugin) {
		doc.heading(3, "Plugin Paths").addBlank();
		doc.table(
			["Key", "Path"],
			Object.entries(makeConfig.plugin).map(([k, v]: [string, string]) => [`\`make.plugin.${k}\``, `\`${v}\``]),
		);
		doc.addBlank();
	}

	doc.heading(2, "Configuration Files").addBlank();
	doc.table(
		["File", "Purpose"],
		[
			["`flowti.config.json`", "CLI config: paths, build settings, report scripts, make paths"],
			["`build-endpoints.json`", "Distribution endpoints for multi-vault deploy"],
			["`manifest.json`", "Obsidian plugin metadata (id, version, author)"],
			["`package.json`", "npm scripts, dependencies"],
		],
	);
	doc.addBlank();

	const filename: string = "Flowti CLI Reference.md";
	const outputPath: string = path.join(OUTPUT_DIR, filename);

	doc.save(outputPath);

	console.log(
		`[report] CLIReference written (${commandCount} commands, ${sectionCount} sections): ${outputPath}`,
	);
}

main();
