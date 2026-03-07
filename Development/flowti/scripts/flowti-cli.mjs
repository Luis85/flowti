/**
 * flowti-cli.mjs — Interactive CLI for Flowti development workflows.
 *
 * Usage:
 *   npm run flowti              Interactive menu
 *   npm run flowti help         Full man-page
 *   npm run flowti help build   Section-specific help
 *
 * Main Menu:
 *   1) Make       — scaffold new hub or plugin from templates
 *   2) Build      — fast build, full build, watch, distribute
 *   3) Review     — E2E test sessions, teardown, rebuild
 *   4) Publish    — build → test → publish pipeline
 *   5) Reports    — generate vault reports (all, selected, audit)
 *   6) Dev Tools  — plugin reload, console, errors, frontmatter, test data
 *   7) Info       — project stats, version, config overview
 *   ?) Help       — contextual man-pages
 *   q) Quit
 *
 * Configuration: flowti.config.json (project root)
 * No external dependencies — uses only Node.js built-ins.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

// ══════════════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════════════

const ROOT = path.resolve(import.meta.dirname, "..");
const CONFIG_PATH = path.join(ROOT, "flowti.config.json");
const MANIFEST_PATH = path.join(ROOT, "manifest.json");
const PKG_PATH = path.join(ROOT, "package.json");

// ANSI escape codes
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";

// ══════════════════════════════════════════════════════════════════════
// Config & manifest
// ══════════════════════════════════════════════════════════════════════

function loadJson(filePath) {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf-8"));
	} catch {
		return null;
	}
}

const config = loadJson(CONFIG_PATH) ?? { paths: {}, build: {}, reports: { scripts: [] } };
const manifest = loadJson(MANIFEST_PATH) ?? { id: "flowti-ibde", version: "?" };
const pkg = loadJson(PKG_PATH) ?? { version: "?" };

// ══════════════════════════════════════════════════════════════════════
// Readline helpers
// ══════════════════════════════════════════════════════════════════════

function createRL() {
	return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl, question, defaultValue = "") {
	return new Promise((resolve) => {
		const suffix = defaultValue ? ` ${DIM}(${defaultValue})${RESET}` : "";
		rl.question(`  ${question}${suffix}: `, (answer) => {
			resolve(answer.trim() || defaultValue);
		});
	});
}

// ══════════════════════════════════════════════════════════════════════
// Shell execution
// ══════════════════════════════════════════════════════════════════════

function run(cmd, label) {
	const startTime = Date.now();
	console.log(`\n  ${CYAN}▸${RESET} ${label ?? cmd}\n`);
	try {
		execSync(cmd, { cwd: ROOT, stdio: "inherit" });
		const duration = ((Date.now() - startTime) / 1000).toFixed(1);
		console.log(`\n  ${GREEN}✓${RESET} Done ${DIM}(${duration}s)${RESET}\n`);
		return 0;
	} catch (err) {
		const duration = ((Date.now() - startTime) / 1000).toFixed(1);
		console.log(`\n  ${RED}✗${RESET} Failed ${DIM}(${duration}s)${RESET}\n`);
		return err.status ?? 1;
	}
}

function runSilent(cmd) {
	try {
		return execSync(cmd, { cwd: ROOT, encoding: "utf-8", timeout: 10_000, windowsHide: true }).trim();
	} catch {
		return null;
	}
}

// ══════════════════════════════════════════════════════════════════════
// UI primitives
// ══════════════════════════════════════════════════════════════════════

function printBanner() {
	console.log();
	console.log(`  ${BOLD}${"═".repeat(50)}${RESET}`);
	console.log(`  ${BOLD}  Flowti CLI${RESET}  ${DIM}v${manifest.version}${RESET}`);
	console.log(`  ${BOLD}${"═".repeat(50)}${RESET}`);
	console.log();
}

function printHeader(title) {
	console.log(`\n  ${BOLD}${"─".repeat(50)}${RESET}`);
	console.log(`  ${BOLD}  ${title}${RESET}`);
	console.log(`  ${BOLD}${"─".repeat(50)}${RESET}\n`);
}

function printMenu(items) {
	for (const item of items) {
		if (item.separator) {
			console.log();
			continue;
		}
		if (item.disabled) {
			console.log(`    ${DIM}${item.key}) ${item.label}${RESET}`);
		} else {
			console.log(`    ${item.key}) ${item.label}`);
		}
	}
	console.log();
}

// ══════════════════════════════════════════════════════════════════════
// Man-pages
// ══════════════════════════════════════════════════════════════════════

const HELP = {
	main: `
  ${BOLD}FLOWTI CLI${RESET} — Developer tooling for the Flowti IBDE Obsidian plugin.

  ${BOLD}USAGE${RESET}
    npm run flowti              Start interactive menu
    npm run flowti help         Show this help
    npm run flowti help build   Show help for a specific section

  ${BOLD}MAIN MENU${RESET}
    ${CYAN}1) Make${RESET}       Scaffold new hub or plugin from templates
    ${CYAN}2) Build${RESET}      Build the plugin (fast, full, watch, distribute)
    ${CYAN}3) Review${RESET}     E2E test sessions, vault management
    ${CYAN}4) Publish${RESET}    Gated pipeline: build → test → publish
    ${CYAN}5) Reports${RESET}    Generate vault reports (14 generators)
    ${CYAN}6) Dev Tools${RESET}  Plugin reload, console, frontmatter, test data
    ${CYAN}7) Info${RESET}       Project stats, version, config

  ${BOLD}NPM SCRIPTS (direct)${RESET}
    npm run build            Fast build (esbuild only, no reports)
    npm run build:dev        Watch mode with hot-reload
    npm run build:full       Flow tests → build → all reports
    npm run build:increment  Full CI: check → build → test → e2e → docs → distribute
    npm run test             Type check + lint + vitest
    npm run test:increment   Check + build + vitest with coverage
    npm run test:e2e         Build + flow tests + E2E suite
    npm run reports          Generate all 14 report notes
    npm run check            Lint + tsc (no tests)

  ${BOLD}CONFIGURATION${RESET}
    flowti.config.json       Report scripts, paths, build settings
    build-endpoints.json     Distribution endpoints (multi-vault deploy)
    manifest.json            Plugin metadata (id, version)

  ${BOLD}NON-INTERACTIVE COMMANDS${RESET}
    npm run flowti -- build              Fast build
    npm run flowti -- build:full         Flow tests + build + reports
    npm run flowti -- build:increment    Full CI pipeline
    npm run flowti -- build:watch        Watch mode (add --reload for hot-reload)
    npm run flowti -- build:distribute   Build + distribute to endpoints
    npm run flowti -- test               Type check + lint + vitest
    npm run flowti -- test:increment     Check + build + coverage
    npm run flowti -- test:e2e           Build + flow tests + E2E
    npm run flowti -- review             List E2E journeys
    npm run flowti -- publish            Build release
    npm run flowti -- publish:all        Increment + E2E + release
    npm run flowti -- reports            Generate all reports
    npm run flowti -- report:{id}        Generate a single report (e.g. report:test)
    npm run flowti -- dev:reload         Reload plugin in Obsidian
    npm run flowti -- dev:check          Lint + tsc
    npm run flowti -- dev:lint           ESLint only
    npm run flowti -- make:hub --name=X  Scaffold a new hub
    npm run flowti -- make:plugin --name=X  Scaffold a new plugin
    npm run flowti -- info               Show project info
    npm run flowti -- help [section]     Show help

  ${BOLD}HELP${RESET}
    Press ${CYAN}?${RESET} in any menu for contextual help.
`,

	make: `
  ${BOLD}MAKE${RESET} — Scaffold boilerplate code from Flowti patterns.

  ${BOLD}OPTIONS${RESET}
    ${CYAN}1) New Hub${RESET}
       Scaffolds a complete hub within the Flowti plugin:
       - UI view (BaseHubView subclass with tabs)
       - Domain layer (service stub, events, types)
       - Hub provider (HubDashboardProvider for cross-hub)
       - Test file (vitest + happy-dom setup)
       - CSS layer file
       - Feature PRD document
       - E2E journey stub

       ${DIM}Prompts: hub name, icon, hub type, initial tabs${RESET}

    ${CYAN}2) New Plugin${RESET}
       Scaffolds a standalone Obsidian plugin following Flowti patterns:
       - DDD folder structure (infrastructure, domain, ui)
       - EventBus backbone
       - BaseHubView base class
       - esbuild config with CSS pipeline
       - TypeScript, ESLint, Vitest setup
       - package.json with focused npm scripts

       ${DIM}Prompts: plugin name, plugin ID, author${RESET}

  ${BOLD}CONFIGURATION${RESET}
    Output paths are configurable in flowti.config.json under "make":
      make.hub.ui        UI source folder (default: src/ui)
      make.hub.domain    Domain source folder (default: src/domain)
      make.hub.tests     Test folder (default: tests/ui)
      make.hub.css       CSS folder (default: css)
      make.hub.docs      Feature docs folder (default: docs/features)
      make.hub.journeys  E2E journeys folder (default: tests/e2e/journeys)
      make.plugin.output Plugin output folder (default: ../)
`,

	build: `
  ${BOLD}BUILD${RESET} — Compile the Flowti plugin.

  ${BOLD}OPTIONS${RESET}
    ${CYAN}1) Build (fast)${RESET}
       Runs esbuild in production mode. No tests, no reports.
       Concatenates CSS from css/ sources. Copies assets to output.
       ${DIM}→ node esbuild.config.mjs --production --no-reports${RESET}
       ${DIM}→ Typical time: ~2s${RESET}

    ${CYAN}2) Build increment${RESET}
       Full CI pipeline: lint → tsc → build → vitest (coverage) → E2E →
       TypeDoc → all reports → distribute to endpoints.
       ${DIM}→ npm run build:increment${RESET}
       ${DIM}→ Typical time: ~90s${RESET}

    ${CYAN}3) Build full${RESET}
       Flow tests gate the build, then generates all reports.
       ${DIM}→ npm run build:full${RESET}

    ${CYAN}4) Watch mode${RESET}
       Starts esbuild in watch mode. CSS changes auto-rebuild.
       Add --reload flag to hot-reload the plugin in Obsidian.
       ${DIM}→ node esbuild.config.mjs --watch [--reload]${RESET}

    ${CYAN}5) Distribute${RESET}
       Copies build artifacts to endpoints defined in build-endpoints.json.
       Each endpoint has a name, path, and optional clean flag.
       ${DIM}→ node esbuild.config.mjs --production --distribution${RESET}

  ${BOLD}ESBUILD FLAGS${RESET}
    --production     Minify + tree-shake (default for non-watch)
    --no-reports     Skip report generation after build
    --distribution   Copy to endpoint vaults
    --increment      Mark build as increment in reports
    --publish        Release mode (distribution + reports)
    --reload         Auto-reload plugin after each watch build
    --watch          Watch mode (inline sourcemaps, no minify)
`,

	review: `
  ${BOLD}REVIEW${RESET} — E2E testing and vault management.

  ${BOLD}OPTIONS${RESET}
    ${CYAN}1) Start test session${RESET}
       Opens the interactive E2E runner. Select journeys, configure
       step filters, run tests, view results.
       ${DIM}→ node scripts/run-e2e.mjs --list${RESET}

    ${CYAN}2) Build the increment${RESET}
       Full CI pipeline (same as Build → option 2).
       Must pass before publishing is unlocked.

    ${CYAN}3) Publish the increment${RESET}
       Gated — requires a successful increment build in this session.
       Runs the release pipeline.

    ${CYAN}4) Teardown test vault${RESET}
       Resets the E2E test vault to a fresh state:
       deletes content, purges ghost index, resets installer state.

    ${CYAN}5) Rebuild${RESET}
       Full teardown → re-run prerequisites → installer journey.

  ${BOLD}E2E JOURNEYS${RESET} (6 available)
    getting-started, component-library, canvas-session,
    tool-showcase, tool-reference, journey-builder

  ${BOLD}ENVIRONMENT VARIABLES${RESET}
    E2E_VAULT_DIR       Test vault path (default: ../flowti-e2e)
    E2E_JOURNEY         Comma-separated journey names
    E2E_RUN_INSTALLER   Set "true" to force installer
    E2E_STEPS           Step filter (e.g., journey-name:1,2,5)
`,

	publish: `
  ${BOLD}PUBLISH${RESET} — Gated release pipeline.

  The publish flow tracks pipeline state across three stages.
  Each stage must pass before the next unlocks.

  ${BOLD}PIPELINE${RESET}
    ${GREEN}✓${RESET}/${DIM}○${RESET} Build  →  ${GREEN}✓${RESET}/${DIM}○${RESET} Test  →  ${GREEN}✓${RESET}/${DIM}○${RESET} Publish

  ${BOLD}OPTIONS${RESET}
    ${CYAN}1) Build the increment${RESET}
       Runs the full increment build. On success, unlocks testing.

    ${CYAN}2) Test the increment (E2E)${RESET}
       Runs the full E2E suite. Requires a passing build.
       On success, unlocks publishing.

    ${CYAN}3) Publish the increment${RESET}
       Runs the release pipeline (check → build → test → docs → publish).
       Requires passing build AND test.

    ${CYAN}a) Run all${RESET}
       Runs build → test → publish in sequence.
       Stops on first failure.
`,

	reports: `
  ${BOLD}REPORTS${RESET} — Generate vault report notes.

  All reports are written as Obsidian notes with YAML frontmatter,
  making them queryable via Dataview or the Flowti query engine.

  ${BOLD}OPTIONS${RESET}
    ${CYAN}1) Build all reports${RESET}
       Runs all 14 report generators in sequence.
       ${DIM}→ npm run generate:reports${RESET}

    ${CYAN}2) Build selected report${RESET}
       Pick one report to generate. Reports are configured
       in flowti.config.json under reports.scripts.

    ${CYAN}3) Build audit report${RESET}
       Collects the latest frontmatter from all report categories
       and writes a consolidated audit note to docs/reports/audits/.

  ${BOLD}REPORT TYPES${RESET} (14)
    Test Report          Vitest results + perf summary
    Coverage Report      V8 line/branch/function coverage
    Build Report         Bundle size, duration, warnings
    Codebase Report      TypeDoc metrics (classes, LOC)
    Cycle Report         Cycle metadata + PBIs + test stats
    Trace Report         PRD → PBI → Test → Code linkage
    Command Reference    All plugin commands (~40)
    Event Catalog        All events (~443) by category
    Data Dictionary      18 entity types, 131 fields
    Performance Report   Startup/storage/query metrics
    Complexity Report    Cyclomatic complexity per file
    Tool Reference       30 E2E journey tools
    E2E Report           Journey results + screenshots
    CLI Reference        CLI commands, help sections, npm scripts

  ${BOLD}OUTPUT PATHS${RESET}
    Timestamped:  docs/reports/{type}/YYYY-MM-DD-*.md
    Stable:       docs/reference/{name}.md
    Audits:       docs/reports/audits/{name}.md
`,

	devtools: `
  ${BOLD}DEV TOOLS${RESET} — Developer utilities for the Obsidian plugin.

  ${BOLD}OPTIONS${RESET}
    ${CYAN}1) Reload plugin${RESET}
       Hot-reloads the flowti-ibde plugin via Obsidian CLI.
       Requires Obsidian 1.12+ running with CLI enabled.
       ${DIM}→ node scripts/cli-reload.mjs${RESET}

    ${CYAN}2) Dev console${RESET}
       Opens the Obsidian developer console stream.
       ${DIM}→ obsidian dev:console${RESET}

    ${CYAN}3) Dev errors${RESET}
       Opens the Obsidian error stream.
       ${DIM}→ obsidian dev:errors${RESET}

    ${CYAN}4) Fix frontmatter${RESET}
       Scans docs/ for missing type: and stage: fields (ADR-030).
       Runs in dry-run mode first — confirms before writing.
       ${DIM}→ node scripts/fix-frontmatter.mjs [--dry-run]${RESET}

    ${CYAN}5) Generate test data${RESET}
       Creates 8 CSV files for Analytics Hub dashboard testing.
       Supports --from, --to, --seed, --out flags.
       ${DIM}→ node scripts/generate-test-data.mjs${RESET}

    ${CYAN}6) Type check${RESET}
       Runs ESLint + TypeScript type-check (no tests).
       ${DIM}→ npm run check${RESET}

    ${CYAN}7) Lint${RESET}
       Runs ESLint on src/ only.
       ${DIM}→ npm run lint${RESET}

  ${BOLD}OBSIDIAN CLI${RESET} (requires Obsidian 1.12+)
    The Obsidian CLI provides vault management, plugin control,
    and code execution capabilities. The ObsidianCli class
    (src/infrastructure/cli/ObsidianCli.ts) wraps 20 methods:
    file ops, plugin management, eval, DOM queries, screenshots.
`,

	info: `
  ${BOLD}INFO${RESET} — Project information and diagnostics.

  Shows live project statistics gathered from:
    - manifest.json (plugin version, min Obsidian version)
    - package.json (dependencies, script count)
    - Source tree (file counts, test counts)
    - Git (branch, commit, status)
    - flowti.config.json (report scripts, paths)

  Use this to quickly check project health before starting work.
`,
};

function showHelp(section) {
	const key = section?.toLowerCase() ?? "main";
	const content = HELP[key];
	if (!content) {
		console.log(`\n  ${YELLOW}No help available for "${section}".${RESET}`);
		console.log(`  ${DIM}Available sections: ${Object.keys(HELP).join(", ")}${RESET}\n`);
		return;
	}
	console.log(content);
}

// ══════════════════════════════════════════════════════════════════════
// Make — scaffolding
// ══════════════════════════════════════════════════════════════════════

function getMakePaths() {
	const hub = config.make?.hub ?? {};
	return {
		ui: hub.ui ?? "src/ui",
		domain: hub.domain ?? "src/domain",
		hubDomain: hub.hubDomain ?? "src/domain/hub",
		tests: hub.tests ?? "tests/ui",
		css: hub.css ?? "css",
		docs: hub.docs ?? "docs/features",
		journeys: hub.journeys ?? "tests/e2e/journeys",
		components: hub.components ?? "src/ui/components",
	};
}

// ── Naming helpers ───────────────────────────────────────────────────

function toKebab(name) {
	return name.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
}

function toPascal(name) {
	return name.replace(/(?:^|[\s_-])(\w)/g, (_, c) => c.toUpperCase()).replace(/[\s_-]/g, "");
}

function toCamel(name) {
	const pascal = toPascal(name);
	return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// ── File writer ──────────────────────────────────────────────────────

function writeFile(relPath, content) {
	const absPath = path.join(ROOT, relPath);
	const dir = path.dirname(absPath);
	fs.mkdirSync(dir, { recursive: true });
	if (fs.existsSync(absPath)) {
		console.log(`    ${YELLOW}skip${RESET}  ${relPath} (already exists)`);
		return false;
	}
	fs.writeFileSync(absPath, content, "utf-8");
	console.log(`    ${GREEN}create${RESET}  ${relPath}`);
	return true;
}

// ── Hub templates ────────────────────────────────────────────────────

function hubViewTemplate(pascal, kebab, hubType, icon, tabs) {
	const pageType = `${pascal}HubPage`;
	const tabDefs = tabs.map((t) => {
		const label = t.charAt(0).toUpperCase() + t.slice(1);
		return `\t\t{ id: "${t}", label: "${label}", icon: "layout-list", searchPlaceholder: "Search ${t}..." },`;
	}).join("\n");

	return `import type { WorkspaceLeaf } from "obsidian";
import { BaseHubView } from "../BaseHubView";
import type { TabDef } from "../BaseHubView";
import type { IEventBus } from "../../infrastructure/events/types";
import { VIEW_TYPE_${pascal.toUpperCase()}_HUB } from "../../domain/hub/types";

export type ${pageType} = ${tabs.map((t) => `"${t}"`).join(" | ")};

export class ${pascal}HubView extends BaseHubView<${pageType}> {

\tconstructor(
\t\tleaf: WorkspaceLeaf,
\t\teventBus: IEventBus,
\t) {
\t\tsuper(leaf, eventBus);
\t}

\t// ── Identity ──────────────────────────────────────────────────

\tgetViewType(): string { return VIEW_TYPE_${pascal.toUpperCase()}_HUB; }
\tgetHubId(): string { return "${kebab}-hub"; }
\tgetHubType(): "system" | "domain" | "user" { return "${hubType}"; }
\tgetHubDisplayName(): string { return "${pascal} Hub"; }
\tgetHubIcon(): string { return "${icon}"; }

\tgetTabDefinitions(): TabDef[] {
\t\treturn [
${tabDefs}
\t\t];
\t}

\t// ── Lifecycle ─────────────────────────────────────────────────

\tonHubOpen(): void {
\t\t// Subscribe to events, initialize components
\t}

\tonHubClose(): void {
\t\t// Cleanup
\t}

\t// ── Rendering ─────────────────────────────────────────────────

\trenderTopBarActions(_bar: HTMLElement): void {
\t\t// Add top bar buttons
\t}

\tonDashboardRender(): void {
\t\tthis.dashboardEl.empty();
\t\tthis.dashboardEl.createEl("p", { text: "${pascal} Hub — Dashboard" });
\t}

\tonTabRender(tabId: ${pageType}): void {
\t\tthis.masterEl.empty();
\t\tthis.detailPanelEl.empty();
\t\tthis.masterEl.createEl("p", { text: \`${pascal} Hub — \${tabId}\` });
\t}
}
`;
}

function hubTypesTemplate(pascal, tabs) {
	const pageType = `${pascal}HubPage`;
	return `/**
 * Type definitions for the ${pascal} Hub.
 */

