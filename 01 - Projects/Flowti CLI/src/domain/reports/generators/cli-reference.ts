/**
 * generate-cli-reference.ts
 *
 * Generates a "Flowti CLI Reference" document from the HELP sections
 * in domain/help/help.ts and the current CLI/plugin configuration.
 *
 * Usage: npx tsx src/domain/reports/generators/cli-reference.ts
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { CLI_PROJECT, PLUGIN_ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";
import { log } from "../../../infrastructure/logger.js";
import { clock } from "../../../infrastructure/clock.js";

const HELP_PATH: string = paths.join(CLI_PROJECT, "src", "domain", "help", "help.ts");
const PLUGIN_CONFIG_PATH: string = paths.join(PLUGIN_ROOT, "flowti.config.json");
const PLUGIN_PKG_PATH: string = paths.join(PLUGIN_ROOT, "package.json");
const OUTPUT_DIR: string = paths.join(CLI_PROJECT, "docs", "reference");

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

type LineRule = { pattern: RegExp; transform: (m: RegExpMatchArray) => string[] };

const LINE_RULES: LineRule[] = [
	{ pattern: /^([A-Z][A-Z\s()]+)$/, transform: (m) => [`### ${m[1].trim()}`, ""] },
	{ pattern: /^(\d+)\)\s+(.+)/, transform: (m) => [`**${m[1]}) ${m[2]}**`, ""] },
	{ pattern: /^([a-z])\)\s+(.+)/, transform: (m) => [`**${m[1]}) ${m[2]}**`, ""] },
	{ pattern: /^→\s+(.+)/, transform: (m) => [`\`${m[1]}\``, ""] },
	{ pattern: /^(\s{2,})(npm run \S+|node \S+|obsidian \S+)\s{2,}(.+)/, transform: (m) => [`- \`${m[2].trim()}\` — ${m[3].trim()}`] },
	{ pattern: /^(\s{2,})(--\S+)\s{3,}(.+)/, transform: (m) => [`- \`${m[2]}\` — ${m[3].trim()}`] },
	{ pattern: /^(\s{2,})((?:make|reports|capture|tools|docs)\.\S+)\s{2,}(.+)/, transform: (m) => [`- \`${m[2]}\` — ${m[3].trim()}`] },
	{ pattern: /^(\s{2,})(\S+\.(?:json|md))\s{2,}(.+)/, transform: (m) => [`- \`${m[2]}\` — ${m[3].trim()}`] },
	{ pattern: /^(\s+)-\s+(.+)/, transform: (m) => [`- ${m[2]}`] },
];

function transformLine(line: string): string[] {
	for (const rule of LINE_RULES) {
		const m = line.match(rule.pattern);
		if (m) return rule.transform(m);
	}
	return [line];
}

/** Convert a help section into markdown. */
function sectionToMarkdown(content: string): string {
	return content.split("\n").flatMap(transformLine).join("\n");
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
	{ command: "events:list", description: "List all events in the project event catalog" },
	{ command: "events:add", description: 'Add an event (--name="user.created" --domain="user")' },
	{ command: "info", description: "Show project stats, version, config" },
];

function loadJson<T>(filePath: string): T | null {
	try { return JSON.parse(disk.readFileSync(filePath, "utf-8")) as T; }
	catch { return null; }
}

interface PluginData {
	helpSections: Map<string, string>;
	scriptEntries: NpmScript[];
	reportScripts: ReportScript[];
	docGenerators: DocGenerator[];
	makeConfig: Record<string, Record<string, string>>;
}

function loadHelpSections(): Map<string, string> {
	if (!disk.existsSync(HELP_PATH)) return new Map();
	return extractHelpSections(disk.readFileSync(HELP_PATH, "utf-8"));
}

function extractScriptEntries(pluginPkg: Record<string, unknown> | undefined): NpmScript[] {
	const npmScripts = pluginPkg?.scripts as Record<string, string> ?? {};
	return Object.entries(npmScripts).map(([name, script]) => ({ name, script }));
}

function extractPluginEntries(pluginConfig: Record<string, unknown> | undefined, pluginPkg: Record<string, unknown> | undefined): Omit<PluginData, "helpSections"> {
	return {
		scriptEntries: extractScriptEntries(pluginPkg),
		reportScripts: ((pluginConfig?.reports as Record<string, unknown>)?.scripts as ReportScript[]) ?? [],
		docGenerators: ((pluginConfig?.docs as Record<string, unknown>)?.generators as DocGenerator[]) ?? [],
		makeConfig: (pluginConfig?.make ?? {}) as Record<string, Record<string, string>>,
	};
}

function loadPluginData(): PluginData {
	const pluginConfig = loadJson<Record<string, unknown>>(PLUGIN_CONFIG_PATH);
	const pluginPkg = loadJson<Record<string, unknown>>(PLUGIN_PKG_PATH);
	return {
		helpSections: loadHelpSections(),
		...extractPluginEntries(pluginConfig ?? undefined, pluginPkg ?? undefined),
	};
}

