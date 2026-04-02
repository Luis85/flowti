import { describe, it, expect, vi } from 'vitest';
import { createWorldLoader } from '../../../src/infrastructure/engine/world-loader.js';
import type { VaultReader } from '../../../src/infrastructure/entity/agent-spawner.js';

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

const loaderConfig = {
	moodConfig: defaultMoodConfig,
	memoryMaxEntries: 50,
};

const validAgent = {
	id: 'agent-elena',
	name: 'Elena',
	kind: 'merchant',
	attributes: { ST: 10, DX: 12, IQ: 14, HT: 11 },
	social: { status: 2, reputation: 1, charisma: 14 },
	needs: { hunger: 80, energy: 90, social: 70, thirst: 80 },
	mood: 0,
	memory: [],
	goals: [],
	skills: [],
	inventory: [],
	equipment: { head: null, body: null, hands: null, tool: null, accessory: null },
	traits: ['hardy'],
	wallet: { gold: 50 },
	xp: 0,
	level: 1,
	position: { x: 100, y: 200, region: 'town-square' },
	relationships: 'graphs/relationships.canvas',
	tools: [],
	color: '#b0b0b0',
	behavior_tree: 'merchant',
	job: null,
	property: [],
};

const validTrait = {
	id: 'hardy',
	effects: [{ system: 'NeedsDecaySystem', modifier: { hungerDecayScale: 0.8 } }],
	conflicts_with: ['frail'],
};

const validLocation = {
	id: 'loc-tavern',
	name: 'The Rusty Anchor',
	type: 'rest',
	position: { x: 300, y: 200 },
	capacity: 5,
};

// Minimal valid MDSL for testing — a simple root with one action
const baseMdsl = 'root {\n    action [Idle]\n}\n';
const branchMdsl = 'root [Role] {\n    action [Wander]\n}\n';

function createMockVault(files: Record<string, string>): VaultReader {
	return {
		async list(path: string): Promise<string[]> { return Object.keys(files).filter(f => f.startsWith(path)); },
		async read(path: string): Promise<string> {
			const content = files[path];
			if (content === undefined) throw new Error(`File not found: ${path}`);
			return content;
		},
	};
}

describe('WorldLoader', () => {
	it('loads all resource types including MDSL behavior trees', async () => {
		const vault = createMockVault({
			'03 - Resources/Traits/hardy.json': JSON.stringify(validTrait),
			'03 - Resources/Agents/elena.json': JSON.stringify(validAgent),
			'03 - Resources/Locations/tavern.json': JSON.stringify(validLocation),
			'03 - Resources/BehaviorTrees/base.mdsl': baseMdsl,
			'03 - Resources/BehaviorTrees/branch-guard.mdsl': branchMdsl,
			'03 - Resources/BehaviorTrees/branch-merchant.mdsl': branchMdsl,
			'03 - Resources/BehaviorTrees/branch-artisan.mdsl': branchMdsl,
			'03 - Resources/BehaviorTrees/branch-scholar.mdsl': branchMdsl,
		});

		const loader = createWorldLoader(logger, loaderConfig);
		const result = await loader.load(vault);

		expect(result.errors).toHaveLength(0);
		expect(result.traitDefs['hardy']).toBeDefined();
		expect(result.agents).toHaveLength(1);
		expect(result.agents[0]?.agentId).toBe('agent-elena');
		expect(result.locations).toHaveLength(1);
		expect(result.locations[0]?.id).toBe('loc-tavern');
		expect(result.btMdslDefinitions['merchant']).toBeDefined();
		expect(result.btMdslDefinitions['guard']).toBeDefined();
	});

	it('calls progress callback 5 times with correct step/total/label', async () => {
		const vault = createMockVault({});
		const loader = createWorldLoader(logger, loaderConfig);
		const calls: [number, number, string][] = [];

		await loader.load(vault, (step, total, label) => {
			calls.push([step, total, label]);
		});

		expect(calls).toHaveLength(5);
		expect(calls[0]).toEqual([1, 5, 'Loading traits...']);
		expect(calls[1]).toEqual([2, 5, 'Loading agents...']);
		expect(calls[2]).toEqual([3, 5, 'Loading locations...']);
		expect(calls[3]).toEqual([4, 5, 'Loading regions...']);
		expect(calls[4]).toEqual([5, 5, 'Loading behavior trees...']);
	});

	it('aggregates errors from multiple loaders with step prefix', async () => {
		const vault = createMockVault({
			'03 - Resources/Traits/bad-trait.json': '{"invalid": true}',
			'03 - Resources/Agents/bad-agent.json': '{"invalid": true}',
			'03 - Resources/Locations/bad-location.json': '{"invalid": true}',
		});

		const loader = createWorldLoader(logger, loaderConfig);
		const result = await loader.load(vault);

		expect(result.errors.length).toBeGreaterThanOrEqual(3);
		const steps = result.errors.map(e => e.step);
		expect(steps).toContain('traits');
		expect(steps).toContain('agents');
		expect(steps).toContain('locations');
	});

	it('returns empty data with errors for missing MDSL files', async () => {
		const vault = createMockVault({});
		const loader = createWorldLoader(logger, loaderConfig);
		const result = await loader.load(vault);

		// MDSL files missing = errors for each of the 4 kinds (base + branch for each)
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.agents).toHaveLength(0);
		expect(result.traitDefs).toEqual({});
		expect(result.locations).toHaveLength(0);
		expect(result.btMdslDefinitions).toEqual({});
	});

	it('loads MDSL definitions keyed by kind', async () => {
		const vault = createMockVault({
			'03 - Resources/BehaviorTrees/base.mdsl': baseMdsl,
			'03 - Resources/BehaviorTrees/branch-merchant.mdsl': branchMdsl,
			'03 - Resources/BehaviorTrees/branch-guard.mdsl': branchMdsl,
			'03 - Resources/BehaviorTrees/branch-artisan.mdsl': branchMdsl,
			'03 - Resources/BehaviorTrees/branch-scholar.mdsl': branchMdsl,
		});

		const loader = createWorldLoader(logger, loaderConfig);
		const result = await loader.load(vault);

		expect(result.btMdslDefinitions['merchant']).toBeDefined();
		expect(result.btMdslDefinitions['guard']).toBeDefined();
		expect(result.btMdslDefinitions['artisan']).toBeDefined();
		expect(result.btMdslDefinitions['scholar']).toBeDefined();
		// Each definition should be the composed base + branch
		expect(result.btMdslDefinitions['merchant']).toContain('Idle');
		expect(result.btMdslDefinitions['merchant']).toContain('Wander');
	});
});
