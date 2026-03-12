/**
 * deliverable-store.ts — CRUD operations for project deliverables.
 *
 * Stores deliverables as markdown files with YAML frontmatter in docs/deliverables/.
 */

import { Document } from "../../infrastructure/document.js";
import { parseFrontmatterStrings } from "../../infrastructure/frontmatter.js";
import { toKebab } from "../make/naming.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { DeliverablesConfig, DeliverableStatus } from "../../infrastructure/types.js";
import type { DeliverableDefinition, DeliverableSummary } from "./deliverable-types.js";

export type DeliverableStoreDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

/** Resolve the deliverables directory for a project. */
export function deliverablesDir(deps: Pick<CliDeps, "paths">, projectPath: string, config?: DeliverablesConfig): string {
	return deps.paths.join(projectPath, config?.dir ?? "docs/deliverables");
}

/** List all deliverables from the deliverables directory. */
export function listDeliverables(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, config?: DeliverablesConfig): DeliverableSummary[] {
	const dir = deliverablesDir(deps, projectPath, config);
	if (!deps.disk.existsSync(dir)) return [];

	const files = deps.disk.readdirSync(dir).filter((f: string) => f.endsWith(".md"));
	const deliverables: DeliverableSummary[] = [];

	for (const file of files) {
		const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
		const fm = parseFrontmatterStrings(content);
		deliverables.push({
			name: fm.name ?? file.replace(/\.md$/, ""),
			status: (fm.status as DeliverableStatus) ?? "planned",
			dueDate: fm.dueDate ?? "",
			assignee: fm.assignee ?? "",
			completionPct: parseInt(fm.completionPct ?? "0", 10),
			file,
		});
	}

	return deliverables.sort((a, b) => a.name.localeCompare(b.name));
}

/** Create a new deliverable markdown file. Returns the file path or null if it already exists. */
export function createDeliverableFile(deps: DeliverableStoreDeps, projectPath: string, def: DeliverableDefinition, config?: DeliverablesConfig): string | null {
	const dir = deliverablesDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });

	const kebab = toKebab(def.name);
	const filename = kebab + ".md";
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

	doc.save(filePath);
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
	const kebab = toKebab(deliverableName);
	const filePath = deps.paths.join(dir, kebab + ".md");

	if (!deps.disk.existsSync(filePath)) return false;

	let content = deps.disk.readFileSync(filePath, "utf-8");
	content = content.replace(/^status:\s*.+$/m, `status: ${status}`);
	if (completionPct !== undefined) {
		content = content.replace(/^completionPct:\s*.+$/m, `completionPct: ${completionPct}`);
	}
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return true;
}