function addQuickStartAndArchitecture(doc: Document): void {
	doc.heading(2, "Quick Start").addBlank();
	doc.codeBlock("bash", [
		"npm run flowti              # Interactive menu (Start → Project → Detail)",
		"npm run flowti -- build     # Non-interactive: fast build",
		"npm run flowti -- help      # Show full help",
		"npm run flowti -- info      # Project stats",
	].join("\n"));
	doc.addBlank();

	doc.heading(2, "Architecture").addBlank();
	doc.text("The CLI is project-centric. On launch you select a project, then work within its context:").addBlank();
	doc.codeBlock("", [
		"Start Menu (Load / Create / Import)",
		"  └─ Project Detail Menu",
		"       ├─ 1) Make          Scaffold code from templates",
		"       ├─ 2) Build         Build + Build Report",
		"       ├─ 3) Review        E2E test sessions",
		"       ├─ 4) Publish       Gated release pipeline",
		"       ├─ c) Components    Browse project components",
		"       ├─ e) Events        Event catalog (list, add)",
		"       ├─ 5) Reports       Report generators",
		"       ├─ 6) Npm Scripts   Browse package.json scripts",
		"       ├─ 7) Capture Idea  Quick-capture to inbox",
		"       ├─ 8) Capture Note  Typed note capture",
		"       ├─ d) Documentation Generate reference docs",
		"       ├─ k) Knowledgebase Vault search (Obsidian CLI)",
		"       └─ i) Info          Project diagnostics",
	].join("\n"));
	doc.addBlank();
}

const SECTION_TITLES: Record<string, string> = {
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

function addHelpSections(doc: Document, helpSections: Map<string, string>): void {
	for (const [key, content] of helpSections) {
		if (key === "main") continue;
		doc.heading(2, SECTION_TITLES[key] ?? key).addBlank();
		doc.text(sectionToMarkdown(content)).addBlank();
	}
}

function addPluginSections(doc: Document, data: PluginData): void {
	if (data.scriptEntries.length > 0) {
		doc.heading(2, "npm Scripts (Plugin)").addBlank();
		doc.table(["Script", "Command"], data.scriptEntries.map((s) => [`\`${s.name}\``, `\`${s.script}\``]));
		doc.addBlank();
	}
	if (data.reportScripts.length > 0) {
		doc.heading(2, "Report Generators").addBlank();
		doc.text(`${data.reportScripts.length} report generators configured in \`flowti.config.json\`:`).addBlank();
		doc.table(["ID", "Label", "Script"], data.reportScripts.map((r) => [r.id, r.label, `\`${r.script}\``]));
		doc.addBlank();
	}
	if (data.docGenerators.length > 0) {
		doc.heading(2, "Documentation Generators").addBlank();
		doc.text(`${data.docGenerators.length} documentation generators configured in \`flowti.config.json\`:`).addBlank();
		doc.table(["Label", "Command"], data.docGenerators.map((g) => [g.label, `\`${g.command}\``]));
		doc.addBlank();
	}
}

function addMakeConfig(doc: Document, makeConfig: Record<string, Record<string, string>>): void {
	if (Object.keys(makeConfig).length === 0) return;
	doc.heading(2, "Make Configuration").addBlank();
	doc.text("Scaffold output paths (`flowti.config.json` → `make`):").addBlank();
	for (const [section, label] of [["hub", "Hub Paths"], ["plugin", "Plugin Paths"]] as const) {
		if (makeConfig[section]) {
			doc.heading(3, label).addBlank();
			doc.table(["Key", "Path"], Object.entries(makeConfig[section]).map(([k, v]) => [`\`make.${section}.${k}\``, `\`${v}\``]));
			doc.addBlank();
		}
	}
}

function main(): void {
	const date = clock.iso();
	const data = loadPluginData();
	const commandCount = CLI_COMMANDS.length;

	const doc = Document.create("Flowti CLI Reference")
		.mergeFrontmatter({
			type: "CLIReference",
			date,
			sections: data.helpSections.size,
			cli_commands: commandCount,
			npm_scripts: data.scriptEntries.length,
			report_generators: data.reportScripts.length,
			doc_generators: data.docGenerators.length,
		})
		.addBlank()
		.heading(1, "Flowti CLI Reference")
		.addBlank()
		.callout("info", "Summary", [
			`CLI commands: ${commandCount} | Help sections: ${data.helpSections.size} | npm scripts: ${data.scriptEntries.length}`,
			`Report generators: ${data.reportScripts.length} | Doc generators: ${data.docGenerators.length}`,
		])
		.addBlank()
		.addSeparator()
		.addBlank();

	addQuickStartAndArchitecture(doc);
	addHelpSections(doc, data.helpSections);

	doc.heading(2, "Non-Interactive Commands").addBlank();
	doc.text("All commands can be run directly without the interactive menu:").addBlank();
	doc.table(["Command", "Description"], CLI_COMMANDS.map((cmd) => [`\`npm run flowti -- ${cmd.command}\``, cmd.description]));
	doc.addBlank();

	addPluginSections(doc, data);
	addMakeConfig(doc, data.makeConfig);

	doc.heading(2, "Configuration Files").addBlank();
	doc.table(["File", "Purpose"], [
		["`flowti-cli.config.json`", "Global CLI config: projects folder, capture paths, onboarding"],
		["`flowti.config.json`", "Per-project config: tools, build/test/review/publish commands, reports, docs"],
		["`build-endpoints.json`", "Distribution endpoints for multi-vault deploy"],
		["`manifest.json`", "Obsidian plugin metadata (id, version, author)"],
		["`package.json`", "npm scripts, dependencies"],
	]);
	doc.addBlank();

	disk.mkdirSync(OUTPUT_DIR, { recursive: true });
	const outputPath = paths.join(OUTPUT_DIR, "Flowti CLI Reference.md");
	doc.save(outputPath);

	log(
		`[report] CLIReference written (${commandCount} commands, ${data.helpSections.size} sections, ${data.docGenerators.length} doc generators): ${outputPath}`,
	);
}

main();
