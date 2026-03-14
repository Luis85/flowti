/**
 * raid-menu.ts — Interactive RAID log menu.
 */

import { printHeader } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { RAIDConfig, RAIDItemType, RAIDStatus } from "../../infrastructure/types.js";
import { collectFields, selectFromList, selectStatus } from "../../infrastructure/menu-helpers.js";
import { listRAIDItems, createRAIDItem, updateRAIDStatus } from "../../domain/raid/raid-store.js";
import { renderRAIDAdded, renderRAIDUpdated } from "../displays/raid-display.js";

const STATUSES: RAIDStatus[] = ["open", "mitigated", "closed", "accepted", "resolved", "deferred"];

export async function addRAIDInteractive(itemType: RAIDItemType, projectPath: string, config: RAIDConfig | undefined, deps: MenuDeps): Promise<void> {
	const labels: Record<RAIDItemType, string> = {
		risk: "Risk", assumption: "Assumption", issue: "Issue", dependency: "Dependency", decision: "Decision",
	};
	printHeader(`Add ${labels[itemType]}`);

	const data = await collectFields([
		{ key: "name", label: "Name", required: true },
		{ key: "description", label: "Description" },
		{ key: "severity", label: "Severity (critical/high/medium/low)", default: "medium" },
		{ key: "owner", label: "Owner" },
		{ key: "dueDate", label: "Due date (YYYY-MM-DD)" },
		{ key: "category", label: "Category (technical/business/organizational/external)", default: "technical" },
	], deps.input);
	if (!data) return;

	const filePath = createRAIDItem(deps, projectPath, {
		name: data.name,
		itemType,
		status: "open",
		severity: data.severity as "critical" | "high" | "medium" | "low",
		owner: data.owner || undefined,
		dueDate: data.dueDate || undefined,
		category: data.category as "technical" | "business" | "organizational" | "external",
		description: data.description,
	}, config);

	if (filePath) {
		renderRAIDAdded(deps.paths.relative(projectPath, filePath), deps.log);
	}
}

export async function updateStatusInteractive(projectPath: string, config: RAIDConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Update RAID Item Status");

	const items = listRAIDItems(deps, projectPath, config);
	const item = await selectFromList(items, deps, {
		format: (i) => `${i.name} [${i.itemType}] [${i.status}]`,
		emptyMessage: "No RAID items to update.",
	});
	if (!item) return;

	const newStatus = await selectStatus(STATUSES, item.status, deps);
	if (!newStatus) return;

	const ok = updateRAIDStatus(deps, projectPath, item.name, newStatus, config);
	if (ok) {
		renderRAIDUpdated(item.name, newStatus, deps.log);
	}
}
