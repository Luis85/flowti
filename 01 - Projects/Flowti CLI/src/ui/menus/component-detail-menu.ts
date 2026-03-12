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
	addChild,
	removeChild,
	addStore,
	removeStore,
} from "../../domain/make/component/component-editor.js";
import type { ComponentInstance, EditableField, ComponentInstanceChild, ComponentInstanceStore } from "../../domain/make/component/component-editor.js";
import { regenerateComponent } from "../../domain/make/component/component-commands.js";
import {
	buildAncestryPath,
	findSiblings,
} from "../../domain/make/component/component-list.js";
import { ACTION_REFERENCE, searchActions } from "../../domain/make/component/action-reference.js";
import type { ActionCategory } from "../../domain/make/component/action-reference.js";
import { getFramework } from "../../domain/make/component/storybook-settings.js";
import { getFrameworkPackages } from "../../domain/make/component/storybook-service.js";

function editorDeps() { return { disk, paths } as const; }

// ── Detail display ──────────────────────────────────────────────────

function renderComponentDetail(instance: ComponentInstance, component: ProjectComponent, allComponents: ProjectComponent[]): void {
	log();
	log(`  ${BOLD}${instance.name}${RESET}  ${DIM}(${instance.type})${RESET}`);
	log();

	// Core fields
	log(`    ${DIM}ID:${RESET}          ${instance.id}`);
	log(`    ${DIM}Status:${RESET}      ${instance.status}`);
	if (instance.description) log(`    ${DIM}Description:${RESET} ${instance.description}`);
	if (instance.owner) log(`    ${DIM}Owner:${RESET}       ${instance.owner}`);
	if (instance.technology) log(`    ${DIM}Technology:${RESET}  ${instance.technology}`);
	if (instance.domain) log(`    ${DIM}Domain:${RESET}      ${instance.domain}`);
	if (instance.icon) log(`    ${DIM}Icon:${RESET}        ${instance.icon}`);
	if (instance.containedBy) log(`    ${DIM}Contained by:${RESET} ${instance.containedBy}`);

	// Ancestry + siblings
	if (component.containedBy) {
		log(`    ${DIM}Path:${RESET}        ${buildAncestryPath(component, allComponents)}`);
	}
	const siblings = findSiblings(component, allComponents);
	if (siblings.length > 0) {
		log(`    ${DIM}Siblings:${RESET}    ${siblings.map((c) => c.name).join(", ")}`);
	}

	// Properties
	if (instance.properties && Object.keys(instance.properties).length > 0) {
		log();
		log(`    ${CYAN}Properties:${RESET}`);
		for (const [key, val] of Object.entries(instance.properties)) {
			log(`      ${key}: ${DIM}${JSON.stringify(val)}${RESET}`);
		}
	}

	// Actions
	if (instance.actions && instance.actions.length > 0) {
		log();
		log(`    ${CYAN}Actions:${RESET}`);
		for (const action of instance.actions) {
			log(`      ${action}`);
		}
	}

	// Variants
	if (instance.variants && Object.keys(instance.variants).length > 0) {
		log();
		log(`    ${CYAN}Variants:${RESET}`);
		for (const [name, props] of Object.entries(instance.variants)) {
			log(`      ${name}: ${DIM}${JSON.stringify(props)}${RESET}`);
		}
	}

	// States
	if (instance.states && Object.keys(instance.states).length > 0) {
		log();
		log(`    ${CYAN}States:${RESET}`);
		for (const [name, props] of Object.entries(instance.states)) {
			log(`      ${name}: ${DIM}${JSON.stringify(props)}${RESET}`);
		}
	}

	// Children
	if (instance.children && instance.children.length > 0) {
		log();
		log(`    ${CYAN}Children:${RESET}`);
		for (const child of instance.children) {
			const slot = child.slot ? ` ${DIM}[${child.slot}]${RESET}` : "";
			const opt = child.optional ? ` ${DIM}(optional)${RESET}` : "";
			log(`      ${child.name}${slot}${opt}`);
		}
	}

	// Stores
	if (instance.stores && instance.stores.length > 0) {
		log();
		log(`    ${CYAN}Stores:${RESET}`);
		for (const store of instance.stores) {
			const tech = store.technology ? ` ${DIM}[${store.technology}]${RESET}` : "";
			const desc = store.description ? ` ${DIM}${store.description}${RESET}` : "";
			log(`      ${store.name}${tech}${desc}`);
		}
	}

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
): Promise<MenuResult> {
	const domain = component.domain;
	const instance = readComponentInstance(projectRoot, component.name, editorDeps(), domain);
	if (!instance) {
		log(`\n  ${DIM}No definition JSON found for ${component.name}.${RESET}\n`);
		await input.waitForEnter();
		return undefined;
	}

	renderComponentDetail(instance, component, allComponents);

	const items: MenuEntry[] = [
		{
			key: "e",
			label: "Edit Fields",
			action: async () => { await editFieldsMenu(projectRoot, component.name, instance, domain); },
		},
		{
			key: "p",
			label: "Edit Properties",
			action: async () => { await editPropertiesMenu(projectRoot, component.name, instance, domain); },
		},
		{
			key: "a",
			label: "Edit Actions",
			action: async () => { await editActionsMenu(projectRoot, component.name, instance, domain); },
		},
		{
			key: "c",
			label: "Edit Children",
			action: async () => { await editChildrenMenu(projectRoot, component.name, instance, allComponents, domain); },
		},
		{
			key: "s",
			label: "Edit Stores",
			action: async () => { await editStoresMenu(projectRoot, component.name, instance, domain); },
		},
	];

	if (component.isDirty) {
		items.push({
			key: "r",
			label: "Regenerate Files",
			action: async () => {
				const confirmed = await input.askYesNo(`Regenerate ${component.name}?`);
				if (!confirmed) {
					log(`\n  ${DIM}Cancelled.${RESET}\n`);
					return;
				}
				const fw = getFrameworkPackages(getFramework(projectRoot, { disk, paths }));
				const result = regenerateComponent(component.name, projectRoot, { disk, paths, clock }, domain, fw.framework);
				if (result.success) {
					component.isDirty = false;
					log(`\n  ${GREEN}Regenerated ${result.filesWritten} file(s). Component is now fresh.${RESET}\n`);
				} else {
					log(`\n  ${YELLOW}${result.error}${RESET}\n`);
				}
			},
		});
	}

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	return runMenu(`${instance.name}`, items);
}

