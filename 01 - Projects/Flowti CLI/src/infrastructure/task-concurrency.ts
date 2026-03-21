/**
 * task-concurrency.ts — Process pool for bounded task concurrency.
 *
 * Limits how many agents can execute tasks simultaneously. Agents that exceed
 * the concurrency cap are queued in FIFO order and dequeued when a slot opens.
 */

export interface TaskPoolConfig {
	readonly maxConcurrent: number; // default 2
}

export interface ITaskPool {
	acquire(agentName: string): boolean;
	release(agentName: string): void;
	enqueue(agentName: string): void;
	dequeueNext(): string | null;
	getQueuedAgents(): readonly string[];
	getActiveCount(): number;
}

const DEFAULT_CONFIG: TaskPoolConfig = {
	maxConcurrent: 2,
};

export function createTaskPool(config?: Partial<TaskPoolConfig>): ITaskPool {
	const resolved: TaskPoolConfig = { ...DEFAULT_CONFIG, ...config };
	const active = new Set<string>();
	const queue: string[] = [];

	return {
		acquire(agentName: string): boolean {
			if (active.size >= resolved.maxConcurrent) return false;
			active.add(agentName);
			return true;
		},

		release(agentName: string): void {
			active.delete(agentName);
		},

		enqueue(agentName: string): void {
			if (!queue.includes(agentName)) {
				queue.push(agentName);
			}
		},

		dequeueNext(): string | null {
			if (queue.length === 0) return null;
			if (active.size >= resolved.maxConcurrent) return null;
			return queue.shift() ?? null;
		},

		getQueuedAgents(): readonly string[] {
			return [...queue];
		},

		getActiveCount(): number {
			return active.size;
		},
	};
}
