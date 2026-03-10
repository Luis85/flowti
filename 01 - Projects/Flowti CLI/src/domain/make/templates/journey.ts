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
		tools: ["command", "assert", "log", "file-exists"],
		lifecycle: {
			enablePlugin: false,
			checkInstalled: false,
			startTrace: false,
			openActivityLog: false,
		},
		steps: [
			{
				id: `${kebab}-01`,
				title: `Run ${name}`,
				description: `Execute the ${name} feature and verify output.`,
				acceptanceCriteria: [
					{ id: `${kebab}-ac-01`, description: `${name} command runs without errors` },
				],
				actions: [
					{ tool: "log", message: `Starting ${name} journey...` },
					{ tool: "command", id: `node dist/main.js help` },
					{ tool: "assert", type: "exit-code", command: `node dist/main.js help`, expected: 0 },
				],
			},
			{
				id: `${kebab}-02`,
				title: `Verify ${name} output`,
				description: `Assert that the ${name} feature produced the expected results.`,
				acceptanceCriteria: [
					{ id: `${kebab}-ac-02`, description: `${name} output contains expected content` },
				],
				actions: [
					{ tool: "assert", type: "stdout-contains", command: `node dist/main.js help`, contains: "flowti" },
				],
			},
		],
	}, null, "\t") + "\n";
}

export function journeyTestTemplate(kebab: string): string {
	return `import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loadJourney, runStep, runJourney, setToolDeps, resetToolDeps, ensureTestVault } from "../../src/domain/e2e/journey/index.js";
import type { JourneyDefinition } from "../../src/domain/e2e/journey/index.js";

const projectRoot = import.meta.dirname + "/../..";
let journey: JourneyDefinition;

beforeAll(() => {
\tensureTestVault(projectRoot, "test-vault");
\tjourney = loadJourney(projectRoot, "${kebab}");
});

afterAll(() => {
\tresetToolDeps();
});

describe("Journey: ${kebab}", () => {
\t// Auto-generated step tests from journey definition
\tfor (const step of journey?.steps ?? []) {
\t\tit(\`\${step.id}: \${step.title}\`, async () => {
\t\t\tconst result = await runStep(step, { cwd: projectRoot });
\t\t\texpect(result.status).toBe("pass");
\t\t});
\t}

\t// Full journey aggregate
\tit("completes the full journey", async () => {
\t\tconst result = await runJourney(journey, { cwd: projectRoot });
\t\texpect(result.failed).toBe(0);
\t});
});

// ── Developer extensions ─────────────────────────────────────────────
// Add custom tests below. These run alongside the auto-generated steps
// and are preserved when the journey definition is updated.
//
// describe("Custom: ${kebab}", () => {
//   it("validates custom business logic", () => {
//     // your tests here
//   });
// });
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
