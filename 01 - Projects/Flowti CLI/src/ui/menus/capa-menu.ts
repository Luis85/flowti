/**
 * capa-menu.ts — Interactive CAPA (Corrective and Preventive Action) menu.
 */

import { printHeader } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { CAPAConfig, CAPAStatus, CAPAType } from "../../infrastructure/types.js";
import type { CAPASource } from "../../domain/capa/capa-types.js";
import { collectFields, selectFromList, selectStatus } from "../../infrastructure/menu-helpers.js";
import { listCAPAItems, createCAPAItem, updateCAPAStatus, nextCapaId } from "../../domain/capa/capa-store.js";
import { renderCAPAAdded, renderCAPAUpdated } from "../displays/capa-display.js";

const STATUSES: CAPAStatus[] = ["open", "investigating", "action-planned", "implementing", "verification", "closed", "rejected"];
const SOURCES: CAPASource[] = ["audit", "complaint", "incident", "observation", "review", "other"];

export async function addCAPAInteractive(capaType: CAPAType, projectPath: string, config: CAPAConfig | undefined, deps: MenuDeps): Promise<void> {
	const label = capaType === "corrective" ? "Corrective Action" : "Preventive Action";
	printHeader(`Add ${label}`);

	const existing = listCAPAItems(deps, projectPath, config);
	const suggestedId = nextCapaId(existing.map((c) => c.id));

	const data = await collectFields([
		{ key: "name", label: "Name", required: true },
		{ key: "id", label: "ID", default: suggestedId },
		{ key: "description", label: "Description" },
		{ key: "severity", label: "Severity (critical/high/medium/low)", default: "medium" },
		{ key: "source", label: `Source (${SOURCES.join("/")})`, default: "observation" },
		{ key: "owner", label: "Owner" },
		{ key: "dueDate", label: "Due date (YYYY-MM-DD)" },
		{ key: "rootCause", label: "Root cause (if known)" },
	], deps.input);
	if (!data) return;

	const filePath = createCAPAItem(deps, projectPath, {
		name: data.name,
		id: data.id,
		capaType,
		status: "open",
		severity: data.severity as "critical" | "high" | "medium" | "low",
		source: data.source as CAPASource,
		owner: data.owner || undefined,
		dueDate: data.dueDate || undefined,
		rootCause: data.rootCause || undefined,
		description: data.description,
	}, config);

	if (filePath) {
		renderCAPAAdded(deps.paths.relative(projectPath, filePath), deps.log);
	}
}

export async function updateStatusInteractive(projectPath: string, config: CAPAConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Update CAPA Status");

	const items = listCAPAItems(deps, projectPath, config);
	const item = await selectFromList(items, deps, {
		format: (i) => `${i.id} ${i.name} [${i.capaType}] [${i.status}]`,
		emptyMessage: "No CAPA items to update.",
	});
	if (!item) return;

	const newStatus = await selectStatus(STATUSES, item.status, deps);
	if (!newStatus) return;

	const ok = updateCAPAStatus(deps, projectPath, item.name, newStatus, config);
	if (ok) {
		renderCAPAUpdated(item.name, newStatus, deps.log);
	}
}
