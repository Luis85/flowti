/**
 * raid-menu.ts — Interactive RAID log menu.
 */

import { printHeader } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { RAIDConfig, RAIDItemType, RAIDStatus } from "../../infrastructure/types.js";
import { listRAIDItems, createRAIDItem, updateRAIDStatus } from "../../domain/raid/raid-store.js";
import { renderRAIDAdded, renderRAIDUpdated } from "../displays/raid-display.js";

const STATUSES: RAIDStatus[] = ["open", "mitigated", "closed", "accepted", "resolved", "deferred"];

export async function addRAIDInteractive(itemType: RAIDItemType, projectPath: string, config: RAIDConfig | undefined, deps: MenuDeps): Promise<void> {
	const labels: Record<RAIDItemType, string> = {
		risk: "Risk", assumption: "Assumption", issue: "Issue", dependency: "Dependency", decision: "Decision",
	};
	printHeader(`Add ${labels[itemType]}`);

	const name = await deps.input.ask("Name");
	if (!name) return;

	const description = await deps.input.ask("Description", "");
	const severity = (await deps.input.ask("Severity (critical/high/medium/low)", "medium")) as "critical" | "high" | "medium" | "low";
	const owner = await deps.input.ask("Owner", "");
	const dueDate = await deps.input.ask("Due date (YYYY-MM-DD)", "");
	const category = (await deps.input.ask("Category (technical/business/organizational/external)", "technical")) as "technical" | "business" | "organizational" | "external";

	const filePath = createRAIDItem(deps, projectPath, {
		name,
		itemType,
		status: "open",
		severity,
		owner: owner || undefined,
		dueDate: dueDate || undefined,
		category,
		description,
	}, config);

	if (filePath) {
		renderRAIDAdded(deps.paths.relative(projectPath, filePath), deps.log);
	}
}

export async function updateStatusInteractive(projectPath: string, config: RAIDConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Update RAID Item Status");

	const items = listRAIDItems(deps, projectPath, config);
	if (items.length === 0) {
		deps.log(`\n  No RAID items to update.\n`);
		return;
	}

	for (let i = 0; i < items.length; i++) {
		deps.log(`  ${i + 1}. ${items[i].name} [${items[i].itemType}] [${items[i].status}]`);
	}
	const choice = await deps.input.ask("Select item (number)");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= items.length) return;

	const item = items[idx];
	deps.log(`\n  Statuses: ${STATUSES.join(", ")}`);
	const newStatus = await deps.input.ask("New status", item.status) as RAIDStatus;
	if (!STATUSES.includes(newStatus)) return;

	const ok = updateRAIDStatus(deps, projectPath, item.name, newStatus, config);
	if (ok) {
		renderRAIDUpdated(item.name, newStatus, deps.log);
	}
}
