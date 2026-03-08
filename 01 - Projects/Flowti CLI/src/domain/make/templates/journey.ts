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
