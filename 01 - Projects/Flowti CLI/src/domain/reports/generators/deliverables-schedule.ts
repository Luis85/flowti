/**
 * deliverables-schedule.ts — Generates a Deliverables Schedule reference.
 *
 * Documents deliverable timelines, ownership, status distribution,
 * and completion progress.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import { listDeliverables } from "../../deliverables/deliverable-store.js";
import { readProjectConfig } from "../../project/project-config.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { DeliverableSummary } from "../../deliverables/deliverable-types.js";

// ── Generator ────────────────────────────────────────────────────────

export function generateDeliverablesSchedule(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);
	const { config } = readProjectConfig(projectPath, deps);
	const deliverables = listDeliverables(deps, projectPath, config?.management?.deliverables);

	const avgCompletion = deliverables.length > 0
		? Math.round(deliverables.reduce((sum, d) => sum + d.completionPct, 0) / deliverables.length)
		: 0;

	const doc = Document.create("Deliverables Schedule")
		.mergeFrontmatter({
			type: "DeliverablesSchedule",
			date: deps.clock.iso(),
			total: deliverables.length,
			avgCompletion,
			tags: ["reference", "deliverables", "schedule", "management"],
		})
		.addBlank()
		.heading(1, "Deliverables Schedule")
		.addBlank()
		.text(`${deliverables.length} deliverable(s). Average completion: ${avgCompletion}%.`)
		.addBlank();

	if (deliverables.length === 0) {
		doc.text("No deliverables found. Create deliverables in the configured directory.").addBlank();
	}

	appendTimeline(doc, deliverables);
	appendStatusBreakdown(doc, deliverables);
	appendByAssignee(doc, deliverables);

	const outputPath = svc.saveReference(doc, "Deliverables Schedule.md");

	return {
		success: true,
		outputPath,
		metrics: { total: deliverables.length, avgCompletion },
	};
}

// ── Helpers ──────────────────────────────────────────────────────────

function appendTimeline(doc: Document, deliverables: DeliverableSummary[]): void {
	if (deliverables.length === 0) return;

	const sorted = [...deliverables].sort((a, b) => {
		if (!a.dueDate && !b.dueDate) return a.name.localeCompare(b.name);
		if (!a.dueDate) return 1;
		if (!b.dueDate) return -1;
		return a.dueDate.localeCompare(b.dueDate);
	});

	doc.heading(2, "Timeline").addBlank();
	doc.table(
		["Deliverable", "Due Date", "Assignee", "Status", "Completion"],
		sorted.map((d) => [
			Document.wikilink(d.name),
			d.dueDate || "—",
			d.assignee || "—",
			d.status,
			`${d.completionPct}%`,
		]),
	).addBlank();
}

function appendStatusBreakdown(doc: Document, deliverables: DeliverableSummary[]): void {
	if (deliverables.length === 0) return;

	const byStatus = new Map<string, number>();
	for (const d of deliverables) {
		byStatus.set(d.status, (byStatus.get(d.status) ?? 0) + 1);
	}

	doc.heading(2, "Status Breakdown").addBlank();
	doc.table(
		["Status", "Count", "Percentage"],
		[...byStatus.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([status, count]) => [
				status,
				String(count),
				`${Math.round((count / deliverables.length) * 100)}%`,
			]),
	).addBlank();
}

function appendByAssignee(doc: Document, deliverables: DeliverableSummary[]): void {
	const byAssignee = new Map<string, DeliverableSummary[]>();
	for (const d of deliverables) {
		const assignee = d.assignee || "unassigned";
		const list = byAssignee.get(assignee) ?? [];
		list.push(d);
		byAssignee.set(assignee, list);
	}

	if (byAssignee.size <= 1 && byAssignee.has("unassigned")) return;

	doc.heading(2, "By Assignee").addBlank();
	for (const [assignee, group] of [...byAssignee.entries()].sort(([a], [b]) => a.localeCompare(b))) {
		const avgPct = Math.round(group.reduce((s, d) => s + d.completionPct, 0) / group.length);
		doc.heading(3, `${assignee} (${group.length} items, ${avgPct}% avg)`).addBlank();
		doc.list(group.map((d) => `${Document.wikilink(d.name)} — ${d.status} (${d.completionPct}%)`)).addBlank();
	}
}
