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

function parseNumericFields(fm: Record<string, string>): { price: number; amount: number; consumed: number } {
	const isBudget = fm.resourceType === "budget";
	return {
		price: isBudget ? 1 : parseFloat(fm.price ?? fm.hourlyRate ?? "0"),
		amount: parseFloat(fm.totalAmount ?? fm.amount ?? "0"),
		consumed: parseFloat(fm.spent ?? fm.consumed ?? "0"),
	};
}

function parseResourceSummary(fm: Record<string, string>, file: string): ResourceSummary {
	const isBudget = fm.resourceType === "budget";
	const { price, amount, consumed } = parseNumericFields(fm);
	return {
		name: fm.name ?? file.replace(/\.md$/, ""),
		resourceType: (fm.resourceType as ResourceSummary["resourceType"]) ?? "human",
		price, amount, consumed,
		remaining: Math.max(0, amount - consumed),
		totalCost: isBudget ? amount : price * amount,
		consumedCost: isBudget ? consumed : price * consumed,
		file,
	};
}

/** List all resources from the resources directory. */
export function listResources(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, config?: ResourcesConfig): ResourceSummary[] {
	const dir = resourcesDir(deps, projectPath, config);
	if (!deps.disk.existsSync(dir)) return [];

	const files = deps.disk.readdirSync(dir).filter((f: string) => f.endsWith(".md"));
	const resources = files.map((file) => {
		const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
		return parseResourceSummary(parseFrontmatterStrings(content), file);
	});

	return resources.sort((a, b) => a.name.localeCompare(b.name));
}

function addBudgetFields(fm: Record<string, string>, def: ResourceDefinition): void {
	fm.totalAmount = String(def.amount);
	fm.spent = String(def.consumed);
	if (def.currency) fm.currency = def.currency;
	if (def.category) fm.category = def.category;
	if (def.periodStart) fm.periodStart = def.periodStart;
	if (def.periodEnd) fm.periodEnd = def.periodEnd;
}

function addQuantityFields(fm: Record<string, string>, def: ResourceDefinition): void {
	if (def.resourceType === "role") {
		fm.hourlyRate = String(def.hourlyRate ?? def.price);
	} else {
		fm.price = String(def.price);
		fm.priceUnit = def.priceUnit ?? "hour";
	}
	fm.amount = String(def.amount);
	fm.consumed = String(def.consumed);
}

function buildResourceFrontmatter(def: ResourceDefinition, date: string): Record<string, string> {
	const fm: Record<string, string> = {
		type: "Resource",
		resourceType: def.resourceType,
		name: def.name,
		status: def.status || "active",
		date,
	};
	if (def.resourceType === "budget") {
		addBudgetFields(fm, def);
	} else {
		addQuantityFields(fm, def);
	}
	if (def.role) fm.role = def.role;
	return fm;
}

/** Create a new resource markdown file. Returns the file path or null if it already exists. */
export function createResourceFile(deps: ResourceStoreDeps, projectPath: string, def: ResourceDefinition, config?: ResourcesConfig): string | null {
	const dir = resourcesDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });

	const kebab = toKebab(def.name);
	const filename = kebab + ".md";
	const filePath = deps.paths.join(dir, filename);

	if (deps.disk.existsSync(filePath)) return null;

	const frontmatter = buildResourceFrontmatter(def, deps.clock.iso());

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

	// Budget type uses "spent" instead of "consumed"
	const spentRegex = /^spent:\s*.+$/m;
	const consumedRegex = /^consumed:\s*.+$/m;
	if (spentRegex.test(content)) {
		content = content.replace(spentRegex, `spent: ${consumed}`);
	} else if (consumedRegex.test(content)) {
		content = content.replace(consumedRegex, `consumed: ${consumed}`);
	}
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return true;
}
