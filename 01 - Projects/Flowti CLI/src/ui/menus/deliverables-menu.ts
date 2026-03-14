/**
 * deliverables-menu.ts — Interactive deliverables management menu.
 */

import { printHeader } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { DeliverablesConfig, DeliverableStatus } from "../../infrastructure/types.js";
import { listDeliverables, createDeliverableFile, updateDeliverableStatus } from "../../domain/deliverables/deliverable-store.js";
import { renderDeliverableAdded, renderDeliverableUpdated } from "../displays/deliverables-display.js";

const STATUSES: DeliverableStatus[] = ["planned", "in-progress", "review", "done", "blocked"];

export async function addDeliverableInteractive(projectPath: string, config: DeliverablesConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Add Deliverable");

	const name = await deps.input.ask("Name");
	if (!name) return;

	const description = await deps.input.ask("Description", "");
	const dueDate = await deps.input.ask("Due date (YYYY-MM-DD)", "");
	const assignee = await deps.input.ask("Assignee", "");
	const priority = await deps.input.ask("Priority (low/medium/high)", "medium");

	const filePath = createDeliverableFile(deps, projectPath, {
		name,
		status: "planned",
		dueDate: dueDate || undefined,
		assignee: assignee || undefined,
		priority: priority || undefined,
		completionPct: 0,
		description,
	}, config);

	if (filePath) {
		renderDeliverableAdded(deps.paths.relative(projectPath, filePath), deps.log);
	}
}

export async function updateStatusInteractive(projectPath: string, config: DeliverablesConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Update Deliverable Status");

	const deliverables = listDeliverables(deps, projectPath, config);
	if (deliverables.length === 0) {
		deps.log(`\n  No deliverables to update.\n`);
		return;
	}

	for (let i = 0; i < deliverables.length; i++) {
		deps.log(`  ${i + 1}. ${deliverables[i].name} [${deliverables[i].status}]`);
	}
	const choice = await deps.input.ask("Select deliverable (number)");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= deliverables.length) return;

	const d = deliverables[idx];
	deps.log(`\n  Statuses: ${STATUSES.join(", ")}`);
	const newStatus = await deps.input.ask("New status", d.status) as DeliverableStatus;
	if (!STATUSES.includes(newStatus)) return;

	const pctStr = await deps.input.ask("Completion %", String(d.completionPct));
	const pct = parseInt(pctStr, 10);

	const ok = updateDeliverableStatus(deps, projectPath, d.name, newStatus, isNaN(pct) ? undefined : pct, config);
	if (ok) {
		renderDeliverableUpdated(d.name, newStatus, deps.log);
	}
}
