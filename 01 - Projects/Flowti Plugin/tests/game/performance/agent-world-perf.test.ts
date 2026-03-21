import { describe, expect, it, vi } from "vitest";
import { createAgentWorldPerfCollector } from "../../../src/game/performance/agent-world-perf.js";
import type { IEventBus } from "../../../src/infrastructure/events/types.js";

function createMockBus(): { bus: IEventBus; emitted: { type: string; payload: unknown }[] } {
	const emitted: { type: string; payload: unknown }[] = [];
	const bus: IEventBus = {
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		emitCustom: vi.fn(async () => { /* noop */ }),
		on: vi.fn(() => () => { /* noop */ }),
		onWildcard: vi.fn(() => () => { /* noop */ }),
		off: vi.fn(),
		offWildcard: vi.fn(),
	} as unknown as IEventBus;
	return { bus, emitted };
}

describe("createAgentWorldPerfCollector", () => {
	it("emits perf.agentWorld.sample after maxFramesPerSample frames", async () => {
		const { bus, emitted } = createMockBus();
		const c = createAgentWorldPerfCollector(bus, { maxFramesPerSample: 2, sampleIntervalMs: 60_000 });

		c.onPhase("brain", 1);
		c.onGameSystem("talk", 3);
		c.onAgentSlice("A", "brain", 0.5);
		c.onAgentSlice("A", "needs", 0.1);
		c.onFrameMeta({ deltaMs: 16, agentCount: 2, sceneName: "hub" });
		c.onSimulationEnd(5);
		c.onPostframe(0.5);
		c.afterFullFrame();

		c.onPhase("brain", 2);
		c.onGameSystem("talk", 5);
		c.onAgentSlice("A", "brain", 0.6);
		c.onFrameMeta({ deltaMs: 16, agentCount: 2, sceneName: "hub" });
		c.onSimulationEnd(6);
		c.onPostframe(0.4);
		c.afterFullFrame();

		// Sample emit is deferred off the frame path (idle / microtask).
		await Promise.resolve();
		expect(emitted.some((e) => e.type === "perf.agentWorld.sample")).toBe(true);
		const sample = emitted.find((e) => e.type === "perf.agentWorld.sample")?.payload as {
			windowFrames: number;
			simulation: { avgMs: number; maxMs: number };
			phases: Record<string, { avgMs: number; maxMs: number }>;
			gameSystems: Record<string, { avgMs: number; maxMs: number }>;
			eventBus: {
				typedDispatchCount: number;
				handlerInvocationCount: number;
				avgDispatchWallMs: number;
				maxDispatchWallMs: number;
				dispatchesPerSec: number;
				topEventTypes: { eventType: string; count: number; maxMs: number }[];
			};
			perAgentCanvas: {
				agents: { agentName: string; slices: Record<string, { avgMs: number; maxMs: number }> }[];
			};
		};
		expect(sample?.windowFrames).toBe(2);
		expect(sample?.simulation.avgMs).toBeCloseTo(5.5, 5);
		expect(sample?.simulation.maxMs).toBe(6);
		expect(sample?.phases.brain?.avgMs).toBeCloseTo(1.5, 5);
		expect(sample?.gameSystems.talk?.avgMs).toBeCloseTo(4, 5);
		expect(sample?.gameSystems.talk?.maxMs).toBe(5);
		expect(sample?.eventBus).toBeDefined();
		expect(sample?.eventBus.typedDispatchCount).toBe(0);
		expect(sample?.eventBus.topEventTypes).toEqual([]);

		expect(sample?.perAgentCanvas?.agents?.length).toBeGreaterThan(0);
		const rowA = sample?.perAgentCanvas.agents.find((a) => a.agentName === "A");
		expect(rowA?.slices.brain?.avgMs).toBeCloseTo(0.55, 5);
		expect(rowA?.slices.needs?.avgMs).toBeCloseTo(0.05, 5);

		c.dispose();
	});

	it("emits perf.agentWorld.slowFrame when simulation exceeds threshold", async () => {
		const { bus, emitted } = createMockBus();
		const c = createAgentWorldPerfCollector(bus, {
			maxFramesPerSample: 9999,
			sampleIntervalMs: 60_000,
			slowSimulationThresholdMs: 10,
			slowFrameThrottleMs: 0,
		});

		c.onFrameMeta({ deltaMs: 32, agentCount: 1, sceneName: "office" });
		c.onSimulationEnd(50);
		expect(emitted.some((e) => e.type === "perf.agentWorld.slowFrame")).toBe(true);

		c.dispose();
	});
});
