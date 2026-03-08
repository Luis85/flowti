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

/** Kind-specific markdown sections appended after the description. */
const KIND_SECTIONS: Record<string, [string, string][]> = {
	system: [
		["Boundaries", "<!-- Define what is inside and outside this system. -->"],
		["Containers", "<!-- List the containers that compose this system. -->"],
	],
	container: [
		["Technology", "{{technology}}"],
		["Components", "<!-- List the components within this container. -->"],
	],
	"c4-component": [
		["Responsibilities", "<!-- Describe what this component is responsible for. -->"],
		["Interfaces", "<!-- List the interfaces this component exposes. -->"],
	],
	person: [
		["Role", "<!-- Describe this actor's role and goals. -->"],
		["Interactions", "<!-- List the systems this person interacts with. -->"],
	],
};

function buildFrontmatter(vars: ComponentVariables, def: ComponentDefinition): string[] {
	const meta = def.metadata;
	const c4Label = C4_LABELS[def.kind] ?? def.kind;
	const c4Level = meta.c4Level != null ? String(meta.c4Level) : "";

	const lines = ["---", `type: ${String(meta.type ?? def.kind)}`, `c4: ${c4Label}`];
	if (c4Level) lines.push(`c4Level: ${c4Level}`);
	lines.push(`status: draft`);
	lines.push(`created: ${new Date().toISOString().slice(0, 10)}`);
	if (vars.technology) lines.push(`technology: ${vars.technology}`);
	if (vars.containedBy) lines.push(`containedBy: ${vars.containedBy}`);
	if (vars.owner) lines.push(`owner: ${vars.owner}`);
	lines.push("---", "");
	return lines;
}

export function c4DocTemplate(vars: ComponentVariables, def: ComponentDefinition): string {
	const c4Label = C4_LABELS[def.kind] ?? def.kind;
	const lines = buildFrontmatter(vars, def);

	lines.push(`# ${vars.name}`, "", `> C4 ${c4Label}`, "");
	if (vars.description) lines.push(vars.description, "");

	const sections = KIND_SECTIONS[def.kind] ?? [];
	for (const [heading, placeholder] of sections) {
		const content = placeholder === "{{technology}}" ? (vars.technology || "<!-- Describe the technology stack. -->") : placeholder;
		lines.push(`## ${heading}`, "", content, "");
	}

	lines.push("## Relationships", "", "<!-- Describe relationships to other components. -->", "");
	return lines.join("\n") + "\n";
}
