/**
 * capa-store.ts — CRUD operations for CAPA (Corrective and Preventive Action) items.
 *
 * Stores CAPA items as markdown files with YAML frontmatter in docs/capa/.
 */

import { createStore } from "../../infrastructure/store-engine.js";
import type { StoreDeps } from "../../infrastructure/store-engine.js";
import { toMdFilename } from "../../infrastructure/markdown-utils.js";
import type { CAPAConfig } from "../../infrastructure/types.js";
import type { CAPADefinition, CAPASummary } from "./capa-types.js";

export const capaStore = createStore<CAPASummary, CAPADefinition & { id: string }>({
	name: "capa",
	defaultDir: "docs/capa",
	configPath: "dir",
	typeTag: "CAPAItem",
	idGeneration: { prefix: "CAPA", padding: 3 },
	needsClock: true,
	fields: {
		name: { type: "string", from: "frontmatter", required: true, default: "" },
		id: { type: "string", default: "" },
		capaType: { type: "enum", options: ["corrective", "preventive"], default: "corrective" },
		status: { type: "enum", options: ["open", "investigating", "action-planned", "implementing", "verification", "closed", "rejected"], default: "open" },
		severity: { type: "enum", options: ["critical", "high", "medium", "low"], default: "medium" },
		source: { type: "enum", options: ["audit", "complaint", "incident", "observation", "review", "other"], default: "observation" },
		owner: { type: "string", default: "" },
		dueDate: { type: "string", default: "" },
	},
	sort: (a, b) => a.name.localeCompare(b.name),
	buildBody: (def) => {
		const lines: string[] = [];
		lines.push(`# ${def.id} — ${def.name}`, "");
		if (def.description) { lines.push(def.description, ""); }
		lines.push("## Root Cause Analysis", "");
		if (def.rootCause) { lines.push(def.rootCause, ""); }
		else { lines.push("<!-- Describe the root cause here. -->", ""); }
		const label = def.capaType === "corrective" ? "Corrective Actions" : "Preventive Actions";
		lines.push(`## ${label}`, "");
		lines.push("<!-- List actions to address the root cause. -->", "");
		lines.push("## Verification", "");
		lines.push("<!-- Define how effectiveness will be verified. -->");
		return lines.join("\n");
	},
});

export type CAPAStoreDeps = StoreDeps & { clock: import("../../infrastructure/types.js").IClock };

export function nextCapaId(existing: string[]): string {
	let max = 0;
	for (const id of existing) {
		const m = id.match(/^CAPA-(\d+)$/);
		if (m) max = Math.max(max, parseInt(m[1], 10));
	}
	return `CAPA-${String(max + 1).padStart(3, "0")}`;
}

export function createCAPAItem(deps: CAPAStoreDeps, projectPath: string, def: CAPADefinition & { id: string }, config?: CAPAConfig): string | null {
	const dir = capaStore.resolveDir(deps, projectPath, config ? { dir: config.dir } : undefined);
	const filename = toMdFilename(def.name);
	if (deps.disk.existsSync(deps.paths.join(dir, filename))) return null;
	return capaStore.create(deps, projectPath, def, config ? { dir: config.dir } : undefined);
}
