/**
 * nested-lifecycle-menu.ts — Menu for managing nested lifecycle items within a project.
 *
 * Lists features or products inside a project and allows creating/opening them.
 */

import { printHeader } from "../../infrastructure/ui.js";
import { runMenu } from "../../infrastructure/menu.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { MenuResult, MenuEntry, EntityType } from "../../infrastructure/types.js";
import { listLifecycleItems, createLifecycleFile } from "../../domain/lifecycle/lifecycle-store.js";
import { renderLifecycleList, renderLifecycleCreated } from "../displays/lifecycle-display.js";

function defaultSubdir(entityType: EntityType): string {
	return entityType === "feature" ? "docs/features" : "docs/products";
}

async function createItemInteractive(projectPath: string, entityType: EntityType, subdir: string, deps: MenuDeps): Promise<void> {
	const label = entityType === "feature" ? "Feature" : "Product";
	printHeader(`Create ${label}`);

	const name = await deps.input.ask("Name");
	if (!name) return;

	const description = await deps.input.ask("Description", "");

	const filePath = createLifecycleFile(deps, projectPath, entityType, name, description || undefined, subdir);
	if (filePath) {
		renderLifecycleCreated(deps.paths.relative(projectPath, filePath), deps.log);
	} else {
		deps.log(`\n  Item "${name}" already exists.`);
	}
}

export async function nestedItemsMenu(projectPath: string, entityType: EntityType, deps: MenuDeps, configDir?: string): Promise<MenuResult> {
	const subdir = configDir ?? defaultSubdir(entityType);
	const label = entityType === "feature" ? "Features" : "Products";

	const items: MenuEntry[] = [
		{
			key: "1",
			label: `List ${label}`,
			action: async () => {
				const lifecycleItems = listLifecycleItems(deps, projectPath, subdir);
				renderLifecycleList(lifecycleItems, deps.log);
				await deps.input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "2",
			label: `Create ${entityType === "feature" ? "Feature" : "Product"}`,
			action: async () => {
				await createItemInteractive(projectPath, entityType, subdir, deps);
				await deps.input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "3",
			label: `Open ${entityType === "feature" ? "Feature" : "Product"}`,
			action: async () => {
				const lifecycleItems = listLifecycleItems(deps, projectPath, subdir);
				if (lifecycleItems.length === 0) {
					deps.log(`\n  No ${label.toLowerCase()} found. Create one first.`);
					await deps.input.waitForEnter();
					return "main" as const;
				}

				for (let i = 0; i < lifecycleItems.length; i++) {
					deps.log(`  ${i + 1}. ${lifecycleItems[i].name} [${lifecycleItems[i].currentState}]`);
				}
				const choice = await deps.input.ask("Select (number)");
				const idx = parseInt(choice, 10) - 1;
				if (isNaN(idx) || idx < 0 || idx >= lifecycleItems.length) return "main" as const;

				const selected = lifecycleItems[idx];
				const { lifecycleStatusMenu } = await import("./lifecycle-menu.js");
				return lifecycleStatusMenu(projectPath, selected.name, entityType, deps, subdir);
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	];

	return runMenu(label, items);
}
