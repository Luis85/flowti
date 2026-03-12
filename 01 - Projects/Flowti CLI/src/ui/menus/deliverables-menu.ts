/**
 * deliverables-menu.ts — Interactive deliverables management menu.
 */

import { paths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { clock } from "../../infrastructure/clock.js";
import { printHeader } from "../../infrastructure/ui.js";
import { input } from "../../infrastructure/input.js";
import { runMenu } from "../../infrastructure/menu.js";
import { log } from "../../infrastructure/logger.js";
import type { MenuResult, MenuEntry, DeliverablesConfig, DeliverableStatus } from "../../infrastructure/types.js";
import { listDeliverables, createDeliverableFile, updateDeliverableStatus } from "../../domain/deliverables/deliverable-store.js";
import { renderDeliverableList, renderDeliverableAdded, renderDeliverableUpdated } from "../deliverables-display.js";

function storeDeps() { return { disk, paths, clock } as const; }

const STATUSES: DeliverableStatus[] = ["planned", "in-progress", "review", "done", "blocked"];

async function addDeliverableInteractive(projectPath: string, config?: DeliverablesConfig): Promise<void> {
	printHeader("Add Deliverable");

	const name = await input.ask("Name");
	if (!name) return;

	const description = await input.ask("Description", "");
	const dueDate = await input.ask("Due date (YYYY-MM-DD)", "");
	const assignee = await input.ask("Assignee", "");
	const priority = await input.ask("Priority (low/medium/high)", "medium");

	const filePath = createDeliverableFile(storeDeps(), projectPath, {
		name,
		status: "planned",
		dueDate: dueDate || undefined,
		assignee: assignee || undefined,
		priority: priority || undefined,
		completionPct: 0,
		description,
	}, config);

	if (filePath) {
		renderDeliverableAdded(paths.relative(projectPath, filePath));
	}
}

async function updateStatusInteractive(projectPath: string, config?: DeliverablesConfig): Promise<void> {
	printHeader("Update Deliverable Status");

	const deliverables = listDeliverables(storeDeps(), projectPath, config);
	if (deliverables.length === 0) {
		log(`\n  No deliverables to update.\n`);
		return;
	}

	for (let i = 0; i < deliverables.length; i++) {
		log(`  ${i + 1}. ${deliverables[i].name} [${deliverables[i].status}]`);
	}
	const choice = await input.ask("Select deliverable (number)");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= deliverables.length) return;

	const d = deliverables[idx];
	log(`\n  Statuses: ${STATUSES.join(", ")}`);
	const newStatus = await input.ask("New status", d.status) as DeliverableStatus;
	if (!STATUSES.includes(newStatus)) return;

	const pctStr = await input.ask("Completion %", String(d.completionPct));
	const pct = parseInt(pctStr, 10);

	const ok = updateDeliverableStatus(storeDeps(), projectPath, d.name, newStatus, isNaN(pct) ? undefined : pct, config);
	if (ok) {
		renderDeliverableUpdated(d.name, newStatus);
	}
}

export async function deliverablesMenu(projectPath: string, config?: DeliverablesConfig): Promise<MenuResult> {
	const items: MenuEntry[] = [
		{
			key: "1",
			label: "List Deliverables",
			action: async () => {
				renderDeliverableList(listDeliverables(storeDeps(), projectPath, config));
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "2",
			label: "Add Deliverable",
			action: async () => {
				await addDeliverableInteractive(projectPath, config);
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "3",
			label: "Update Status",
			action: async () => {
				await updateStatusInteractive(projectPath, config);
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	];

	return runMenu("Deliverables", items);
}
