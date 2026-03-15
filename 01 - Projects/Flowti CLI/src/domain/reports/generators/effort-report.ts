/**
 * effort-report.ts — Generates an Effort Report reference.
 *
 * Summarizes time-log entries by person, category, and date range.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import { listTimeLogEntries, summarizeTimeLog } from "../../timelog/timelog-store.js";
import { readProjectConfig } from "../../project/project-config.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { TimeLogEntry } from "../../timelog/timelog-types.js";

// ── Generator ────────────────────────────────────────────────────────

export function generateEffortReport(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);
	const { config } = readProjectConfig(projectPath, deps);
	const entries = listTimeLogEntries(deps, projectPath, config?.management?.timelog);
	const summary = summarizeTimeLog(entries);

	const doc = Document.create("Effort Report")
		.mergeFrontmatter({
			type: "EffortReport",
			date: deps.clock.iso(),
			entries: entries.length,
			totalHours: summary.totalHours,
			contributors: Object.keys(summary.byPerson).length,
			tags: ["reference", "effort", "timelog", "management"],
		})
		.addBlank()
		.heading(1, "Effort Report")
		.addBlank()
		.text(`${entries.length} time-log entries. ${summary.totalHours}h total across ${Object.keys(summary.byPerson).length} contributor(s).`)
		.addBlank();

	if (entries.length === 0) {
		doc.text("No time-log entries found. Create entries in the configured timelog directory.").addBlank();
	}

	appendByPerson(doc, summary.byPerson, summary.totalHours);
	appendByCategory(doc, summary.byCategory, summary.totalHours);
	appendRecentEntries(doc, entries);

	const outputPath = svc.saveReference(doc, "Effort Report.md");

	return {
		success: true,
		outputPath,
		metrics: { entries: entries.length, totalHours: summary.totalHours, contributors: Object.keys(summary.byPerson).length },
	};
}

// ── Helpers ──────────────────────────────────────────────────────────

function appendByPerson(doc: Document, byPerson: Record<string, number>, totalHours: number): void {
	if (Object.keys(byPerson).length === 0) return;

	doc.heading(2, "Hours by Person").addBlank();
	doc.table(
		["Person", "Hours", "Share"],
		Object.entries(byPerson)
			.sort(([, a], [, b]) => b - a)
			.map(([person, hours]) => [
				person,
				String(hours),
				totalHours > 0 ? `${Math.round((hours / totalHours) * 100)}%` : "—",
			]),
	).addBlank();
}

function appendByCategory(doc: Document, byCategory: Record<string, number>, totalHours: number): void {
	if (Object.keys(byCategory).length === 0) return;

	doc.heading(2, "Hours by Category").addBlank();
	doc.table(
		["Category", "Hours", "Share"],
		Object.entries(byCategory)
			.sort(([, a], [, b]) => b - a)
			.map(([category, hours]) => [
				category,
				String(hours),
				totalHours > 0 ? `${Math.round((hours / totalHours) * 100)}%` : "—",
			]),
	).addBlank();
}

function appendRecentEntries(doc: Document, entries: TimeLogEntry[]): void {
	const recent = entries.slice(0, 20);
	if (recent.length === 0) return;

	doc.heading(2, "Recent Entries").addBlank();
	doc.table(
		["Date", "Person", "Hours", "Category", "Task"],
		recent.map((e) => [
			e.date,
			e.person,
			String(e.hours),
			e.category,
			e.task || "—",
		]),
	).addBlank();

	if (entries.length > 20) {
		doc.text(`Showing 20 of ${entries.length} entries.`).addBlank();
	}
}
