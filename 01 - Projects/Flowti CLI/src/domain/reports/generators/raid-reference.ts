/**
 * raid-reference.ts — Generates a RAID Reference document.
 *
 * Documents all risks, assumptions, issues, dependencies, and decisions
 * with their severity, status, and ownership.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import { raidStore } from "../../raid/raid-store.js";
import { readProjectConfig } from "../../project/project-config.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput, RAIDItemType } from "../../../infrastructure/types.js";

// ── Type labels ─────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
	risk: "Risks",
	assumption: "Assumptions",
	issue: "Issues",
	dependency: "Dependencies",
	decision: "Decisions",
};

const ORDERED_TYPES: RAIDItemType[] = ["risk", "issue", "assumption", "dependency", "decision"];

// ── Generator ────────────────────────────────────────────────────────

export function generateRaidReference(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);
	const { config } = readProjectConfig(projectPath, deps);
	const raidConfig = config?.management?.raid;
	const items = raidStore.list(deps, projectPath, raidConfig ? { dir: raidConfig.dir } : undefined);

	const byType = new Map<string, typeof items>();
	for (const item of items) {
		const list = byType.get(item.itemType) ?? [];
		list.push(item);
		byType.set(item.itemType, list);
	}

	const openCount = items.filter((i) => i.status === "open").length;

	const doc = Document.create("RAID Reference")
		.mergeFrontmatter({
			type: "RAIDReference",
			date: deps.clock.iso(),
			total: items.length,
			open: openCount,
			tags: ["reference", "raid", "management"],
		})
		.addBlank()
		.heading(1, "RAID Reference")
		.addBlank()
		.text(`${items.length} item(s) tracked. ${openCount} open.`)
		.addBlank();

	if (items.length === 0) {
		doc.text("No RAID items found. Create items in the configured RAID directory.").addBlank();
	}

	appendSummaryTable(doc, items);
	appendByType(doc, byType);

	const outputPath = svc.saveReference(doc, "RAID Reference.md");

	return {
		success: true,
		outputPath,
		metrics: { total: items.length, open: openCount, types: byType.size },
	};
}

// ── Helpers ──────────────────────────────────────────────────────────

function appendSummaryTable(doc: Document, items: { itemType: string; status: string }[]): void {
	if (items.length === 0) return;
	const counts = new Map<string, { open: number; closed: number }>();
	for (const item of items) {
		const entry = counts.get(item.itemType) ?? { open: 0, closed: 0 };
		if (item.status === "open") entry.open++;
		else entry.closed++;
		counts.set(item.itemType, entry);
	}

	doc.heading(2, "Summary").addBlank();
	doc.table(
		["Type", "Open", "Closed/Resolved", "Total"],
		ORDERED_TYPES
			.filter((t) => counts.has(t))
			.map((t) => {
				const c = counts.get(t)!;
				return [TYPE_LABELS[t] ?? t, String(c.open), String(c.closed), String(c.open + c.closed)];
			}),
	).addBlank();
}

interface RAIDSummary { name: string; itemType: string; status: string; severity: string; owner: string; dueDate: string }

function appendByType(doc: Document, byType: Map<string, RAIDSummary[]>): void {
	for (const type of ORDERED_TYPES) {
		const items = byType.get(type);
		if (!items || items.length === 0) continue;

		doc.heading(2, TYPE_LABELS[type] ?? type).addBlank();
		doc.table(
			["Item", "Severity", "Status", "Owner", "Due"],
			items.map((i) => [
				Document.wikilink(i.name),
				i.severity,
				i.status,
				i.owner || "—",
				i.dueDate || "—",
			]),
		).addBlank();
	}
}
