/**
 * templates.mjs — Scaffolding templates for hub and plugin generation.
 */

import { toPascal, toCamel } from "./naming.mjs";
import { Document } from "../../infrastructure/document.mjs";

// ══════════════════════════════════════════════════════════════════════
// Hub templates
// ══════════════════════════════════════════════════════════════════════

export function hubViewTemplate(pascal, kebab, hubType, icon, tabs) {
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

export function hubTypesTemplate(pascal, tabs) {
	const pageType = `${pascal}HubPage`;
	return `/**
 * Type definitions for the ${pascal} Hub.
 */

export type ${pageType} = ${tabs.map((t) => `"${t}"`).join(" | ")};
`;
}

export function hubEventsTemplate(pascal) {
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

export function hubServiceTemplate(pascal) {
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

export function hubProviderTemplate(pascal, kebab, icon) {
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

export function hubTestTemplate(pascal, kebab) {
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

export function hubCssTemplate(pascal, kebab) {
	return `/* ── ${pascal} Hub ──────────────────────────────────────────── */

.ft-${kebab}-hub {
\t/* Add hub-specific styles here */
}
`;
}

export function hubPrdTemplate(pascal) {
	return Document.create(`${pascal} Hub`)
		.mergeFrontmatter({ type: "Feature", domain: pascal, stage: "draft", version: 1 })
		.setTags(["feature", pascal.toLowerCase()])
		.addBlank()
		.heading(1, `${pascal} Hub`)
		.addBlank()
		.heading(2, "Problem Statement")
		.addBlank()
		.text("Describe the problem this hub solves.")
		.addBlank()
		.heading(2, "Goals")
		.addBlank()
		.orderedList(["Goal one", "Goal two"])
		.addBlank()
		.heading(2, "Scope")
		.addBlank()
		.heading(3, "In Scope")
		.list(["Item one", "Item two"])
		.addBlank()
		.heading(3, "Out of Scope")
		.list(["Deferred item"])
		.addBlank()
		.heading(2, "Solution")
		.addBlank()
		.text("Describe the solution approach.")
		.addBlank()
		.heading(2, "Acceptance Criteria")
		.addBlank()
		.list(["[ ] Criterion one", "[ ] Criterion two"])
		.addBlank()
		.toString();
}

export function hubJourneyTemplate(pascal, kebab) {
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

// ══════════════════════════════════════════════════════════════════════
// Plugin templates
// ══════════════════════════════════════════════════════════════════════

export function pluginManifestTemplate(pluginName, pluginId, author) {
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

export function pluginPackageTemplate(pluginName, pluginId) {
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

export function pluginTsconfigTemplate() {
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

export function pluginEsbuildTemplate(pluginId) {
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

export function pluginMainTemplate(pluginName) {
	const pascal = toPascal(pluginName);
	return `import { Plugin } from "obsidian";

export default class ${pascal}Plugin extends Plugin {

\tasync onload(): Promise<void> {
\t\tconsole.log(\`[${pluginName}] loaded\`);
\t}

\tasync onunload(): Promise<void> {
\t\tconsole.log(\`[${pluginName}] unloaded\`);
\t}
}
`;
}

export function pluginGitignoreTemplate() {
	return `node_modules/
dist/
main.js
styles.css
*.js.map
`;
}
