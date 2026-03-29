import { describe, it, expect, vi } from 'vitest';
import { createAgentSpawner } from '../../../src/infrastructure/entity/agent-spawner.js';
import type { VaultReader } from '../../../src/infrastructure/entity/agent-spawner.js';
import { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { AttributesComponent } from '../../../src/infrastructure/components/attributes-component.js';
import { TraitsComponent } from '../../../src/infrastructure/components/traits-component.js';

const validAgent = {
	id: 'agent-elena',
	name: 'Elena',
	kind: 'merchant',
	attributes: { ST: 10, DX: 12, IQ: 14, HT: 11 },
	social: { status: 2, reputation: 1, charisma: 14 },
	needs: { hunger: 80, energy: 90, social: 70 },
	mood: 0,
	memory: [],
	goals: [],
	skills: [],
	inventory: [],
	equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
	traits: ['curious'],
	wallet: { gold: 50 },
	xp: 0,
	level: 1,
	position: { x: 100, y: 200, region: 'town-square' },
	relationships: 'graphs/relationships.canvas',
	tools: [],
	color: '#b0b0b0', behavior_tree: 'bt/merchant.md',
	job: null,
	property: [],
};

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const defaultMoodConfig = {
	factor_weights: { needs: 30, positive_memories: 20, negative_memories: 20, goal_progress: 10, wallet: 10, equipment: 5, relationships: 5 },
	buckets: [
		{ name: 'elated', min: 60, max: 100 },
		{ name: 'content', min: 20, max: 59 },
		{ name: 'stressed', min: -19, max: 19 },
		{ name: 'distressed', min: -59, max: -20 },
		{ name: 'breakdown', min: -100, max: -60 },
	],
	external_modifier_cap: 30,
};

function createMockVault(files: Record<string, string>): VaultReader {
	return {
		async list(path: string): Promise<string[]> {
			return Object.keys(files).filter(f => f.startsWith(path));
		},
		async read(path: string): Promise<string> {
			const content = files[path];
			if (content === undefined) throw new Error(`File not found: ${path}`);
			return content;
		},
	};
}

describe('AgentSpawner', () => {
	it('spawns valid agent with correct components', async () => {
		const vault = createMockVault({ 'agents/elena.json': JSON.stringify(validAgent) });
		const spawner = createAgentSpawner(logger, defaultMoodConfig);
		const result = await spawner.spawnFromVault(vault, 'agents/');
		expect(result.agents).toHaveLength(1);
		expect(result.agents[0]).toBeInstanceOf(AgentActor);
		expect(result.agents[0]?.agentId).toBe('agent-elena');
		expect(result.agents[0]?.get(NeedsComponent).state.hunger).toBe(80);
		expect(result.agents[0]?.get(AttributesComponent).state.IQ).toBe(14);
		expect(result.agents[0]?.get(TraitsComponent).traitIds).toEqual(['curious']);
	});

	it('skips invalid agent and collects error', async () => {
		const vault = createMockVault({ 'agents/bad.json': '{"invalid": true}' });
		const spawner = createAgentSpawner(logger, defaultMoodConfig);
		const result = await spawner.spawnFromVault(vault, 'agents/');
		expect(result.agents).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.file).toBe('agents/bad.json');
	});

	it('handles empty directory', async () => {
		const vault = createMockVault({});
		const spawner = createAgentSpawner(logger, defaultMoodConfig);
		const result = await spawner.spawnFromVault(vault, 'agents/');
		expect(result.agents).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
	});

	it('spawns multiple valid agents', async () => {
		const agent2 = { ...validAgent, id: 'agent-marcus', name: 'Marcus' };
		const vault = createMockVault({
			'agents/elena.json': JSON.stringify(validAgent),
			'agents/marcus.json': JSON.stringify(agent2),
		});
		const spawner = createAgentSpawner(logger, defaultMoodConfig);
		const result = await spawner.spawnFromVault(vault, 'agents/');
		expect(result.agents).toHaveLength(2);
	});

	it('skips non-JSON parse errors gracefully', async () => {
		const vault = createMockVault({ 'agents/broken.json': 'not json at all' });
		const spawner = createAgentSpawner(logger, defaultMoodConfig);
		const result = await spawner.spawnFromVault(vault, 'agents/');
		expect(result.agents).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
	});
});
