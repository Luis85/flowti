/**
 * component-component.ts — TypeScript component file template.
 *
 * Generates a component `.ts` file. When Angular is selected, generates an
 * `@Component` class with `@Input`/`@Output` decorators. Otherwise generates
 * a vanilla HTML factory function with a props interface.
 */

import type {
	ComponentVariables,
	ComponentDefinition,
	ComponentTemplateDeps,
} from "../component-types.js";

function isAngular(vars: ComponentVariables): boolean {
	return vars.storybookFramework === "@storybook/angular";
}

export function componentComponentTemplate(vars: ComponentVariables, def: ComponentDefinition, _deps: ComponentTemplateDeps): string {
	if (isAngular(vars)) return buildAngularComponent(vars, def);

	const propsInterface = buildPropsInterface(vars, def);
	const factoryFn = buildFactoryFunction(vars, def);

	return `${propsInterface}

${factoryFn}
`;
}

function tsType(propType: string): string {
	switch (propType) {
		case "boolean": return "boolean";
		case "number": return "number";
		default: return "string";
	}
}

function tsDefault(propType: string, defaultVal?: string | number | boolean): string {
	if (defaultVal === undefined) {
		switch (propType) {
			case "boolean": return "false";
			case "number": return "0";
			default: return '""';
		}
	}
	return typeof defaultVal === "string" ? `"${defaultVal}"` : String(defaultVal);
}

function buildPropsInterface(vars: ComponentVariables, def: ComponentDefinition): string {
	const lines: string[] = [];
	lines.push(`export interface ${vars.pascal}Props {`);

	if (def.properties.length === 0) {
		lines.push(`\t[key: string]: unknown;`);
	} else {
		for (const prop of def.properties) {
			if (prop.description) lines.push(`\t/** ${prop.description} */`);
			lines.push(`\t${prop.key}?: ${tsType(prop.type)};`);
		}
	}

	// Action callbacks
	for (const act of def.actions ?? []) {
		if (act.description) lines.push(`\t/** ${act.description} */`);
		lines.push(`\t${act.name}?: (event: Event) => void;`);
	}

	lines.push(`}`);
	return lines.join("\n");
}

function buildFactoryFunction(vars: ComponentVariables, def: ComponentDefinition): string {
	const lines: string[] = [];
	lines.push(`export function create${vars.pascal}(props: ${vars.pascal}Props = {}): HTMLElement {`);
	lines.push(`\tconst el = document.createElement("div");`);
	lines.push(`\tel.className = "${vars.kebab}";`);

	const props = def.properties;
	if (props.length > 0) {
		lines.push(``);
		// Apply defaults
		for (const prop of props) {
			const defVal = tsDefault(prop.type, prop.default);
			const varName = prop.key;
			lines.push(`\tconst ${varName} = props.${prop.key} ?? ${defVal};`);
		}

		lines.push(``);
		// Text content from title/label/name prop
		const textProp = props.find((p) => p.key === "title" || p.key === "label" || p.key === "name");
		if (textProp) {
			lines.push(`\tif (${textProp.key}) el.textContent = String(${textProp.key});`);
		}

		// Data attributes
		for (const prop of props) {
			if (prop === textProp) continue;
			if (prop.type === "boolean") {
				lines.push(`\tif (${prop.key}) el.dataset.${prop.key} = "true";`);
			} else {
				lines.push(`\tif (${prop.key}) el.dataset.${prop.key} = String(${prop.key});`);
			}
		}
	} else {
		lines.push(`\tel.textContent = "${vars.pascal}";`);
	}

	// Wire up action handlers
	const actions = def.actions ?? [];
	if (actions.length > 0) {
		lines.push(``);
		for (const act of actions) {
			const event = act.name.replace(/^on/, "").toLowerCase();
			lines.push(`\tif (props.${act.name}) el.addEventListener("${event}", props.${act.name});`);
		}
	}

	lines.push(``);
	lines.push(`\treturn el;`);
	lines.push(`}`);
	return lines.join("\n");
}

// ── Angular component generator ─────────────────────────────────────

function buildAngularTemplate(vars: ComponentVariables, def: ComponentDefinition): string {
	const props = def.properties;
	const textProp = props.find((p) => p.key === "title" || p.key === "label" || p.key === "name");

	if (props.length === 0) return `<div class="${vars.kebab}">${vars.pascal}</div>`;

	const parts: string[] = [`<div class="${vars.kebab}">`];
	if (textProp) {
		parts.push(`\t<span>{{ ${textProp.key} }}</span>`);
	}
	for (const prop of props) {
		if (prop === textProp) continue;
		if (prop.type === "boolean") {
			parts.push(`\t<span *ngIf="${prop.key}" [attr.data-${prop.key}]="'true'"></span>`);
		}
	}
	parts.push(`</div>`);
	return parts.join("\n");
}

function buildAngularComponent(vars: ComponentVariables, def: ComponentDefinition): string {
	const props = def.properties;
	const actions = def.actions ?? [];
	const hasOutputs = actions.length > 0;

	const imports: string[] = ["Component"];
	if (props.length > 0) imports.push("Input");
	if (hasOutputs) imports.push("Output", "EventEmitter");

	const template = buildAngularTemplate(vars, def);
	const templateStr = template.includes("\n")
		? `\n\t\t${template.replace(/\n/g, "\n\t\t")}\n\t`
		: template;

	const lines: string[] = [];
	lines.push(`import { ${imports.join(", ")} } from "@angular/core";`);
	if (props.some((p) => p.type === "boolean")) {
		lines.push(`import { NgIf } from "@angular/common";`);
	}
	lines.push(``);
	lines.push(`@Component({`);
	lines.push(`\tselector: "app-${vars.kebab}",`);
	lines.push(`\tstandalone: true,`);
	if (props.some((p) => p.type === "boolean")) {
		lines.push(`\timports: [NgIf],`);
	}
	lines.push(`\ttemplate: \`${templateStr}\`,`);
	lines.push(`})`);
	lines.push(`export class ${vars.pascal}Component {`);

	// @Input() properties
	for (const prop of props) {
		if (prop.description) lines.push(`\t/** ${prop.description} */`);
		const defVal = tsDefault(prop.type, prop.default);
		lines.push(`\t@Input() ${prop.key}: ${tsType(prop.type)} = ${defVal};`);
	}

	// @Output() actions
	for (const act of actions) {
		if (act.description) lines.push(`\t/** ${act.description} */`);
		lines.push(`\t@Output() ${act.name} = new EventEmitter<void>();`);
	}

	lines.push(`}`);
	return lines.join("\n") + "\n";
}
