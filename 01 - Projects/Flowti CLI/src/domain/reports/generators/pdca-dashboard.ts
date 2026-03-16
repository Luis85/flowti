/**
 * pdca-dashboard.ts — Generates a PDCA Dashboard reference.
 *
 * Groups agents by their PDCA tags (plan, do, check, act) and
 * provides cycle coverage analysis.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import { agentStore } from "../../agents/agent-store.js";
import { readProjectConfig } from "../../project/project-config.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { AgentSummary } from "../../agents/agent-types.js";

// ── Constants ────────────────────────────────────────────────────────

const PDCA_PHASES = ["plan", "do", "check", "act"] as const;

const PHASE_DESCRIPTIONS: Record<string, string> = {
	plan: "Strategy, design, and planning activities",
	do: "Implementation, execution, and delivery",
	check: "Review, testing, quality assurance, and monitoring",
	act: "Improvement, corrective actions, and adjustments",
};

// ── Generator ────────────────────────────────────────────────────────

export function generatePdcaDashboard(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);
	const { config } = readProjectConfig(projectPath, deps);
	const agents = agentStore.list(deps, projectPath, config?.management?.agents ? { dir: config.management.agents.dir } : undefined);

	const byPhase = groupByPhase(agents);
	const untagged = agents.filter((a) => !a.tags || a.tags.length === 0);

	const doc = buildDashboardDoc(deps, agents, untagged);
	appendPhaseSummary(doc, byPhase, agents.length);
	appendPhaseDetails(doc, byPhase);
	appendUntagged(doc, untagged);
	appendCoverageAnalysis(doc, byPhase);

	const outputPath = svc.saveReference(doc, "PDCA Dashboard.md");

	return {
		success: true,
		outputPath,
		metrics: buildMetrics(agents, byPhase, untagged),
	};
}

function buildDashboardDoc(deps: ReportDeps, agents: AgentSummary[], untagged: AgentSummary[]): Document {
	return Document.create("PDCA Dashboard")
		.mergeFrontmatter({
			type: "PDCADashboard",
			date: deps.clock.iso(),
			agents: agents.length,
			untagged: untagged.length,
			tags: ["reference", "agents", "pdca", "management"],
		})
		.addBlank()
		.heading(1, "PDCA Dashboard")
		.addBlank()
		.text(`${agents.length} agent(s) across the PDCA cycle. ${untagged.length} untagged.`)
		.addBlank();
}

function buildMetrics(agents: AgentSummary[], byPhase: Map<string, AgentSummary[]>, untagged: AgentSummary[]): Record<string, number> {
	return {
		agents: agents.length,
		plan: byPhase.get("plan")?.length ?? 0,
		do: byPhase.get("do")?.length ?? 0,
		check: byPhase.get("check")?.length ?? 0,
		act: byPhase.get("act")?.length ?? 0,
		untagged: untagged.length,
	};
}

// ── Helpers ──────────────────────────────────────────────────────────

function groupByPhase(agents: AgentSummary[]): Map<string, AgentSummary[]> {
	const byPhase = new Map<string, AgentSummary[]>();
	for (const phase of PDCA_PHASES) {
		byPhase.set(phase, []);
	}
	for (const agent of agents) {
		for (const tag of agent.tags ?? []) {
			const lower = tag.toLowerCase();
			if (PDCA_PHASES.includes(lower as typeof PDCA_PHASES[number])) {
				byPhase.get(lower)!.push(agent);
			}
		}
	}
	return byPhase;
}

function appendPhaseSummary(doc: Document, byPhase: Map<string, AgentSummary[]>, total: number): void {
	doc.heading(2, "Phase Summary").addBlank();
	doc.table(
		["Phase", "Agents", "Coverage", "Description"],
		PDCA_PHASES.map((phase) => {
			const count = byPhase.get(phase)?.length ?? 0;
			const pct = total > 0 ? Math.round((count / total) * 100) : 0;
			return [phase.toUpperCase(), String(count), `${pct}%`, PHASE_DESCRIPTIONS[phase]];
		}),
	).addBlank();
}

function appendPhaseDetails(doc: Document, byPhase: Map<string, AgentSummary[]>): void {
	for (const phase of PDCA_PHASES) {
		const agents = byPhase.get(phase) ?? [];
		doc.heading(2, `${phase.toUpperCase()} Phase`).addBlank();

		if (agents.length === 0) {
			doc.text("No agents assigned to this phase.").addBlank();
			continue;
		}

		doc.table(
			["Agent", "Type", "Domain", "Roles"],
			agents.map((a) => [
				Document.wikilink(a.name),
				a.agentType,
				a.domain ?? "—",
				a.roles.join(", ") || "—",
			]),
		).addBlank();
	}
}

function appendUntagged(doc: Document, untagged: AgentSummary[]): void {
	if (untagged.length === 0) return;

	doc.heading(2, "Untagged Agents").addBlank();
	doc.text("These agents have no PDCA tags and are not assigned to any cycle phase:").addBlank();
	doc.list(untagged.map((a) => `${Document.wikilink(a.name)} — ${a.description || "no description"}`)).addBlank();
}

function appendCoverageAnalysis(doc: Document, byPhase: Map<string, AgentSummary[]>): void {
	const empty = PDCA_PHASES.filter((p) => (byPhase.get(p)?.length ?? 0) === 0);
	if (empty.length === 0) return;

	doc.heading(2, "Coverage Gaps").addBlank();
	doc.callout("warning", "Missing PDCA Coverage", [
		`The following phases have no assigned agents: **${empty.map((p) => p.toUpperCase()).join(", ")}**.`,
		"Consider assigning agents to these phases for complete cycle coverage.",
	]).addBlank();
}
