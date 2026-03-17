/**
 * process-pool.ts — Bounded process pool for LLM agent processes.
 *
 * Caps concurrent claude CLI processes. When full, queues requests and
 * returns deferred AgentProcess proxies that resolve when a slot opens.
 * Pure domain — no infrastructure imports; timer injected.
 *
 * Release contract: consumer-driven only. The caller must call release()
 * after processing the result. No auto-release on process completion.
 */

import type { AgentSummary } from "./agent-types.js";
import type { AgentProcess, IAgentProcessRunner } from "./worker-types.js";
import type { AgentStreamEvent } from "./agent-stream.js";

export interface PoolTimer {
	set(callback: () => void, ms: number): unknown;
	clear(handle: unknown): void;
}

export interface PoolConfig {
	readonly maxConcurrent: number;
	readonly processTimeoutMs: number;
}

export interface AcquireResult {
	readonly process: AgentProcess;
	readonly queued: boolean;
}

export interface IProcessPool {
	acquire(agent: AgentSummary, prompt: string, tools: readonly string[]): AcquireResult;
	release(agentName: string): void;
	cancel(agentName: string): void;
	killAll(): void;
	getQueueDepth(): number;
	getActiveCount(): number;
}

interface ActiveEntry {
	readonly name: string;
	readonly process: AgentProcess;
	readonly timeoutHandle: unknown;
}

interface QueueEntry {
	readonly agent: AgentSummary;
	readonly prompt: string;
	readonly tools: readonly string[];
	resolve: (process: AgentProcess) => void;
	reject: (error: Error) => void;
	readonly eventBuffer: Array<(event: AgentStreamEvent) => void>;
}

export function createProcessPool(runner: IAgentProcessRunner, timer: PoolTimer, config: PoolConfig): IProcessPool {
	const active = new Map<string, ActiveEntry>();
	const queue: QueueEntry[] = [];

	function spawnAndTrack(agent: AgentSummary, prompt: string, tools: readonly string[], eventBuffer?: Array<(event: AgentStreamEvent) => void>): AgentProcess {
		const proc = runner.spawn(agent, prompt, tools);

		// Forward buffered event listeners
		if (eventBuffer) {
			for (const cb of eventBuffer) proc.onEvent(cb);
		}

		const timeoutHandle = timer.set(() => {
			proc.kill();
			active.delete(agent.name);
			drainQueue();
		}, config.processTimeoutMs);

		active.set(agent.name, { name: agent.name, process: proc, timeoutHandle });
		return proc;
	}

	function drainQueue(): void {
		while (queue.length > 0 && active.size < config.maxConcurrent) {
			const entry = queue.shift()!;
			const proc = spawnAndTrack(entry.agent, entry.prompt, entry.tools, entry.eventBuffer);
			entry.resolve(proc);
		}
	}

	function release(agentName: string): void {
		const entry = active.get(agentName);
		if (!entry) return;
		timer.clear(entry.timeoutHandle);
		active.delete(agentName);
		drainQueue();
	}

	return {
		acquire(agent, prompt, tools): AcquireResult {
			if (active.size < config.maxConcurrent) {
				const proc = spawnAndTrack(agent, prompt, tools);
				return { process: proc, queued: false };
			}

			// Pool full — create deferred proxy
			const eventBuffer: Array<(event: AgentStreamEvent) => void> = [];
			let resolveReal: (process: AgentProcess) => void;
			let rejectReal: (error: Error) => void;

			const realPromise = new Promise<AgentProcess>((res, rej) => {
				resolveReal = res;
				rejectReal = rej;
			});

			const entry: QueueEntry = {
				agent, prompt, tools,
				resolve: resolveReal!,
				reject: rejectReal!,
				eventBuffer,
			};
			queue.push(entry);

			const proxy: AgentProcess = {
				onEvent(callback) {
					eventBuffer.push(callback);
					return () => {
						const idx = eventBuffer.indexOf(callback);
						if (idx >= 0) eventBuffer.splice(idx, 1);
					};
				},
				result: realPromise.then((real) => real.result),
				kill() {
					// If still queued, cancel
					const qIdx = queue.indexOf(entry);
					if (qIdx >= 0) {
						queue.splice(qIdx, 1);
						rejectReal(new Error("cancelled"));
						return;
					}
					// If active, delegate
					const activeEntry = active.get(agent.name);
					if (activeEntry) activeEntry.process.kill();
				},
			};

			return { process: proxy, queued: true };
		},

		release,

		cancel(agentName) {
			const qIdx = queue.findIndex((e) => e.agent.name === agentName);
			if (qIdx >= 0) {
				const entry = queue.splice(qIdx, 1)[0];
				entry.reject(new Error("cancelled"));
				return;
			}
			const entry = active.get(agentName);
			if (entry) {
				entry.process.kill();
				timer.clear(entry.timeoutHandle);
				active.delete(agentName);
				drainQueue();
			}
		},

		killAll() {
			for (const entry of active.values()) {
				entry.process.kill();
				timer.clear(entry.timeoutHandle);
			}
			active.clear();
			for (const entry of queue.splice(0)) {
				entry.reject(new Error("Pool shutdown"));
			}
		},

		getQueueDepth: () => queue.length,
		getActiveCount: () => active.size,
	};
}
