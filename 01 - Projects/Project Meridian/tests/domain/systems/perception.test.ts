import { describe, it, expect } from 'vitest';
import { resolvePerception } from '../../../src/domain/systems/perception.js';
import type { PerceptionInput } from '../../../src/domain/systems/perception.js';

const defaultConfig = { base_multiplier: 20, night_multiplier: 0.5 };

function makeInput(overrides: Partial<PerceptionInput> = {}): PerceptionInput {
	return {
		agentPos: { x: 0, y: 0 },
		agentIQ: 10,
		agents: [],
		locations: [],
		timePhase: 'day',
		...overrides,
	};
}

describe('resolvePerception', () => {
	it('detects agents within radius', () => {
		const input = makeInput({ agents: [{ id: 'a1', pos: { x: 100, y: 0 } }] });
		const result = resolvePerception(input, defaultConfig);
		expect(result.nearbyAgents).toHaveLength(1);
		expect(result.nearbyAgents[0]?.id).toBe('a1');
	});

	it('excludes agents outside radius', () => {
		const input = makeInput({ agents: [{ id: 'a1', pos: { x: 300, y: 0 } }] });
		const result = resolvePerception(input, defaultConfig);
		expect(result.nearbyAgents).toHaveLength(0);
	});

	it('detects locations within radius', () => {
		const input = makeInput({ locations: [{ id: 'loc1', type: 'food', pos: { x: 50, y: 0 } }] });
		const result = resolvePerception(input, defaultConfig);
		expect(result.nearbyLocations).toHaveLength(1);
		expect(result.nearbyLocations[0]?.type).toBe('food');
	});

	it('IQ scaling expands radius', () => {
		const input = makeInput({ agentIQ: 20, agents: [{ id: 'a1', pos: { x: 350, y: 0 } }] });
		const result = resolvePerception(input, defaultConfig);
		expect(result.nearbyAgents).toHaveLength(1);
	});

	it('low IQ shrinks radius', () => {
		const input = makeInput({ agentIQ: 5, agents: [{ id: 'a1', pos: { x: 150, y: 0 } }] });
		const result = resolvePerception(input, defaultConfig);
		expect(result.nearbyAgents).toHaveLength(0);
	});

	it('night multiplier reduces radius', () => {
		const input = makeInput({ timePhase: 'night', agents: [{ id: 'a1', pos: { x: 150, y: 0 } }] });
		const result = resolvePerception(input, defaultConfig);
		expect(result.nearbyAgents).toHaveLength(0);
	});

	it('results sorted by distance (nearest first)', () => {
		const input = makeInput({ agents: [{ id: 'far', pos: { x: 150, y: 0 } }, { id: 'near', pos: { x: 50, y: 0 } }] });
		const result = resolvePerception(input, defaultConfig);
		expect(result.nearbyAgents[0]?.id).toBe('near');
		expect(result.nearbyAgents[1]?.id).toBe('far');
	});

	it('includes distance in results', () => {
		const input = makeInput({ agents: [{ id: 'a1', pos: { x: 30, y: 40 } }] });
		const result = resolvePerception(input, defaultConfig);
		expect(result.nearbyAgents[0]?.distance).toBeCloseTo(50, 1);
	});

	it('returns empty arrays when nothing is nearby', () => {
		const result = resolvePerception(makeInput(), defaultConfig);
		expect(result.nearbyAgents).toHaveLength(0);
		expect(result.nearbyLocations).toHaveLength(0);
	});
});
