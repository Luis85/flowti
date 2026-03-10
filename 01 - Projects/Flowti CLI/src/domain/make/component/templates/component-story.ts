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
} from "../component-types.js";

export function componentStoryTemplate(vars: ComponentVariables, def: ComponentDefinition): string {
	const hasActions = (def.actions ?? []).length > 0;

	const metaBlock = buildMetaBlock(def);
	const stories = buildStoryExports(def);
	const paramsBlock = buildParametersBlock(vars, def);
	const renderFn = buildRenderFunction(vars, def);

	return `import type { Meta, StoryObj } from "@storybook/html";
${hasActions ? `import { action } from "storybook/actions";\n` : ""}import componentDoc from "../../../docs/components/${vars.kebab}.md?raw";

const meta: Meta = {
\ttitle: "${kindToFolder(def.kind)}/${vars.pascal}",
\ttags: ["autodocs"],${metaBlock}${paramsBlock}
\trender: (args) => {
${renderFn}
\t},
};

export default meta;
type Story = StoryObj;

export const Default: Story = {};
${stories}`;
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

function buildParametersBlock(vars: ComponentVariables, def: ComponentDefinition): string {
	const params: string[] = [];
	params.push(`\t\tdocs: { description: { component: componentDoc } },`);
	if (def.icon) params.push(`\t\ticon: "${def.icon}",`);
	if (def.heroImage) params.push(`\t\theroImage: "${def.heroImage}",`);
	if (def.domain) params.push(`\t\tdomain: "${def.domain}",`);
	return `\n\tparameters: {\n${params.join("\n")}\n\t},`;
}

function buildRenderFunction(vars: ComponentVariables, def: ComponentDefinition): string {
	const lines: string[] = [];
	lines.push(`\t\tconst el = document.createElement("div");`);
	lines.push(`\t\tel.className = "${vars.kebab}";`);

	// Render properties as data attributes and text content
	const props = def.properties;
	if (props.length > 0) {
		const textProp = props.find((p) => p.key === "title" || p.key === "label" || p.key === "name");
		if (textProp) {
			lines.push(`\t\tif (args.${textProp.key}) el.textContent = String(args.${textProp.key});`);
		}
		for (const prop of props) {
			if (prop.type === "boolean") {
				lines.push(`\t\tif (args.${prop.key}) el.dataset.${prop.key} = "true";`);
			} else if (prop !== textProp) {
				lines.push(`\t\tif (args.${prop.key}) el.dataset.${prop.key} = String(args.${prop.key});`);
			}
		}
	} else {
		lines.push(`\t\tel.textContent = "${vars.pascal}";`);
	}

	// Wire up actions as click/event handlers
	for (const act of def.actions ?? []) {
		const event = act.name.replace(/^on/, "").toLowerCase();
		lines.push(`\t\tif (args.${act.name}) el.addEventListener("${event}", args.${act.name});`);
	}

	lines.push(`\t\treturn el;`);
	return lines.join("\n");
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

function toPascal(s: string): string {
	return s.replace(/(^|[-_ ])(\w)/g, (_, _sep, c) => c.toUpperCase());
}
