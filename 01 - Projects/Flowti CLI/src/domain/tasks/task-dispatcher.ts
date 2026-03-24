import { scoreAgents, type AgentInfo } from "./task-scorer.js";
import type { TaskEntry, TaskHistoryEntry, DispatcherMetrics, TaskPriorityLane } from "./task-dispatcher-types.js";
import type { AgentTrustProfile } from "../trust/trust-types.js";
import type { WorkerState } from "../agents/worker-types.js";

export interface DispatcherDeps {
	readonly clock: { ms(): number; iso(): string; safeIso(): string };
	readonly loadTrustProfile: (agentName: string) => AgentTrustProfile | null;
	readonly getAgentCapabilities: (agentName: string) => readonly string[];
	readonly getTaskHistory: (agentName: string) => readonly TaskHistoryEntry[];
	readonly getWorkerState: (agentName: string) => WorkerState;
	readonly updateTaskStatus: (taskId: string, status: string) => void;
	readonly awardReward: (agentName: string, reward: { readonly xp: number; readonly coin: number }) => void;
	readonly emit: (event: string, data: unknown) => void;
	readonly writeAgentEvent: (agentName: string, type: string, text: string) => void;
	readonly sendToWorker: (agentName: string, message: string, opts?: { readonly task?: string }) => void;
	readonly cooldownMs: number;
	readonly maxRetries: number;
}

export interface TaskDispatcher {
	submit(task: TaskEntry): void;
	drain(): void;
	complete(agentName: string, taskId: string, result: string): void;
	fail(agentName: string, taskId: string, error: string): void;
	metrics(): DispatcherMetrics;
	listQueue(): { readonly lane: string; readonly tasks: readonly TaskEntry[] }[];
	listHistory(agentName?: string): readonly { readonly agentName: string; readonly taskId: string; readonly completedAt: number }[];
}

