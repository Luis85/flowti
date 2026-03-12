/**
 * project-lifecycle-menu.ts — Lifecycle management submenu within a project.
 *
 * Provides access to the project's own lifecycle plus nested features and products.
 */

import { runMenu } from "../../infrastructure/menu.js";
import type { MenuResult, MenuEntry, ProjectContext } from "../../infrastructure/types.js";

export async function projectLifecycleMenu(ctx: ProjectContext): Promise<MenuResult> {
	const mgmt = ctx.config.management;
	const items: MenuEntry[] = [
		{
			key: "1",
			label: "Project Lifecycle",
			action: async () => {
				const { lifecycleStatusMenu } = await import("./lifecycle-menu.js");
				return lifecycleStatusMenu(ctx.path, ctx.config.name, "project");
			},
		},
		{
			key: "2",
			label: "Features",
			action: async () => {
				const { nestedItemsMenu } = await import("./nested-lifecycle-menu.js");
				return nestedItemsMenu(ctx.path, "feature", mgmt?.lifecycle?.featuresDir);
			},
		},
		{
			key: "3",
			label: "Products",
			action: async () => {
				const { nestedItemsMenu } = await import("./nested-lifecycle-menu.js");
				return nestedItemsMenu(ctx.path, "product", mgmt?.lifecycle?.productsDir);
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	];

	return runMenu("Lifecycle Management", items);
}
