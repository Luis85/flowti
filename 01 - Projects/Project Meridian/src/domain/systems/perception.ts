import type { PerceptionState } from '../core/component-data.js';
import { distance } from '../core/math-utils.js';

export interface PerceptionInput {
	agentPos: { x: number; y: number };
	agentIQ: number;
	agents: { id: string; pos: { x: number; y: number } }[];
	locations: { id: string; type: string; facility_type: string; pos: { x: number; y: number } }[];
	timePhase: string;
}

export interface PerceptionConfig {
	base_multiplier: number;
	night_multiplier: number;
}

export function resolvePerception(
	input: PerceptionInput,
	config: PerceptionConfig,
): PerceptionState {
	let radius = config.base_multiplier * input.agentIQ;
	if (input.timePhase === 'night') {
		radius *= config.night_multiplier;
	}

	const nearbyAgents = input.agents
		.map(a => ({ id: a.id, distance: distance(input.agentPos.x, input.agentPos.y, a.pos.x, a.pos.y) }))
		.filter(a => a.distance <= radius)
		.sort((a, b) => a.distance - b.distance);

	const nearbyLocations = input.locations
		.map(l => ({ id: l.id, type: l.type, facility_type: l.facility_type, distance: distance(input.agentPos.x, input.agentPos.y, l.pos.x, l.pos.y) }))
		.filter(l => l.distance <= radius)
		.sort((a, b) => a.distance - b.distance);

	return { nearbyAgents, nearbyLocations };
}
