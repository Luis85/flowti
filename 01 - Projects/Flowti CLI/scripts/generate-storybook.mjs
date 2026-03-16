/**
 * generate-storybook.mjs
 *
 * Reads configs/sitemap.json and generates one .stories.ts file per page
 * into components/pages/.
 *
 * Usage: node scripts/generate-storybook.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Constants ─────────────────────────────────────────────────────────────────

const PATTERN_MAP = {
	// Dashboard
	"start": "dashboard", "project-detail": "dashboard", "agent-detail": "dashboard",
	"devtools": "dashboard", "knowledgebase": "dashboard", "make": "dashboard",
	"plugins": "dashboard", "publish": "dashboard", "reports": "dashboard", "review": "dashboard",
	// List
	"ai-tools": "list", "iterations": "list", "resources": "list", "timelog": "list",
	"deliverables": "list", "raid": "list", "capa": "list", "lifecycle": "list",
	"requirements": "list", "event-catalog": "list", "components": "list",
	"workspaces": "list", "onboarding-tour": "list", "onboarding-checklist": "list",
	// Everything else → simple
};

const LABEL_OVERRIDES = {
	"management": "Management",
	"ai-tools": "AI Tools",
	"agents-chat": "Agents Chat",
	"agents-dashboard": "Agents Dashboard",
	"onboarding-checklist": "Onboarding Checklist",
	"reports": "Reports",
	"docs": "Docs",
};

const TOKEN_MOCKS = {
	"{{project.name}}": "Flowti CLI",
	"{{params.agentName}}": "Software Architect",
	"{{params.componentName}}": "StatCard",
	"{{params.number}}": "5",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Replace all TOKEN_MOCKS placeholders in a string.
 * @param {string} str
 * @returns {string}
 */
function replaceTokens(str) {
	if (!str) return str;
	let result = str;
	for (const [token, value] of Object.entries(TOKEN_MOCKS)) {
		result = result.split(token).join(value);
	}
	return result;
}

/**
 * Escape double quotes and backslashes for use inside a double-quoted string.
 * @param {string} str
 * @returns {string}
 */
function escapeString(str) {
	if (!str) return str;
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Convert kebab-case to PascalCase for Storybook titles.
 * @param {string} str
 * @returns {string}
 */
function toPascalCase(str) {
	return str
		.split("-")
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");
}

// ── Generator ─────────────────────────────────────────────────────────────────

const sitemapPath = join(ROOT, "configs", "sitemap.json");
const sitemap = JSON.parse(readFileSync(sitemapPath, "utf8"));

const outputDir = join(ROOT, "components", "pages");
if (!existsSync(outputDir)) {
	mkdirSync(outputDir, { recursive: true });
}

const pages = sitemap.pages;
const pageIds = Object.keys(pages);

const counts = { dashboard: 0, list: 0, simple: 0 };

for (const pageId of pageIds) {
	const page = pages[pageId];
	const pattern = PATTERN_MAP[pageId] ?? "simple";

	// Resolve display label
	const rawLabel = LABEL_OVERRIDES[pageId] ?? replaceTokens(page.label ?? toPascalCase(pageId));
	const displayLabel = rawLabel;

	// Resolve title and description with token replacement
	const pageTitle = replaceTokens(page.label ?? toPascalCase(pageId));
	const pageDescription = replaceTokens(page.description ?? "");

	// Build nav cards from navigate/form actions whose target exists as a page
	const navCards = (page.actions ?? [])
		.filter((action) => action.type === "navigate" || action.type === "form")
		.filter((action) => action.target && pages[action.target])
		.map((action) => {
			const targetPage = pages[action.target];
			const targetActions = targetPage.actions ?? [];
			const card = {
				label: replaceTokens(action.label),
				description: replaceTokens(targetPage.description ?? ""),
				actionCount: targetActions.length,
				icon: targetPage.icon ?? "arrow-right",
			};
			return card;
		});

	let content;

	if (pattern === "dashboard" || pattern === "list") {
		const patternCapitalized = pattern === "dashboard" ? "Dashboard" : "List";
		const navCardsJson = JSON.stringify(navCards, null, "\t");

		content = `import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, create${patternCapitalized}Content } from "../tui/patterns.js";
import { PAGE_MOCKS } from "../mocks/mock-data.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const mock = PAGE_MOCKS["${pageId}"];
const navCards: NavigationCardProps[] = ${navCardsJson};

const meta: Meta = {
\ttitle: "Pages/${displayLabel}",
\trender: () => createPageStory({
\t\ttitle: mock.title,
\t\tdescription: mock.description,
\t\tcontent: create${patternCapitalized}Content(mock.${pattern}!),
\t\tnavCards,
\t}),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
`;
	} else {
		// simple pattern
		const sitemapActions = (page.actions ?? []).map((action) => {
			/** @type {Record<string, unknown>} */
			const entry = { name: action.name, label: action.label };
			if (action.key !== undefined) entry.key = action.key;
			if (action.group !== undefined) entry.group = action.group;
			if (action.type !== undefined) entry.type = action.type;
			if (action.hidden !== undefined) entry.hidden = action.hidden;
			if (action.disabled !== undefined) entry.disabled = action.disabled;
			return entry;
		});

		const navCardsJson = JSON.stringify(navCards, null, "\t");
		const actionsJson = JSON.stringify(sitemapActions, null, "\t");
		const escapedTitle = escapeString(pageTitle);
		const escapedDescription = escapeString(pageDescription);

		content = `import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createSimpleContent } from "../tui/patterns.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const navCards: NavigationCardProps[] = ${navCardsJson};
const actions = ${actionsJson};

const meta: Meta = {
\ttitle: "Pages/${displayLabel}",
\trender: () => createPageStory({
\t\ttitle: "${escapedTitle}",
\t\tdescription: "${escapedDescription}",
\t\tcontent: createSimpleContent(actions),
\t\tnavCards,
\t}),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
`;
	}

	const outputPath = join(outputDir, `${pageId}.stories.ts`);
	writeFileSync(outputPath, content, "utf8");
	counts[pattern]++;
}

// ── Validation ────────────────────────────────────────────────────────────────

const generatedFiles = readdirSync(outputDir).filter((f) => f.endsWith(".stories.ts"));
const expectedCount = pageIds.length;

if (generatedFiles.length !== expectedCount) {
	console.error(`ERROR: Expected ${expectedCount} files, got ${generatedFiles.length}`);
	process.exit(1);
}

console.log(`Generated ${generatedFiles.length} page stories in components/pages/`);
console.log(`  Dashboard: ${counts.dashboard} pages`);
console.log(`  List: ${counts.list} pages`);
console.log(`  Simple: ${counts.simple} pages`);
