import { describe, it, expect } from 'vitest';
import {
	serializeRelationshipGraph,
	serializeAgentRelationshipView,
	type RelationshipGraphInput,
} from '../../../src/domain/systems/relationship-canvas.js';

function makeAgent(id: string, name: string, kind = 'merchant', color = '#b0b0b0') {
	return { id, name, kind, color };
}

function makeRelEntry(agentId: string, disposition: number, familiarity: number) {
	return { agentId, disposition, familiarity, tags: [], lastInteractionTick: 0 };
}

describe('serializeRelationshipGraph', () => {
	it('produces valid JSON with nodes and edges arrays', () => {
		const input: RelationshipGraphInput = {
			agents: [makeAgent('a1', 'Alice'), makeAgent('a2', 'Bob')],
			relationships: [
				{ agentId: 'a1', entries: [makeRelEntry('a2', 10, 5)] },
			],
		};

		const result = JSON.parse(serializeRelationshipGraph(input)) as { nodes: unknown[]; edges: unknown[] };
		expect(Array.isArray(result.nodes)).toBe(true);
		expect(Array.isArray(result.edges)).toBe(true);
		expect(result.nodes).toHaveLength(2);
		expect(result.edges).toHaveLength(1);
	});

	it('places 4 agents at evenly-spaced circle positions', () => {
		const input: RelationshipGraphInput = {
			agents: [
				makeAgent('a1', 'Alice'),
				makeAgent('a2', 'Bob'),
				makeAgent('a3', 'Carol'),
				makeAgent('a4', 'Dave'),
			],
			relationships: [],
		};

		const result = JSON.parse(serializeRelationshipGraph(input)) as {
			nodes: { id: string; x: number; y: number; width: number; height: number }[];
		};
		expect(result.nodes).toHaveLength(4);

		// All nodes should have correct dimensions
		for (const node of result.nodes) {
			expect(node.width).toBe(160);
			expect(node.height).toBe(60);
		}

		// First agent at angle 0 => x = 400 + 200*cos(0) - 80 = 520, y = 300 + 200*sin(0) - 30 = 270
		expect(result.nodes[0]?.x).toBeCloseTo(520, 0);
		expect(result.nodes[0]?.y).toBeCloseTo(270, 0);

		// Second agent at angle pi/2 => x = 400 + 200*cos(pi/2) - 80 ~ 320, y = 300 + 200*sin(pi/2) - 30 = 470
		expect(result.nodes[1]?.x).toBeCloseTo(320, 0);
		expect(result.nodes[1]?.y).toBeCloseTo(470, 0);
	});

	it('assigns green edge color for disposition >= 20', () => {
		const input: RelationshipGraphInput = {
			agents: [makeAgent('a1', 'Alice'), makeAgent('a2', 'Bob')],
			relationships: [
				{ agentId: 'a1', entries: [makeRelEntry('a2', 25, 5)] },
			],
		};

		const result = JSON.parse(serializeRelationshipGraph(input)) as {
			edges: { color: string }[];
		};
		expect(result.edges[0]?.color).toBe('4');
	});

	it('assigns red edge color for disposition <= -20', () => {
		const input: RelationshipGraphInput = {
			agents: [makeAgent('a1', 'Alice'), makeAgent('a2', 'Bob')],
			relationships: [
				{ agentId: 'a1', entries: [makeRelEntry('a2', -30, 5)] },
			],
		};

		const result = JSON.parse(serializeRelationshipGraph(input)) as {
			edges: { color: string }[];
		};
		expect(result.edges[0]?.color).toBe('1');
	});

	it('assigns grey edge color for neutral disposition', () => {
		const input: RelationshipGraphInput = {
			agents: [makeAgent('a1', 'Alice'), makeAgent('a2', 'Bob')],
			relationships: [
				{ agentId: 'a1', entries: [makeRelEntry('a2', 5, 3)] },
			],
		};

		const result = JSON.parse(serializeRelationshipGraph(input)) as {
			edges: { color: string }[];
		};
		expect(result.edges[0]?.color).toBe('0');
	});

	it('filters out edges with familiarity <= 0', () => {
		const input: RelationshipGraphInput = {
			agents: [makeAgent('a1', 'Alice'), makeAgent('a2', 'Bob')],
			relationships: [
				{ agentId: 'a1', entries: [makeRelEntry('a2', 10, 0)] },
			],
		};

		const result = JSON.parse(serializeRelationshipGraph(input)) as {
			edges: unknown[];
		};
		expect(result.edges).toHaveLength(0);
	});

	it('formats edge label as "disposition: N | familiarity: N"', () => {
		const input: RelationshipGraphInput = {
			agents: [makeAgent('a1', 'Alice'), makeAgent('a2', 'Bob')],
			relationships: [
				{ agentId: 'a1', entries: [makeRelEntry('a2', 15, 7)] },
			],
		};

		const result = JSON.parse(serializeRelationshipGraph(input)) as {
			edges: { label: string }[];
		};
		expect(result.edges[0]?.label).toBe('disposition: 15 | familiarity: 7');
	});

	it('returns empty nodes and edges for 0 agents', () => {
		const input: RelationshipGraphInput = {
			agents: [],
			relationships: [],
		};

		const result = JSON.parse(serializeRelationshipGraph(input)) as {
			nodes: unknown[];
			edges: unknown[];
		};
		expect(result.nodes).toHaveLength(0);
		expect(result.edges).toHaveLength(0);
	});
});

describe('serializeAgentRelationshipView', () => {
	it('filters to only target agent edges', () => {
		const input: RelationshipGraphInput = {
			agents: [makeAgent('a1', 'Alice'), makeAgent('a2', 'Bob'), makeAgent('a3', 'Carol')],
			relationships: [
				{ agentId: 'a1', entries: [makeRelEntry('a2', 10, 5)] },
				{ agentId: 'a2', entries: [makeRelEntry('a3', 20, 3)] },
			],
		};

		const result = JSON.parse(serializeAgentRelationshipView('a1', input)) as {
			edges: { fromNode: string; toNode: string }[];
		};
		// Only a1's edge to a2 should appear
		expect(result.edges).toHaveLength(1);
		expect(result.edges[0]?.fromNode).toBe('a1');
		expect(result.edges[0]?.toNode).toBe('a2');
	});

	it('places target agent at center and others in semicircle', () => {
		const input: RelationshipGraphInput = {
			agents: [makeAgent('a1', 'Alice'), makeAgent('a2', 'Bob'), makeAgent('a3', 'Carol')],
			relationships: [
				{ agentId: 'a1', entries: [makeRelEntry('a2', 10, 5), makeRelEntry('a3', 15, 3)] },
			],
		};

		const result = JSON.parse(serializeAgentRelationshipView('a1', input)) as {
			nodes: { id: string; x: number; y: number }[];
		};
		// 3 nodes: target + 2 connected
		expect(result.nodes).toHaveLength(3);

		// First node is target at center (400 - 80 = 320, 300 - 30 = 270)
		expect(result.nodes[0]?.id).toBe('a1');
		expect(result.nodes[0]?.x).toBe(320);
		expect(result.nodes[0]?.y).toBe(270);

		// Other nodes should be at semicircle positions (radius 200 from center)
		// Node at index 0 in semicircle: angle = 0 => x = 400 + 200 - 80 = 520, y = 300 + 0 - 30 = 270
		expect(result.nodes[1]?.x).toBeCloseTo(520, 0);
		expect(result.nodes[1]?.y).toBeCloseTo(270, 0);
	});
});
