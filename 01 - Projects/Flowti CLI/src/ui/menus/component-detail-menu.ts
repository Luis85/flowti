/**
 * component-detail-menu.ts — Interactive component detail view and editor.
 *
 * Shows the component definition in human-readable form with options to
 * edit fields, properties, and actions.
 */

import { runMenu } from "../../infrastructure/menu.js";
import { RESET, BOLD, DIM, GREEN, YELLOW, CYAN } from "../../infrastructure/ui.js";
import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { ProjectComponent } from "../../domain/make/component/component-types.js";
import {
	readComponentInstance,
	writeComponentInstance,
	getEditableFields,
	setField,
	addProperty,
	removeProperty,
	addAction,
	removeAction,
} from "../../domain/make/component/component-editor.js";
import type { ComponentInstance, EditableField, InstanceRelationship } from "../../domain/make/component/component-editor.js";
import { editStoresMenu, editChildrenMenu } from "./component-editor-menus.js";
import { editRequirementsMenu, editFeaturesMenu, editRelationshipsMenu } from "./component-product-menus.js";
import { regenerateComponent } from "../../domain/make/component/component-commands.js";
import {
	buildAncestryPath,
	findSiblings,
} from "../../domain/make/component/component-list.js";
import { getFramework } from "../../domain/make/component/storybook-settings.js";
import { addFromReferenceMenu } from "./action-reference-menu.js";
import { getFrameworkPackages } from "../../domain/make/component/storybook-service.js";

// ── Detail display helpers ──────────────────────────────────────────

export function renderOptionalField(label: string, value: string | undefined, log: MenuDeps["log"], width = 13): void {
	if (value) log(`    ${DIM}${label}:${RESET}${" ".repeat(width - label.length - 1)}${value}`);
}

export function renderKeyValueSection(title: string, entries: Record<string, unknown> | undefined, log: MenuDeps["log"]): void {
	if (!entries || Object.keys(entries).length === 0) return;
	log("");
	log(`    ${CYAN}${title}:${RESET}`);
	for (const [key, val] of Object.entries(entries)) {
		log(`      ${key}: ${DIM}${JSON.stringify(val)}${RESET}`);
	}
}

export function renderListSection(title: string, items: string[] | undefined, log: MenuDeps["log"]): void {
	if (!items || items.length === 0) return;
	log("");
	log(`    ${CYAN}${title}:${RESET}`);
	for (const item of items) log(`      ${item}`);
}

export function renderChildrenSection(children: ComponentInstance["children"], log: MenuDeps["log"]): void {
	if (!children || children.length === 0) return;
	log("");
	log(`    ${CYAN}Children:${RESET}`);
	for (const child of children) {
		const slot = child.slot ? ` ${DIM}[${child.slot}]${RESET}` : "";
		const opt = child.optional ? ` ${DIM}(optional)${RESET}` : "";
		log(`      ${child.name}${slot}${opt}`);
	}
}

export function renderRelationshipsSection(rels: InstanceRelationship[] | undefined, log: MenuDeps["log"]): void {
	if (!rels || rels.length === 0) return;
	log("");
	log(`    ${CYAN}Relationships:${RESET}`);
	for (const rel of rels) {
		const tech = rel.technology ? ` ${DIM}[${rel.technology}]${RESET}` : "";
		log(`      → ${rel.target} ${DIM}(${rel.type})${RESET}${tech}`);
	}
}

export function renderStoresSection(stores: ComponentInstance["stores"], log: MenuDeps["log"]): void {
	if (!stores || stores.length === 0) return;
	log("");
	log(`    ${CYAN}Stores:${RESET}`);
	for (const store of stores) {
		const tech = store.technology ? ` ${DIM}[${store.technology}]${RESET}` : "";
		const desc = store.description ? ` ${DIM}${store.description}${RESET}` : "";
		log(`      ${store.name}${tech}${desc}`);
	}
}

