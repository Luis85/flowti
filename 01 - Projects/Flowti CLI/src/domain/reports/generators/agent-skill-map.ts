/**
 * agent-skill-map.ts — Generates an Agent Skill Map reference.
 *
 * Cross-references agents with their skills in a matrix,
 * identifies coverage gaps and skill concentrations.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import { agentStore } from "../../agents/agent-store.js";
import { readProjectConfig } from "../../project/project-config.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { AgentSummary } from "../../agents/agent-types.js";

// ── Generator ────────────────────────────────────────────────────────

export function generateAgentSkillMap(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);
	const { config } = readProjectConfig(projectPath, deps);
	const agents = agentStore.list(deps, projectPath, config?.management?.agents ? { dir: config.management.agents.dir } : undefined);

	const allSkills = collectSkills(agents);
	const singleAgentSkills = findSingleAgentSkills(agents, allSkills);

	const doc = Document.create("Agent Skill Map")
		.mergeFrontmatter({
			type: "AgentSkillMap",
			date: deps.clock.iso(),
			agents: agents.length,
			uniqueSkills: allSkills.length,
			tags: ["reference", "agents", "skills"],
		})
		.addBlank()
		.heading(1, "Agent Skill Map")
		.addBlank()
		.text(`${agents.length} agent(s), ${allSkills.length} unique skill(s).`)
		.addBlank();

	if (agents.length === 0) {
		doc.text("No agents found.").addBlank();
	}

	appendSkillMatrix(doc, agents, allSkills);
	appendSkillCoverage(doc, agents, allSkills);
	appendCoverageGaps(doc, singleAgentSkills);

	const outputPath = svc.saveReference(doc, "Agent Skill Map.md");

	return {
		success: true,
		outputPath,
		metrics: { agents: agents.length, uniqueSkills: allSkills.length, singleAgentSkills: singleAgentSkills.length },
	};
}

// ── Helpers ──────────────────────────────────────────────────────────

function collectSkills(agents: AgentSummary[]): string[] {
	const skills = new Set<string>();
	for (const agent of agents) {
		for (const skill of agent.skills) {
			skills.add(skill.name);
		}
	}
	return [...skills].sort();
}

function findSingleAgentSkills(agents: AgentSummary[], allSkills: string[]): string[] {
	return allSkills.filter((skill) => {
		const count = agents.filter((a) => a.skills.some((s) => s.name === skill)).length;
		return count === 1;
	});
}

function appendSkillMatrix(doc: Document, agents: AgentSummary[], allSkills: string[]): void {
	if (agents.length === 0 || allSkills.length === 0) return;

	doc.heading(2, "Skill Matrix").addBlank();
	doc.table(
		["Skill", ...agents.map((a) => a.name)],
		allSkills.map((skill) => [
			skill,
			...agents.map((a) => {
				const match = a.skills.find((s) => s.name === skill);
				return match ? (match.level || "yes") : "—";
			}),
		]),
	).addBlank();
}

function appendSkillCoverage(doc: Document, agents: AgentSummary[], allSkills: string[]): void {
	if (allSkills.length === 0) return;

	const coverage = allSkills.map((skill) => {
		const holders = agents.filter((a) => a.skills.some((s) => s.name === skill));
		return { skill, count: holders.length, agents: holders.map((a) => a.name).join(", ") };
	}).sort((a, b) => b.count - a.count);

	doc.heading(2, "Skill Coverage").addBlank();
	doc.table(
		["Skill", "Agents", "Holders"],
		coverage.map((c) => [c.skill, String(c.count), c.agents]),
	).addBlank();
}

function appendCoverageGaps(doc: Document, singleAgentSkills: string[]): void {
	if (singleAgentSkills.length === 0) return;

	doc.heading(2, "Coverage Gaps (Single Agent)").addBlank();
	doc.text("These skills are held by only one agent — a bus-factor risk:").addBlank();
	doc.list(singleAgentSkills).addBlank();
}
