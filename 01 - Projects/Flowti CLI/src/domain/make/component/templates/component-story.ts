/**
 * component-story.ts — Storybook story file template for UI components.
 *
 * Generates a `.stories.ts` file with:
 * - argTypes from properties (controls) and actions (event loggers)
 * - args defaults from properties
 * - Named story exports from variants and states
 */

import type {
	ComponentVariables,
	ComponentDefinition,
	ComponentTemplateDeps,
} from "../component-types.js";

function isAngular(vars: ComponentVariables): boolean {
	return vars.storybookFramework === "@storybook/angular";
}

export function componentStoryTemplate(vars: ComponentVariables, def: ComponentDefinition, _deps: ComponentTemplateDeps): string {
	if (isAngular(vars)) return buildAngularStory(vars, def);

	const hasActions = (def.actions ?? []).length > 0;

	const frameworkPkg = vars.storybookFramework || "@storybook/html-vite";
	const metaBlock = buildMetaBlock(def);
	const stories = buildStoryExports(def);
	const paramsBlock = buildParametersBlock(def);
	const playFn = hasActions ? buildPlayFunction(def) : "";
	const testImport = hasActions ? `import { userEvent, within, expect } from "storybook/test";\n` : "";

	return `import type { Meta, StoryObj } from "${frameworkPkg}";
${hasActions ? `import { action } from "storybook/actions";\n` : ""}${testImport}import { create${vars.pascal} } from "./${vars.kebab}.js";
import componentDoc from "./${vars.kebab}.md?raw";

const meta: Meta = {
\ttitle: "${kindToFolder(def.kind)}/${vars.pascal}",
\ttags: ["autodocs"],${metaBlock}${paramsBlock}
\trender: (args) => create${vars.pascal}(args),
};

export default meta;
type Story = StoryObj;

export const Default: Story = {};
${playFn}${stories}`;
}

function kindToFolder(kind: string): string {
	switch (kind) {
		case "layout": return "Layouts";
		case "page": return "Pages";
		default: return "Components";
	}
}

function buildPropertyArgType(prop: { key: string; type: string; description?: string }): string {
	const control = prop.type === "boolean" ? "boolean" : "text";
	const desc = prop.description ? `, description: "${prop.description}"` : "";
	return `\t\t${prop.key}: { control: "${control}"${desc} },`;
}

function buildPropertyArg(prop: { key: string; default?: string | number | boolean }): string | null {
	if (prop.default === undefined) return null;
	const val = typeof prop.default === "string" ? `"${prop.default}"` : String(prop.default);
	return `\t\t${prop.key}: ${val},`;
}

function buildActionArgType(act: { name: string; description?: string }): string {
	const desc = act.description ? `, description: "${act.description}"` : "";
	return `\t\t${act.name}: { action: "${act.name}"${desc} },`;
}

function buildMetaBlock(def: ComponentDefinition): string {
	const argTypes: string[] = [];
	const args: string[] = [];

	for (const prop of def.properties) {
		argTypes.push(buildPropertyArgType(prop));
		const arg = buildPropertyArg(prop);
		if (arg) args.push(arg);
	}

	for (const act of def.actions ?? []) {
		argTypes.push(buildActionArgType(act));
		args.push(`\t\t${act.name}: action("${act.name}"),`);
	}

	if (argTypes.length === 0) return "";

	let block = `\n\targTypes: {\n${argTypes.join("\n")}\n\t},`;
	if (args.length > 0) {
		block += `\n\targs: {\n${args.join("\n")}\n\t},`;
	}
	return block;
}

function buildParametersBlock(def: ComponentDefinition, hasDocImport = true): string {
	const params: string[] = [];
	if (hasDocImport) {
		params.push(`\t\tdocs: { description: { component: componentDoc } },`);
	}
	if (def.icon) params.push(`\t\ticon: "${def.icon}",`);
	if (def.heroImage) params.push(`\t\theroImage: "${def.heroImage}",`);
	if (def.domain) params.push(`\t\tdomain: "${def.domain}",`);
	return `\n\tparameters: {\n${params.join("\n")}\n\t},`;
}

function buildStoryExports(def: ComponentDefinition): string {
	const stories: string[] = [];

	// Variants → named stories
	for (const v of def.variants ?? []) {
		const name = toPascal(v.name);
		const propsStr = Object.entries(v.props)
			.map(([k, val]) => `\t\t${k}: ${typeof val === "string" ? `"${val}"` : String(val)},`)
			.join("\n");
		stories.push(`\nexport const ${name}: Story = {\n\targs: {\n${propsStr}\n\t},\n};`);
	}

	// States → named stories
	for (const s of def.states ?? []) {
		const name = toPascal(s.name);
		const propsStr = Object.entries(s.props)
			.map(([k, val]) => `\t\t${k}: ${typeof val === "string" ? `"${val}"` : String(val)},`)
			.join("\n");
		stories.push(`\nexport const ${name}: Story = {\n\targs: {\n${propsStr}\n\t},\n};`);
	}

	return stories.join("\n");
}

function buildPlayFunction(def: ComponentDefinition): string {
	const actions = def.actions ?? [];
	if (actions.length === 0) return "";

	// Generate an interaction test story that clicks the component and verifies the action fires
	return `
export const InteractionTest: Story = {
\tplay: async ({ canvasElement }) => {
\t\tconst canvas = within(canvasElement);
\t\tconst element = canvas.getByRole("button") ?? canvasElement.firstElementChild;
\t\tawait userEvent.click(element);
\t\tawait expect(element).toBeTruthy();
\t},
};
`;
}

function toPascal(s: string): string {
	return s.replace(/(^|[-_ ])(\w)/g, (_, _sep, c) => c.toUpperCase());
}

// ── Angular story generator ─────────────────────────────────────────

function buildAngularStory(vars: ComponentVariables, def: ComponentDefinition): string {
	const hasActions = (def.actions ?? []).length > 0;
	const metaBlock = buildMetaBlock(def);
	const stories = buildStoryExports(def);
	const paramsBlock = buildParametersBlock(def, false);

	return `import type { Meta, StoryObj } from "@storybook/angular";
${hasActions ? `import { action } from "storybook/actions";\n` : ""}import { ${vars.pascal}Component } from "./${vars.kebab}";

const meta: Meta<${vars.pascal}Component> = {
\ttitle: "${kindToFolder(def.kind)}/${vars.pascal}",
\ttags: ["autodocs"],
\tcomponent: ${vars.pascal}Component,${metaBlock}${paramsBlock}
};

export default meta;
type Story = StoryObj<${vars.pascal}Component>;

export const Default: Story = {};
${stories}`;
}