export function renderComponentDetail(instance: ComponentInstance, component: ProjectComponent, allComponents: ProjectComponent[], log: MenuDeps["log"]): void {
	log("");
	log(`  ${BOLD}${instance.name}${RESET}  ${DIM}(${instance.type})${RESET}`);
	log("");

	log(`    ${DIM}ID:${RESET}          ${instance.id}`);
	log(`    ${DIM}Status:${RESET}      ${instance.status}`);
	renderOptionalField("Description", instance.description, log);
	renderOptionalField("Owner", instance.owner, log);
	renderOptionalField("Technology", instance.technology, log);
	renderOptionalField("Domain", instance.domain, log);
	renderOptionalField("Icon", instance.icon, log);
	renderOptionalField("Contained by", instance.containedBy, log, 14);
	renderOptionalField("Role", instance.role, log);
	renderOptionalField("Priority", instance.priority, log);
	renderOptionalField("Version", instance.version, log);
	renderOptionalField("Arc42 Level", instance.arc42Level, log, 14);

	if (component.containedBy) {
		log(`    ${DIM}Path:${RESET}        ${buildAncestryPath(component, allComponents)}`);
	}
	const siblings = findSiblings(component, allComponents);
	if (siblings.length > 0) {
		log(`    ${DIM}Siblings:${RESET}    ${siblings.map((c) => c.name).join(", ")}`);
	}

	renderKeyValueSection("Properties", instance.properties, log);
	renderListSection("Actions", instance.actions, log);
	renderKeyValueSection("Variants", instance.variants, log);
	renderKeyValueSection("States", instance.states, log);
	renderChildrenSection(instance.children, log);
	renderStoresSection(instance.stores, log);
	renderListSection("Requirements", instance.requirements, log);
	renderListSection("Features", instance.features, log);
	renderRelationshipsSection(instance.relationships, log);

	if (component.isDirty) {
		log("");
		log(`    ${YELLOW}Definition modified — regeneration available${RESET}`);
	}
	log("");
}

// ── Component detail menu ───────────────────────────────────────────

export async function componentDetailMenu(
	projectRoot: string,
	component: ProjectComponent,
	allComponents: ProjectComponent[],
	dataSourceEntries: Readonly<Record<string, readonly MenuEntry[]>> | undefined,
	deps: MenuDeps,
): Promise<MenuResult> {
	const domain = component.domain;
	const instance = readComponentInstance(projectRoot, component.name, deps, domain);
	if (!instance) {
		deps.log(`\n  ${DIM}No definition JSON found for ${component.name}.${RESET}\n`);
		await deps.input.waitForEnter();
		return undefined;
	}

	renderComponentDetail(instance, component, allComponents, deps.log);

	const items: MenuEntry[] = [];

	if (dataSourceEntries?.["_actions"]) {
		// Sitemap-driven: actions come from sitemap page definition
		items.push(...dataSourceEntries["_actions"]);
		if (component.isDirty) items.push(buildRegenerateEntry(projectRoot, component, domain, deps));
	} else {
		// Fallback: build all entries internally (tests / standalone)
		items.push(
			{ key: "e", label: "Edit Fields", action: async () => { await editFieldsMenu(projectRoot, component.name, instance, domain, deps); } },
			{ key: "p", label: "Edit Properties", action: async () => { await editPropertiesMenu(projectRoot, component.name, instance, domain, deps); } },
			{ key: "a", label: "Edit Actions", action: async () => { await editActionsMenu(projectRoot, component.name, instance, domain, deps); } },
			{ key: "c", label: "Edit Children", action: async () => { await editChildrenMenu(projectRoot, component.name, instance, allComponents, domain, deps); } },
			{ key: "s", label: "Edit Stores", action: async () => { await editStoresMenu(projectRoot, component.name, instance, domain, deps); } },
			{ key: "q", label: "Edit Requirements", action: async () => { await editRequirementsMenu(projectRoot, component.name, instance, domain, deps); } },
			{ key: "f", label: "Edit Features", action: async () => { await editFeaturesMenu(projectRoot, component.name, instance, domain, deps); } },
			{ key: "l", label: "Edit Relationships", action: async () => { await editRelationshipsMenu(projectRoot, component.name, instance, domain, deps); } },
		);
		if (component.isDirty) items.push(buildRegenerateEntry(projectRoot, component, domain, deps));
		items.push(
			{ separator: true },
			{ key: "b", label: "Back", action: () => "main" as const },
		);
	}

	return runMenu(`${instance.name}`, items);
}

function buildRegenerateEntry(projectRoot: string, component: ProjectComponent, domain: string | undefined, deps: MenuDeps): MenuEntry {
	return {
		key: "r",
		label: "Regenerate Files",
		action: async () => {
			const confirmed = await deps.input.askYesNo(`Regenerate ${component.name}?`);
			if (!confirmed) { deps.log(`\n  ${DIM}Cancelled.${RESET}\n`); return; }
			const fw = getFrameworkPackages(getFramework(projectRoot, deps));
			const result = regenerateComponent(component.name, projectRoot, deps, domain, fw.framework);
			if (result.success) {
				component.isDirty = false;
				deps.log(`\n  ${GREEN}Regenerated ${result.filesWritten} file(s). Component is now fresh.${RESET}\n`);
			} else {
				deps.log(`\n  ${YELLOW}${result.error}${RESET}\n`);
			}
		},
	};
}

