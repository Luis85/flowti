/**
 * capa-menu.ts — Interactive CAPA (Corrective and Preventive Action) menu.
 */

import { paths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { clock } from "../../infrastructure/clock.js";
import { printHeader } from "../../infrastructure/ui.js";
import { input } from "../../infrastructure/input.js";
import { log } from "../../infrastructure/logger.js";
import type { CAPAConfig, CAPAStatus, CAPAType } from "../../infrastructure/types.js";
import type { CAPASource, CAPASeverity } from "../../domain/capa/capa-types.js";
import { listCAPAItems, createCAPAItem, updateCAPAStatus, nextCapaId } from "../../domain/capa/capa-store.js";
import { renderCAPAList, renderCAPAAdded, renderCAPAUpdated } from "../capa-display.js";

function storeDeps() { return { disk, paths, clock } as const; }

const STATUSES: CAPAStatus[] = ["open", "investigating", "action-planned", "implementing", "verification", "closed", "rejected"];
const SOURCES: CAPASource[] = ["audit", "complaint", "incident", "observation", "review", "other"];

export async function addCAPAInteractive(capaType: CAPAType, projectPath: string, config?: CAPAConfig): Promise<void> {
	const label = capaType === "corrective" ? "Corrective Action" : "Preventive Action";
	printHeader(`Add ${label}`);

	const name = await input.ask("Name");
	if (!name) return;

	const existing = listCAPAItems(storeDeps(), projectPath, config);
	const suggestedId = nextCapaId(existing.map((c) => c.id));
	const id = await input.ask("ID", suggestedId);

	const description = await input.ask("Description", "");
	const severity = (await input.ask("Severity (critical/high/medium/low)", "medium")) as CAPASeverity;
	const source = (await input.ask(`Source (${SOURCES.join("/")})`, "observation")) as CAPASource;
	const owner = await input.ask("Owner", "");
	const dueDate = await input.ask("Due date (YYYY-MM-DD)", "");
	const rootCause = await input.ask("Root cause (if known)", "");

	const filePath = createCAPAItem(storeDeps(), projectPath, {
		name,
		id,
		capaType,
		status: "open",
		severity,
		source,
		owner: owner || undefined,
		dueDate: dueDate || undefined,
		rootCause: rootCause || undefined,
		description,
	}, config);

	if (filePath) {
		renderCAPAAdded(paths.relative(projectPath, filePath));
	}
}

export async function updateStatusInteractive(projectPath: string, config?: CAPAConfig): Promise<void> {
	printHeader("Update CAPA Status");

	const items = listCAPAItems(storeDeps(), projectPath, config);
	if (items.length === 0) {
		log(`\n  No CAPA items to update.\n`);
		return;
	}

	for (let i = 0; i < items.length; i++) {
		log(`  ${i + 1}. ${items[i].id} ${items[i].name} [${items[i].capaType}] [${items[i].status}]`);
	}
	const choice = await input.ask("Select item (number)");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= items.length) return;

	const item = items[idx];
	log(`\n  Statuses: ${STATUSES.join(", ")}`);
	const newStatus = await input.ask("New status", item.status) as CAPAStatus;
	if (!STATUSES.includes(newStatus)) return;

	const ok = updateCAPAStatus(storeDeps(), projectPath, item.name, newStatus, config);
	if (ok) {
		renderCAPAUpdated(item.name, newStatus);
	}
}
