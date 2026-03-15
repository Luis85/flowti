/**
 * agent-roster-reference.ts — Generates an Agent Roster Reference document.
 *
 * Documents all agents with their type, domain, roles, skills, PDCA tags,
 * attributes, and relationships.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import { listAgents } from "../../agents/agent-store.js";
import { readProjectConfig } from "../../project/project-config.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { AgentSummary } from "../../agents/agent-types.js";

// ── Generator ────────────────────────────────────────────────────────

export function generateAgentRosterReference(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);
	const { config } = readProjectConfig(projectPath, deps);
	const agents = listAgents(deps, projectPath, config?.management?.agents);

	const aiCount = agents.filter((a) => a.agentType === "ai").length;
	const humanCount = agents.filter((a) => a.agentType === "human").length;
	const domains = new Set(agents.map((a) => a.domain).filter(Boolean));

	const doc = Document.create("Agent Roster Reference")
		.mergeFrontmatter({
			type: "AgentRosterReference",
			date: deps.clock.iso(),
			total: agents.length,
			ai: aiCount,
			human: humanCount,
			domains: domains.size,
			tags: ["reference", "agents", "roster"],
		})
		.addBlank()
		.heading(1, "Agent Roster Reference")
		.addBlank()
		.text(`${agents.length} agent(s) registered. ${aiCount} AI, ${humanCount} human across ${domains.size} domain(s).`)
		.addBlank();

	if (agents.length === 0) {
		doc.text("No agents found. Create agents in the configured agents directory.").addBlank();
	}

	appendOverviewTable(doc, agents);
	appendByDomain(doc, agents);
	appendAttributesSummary(doc, agents);

	const outputPath = svc.saveReference(doc, "Agent Roster Reference.md");

	return {
		success: true,
		outputPath,
		metrics: { total: agents.length, ai: aiCount, human: humanCount, domains: domains.size },
	};
}

// ── Helpers ──────────────────────────────────────────────────────────

function appendOverviewTable(doc: Document, agents: AgentSummary[]): void {
	if (agents.length === 0) return;
	doc.heading(2, "Roster Overview").addBlank();
	doc.table(
		["Agent", "Type", "Domain", "Roles", "Skills", "Tags"],
		agents.map((a) => [
			Document.wikilink(a.name),
			a.agentType,
			a.domain ?? "—",
			a.roles.join(", ") || "—",
			String(a.skills.length),
			a.tags?.join(", ") ?? "—",
		]),
	).addBlank();
}

function appendByDomain(doc: Document, agents: AgentSummary[]): void {
	const byDomain = new Map<string, AgentSummary[]>();
	for (const agent of agents) {
		const domain = agent.domain ?? "unassigned";
		const list = byDomain.get(domain) ?? [];
		list.push(agent);
		byDomain.set(domain, list);
	}

	doc.heading(2, "By Domain").addBlank();
	for (const [domain, group] of [...byDomain.entries()].sort(([a], [b]) => a.localeCompare(b))) {
		doc.heading(3, domain).addBlank();
		doc.table(
			["Agent", "Type", "Roles", "Description"],
			group.map((a) => [
				Document.wikilink(a.name),
				a.agentType,
				a.roles.join(", ") || "—",
				a.description || "—",
			]),
		).addBlank();
	}
}

function appendAttributesSummary(doc: Document, agents: AgentSummary[]): void {
	const withAttrs = agents.filter((a) => a.attributes);
	if (withAttrs.length === 0) return;

	doc.heading(2, "Character Attributes").addBlank();
	doc.table(
		["Agent", "STR", "INT", "WIS", "CHA", "DEX", "CON"],
		withAttrs.map(formatAttributeRow),
	).addBlank();
}

const ATTR_KEYS = ["str", "int", "wis", "cha", "dex", "con"] as const;

function formatAttributeRow(a: AgentSummary): string[] {
	const attr = a.attributes as Record<string, number | undefined> | undefined;
	return [
		Document.wikilink(a.name),
		...ATTR_KEYS.map((k) => String(attr?.[k] ?? "—")),
	];
}
