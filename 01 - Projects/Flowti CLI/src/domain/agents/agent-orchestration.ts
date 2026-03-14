/**
 * agent-orchestration.ts — Resolves which agent is active for a given lifecycle phase.
 *
 * Pure functions that map lifecycle states to agent-phase bindings from the
 * project config. No I/O — just data lookups.
 */

import type { OrchestrationConfig, PhaseBinding, IterationStatus } from "../../infrastructure/types.js";

export interface ActiveAgent {
	readonly name: string;
	readonly role: string;
	readonly instruction: string;
	readonly state: string;
}

/**
 * Resolve the active agent for the current lifecycle state.
 * Returns null if no agent is bound to the state or no orchestration config exists.
 */
export function getActiveAgent(config: OrchestrationConfig | undefined, state: IterationStatus): ActiveAgent | null {
	if (!config?.phases) return null;
	const binding = config.phases[state];
	if (!binding) return null;
	return toActiveAgent(binding, state);
}

/**
 * List all phase bindings as ActiveAgent entries.
 * Useful for displaying the full orchestration pipeline.
 */
export function listPhaseAgents(config: OrchestrationConfig | undefined): ActiveAgent[] {
	if (!config?.phases) return [];
	return Object.entries(config.phases).map(([state, binding]) => toActiveAgent(binding, state));
}

function toActiveAgent(binding: PhaseBinding, state: string): ActiveAgent {
	return {
		name: binding.agent,
		role: binding.role ?? "contributor",
		instruction: binding.instruction ?? "",
		state,
	};
}
