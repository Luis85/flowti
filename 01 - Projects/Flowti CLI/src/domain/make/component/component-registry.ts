/**
 * component-registry.ts — Bundled component definitions and template registry.
 *
 * Definitions are imported directly so esbuild inlines them into the bundle.
 * To add a new component type: import the JSON and add to BUNDLED_DEFINITIONS,
 * then register any new template functions below.
 */

import type { ComponentDefinition, ComponentTemplateFn } from "./component-types.js";
import type { ComponentTemplateRegistry } from "./component-plan.js";
import { componentDocTemplate } from "./templates/component-doc.js";
import { c4DocTemplate } from "./templates/c4-doc.js";
import { componentTestTemplate } from "./templates/component-test.js";
import { componentDefinitionTemplate } from "./templates/component-definition.js";

// ── Bundled definitions (inlined at build time) ─────────────────────

import componentDef from "./definitions/component.json";
import c4SystemDef from "./definitions/c4-system.json";
import c4ContainerDef from "./definitions/c4-container.json";
import c4ComponentDef from "./definitions/c4-component.json";
import c4PersonDef from "./definitions/c4-person.json";

const BUNDLED_DEFINITIONS: ComponentDefinition[] = [
	componentDef as ComponentDefinition,
	c4SystemDef as ComponentDefinition,
	c4ContainerDef as ComponentDefinition,
	c4ComponentDef as ComponentDefinition,
	c4PersonDef as ComponentDefinition,
];

export function loadComponentDefinitions(): ComponentDefinition[] {
	return BUNDLED_DEFINITIONS;
}

// ── Template registry ───────────────────────────────────────────────

export function createComponentTemplateRegistry(): ComponentTemplateRegistry {
	const registry = new Map<string, ComponentTemplateFn>();
	registry.set("component-doc", componentDocTemplate);
	registry.set("c4-doc", c4DocTemplate);
	registry.set("component-test", componentTestTemplate);
	registry.set("component-definition", componentDefinitionTemplate);
	return registry;
}
