/**
 * resources-menu.ts — Interactive resource management menu.
 */

import { paths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { clock } from "../../infrastructure/clock.js";
import { printHeader } from "../../infrastructure/ui.js";
import { input } from "../../infrastructure/input.js";
import type { ResourcesConfig, ResourceType } from "../../infrastructure/types.js";
import { createResourceFile } from "../../domain/resources/resource-store.js";
import { renderResourceAdded } from "../resources-display.js";

function storeDeps() { return { disk, paths, clock } as const; }

export async function addResourceInteractive(projectPath: string, resourceType: ResourceType, config?: ResourcesConfig): Promise<void> {
	const labels: Record<ResourceType, string> = { role: "Role", material: "Material Resource", human: "Human Resource", budget: "Budget" };
	printHeader(`Add ${labels[resourceType]}`);

	const name = await input.ask("Name");
	if (!name) return;

	const description = await input.ask("Description", "");

	let price = 0;
	let hourlyRate: number | undefined;
	let role: string | undefined;
	let amount = 1;
	let category: string | undefined;
	let currency: string | undefined;
	let periodStart: string | undefined;
	let periodEnd: string | undefined;

	if (resourceType === "budget") {
		amount = parseFloat(await input.ask("Total amount", "0"));
		currency = await input.ask("Currency", "EUR");
		category = await input.ask("Category", "general");
		periodStart = await input.ask("Period start (YYYY-MM-DD)", "");
		periodEnd = await input.ask("Period end (YYYY-MM-DD)", "");
		price = 1;
	} else if (resourceType === "role") {
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
		category: category || undefined,
		currency: currency || undefined,
		periodStart: periodStart || undefined,
		periodEnd: periodEnd || undefined,
	}, config);

	if (filePath) {
		renderResourceAdded(paths.relative(projectPath, filePath));
	}
}
