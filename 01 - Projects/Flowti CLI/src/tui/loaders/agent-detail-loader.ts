/**
 * agent-detail-loader.ts — Single agent detail loader.
 *
 * Looks up an agent by name (from params.agentName) and returns
 * a full detail view with all frontmatter and companion JSON fields.
 */

import type { AgentType, AgentSkill } from "../../domain/agents/agent-types.js";
import type { LoaderContext } from "./loader-types.js";
import { findAgent } from "../../domain/agents/agent-store.js";

export interface AgentDetailData {
	readonly found: boolean;
	readonly name: string;
	readonly agentType: AgentType;
	readonly domain: string;
	readonly description: string;
	readonly skills: readonly AgentSkill[];
	readonly tools: readonly string[];
	readonly roles: readonly string[];
	readonly behaviors: readonly string[];
	readonly persona: string;
	readonly mood: string;
}

const EMPTY_DETAIL: AgentDetailData = {
	found: false,
	name: "",
	agentType: "human",
	domain: "",
	description: "",
	skills: [],
	tools: [],
	roles: [],
	behaviors: [],
	persona: "",
	mood: "",
};

export function loadAgentDetail(ctx: LoaderContext): AgentDetailData {
	const { deps, vaultRoot, agentsConfig, params } = ctx;
	const agentName = params.agentName ?? "";

	if (!agentName) {
		return EMPTY_DETAIL;
	}

	try {
		const agent = findAgent(deps, vaultRoot, agentName, agentsConfig);
		if (!agent) {
			return { ...EMPTY_DETAIL, name: agentName };
		}
		return {
			found: true,
			name: agent.name,
			agentType: agent.agentType,
			domain: agent.domain ?? "",
			description: agent.description,
			skills: agent.skills,
			tools: agent.tools,
			roles: agent.roles,
			behaviors: agent.behaviors ?? [],
			persona: agent.persona ?? "",
			mood: agent.mood ?? "",
		};
	} catch {
		return { ...EMPTY_DETAIL, name: agentName };
	}
}
