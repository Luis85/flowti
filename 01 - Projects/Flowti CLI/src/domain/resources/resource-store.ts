/**
 * resource-store.ts — CRUD operations for project resources.
 *
 * Stores resources as markdown files with YAML frontmatter in docs/resources/.
 * Follows the event-catalog.ts pattern: pure functions with injected deps.
 */

import { Document } from "../../infrastructure/document.js";
import { parseFrontmatterStrings } from "../../infrastructure/frontmatter.js";
import { toKebab } from "../make/naming.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { ResourcesConfig } from "../../infrastructure/types.js";
import type { ResourceDefinition, ResourceSummary } from "./resource-types.js";

export type ResourceStoreDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

/** Resolve the resources directory for a project. */
export function resourcesDir(deps: Pick<CliDeps, "paths">, projectPath: string, config?: ResourcesConfig): string {
	return deps.paths.join(projectPath, config?.dir ?? "docs/resources");
}

/** List all resources from the resources directory. */
export function listResources(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, config?: ResourcesConfig): ResourceSummary[] {
	const dir = resourcesDir(deps, projectPath, config);
	if (!deps.disk.existsSync(dir)) return [];

	const files = deps.disk.readdirSync(dir).filter((f: string) => f.endsWith(".md"));
	const resources: ResourceSummary[] = [];

	for (const file of files) {
		const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
		const fm = parseFrontmatterStrings(content);
		const price = parseFloat(fm.price ?? fm.hourlyRate ?? "0");
		const amount = parseFloat(fm.amount ?? "0");
		const consumed = parseFloat(fm.consumed ?? "0");
		const remaining = Math.max(0, amount - consumed);

		resources.push({
			name: fm.name ?? file.replace(/\.md$/, ""),
			resourceType: (fm.resourceType as ResourceSummary["resourceType"]) ?? "human",
			price,
			amount,
			consumed,
			remaining,
			totalCost: price * amount,
			consumedCost: price * consumed,
			file,
		});
	}

	return resources.sort((a, b) => a.name.localeCompare(b.name));
}

/** Create a new resource markdown file. Returns the file path or null if it already exists. */
export function createResourceFile(deps: ResourceStoreDeps, projectPath: string, def: ResourceDefinition, config?: ResourcesConfig): string | null {
	const dir = resourcesDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });

	const kebab = toKebab(def.name);
	const filename = kebab + ".md";
	const filePath = deps.paths.join(dir, filename);

	if (deps.disk.existsSync(filePath)) return null;

	const frontmatter: Record<string, string> = {
		type: "Resource",
		resourceType: def.resourceType,
		name: def.name,
		status: def.status || "active",
		date: deps.clock.iso(),
	};

	if (def.resourceType === "role") {
		frontmatter.hourlyRate = String(def.hourlyRate ?? def.price);
	} else {
		frontmatter.price = String(def.price);
		frontmatter.priceUnit = def.priceUnit ?? "hour";
	}

	if (def.role) frontmatter.role = def.role;
	frontmatter.amount = String(def.amount);
	frontmatter.consumed = String(def.consumed);

	const doc = Document.create(def.name)
		.mergeFrontmatter(frontmatter)
		.addBlank()
		.heading(1, def.name)
		.addBlank();

	if (def.description) {
		doc.text(def.description).addBlank();
	}

	doc.heading(2, "Notes").addBlank();
	doc.text("<!-- Add resource notes here. -->");

	doc.save(filePath);
	return filePath;
}

/** Update the consumed quantity for a named resource. Returns true if successful. */
export function updateConsumption(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, resourceName: string, consumed: number, config?: ResourcesConfig): boolean {
	const dir = resourcesDir(deps, projectPath, config);
	const kebab = toKebab(resourceName);
	const filePath = deps.paths.join(dir, kebab + ".md");

	if (!deps.disk.existsSync(filePath)) return false;

	let content = deps.disk.readFileSync(filePath, "utf-8");
	const consumedRegex = /^consumed:\s*.+$/m;
	if (consumedRegex.test(content)) {
		content = content.replace(consumedRegex, `consumed: ${consumed}`);
	}
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return true;
}
