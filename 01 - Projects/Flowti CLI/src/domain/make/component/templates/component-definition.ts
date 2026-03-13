/**
 * component-definition.ts — JSON definition file template for components.
 */

import type { ComponentVariables, ComponentDefinition, ComponentTemplateDeps } from "../component-types.js";

function applyOptionalVars(definition: Record<string, unknown>, vars: ComponentVariables): void {
	if (vars.description) definition.description = vars.description;
	if (vars.technology) definition.technology = vars.technology;
	if (vars.containedBy) definition.containedBy = vars.containedBy;
	if (vars.owner) definition.owner = vars.owner;
}

function applyProperties(definition: Record<string, unknown>, def: ComponentDefinition): void {
	if (def.properties.length === 0) return;
	const props: Record<string, unknown> = {};
	for (const prop of def.properties) {
		props[prop.key] = prop.default ?? null;
	}
	definition.properties = props;
}

function applyStorybook(definition: Record<string, unknown>, def: ComponentDefinition): void {
	if ((def.actions ?? []).length > 0) {
		definition.actions = def.actions.map((a) => a.name);
	}
	if ((def.variants ?? []).length > 0) {
		definition.variants = Object.fromEntries(def.variants.map((v) => [v.name, v.props]));
	}
	if ((def.states ?? []).length > 0) {
		definition.states = Object.fromEntries(def.states.map((s) => [s.name, s.props]));
	}
}

export function componentDefinitionTemplate(vars: ComponentVariables, def: ComponentDefinition, _deps: ComponentTemplateDeps): string {
	const definition: Record<string, unknown> = {
		name: vars.name,
		id: vars.kebab,
		...def.metadata,
	};

	applyOptionalVars(definition, vars);
	if (def.domain) definition.domain = def.domain;
	if (def.icon) definition.icon = def.icon;
	if (def.heroImage) definition.heroImage = def.heroImage;
	if ((def.images ?? []).length > 0) definition.images = def.images;
	applyProperties(definition, def);
	applyStorybook(definition, def);
	applyProductMetadata(definition, def);

	return JSON.stringify(definition, null, "\t") + "\n";
}

const PRODUCT_FIELDS = ["role", "priority", "version", "deprecated", "arc42Level"] as const;
const PRODUCT_ARRAY_FIELDS = ["requirements", "features", "relationships"] as const;

function applyProductMetadata(definition: Record<string, unknown>, def: ComponentDefinition): void {
	for (const key of PRODUCT_FIELDS) {
		if (def[key]) definition[key] = def[key];
	}
	for (const key of PRODUCT_ARRAY_FIELDS) {
		if ((def[key] as unknown[] | undefined)?.length) definition[key] = def[key];
	}
}
