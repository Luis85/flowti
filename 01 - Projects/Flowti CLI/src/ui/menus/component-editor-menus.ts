/**
 * component-editor-menus.ts — Component editor submenus extracted for file size.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { input } from "../../infrastructure/input.js";
import { runMenu } from "../../infrastructure/menu.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, DIM, GREEN, YELLOW } from "../../infrastructure/ui.js";
import type { MenuEntry } from "../../infrastructure/types.js";
import type { ComponentInstance, ComponentInstanceStore } from "../../domain/make/component/component-editor.js";
import { addStore, removeStore, writeComponentInstance } from "../../domain/make/component/component-editor.js";

function editorDeps() { return { disk, paths } as const; }

export async function editStoresMenu(projectRoot: string, componentName: string, instance: ComponentInstance, domain?: string): Promise<void> {
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