export function createDispatcher(deps: DispatcherDeps, agentNames: readonly string[]): TaskDispatcher {
	const queues: Record<TaskPriorityLane, TaskEntry[]> = { urgent: [], high: [], normal: [] };
	const cooldowns = new Map<string, number>();
	const assignments = new Map<string, TaskEntry>();
	const completionTimes: number[] = [];
	const waitTimes: number[] = [];
	let tasksCompleted = 0;
	let tasksFailed = 0;
	const agentStats: Record<string, { completed: number; failed: number; totalExecMs: number; lastTaskAt: number }> = {};
	const recentHistory: Array<{ agentName: string; taskId: string; completedAt: number }> = [];

	function isOnCooldown(name: string): boolean {
		const expires = cooldowns.get(name);
		if (expires === undefined) return false;
		if (deps.clock.ms() >= expires) {
			cooldowns.delete(name);
			return false;
		}
		return true;
	}

	function buildAgentInfos(): AgentInfo[] {
		return agentNames.map((name) => {
			const profile = deps.loadTrustProfile(name);
			return {
				name,
				capabilities: [...deps.getAgentCapabilities(name)],
				trustTier: profile?.tier ?? "supervised",
				workerState: deps.getWorkerState(name),
				onCooldown: isOnCooldown(name),
				history: deps.getTaskHistory(name),
			};
		});
	}

	function assign(agentName: string, task: TaskEntry): void {
		assignments.set(agentName, task);
		deps.updateTaskStatus(task.taskId, "assigned");
		deps.emit("task:assigned", { agent: agentName, task });
		deps.writeAgentEvent(agentName, "task-started", task.title);
		deps.sendToWorker(agentName, task.title, { task: task.title });
	}

	function startCooldown(agentName: string): void {
		cooldowns.set(agentName, deps.clock.ms() + deps.cooldownMs);
		setTimeout(() => {
			cooldowns.delete(agentName);
			deps.emit("agent:available", { agent: agentName });
			drain();
		}, deps.cooldownMs);
	}

	function drain(): void {
		const lanes: TaskPriorityLane[] = ["urgent", "high", "normal"];
		for (const lane of lanes) {
			while (queues[lane].length > 0) {
				const task = queues[lane][0];
				const agents = buildAgentInfos();
				const winner = task.targetAgent
					? agents.find((a) => a.name === task.targetAgent && a.workerState === "idle" && !a.onCooldown) ?? null
					: scoreAgents(agents, task);

				if (!winner) break;
				queues[lane].shift();
				assign(winner.name, task);
			}
		}
	}

	function submit(task: TaskEntry): void {
		if (task.taskTrustTier === "manual" && task.source !== "director") {
			throw new Error("Manual tasks require Director source");
		}

		if (task.targetAgent) {
			const agents = buildAgentInfos();
			const target = agents.find((a) => a.name === task.targetAgent);
			if (target && target.workerState === "idle" && !target.onCooldown) {
				assign(target.name, task);
				return;
			}
		}

		queues[task.priority].push(task);
		drain();
	}

	function complete(agentName: string, taskId: string, result: string): void {
		const task = assignments.get(agentName);
		assignments.delete(agentName);

		if (task) {
			const execMs = deps.clock.ms() - task.submittedAt;
			waitTimes.push(execMs);
			completionTimes.push(execMs);

			if (task.taskTrustTier === "auto") {
				deps.updateTaskStatus(taskId, "completed");
				deps.awardReward(agentName, task.reward);
			} else {
				deps.updateTaskStatus(taskId, "review");
			}

			tasksCompleted++;
			if (!agentStats[agentName]) {
				agentStats[agentName] = { completed: 0, failed: 0, totalExecMs: 0, lastTaskAt: 0 };
			}
			agentStats[agentName].completed++;
			agentStats[agentName].totalExecMs += execMs;
			agentStats[agentName].lastTaskAt = deps.clock.ms();

			recentHistory.push({ agentName, taskId, completedAt: deps.clock.ms() });
			if (recentHistory.length > 100) recentHistory.shift();
		}

		deps.emit("task:completed", { agent: agentName, taskId, result });
		deps.writeAgentEvent(agentName, "done", "");
		startCooldown(agentName);
	}

	function fail(agentName: string, taskId: string, error: string): void {
		const task = assignments.get(agentName);
		assignments.delete(agentName);

		deps.updateTaskStatus(taskId, "failed");

		if (task && task.retryCount < deps.maxRetries) {
			submit({ ...task, retryCount: task.retryCount + 1 });
		} else {
			deps.emit("task:failed", { agent: agentName, taskId, error });
			deps.writeAgentEvent(agentName, "error", error);
			tasksFailed++;
			if (!agentStats[agentName]) {
				agentStats[agentName] = { completed: 0, failed: 0, totalExecMs: 0, lastTaskAt: 0 };
			}
			agentStats[agentName].failed++;
		}

		startCooldown(agentName);
	}

	function metrics(): DispatcherMetrics {
		const idleCount = agentNames.filter((n) =>
			deps.getWorkerState(n) === "idle" && !isOnCooldown(n) && !assignments.has(n),
		).length;

		const avgWait = waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0;
		const avgExec = completionTimes.length > 0 ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length : 0;

		const statsOut: DispatcherMetrics["agentStats"] = {};
		for (const [name, s] of Object.entries(agentStats)) {
			statsOut[name] = {
				completed: s.completed,
				failed: s.failed,
				avgExecutionTimeMs: s.completed > 0 ? s.totalExecMs / s.completed : 0,
				lastTaskAt: s.lastTaskAt,
			};
		}

		return {
			queueDepth: {
				urgent: queues.urgent.length,
				high: queues.high.length,
				normal: queues.normal.length,
			},
			activeAssignments: assignments.size,
			agentsOnCooldown: cooldowns.size,
			agentsIdle: idleCount,
			tasksCompleted,
			tasksFailed,
			avgWaitTimeMs: avgWait,
			avgExecutionTimeMs: avgExec,
			agentStats: statsOut,
		};
	}

	function listQueue() {
		return (["urgent", "high", "normal"] as const).map((lane) => ({
			lane,
			tasks: [...queues[lane]],
		}));
	}

	function listHistory(agentName?: string) {
		if (agentName) return recentHistory.filter((h) => h.agentName === agentName);
		return [...recentHistory];
	}

	return { submit, drain, complete, fail, metrics, listQueue, listHistory };
}
