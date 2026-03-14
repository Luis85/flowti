/**
 * resources-menu.ts — Interactive resource management menu.
 */

import { printHeader } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { ResourcesConfig, ResourceType } from "../../infrastructure/types.js";
import { createResourceFile } from "../../domain/resources/resource-store.js";
import { renderResourceAdded } from "../displays/resources-display.js";

export async function addResourceInteractive(projectPath: string, resourceType: ResourceType, config: ResourcesConfig | undefined, deps: MenuDeps): Promise<void> {
	const labels: Record<ResourceType, string> = { role: "Role", material: "Material Resource", human: "Human Resource", budget: "Budget" };
	printHeader(`Add ${labels[resourceType]}`);

	const name = await deps.input.ask("Name");
	if (!name) return;

	const description = await deps.input.ask("Description", "");

	let price = 0;
	let hourlyRate: number | undefined;
	let role: string | undefined;
	let amount = 1;
	let category: string | undefined;
	let currency: string | undefined;
	let periodStart: string | undefined;
	let periodEnd: string | undefined;

	if (resourceType === "budget") {
		amount = parseFloat(await deps.input.ask("Total amount", "0"));
		currency = await deps.input.ask("Currency", "EUR");
		category = await deps.input.ask("Category", "general");
		periodStart = await deps.input.ask("Period start (YYYY-MM-DD)", "");
		periodEnd = await deps.input.ask("Period end (YYYY-MM-DD)", "");
		price = 1;
	} else if (resourceType === "role") {
		hourlyRate = parseFloat(await deps.input.ask("Hourly rate", "0"));
		price = hourlyRate;
		amount = parseFloat(await deps.input.ask("FTE amount", "1"));
	} else if (resourceType === "human") {
		role = await deps.input.ask("Role", "");
		price = parseFloat(await deps.input.ask("Price per hour", "0"));
		amount = parseFloat(await deps.input.ask("FTE amount", "1"));
	} else {
		price = parseFloat(await deps.input.ask("Unit price", "0"));
		amount = parseFloat(await deps.input.ask("Quantity", "1"));
	}

	const filePath = createResourceFile(deps, projectPath, {
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
		renderResourceAdded(deps.paths.relative(projectPath, filePath), deps.log);
	}
}
