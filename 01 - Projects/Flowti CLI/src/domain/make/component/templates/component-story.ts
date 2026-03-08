/**
 * component-story.ts — Storybook story file template for UI components.
 */

import type { ComponentVariables, ComponentDefinition } from "../component-types.js";

export function componentStoryTemplate(vars: ComponentVariables, def: ComponentDefinition): string {
	const propsBlock = def.properties.length > 0
		? buildArgsBlock(def)
		: "";

	return `import type { Meta, StoryObj } from "@storybook/html";
import { ${vars.pascal} } from "./${vars.kebab}";

const meta: Meta = {
\ttitle: "${kindToFolder(def.kind)}/${vars.pascal}",
\ttags: ["autodocs"],${propsBlock}
};

export default meta;
type Story = StoryObj;

export const Default: Story = {};
`;
}

function kindToFolder(kind: string): string {
	switch (kind) {
		case "layout": return "Layouts";
		case "page": return "Pages";
		default: return "Components";
	}
}

function buildArgsBlock(def: ComponentDefinition): string {
	const argTypes: string[] = [];
	const args: string[] = [];

	for (const prop of def.properties) {
		const control = prop.type === "boolean" ? "boolean" : "text";
		argTypes.push(`\t\t${prop.key}: { control: "${control}"${prop.description ? `, description: "${prop.description}"` : ""} },`);
		if (prop.default !== undefined) {
			const val = typeof prop.default === "string" ? `"${prop.default}"` : String(prop.default);
			args.push(`\t\t${prop.key}: ${val},`);
		}
	}

	let block = `\n\targTypes: {\n${argTypes.join("\n")}\n\t},`;
	if (args.length > 0) {
		block += `\n\targs: {\n${args.join("\n")}\n\t},`;
	}
	return block;
}