export type ${pageType} = ${tabs.map((t) => `"${t}"`).join(" | ")};
`;
}

function hubEventsTemplate(pascal) {
	const camel = toCamel(pascal);
	return `/**
 * Events for the ${pascal} domain.
 */

export interface ${pascal}EventMap {
\t/** Emitted when a ${pascal.toLowerCase()} item is created. */
\t"${camel}.created": { id: string; name: string };
\t/** Emitted when a ${pascal.toLowerCase()} item is updated. */
\t"${camel}.updated": { id: string };
\t/** Emitted when a ${pascal.toLowerCase()} item is deleted. */
\t"${camel}.deleted": { id: string };
}
`;
}

function hubServiceTemplate(pascal) {
	return `/**
 * ${pascal}Service — domain service stub.
 *
 * Manages ${pascal.toLowerCase()} domain logic. Add methods as needed.
 */

import type { IEventBus } from "../../infrastructure/events/types";

export class ${pascal}Service {
\tconstructor(private readonly eventBus: IEventBus) {}

\t/** Example method — replace with real domain logic. */
\tgetAll(): readonly unknown[] {
\t\treturn [];
\t}
}
`;
}

function hubProviderTemplate(pascal, kebab, icon) {
	return `/**
 * ${pascal}HubProvider — provides summary data for cross-hub dashboards.
 */

