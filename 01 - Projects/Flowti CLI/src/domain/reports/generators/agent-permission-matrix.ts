/**
 * agent-permission-matrix.ts — Generates an Agent Permission Matrix reference.
 *
 * Documents permission modes, auto-allowed tools, and active grants
 * for each agent from their AI config and runtime state.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import { agentStore } from "../../agents/agent-store.js";
import { readAgentState } from "../../agents/agent-state.js";
import { readProjectConfig } from "../../project/project-config.js";
import { DEFAULT_SAFE_TOOLS } from "../../agents/permission-engine.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { AgentSummary } from "../../agents/agent-types.js";
import type { AgentState } from "../../agents/agent-state.js";

// ── Generator ────────────────────────────────────────────────────────

const VAR_DIR = ".flowti/var";

export function generateAgentPermissionMatrix(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);
	const { config } = readProjectConfig(projectPath, deps);
	const agents = agentStore.list(deps, projectPath, config?.management?.agents ? { dir: config.management.agents.dir } : undefined);
	const varDir = deps.paths.join(projectPath, VAR_DIR);

	const rows = agents.map((agent) => {
		const state = readAgentState(deps, varDir, agent.name);
		return { agent, state };
	});

	const doc = Document.create("Agent Permission Matrix")
		.mergeFrontmatter({
			type: "AgentPermissionMatrix",
			date: deps.clock.iso(),
			agents: agents.length,
			tags: ["reference", "agents", "permissions", "security"],
		})
		.addBlank()
		.heading(1, "Agent Permission Matrix")
		.addBlank()
		.text(`Permission configurations for ${agents.length} agent(s).`)
		.addBlank();

	if (agents.length === 0) {
		doc.text("No agents found.").addBlank();
	}

	appendModeOverview(doc, rows);
	appendGrantsDetail(doc, rows);
	appendDefaultSafeTools(doc);

	const outputPath = svc.saveReference(doc, "Agent Permission Matrix.md");

	return {
		success: true,
		outputPath,
		metrics: { agents: agents.length },
	};
}

// ── Helpers ──────────────────────────────────────────────────────────

interface AgentRow {
	agent: AgentSummary;
	state: AgentState;
}

function getMode(row: AgentRow): string {
	return row.state.permissionOverride ?? row.agent.ai?.permissions?.mode ?? "ask";
}

function appendModeOverview(doc: Document, rows: AgentRow[]): void {
	if (rows.length === 0) return;
	doc.heading(2, "Permission Modes").addBlank();
	doc.table(
		["Agent", "Type", "Mode", "Override", "Auto-Allow Tools", "Active Grants"],
		rows.map((r) => {
			const mode = getMode(r);
			const autoTools = r.agent.ai?.permissions?.autoAllowTools ?? [];
			return [
				Document.wikilink(r.agent.name),
				r.agent.agentType,
				mode,
				r.state.permissionOverride ?? "—",
				autoTools.length > 0 ? autoTools.join(", ") : "—",
				String(r.state.grants.length),
			];
		}),
	).addBlank();
}

function appendGrantsDetail(doc: Document, rows: AgentRow[]): void {
	const withGrants = rows.filter((r) => r.state.grants.length > 0);
	if (withGrants.length === 0) return;

	doc.heading(2, "Active Grants").addBlank();
	for (const row of withGrants) {
		doc.heading(3, row.agent.name).addBlank();
		doc.table(
			["Tool", "Scope", "Granted By", "Granted At"],
			row.state.grants.map((g) => [g.tool, g.scope, g.grantedBy, g.grantedAt]),
		).addBlank();
	}
}

function appendDefaultSafeTools(doc: Document): void {
	doc.heading(2, "Default Safe Tools").addBlank();
	doc.text("Tools auto-allowed in `auto-allow` mode when no custom list is configured:").addBlank();
	doc.list([...DEFAULT_SAFE_TOOLS]).addBlank();
}
