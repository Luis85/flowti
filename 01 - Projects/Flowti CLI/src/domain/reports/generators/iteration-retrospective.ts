/**
 * iteration-retrospective.ts — Generates an Iteration Retrospective reference.
 *
 * Documents all iterations with status, dates, scope completion,
 * agent participation, and velocity metrics.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import { listIterations } from "../../iterations/iteration-store.js";
import { readProjectConfig } from "../../project/project-config.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { IterationSummary } from "../../iterations/iteration-types.js";

// ── Generator ────────────────────────────────────────────────────────

export function generateIterationRetrospective(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);
	const { config } = readProjectConfig(projectPath, deps);
	const iterations = listIterations(deps, projectPath, config?.management?.iterations);

	const done = iterations.filter((i) => i.status === "done");
	const active = iterations.filter((i) => i.status !== "done" && i.status !== "cancelled");

	const doc = Document.create("Iteration Retrospective")
		.mergeFrontmatter({
			type: "IterationRetrospective",
			date: deps.clock.iso(),
			total: iterations.length,
			completed: done.length,
			active: active.length,
			tags: ["reference", "iterations", "retrospective", "management"],
		})
		.addBlank()
		.heading(1, "Iteration Retrospective")
		.addBlank()
		.text(`${iterations.length} iteration(s) tracked. ${done.length} completed, ${active.length} active.`)
		.addBlank();

	if (iterations.length === 0) {
		doc.text("No iterations found. Create iterations in the configured iterations directory.").addBlank();
	}

	appendOverview(doc, iterations);
	appendVelocity(doc, iterations);
	appendAgentParticipation(doc, iterations);

	const outputPath = svc.saveReference(doc, "Iteration Retrospective.md");

	return {
		success: true,
		outputPath,
		metrics: { total: iterations.length, completed: done.length, active: active.length },
	};
}

// ── Helpers ──────────────────────────────────────────────────────────

function appendOverview(doc: Document, iterations: IterationSummary[]): void {
	if (iterations.length === 0) return;

	doc.heading(2, "Iteration Overview").addBlank();
	doc.table(
		["#", "Name", "Status", "Start", "End", "Goal", "Scope Done"],
		iterations.map((it) => {
			const total = it.scopeItems.length;
			const done = it.scopeItems.filter((s) => s.done).length;
			const pct = total > 0 ? Math.round((done / total) * 100) : 0;
			return [
				String(it.number),
				it.name,
				it.status,
				it.startDate || "—",
				it.endDate || "—",
				it.goal || "—",
				total > 0 ? `${done}/${total} (${pct}%)` : "—",
			];
		}),
	).addBlank();
}

function appendVelocity(doc: Document, iterations: IterationSummary[]): void {
	const completed = iterations.filter((i) => i.status === "done" && i.scopeItems.length > 0);
	if (completed.length === 0) return;

	const velocities = completed.map((it) => ({
		number: it.number,
		name: it.name,
		total: it.scopeItems.length,
		done: it.scopeItems.filter((s) => s.done).length,
	}));

	const avgVelocity = velocities.reduce((sum, v) => sum + v.done, 0) / velocities.length;
	const avgCompletion = velocities.reduce((sum, v) => sum + (v.done / v.total) * 100, 0) / velocities.length;

	doc.heading(2, "Velocity").addBlank();
	doc.text(`Average velocity: **${avgVelocity.toFixed(1)}** items/iteration`).addBlank();
	doc.text(`Average completion rate: **${avgCompletion.toFixed(0)}%**`).addBlank();
	doc.table(
		["Iteration", "Scope", "Done", "Completion"],
		velocities.map((v) => [
			`#${v.number} ${v.name}`,
			String(v.total),
			String(v.done),
			`${Math.round((v.done / v.total) * 100)}%`,
		]),
	).addBlank();
}

function appendAgentParticipation(doc: Document, iterations: IterationSummary[]): void {
	const agentCounts = new Map<string, number>();
	for (const it of iterations) {
		for (const agent of it.agents) {
			agentCounts.set(agent.name, (agentCounts.get(agent.name) ?? 0) + 1);
		}
	}
	if (agentCounts.size === 0) return;

	doc.heading(2, "Agent Participation").addBlank();
	doc.table(
		["Agent", "Iterations"],
		[...agentCounts.entries()]
			.sort(([, a], [, b]) => b - a)
			.map(([name, count]) => [Document.wikilink(name), String(count)]),
	).addBlank();
}
