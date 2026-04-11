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
	dataRoot: '01 - Projects/Project Meridian',
	jobDefinitions: {
		settler: { primary_attribute: 'HT' },
		guard: { primary_attribute: 'ST' },
		craftsman: { primary_attribute: 'DX' },
	},
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
	facility_type: 'tavern',
	position: { x: 300, y: 200 },
	capacity: 5,
};

// Minimal valid MDSL for testing — base has branch [Job] that gets composed
const baseMdsl = 'root {\n    branch [Job]\n}\n';
const jobMdsl = 'root [Job] {\n    action [Wander]\n}\n';

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
	it('loads all resource types including job MDSL trees', async () => {
		const vault = createMockVault({
			'01 - Projects/Project Meridian/traits/hardy.json': JSON.stringify(validTrait),
			'01 - Projects/Project Meridian/agents/elena.json': JSON.stringify(validAgent),
			'01 - Projects/Project Meridian/locations/tavern.json': JSON.stringify(validLocation),
			'01 - Projects/Project Meridian/behavior-trees/base.mdsl': baseMdsl,
			'01 - Projects/Project Meridian/jobs/settler.mdsl': jobMdsl,
			'01 - Projects/Project Meridian/jobs/guard.mdsl': jobMdsl,
			'01 - Projects/Project Meridian/jobs/craftsman.mdsl': jobMdsl,
		});

		const loader = createWorldLoader(logger, loaderConfig);
		const result = await loader.load(vault);

		expect(result.errors).toHaveLength(0);
		expect(result.traitDefs['hardy']).toBeDefined();
		expect(result.agents).toHaveLength(1);
		expect(result.agents[0]?.agentId).toBe('agent-elena');
		expect(result.locations).toHaveLength(1);
		expect(result.locations[0]?.id).toBe('loc-tavern');
		expect(result.jobTrees['settler']).toBeDefined();
		expect(result.jobTrees['guard']).toBeDefined();
		expect(result.joblessMdsl).toBeDefined();
		expect(result.joblessMdsl).toContain('action [Wander]');
	});

	it('calls progress callback 6 times with correct step/total/label', async () => {
		const vault = createMockVault({});
		const loader = createWorldLoader(logger, loaderConfig);
		const calls: [number, number, string][] = [];

		await loader.load(vault, (step, total, label) => {
			calls.push([step, total, label]);
		});

		expect(calls).toHaveLength(6);
		expect(calls[0]).toEqual([1, 6, 'Loading traits...']);
		expect(calls[1]).toEqual([2, 6, 'Loading agents...']);
		expect(calls[2]).toEqual([3, 6, 'Loading locations...']);
		expect(calls[3]).toEqual([4, 6, 'Loading regions...']);
		expect(calls[4]).toEqual([5, 6, 'Loading behavior trees...']);
		expect(calls[5]).toEqual([6, 6, 'Loading items...']);
	});

	it('aggregates errors from multiple loaders with step prefix', async () => {
		const vault = createMockVault({
			'01 - Projects/Project Meridian/traits/bad-trait.json': '{"invalid": true}',
			'01 - Projects/Project Meridian/agents/bad-agent.json': '{"invalid": true}',
			'01 - Projects/Project Meridian/locations/bad-location.json': '{"invalid": true}',
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

		// MDSL base missing = error, no job trees composed
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.agents).toHaveLength(0);
		expect(result.traitDefs).toEqual({});
		expect(result.locations).toHaveLength(0);
		expect(result.jobTrees).toEqual({});
	});

	it('loads job trees keyed by job name', async () => {
		const vault = createMockVault({
			'01 - Projects/Project Meridian/behavior-trees/base.mdsl': baseMdsl,
			'01 - Projects/Project Meridian/jobs/settler.mdsl': jobMdsl,
			'01 - Projects/Project Meridian/jobs/guard.mdsl': jobMdsl,
		});

		const loader = createWorldLoader(logger, loaderConfig);
		const result = await loader.load(vault);

		expect(result.jobTrees['settler']).toBeDefined();
		expect(result.jobTrees['guard']).toBeDefined();
		// Each definition should be the composed base + job module
		expect(result.jobTrees['settler']).toContain('Wander');
		expect(result.joblessMdsl).toContain('action [Wander]');
	});
});
