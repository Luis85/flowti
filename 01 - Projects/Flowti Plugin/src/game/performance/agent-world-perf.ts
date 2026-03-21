/**
 * Agent world (Excalibur preframe simulation) performance sampling.
 *
 * Emits `perf.agentWorld.sample` on a time/frame window for dashboards and
 * `perf.agentWorld.slowFrame` when simulation exceeds a threshold (throttled).
 *
 * Wired from {@link createAgentWorld} when `eventBus` is passed in deps.
 */

import type { IEventBus } from "../../infrastructure/events/types.js";

/** Phase names match {@link tickSimulation} order in engine-simulation.ts */
export const AGENT_WORLD_PERF_PHASES = [
	"clock",
	"sensor",
	"needs",
	"reactiveTriggers",
	"behaviorThresholds",
	"pets",
	"roomTransit",
	"behaviorTree",
	"brain",
	"social",
	"director",
	"visuals",
] as const;

export type AgentWorldPerfPhase = (typeof AGENT_WORLD_PERF_PHASES)[number];

export interface AgentWorldPerfSink {
	onPhase(phase: string, durationMs: number): void;
	onSimulationEnd(durationMs: number): void;
	onFrameMeta(meta: { deltaMs: number; agentCount: number; sceneName: string }): void;
	onPostframe(durationMs: number): void;
	/** Per-agent canvas slices (needs, brain, talk, …) summed over the current sample window. */
	onAgentSlice(agentName: string, slice: string, durationMs: number): void;
	afterFullFrame(): void;
	dispose(): void;
}

export interface AgentWorldPerfCollectorOptions {
	/** Flush sample after this wall-clock span (default 2000). */
	sampleIntervalMs?: number;
	/** Or after this many frames, whichever comes first (default 120). */
	maxFramesPerSample?: number;
	/** Emit slowFrame when simulation exceeds this ms (default 24). */
	slowSimulationThresholdMs?: number;
	/** Minimum gap between slowFrame emissions (default 4000). */
	slowFrameThrottleMs?: number;
}

interface PhaseAgg {
	sumMs: number;
	maxMs: number;
}

function mergePhase(target: Map<string, PhaseAgg>, name: string, ms: number): void {
	const prev = target.get(name) ?? { sumMs: 0, maxMs: 0 };
	prev.sumMs += ms;
	prev.maxMs = Math.max(prev.maxMs, ms);
	target.set(name, prev);
}

/**
 * Creates a performance sink that aggregates frames and emits `perf.agentWorld.sample`.
 */