import { VIEW_TYPE_${pascal.toUpperCase()}_HUB } from "./types";
import type { HubDashboardProvider, HubSummary } from "./types";

export class ${pascal}HubProvider implements HubDashboardProvider {

\tgetHubId(): string { return "${kebab}"; }
\tgetViewType(): string { return VIEW_TYPE_${pascal.toUpperCase()}_HUB; }
\tgetDisplayName(): string { return "${pascal}"; }
\tgetIcon(): string { return "${icon}"; }

\tgetSummary(): HubSummary {
\t\treturn {
\t\t\tstats: [],
\t\t\thealthLevel: "healthy",
\t\t\tactionItemCount: 0,
\t\t};
\t}
}
`;
}

function hubTestTemplate(pascal, kebab) {
	return `// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { ${pascal}HubView } from "../../../src/ui/${kebab}/${pascal}HubView";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";

function createMockLeaf(): import("obsidian").WorkspaceLeaf {
\treturn {} as import("obsidian").WorkspaceLeaf;
}

describe("${pascal}HubView", () => {
\tlet eventBus: IEventBus;

\tbeforeEach(() => {
\t\teventBus = new EventBus();
\t});

\tit("should have correct identity", () => {
\t\tconst view = new ${pascal}HubView(createMockLeaf(), eventBus);
\t\texpect(view.getHubId()).toBe("${kebab}-hub");
\t\texpect(view.getHubType()).toBe("domain");
\t\texpect(view.getHubDisplayName()).toBe("${pascal} Hub");
\t});

\tit("should define tabs", () => {
\t\tconst view = new ${pascal}HubView(createMockLeaf(), eventBus);
\t\tconst tabs = view.getTabDefinitions();
\t\texpect(tabs.length).toBeGreaterThan(0);
\t\tfor (const tab of tabs) {
\t\t\texpect(tab.id).toBeTruthy();
\t\t\texpect(tab.label).toBeTruthy();
\t\t\texpect(tab.icon).toBeTruthy();
\t\t}
\t});
});
`;
}

function hubCssTemplate(pascal, kebab) {
	return `/* ── ${pascal} Hub ──────────────────────────────────────────── */

.ft-${kebab}-hub {
\t/* Add hub-specific styles here */
}
`;
}

function hubPrdTemplate(pascal) {
	return `---
type: Feature
domain: ${pascal}
stage: draft
version: 1
tags:
  - feature
  - ${pascal.toLowerCase()}
---

# ${pascal} Hub

## Problem Statement

Describe the problem this hub solves.

## Goals

1. Goal one
2. Goal two

## Scope

### In Scope
- Item one
- Item two

### Out of Scope
- Deferred item

## Solution

Describe the solution approach.

## Acceptance Criteria

