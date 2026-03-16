/**
 * start-loader.ts — Home dashboard loader.
 *
 * Aggregates project count, agent count, active iteration status,
 * and a compact agent roster for the start page.
 */

import type { AgentType } from "../../domain/agents/agent-types.js";
import type { LoaderContext } from "./loader-types.js";
import { listProjects } from "../../domain/project/project.js";
import { getProjectAgents } from "../../domain/agents/agent-store.js";
import { findCurrentIteration } from "../../domain/iterations/iteration-store.js";

export interface StartData {
	readonly projectCount: number;
	readonly agentCount: number;
	readonly activeIteration: {
		readonly name: string;
		readonly number: number;
		readonly completion: number;
	} | null;
	readonly agents: readonly {
		readonly name: string;
		readonly domain: string;
		readonly agentType: AgentType;
	}[];
}

export function loadStart(ctx: LoaderContext): StartData {
	const { deps, vaultRoot, projectPath, agentsConfig } = ctx;

	let projectCount = 0;
	try {
		const projects = listProjects(vaultRoot, deps);
		projectCount = projects.length;
	} catch {
		projectCount = 0;
	}

	let agents: StartData["agents"] = [];
	let agentCount = 0;
	try {
		const allAgents = getProjectAgents(deps, vaultRoot, agentsConfig, agentsConfig?.roster);
		agentCount = allAgents.length;
		agents = allAgents.map((a) => ({
			name: a.name,
			domain: a.domain ?? "",
			agentType: a.agentType,
		}));
	} catch {
		agents = [];
		agentCount = 0;
	}

	let activeIteration: StartData["activeIteration"] = null;
	if (projectPath) {
		try {
			const current = findCurrentIteration(deps, projectPath);
			if (current) {
				const total = current.scopeItems.length;
				const done = current.scopeItems.filter((s) => s.done).length;
				const completion = total > 0 ? Math.round((done / total) * 100) : 0;
				activeIteration = {
					name: current.name,
					number: current.number,
					completion,
				};
			}
		} catch {
			activeIteration = null;
		}
	}

	return { projectCount, agentCount, activeIteration, agents };
}
