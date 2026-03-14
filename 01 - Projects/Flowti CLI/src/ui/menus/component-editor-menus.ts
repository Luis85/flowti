/**
 * component-editor-menus.ts — Component editor submenus extracted for file size.
 */

import { runMenu } from "../../infrastructure/menu.js";
import { RESET, DIM, GREEN, YELLOW } from "../../infrastructure/ui.js";
import type { MenuEntry } from "../../infrastructure/types.js";
import type { EditorMenuDeps } from "../../infrastructure/deps.js";
import type { ProjectComponent } from "../../domain/make/component/component-types.js";
import type { ComponentInstance, ComponentInstanceChild, ComponentInstanceStore } from "../../domain/make/component/component-editor.js";
import { addStore, removeStore, addChild, removeChild, writeComponentInstance } from "../../domain/make/component/component-editor.js";

export async function editStoresMenu(projectRoot: string, componentName: string, instance: ComponentInstance, domain: string | undefined, deps: EditorMenuDeps): Promise<void> {
	const stores = instance.stores ?? [];

	const items: MenuEntry[] = stores.map((store, i) => {
		const tech = store.technology ? `  ${DIM}[${store.technology}]${RESET}` : "";
		const desc = store.description ? `  ${DIM}${store.description}${RESET}` : "";
		return {
			key: String(i + 1),
			label: `${store.name}${tech}${desc}`,
			action: async () => {
				const remove = await deps.input.askYesNo(`Remove store "${store.name}"?`);
				if (remove) {
					removeStore(instance, store.name);
					writeComponentInstance(projectRoot, componentName, instance, deps, domain);
					deps.log(`  ${YELLOW}Removed ${store.name}.${RESET}`);
					await deps.input.waitForEnter();
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
				const name = await deps.input.ask("Store name (e.g. useAuthStore)");
				if (!name) return;
				const technology = await deps.input.ask("Technology (e.g. pinia, redux, zustand)", "");
				const description = await deps.input.ask("Description (optional)", "");
				const store: ComponentInstanceStore = { name };
				if (technology) store.technology = technology;
				if (description) store.description = description;
				addStore(instance, store);
				writeComponentInstance(projectRoot, componentName, instance, deps, domain);
				deps.log(`  ${GREEN}Added ${name}.${RESET}`);
				await deps.input.waitForEnter();
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	await runMenu("Edit Stores", items);
}

export async function editChildrenMenu(
	projectRoot: string, componentName: string, instance: ComponentInstance, allComponents: ProjectComponent[], domain: string | undefined, deps: EditorMenuDeps,
): Promise<void> {
	const children = instance.children ?? [];

	const items: MenuEntry[] = children.map((child, i) => ({
		key: String(i + 1),
		label: `${child.name}${child.slot ? `  ${DIM}[${child.slot}]${RESET}` : ""}${child.optional ? `  ${DIM}(optional)${RESET}` : ""}`,
		action: async () => {
			const remove = await deps.input.askYesNo(`Remove child "${child.name}"?`);
			if (remove) {
				removeChild(instance, child.name);
				writeComponentInstance(projectRoot, componentName, instance, deps, domain);
				deps.log(`  ${YELLOW}Removed ${child.name}.${RESET}`);
				await deps.input.waitForEnter();
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
					deps.log(`\n  ${DIM}No available components to add as children.${RESET}\n`);
					return;
				}
				const childItems: MenuEntry[] = available.map((c, i) => ({
					key: String(i + 1),
					label: `${c.name}  ${DIM}${c.kind}${RESET}`,
					action: async () => {
						const slot = await deps.input.ask("Slot (optional, e.g. header, sidebar)", "");
						const optAnswer = await deps.input.askYesNo("Optional?");
						const child: ComponentInstanceChild = { name: c.name };
						if (slot) child.slot = slot;
						if (optAnswer) child.optional = true;
						addChild(instance, child);
						writeComponentInstance(projectRoot, componentName, instance, deps, domain);
						deps.log(`  ${GREEN}Added ${c.name}.${RESET}`);
						await deps.input.waitForEnter();
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