- [ ] Criterion one
- [ ] Criterion two
`;
}

function hubJourneyTemplate(pascal, kebab) {
	return JSON.stringify({
		name: `${pascal} Hub`,
		slug: kebab,
		description: `E2E journey for the ${pascal} Hub.`,
		steps: [
			{
				id: 1,
				name: `Open ${pascal} Hub`,
				tools: [
					{ tool: "command", args: { id: `flowti:open-${kebab}-hub` } },
					{ tool: "wait", args: { ms: 500 } },
				],
			},
		],
	}, null, "\t") + "\n";
}

// ── Plugin templates ─────────────────────────────────────────────────

function pluginManifestTemplate(pluginName, pluginId, author) {
	return JSON.stringify({
		id: pluginId,
		name: pluginName,
		version: "0.0.1",
		minAppVersion: "1.12.4",
		description: `${pluginName} — an Obsidian plugin.`,
		author,
		isDesktopOnly: true,
	}, null, "\t") + "\n";
}

function pluginPackageTemplate(pluginName, pluginId) {
	return JSON.stringify({
		name: pluginId,
		version: "0.0.1",
		description: pluginName,
		main: "main.js",
		scripts: {
			"build": "node esbuild.config.mjs --production",
			"build:dev": "node esbuild.config.mjs --watch",
			"test": "vitest run",
			"check": "tsc -noEmit -skipLibCheck",
			"lint": "eslint ./src/",
		},
		devDependencies: {
			"@typescript-eslint/eslint-plugin": "^8.0.0",
			"@typescript-eslint/parser": "^8.0.0",
			"builtin-modules": "^5.0.0",
			"esbuild": "^0.27.0",
			"obsidian": "latest",
			"tslib": "^2.8.0",
			"typescript": "^5.9.0",
			"vitest": "^4.0.0",
			"happy-dom": "^20.0.0",
		},
		dependencies: {},
	}, null, "\t") + "\n";
}

function pluginTsconfigTemplate() {
	return JSON.stringify({
		compilerOptions: {
			target: "ES2022",
			module: "ESNext",
			moduleResolution: "bundler",
			lib: ["ES2022", "DOM"],
			strict: true,
			esModuleInterop: true,
			skipLibCheck: true,
			outDir: "./dist",
			declaration: true,
			sourceMap: true,
		},
		include: ["src/**/*.ts"],
		exclude: ["node_modules"],
	}, null, "\t") + "\n";
}

function pluginEsbuildTemplate(pluginId) {
	return `import esbuild from "esbuild";
import { builtinModules } from "node:module";
import fs from "node:fs";
import path from "node:path";

const isWatch = process.argv.includes("--watch");
const prod = !isWatch;

const OUTDIR = path.resolve(process.cwd(), "..", "..", ".obsidian", "plugins", "${pluginId}");

const concatCSS = () => {
\tconst cssDir = path.resolve(import.meta.dirname, "css");
\tif (!fs.existsSync(cssDir)) return;
\tconst files = fs.readdirSync(cssDir).filter((f) => f.endsWith(".css")).sort();
\tif (!files.length) return;
\tconst header = "/* Auto-generated from css/ — do not edit directly */\\n\\n";
\tconst parts = files.map((f) => fs.readFileSync(path.join(cssDir, f), "utf-8"));
\tfs.writeFileSync(path.resolve(import.meta.dirname, "styles.css"), header + parts.join("\\n"), "utf-8");
};

const syncAssets = () => {
\tconcatCSS();
\tfor (const file of ["manifest.json", "styles.css"]) {
\t\tconst src = path.resolve(import.meta.dirname, file);
\t\tif (fs.existsSync(src)) {
\t\t\tfs.mkdirSync(OUTDIR, { recursive: true });
\t\t\tfs.copyFileSync(src, path.join(OUTDIR, file));
\t\t}
\t}
};

