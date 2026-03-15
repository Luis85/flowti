/**
 * resource-store.ts — CRUD operations for project resources.
 *
 * Stores resources as markdown files with YAML frontmatter in docs/resources/.
 * Follows the event-catalog.ts pattern: pure functions with injected deps.
 */

import { createStore } from "../../infrastructure/store-engine.js";
import type { StoreDeps } from "../../infrastructure/store-engine.js";
import { toMdFilename } from "../../infrastructure/markdown-utils.js";
import type { ResourcesConfig } from "../../infrastructure/types.js";
import type { ResourceDefinition, ResourceSummary } from "./resource-types.js";

export type ResourceStoreDeps = StoreDeps & { clock: import("../../infrastructure/types.js").IClock };

// ── Store descriptor ────────────────────────────────────────────────

export const resourceStore = createStore<ResourceSummary, ResourceDefinition>({
	name: "resource",
	defaultDir: "docs/resources",
	configPath: "dir",
	typeTag: "Resource",
	needsClock: true,
	fields: {
		name: { type: "string", from: "frontmatter", required: true, default: "" },
		resourceType: { type: "enum", options: ["human", "material", "role", "budget"], default: "human" },
		// price, amount, consumed, remaining, totalCost, consumedCost filled by parseBody
		price: { type: "number", default: 0 },
		amount: { type: "number", default: 0 },
		consumed: { type: "number", default: 0 },
		remaining: { type: "number", default: 0 },
		totalCost: { type: "number", default: 0 },
		consumedCost: { type: "number", default: 0 },
	},
	sort: (a, b) => a.name.localeCompare(b.name),
	parseBody: (_body, fm) => {
		const isBudget = fm.resourceType === "budget";
		const price = isBudget ? 1 : parseFloat(fm.price ?? fm.hourlyRate ?? "0");
		const amount = parseFloat(fm.totalAmount ?? fm.amount ?? "0");
		const consumed = parseFloat(fm.spent ?? fm.consumed ?? "0");
		return {
			price,
			amount,
			consumed,
			remaining: Math.max(0, amount - consumed),
			totalCost: isBudget ? amount : price * amount,
			consumedCost: isBudget ? consumed : price * consumed,
		};
	},
	buildBody: (def) => {
		const lines: string[] = [];
		lines.push(`# ${def.name}`, "");
		if (def.description) { lines.push(def.description, ""); }
		lines.push("## Notes", "");
		lines.push("<!-- Add resource notes here. -->");
		return lines.join("\n");
	},
});

// ── Frontmatter builders (dual mode) ───────────────────────────────

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

// ── Backwards-compatible re-exports ────────────────────────────────

/** Resolve the resources directory for a project. */
export function resourcesDir(deps: Pick<import("../../infrastructure/deps.js").CliDeps, "paths">, projectPath: string, config?: ResourcesConfig): string {
	return resourceStore.resolveDir(deps as StoreDeps, projectPath, config ? { dir: config.dir } : undefined);
}

/** List all resources from the resources directory. */
export function listResources(deps: Pick<import("../../infrastructure/deps.js").CliDeps, "disk" | "paths">, projectPath: string, config?: ResourcesConfig): ResourceSummary[] {
	return resourceStore.list(deps as StoreDeps, projectPath, config ? { dir: config.dir } : undefined);
}

/** Create a new resource markdown file. Returns the file path or null if it already exists. */
export function createResourceFile(deps: ResourceStoreDeps, projectPath: string, def: ResourceDefinition, config?: ResourcesConfig): string | null {
	const dir = resourcesDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });

	const filename = toMdFilename(def.name);
	const filePath = deps.paths.join(dir, filename);

	if (deps.disk.existsSync(filePath)) return null;

	const fm = buildResourceFrontmatter(def, deps.clock.iso());
	const body = resourceStore.__descriptor.buildBody(def, deps);
	const yamlLines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`);
	const content = `---\n${yamlLines.join("\n")}\n---\n\n${body}`;
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return filePath;
}

/** Update the consumed quantity for a named resource. Returns true if successful. */
export function updateConsumption(deps: Pick<import("../../infrastructure/deps.js").CliDeps, "disk" | "paths">, projectPath: string, resourceName: string, consumed: number, config?: ResourcesConfig): boolean {
	const dir = resourcesDir(deps, projectPath, config);
	const filePath = deps.paths.join(dir, toMdFilename(resourceName));

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
