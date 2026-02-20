/**
 * Goal and execution task handlers.
 *
 * Extracted from SessionService (TD-101).
 */

import { generateUUID } from "../../../utils/helpers";
import type { ExecutionTask, SessionGoal } from "../types";
import { createGoal } from "../helpers";
import type { SessionHandlerContext } from "./types";

/** Allowed states for task operations. */
const TASK_ALLOWED_STATES: readonly string[] = ["prepared", "running", "paused"];

// ── Goal handlers ───────────────────────────────────────

export async function handleGoalAdd(ctx: SessionHandlerContext, sessionId: string, text: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;

	const goal: SessionGoal = createGoal(`goal_${generateUUID()}`, text);
	session.goals.push(goal);
	await ctx.saveState();
	await ctx.eventBus?.emit("session.goal.added", { sessionId, goal: { ...goal } });
	ctx.scheduleSyncNotesFile(sessionId);
}

export async function handleGoalToggle(ctx: SessionHandlerContext, sessionId: string, goalId: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;

	const goal = session.goals.find((g) => g.id === goalId);
	if (!goal) return;

	goal.completed = !goal.completed;
	goal.completedAt = goal.completed ? new Date().toISOString() : null;
	await ctx.saveState();
	await ctx.eventBus?.emit("session.goal.toggled", { sessionId, goalId, completed: goal.completed });
	ctx.scheduleSyncNotesFile(sessionId);
}

export async function handleGoalRemove(ctx: SessionHandlerContext, sessionId: string, goalId: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;

	const index = session.goals.findIndex((g) => g.id === goalId);
	if (index === -1) return;

	session.goals.splice(index, 1);
	await ctx.saveState();
	await ctx.eventBus?.emit("session.goal.removed", { sessionId, goalId });
	ctx.scheduleSyncNotesFile(sessionId);
}

export async function handleGoalReorder(ctx: SessionHandlerContext, sessionId: string, goalIds: string[]): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;

	if (goalIds.length !== session.goals.length) return;
	const goalMap = new Map(session.goals.map((g) => [g.id, g]));
	const reordered: SessionGoal[] = [];
	for (const id of goalIds) {
		const goal = goalMap.get(id);
		if (!goal) return;
		reordered.push(goal);
	}

	session.goals = reordered;
	await ctx.saveState();
	await ctx.eventBus?.emit("session.goal.reordered", { sessionId, goalIds });
	ctx.scheduleSyncNotesFile(sessionId);
}

// ── Execution task handlers (FR-12) ─────────────────────

export async function addTask(ctx: SessionHandlerContext, sessionId: string, label: string): Promise<ExecutionTask | null> {
	const session = ctx.findSession(sessionId);
	if (!session || !TASK_ALLOWED_STATES.includes(session.status)) return null;

	const task: ExecutionTask = {
		id: `task_${generateUUID()}`,
		label,
		completed: false,
		order: session.executionTasks.length,
	};
	session.executionTasks.push(task);
	await ctx.saveState();
	await ctx.eventBus?.emit("session.task.added", { sessionId, task: { ...task } });
	ctx.scheduleSyncNotesFile(sessionId);
	ctx.checkCognitiveOverload(sessionId);
	return task;
}

export async function toggleTask(ctx: SessionHandlerContext, sessionId: string, taskId: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session || !TASK_ALLOWED_STATES.includes(session.status)) return;

	const task = session.executionTasks.find((t) => t.id === taskId);
	if (!task) return;

	task.completed = !task.completed;
	task.completedAt = task.completed ? new Date().toISOString() : undefined;
	await ctx.saveState();
	await ctx.eventBus?.emit("session.task.completed", { sessionId, taskId });
	ctx.scheduleSyncNotesFile(sessionId);
}

export async function removeTask(ctx: SessionHandlerContext, sessionId: string, taskId: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session || !TASK_ALLOWED_STATES.includes(session.status)) return;

	const index = session.executionTasks.findIndex((t) => t.id === taskId);
	if (index === -1) return;

	session.executionTasks.splice(index, 1);
	for (let i = 0; i < session.executionTasks.length; i++) {
		session.executionTasks[i].order = i;
	}
	await ctx.saveState();
	await ctx.eventBus?.emit("session.task.removed", { sessionId, taskId });
	ctx.scheduleSyncNotesFile(sessionId);
	ctx.checkCognitiveOverload(sessionId);
}

export async function reorderTasks(ctx: SessionHandlerContext, sessionId: string, taskIds: string[]): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session || !TASK_ALLOWED_STATES.includes(session.status)) return;

	if (taskIds.length !== session.executionTasks.length) return;
	const taskMap = new Map(session.executionTasks.map((t) => [t.id, t]));
	const reordered: ExecutionTask[] = [];
	for (const id of taskIds) {
		const task = taskMap.get(id);
		if (!task) return;
		reordered.push(task);
	}

	for (let i = 0; i < reordered.length; i++) {
		reordered[i].order = i;
	}
	session.executionTasks = reordered;
	await ctx.saveState();
	await ctx.eventBus?.emit("session.task.reordered", { sessionId, taskIds });
	ctx.scheduleSyncNotesFile(sessionId);
}