const run = async () => {
\tfs.mkdirSync(OUTDIR, { recursive: true });

\tconst ctx = await esbuild.context({
\t\tentryPoints: ["src/main.ts"],
\t\tbundle: true,
\t\toutdir: OUTDIR,
\t\tformat: "cjs",
\t\ttarget: "node16",
\t\tplatform: "node",
\t\tsourcemap: prod ? false : "inline",
\t\texternal: ["obsidian", "electron", ...builtinModules.flatMap((m) => [m, \`node:\${m}\`])],
\t\ttreeShaking: true,
\t\tminify: prod,
\t\tlogLevel: "info",
\t});

\tsyncAssets();

\tif (isWatch) {
\t\tawait ctx.watch();
\t\tconsole.log("[build] Watching...", OUTDIR);
\t\treturn;
\t}

\tawait ctx.rebuild();
\tawait ctx.dispose();
\tconsole.log("[build] Done.", OUTDIR);
};

run().catch((err) => { console.error(err); process.exit(1); });
`;
}

function pluginMainTemplate(pluginName) {
	return `import { Plugin } from "obsidian";

export default class ${toPascal(pluginName)}Plugin extends Plugin {

\tasync onload(): Promise<void> {
\t\tconsole.log(\`[${pluginName}] loaded\`);
\t}

\tasync onunload(): Promise<void> {
\t\tconsole.log(\`[${pluginName}] unloaded\`);
\t}
}
`;
}

function pluginGitignoreTemplate() {
	return `node_modules/
dist/
main.js
styles.css
*.js.map
`;
}

// ── Make menu ────────────────────────────────────────────────────────

async function makeMenu() {
	// eslint-disable-next-line no-constant-condition
	while (true) {
		printHeader("Make");
		printMenu([
			{ key: "1", label: "New Hub (within Flowti)" },
			{ key: "2", label: "New Plugin (standalone Obsidian plugin)" },
			{ separator: true },
			{ key: "?", label: "Help" },
			{ key: "b", label: "Back" },
			{ key: "q", label: "Quit" },
		]);

		const rl = createRL();
		const choice = await ask(rl, "Choice", "1");
		rl.close();

		switch (choice.toLowerCase()) {
			case "1":
				await makeHub();
				break;
			case "2":
				await makePlugin();
				break;
			case "?":
				showHelp("make");
				break;
			case "b":
				return "main";
			case "q":
				return "quit";
			default:
				console.log("\n  Invalid choice — try again.\n");
		}
	}
}

async function makeHub() {
	printHeader("New Hub");
	const paths = getMakePaths();

	const rl = createRL();
	const name = await ask(rl, "Hub name (e.g., Inventory)");
	if (!name) { rl.close(); return; }

	const kebab = toKebab(name);
	const pascal = toPascal(name);

	const icon = await ask(rl, "Lucide icon", "layout-grid");
	const hubType = await ask(rl, "Hub type (system/domain/user)", "domain");
	const tabsRaw = await ask(rl, "Initial tabs (comma-separated)", "overview,items");
	rl.close();

	const tabs = tabsRaw.split(",").map((t) => t.trim()).filter(Boolean);

	console.log();
	console.log(`  ${BOLD}Scaffolding: ${pascal} Hub${RESET}`);
	console.log(`  ${DIM}ID: ${kebab} | Icon: ${icon} | Type: ${hubType} | Tabs: ${tabs.join(", ")}${RESET}`);
	console.log();

	// Confirm output paths
	console.log(`  ${DIM}Output paths (from flowti.config.json):${RESET}`);
	console.log(`    UI:       ${paths.ui}/${kebab}/`);
	console.log(`    Domain:   ${paths.domain}/${kebab}/`);
	console.log(`    Provider: ${paths.hubDomain}/`);
	console.log(`    Tests:    ${paths.tests}/${kebab}/`);
	console.log(`    CSS:      ${paths.css}/`);
	console.log(`    Docs:     ${paths.docs}/${pascal}/`);
	console.log(`    Journey:  ${paths.journeys}/`);
	console.log();

	const confirmRl = createRL();
	const proceed = await ask(confirmRl, "Create files? (Y/n)", "Y");
	confirmRl.close();
	if (proceed.toLowerCase() === "n") return;

	console.log();
	let created = 0;

	// UI view + types
	if (writeFile(`${paths.ui}/${kebab}/${pascal}HubView.ts`, hubViewTemplate(pascal, kebab, hubType, icon, tabs))) created++;
	if (writeFile(`${paths.ui}/${kebab}/types.ts`, hubTypesTemplate(pascal, tabs))) created++;

	// Domain events + service
	if (writeFile(`${paths.domain}/${kebab}/events.ts`, hubEventsTemplate(pascal))) created++;
	if (writeFile(`${paths.domain}/${kebab}/${pascal}Service.ts`, hubServiceTemplate(pascal))) created++;

	// Hub provider
	if (writeFile(`${paths.hubDomain}/${pascal}HubProvider.ts`, hubProviderTemplate(pascal, kebab, icon))) created++;

	// Tests
	if (writeFile(`${paths.tests}/${kebab}/${pascal}HubView.test.ts`, hubTestTemplate(pascal, kebab))) created++;

	// CSS — find next available number
	const cssFiles = fs.existsSync(path.join(ROOT, paths.css))
		? fs.readdirSync(path.join(ROOT, paths.css)).filter((f) => f.endsWith(".css")).sort()
		: [];
	const maxNum = cssFiles.reduce((max, f) => {
		const m = f.match(/^(\d+)/);
		return m ? Math.max(max, parseInt(m[1], 10)) : max;
	}, 0);
	const cssNum = String(maxNum + 1).padStart(2, "0");
	if (writeFile(`${paths.css}/${cssNum}-${kebab}.css`, hubCssTemplate(pascal, kebab))) created++;

	// Feature PRD
	if (writeFile(`${paths.docs}/${pascal}/${pascal} Hub.md`, hubPrdTemplate(pascal))) created++;

	// Journey stub
	if (writeFile(`${paths.journeys}/${kebab}.journey.json`, hubJourneyTemplate(pascal, kebab))) created++;

	console.log(`\n  ${GREEN}✓${RESET} Created ${created} files for ${pascal} Hub.\n`);

	// Show next steps
	console.log(`  ${BOLD}Next steps:${RESET}`);
	console.log(`    1. Add VIEW_TYPE constant to ${DIM}src/domain/hub/types.ts${RESET}:`);
	console.log(`       ${CYAN}export const VIEW_TYPE_${pascal.toUpperCase()}_HUB = "flowti-${kebab}-hub";${RESET}`);
	console.log(`    2. Register view in ${DIM}src/main.ts${RESET} → onLayoutReady():`);
	console.log(`       ${CYAN}this.safeRegisterView(VIEW_TYPE_${pascal.toUpperCase()}_HUB, (leaf) =>${RESET}`);
	console.log(`       ${CYAN}  new ${pascal}HubView(leaf, this.eventBus));${RESET}`);
	console.log(`    3. Register provider in ${DIM}src/main.ts${RESET} → setupHubRegistry():`);
	console.log(`       ${CYAN}this.hubRegistry.register(new ${pascal}HubProvider());${RESET}`);
	console.log(`    4. Add ${pascal}EventMap to ${DIM}src/infrastructure/events/events.ts${RESET}`);
	console.log(`    5. Add ribbon icon for the hub`);
	console.log();
}

async function makePlugin() {
	printHeader("New Plugin");

	const outputBase = config.make?.plugin?.output ?? "../";

	const rl = createRL();
	const name = await ask(rl, "Plugin name (e.g., My Plugin)");
	if (!name) { rl.close(); return; }

	const defaultId = toKebab(name);
	const pluginId = await ask(rl, "Plugin ID", defaultId);
	const author = await ask(rl, "Author", manifest.author ?? "");
	const outputDir = await ask(rl, "Output folder", outputBase);
	rl.close();

	const pluginRoot = path.join(outputDir, pluginId);
	const absRoot = path.resolve(ROOT, pluginRoot);

	console.log();
	console.log(`  ${BOLD}Scaffolding: ${name}${RESET}`);
	console.log(`  ${DIM}ID: ${pluginId} | Author: ${author}${RESET}`);
	console.log(`  ${DIM}Output: ${absRoot}${RESET}`);
	console.log();

	if (fs.existsSync(absRoot)) {
		console.log(`  ${RED}Folder already exists: ${absRoot}${RESET}\n`);
		return;
	}

	const confirmRl = createRL();
	const proceed = await ask(confirmRl, "Create plugin? (Y/n)", "Y");
	confirmRl.close();
	if (proceed.toLowerCase() === "n") return;

	console.log();
	let created = 0;

	const w = (rel, content) => {
		if (writeFile(path.join(pluginRoot, rel), content)) created++;
	};

	// Root config files
	w("manifest.json", pluginManifestTemplate(name, pluginId, author));
	w("package.json", pluginPackageTemplate(name, pluginId));
	w("tsconfig.json", pluginTsconfigTemplate());
	w("esbuild.config.mjs", pluginEsbuildTemplate(pluginId));
	w(".gitignore", pluginGitignoreTemplate());

	// Source structure
	w("src/main.ts", pluginMainTemplate(name));

	// CSS
	w("css/00-base.css", `/* ── Base styles for ${name} ── */\n`);

	// Empty folders (with .gitkeep)
	w("src/infrastructure/events/.gitkeep", "");
	w("src/domain/.gitkeep", "");
	w("src/ui/.gitkeep", "");
	w("tests/.gitkeep", "");

	console.log(`\n  ${GREEN}✓${RESET} Created ${created} files for ${name}.\n`);

	console.log(`  ${BOLD}Next steps:${RESET}`);
	console.log(`    1. ${CYAN}cd ${absRoot}${RESET}`);
	console.log(`    2. ${CYAN}npm install${RESET}`);
	console.log(`    3. ${CYAN}npm run build:dev${RESET}`);
	console.log(`    4. Open the vault containing this plugin in Obsidian`);
	console.log();
}

// ══════════════════════════════════════════════════════════════════════
// Build menu
// ══════════════════════════════════════════════════════════════════════

async function buildMenu() {
	// eslint-disable-next-line no-constant-condition
	while (true) {
		printHeader("Build");
		printMenu([
			{ key: "1", label: "Build (fast — no tests, no reports)" },
			{ key: "2", label: "Build increment (check → build → test → reports → distribute)" },
			{ key: "3", label: "Build full (flow tests → build → reports)" },
			{ key: "4", label: "Watch mode (live rebuild on save)" },
			{ key: "5", label: "Distribute (copy to endpoint vaults)" },
			{ separator: true },
			{ key: "?", label: "Help" },
			{ key: "b", label: "Back" },
			{ key: "q", label: "Quit" },
		]);

		const rl = createRL();
		const choice = await ask(rl, "Choice", "1");
		rl.close();

		switch (choice.toLowerCase()) {
			case "1":
				run("node esbuild.config.mjs --production --no-reports", "Building (fast)...");
				break;
			case "2":
				run("npm run build:increment", "Building increment (full pipeline)...");
				break;
			case "3":
				run("npm run build:full", "Building full (flow tests + reports)...");
				break;
			case "4": {
				const rlReload = createRL();
				const reload = await ask(rlReload, "Auto-reload plugin on save? (y/N)", "N");
				rlReload.close();
				const reloadFlag = reload.toLowerCase() === "y" ? " --reload" : "";
				console.log(`\n  ${CYAN}▸${RESET} Starting watch mode...${reloadFlag ? ` ${DIM}(with auto-reload)${RESET}` : ""}\n`);
				console.log(`  ${DIM}Press Ctrl+C to stop.${RESET}\n`);
				run(`node esbuild.config.mjs --watch${reloadFlag}`, "Watch mode");
				break;
			}
			case "5":
				run("node esbuild.config.mjs --production --no-reports --distribution", "Distributing build...");
				break;
			case "?":
				showHelp("build");
				break;
			case "b":
				return "main";
			case "q":
				return "quit";
			default:
				console.log("\n  Invalid choice — try again.\n");
		}
	}
}

// ══════════════════════════════════════════════════════════════════════
// Review menu
// ══════════════════════════════════════════════════════════════════════

async function reviewMenu() {
	let incrementPassed = false;

	// eslint-disable-next-line no-constant-condition
	while (true) {
		printHeader("Review");
		printMenu([
			{ key: "1", label: "Start test session (interactive E2E)" },
			{ key: "2", label: "Build the increment" },
			{ key: "3", label: "Publish the increment", disabled: !incrementPassed },
			{ key: "4", label: "Teardown test vault" },
			{ key: "5", label: "Rebuild (teardown → prerequisites → installer)" },
			{ separator: true },
			{ key: "?", label: "Help" },
			{ key: "b", label: "Back" },
			{ key: "q", label: "Quit" },
		]);

		const rl = createRL();
		const choice = await ask(rl, "Choice", "1");
		rl.close();

		switch (choice.toLowerCase()) {
			case "1":
				run("node scripts/run-e2e.mjs --list", "Starting interactive E2E session...");
				break;
			case "2": {
				const code = run("npm run build:increment", "Building increment...");
				if (code === 0) incrementPassed = true;
				break;
			}
			case "3": {
				if (!incrementPassed) {
					console.log(`\n  ${YELLOW}Cannot publish — run a successful increment build first (option 2).${RESET}\n`);
					break;
				}
				run("npm run build:release", "Publishing...");
				break;
			}
			case "4": {
				const teardownRl = createRL();
				console.log(`\n  ${YELLOW}This will reset the test vault to a fresh state.${RESET}`);
				const confirm = await ask(teardownRl, "Continue? (y/N)", "N");
				teardownRl.close();
				if (confirm.toLowerCase() === "y") {
					run("node scripts/run-e2e.mjs --teardown", "Tearing down test vault...");
				}
				break;
			}
			case "5": {
				const rebuildRl = createRL();
				console.log(`\n  ${YELLOW}This will teardown and rebuild the test vault from scratch.${RESET}`);
				const confirm = await ask(rebuildRl, "Continue? (y/N)", "N");
				rebuildRl.close();
				if (confirm.toLowerCase() === "y") {
					run("node scripts/run-e2e.mjs --rebuild", "Rebuilding test vault...");
				}
				break;
			}
			case "?":
				showHelp("review");
				break;
			case "b":
				return "main";
			case "q":
				return "quit";
			default:
				console.log("\n  Invalid choice — try again.\n");
		}
	}
}

// ══════════════════════════════════════════════════════════════════════
// Publish menu
// ══════════════════════════════════════════════════════════════════════

async function publishMenu() {
	let buildPassed = false;
	let testPassed = false;

	// eslint-disable-next-line no-constant-condition
	while (true) {
		printHeader("Publish");

		const buildIcon = buildPassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		const testIcon = testPassed ? `${GREEN}✓${RESET}` : `${DIM}○${RESET}`;
		const publishIcon = `${DIM}○${RESET}`;

		console.log(`    ${DIM}Pipeline:${RESET}  ${buildIcon} Build  →  ${testIcon} Test  →  ${publishIcon} Publish\n`);

		printMenu([
			{ key: "1", label: "Build the increment (check → build → test → reports)" },
			{ key: "2", label: "Test the increment (E2E)", disabled: !buildPassed },
			{ key: "3", label: "Publish the increment", disabled: !testPassed },
			{ key: "a", label: "Run all (build → test → publish)" },
			{ separator: true },
			{ key: "?", label: "Help" },
			{ key: "b", label: "Back" },
			{ key: "q", label: "Quit" },
		]);

		const rl = createRL();
		const choice = await ask(rl, "Choice", "1");
		rl.close();

		switch (choice.toLowerCase()) {
			case "1": {
				const code = run("npm run build:increment", "Building increment...");
				buildPassed = code === 0;
				if (!buildPassed) testPassed = false;
				break;
			}
			case "2": {
				if (!buildPassed) {
					console.log(`\n  ${YELLOW}Build first (option 1).${RESET}\n`);
					break;
				}
				const code = run("npm run test:e2e", "Running E2E tests...");
				testPassed = code === 0;
				break;
			}
			case "3": {
				if (!testPassed) {
					console.log(`\n  ${YELLOW}Build and test first.${RESET}\n`);
					break;
				}
				run("npm run build:release", "Publishing...");
				break;
			}
			case "a": {
				console.log(`\n  ${CYAN}▸${RESET} Running full publish pipeline...\n`);
				const buildCode = run("npm run build:increment", "Step 1/3: Building increment...");
				buildPassed = buildCode === 0;
				if (!buildPassed) {
					console.log(`  ${RED}Pipeline stopped — build failed.${RESET}\n`);
					testPassed = false;
					break;
				}
				const testCode = run("npm run test:e2e", "Step 2/3: Running E2E tests...");
				testPassed = testCode === 0;
				if (!testPassed) {
					console.log(`  ${RED}Pipeline stopped — tests failed.${RESET}\n`);
					break;
				}
				run("npm run build:release", "Step 3/3: Publishing...");
				break;
			}
			case "?":
				showHelp("publish");
				break;
			case "b":
				return "main";
			case "q":
				return "quit";
			default:
				console.log("\n  Invalid choice — try again.\n");
		}
	}
}

// ══════════════════════════════════════════════════════════════════════
// Reports menu
// ══════════════════════════════════════════════════════════════════════

function getReportScripts() {
	return config.reports?.scripts ?? [];
}

async function reportsMenu() {
	// eslint-disable-next-line no-constant-condition
	while (true) {
		printHeader("Reports");
		printMenu([
			{ key: "1", label: "Build all reports" },
			{ key: "2", label: "Build selected report" },
			{ key: "3", label: "Build audit report" },
			{ separator: true },
			{ key: "?", label: "Help" },
			{ key: "b", label: "Back" },
			{ key: "q", label: "Quit" },
		]);

		const rl = createRL();
		const choice = await ask(rl, "Choice", "1");
		rl.close();

		switch (choice.toLowerCase()) {
			case "1":
				run("npm run generate:reports", "Generating all reports...");
				break;
			case "2":
				await selectReportMenu();
				break;
			case "3":
				await auditMenu();
				break;
			case "?":
				showHelp("reports");
				break;
			case "b":
				return "main";
			case "q":
				return "quit";
			default:
				console.log("\n  Invalid choice — try again.\n");
		}
	}
}

async function selectReportMenu() {
	const scripts = getReportScripts();
	if (!scripts.length) {
		console.log(`\n  ${YELLOW}No report scripts configured in flowti.config.json.${RESET}\n`);
		return;
	}

	printHeader("Select Report");
	for (let i = 0; i < scripts.length; i++) {
		const num = String(i + 1).padStart(2, " ");
		console.log(`    ${num}) ${scripts[i].label}`);
	}
	console.log();
	console.log(`     ${DIM}a) All reports${RESET}`);
	console.log(`     ${DIM}b) Back${RESET}`);
	console.log();

	const rl = createRL();
	const choice = await ask(rl, "Choice", "b");
	rl.close();

	if (choice.toLowerCase() === "b") return;
	if (choice.toLowerCase() === "a") {
		run("npm run generate:reports", "Generating all reports...");
		return;
	}

	const idx = parseInt(choice, 10) - 1;
	if (idx >= 0 && idx < scripts.length) {
		const script = scripts[idx];
		const scriptPath = path.join(ROOT, "scripts", script.script);
		if (!fs.existsSync(scriptPath)) {
			console.log(`\n  ${RED}Script not found: ${script.script}${RESET}\n`);
			return;
		}
		run(`node scripts/${script.script}`, `Generating ${script.label}...`);
	} else {
		console.log("\n  Invalid choice.\n");
	}
}

async function auditMenu() {
	const rl = createRL();
	const defaultName = new Date().toISOString().slice(0, 10) + "-audit";
	const auditName = await ask(rl, "Audit name", defaultName);
	rl.close();

	console.log(`\n  ${CYAN}▸${RESET} Generating audit: ${auditName}\n`);

	const reportsDir = path.join(ROOT, "docs", "reports");
	const auditDir = path.join(reportsDir, "audits");

	try { fs.mkdirSync(auditDir, { recursive: true }); } catch { /* ignore */ }

	const sections = [];
	const reportCategories = [
		{ dir: "builds", label: "Build" },
		{ dir: "tests", label: "Unit Tests" },
		{ dir: "coverage", label: "Coverage" },
		{ dir: "performance", label: "Performance" },
		{ dir: "cycles", label: "Cycle" },
		{ dir: "complexity", label: "Complexity" },
	];

	for (const cat of reportCategories) {
		const catDir = path.join(reportsDir, cat.dir);
		const latest = findLatestReport(catDir);
		if (latest) {
			const fm = parseFrontmatter(latest);
			sections.push({ label: cat.label, data: fm, file: path.basename(latest) });
		}
	}

	const stableReports = [
		{ file: "traceability/Trace Conformance Report.md", label: "Traceability" },
		{ file: "e2e/E2E Report.md", label: "E2E Tests" },
	];

	for (const sr of stableReports) {
		const filePath = path.join(reportsDir, sr.file);
		if (fs.existsSync(filePath)) {
			const fm = parseFrontmatter(filePath);
			sections.push({ label: sr.label, data: fm, file: sr.file });
		}
	}

	const now = new Date();
	const lines = [
		"---",
		"type: Audit",
		`name: "${auditName}"`,
		`date: "${now.toISOString()}"`,
		"tags:",
		"  - audit",
		"  - review",
		"---",
		"",
		`# Audit: ${auditName}`,
		"",
		`> Generated: ${now.toISOString().slice(0, 16).replace("T", " ")}`,
		"",
	];

	for (const section of sections) {
		lines.push(`## ${section.label}`);
		lines.push("");
		lines.push(`> Source: ${section.file}`);
		lines.push("");
		if (section.data && Object.keys(section.data).length > 0) {
			lines.push("| Metric | Value |");
			lines.push("|---|---|");
			for (const [key, value] of Object.entries(section.data)) {
				if (key === "tags" || key === "type") continue;
				lines.push(`| ${key} | ${value} |`);
			}
		} else {
			lines.push("*No data available.*");
		}
		lines.push("");
	}

	const auditPath = path.join(auditDir, `${auditName}.md`);
	fs.writeFileSync(auditPath, lines.join("\n"), "utf-8");
	console.log(`  ${GREEN}✓${RESET} Audit written to: ${path.relative(ROOT, auditPath)}\n`);
}

// ══════════════════════════════════════════════════════════════════════
// Dev Tools menu
// ══════════════════════════════════════════════════════════════════════

async function devToolsMenu() {
	// eslint-disable-next-line no-constant-condition
	while (true) {
		printHeader("Dev Tools");
		printMenu([
			{ key: "1", label: "Reload plugin" },
			{ key: "2", label: "Dev console (Obsidian)" },
			{ key: "3", label: "Dev errors (Obsidian)" },
			{ key: "4", label: "Fix frontmatter (ADR-030)" },
			{ key: "5", label: "Generate test data (Analytics CSVs)" },
			{ key: "6", label: "Type check (lint + tsc)" },
			{ key: "7", label: "Lint (ESLint only)" },
			{ separator: true },
			{ key: "?", label: "Help" },
			{ key: "b", label: "Back" },
			{ key: "q", label: "Quit" },
		]);

		const rl = createRL();
		const choice = await ask(rl, "Choice", "1");
		rl.close();

		switch (choice.toLowerCase()) {
			case "1":
				run("node scripts/cli-reload.mjs", "Reloading plugin...");
				break;
			case "2":
				console.log(`\n  ${DIM}Press Ctrl+C to stop the console stream.${RESET}\n`);
				run("obsidian dev:console", "Opening dev console...");
				break;
			case "3":
				console.log(`\n  ${DIM}Press Ctrl+C to stop the error stream.${RESET}\n`);
				run("obsidian dev:errors", "Opening error stream...");
				break;
			case "4": {
				// Run dry-run first, then ask to apply
				console.log(`\n  ${CYAN}▸${RESET} Running frontmatter check (dry-run)...\n`);
				run("node scripts/fix-frontmatter.mjs --dry-run", "Scanning docs/ for frontmatter issues...");
				const applyRl = createRL();
				const apply = await ask(applyRl, "Apply fixes? (y/N)", "N");
				applyRl.close();
				if (apply.toLowerCase() === "y") {
					run("node scripts/fix-frontmatter.mjs", "Fixing frontmatter...");
				}
				break;
			}
			case "5":
				run("node scripts/generate-test-data.mjs", "Generating test data CSVs...");
				break;
			case "6":
				run("npm run check", "Running lint + tsc...");
				break;
			case "7":
				run("npm run lint", "Running ESLint...");
				break;
			case "?":
				showHelp("devtools");
				break;
			case "b":
				return "main";
			case "q":
				return "quit";
			default:
				console.log("\n  Invalid choice — try again.\n");
		}
	}
}

// ══════════════════════════════════════════════════════════════════════
// Info
// ══════════════════════════════════════════════════════════════════════

function countFiles(dir, ext) {
	let count = 0;
	try {
		const walk = (d) => {
			for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
				if (entry.name === "node_modules" || entry.name === ".git") continue;
				const full = path.join(d, entry.name);
				if (entry.isDirectory()) walk(full);
				else if (entry.isFile() && full.endsWith(ext)) count++;
			}
		};
		walk(dir);
	} catch { /* ignore */ }
	return count;
}

function showInfo() {
	printHeader("Info");

	// Plugin info
	console.log(`  ${BOLD}Plugin${RESET}`);
	console.log(`    Name:          ${manifest.name ?? "?"}`);
	console.log(`    ID:            ${manifest.id ?? "?"}`);
	console.log(`    Version:       ${manifest.version ?? "?"}`);
	console.log(`    Min Obsidian:  ${manifest.minAppVersion ?? "?"}`);
	console.log(`    Author:        ${manifest.author ?? "?"}`);
	console.log();

	// Source stats
	const srcDir = path.join(ROOT, "src");
	const testsDir = path.join(ROOT, "tests");
	const srcCount = countFiles(srcDir, ".ts");
	const testCount = countFiles(testsDir, ".ts");
	const cssDir = path.join(ROOT, "css");
	const cssCount = countFiles(cssDir, ".css");
	const scriptCount = fs.readdirSync(path.join(ROOT, "scripts")).filter((f) => f.endsWith(".mjs")).length;

	console.log(`  ${BOLD}Source${RESET}`);
	console.log(`    Source files:   ${srcCount} .ts files`);
	console.log(`    Test files:     ${testCount} .ts files`);
	console.log(`    CSS layers:     ${cssCount} files`);
	console.log(`    Scripts:        ${scriptCount} .mjs files`);
	console.log();

	// Dependencies
	const devDeps = Object.keys(pkg.devDependencies ?? {}).length;
	const prodDeps = Object.keys(pkg.dependencies ?? {}).length;
	const npmScripts = Object.keys(pkg.scripts ?? {}).length;

	console.log(`  ${BOLD}Dependencies${RESET}`);
	console.log(`    Production:     ${prodDeps}`);
	console.log(`    Development:    ${devDeps}`);
	console.log(`    npm scripts:    ${npmScripts}`);
	console.log();

	// Git
	const branch = runSilent("git rev-parse --abbrev-ref HEAD");
	const commit = runSilent("git rev-parse --short HEAD");
	const dirty = runSilent("git status --porcelain");

	console.log(`  ${BOLD}Git${RESET}`);
	console.log(`    Branch:         ${branch ?? "?"}`);
	console.log(`    Commit:         ${commit ?? "?"}`);
	console.log(`    Status:         ${dirty ? `${YELLOW}dirty${RESET}` : `${GREEN}clean${RESET}`}`);
	console.log();

	// Config
	const reportCount = getReportScripts().length;
	const endpointsFile = config.paths?.endpointsFile ?? "build-endpoints.json";
	const endpointsExist = fs.existsSync(path.join(ROOT, endpointsFile));

	console.log(`  ${BOLD}Config${RESET}`);
	console.log(`    Reports:        ${reportCount} generators configured`);
	console.log(`    Endpoints:      ${endpointsExist ? `${GREEN}found${RESET} (${endpointsFile})` : `${DIM}not found${RESET}`}`);
	console.log(`    Config file:    ${fs.existsSync(CONFIG_PATH) ? `${GREEN}found${RESET}` : `${YELLOW}missing${RESET}`}`);
	console.log();
}

// ══════════════════════════════════════════════════════════════════════
// Report helpers
// ══════════════════════════════════════════════════════════════════════

function findLatestReport(dir) {
	if (!fs.existsSync(dir)) return null;
	const files = fs.readdirSync(dir)
		.filter((f) => f.endsWith(".md") && !f.startsWith("."))
		.sort()
		.reverse();
	return files.length > 0 ? path.join(dir, files[0]) : null;
}

function parseFrontmatter(filePath) {
	try {
		const content = fs.readFileSync(filePath, "utf-8");
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (!match) return {};

		const result = {};
		for (const line of match[1].split("\n")) {
			const colonIdx = line.indexOf(":");
			if (colonIdx === -1 || line.startsWith("#") || line.startsWith("  -")) continue;
			const key = line.substring(0, colonIdx).trim();
			let value = line.substring(colonIdx + 1).trim();
			if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
			result[key] = value;
		}
		return result;
	} catch {
		return {};
	}
}

// ══════════════════════════════════════════════════════════════════════
// CLI argument handling (non-interactive mode)
// ══════════════════════════════════════════════════════════════════════

function parseArgs(args) {
	const result = { command: null, flags: {} };
	for (const arg of args) {
		if (arg.startsWith("--")) {
			const eq = arg.indexOf("=");
			if (eq !== -1) {
				result.flags[arg.substring(2, eq)] = arg.substring(eq + 1);
			} else {
				result.flags[arg.substring(2)] = true;
			}
		} else if (!result.command) {
			result.command = arg;
		}
	}
	return result;
}

/** Non-interactive command dispatch. Returns true if handled. */
async function handleCliArgs() {
	const args = process.argv.slice(2);
	if (!args.length) return false;

	const { command, flags } = parseArgs(args);

	// ── Help ─────────────────────────────────────────────────────
	if (command === "help") {
		showHelp(Object.keys(flags)[0] ?? args[1] ?? "main");
		return true;
	}

	// ── Build commands ───────────────────────────────────────────
	if (command === "build") {
		run("node esbuild.config.mjs --production --no-reports", "Building (fast)...");
		return true;
	}
	if (command === "build:increment") {
		run("npm run build:increment", "Building increment (full pipeline)...");
		return true;
	}
	if (command === "build:full") {
		run("npm run build:full", "Building full (flow tests + reports)...");
		return true;
	}
	if (command === "build:watch") {
		const reloadFlag = flags.reload ? " --reload" : "";
		run(`node esbuild.config.mjs --watch${reloadFlag}`, "Watch mode...");
		return true;
	}
	if (command === "build:distribute") {
		run("node esbuild.config.mjs --production --no-reports --distribution", "Distributing build...");
		return true;
	}

	// ── Test commands ────────────────────────────────────────────
	if (command === "test") {
		run("npm run check && vitest run", "Running tests...");
		return true;
	}
	if (command === "test:increment") {
		run("npm run test:increment", "Running increment tests...");
		return true;
	}
	if (command === "test:e2e") {
		run("npm run test:e2e", "Running E2E tests...");
		return true;
	}

	// ── Review commands ──────────────────────────────────────────
	if (command === "review") {
		run("node scripts/run-e2e.mjs --list", "Starting interactive E2E session...");
		return true;
	}

	// ── Publish commands ─────────────────────────────────────────
	if (command === "publish") {
		run("npm run build:release", "Publishing...");
		return true;
	}
	if (command === "publish:all") {
		const b = run("npm run build:increment", "Step 1/3: Building increment...");
		if (b !== 0) process.exit(b);
		const t = run("npm run test:e2e", "Step 2/3: Running E2E tests...");
		if (t !== 0) process.exit(t);
		run("npm run build:release", "Step 3/3: Publishing...");
		return true;
	}

	// ── Report commands ──────────────────────────────────────────
	if (command === "reports") {
		run("npm run generate:reports", "Generating all reports...");
		return true;
	}
	if (command === "reports:audit") {
		// For simplicity in non-interactive mode, just run all reports
		run("npm run generate:reports", "Generating reports for audit...");
		console.log(`  ${GREEN}✓${RESET} Reports generated. Use interactive mode for full audit.\n`);
		return true;
	}
	if (command?.startsWith("report:")) {
		const reportId = command.substring("report:".length);
		const scripts = getReportScripts();
		const script = scripts.find((s) => s.id === reportId);
		if (script) {
			run(`node scripts/${script.script}`, `Generating ${script.label}...`);
		} else {
			console.log(`\n  ${RED}Unknown report: ${reportId}${RESET}`);
			console.log(`  ${DIM}Available: ${scripts.map((s) => s.id).join(", ")}${RESET}\n`);
		}
		return true;
	}

	// ── Dev tool commands ────────────────────────────────────────
	if (command === "dev:reload") {
		run("node scripts/cli-reload.mjs", "Reloading plugin...");
		return true;
	}
	if (command === "dev:console") {
		run("obsidian dev:console", "Opening dev console...");
		return true;
	}
	if (command === "dev:errors") {
		run("obsidian dev:errors", "Opening error stream...");
		return true;
	}
	if (command === "dev:check") {
		run("npm run check", "Running lint + tsc...");
		return true;
	}
	if (command === "dev:lint") {
		run("npm run lint", "Running ESLint...");
		return true;
	}
	if (command === "dev:fix-frontmatter") {
		const dryRun = flags["dry-run"] ? " --dry-run" : "";
		run(`node scripts/fix-frontmatter.mjs${dryRun}`, `Fixing frontmatter${dryRun ? " (dry-run)" : ""}...`);
		return true;
	}
	if (command === "dev:testdata") {
		run("node scripts/generate-test-data.mjs", "Generating test data CSVs...");
		return true;
	}

	// ── Make commands ────────────────────────────────────────────
	if (command === "make:hub") {
		const name = flags.name;
		if (!name) {
			console.log(`\n  ${RED}--name is required.${RESET}`);
			console.log(`  ${DIM}Usage: npm run flowti -- make:hub --name=Inventory [--icon=package] [--type=domain] [--tabs=overview,items]${RESET}\n`);
			process.exit(1);
		}
		const kebab = toKebab(name);
		const pascal = toPascal(name);
		const icon = flags.icon ?? "layout-grid";
		const hubType = flags.type ?? "domain";
		const tabs = (flags.tabs ?? "overview,items").split(",").map((t) => t.trim());
		const paths = getMakePaths();

		console.log(`\n  ${CYAN}▸${RESET} Scaffolding: ${pascal} Hub\n`);

		let created = 0;
		if (writeFile(`${paths.ui}/${kebab}/${pascal}HubView.ts`, hubViewTemplate(pascal, kebab, hubType, icon, tabs))) created++;
		if (writeFile(`${paths.ui}/${kebab}/types.ts`, hubTypesTemplate(pascal, tabs))) created++;
		if (writeFile(`${paths.domain}/${kebab}/events.ts`, hubEventsTemplate(pascal))) created++;
		if (writeFile(`${paths.domain}/${kebab}/${pascal}Service.ts`, hubServiceTemplate(pascal))) created++;
		if (writeFile(`${paths.hubDomain}/${pascal}HubProvider.ts`, hubProviderTemplate(pascal, kebab, icon))) created++;
		if (writeFile(`${paths.tests}/${kebab}/${pascal}HubView.test.ts`, hubTestTemplate(pascal, kebab))) created++;

		const cssFiles = fs.existsSync(path.join(ROOT, paths.css))
			? fs.readdirSync(path.join(ROOT, paths.css)).filter((f) => f.endsWith(".css")).sort() : [];
		const maxNum = cssFiles.reduce((max, f) => { const m = f.match(/^(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max; }, 0);
		if (writeFile(`${paths.css}/${String(maxNum + 1).padStart(2, "0")}-${kebab}.css`, hubCssTemplate(pascal, kebab))) created++;
		if (writeFile(`${paths.docs}/${pascal}/${pascal} Hub.md`, hubPrdTemplate(pascal))) created++;
		if (writeFile(`${paths.journeys}/${kebab}.journey.json`, hubJourneyTemplate(pascal, kebab))) created++;

		console.log(`\n  ${GREEN}✓${RESET} Created ${created} files.\n`);
		return true;
	}

	if (command === "make:plugin") {
		const name = flags.name;
		if (!name) {
			console.log(`\n  ${RED}--name is required.${RESET}`);
			console.log(`  ${DIM}Usage: npm run flowti -- make:plugin --name="My Plugin" [--id=my-plugin] [--author=Name] [--output=../]${RESET}\n`);
			process.exit(1);
		}
		const pluginId = flags.id ?? toKebab(name);
		const author = flags.author ?? manifest.author ?? "";
		const outputDir = flags.output ?? config.make?.plugin?.output ?? "../";
		const pluginRoot = path.join(outputDir, pluginId);
		const absRoot = path.resolve(ROOT, pluginRoot);

		if (fs.existsSync(absRoot)) {
			console.log(`\n  ${RED}Folder already exists: ${absRoot}${RESET}\n`);
			process.exit(1);
		}

		console.log(`\n  ${CYAN}▸${RESET} Scaffolding: ${name}\n`);

		let created = 0;
		const w = (rel, content) => { if (writeFile(path.join(pluginRoot, rel), content)) created++; };

		w("manifest.json", pluginManifestTemplate(name, pluginId, author));
		w("package.json", pluginPackageTemplate(name, pluginId));
		w("tsconfig.json", pluginTsconfigTemplate());
		w("esbuild.config.mjs", pluginEsbuildTemplate(pluginId));
		w(".gitignore", pluginGitignoreTemplate());
		w("src/main.ts", pluginMainTemplate(name));
		w("css/00-base.css", `/* ── Base styles for ${name} ── */\n`);
		w("src/infrastructure/events/.gitkeep", "");
		w("src/domain/.gitkeep", "");
		w("src/ui/.gitkeep", "");
		w("tests/.gitkeep", "");

		console.log(`\n  ${GREEN}✓${RESET} Created ${created} files at ${absRoot}\n`);
		return true;
	}

	// ── Info ─────────────────────────────────────────────────────
	if (command === "info") {
		showInfo();
		return true;
	}

	// ── Unknown ──────────────────────────────────────────────────
	console.log(`\n  ${YELLOW}Unknown command: ${command}${RESET}`);
	console.log(`  ${DIM}Run "npm run flowti -- help" for available commands.${RESET}\n`);
	return true;
}

// ══════════════════════════════════════════════════════════════════════
// Main loop
// ══════════════════════════════════════════════════════════════════════

async function main() {
	// Handle CLI args (e.g., "npm run flowti help build")
	if (handleCliArgs()) return;

	printBanner();

	// eslint-disable-next-line no-constant-condition
	while (true) {
		console.log(`  ${DIM}Main Menu${RESET}`);
		console.log();
		printMenu([
			{ key: "1", label: "Make" },
			{ key: "2", label: "Build" },
			{ key: "3", label: "Review" },
			{ key: "4", label: "Publish" },
			{ key: "5", label: "Reports" },
			{ key: "6", label: "Dev Tools" },
			{ key: "7", label: "Info" },
			{ separator: true },
			{ key: "?", label: "Help" },
			{ key: "q", label: "Quit" },
		]);

		const rl = createRL();
		const choice = await ask(rl, "Choice", "1");
		rl.close();

		let result;
		switch (choice.toLowerCase()) {
			case "1":
				result = await makeMenu();
				break;
			case "2":
				result = await buildMenu();
				break;
			case "3":
				result = await reviewMenu();
				break;
			case "4":
				result = await publishMenu();
				break;
			case "5":
				result = await reportsMenu();
				break;
			case "6":
				result = await devToolsMenu();
				break;
			case "7":
				showInfo();
				break;
			case "?":
				showHelp("main");
				break;
			case "q":
				result = "quit";
				break;
			default:
				console.log("\n  Invalid choice — try again.\n");
				continue;
		}

		if (result === "quit") {
			console.log(`\n  ${DIM}Goodbye.${RESET}\n`);
			process.exit(0);
		}
	}
}

main().catch((err) => {
	console.error(`\n  ${RED}Fatal error:${RESET}`, err);
	process.exit(1);
});
