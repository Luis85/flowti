/**
 * deliverable-store.ts — CRUD operations for project deliverables.
 *
 * Stores deliverables as markdown files with YAML frontmatter in docs/deliverables/.
 */

import { createStore } from "../../infrastructure/store-engine.js";
import type { StoreDeps } from "../../infrastructure/store-engine.js";
import { toMdFilename } from "../../infrastructure/markdown-utils.js";
import type { DeliverablesConfig, DeliverableStatus } from "../../infrastructure/types.js";
import type { DeliverableDefinition, DeliverableSummary } from "./deliverable-types.js";

export const deliverableStore = createStore<DeliverableSummary, DeliverableDefinition>({
	name: "deliverables",
	defaultDir: "docs/deliverables",
	configPath: "dir",
	typeTag: "Deliverable",
	needsClock: true,
	fields: {
		name: { type: "string", from: "frontmatter", required: true, default: "" },
		status: { type: "enum", options: ["planned", "in-progress", "review", "done", "blocked"], default: "planned" },
		dueDate: { type: "string", default: "" },
		assignee: { type: "string", default: "" },
		completionPct: { type: "number", default: 0, parse: (raw) => parseInt(raw, 10) || 0 },
	},
	sort: (a, b) => a.name.localeCompare(b.name),
	buildBody: (def) => {
		const lines: string[] = [];
		lines.push(`# ${def.name}`, "");
		if (def.description) { lines.push(def.description, ""); }
		lines.push("## Acceptance Criteria", "");
		lines.push("<!-- Define acceptance criteria here. -->");
		return lines.join("\n");
	},
});

export type DeliverableStoreDeps = StoreDeps & { clock: import("../../infrastructure/types.js").IClock };

export function createDeliverableFile(deps: DeliverableStoreDeps, projectPath: string, def: DeliverableDefinition, config?: DeliverablesConfig): string | null {
	const dir = deliverableStore.resolveDir(deps, projectPath, config ? { dir: config.dir } : undefined);
	const filename = toMdFilename(def.name);
	if (deps.disk.existsSync(deps.paths.join(dir, filename))) return null;
	return deliverableStore.create(deps, projectPath, def, config ? { dir: config.dir } : undefined);
}

export function updateDeliverableStatus(
	deps: Pick<import("../../infrastructure/deps.js").CliDeps, "disk" | "paths">,
	projectPath: string,
	deliverableName: string,
	status: DeliverableStatus,
	completionPct?: number,
	config?: DeliverablesConfig,
): boolean {
	if (!deliverableStore.updateField(deps as StoreDeps, projectPath, deliverableName, "status", status, config ? { dir: config.dir } : undefined)) return false;
	if (completionPct !== undefined) {
		deliverableStore.updateField(deps as StoreDeps, projectPath, deliverableName, "completionPct", String(completionPct), config ? { dir: config.dir } : undefined);
	}
	return true;
}
