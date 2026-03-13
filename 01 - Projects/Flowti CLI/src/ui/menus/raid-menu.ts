/**
 * raid-menu.ts — Interactive RAID log menu.
 */

import { paths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { clock } from "../../infrastructure/clock.js";
import { printHeader } from "../../infrastructure/ui.js";
import { input } from "../../infrastructure/input.js";
import { log } from "../../infrastructure/logger.js";
import type { RAIDConfig, RAIDItemType, RAIDStatus } from "../../infrastructure/types.js";
import { listRAIDItems, createRAIDItem, updateRAIDStatus } from "../../domain/raid/raid-store.js";
import { renderRAIDAdded, renderRAIDUpdated } from "../raid-display.js";

function storeDeps() { return { disk, paths, clock } as const; }

const STATUSES: RAIDStatus[] = ["open", "mitigated", "closed", "accepted", "resolved", "deferred"];

export async function addRAIDInteractive(itemType: RAIDItemType, projectPath: string, config?: RAIDConfig): Promise<void> {
	const labels: Record<RAIDItemType, string> = {
		risk: "Risk", assumption: "Assumption", issue: "Issue", dependency: "Dependency", decision: "Decision",
	};
	printHeader(`Add ${labels[itemType]}`);

	const name = await input.ask("Name");
	if (!name) return;

	const description = await input.ask("Description", "");
	const severity = (await input.ask("Severity (critical/high/medium/low)", "medium")) as "critical" | "high" | "medium" | "low";
	const owner = await input.ask("Owner", "");
	const dueDate = await input.ask("Due date (YYYY-MM-DD)", "");
	const category = (await input.ask("Category (technical/business/organizational/external)", "technical")) as "technical" | "business" | "organizational" | "external";

	const filePath = createRAIDItem(storeDeps(), projectPath, {
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
		renderRAIDAdded(paths.relative(projectPath, filePath));
	}
}

export async function updateStatusInteractive(projectPath: string, config?: RAIDConfig): Promise<void> {
	printHeader("Update RAID Item Status");

	const items = listRAIDItems(storeDeps(), projectPath, config);
	if (items.length === 0) {
		log(`\n  No RAID items to update.\n`);
		return;
	}

	for (let i = 0; i < items.length; i++) {
		log(`  ${i + 1}. ${items[i].name} [${items[i].itemType}] [${items[i].status}]`);
	}
	const choice = await input.ask("Select item (number)");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= items.length) return;

	const item = items[idx];
	log(`\n  Statuses: ${STATUSES.join(", ")}`);
	const newStatus = await input.ask("New status", item.status) as RAIDStatus;
	if (!STATUSES.includes(newStatus)) return;

	const ok = updateRAIDStatus(storeDeps(), projectPath, item.name, newStatus, config);
	if (ok) {
		renderRAIDUpdated(item.name, newStatus);
	}
}
