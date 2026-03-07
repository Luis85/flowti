/**
 * generate-cli-reference.ts
 *
 * Generates a "Flowti CLI Reference" document from the HELP sections
 * in domain/help/help.ts and the current CLI/plugin configuration.
 *
 * Usage: npx tsx src/domain/reports/generators/cli-reference.ts
 */

import fs from "node:fs";
import path from "node:path";
import { CLI_PROJECT, PLUGIN_ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";

const HELP_PATH: string = path.join(CLI_PROJECT, "src", "domain", "help", "help.ts");
const PLUGIN_CONFIG_PATH: string = path.join(PLUGIN_ROOT, "flowti.config.json");
const PLUGIN_PKG_PATH: string = path.join(PLUGIN_ROOT, "package.json");
const OUTPUT_DIR: string = path.join(CLI_PROJECT, "docs", "reference");

/**
 * Extract HELP sections from the help module source.
 * Returns a Map<string, string> of section name -> cleaned content.
 */
function extractHelpSections(source: string): Map<string, string> {
	const sections: Map<string, string> = new Map();

	const helpStart: number = source.indexOf("export const HELP");
	if (helpStart === -1) return sections;

	let depth: number = 0;
	let helpEnd: number = -1;
	for (let i: number = source.indexOf("{", helpStart); i < source.length; i++) {
		if (source[i] === "{") depth++;
		else if (source[i] === "}") depth--;
		if (depth === 0) { helpEnd = i; break; }
	}
	if (helpEnd === -1) return sections;

	const helpBlock: string = source.slice(helpStart, helpEnd + 1);

	const sectionRegex = /\t(\w+):\s*`([\s\S]*?)`/g;
	let match: RegExpExecArray | null;
	while ((match = sectionRegex.exec(helpBlock)) !== null) {
		const key: string = match[1];
		let content: string = match[2];

		content = content
			.replace(/\$\{BOLD\}/g, "")
			.replace(/\$\{RESET\}/g, "")
			.replace(/\$\{CYAN\}/g, "")
			.replace(/\$\{DIM\}/g, "")
			.replace(/\$\{GREEN\}/g, "")
			.replace(/\$\{YELLOW\}/g, "")
			.replace(/\$\{RED\}/g, "");

		const lines: string[] = content.split("\n");
		const cleaned: string = lines
			.map((l: string) => l.replace(/^\s{2}/, ""))
			.join("\n")
			.trim();

		sections.set(key, cleaned);
	}

	return sections;
}

/** Convert a help section into markdown. */
function sectionToMarkdown(content: string): string {
	const lines: string[] = content.split("\n");
	const mdLines: string[] = [];

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

		const configMatch = line.match(/^(\s{2,})((?:make|reports|capture|tools|docs)\.\S+)\s{2,}(.+)/);
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

interface CliCommand { command: string; description: string }
interface NpmScript { name: string; script: string }
interface ReportScript { id: string; label: string; script: string }
interface DocGenerator { label: string; command: string }

/** Non-interactive CLI commands. */
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
	{ command: "report:{id}", description: "Generate a single report by ID (e.g. report:test)" },
	{ command: "dev:reload", description: "Reload plugin in Obsidian via CLI" },
	{ command: "dev:console", description: "Open Obsidian developer console stream" },
	{ command: "dev:errors", description: "Open Obsidian error stream" },
	{ command: "dev:check", description: "Run lint + tsc (no tests)" },
	{ command: "dev:lint", description: "Run ESLint on src/" },
	{ command: "make:hub", description: "Scaffold a new hub (--name required, --icon, --type, --tabs)" },
	{ command: "make:plugin", description: "Scaffold a new plugin (--name required, --id, --author)" },
	{ command: "make:app", description: "Scaffold a new DDD application (--name required, --id, --author)" },
	{ command: "capture:idea", description: 'Capture an idea (--text="...")' },
	{ command: "capture:note", description: 'Capture a typed note (--type, --title="...")' },
	{ command: "info", description: "Show project stats, version, config" },
];

function loadJson<T>(filePath: string): T | null {
	try { return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T; }
	catch { return null; }
}

function main(): void {
	const now = new Date();
	const date = now.toISOString();

	// Load help sections
	let helpSections = new Map<string, string>();
	if (fs.existsSync(HELP_PATH)) {
		const source = fs.readFileSync(HELP_PATH, "utf-8");
		helpSections = extractHelpSections(source);
	}

	// Load plugin data
	const pluginConfig = loadJson<Record<string, unknown>>(PLUGIN_CONFIG_PATH);
	const pluginPkg = loadJson<Record<string, unknown>>(PLUGIN_PKG_PATH);

	const npmScripts = pluginPkg?.scripts as Record<string, string> ?? {};
	const scriptEntries: NpmScript[] = Object.entries(npmScripts).map(([name, script]) => ({ name, script }));
	const reportScripts: ReportScript[] = ((pluginConfig?.reports as Record<string, unknown>)?.scripts as ReportScript[]) ?? [];
	const docGenerators: DocGenerator[] = ((pluginConfig?.docs as Record<string, unknown>)?.generators as DocGenerator[]) ?? [];
	const makeConfig = (pluginConfig?.make ?? {}) as Record<string, Record<string, string>>;

	const sectionCount = helpSections.size;
	const commandCount = CLI_COMMANDS.length;
	const scriptCount = scriptEntries.length;
	const reportCount = reportScripts.length;
	const docGenCount = docGenerators.length;

	// Build document
	const doc = Document.create("Flowti CLI Reference")
		.mergeFrontmatter({
			type: "CLIReference",
			date,
			sections: sectionCount,
			cli_commands: commandCount,
			npm_scripts: scriptCount,
			report_generators: reportCount,
			doc_generators: docGenCount,
		})
		.addBlank()
		.heading(1, "Flowti CLI Reference")
		.addBlank()
		.callout("info", "Summary", [
			`CLI commands: ${commandCount} | Help sections: ${sectionCount} | npm scripts: ${scriptCount}`,
			`Report generators: ${reportCount} | Doc generators: ${docGenCount}`,
		])
		.addBlank()
		.addSeparator()
		.addBlank();

	// Quick Start
	doc.heading(2, "Quick Start").addBlank();
	doc.codeBlock("bash", [
		"npm run flowti              # Interactive menu (Start → Project → Detail)",
		"npm run flowti -- build     # Non-interactive: fast build",
		"npm run flowti -- help      # Show full help",
		"npm run flowti -- info      # Project stats",
	].join("\n"));
	doc.addBlank();

	// Architecture
	doc.heading(2, "Architecture").addBlank();
	doc.text("The CLI is project-centric. On launch you select a project, then work within its context:").addBlank();
	doc.codeBlock("", [
		"Start Menu (Load / Create / Import)",
		"  └─ Project Detail Menu",
		"       ├─ 1) Make          Scaffold code from templates",
		"       ├─ 2) Build         Build + Build Report",
		"       ├─ 3) Review        E2E test sessions",
		"       ├─ 4) Publish       Gated release pipeline",
		"       ├─ 5) Reports       Report generators",
		"       ├─ 6) Dev Tools     Plugin utilities",
		"       ├─ 7) Npm Scripts   Browse package.json scripts",
		"       ├─ 8) Capture Idea  Quick-capture to inbox",
		"       ├─ 9) Capture Note  Typed note capture",
		"       ├─ d) Documentation Generate reference docs",
		"       ├─ k) Knowledgebase Vault search (Obsidian CLI)",
		"       └─ i) Info          Project diagnostics",
	].join("\n"));
	doc.addBlank();

	// Help sections (skip main — already covered by Architecture)
	const sectionTitles: Record<string, string> = {
		main: "Overview",
		make: "Make (Scaffolding)",
		build: "Build",
		review: "Review (E2E)",
		publish: "Publish",
		reports: "Reports",
		devtools: "Dev Tools",
		capture: "Capture",
		info: "Info",
	};

	for (const [key, content] of helpSections) {
		if (key === "main") continue;
		const title = sectionTitles[key] ?? key;
		doc.heading(2, title).addBlank();
		doc.text(sectionToMarkdown(content)).addBlank();
	}

	// Non-Interactive Commands
	doc.heading(2, "Non-Interactive Commands").addBlank();
	doc.text("All commands can be run directly without the interactive menu:").addBlank();
	doc.table(
		["Command", "Description"],
		CLI_COMMANDS.map((cmd) => [`\`npm run flowti -- ${cmd.command}\``, cmd.description]),
	);
	doc.addBlank();

	// npm Scripts
	if (scriptEntries.length > 0) {
		doc.heading(2, "npm Scripts (Plugin)").addBlank();
		doc.table(
			["Script", "Command"],
			scriptEntries.map((s) => [`\`${s.name}\``, `\`${s.script}\``]),
		);
		doc.addBlank();
	}

	// Report Generators
	if (reportScripts.length > 0) {
		doc.heading(2, "Report Generators").addBlank();
		doc.text(`${reportCount} report generators configured in \`flowti.config.json\`:`).addBlank();
		doc.table(
			["ID", "Label", "Script"],
			reportScripts.map((r) => [r.id, r.label, `\`${r.script}\``]),
		);
		doc.addBlank();
	}

	// Documentation Generators
	if (docGenerators.length > 0) {
		doc.heading(2, "Documentation Generators").addBlank();
		doc.text(`${docGenCount} documentation generators configured in \`flowti.config.json\`:`).addBlank();
		doc.table(
			["Label", "Command"],
			docGenerators.map((g) => [g.label, `\`${g.command}\``]),
		);
		doc.addBlank();
	}

	// Make Configuration
	if (Object.keys(makeConfig).length > 0) {
		doc.heading(2, "Make Configuration").addBlank();
		doc.text("Scaffold output paths (`flowti.config.json` → `make`):").addBlank();
		if (makeConfig.hub) {
			doc.heading(3, "Hub Paths").addBlank();
			doc.table(
				["Key", "Path"],
				Object.entries(makeConfig.hub).map(([k, v]) => [`\`make.hub.${k}\``, `\`${v}\``]),
			);
			doc.addBlank();
		}
		if (makeConfig.plugin) {
			doc.heading(3, "Plugin Paths").addBlank();
			doc.table(
				["Key", "Path"],
				Object.entries(makeConfig.plugin).map(([k, v]) => [`\`make.plugin.${k}\``, `\`${v}\``]),
			);
			doc.addBlank();
		}
	}

	// Configuration Files
	doc.heading(2, "Configuration Files").addBlank();
	doc.table(
		["File", "Purpose"],
		[
			["`flowti-cli.config.json`", "Global CLI config: projects folder, capture paths, onboarding"],
			["`flowti.config.json`", "Per-project config: tools, build/test/review/publish commands, reports, docs"],
			["`build-endpoints.json`", "Distribution endpoints for multi-vault deploy"],
			["`manifest.json`", "Obsidian plugin metadata (id, version, author)"],
			["`package.json`", "npm scripts, dependencies"],
		],
	);
	doc.addBlank();

	// Save
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	const outputPath = path.join(OUTPUT_DIR, "Flowti CLI Reference.md");
	doc.save(outputPath);

	console.log(
		`[report] CLIReference written (${commandCount} commands, ${sectionCount} sections, ${docGenCount} doc generators): ${outputPath}`,
	);
}

main();
