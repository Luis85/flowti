/**
 * raid-store.ts — CRUD operations for RAID log items.
 *
 * Stores RAID items as markdown files with YAML frontmatter in docs/raid/.
 */

import { Document } from "../../infrastructure/document.js";
import { parseFrontmatterStrings } from "../../infrastructure/frontmatter.js";
import { toKebab } from "../make/naming.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { RAIDConfig, RAIDStatus } from "../../infrastructure/types.js";
import type { RAIDDefinition, RAIDSummary } from "./raid-types.js";

export type RAIDStoreDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

/** Resolve the RAID directory for a project. */
export function raidDir(deps: Pick<CliDeps, "paths">, projectPath: string, config?: RAIDConfig): string {
	return deps.paths.join(projectPath, config?.dir ?? "docs/raid");
}

/** List all RAID items from the RAID directory. */
export function listRAIDItems(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, config?: RAIDConfig): RAIDSummary[] {
	const dir = raidDir(deps, projectPath, config);
	if (!deps.disk.existsSync(dir)) return [];

	const files = deps.disk.readdirSync(dir).filter((f: string) => f.endsWith(".md"));
	const items: RAIDSummary[] = [];

	for (const file of files) {
		const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
		const fm = parseFrontmatterStrings(content);
		items.push({
			name: fm.name ?? file.replace(/\.md$/, ""),
			itemType: (fm.itemType as RAIDSummary["itemType"]) ?? "risk",
			status: (fm.status as RAIDStatus) ?? "open",
			severity: fm.severity ?? "medium",
			owner: fm.owner ?? "",
			dueDate: fm.dueDate ?? "",
			file,
		});
	}

	return items.sort((a, b) => a.name.localeCompare(b.name));
}

/** Create a new RAID item markdown file. Returns the file path or null if it already exists. */
export function createRAIDItem(deps: RAIDStoreDeps, projectPath: string, def: RAIDDefinition, config?: RAIDConfig): string | null {
	const dir = raidDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });

	const kebab = toKebab(def.name);
	const filename = kebab + ".md";
	const filePath = deps.paths.join(dir, filename);

	if (deps.disk.existsSync(filePath)) return null;

	const frontmatter: Record<string, string> = {
		type: "RAIDItem",
		itemType: def.itemType,
		name: def.name,
		status: def.status,
		severity: def.severity,
		date: deps.clock.iso(),
	};

	if (def.owner) frontmatter.owner = def.owner;
	if (def.dueDate) frontmatter.dueDate = def.dueDate;
	if (def.category) frontmatter.category = def.category;

	const doc = Document.create(def.name)
		.mergeFrontmatter(frontmatter)
		.addBlank()
		.heading(1, def.name)
		.addBlank();

	if (def.description) {
		doc.text(def.description).addBlank();
	}

	doc.heading(2, "Mitigation / Resolution").addBlank();
	doc.text("<!-- Add mitigation or resolution notes here. -->");

	doc.save(filePath);
	return filePath;
}

/** Update the status of a named RAID item. Returns true if successful. */
export function updateRAIDStatus(
	deps: Pick<CliDeps, "disk" | "paths">,
	projectPath: string,
	itemName: string,
	status: RAIDStatus,
	config?: RAIDConfig,
): boolean {
	const dir = raidDir(deps, projectPath, config);
	const kebab = toKebab(itemName);
	const filePath = deps.paths.join(dir, kebab + ".md");

	if (!deps.disk.existsSync(filePath)) return false;

	let content = deps.disk.readFileSync(filePath, "utf-8");
	content = content.replace(/^status:\s*.+$/m, `status: ${status}`);
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return true;
}
