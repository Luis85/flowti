/**
 * task-health.ts — Task health monitoring and stale detection.
 *
 * Tracks start/end times for in-progress tasks per agent. Surfaces tasks that
 * have exceeded a configurable stale threshold, and accumulates per-agent
 * failure counts for upstream circuit-breaker logic.
 */

export interface TaskHealthConfig {
	readonly staleThresholdMs: number;  // default 300000 (5 minutes)
	readonly processTimeoutMs: number;  // default 600000 (10 minutes)
}

export interface StaleTask {
	agentName: string;
	taskId: string;
	staleSinceMs: number;
}

export interface ITaskHealthMonitor {
	recordTaskStart(agentName: string, taskId: string): void;
	recordTaskEnd(agentName: string, taskId: string): void;
	recordFailure(agentName: string): void;
	resetFailures(agentName: string): void;
	checkStale(nowMs: number): StaleTask[];
	getFailureCount(agentName: string): number;
}

interface InProgressTask {
	startedAt: number;
}

const DEFAULT_CONFIG: TaskHealthConfig = {
	staleThresholdMs: 300_000,
	processTimeoutMs: 600_000,
};

export function createTaskHealthMonitor(config?: Partial<TaskHealthConfig>): ITaskHealthMonitor {
	const resolved: TaskHealthConfig = { ...DEFAULT_CONFIG, ...config };
	/** Map from "agentName:taskId" → InProgressTask */
	const inProgress = new Map<string, InProgressTask>();
	/** Failure counts per agent name */
	const failureCounts = new Map<string, number>();

	function key(agentName: string, taskId: string): string {
		return `${agentName}:${taskId}`;
	}

	return {
		recordTaskStart(agentName: string, taskId: string): void {
			inProgress.set(key(agentName, taskId), { startedAt: Date.now() });
		},

		recordTaskEnd(agentName: string, taskId: string): void {
			inProgress.delete(key(agentName, taskId));
		},

		recordFailure(agentName: string): void {
			failureCounts.set(agentName, (failureCounts.get(agentName) ?? 0) + 1);
		},

		resetFailures(agentName: string): void {
			failureCounts.delete(agentName);
		},

		checkStale(nowMs: number): StaleTask[] {
			const stale: StaleTask[] = [];
			for (const [k, task] of inProgress) {
				const elapsed = nowMs - task.startedAt;
				if (elapsed >= resolved.staleThresholdMs) {
					const colonIdx = k.indexOf(":");
					const agentName = k.slice(0, colonIdx);
					const taskId = k.slice(colonIdx + 1);
					stale.push({ agentName, taskId, staleSinceMs: elapsed - resolved.staleThresholdMs });
				}
			}
			return stale;
		},

		getFailureCount(agentName: string): number {
			return failureCounts.get(agentName) ?? 0;
		},
	};
}
