/**
 * component-test.ts — Test file template for components.
 */

import type { ComponentVariables, ComponentDefinition, ComponentTemplateDeps } from "../component-types.js";

function isAngular(vars: ComponentVariables): boolean {
	return vars.storybookFramework === "@storybook/angular";
}

export function componentTestTemplate(vars: ComponentVariables, def: ComponentDefinition, _deps: ComponentTemplateDeps): string {
	if (isAngular(vars)) return buildAngularTest(vars, def);

	const hasActions = (def.actions ?? []).length > 0;
	const actionTests = buildActionTestStubs(vars, def);
	const vitestImports = hasActions ? "describe, it, expect, vi" : "describe, it, expect";
	const componentImport = hasActions ? `import { create${vars.pascal} } from "./${vars.kebab}.js";\n\n` : "\n";
	return `import { ${vitestImports} } from "vitest";
${componentImport}describe("${vars.name}", () => {
\tit("has a component definition", async () => {
\t\tconst def = await import("./${vars.kebab}.json");
\t\texpect(def.name).toBe("${vars.name}");
\t});
${actionTests}});
`;
}

function buildActionTestStubs(vars: ComponentVariables, def: ComponentDefinition): string {
	const actions = def.actions ?? [];
	if (actions.length === 0) return "";
	const stubs = actions.map((action) => {
		const eventName = action.name.replace(/^on/, "").toLowerCase();
		return `
\tit("fires ${action.name} on ${eventName}", () => {
\t\tconst handler = vi.fn();
\t\tconst el = create${vars.pascal}({ ${action.name}: handler });
\t\tel.dispatchEvent(new Event("${eventName}"));
\t\texpect(handler).toHaveBeenCalled();
\t});`;
	});

	return `
\t// ── Action tests ─────────────────────────────────────────────
${stubs.join("\n")}
`;
}

// ── Angular test generator ──────────────────────────────────────────

function buildAngularTest(vars: ComponentVariables, def: ComponentDefinition): string {
	const props = def.properties;
	const actions = def.actions ?? [];

	const defaultTests: string[] = [];
	for (const prop of props) {
		const expected = prop.default !== undefined
			? (typeof prop.default === "string" ? `"${prop.default}"` : String(prop.default))
			: (prop.type === "boolean" ? "false" : prop.type === "number" ? "0" : '""');
		defaultTests.push(`\t\texpect(component.${prop.key}).toBe(${expected});`);
	}

	const outputTests = actions.map((act) => `
\tit("has ${act.name} output", () => {
\t\tconst spy = vi.fn();
\t\tcomponent.${act.name}.subscribe(spy);
\t\tcomponent.${act.name}.emit();
\t\texpect(spy).toHaveBeenCalled();
\t});`);

	return `import { describe, it, expect, vi, beforeEach } from "vitest";
import { ${vars.pascal}Component } from "./${vars.kebab}";

describe("${vars.name}", () => {
\tlet component: ${vars.pascal}Component;

\tbeforeEach(() => {
\t\tcomponent = new ${vars.pascal}Component();
\t});

\tit("has a component definition", async () => {
\t\tconst def = await import("./${vars.kebab}.json");
\t\texpect(def.name).toBe("${vars.name}");
\t});

\tit("creates with default values", () => {
${defaultTests.length > 0 ? defaultTests.join("\n") : "\t\texpect(component).toBeTruthy();"}
\t});
${outputTests.length > 0 ? outputTests.join("\n") + "\n" : ""}});
`;
}