// ── Edit Fields submenu ─────────────────────────────────────────────

export async function editFieldsMenu(projectRoot: string, componentName: string, instance: ComponentInstance, domain: string | undefined, deps: MenuDeps): Promise<void> {
	const fields = getEditableFields();

	const items: MenuEntry[] = fields.map((field, i) => {
		const current = String(instance[field] ?? "");
		return {
			key: String(i + 1),
			label: `${field}: ${current || DIM + "(empty)" + RESET}`,
			action: async () => {
				const newVal = await deps.input.ask(`${field}`, current);
				setField(instance, field as EditableField, newVal);
				writeComponentInstance(projectRoot, componentName, instance, deps, domain);
				deps.log(`  ${GREEN}Updated ${field}.${RESET}`);
				await deps.input.waitForEnter();
			},
		};
	});

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	await runMenu("Edit Fields", items);
}

// ── Edit Properties submenu ─────────────────────────────────────────

export async function editPropertiesMenu(projectRoot: string, componentName: string, instance: ComponentInstance, domain: string | undefined, deps: MenuDeps): Promise<void> {
	const props = instance.properties ?? {};
	const keys = Object.keys(props);

	const items: MenuEntry[] = keys.map((key, i) => ({
		key: String(i + 1),
		label: `${key}: ${DIM}${JSON.stringify(props[key])}${RESET}`,
		action: async () => {
			const choice = await deps.input.ask(`New value for ${key} (or 'delete' to remove)`, String(props[key] ?? ""));
			if (choice === "delete") {
				removeProperty(instance, key);
				deps.log(`  ${YELLOW}Removed ${key}.${RESET}`);
			} else {
				addProperty(instance, key, parseValue(choice));
				deps.log(`  ${GREEN}Updated ${key}.${RESET}`);
			}
			writeComponentInstance(projectRoot, componentName, instance, deps, domain);
			await deps.input.waitForEnter();
		},
	}));

	items.push(
		{ separator: true },
		{
			key: "n",
			label: "Add New Property",
			action: async () => {
				const key = await deps.input.ask("Property name");
				if (!key) return;
				const value = await deps.input.ask("Default value", "");
				addProperty(instance, key, parseValue(value));
				writeComponentInstance(projectRoot, componentName, instance, deps, domain);
				deps.log(`  ${GREEN}Added ${key}.${RESET}`);
				await deps.input.waitForEnter();
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	await runMenu("Edit Properties", items);
}

// ── Edit Actions submenu ────────────────────────────────────────────

export async function editActionsMenu(projectRoot: string, componentName: string, instance: ComponentInstance, domain: string | undefined, deps: MenuDeps): Promise<void> {
	const actions = instance.actions ?? [];

	const items: MenuEntry[] = actions.map((action, i) => ({
		key: String(i + 1),
		label: action,
		action: async () => {
			const remove = await deps.input.askYesNo(`Remove action "${action}"?`);
			if (remove) {
				removeAction(instance, action);
				writeComponentInstance(projectRoot, componentName, instance, deps, domain);
				deps.log(`  ${YELLOW}Removed ${action}.${RESET}`);
				await deps.input.waitForEnter();
			}
		},
	}));

	items.push(
		{ separator: true },
		{
			key: "n",
			label: "Add New Action",
			action: async () => {
				const name = await deps.input.ask("Action name (e.g. onClick)");
				if (!name) return;
				addAction(instance, name);
				writeComponentInstance(projectRoot, componentName, instance, deps, domain);
				deps.log(`  ${GREEN}Added ${name}.${RESET}`);
				await deps.input.waitForEnter();
			},
		},
		{
			key: "f",
			label: "Add from Reference",
			action: async () => { await addFromReferenceMenu(projectRoot, componentName, instance, deps, domain); },
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	await runMenu("Edit Actions", items);
}

// ── Helpers ──────────────────────────────────────────────────────────

export function parseValue(str: string): unknown {
	if (str === "true") return true;
	if (str === "false") return false;
	const num = Number(str);
	if (!isNaN(num) && str.trim() !== "") return num;
	return str;
}
