/**
 * capa-menu.ts — Interactive CAPA (Corrective and Preventive Action) menu.
 */

import { printHeader } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { CAPAConfig, CAPAStatus, CAPAType } from "../../infrastructure/types.js";
import type { CAPASource, CAPASeverity } from "../../domain/capa/capa-types.js";
import { listCAPAItems, createCAPAItem, updateCAPAStatus, nextCapaId } from "../../domain/capa/capa-store.js";
import { renderCAPAAdded, renderCAPAUpdated } from "../displays/capa-display.js";

const STATUSES: CAPAStatus[] = ["open", "investigating", "action-planned", "implementing", "verification", "closed", "rejected"];
const SOURCES: CAPASource[] = ["audit", "complaint", "incident", "observation", "review", "other"];

export async function addCAPAInteractive(capaType: CAPAType, projectPath: string, config: CAPAConfig | undefined, deps: MenuDeps): Promise<void> {
	const label = capaType === "corrective" ? "Corrective Action" : "Preventive Action";
	printHeader(`Add ${label}`);

	const name = await deps.input.ask("Name");
	if (!name) return;

	const existing = listCAPAItems(deps, projectPath, config);
	const suggestedId = nextCapaId(existing.map((c) => c.id));
	const id = await deps.input.ask("ID", suggestedId);

	const description = await deps.input.ask("Description", "");
	const severity = (await deps.input.ask("Severity (critical/high/medium/low)", "medium")) as CAPASeverity;
	const source = (await deps.input.ask(`Source (${SOURCES.join("/")})`, "observation")) as CAPASource;
	const owner = await deps.input.ask("Owner", "");
	const dueDate = await deps.input.ask("Due date (YYYY-MM-DD)", "");
	const rootCause = await deps.input.ask("Root cause (if known)", "");

	const filePath = createCAPAItem(deps, projectPath, {
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
		renderCAPAAdded(deps.paths.relative(projectPath, filePath), deps.log);
	}
}

export async function updateStatusInteractive(projectPath: string, config: CAPAConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Update CAPA Status");

	const items = listCAPAItems(deps, projectPath, config);
	if (items.length === 0) {
		deps.log(`\n  No CAPA items to update.\n`);
		return;
	}

	for (let i = 0; i < items.length; i++) {
		deps.log(`  ${i + 1}. ${items[i].id} ${items[i].name} [${items[i].capaType}] [${items[i].status}]`);
	}
	const choice = await deps.input.ask("Select item (number)");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= items.length) return;

	const item = items[idx];
	deps.log(`\n  Statuses: ${STATUSES.join(", ")}`);
	const newStatus = await deps.input.ask("New status", item.status) as CAPAStatus;
	if (!STATUSES.includes(newStatus)) return;

	const ok = updateCAPAStatus(deps, projectPath, item.name, newStatus, config);
	if (ok) {
		renderCAPAUpdated(item.name, newStatus, deps.log);
	}
}
