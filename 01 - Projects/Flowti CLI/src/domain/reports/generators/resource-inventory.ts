/**
 * resource-inventory.ts — Generates a Resource Inventory reference.
 *
 * Documents team composition, resource types, consumption, availability,
 * and cost summaries.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import { listResources } from "../../resources/resource-store.js";
import { readProjectConfig } from "../../project/project-config.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { ResourceSummary } from "../../resources/resource-types.js";

// ── Generator ────────────────────────────────────────────────────────

export function generateResourceInventory(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);
	const { config } = readProjectConfig(projectPath, deps);
	const resources = listResources(deps, projectPath, config?.management?.resources);

	const totalCost = resources.reduce((sum, r) => sum + r.totalCost, 0);
	const consumedCost = resources.reduce((sum, r) => sum + r.consumedCost, 0);
	const types = new Set(resources.map((r) => r.resourceType));

	const doc = Document.create("Resource Inventory")
		.mergeFrontmatter({
			type: "ResourceInventory",
			date: deps.clock.iso(),
			total: resources.length,
			types: types.size,
			tags: ["reference", "resources", "inventory", "management"],
		})
		.addBlank()
		.heading(1, "Resource Inventory")
		.addBlank()
		.text(`${resources.length} resource(s) across ${types.size} type(s).`)
		.addBlank();

	if (resources.length === 0) {
		doc.text("No resources found. Create resources in the configured resources directory.").addBlank();
	}

	appendSummaryTable(doc, resources);
	appendByType(doc, resources);
	appendCostSummary(doc, totalCost, consumedCost);
	appendUtilization(doc, resources);

	const outputPath = svc.saveReference(doc, "Resource Inventory.md");

	return {
		success: true,
		outputPath,
		metrics: { total: resources.length, types: types.size, totalCost, consumedCost },
	};
}

// ── Helpers ──────────────────────────────────────────────────────────

function appendSummaryTable(doc: Document, resources: ResourceSummary[]): void {
	if (resources.length === 0) return;

	doc.heading(2, "Overview").addBlank();
	doc.table(
		["Resource", "Type", "Amount", "Consumed", "Remaining", "Utilization"],
		resources.map((r) => {
			const util = r.amount > 0 ? Math.round((r.consumed / r.amount) * 100) : 0;
			return [
				Document.wikilink(r.name),
				r.resourceType,
				String(r.amount),
				String(r.consumed),
				String(r.remaining),
				`${util}%`,
			];
		}),
	).addBlank();
}

function appendByType(doc: Document, resources: ResourceSummary[]): void {
	const byType = new Map<string, ResourceSummary[]>();
	for (const r of resources) {
		const list = byType.get(r.resourceType) ?? [];
		list.push(r);
		byType.set(r.resourceType, list);
	}

	doc.heading(2, "By Type").addBlank();
	for (const [type, group] of [...byType.entries()].sort(([a], [b]) => a.localeCompare(b))) {
		const total = group.reduce((s, r) => s + r.totalCost, 0);
		doc.heading(3, `${type} (${group.length})`).addBlank();
		doc.table(
			["Resource", "Amount", "Consumed", "Cost"],
			group.map((r) => [
				Document.wikilink(r.name),
				String(r.amount),
				String(r.consumed),
				String(r.totalCost),
			]),
		).addBlank();
		doc.text(`Subtotal: **${total}**`).addBlank();
	}
}

function appendCostSummary(doc: Document, totalCost: number, consumedCost: number): void {
	if (totalCost === 0) return;
	const pct = Math.round((consumedCost / totalCost) * 100);
	doc.heading(2, "Cost Summary").addBlank();
	doc.table(
		["Metric", "Value"],
		[
			["Total Budget", String(totalCost)],
			["Consumed", String(consumedCost)],
			["Remaining", String(totalCost - consumedCost)],
			["Burn Rate", `${pct}%`],
		],
	).addBlank();
}

function appendUtilization(doc: Document, resources: ResourceSummary[]): void {
	const overUtilized = resources.filter((r) => r.amount > 0 && r.consumed > r.amount);
	if (overUtilized.length === 0) return;

	doc.heading(2, "Over-Utilized Resources").addBlank();
	doc.callout("warning", "Resources Exceeding Capacity", [
		...overUtilized.map((r) => `**${r.name}**: ${r.consumed}/${r.amount} (${Math.round((r.consumed / r.amount) * 100)}%)`),
	]).addBlank();
}