export function createAgentWorldPerfCollector(
	eventBus: IEventBus,
	options?: AgentWorldPerfCollectorOptions,
): AgentWorldPerfSink {
	const sampleIntervalMs = options?.sampleIntervalMs ?? 2000;
	const maxFramesPerSample = options?.maxFramesPerSample ?? 120;
	const slowSimulationThresholdMs = options?.slowSimulationThresholdMs ?? 24;
	const slowFrameThrottleMs = options?.slowFrameThrottleMs ?? 4000;

	let disposed = false;
	let currentPhases = new Map<string, number>();
	let lastSimMs = 0;
	let lastPostMs = 0;
	let lastMeta = { deltaMs: 0, agentCount: 0, sceneName: "unknown" };

	let winFrames = 0;
	let winStart = performance.now();
	let winSim = { sumMs: 0, maxMs: 0 };
	let winPost = { sumMs: 0, maxMs: 0 };
	let winDelta = { sumMs: 0, maxMs: 0 };
	const winPhases = new Map<string, PhaseAgg>();
	/** Per agent → slice → aggregate over the current window (same semantics as winPhases). */
	const winPerAgent = new Map<string, Map<string, PhaseAgg>>();

	let lastSlowEmit = 0;

	// ── EventBus window (same wall window as frame batch) via perf.event.dispatched ──
	let winBusTypedCount = 0;
	let winBusHandlerSum = 0;
	let winBusDurSum = 0;
	let winBusDurMax = 0;
	const winBusPerType = new Map<string, { count: number; maxMs: number }>();

	const unsubBus = eventBus.on("perf.event.dispatched", (ev) => {
		if (disposed) return;
		const { eventType, handlerCount, durationMs } = ev.payload;
		winBusTypedCount++;
		winBusHandlerSum += handlerCount;
		winBusDurSum += durationMs;
		winBusDurMax = Math.max(winBusDurMax, durationMs);
		const row = winBusPerType.get(eventType) ?? { count: 0, maxMs: 0 };
		row.count++;
		row.maxMs = Math.max(row.maxMs, durationMs);
		winBusPerType.set(eventType, row);
	});

	const buildEventBusSnapshot = (windowDurationMs: number) => {
		const sec = windowDurationMs > 0 ? windowDurationMs / 1000 : 0.001;
		const topEventTypes = [...winBusPerType.entries()]
			.map(([eventType, v]) => ({ eventType, count: v.count, maxMs: v.maxMs }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 6);
		return {
			typedDispatchCount: winBusTypedCount,
			handlerInvocationCount: winBusHandlerSum,
			avgDispatchWallMs: winBusTypedCount > 0 ? winBusDurSum / winBusTypedCount : 0,
			maxDispatchWallMs: winBusDurMax,
			dispatchesPerSec: winBusTypedCount / sec,
			topEventTypes,
		};
	};

	const resetBusWindow = (): void => {
		winBusTypedCount = 0;
		winBusHandlerSum = 0;
		winBusDurSum = 0;
		winBusDurMax = 0;
		winBusPerType.clear();
	};

	const mergeAgentSlice = (agentName: string, slice: string, ms: number): void => {
		let slices = winPerAgent.get(agentName);
		if (!slices) {
			slices = new Map();
			winPerAgent.set(agentName, slices);
		}
		mergePhase(slices, slice, ms);
	};

	const buildPerAgentSnapshot = () => {
		const agents: { agentName: string; slices: Record<string, { avgMs: number; maxMs: number }> }[] = [];
		for (const [agentName, slices] of winPerAgent) {
			const rec: Record<string, { avgMs: number; maxMs: number }> = {};
			let total = 0;
			for (const [slice, agg] of slices) {
				const avgMs = winFrames > 0 ? agg.sumMs / winFrames : 0;
				rec[slice] = { avgMs, maxMs: agg.maxMs };
				total += avgMs;
			}
			if (total > 1e-9) {
				agents.push({ agentName, slices: rec });
			}
		}
		agents.sort((a, b) => {
			const sa = Object.values(a.slices).reduce((s, v) => s + v.avgMs, 0);
			const sb = Object.values(b.slices).reduce((s, v) => s + v.avgMs, 0);
			return sb - sa;
		});
		return { agents };
	};

	const flushWindow = (): void => {
		if (winFrames === 0) return;

		const phases: Record<string, { avgMs: number; maxMs: number }> = {};
		for (const [name, agg] of winPhases) {
			phases[name] = {
				avgMs: agg.sumMs / winFrames,
				maxMs: agg.maxMs,
			};
		}

		const windowDurationMs = performance.now() - winStart;
		const eventBusSnapshot = buildEventBusSnapshot(windowDurationMs);
		const perAgentCanvas = buildPerAgentSnapshot();

		void eventBus.emit("perf.agentWorld.sample", {
			windowFrames: winFrames,
			windowDurationMs,
			simulation: {
				avgMs: winSim.sumMs / winFrames,
				maxMs: winSim.maxMs,
			},
			postframe: {
				avgMs: winPost.sumMs / winFrames,
				maxMs: winPost.maxMs,
			},
			delta: {
				avgMs: winDelta.sumMs / winFrames,
				maxMs: winDelta.maxMs,
			},
			phases,
			agentCount: lastMeta.agentCount,
			sceneName: lastMeta.sceneName,
			eventBus: eventBusSnapshot,
			perAgentCanvas,
		});

		resetBusWindow();
		winPerAgent.clear();

		winFrames = 0;
		winStart = performance.now();
		winSim = { sumMs: 0, maxMs: 0 };
		winPost = { sumMs: 0, maxMs: 0 };
		winDelta = { sumMs: 0, maxMs: 0 };
		winPhases.clear();
	};

	return {
		onPhase(phase: string, durationMs: number): void {
			if (disposed) return;
			currentPhases.set(phase, (currentPhases.get(phase) ?? 0) + durationMs);
		},

		onSimulationEnd(durationMs: number): void {
			if (disposed) return;
			lastSimMs = durationMs;
			const now = performance.now();
			if (durationMs >= slowSimulationThresholdMs && now - lastSlowEmit >= slowFrameThrottleMs) {
				lastSlowEmit = now;
				void eventBus.emit("perf.agentWorld.slowFrame", {
					simulationMs: durationMs,
					sceneName: lastMeta.sceneName,
					agentCount: lastMeta.agentCount,
					deltaMs: lastMeta.deltaMs,
				});
			}
		},

		onFrameMeta(meta: { deltaMs: number; agentCount: number; sceneName: string }): void {
			if (disposed) return;
			lastMeta = meta;
		},

		onPostframe(durationMs: number): void {
			if (disposed) return;
			lastPostMs = durationMs;
		},

		onAgentSlice(agentName: string, slice: string, durationMs: number): void {
			if (disposed) return;
			mergeAgentSlice(agentName, slice, durationMs);
		},

		afterFullFrame(): void {
			if (disposed) return;

			for (const [name, ms] of currentPhases) {
				mergePhase(winPhases, name, ms);
			}
			currentPhases = new Map();

			winFrames++;
			winSim.sumMs += lastSimMs;
			winSim.maxMs = Math.max(winSim.maxMs, lastSimMs);
			winPost.sumMs += lastPostMs;
			winPost.maxMs = Math.max(winPost.maxMs, lastPostMs);
			winDelta.sumMs += lastMeta.deltaMs;
			winDelta.maxMs = Math.max(winDelta.maxMs, lastMeta.deltaMs);

			const elapsed = performance.now() - winStart;
			if (elapsed >= sampleIntervalMs || winFrames >= maxFramesPerSample) {
				flushWindow();
			}
		},

		dispose(): void {
			disposed = true;
			try {
				unsubBus();
			} catch {
				/* ignore */
			}
			flushWindow();
			resetBusWindow();
			winPerAgent.clear();
		},
	};
}