// ── Edit Fields submenu ─────────────────────────────────────────────

async function editFieldsMenu(projectRoot: string, componentName: string, instance: ComponentInstance, domain?: string): Promise<void> {
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

async function editPropertiesMenu(projectRoot: string, componentName: string, instance: ComponentInstance, domain?: string): Promise<void> {
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

async function editActionsMenu(projectRoot: string, componentName: string, instance: ComponentInstance, domain?: string): Promise<void> {
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

// ── Edit Children submenu ────────────────────────────────────────────

async function editChildrenMenu(
	projectRoot: string, componentName: string, instance: ComponentInstance, allComponents: ProjectComponent[], domain?: string,
): Promise<void> {
	const children = instance.children ?? [];

	const items: MenuEntry[] = children.map((child, i) => ({
		key: String(i + 1),
		label: `${child.name}${child.slot ? `  ${DIM}[${child.slot}]${RESET}` : ""}${child.optional ? `  ${DIM}(optional)${RESET}` : ""}`,
		action: async () => {
			const remove = await input.askYesNo(`Remove child "${child.name}"?`);
			if (remove) {
				removeChild(instance, child.name);
				writeComponentInstance(projectRoot, componentName, instance, editorDeps(), domain);
				log(`  ${YELLOW}Removed ${child.name}.${RESET}`);
				await input.waitForEnter();
			}
		},
	}));

	items.push(
		{ separator: true },
		{
			key: "n",
			label: "Add Child",
			action: async () => {
				const available = allComponents
					.filter((c) => c.name !== componentName)
					.filter((c) => !(instance.children ?? []).some((ch) => ch.name === c.name));
				if (available.length === 0) {
					log(`\n  ${DIM}No available components to add as children.${RESET}\n`);
					return;
				}
				const childItems: MenuEntry[] = available.map((c, i) => ({
					key: String(i + 1),
					label: `${c.name}  ${DIM}${c.kind}${RESET}`,
					action: async () => {
						const slot = await input.ask("Slot (optional, e.g. header, sidebar)", "");
						const optAnswer = await input.askYesNo("Optional?");
						const child: ComponentInstanceChild = { name: c.name };
						if (slot) child.slot = slot;
						if (optAnswer) child.optional = true;
						addChild(instance, child);
						writeComponentInstance(projectRoot, componentName, instance, editorDeps(), domain);
						log(`  ${GREEN}Added ${c.name}.${RESET}`);
						await input.waitForEnter();
					},
				}));
				childItems.push(
					{ separator: true },
					{ key: "b", label: "Back", action: () => "main" as const },
				);
				await runMenu("Add Child Component", childItems);
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	await runMenu("Edit Children", items);
}

// ── Edit Stores submenu ─────────────────────────────────────────────

async function editStoresMenu(projectRoot: string, componentName: string, instance: ComponentInstance, domain?: string): Promise<void> {
	const stores = instance.stores ?? [];

	const items: MenuEntry[] = stores.map((store, i) => {
		const tech = store.technology ? `  ${DIM}[${store.technology}]${RESET}` : "";
		const desc = store.description ? `  ${DIM}${store.description}${RESET}` : "";
		return {
			key: String(i + 1),
			label: `${store.name}${tech}${desc}`,
			action: async () => {
				const remove = await input.askYesNo(`Remove store "${store.name}"?`);
				if (remove) {
					removeStore(instance, store.name);
					writeComponentInstance(projectRoot, componentName, instance, editorDeps(), domain);
					log(`  ${YELLOW}Removed ${store.name}.${RESET}`);
					await input.waitForEnter();
				}
			},
		};
	});

	items.push(
		{ separator: true },
		{
			key: "n",
			label: "Add Store",
			action: async () => {
				const name = await input.ask("Store name (e.g. useAuthStore)");
				if (!name) return;
				const technology = await input.ask("Technology (e.g. pinia, redux, zustand)", "");
				const description = await input.ask("Description (optional)", "");
				const store: ComponentInstanceStore = { name };
				if (technology) store.technology = technology;
				if (description) store.description = description;
				addStore(instance, store);
				writeComponentInstance(projectRoot, componentName, instance, editorDeps(), domain);
				log(`  ${GREEN}Added ${name}.${RESET}`);
				await input.waitForEnter();
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	await runMenu("Edit Stores", items);
}

// ── Action reference browser ────────────────────────────────────────

export async function actionReferenceMenu(): Promise<void> {
	const items: MenuEntry[] = ACTION_REFERENCE.map((cat, i) => ({
		key: String(i + 1),
		label: `${cat.category}  ${DIM}(${cat.actions.length})${RESET}`,
		action: async () => {
			log();
			log(`  ${BOLD}${cat.category} Actions${RESET}`);
			log();
			for (const a of cat.actions) {
				log(`    ${CYAN}${a.name}${RESET}  ${DIM}${a.description}${RESET}`);
			}
			log();
			await input.waitForEnter();
		},
	}));

	items.push(
		{ separator: true },
		{
			key: "s",
			label: "Search",
			action: async () => {
				const term = await input.ask("Search actions");
				if (!term) return;
				const results = searchActions(term);
				if (results.length === 0) {
					log(`\n  ${DIM}No actions matching "${term}".${RESET}\n`);
					return;
				}
				for (const cat of results) {
					log(`\n  ${BOLD}${cat.category}${RESET}`);
					for (const a of cat.actions) {
						log(`    ${CYAN}${a.name}${RESET}  ${DIM}${a.description}${RESET}`);
					}
				}
				log();
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	await runMenu("Action Reference", items);
}

async function addFromReferenceMenu(projectRoot: string, componentName: string, instance: ComponentInstance, domain?: string): Promise<void> {
	const existing = new Set(instance.actions ?? []);

	const items: MenuEntry[] = ACTION_REFERENCE.map((cat, i) => ({
		key: String(i + 1),
		label: `${cat.category}  ${DIM}(${cat.actions.length})${RESET}`,
		action: async () => { await addFromCategoryMenu(projectRoot, componentName, instance, cat, existing, domain); },
	}));

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	await runMenu("Choose Category", items);
}

async function addFromCategoryMenu(
	projectRoot: string, componentName: string, instance: ComponentInstance,
	cat: ActionCategory, existing: Set<string>, domain?: string,
): Promise<void> {
	const items: MenuEntry[] = cat.actions.map((a, i) => {
		const alreadyAdded = existing.has(a.name);
		return {
			key: String(i + 1),
			label: `${a.name}  ${DIM}${a.description}${RESET}${alreadyAdded ? `  ${GREEN}(added)${RESET}` : ""}`,
			action: async () => {
				if (alreadyAdded) {
					log(`\n  ${DIM}${a.name} already exists.${RESET}\n`);
					return;
				}
				addAction(instance, a.name);
				writeComponentInstance(projectRoot, componentName, instance, editorDeps(), domain);
				existing.add(a.name);
				log(`  ${GREEN}Added ${a.name}.${RESET}`);
				await input.waitForEnter();
			},
		};
	});

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	await runMenu(`${cat.category} Actions`, items);
}

// ── Helpers ──────────────────────────────────────────────────────────

function parseValue(str: string): unknown {
	if (str === "true") return true;
	if (str === "false") return false;
	const num = Number(str);
	if (!isNaN(num) && str.trim() !== "") return num;
	return str;
}
