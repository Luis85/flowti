/**
 * Session lifecycle handlers — create, start, pause, resume,
 * complete, archive, delete.
 *
 * Extracted from SessionService (TD-101).
 */

import { generateUUID } from "../../../utils/helpers";
import type { ContextBindingType, ExecutionTask, ReflectionEntry, Session } from "../types";
import { MAX_SESSIONS, SESSION_NOTES_FOLDER } from "../types";
import { createSession, createGoal, createDecision, createContextBinding } from "../helpers";
import type { SessionHandlerContext } from "./types";

export async function handleCreate(ctx: SessionHandlerContext, payload: {
	type: string; title: string; durationMinutes: number; focusFile?: string;
	goals?: string[]; decisions?: string[]; tasks?: string[];
	contextBindings?: Array<{ path: string; type: ContextBindingType }>;
	notes?: string; reflections?: Array<{ type: ReflectionEntry["type"]; content: string }>;
	featureName?: string;
}): Promise<Session> {
	const id = `session_${generateUUID()}`;
	const session = createSession(
		id,
		payload.type as Session["type"],
		payload.title,
		payload.durationMinutes,
		payload.focusFile,
	);

	// Auto-set notes file path (ISO date prefix + short ID suffix)
	const datePrefix = new Date().toISOString().split("T")[0];
	const safeName = session.title.replace(/[\\/:*?"<>|]/g, "-");
	const shortId = id.slice(-6);
	session.notesFile = `${SESSION_NOTES_FOLDER}/${datePrefix} ${safeName} (${shortId}).md`;

	if (!session.focusFile) {
		session.focusFile = session.notesFile;
	}

	if (payload.goals && payload.goals.length > 0) {
		session.goals = payload.goals.map((text) => createGoal(`goal_${generateUUID()}`, text));
	}

	if (payload.decisions && payload.decisions.length > 0) {
		session.decisions = payload.decisions.map((title) => createDecision(`dec_${generateUUID()}`, title, ""));
	}

	if (payload.tasks && payload.tasks.length > 0) {
		session.executionTasks = payload.tasks.map((label, i): ExecutionTask => ({
			id: `task_${generateUUID()}`,
			label,
			completed: false,
			order: i,
		}));
	}

	if (payload.contextBindings && payload.contextBindings.length > 0) {
		session.contextBindings = payload.contextBindings.map((cb) =>
			createContextBinding(`ctx_${generateUUID()}`, cb.type, cb.path),
		);
	}

	if (payload.notes) {
		session.notes = payload.notes;
	}

	if (payload.reflections && payload.reflections.length > 0) {
		session.reflections = payload.reflections.map((r): ReflectionEntry => ({
			id: `ref_${generateUUID()}`,
			type: r.type,
			content: r.content,
			timestamp: new Date().toISOString(),
		}));
	}

	if (payload.featureName) {
		session.featureName = payload.featureName;
	}

	const state = ctx.getState();
	state.sessions.unshift(session);

	if (state.sessions.length > MAX_SESSIONS) {
		state.sessions = state.sessions.slice(0, MAX_SESSIONS);
	}

	await ctx.saveState();
	ctx.scheduleSyncNotesFile(session.id);
	await ctx.eventBus?.emit("session.created", { session: { ...session } });
	return { ...session };
}

export async function handleStart(ctx: SessionHandlerContext, sessionId: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session || session.status !== "prepared") return;

	const state = ctx.getState();
	if (state.activeSessionId) {
		// Only block if the existing active session is actually running
		const existingSession = ctx.findSession(state.activeSessionId);
		if (existingSession && existingSession.status === "running") return;
		// Clear stale activeSessionId (session was paused, completed, or deleted)
		state.activeSessionId = null;
	}

	session.status = "running";
	session.startedAt = new Date().toISOString();
	state.activeSessionId = session.id;
	session.timeline.push({ action: "started", timestamp: session.startedAt });

	ctx.startTimer(session);
	await ctx.saveState();
	await ctx.eventBus?.emit("session.started", { session: { ...session } });
	if (session.featureName) {
		await ctx.eventBus?.emit("feature.session.started", { featureName: session.featureName, startTime: session.startedAt! });
	}
	ctx.scheduleSyncNotesFile(sessionId);
}

export async function handlePause(ctx: SessionHandlerContext, sessionId: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session || session.status !== "running") return;

	const now = Date.now();
	if (session.startedAt) {
		session.elapsedBeforePauseMs += now - Date.parse(session.startedAt);
	}
	session.status = "paused";
	session.pausedAt = new Date(now).toISOString();
	session.startedAt = null;
	session.timeline.push({ action: "paused", timestamp: session.pausedAt });

	ctx.stopTimer();
	await ctx.saveState();
	await ctx.eventBus?.emit("session.paused", { session: { ...session } });
	await ctx.eventBus?.emit("session.state.save", { sessionId: session.id });
	ctx.scheduleSyncNotesFile(sessionId);
}

export async function handleResume(ctx: SessionHandlerContext, sessionId: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session || session.status !== "paused") return;

	const state = ctx.getState();
	if (state.activeSessionId && state.activeSessionId !== session.id) return;

	session.status = "running";
	session.startedAt = new Date().toISOString();
	session.pausedAt = null;
	state.activeSessionId = session.id;
	session.timeline.push({ action: "resumed", timestamp: session.startedAt });

	ctx.startTimer(session);
	await ctx.saveState();
	await ctx.eventBus?.emit("session.resumed", { session: { ...session } });
	ctx.scheduleSyncNotesFile(sessionId);
	// Skip workspace state restore for train sessions — they use TrainMainView
	if (session.workspaceState && session.type !== "train-of-thought") {
		await ctx.eventBus?.emit("session.state.restore", { sessionId: session.id, state: session.workspaceState });
	}
}

export async function handleComplete(ctx: SessionHandlerContext, sessionId: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session || session.status === "completed" || session.status === "archived" || session.status === "reviewing") return;

	await completeSession(ctx, session);
}

export async function handleArchive(ctx: SessionHandlerContext, sessionId: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session || session.status !== "completed") return;

	session.status = "archived";
	session.activity = [];
	await ctx.saveState();
	await ctx.eventBus?.emit("session.archived", { session: { ...session } });
}

export async function handleDelete(ctx: SessionHandlerContext, sessionId: string): Promise<void> {
	const state = ctx.getState();
	const index = state.sessions.findIndex((s) => s.id === sessionId);
	if (index === -1) return;

	if (state.activeSessionId === sessionId) {
		ctx.stopTimer();
		state.activeSessionId = null;
	}
	state.sessions.splice(index, 1);
	await ctx.saveState();
	await ctx.eventBus?.emit("session.deleted", { sessionId });
}

// ── Shared completion helper ─────────────────────────────

export async function completeSession(ctx: SessionHandlerContext, session: Session): Promise<void> {
	if (session.startedAt) {
		session.elapsedBeforePauseMs += Date.now() - Date.parse(session.startedAt);
		session.startedAt = null;
	}

	const state = ctx.getState();
	if (state.activeSessionId === session.id) {
		ctx.stopTimer();
		state.activeSessionId = null;
	}
	session.pausedAt = null;

	// FR-14: stop at "reviewing" — closure overlay gates the next transition
	session.status = "reviewing";
	session.timeline.push({ action: "reviewing", timestamp: new Date().toISOString() });

	await ctx.saveState();
	await ctx.eventBus?.emit("session.closure.started", { sessionId: session.id });
	ctx.scheduleSyncNotesFile(session.id);
}
