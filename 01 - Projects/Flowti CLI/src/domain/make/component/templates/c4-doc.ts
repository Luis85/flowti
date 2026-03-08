/**
 * c4-doc.ts — Markdown documentation template for C4 architecture entities.
 */

import type { ComponentVariables, ComponentDefinition } from "../component-types.js";

const C4_LABELS: Record<string, string> = {
	system: "System",
	container: "Container",
	"c4-component": "Component",
	person: "Person",
};

export function c4DocTemplate(vars: ComponentVariables, def: ComponentDefinition): string {
	const meta = def.metadata;
	const c4Label = C4_LABELS[def.kind] ?? def.kind;
	const c4Level = meta.c4Level != null ? String(meta.c4Level) : "";

	const lines = [
		"---",
		`type: ${String(meta.type ?? def.kind)}`,
		`c4: ${c4Label}`,
	];
	if (c4Level) lines.push(`c4Level: ${c4Level}`);
	lines.push(`status: draft`);
	lines.push(`created: ${new Date().toISOString().slice(0, 10)}`);
	if (vars.technology) lines.push(`technology: ${vars.technology}`);
	if (vars.containedBy) lines.push(`containedBy: ${vars.containedBy}`);
	if (vars.owner) lines.push(`owner: ${vars.owner}`);
	lines.push("---", "");

	lines.push(`# ${vars.name}`, "");
	lines.push(`> C4 ${c4Label}`, "");

	if (vars.description) {
		lines.push(vars.description, "");
	}

	if (def.kind === "system") {
		lines.push("## Boundaries", "", "<!-- Define what is inside and outside this system. -->", "");
		lines.push("## Containers", "", "<!-- List the containers that compose this system. -->", "");
	} else if (def.kind === "container") {
		lines.push("## Technology", "", vars.technology || "<!-- Describe the technology stack. -->", "");
		lines.push("## Components", "", "<!-- List the components within this container. -->", "");
	} else if (def.kind === "c4-component") {
		lines.push("## Responsibilities", "", "<!-- Describe what this component is responsible for. -->", "");
		lines.push("## Interfaces", "", "<!-- List the interfaces this component exposes. -->", "");
	} else if (def.kind === "person") {
		lines.push("## Role", "", "<!-- Describe this actor's role and goals. -->", "");
		lines.push("## Interactions", "", "<!-- List the systems this person interacts with. -->", "");
	}

	lines.push("## Relationships", "", "<!-- Describe relationships to other components. -->", "");
	return lines.join("\n") + "\n";
}
