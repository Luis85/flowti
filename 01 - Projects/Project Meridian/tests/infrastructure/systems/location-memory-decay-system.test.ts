import { describe, it, expect, vi } from 'vitest';
import { createLocationMemoryDecaySystem } from '../../../src/infrastructure/systems/location-memory-decay-system.js';
import { createEventBus } from '../../../src/infrastructure/event-bus.js';
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';
import type { GameCoreDeps } from '../../../src/domain/core/game-deps.js';
import type { AgentActor } from '../../../src/infrastructure/entity/agent-actor.js';
import type { LocationMemoryEntry } from '../../../src/infrastructure/entity/bt-working-memory.js';

function createDeps(tickCount = 1000): GameCoreDeps {
	return {
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		eventBus: createEventBus(),
		config: GameConfigSchema.parse({}),
		performanceTracker: createPerformanceTracker(),
		tickCount,
		writeFile: null,
		dataRoot: 'test-data',
		getRecipeRegistry: () => new Map(),
		getFacilityTypeRegistry: () => new Map(),
	};
}

function makeEntry(overrides: Partial<LocationMemoryEntry> = {}): LocationMemoryEntry {
	return {
		locationId: 'loc-test',
		facilityType: 'rest_inn',
		position: { x: 100, y: 200 },
		significance: 50,
		originalSignificance: 50,
		source: 'visited',
		reliability: 1.0,
		discoveredTick: 0,
		lastRefreshedTick: 0,
		...overrides,
	};
}

function createMockAgent(locationMemories: LocationMemoryEntry[] = []): AgentActor {
	return {
		agentId: 'agent-test',
		behaviorAgent: { locationMemories },
	} as unknown as AgentActor;
}

describe('LocationMemoryDecaySystem', () => {
	it('decays location memories past min_lifespan', () => {
		const entry = makeEntry({ lastRefreshedTick: 0 });
		const agent = createMockAgent([entry]);
		const system = createLocationMemoryDecaySystem(() => [agent]);
		const deps = createDeps(961); // past visited min_lifespan of 960

		system.execute(deps);

		expect(agent.behaviorAgent.locationMemories[0]!.significance).toBeLessThan(50);
	});

	it('prunes entries below threshold', () => {
		const entry = makeEntry({ significance: 5.01, lastRefreshedTick: 0 });
		const agent = createMockAgent([entry]);
		const system = createLocationMemoryDecaySystem(() => [agent]);
		const deps = createDeps(961);

		system.execute(deps);

		expect(agent.behaviorAgent.locationMemories).toHaveLength(0);
	});

	it('emits LocationMemoryDecayed event when entries change', () => {
		const entry = makeEntry({ lastRefreshedTick: 0 });
		const agent = createMockAgent([entry]);
		const system = createLocationMemoryDecaySystem(() => [agent]);
		const deps = createDeps(961);
		const emitSpy = vi.spyOn(deps.eventBus, 'emit');

		system.execute(deps);

		const events = emitSpy.mock.calls.filter(c => c[0].type === 'LocationMemoryDecayed');
		expect(events).toHaveLength(1);
	});

	it('does nothing when no entries need decay', () => {
		const entry = makeEntry({ lastRefreshedTick: 900 });
		const agent = createMockAgent([entry]);
		const system = createLocationMemoryDecaySystem(() => [agent]);
		const deps = createDeps(961); // 961 - 900 = 61, well within 960 min_lifespan
		const emitSpy = vi.spyOn(deps.eventBus, 'emit');

		system.execute(deps);

		expect(agent.behaviorAgent.locationMemories[0]!.significance).toBe(50);
		const events = emitSpy.mock.calls.filter(c => c[0].type === 'LocationMemoryDecayed');
		expect(events).toHaveLength(0);
	});
});
