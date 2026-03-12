/**
 * resources-menu.ts — Interactive resource management menu.
 */

import { paths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { clock } from "../../infrastructure/clock.js";
import { printHeader } from "../../infrastructure/ui.js";
import { input } from "../../infrastructure/input.js";
import { runMenu } from "../../infrastructure/menu.js";
import type { MenuResult, MenuEntry, ResourcesConfig, ResourceType } from "../../infrastructure/types.js";
import { listResources, createResourceFile } from "../../domain/resources/resource-store.js";
import { analyzeFinancials } from "../../domain/resources/resource-analysis.js";
import { renderResourceList, renderFinancialSummary, renderResourceAdded } from "../resources-display.js";

function storeDeps() { return { disk, paths, clock } as const; }

async function addResourceInteractive(projectPath: string, resourceType: ResourceType, config?: ResourcesConfig): Promise<void> {
	const label = resourceType === "role" ? "Role" : resourceType === "material" ? "Material Resource" : "Human Resource";
	printHeader(`Add ${label}`);

	const name = await input.ask("Name");
	if (!name) return;

	const description = await input.ask("Description", "");

	let price = 0;
	let hourlyRate: number | undefined;
	let role: string | undefined;
	let amount = 1;

	if (resourceType === "role") {
		hourlyRate = parseFloat(await input.ask("Hourly rate", "0"));
		price = hourlyRate;
		amount = parseFloat(await input.ask("FTE amount", "1"));
	} else if (resourceType === "human") {
		role = await input.ask("Role", "");
		price = parseFloat(await input.ask("Price per hour", "0"));
		amount = parseFloat(await input.ask("FTE amount", "1"));
	} else {
		price = parseFloat(await input.ask("Unit price", "0"));
		amount = parseFloat(await input.ask("Quantity", "1"));
	}

	const filePath = createResourceFile(storeDeps(), projectPath, {
		name,
		resourceType,
		role,
		price,
		hourlyRate,
		amount,
		consumed: 0,
		status: "active",
		description,
	}, config);

	if (filePath) {
		renderResourceAdded(paths.relative(projectPath, filePath));
	}
}

export async function resourcesMenu(projectPath: string, config?: ResourcesConfig): Promise<MenuResult> {
	const items: MenuEntry[] = [
		{
			key: "1",
			label: "List Resources",
			action: () => {
				renderResourceList(listResources(storeDeps(), projectPath, config));
				return "main" as const;
			},
		},
		{
			key: "2",
			label: "Add Human Resource",
			action: async () => {
				await addResourceInteractive(projectPath, "human", config);
				return "main" as const;
			},
		},
		{
			key: "3",
			label: "Add Material Resource",
			action: async () => {
				await addResourceInteractive(projectPath, "material", config);
				return "main" as const;
			},
		},
		{
			key: "4",
			label: "Add Role",
			action: async () => {
				await addResourceInteractive(projectPath, "role", config);
				return "main" as const;
			},
		},
		{
			key: "5",
			label: "Financial Summary",
			action: () => {
				const resources = listResources(storeDeps(), projectPath, config);
				renderFinancialSummary(analyzeFinancials(resources));
				return "main" as const;
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	];

	return runMenu("Resources", items);
}
