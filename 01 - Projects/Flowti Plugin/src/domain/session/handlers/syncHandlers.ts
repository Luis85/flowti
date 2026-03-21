/**
 * Note sync handlers — forward sync (session → note file)
 * and reverse sync (note file → session).
 *
 * Extracted from SessionService (TD-101).
 */

import { generateUUID } from "../../../utils/helpers";
import type { ExecutionTask, Session } from "../types";
import { SESSION_NOTES_SYNC_DELAY_MS } from "../types";
import { createGoal, mergeSessionNotes, reverseParseSessionNotes, computeReverseSyncDiff } from "../helpers";
import type { SessionHandlerContext } from "./types";

// ── Forward sync (session → note file) ───────────────────

export function scheduleSyncNotesFile(ctx: SessionHandlerContext, sessionId: string): void {
	if (!ctx.fileSystem) return;
	const session = ctx.findSession(sessionId);
	if (!session?.notesFile) return;

	const existing = ctx.noteSyncTimers.get(sessionId);
	if (existing) clearTimeout(existing);

	ctx.noteSyncTimers.set(
		sessionId,
		setTimeout(() => {
			ctx.noteSyncTimers.delete(sessionId);
			void syncNotesFile(ctx, sessionId);
		}, SESSION_NOTES_SYNC_DELAY_MS),
	);
}

export async function syncNotesFile(ctx: SessionHandlerContext, sessionId: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session?.notesFile || !ctx.fileSystem) return;

	try {
		const exists = await ctx.fileSystem.fileExists(session.notesFile);
		if (!exists) return;

		const existing = await ctx.fileSystem.readFile(session.notesFile);
		const merged = mergeSessionNotes(existing, session, ctx.globalActivityFilter);
		await ctx.fileSystem.updateFile(session.notesFile, merged);
		ctx.lastSyncedContent.set(session.notesFile, merged);
		await ctx.eventBus?.emit("session.notes.synced", { sessionId, path: session.notesFile });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		await ctx.eventBus?.emit("session.notes.syncFailed", { sessionId, path: session.notesFile ?? "", error: msg });
	}
}

// ── Reverse sync (note file → session) ───────────────────

export function findSessionByNotesFile(ctx: SessionHandlerContext, path: string): Session | undefined {
	return ctx.getState().sessions.find(s => s.notesFile === path);
}

export function scheduleReverseSync(ctx: SessionHandlerContext, sessionId: string, path: string): void {
	if (!ctx.fileSystem) return;

	const existing = ctx.reverseSyncTimers.get(sessionId);
	if (existing) clearTimeout(existing);

	ctx.reverseSyncTimers.set(
		sessionId,
		setTimeout(() => {
			ctx.reverseSyncTimers.delete(sessionId);
			void executeReverseSync(ctx, sessionId, path);
		}, SESSION_NOTES_SYNC_DELAY_MS),
	);
}

/** Apply reverse sync diff to a session (mutates in place). */
function applyReverseDiff(session: Session, diff: ReturnType<typeof computeReverseSyncDiff>): void {
	for (const toggle of diff.goalToggles) {
		const goal = session.goals.find(g => g.id === toggle.goalId);
		if (goal) goal.completed = toggle.completed;
	}
	for (const ng of diff.newGoals) {
		const goal = createGoal(`goal_${generateUUID()}`, ng.label);
		if (ng.checked) goal.completed = true;
		session.goals.push(goal);
	}
	for (const toggle of diff.taskToggles) {
		const task = session.executionTasks.find(t => t.id === toggle.taskId);
		if (task) task.completed = toggle.completed;
	}
	for (const nt of diff.newTasks) {
		const task: ExecutionTask = {
			id: `task_${generateUUID()}`, label: nt.label, completed: nt.checked, order: session.executionTasks.length,
		};
		session.executionTasks.push(task);
	}
	if (diff.notesUpdate !== null) {
		session.notes = diff.notesUpdate;
	}
}

export async function executeReverseSync(ctx: SessionHandlerContext, sessionId: string, path: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session?.notesFile || session.notesFile !== path || !ctx.fileSystem) return;

	try {
		const content = await ctx.fileSystem.readFile(path);
		if (content === ctx.lastSyncedContent.get(path)) return;

		const parsed = reverseParseSessionNotes(content);
		const diff = computeReverseSyncDiff(session, parsed);
		if (diff.changes.length === 0) return;

		applyReverseDiff(session, diff);

		await ctx.saveState();
		await ctx.eventBus?.emit("session.notes.reverseSynced", { sessionId, path, changes: diff.changes });

		if (diff.newGoals.length > 0 || diff.newTasks.length > 0) {
			ctx.scheduleSyncNotesFile(sessionId);
		}
	} catch (err: unknown) {
		console.warn("[Flowti] Reverse sync failed for session", sessionId, err instanceof Error ? err.message : err);
	}
}
