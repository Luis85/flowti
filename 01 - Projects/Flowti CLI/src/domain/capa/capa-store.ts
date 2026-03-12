/**
 * capa-store.ts — CRUD operations for CAPA (Corrective and Preventive Action) items.
 *
 * Stores CAPA items as markdown files with YAML frontmatter in docs/capa/.
 */

import { Document } from "../../infrastructure/document.js";
import { parseFrontmatterStrings } from "../../infrastructure/frontmatter.js";
import { toKebab } from "../make/naming.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { CAPAConfig, CAPAStatus } from "../../infrastructure/types.js";
import type { CAPADefinition, CAPASummary } from "./capa-types.js";

export type CAPAStoreDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

/** Resolve the CAPA directory for a project. */
export function capaDir(deps: Pick<CliDeps, "paths">, projectPath: string, config?: CAPAConfig): string {
	return deps.paths.join(projectPath, config?.dir ?? "docs/capa");
}

/** Auto-generate the next CAPA ID from existing items. */
export function nextCapaId(existing: string[]): string {
	let max = 0;
	for (const id of existing) {
		const m = id.match(/^CAPA-(\d+)$/);
		if (m) max = Math.max(max, parseInt(m[1], 10));
	}
	return `CAPA-${String(max + 1).padStart(3, "0")}`;
}

function parseCAPASummary(fm: Record<string, string>, file: string): CAPASummary {
	return {
		name: fm.name ?? file.replace(/\.md$/, ""),
		id: fm.id ?? "",
		capaType: (fm.capaType as CAPASummary["capaType"]) ?? "corrective",
		status: (fm.status as CAPAStatus) ?? "open",
		severity: fm.severity ?? "medium",
		source: fm.source ?? "observation",
		owner: fm.owner ?? "",
		dueDate: fm.dueDate ?? "",
		file,
	};
}

/** List all CAPA items from the CAPA directory. */
export function listCAPAItems(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, config?: CAPAConfig): CAPASummary[] {
	const dir = capaDir(deps, projectPath, config);
	if (!deps.disk.existsSync(dir)) return [];

	const files = deps.disk.readdirSync(dir).filter((f: string) => f.endsWith(".md"));
	const items: CAPASummary[] = files.map((file) => {
		const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
		return parseCAPASummary(parseFrontmatterStrings(content), file);
	});

	return items.sort((a, b) => a.name.localeCompare(b.name));
}

/** Create a new CAPA item markdown file. Returns the file path or null if it already exists. */
export function createCAPAItem(deps: CAPAStoreDeps, projectPath: string, def: CAPADefinition & { id: string }, config?: CAPAConfig): string | null {
	const dir = capaDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });

	const kebab = toKebab(def.name);
	const filename = kebab + ".md";
	const filePath = deps.paths.join(dir, filename);

	if (deps.disk.existsSync(filePath)) return null;

	const frontmatter: Record<string, string> = {
		type: "CAPAItem",
		capaType: def.capaType,
		name: def.name,
		id: def.id,
		status: def.status,
		severity: def.severity,
		source: def.source,
		date: deps.clock.iso(),
	};

	if (def.owner) frontmatter.owner = def.owner;
	if (def.dueDate) frontmatter.dueDate = def.dueDate;

	const doc = Document.create(def.name)
		.mergeFrontmatter(frontmatter)
		.addBlank()
		.heading(1, `${def.id} — ${def.name}`)
		.addBlank();

	if (def.description) {
		doc.text(def.description).addBlank();
	}

	doc.heading(2, "Root Cause Analysis").addBlank();
	if (def.rootCause) {
		doc.text(def.rootCause).addBlank();
	} else {
		doc.text("<!-- Describe the root cause here. -->").addBlank();
	}

	const actionLabel = def.capaType === "corrective" ? "Corrective Actions" : "Preventive Actions";
	doc.heading(2, actionLabel).addBlank();
	doc.text("<!-- List actions to address the root cause. -->").addBlank();

	doc.heading(2, "Verification").addBlank();
	doc.text("<!-- Define how effectiveness will be verified. -->");

	doc.save(filePath);
	return filePath;
}

/** Update the status of a named CAPA item. Returns true if successful. */
export function updateCAPAStatus(
	deps: Pick<CliDeps, "disk" | "paths">,
	projectPath: string,
	itemName: string,
	status: CAPAStatus,
	config?: CAPAConfig,
): boolean {
	const dir = capaDir(deps, projectPath, config);
	const kebab = toKebab(itemName);
	const filePath = deps.paths.join(dir, kebab + ".md");

	if (!deps.disk.existsSync(filePath)) return false;

	let content = deps.disk.readFileSync(filePath, "utf-8");
	content = content.replace(/^status:\s*.+$/m, `status: ${status}`);
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return true;
}
