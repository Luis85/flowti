/**
 * component-definition.ts — JSON definition file template for components.
 */

import type { ComponentVariables, ComponentDefinition } from "../component-types.js";

export function componentDefinitionTemplate(vars: ComponentVariables, def: ComponentDefinition): string {
	const meta = { ...def.metadata };

	const definition: Record<string, unknown> = {
		name: vars.name,
		id: vars.kebab,
		...meta,
	};

	if (vars.description) definition.description = vars.description;
	if (vars.technology) definition.technology = vars.technology;
	if (vars.containedBy) definition.containedBy = vars.containedBy;
	if (vars.owner) definition.owner = vars.owner;

	// Include properties schema from the definition
	if (def.properties.length > 0) {
		const props: Record<string, unknown> = {};
		for (const prop of def.properties) {
			props[prop.key] = prop.default ?? null;
		}
		definition.properties = props;
	}

	return JSON.stringify(definition, null, "\t") + "\n";
}
