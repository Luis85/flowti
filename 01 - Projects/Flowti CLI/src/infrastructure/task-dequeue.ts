/**
 * task-dequeue.ts — Auto-dequeue pipeline with cooldown and failure circuit breaker.
 *
 * Tracks per-agent dequeue readiness based on a configurable cooldown window.
 * After a configurable number of consecutive failures the agent is blocked until
 * manually reset. Uses timestamp-based checking — no setTimeout involved.
 */

export interface DequeueConfig {
	readonly cooldownMs: number;          // default 10000
	readonly maxConsecutiveFailures: number; // default 3
}

export interface IDequeuePipeline {
	onTaskCompleted(agentName: string, taskId: string): void;
	recordFailure(agentName: string): void;
	isBlocked(agentName: string): boolean;
	getPendingDequeue(agentName: string): string | null;
	reset(agentName: string): void;
}

interface AgentDequeueState {
	/** Epoch ms at which the agent becomes eligible for the next dequeue.
	 *  null means onTaskCompleted has never been called for this agent. */
	readyAt: number | null;
	/** Number of consecutive failures since last successful completion. */
	consecutiveFailures: number;
	/** True when consecutiveFailures reached maxConsecutiveFailures. */
	blocked: boolean;
	/** The agent name stored for getPendingDequeue return value. */
	agentName: string;
}

const DEFAULT_CONFIG: DequeueConfig = {
	cooldownMs: 10000,
	maxConsecutiveFailures: 3,
};

export function createDequeuePipeline(config?: Partial<DequeueConfig>): IDequeuePipeline {
	const resolved: DequeueConfig = { ...DEFAULT_CONFIG, ...config };
	const agents = new Map<string, AgentDequeueState>();

	function getOrCreate(agentName: string): AgentDequeueState {
		let state = agents.get(agentName);
		if (!state) {
			state = { readyAt: null, consecutiveFailures: 0, blocked: false, agentName };
			agents.set(agentName, state);
		}
		return state;
	}

	return {
		onTaskCompleted(agentName: string, _taskId: string): void {
			const state = getOrCreate(agentName);
			state.consecutiveFailures = 0;
			state.blocked = false;
			state.readyAt = Date.now() + resolved.cooldownMs;
		},

		recordFailure(agentName: string): void {
			const state = getOrCreate(agentName);
			state.consecutiveFailures += 1;
			if (state.consecutiveFailures >= resolved.maxConsecutiveFailures) {
				state.blocked = true;
			}
		},

		isBlocked(agentName: string): boolean {
			return agents.get(agentName)?.blocked ?? false;
		},

		getPendingDequeue(agentName: string): string | null {
			const state = agents.get(agentName);
			if (!state) return null;
			if (state.blocked) return null;
			if (state.readyAt === null) return null;
			if (Date.now() < state.readyAt) return null;
			return agentName;
		},

		reset(agentName: string): void {
			const state = agents.get(agentName);
			if (!state) return;
			state.blocked = false;
			state.consecutiveFailures = 0;
			state.readyAt = 0;
		},
	};
}
