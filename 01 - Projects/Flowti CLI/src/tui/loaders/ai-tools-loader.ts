/**
 * ai-tools-loader.ts — Agent list loader.
 *
 * Fetches all project agents and maps them to a compact list
 * suitable for the AI tools / agent overview page.
 */

import type { AgentType } from "../../domain/agents/agent-types.js";
import type { LoaderContext } from "./loader-types.js";
import { getProjectAgents } from "../../domain/agents/agent-store.js";

export interface AiToolsAgentEntry {
	readonly name: string;
	readonly agentType: AgentType;
	readonly domain: string;
	readonly description: string;
	readonly skills: readonly string[];
	readonly file: string;
}

/** Alias for page compatibility. */
export type AgentListItem = AiToolsAgentEntry;

export interface AiToolsData {
	readonly agents: readonly AiToolsAgentEntry[];
}

export function loadAiTools(ctx: LoaderContext): AiToolsData {
	const { deps, vaultRoot, agentsConfig } = ctx;

	try {
		const allAgents = getProjectAgents(deps, vaultRoot, agentsConfig, agentsConfig?.roster);
		const agents: AiToolsAgentEntry[] = allAgents.map((a) => ({
			name: a.name,
			agentType: a.agentType,
			domain: a.domain ?? "",
			description: a.description,
			skills: a.skills.map((s) => s.name),
			file: a.file,
		}));
		return { agents };
	} catch {
		return { agents: [] };
	}
}
