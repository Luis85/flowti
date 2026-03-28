import type { PerceptionState } from '../core/component-data.js';

export interface PerceptionInput {
	agentPos: { x: number; y: number };
	agentIQ: number;
	agents: { id: string; pos: { x: number; y: number } }[];
	locations: { id: string; type: string; pos: { x: number; y: number } }[];
	timePhase: string;
}

export interface PerceptionConfig {
	base_multiplier: number;
	night_multiplier: number;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy);
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
		.map(a => ({ id: a.id, distance: distance(input.agentPos, a.pos) }))
		.filter(a => a.distance <= radius)
		.sort((a, b) => a.distance - b.distance);

	const nearbyLocations = input.locations
		.map(l => ({ id: l.id, type: l.type, distance: distance(input.agentPos, l.pos) }))
		.filter(l => l.distance <= radius)
		.sort((a, b) => a.distance - b.distance);

	return { nearbyAgents, nearbyLocations };
}
