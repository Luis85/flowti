/**
 * journey.ts — Scaffolding templates for E2E Journey generation.
 */

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
	return `import { describe, it } from "vitest";

// E2E journey tests require a running Obsidian instance.
// Run via: npm run test:e2e -- --journey=${kebab}
//
// To execute manually:
//   1. Start Obsidian with the test vault
//   2. npx vitest run tests/e2e/<this-file> --config configs/vitest.config.ts
//
// The journey definition is loaded from: tests/e2e/journeys/${kebab}.journey

describe.skip("Journey: ${kebab}", () => {
\tit("executes the ${kebab} journey", () => {
\t\t// Implementation requires journeyExecutor helper and a running Obsidian instance
\t\t// Remove .skip and uncomment below to run:
\t\t//
\t\t// const { executeJourney } = await import("./helpers/journeyExecutor");
\t\t// const fs = await import("node:fs");
\t\t// const path = await import("node:path");
\t\t// const configPath = path.join(__dirname, "journeys", "${kebab}.journey");
\t\t// const definition = JSON.parse(fs.readFileSync(configPath, "utf-8"));
\t\t// await executeJourney(definition);
\t});
});
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
