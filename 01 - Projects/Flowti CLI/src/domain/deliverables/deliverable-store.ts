/**
 * deliverable-store.ts — CRUD operations for project deliverables.
 *
 * Stores deliverables as markdown files with YAML frontmatter in docs/deliverables/.
 */

import { Document } from "../../infrastructure/document.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { DeliverablesConfig, DeliverableStatus } from "../../infrastructure/types.js";
import type { DeliverableDefinition, DeliverableSummary } from "./deliverable-types.js";
import { resolveDir, listItems, toMdFilename, updateField } from "../shared/markdown-store.js";

export type DeliverableStoreDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

/** Resolve the deliverables directory for a project. */
export function deliverablesDir(deps: Pick<CliDeps, "paths">, projectPath: string, config?: DeliverablesConfig): string {
	return resolveDir(deps, projectPath, config?.dir, "docs/deliverables");
}

function parseDeliverableSummary(fm: Record<string, string>, file: string): DeliverableSummary {
	return {
		name: fm.name ?? file.replace(/\.md$/, ""),
		status: (fm.status as DeliverableStatus) ?? "planned",
		dueDate: fm.dueDate ?? "",
		assignee: fm.assignee ?? "",
		completionPct: parseInt(fm.completionPct ?? "0", 10),
		file,
	};
}

/** List all deliverables from the deliverables directory. */
export function listDeliverables(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, config?: DeliverablesConfig): DeliverableSummary[] {
	return listItems(deps, deliverablesDir(deps, projectPath, config), parseDeliverableSummary, (a, b) => a.name.localeCompare(b.name));
}

/** Create a new deliverable markdown file. Returns the file path or null if it already exists. */
export function createDeliverableFile(deps: DeliverableStoreDeps, projectPath: string, def: DeliverableDefinition, config?: DeliverablesConfig): string | null {
	const dir = deliverablesDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });

	const filename = toMdFilename(def.name);
	const filePath = deps.paths.join(dir, filename);

	if (deps.disk.existsSync(filePath)) return null;

	const frontmatter: Record<string, string> = {
		type: "Deliverable",
		name: def.name,
		status: def.status,
		date: deps.clock.iso(),
	};

	if (def.dueDate) frontmatter.dueDate = def.dueDate;
	if (def.assignee) frontmatter.assignee = def.assignee;
	if (def.priority) frontmatter.priority = def.priority;
	frontmatter.completionPct = String(def.completionPct ?? 0);

	const doc = Document.create(def.name)
		.mergeFrontmatter(frontmatter)
		.addBlank()
		.heading(1, def.name)
		.addBlank();

	if (def.description) {
		doc.text(def.description).addBlank();
	}

	doc.heading(2, "Acceptance Criteria").addBlank();
	doc.text("<!-- Define acceptance criteria here. -->");

	doc.save(filePath, deps.disk);
	return filePath;
}

/** Update status and completion percentage for a named deliverable. Returns true if successful. */
export function updateDeliverableStatus(
	deps: Pick<CliDeps, "disk" | "paths">,
	projectPath: string,
	deliverableName: string,
	status: DeliverableStatus,
	completionPct?: number,
	config?: DeliverablesConfig,
): boolean {
	const dir = deliverablesDir(deps, projectPath, config);
	const filePath = deps.paths.join(dir, toMdFilename(deliverableName));

	if (!updateField(deps, filePath, "status", status)) return false;
	if (completionPct !== undefined) {
		updateField(deps, filePath, "completionPct", String(completionPct));
	}
	return true;
}
