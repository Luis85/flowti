/**
 * component-doc.ts — Markdown documentation template for generic components.
 */

import type { ComponentVariables, ComponentDefinition } from "../component-types.js";

export function componentDocTemplate(vars: ComponentVariables, def: ComponentDefinition): string {
	const meta = def.metadata;
	const lines = [
		"---",
		`type: ${String(meta.type ?? "component")}`,
		`status: ${String(meta.status ?? "draft")}`,
		`created: ${new Date().toISOString().slice(0, 10)}`,
	];
	if (vars.owner) lines.push(`owner: ${vars.owner}`);
	lines.push("---", "");
	lines.push(`# ${vars.name}`, "");
	if (vars.description) {
		lines.push(vars.description, "");
	}
	lines.push("## Purpose", "", "<!-- Describe what this component does and why it exists. -->", "");
	lines.push("## Interfaces", "", "<!-- List the public interfaces this component exposes. -->", "");
	lines.push("## Dependencies", "", "<!-- List components this depends on. -->", "");
	return lines.join("\n") + "\n";
}
