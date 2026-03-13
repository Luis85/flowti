/**
 * component-detail-menu.ts — Interactive component detail view and editor.
 *
 * Shows the component definition in human-readable form with options to
 * edit fields, properties, and actions.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { clock } from "../../infrastructure/clock.js";
import { input } from "../../infrastructure/input.js";
import { runMenu } from "../../infrastructure/menu.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, BOLD, DIM, GREEN, YELLOW, CYAN } from "../../infrastructure/ui.js";
import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";
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

function editorDeps() { return { disk, paths } as const; }

// ── Detail display helpers ──────────────────────────────────────────

function renderOptionalField(label: string, value: string | undefined, width = 13): void {
	if (value) log(`    ${DIM}${label}:${RESET}${" ".repeat(width - label.length - 1)}${value}`);
}

function renderKeyValueSection(title: string, entries: Record<string, unknown> | undefined): void {
	if (!entries || Object.keys(entries).length === 0) return;
	log();
	log(`    ${CYAN}${title}:${RESET}`);
	for (const [key, val] of Object.entries(entries)) {
		log(`      ${key}: ${DIM}${JSON.stringify(val)}${RESET}`);
	}
}

function renderListSection(title: string, items: string[] | undefined): void {
	if (!items || items.length === 0) return;
	log();
	log(`    ${CYAN}${title}:${RESET}`);
	for (const item of items) log(`      ${item}`);
}

function renderChildrenSection(children: ComponentInstance["children"]): void {
	if (!children || children.length === 0) return;
	log();
	log(`    ${CYAN}Children:${RESET}`);
	for (const child of children) {
		const slot = child.slot ? ` ${DIM}[${child.slot}]${RESET}` : "";
		const opt = child.optional ? ` ${DIM}(optional)${RESET}` : "";
		log(`      ${child.name}${slot}${opt}`);
	}
}

function renderRelationshipsSection(rels: InstanceRelationship[] | undefined): void {
	if (!rels || rels.length === 0) return;
	log();
	log(`    ${CYAN}Relationships:${RESET}`);
	for (const rel of rels) {
		const tech = rel.technology ? ` ${DIM}[${rel.technology}]${RESET}` : "";
		log(`      → ${rel.target} ${DIM}(${rel.type})${RESET}${tech}`);
	}
}

function renderStoresSection(stores: ComponentInstance["stores"]): void {
	if (!stores || stores.length === 0) return;
	log();
	log(`    ${CYAN}Stores:${RESET}`);
	for (const store of stores) {
		const tech = store.technology ? ` ${DIM}[${store.technology}]${RESET}` : "";
		const desc = store.description ? ` ${DIM}${store.description}${RESET}` : "";
		log(`      ${store.name}${tech}${desc}`);
	}
}

function renderComponentDetail(instance: ComponentInstance, component: ProjectComponent, allComponents: ProjectComponent[]): void {
	log();
	log(`  ${BOLD}${instance.name}${RESET}  ${DIM}(${instance.type})${RESET}`);
	log();

	log(`    ${DIM}ID:${RESET}          ${instance.id}`);
	log(`    ${DIM}Status:${RESET}      ${instance.status}`);
	renderOptionalField("Description", instance.description);
	renderOptionalField("Owner", instance.owner);
	renderOptionalField("Technology", instance.technology);
	renderOptionalField("Domain", instance.domain);
	renderOptionalField("Icon", instance.icon);
	renderOptionalField("Contained by", instance.containedBy, 14);
	renderOptionalField("Role", instance.role);
	renderOptionalField("Priority", instance.priority);
	renderOptionalField("Version", instance.version);
	renderOptionalField("Arc42 Level", instance.arc42Level, 14);

	if (component.containedBy) {
		log(`    ${DIM}Path:${RESET}        ${buildAncestryPath(component, allComponents)}`);
	}
	const siblings = findSiblings(component, allComponents);
	if (siblings.length > 0) {
		log(`    ${DIM}Siblings:${RESET}    ${siblings.map((c) => c.name).join(", ")}`);
	}

	renderKeyValueSection("Properties", instance.properties);
	renderListSection("Actions", instance.actions);
	renderKeyValueSection("Variants", instance.variants);
	renderKeyValueSection("States", instance.states);
	renderChildrenSection(instance.children);
	renderStoresSection(instance.stores);
	renderListSection("Requirements", instance.requirements);
	renderListSection("Features", instance.features);
	renderRelationshipsSection(instance.relationships);

	if (component.isDirty) {
		log();
		log(`    ${YELLOW}Definition modified — regeneration available${RESET}`);
	}
	log();
}

// ── Component detail menu ───────────────────────────────────────────

export async function componentDetailMenu(
	projectRoot: string,
	component: ProjectComponent,
	allComponents: ProjectComponent[],
	sitemapSlots?: Readonly<Record<string, readonly MenuEntry[]>>,
): Promise<MenuResult> {
	const domain = component.domain;
	const instance = readComponentInstance(projectRoot, component.name, editorDeps(), domain);
	if (!instance) {
		log(`\n  ${DIM}No definition JSON found for ${component.name}.${RESET}\n`);
		await input.waitForEnter();
		return undefined;
	}

	renderComponentDetail(instance, component, allComponents);

	const items: MenuEntry[] = [];

	if (sitemapSlots) {
		// Sitemap-driven: edit entries come from sitemapSlots
		items.push(...(sitemapSlots["_between_component-info"] ?? []));
		if (component.isDirty) items.push(buildRegenerateEntry(projectRoot, component, domain));
		items.push(...(sitemapSlots["_after"] ?? []));
	} else {
		// Fallback: build all entries internally (tests / standalone)
		items.push(
			{ key: "e", label: "Edit Fields", action: async () => { await editFieldsMenu(projectRoot, component.name, instance, domain); } },
			{ key: "p", label: "Edit Properties", action: async () => { await editPropertiesMenu(projectRoot, component.name, instance, domain); } },
			{ key: "a", label: "Edit Actions", action: async () => { await editActionsMenu(projectRoot, component.name, instance, domain); } },
			{ key: "c", label: "Edit Children", action: async () => { await editChildrenMenu(projectRoot, component.name, instance, allComponents, domain); } },
			{ key: "s", label: "Edit Stores", action: async () => { await editStoresMenu(projectRoot, component.name, instance, domain); } },
			{ key: "q", label: "Edit Requirements", action: async () => { await editRequirementsMenu(projectRoot, component.name, instance, domain); } },
			{ key: "f", label: "Edit Features", action: async () => { await editFeaturesMenu(projectRoot, component.name, instance, domain); } },
			{ key: "l", label: "Edit Relationships", action: async () => { await editRelationshipsMenu(projectRoot, component.name, instance, domain); } },
		);
		if (component.isDirty) items.push(buildRegenerateEntry(projectRoot, component, domain));
		items.push(
			{ separator: true },
			{ key: "b", label: "Back", action: () => "main" as const },
		);
	}

	return runMenu(`${instance.name}`, items);
}

function buildRegenerateEntry(projectRoot: string, component: ProjectComponent, domain?: string): MenuEntry {
	return {
		key: "r",
		label: "Regenerate Files",
		action: async () => {
			const confirmed = await input.askYesNo(`Regenerate ${component.name}?`);
			if (!confirmed) { log(`\n  ${DIM}Cancelled.${RESET}\n`); return; }
			const fw = getFrameworkPackages(getFramework(projectRoot, { disk, paths }));
			const result = regenerateComponent(component.name, projectRoot, { disk, paths, clock }, domain, fw.framework);
			if (result.success) {
				component.isDirty = false;
				log(`\n  ${GREEN}Regenerated ${result.filesWritten} file(s). Component is now fresh.${RESET}\n`);
			} else {
				log(`\n  ${YELLOW}${result.error}${RESET}\n`);
			}
		},
	};
}

// ── Edit Fields submenu ─────────────────────────────────────────────

export async function editFieldsMenu(projectRoot: string, componentName: string, instance: ComponentInstance, domain?: string): Promise<void> {
	const fields = getEditableFields();

	const items: MenuEntry[] = fields.map((field, i) => {
		const current = String(instance[field] ?? "");
		return {
			key: String(i + 1),
			label: `${field}: ${current || DIM + "(empty)" + RESET}`,
			action: async () => {
				const newVal = await input.ask(`${field}`, current);
				setField(instance, field as EditableField, newVal);
				writeComponentInstance(projectRoot, componentName, instance, editorDeps(), domain);
				log(`  ${GREEN}Updated ${field}.${RESET}`);
				await input.waitForEnter();
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

export async function editPropertiesMenu(projectRoot: string, componentName: string, instance: ComponentInstance, domain?: string): Promise<void> {
	const props = instance.properties ?? {};
	const keys = Object.keys(props);

	const items: MenuEntry[] = keys.map((key, i) => ({
		key: String(i + 1),
		label: `${key}: ${DIM}${JSON.stringify(props[key])}${RESET}`,
		action: async () => {
			const choice = await input.ask(`New value for ${key} (or 'delete' to remove)`, String(props[key] ?? ""));
			if (choice === "delete") {
				removeProperty(instance, key);
				log(`  ${YELLOW}Removed ${key}.${RESET}`);
			} else {
				addProperty(instance, key, parseValue(choice));
				log(`  ${GREEN}Updated ${key}.${RESET}`);
			}
			writeComponentInstance(projectRoot, componentName, instance, editorDeps(), domain);
			await input.waitForEnter();
		},
	}));

	items.push(
		{ separator: true },
		{
			key: "n",
			label: "Add New Property",
			action: async () => {
				const key = await input.ask("Property name");
				if (!key) return;
				const value = await input.ask("Default value", "");
				addProperty(instance, key, parseValue(value));
				writeComponentInstance(projectRoot, componentName, instance, editorDeps(), domain);
				log(`  ${GREEN}Added ${key}.${RESET}`);
				await input.waitForEnter();
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	await runMenu("Edit Properties", items);
}

// ── Edit Actions submenu ────────────────────────────────────────────

export async function editActionsMenu(projectRoot: string, componentName: string, instance: ComponentInstance, domain?: string): Promise<void> {
	const actions = instance.actions ?? [];

	const items: MenuEntry[] = actions.map((action, i) => ({
		key: String(i + 1),
		label: action,
		action: async () => {
			const remove = await input.askYesNo(`Remove action "${action}"?`);
			if (remove) {
				removeAction(instance, action);
				writeComponentInstance(projectRoot, componentName, instance, editorDeps(), domain);
				log(`  ${YELLOW}Removed ${action}.${RESET}`);
				await input.waitForEnter();
			}
		},
	}));

	items.push(
		{ separator: true },
		{
			key: "n",
			label: "Add New Action",
			action: async () => {
				const name = await input.ask("Action name (e.g. onClick)");
				if (!name) return;
				addAction(instance, name);
				writeComponentInstance(projectRoot, componentName, instance, editorDeps(), domain);
				log(`  ${GREEN}Added ${name}.${RESET}`);
				await input.waitForEnter();
			},
		},
		{
			key: "f",
			label: "Add from Reference",
			action: async () => { await addFromReferenceMenu(projectRoot, componentName, instance, domain); },
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	await runMenu("Edit Actions", items);
}

// ── Helpers ──────────────────────────────────────────────────────────

function parseValue(str: string): unknown {
	if (str === "true") return true;
	if (str === "false") return false;
	const num = Number(str);
	if (!isNaN(num) && str.trim() !== "") return num;
	return str;
}
