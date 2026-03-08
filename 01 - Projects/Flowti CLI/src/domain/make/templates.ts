/**
 * templates.ts — Scaffolding templates for hub and plugin generation.
 */

import { toPascal, toCamel } from "./naming.js";
import { Document } from "../../infrastructure/document.js";
import { manifestTemplate, packageTemplate, tsconfigTemplate, esbuildTemplate, gitignoreTemplate } from "./template-service.js";

// ══════════════════════════════════════════════════════════════════════
// Hub templates
// ══════════════════════════════════════════════════════════════════════

export function hubViewTemplate(pascal: string, kebab: string, hubType: string, icon: string, tabs: string[]): string {
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

export function hubTypesTemplate(pascal: string, tabs: string[]): string {
	const pageType = `${pascal}HubPage`;
	return `/**
 * Type definitions for the ${pascal} Hub.
 */

export type ${pageType} = ${tabs.map((t) => `"${t}"`).join(" | ")};
`;
}

export function hubEventsTemplate(pascal: string): string {
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

export function hubServiceTemplate(pascal: string): string {
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

export function hubProviderTemplate(pascal: string, kebab: string, icon: string): string {
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

export function hubTestTemplate(pascal: string, kebab: string): string {
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

export function hubCssTemplate(pascal: string, kebab: string): string {
	return `/* ── ${pascal} Hub ──────────────────────────────────────────── */

.ft-${kebab}-hub {
\t/* Add hub-specific styles here */
}
`;
}

export function hubPrdTemplate(pascal: string): string {
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

export function hubJourneyTemplate(pascal: string, kebab: string): string {
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
// Journey template
// ══════════════════════════════════════════════════════════════════════

export function journeyDefinitionTemplate(name: string, kebab: string, description: string): string {
	return JSON.stringify({
		journey: name,
		chapter: 1,
		description,
		type: "functional",
		category: "general",
		tools: ["command", "wait", "screenshot", "assert"],
		lifecycle: {
			enablePlugin: true,
			checkInstalled: true,
			startTrace: true,
			openActivityLog: true,
		},
		steps: [
			{
				id: `${kebab}-01`,
				title: `Open ${name}`,
				guideSection: 1,
				description: `Navigate to the ${name} feature.`,
				actions: [
					{ tool: "command", id: `flowti:open-${kebab}` },
					{ tool: "wait", ms: 500 },
					{ tool: "screenshot" },
				],
			},
			{
				id: `${kebab}-02`,
				title: `Verify ${name} is displayed`,
				guideSection: 1,
				description: `Assert that the ${name} view loaded correctly.`,
				actions: [
					{ tool: "assert", type: "visible", selector: ".flowti-container" },
					{ tool: "screenshot" },
				],
			},
		],
	}, null, "\t") + "\n";
}

export function journeyTestTemplate(kebab: string): string {
	return `import { executeJourney } from "./helpers/journeyExecutor";
import type { JourneyDefinition } from "./helpers/journeyTypes";
import * as fs from "node:fs";
import * as path from "node:path";

const configPath = path.join(__dirname, "journeys", "${kebab}.journey");
const definition = JSON.parse(fs.readFileSync(configPath, "utf-8")) as JourneyDefinition;

executeJourney(definition);
`;
}

export function journeyCanvasTemplate(name: string): string {
	return JSON.stringify({
		nodes: [
			{
				id: "title",
				type: "text",
				text: `# ${name} Journey`,
				x: 0,
				y: 0,
				width: 400,
				height: 100,
			},
		],
		edges: [],
	}, null, "\t") + "\n";
}

// ══════════════════════════════════════════════════════════════════════
// Plugin templates
// ══════════════════════════════════════════════════════════════════════

export function pluginManifestTemplate(pluginName: string, pluginId: string, author: string): string {
	return manifestTemplate({ id: pluginId, name: pluginName, author });
}

export function pluginPackageTemplate(pluginName: string, pluginId: string): string {
	return packageTemplate("plugin", pluginName, pluginId);
}

export function pluginTsconfigTemplate(): string {
	return tsconfigTemplate("plugin");
}

export function pluginEsbuildTemplate(pluginId: string): string {
	return esbuildTemplate(pluginId);
}

export function pluginMainTemplate(pluginName: string): string {
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

export function pluginGitignoreTemplate(): string {
	return gitignoreTemplate("plugin");
}
