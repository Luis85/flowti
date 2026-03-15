/**
 * raid-store.ts — CRUD operations for RAID log items.
 *
 * Stores RAID items as markdown files with YAML frontmatter in docs/raid/.
 */

import { createStore } from "../../infrastructure/store-engine.js";
import type { StoreDeps } from "../../infrastructure/store-engine.js";
import { toMdFilename } from "../../infrastructure/markdown-utils.js";
import type { RAIDConfig, RAIDStatus } from "../../infrastructure/types.js";
import type { RAIDDefinition, RAIDSummary } from "./raid-types.js";

export const raidStore = createStore<RAIDSummary, RAIDDefinition>({
	name: "raid",
	defaultDir: "docs/raid",
	configPath: "dir",
	typeTag: "RAIDItem",
	needsClock: true,
	fields: {
		name: { type: "string", from: "frontmatter", required: true, default: "" },
		itemType: { type: "enum", options: ["risk", "assumption", "issue", "dependency", "decision"], default: "risk" },
		status: { type: "enum", options: ["open", "mitigated", "closed", "accepted", "resolved", "deferred"], default: "open" },
		severity: { type: "enum", options: ["critical", "high", "medium", "low"], default: "medium" },
		owner: { type: "string", default: "" },
		dueDate: { type: "string", default: "" },
	},
	sort: (a, b) => a.name.localeCompare(b.name),
	buildBody: (def) => {
		const lines: string[] = [];
		lines.push(`# ${def.name}`, "");
		if (def.description) { lines.push(def.description, ""); }
		lines.push("## Mitigation / Resolution", "");
		lines.push("<!-- Add mitigation or resolution notes here. -->");
		return lines.join("\n");
	},
});

// Backwards-compatible re-exports (removed in Phase 4 cleanup)
export type RAIDStoreDeps = StoreDeps & { clock: import("../../infrastructure/types.js").IClock };

export function raidDir(deps: Pick<import("../../infrastructure/deps.js").CliDeps, "paths">, projectPath: string, config?: RAIDConfig): string {
	return raidStore.resolveDir(deps as StoreDeps, projectPath, config ? { dir: config.dir } : undefined);
}

export function listRAIDItems(deps: Pick<import("../../infrastructure/deps.js").CliDeps, "disk" | "paths">, projectPath: string, config?: RAIDConfig): RAIDSummary[] {
	return raidStore.list(deps as StoreDeps, projectPath, config ? { dir: config.dir } : undefined);
}

export function createRAIDItem(deps: RAIDStoreDeps, projectPath: string, def: RAIDDefinition, config?: RAIDConfig): string | null {
	const dir = raidStore.resolveDir(deps, projectPath, config ? { dir: config.dir } : undefined);
	const filename = toMdFilename(def.name);
	if (deps.disk.existsSync(deps.paths.join(dir, filename))) return null;
	return raidStore.create(deps, projectPath, def, config ? { dir: config.dir } : undefined);
}

export function updateRAIDStatus(
	deps: Pick<import("../../infrastructure/deps.js").CliDeps, "disk" | "paths">,
	projectPath: string,
	itemName: string,
	status: RAIDStatus,
	config?: RAIDConfig,
): boolean {
	return raidStore.updateField(deps as StoreDeps, projectPath, itemName, "status", status, config ? { dir: config.dir } : undefined);
}
