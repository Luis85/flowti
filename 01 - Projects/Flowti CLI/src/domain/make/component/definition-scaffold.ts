/**
 * definition-scaffold.ts — Scaffolds a new component definition JSON.
 *
 * Projects can bring their own component definitions. This module creates
 * the boilerplate definition file so users have a starting point.
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import { toKebab } from "../naming.js";
import type { ComponentKind } from "./component-types.js";
import { COMPONENT_KINDS } from "./component-types.js";

export type DefinitionScaffoldDeps = Pick<CliDeps, "disk" | "paths">;

export interface ScaffoldDefinitionResult {
	success: true;
	id: string;
	outputPath: string;
}

export interface ScaffoldDefinitionError {
	success: false;
	error: string;
	hint?: string;
}

export type ScaffoldDefinitionOutcome = ScaffoldDefinitionResult | ScaffoldDefinitionError;

/**
 * Creates a new component definition JSON in the project's `components/definitions/` directory.
 */
export function scaffoldDefinition(
	name: string | undefined,
	flags: Record<string, string | boolean>,
	projectPath: string,
	deps: DefinitionScaffoldDeps,
): ScaffoldDefinitionOutcome {
	if (!name) {
		return { success: false, error: "--name is required.", hint: "Usage: flowti make:definition --name=my-widget" };
	}

	const id = toKebab(name);
	const kind: ComponentKind = COMPONENT_KINDS.includes(flags.kind as ComponentKind)
		? flags.kind as ComponentKind
		: "component";
	const label = typeof flags.label === "string" ? flags.label : `${name} Component`;
	const description = typeof flags.description === "string" ? flags.description : "";

	const defDir = deps.paths.join(projectPath, "components", "definitions");
	const defPath = deps.paths.join(defDir, `${id}.json`);

	if (deps.disk.existsSync(defPath)) {
		return { success: false, error: `Definition already exists: components/definitions/${id}.json` };
	}

	const definition = {
		id,
		kind,
		label,
		description,
		icon: "box",
		images: [],
		prompts: [
			{ variable: "description", label: "Description", default: "", required: false },
		],
		files: [
			{ path: `components/{{kebab}}/{{kebab}}.md`, templateId: "component-doc" },
			{ path: `components/{{kebab}}/{{kebab}}.test.ts`, templateId: "component-test" },
			{ path: `components/{{kebab}}/{{kebab}}.json`, templateId: "component-definition" },
			{ path: `components/{{kebab}}/{{kebab}}.ts`, templateId: "component-component" },
		],
		metadata: {
			type: kind,
			status: "draft",
			interfaces: [],
			dependencies: [],
		},
		properties: [],
		actions: [],
		variants: [],
		states: [],
		nextSteps: [
			`Edit components/definitions/${id}.json to customize the blueprint`,
			`Run: flowti make:${id} --name=MyInstance`,
		],
	};

	deps.disk.mkdirSync(defDir, { recursive: true });
	deps.disk.writeFileSync(defPath, JSON.stringify(definition, null, "\t") + "\n", "utf-8");

	return { success: true, id, outputPath: `components/definitions/${id}.json` };
}
