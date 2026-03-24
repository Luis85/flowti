import type { DispatcherMetrics, TaskEntry } from "../../domain/tasks/task-dispatcher-types.js";

type LogFn = (msg?: string) => void;
type DataModel = Record<string, unknown>;

export function renderDispatchStatus(data: DataModel, log: LogFn): void {
	if (data.error) { log(data.error as string); return; }
	const m = data as unknown as DispatcherMetrics;
	log("Dispatch Status");
	log(`  Queue: urgent=${m.queueDepth.urgent} high=${m.queueDepth.high} normal=${m.queueDepth.normal}`);
	log(`  Active: ${m.activeAssignments}  Cooldown: ${m.agentsOnCooldown}  Idle: ${m.agentsIdle}`);
}

export function renderDispatchMetrics(data: DataModel, log: LogFn): void {
	if (data.error) { log(data.error as string); return; }
	const m = data as unknown as DispatcherMetrics;
	log("Dispatch Metrics");
	log(`  Completed: ${m.tasksCompleted}  Failed: ${m.tasksFailed}`);
	log(`  Avg wait: ${Math.round(m.avgWaitTimeMs)}ms  Avg exec: ${Math.round(m.avgExecutionTimeMs)}ms`);
	if (Object.keys(m.agentStats).length > 0) {
		log("  Per-agent:");
		for (const [name, s] of Object.entries(m.agentStats)) {
			log(`    ${name}: ${s.completed} done, ${s.failed} failed, avg ${Math.round(s.avgExecutionTimeMs)}ms`);
		}
	}
}

export function renderDispatchQueue(data: DataModel, log: LogFn): void {
	if (data.error) { log(data.error as string); return; }
	const lanes = data.lanes as { lane: string; tasks: TaskEntry[] }[];
	log("Dispatch Queue");
	for (const { lane, tasks } of lanes) {
		if (tasks.length === 0) continue;
		log(`  [${lane}] (${tasks.length})`);
		for (const t of tasks) {
			log(`    ${t.taskId}: ${t.title} (${t.source})`);
		}
	}
	const total = lanes.reduce((sum, l) => sum + l.tasks.length, 0);
	if (total === 0) log("  (empty)");
}

export function renderDispatchHistory(data: DataModel, log: LogFn): void {
	if (data.error) { log(data.error as string); return; }
	const entries = data.entries as { agentName: string; taskId: string; completedAt: number }[];
	log("Recent Completions");
	if (entries.length === 0) { log("  (none)"); return; }
	for (const h of entries) {
		log(`  ${h.agentName}: ${h.taskId} at ${new Date(h.completedAt).toISOString()}`);
	}
}
