/**
 * deliverables-menu.ts — Interactive deliverables management menu.
 */

import { printHeader } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { DeliverablesConfig, DeliverableStatus } from "../../infrastructure/types.js";
import { collectFields, selectFromList, selectStatus } from "../../infrastructure/menu-helpers.js";
import { listDeliverables, createDeliverableFile, updateDeliverableStatus } from "../../domain/deliverables/deliverable-store.js";
import { renderDeliverableAdded, renderDeliverableUpdated } from "../displays/deliverables-display.js";

const STATUSES: DeliverableStatus[] = ["planned", "in-progress", "review", "done", "blocked"];

export async function addDeliverableInteractive(projectPath: string, config: DeliverablesConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Add Deliverable");

	const data = await collectFields([
		{ key: "name", label: "Name", required: true },
		{ key: "description", label: "Description" },
		{ key: "dueDate", label: "Due date (YYYY-MM-DD)" },
		{ key: "assignee", label: "Assignee" },
		{ key: "priority", label: "Priority (low/medium/high)", default: "medium" },
	], deps.input);
	if (!data) return;

	const filePath = createDeliverableFile(deps, projectPath, {
		name: data.name,
		status: "planned",
		dueDate: data.dueDate || undefined,
		assignee: data.assignee || undefined,
		priority: data.priority || undefined,
		completionPct: 0,
		description: data.description,
	}, config);

	if (filePath) {
		renderDeliverableAdded(deps.paths.relative(projectPath, filePath), deps.log);
	}
}

export async function updateStatusInteractive(projectPath: string, config: DeliverablesConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Update Deliverable Status");

	const deliverables = listDeliverables(deps, projectPath, config);
	const d = await selectFromList(deliverables, deps, {
		format: (item) => `${item.name} [${item.status}]`,
		emptyMessage: "No deliverables to update.",
	});
	if (!d) return;

	const newStatus = await selectStatus(STATUSES, d.status, deps);
	if (!newStatus) return;

	const pctStr = await deps.input.ask("Completion %", String(d.completionPct));
	const pct = parseInt(pctStr, 10);

	const ok = updateDeliverableStatus(deps, projectPath, d.name, newStatus, isNaN(pct) ? undefined : pct, config);
	if (ok) {
		renderDeliverableUpdated(d.name, newStatus, deps.log);
	}
}
