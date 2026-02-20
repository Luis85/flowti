/**
 * Activity tracking, artifact tracking, cognitive overload detection,
 * and path reconciliation handlers.
 *
 * Extracted from SessionService (TD-101).
 */

import type { SessionActivity, SessionActivityAction } from "../types";
import { MAX_SESSION_ACTIVITY, ARTIFACT_DEDUP_WINDOW_MS, ACTIVITY_DEDUP_WINDOW_MS } from "../types";
import { isExcluded, detectCognitiveOverload, updateSessionPathsForFileMove, updateSessionPathsForFolderMove, updateTemplatePathForFileMove, updateTemplatePathForFolderMove } from "../helpers";
import type { SessionHandlerContext } from "./types";

// ── Cognitive overload detection (FR-16) ─────────────────

export function checkCognitiveOverload(ctx: SessionHandlerContext, sessionId: string): void {
	const session = ctx.findSession(sessionId);
	if (!session || (session.status !== "running" && session.status !== "paused")) return;

	const result = detectCognitiveOverload(session);
	const key = result.reasons.join("|");
	const prev = ctx.lastOverloadReasons.get(sessionId) ?? "";

	if (key !== prev) {
		ctx.lastOverloadReasons.set(sessionId, key);
		if (result.overloaded) {
			void ctx.eventBus?.emit("session.overload.detected", {
				sessionId,
				reasons: result.reasons,
			});
		}
	}
}

// ── Artifact tracking ────────────────────────────────────

export async function onFileEvent(ctx: SessionHandlerContext, path: string, action: "created" | "modified"): Promise<void> {
	const activeId = ctx.getState().activeSessionId;
	if (activeId) {
		await trackArtifactToSession(ctx, activeId, path, action);
	}
}

export async function trackArtifactToSession(ctx: SessionHandlerContext, sessionId: string, path: string, action: "created" | "modified"): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session || session.status !== "running") return;

	const now = Date.now();
	const isDuplicate = session.artifacts.some(
		(a) => a.path === path && a.action === action &&
			(now - Date.parse(a.timestamp)) < ARTIFACT_DEDUP_WINDOW_MS,
	);
	if (isDuplicate) return;

	const artifact = { path, action, timestamp: new Date(now).toISOString() };
	session.artifacts.push(artifact);
	await ctx.saveState();
	await ctx.eventBus?.emit("session.artifact.added", { sessionId: session.id, artifact });
}

// ── Activity tracking (ADR-025, ADR-026) ─────────────────

export async function onActivityEvent(ctx: SessionHandlerContext, path: string, action: SessionActivityAction, oldPath?: string): Promise<void> {
	const activeId = ctx.getState().activeSessionId;
	if (activeId) {
		await trackActivityToSession(ctx, activeId, path, action, oldPath, ACTIVITY_DEDUP_WINDOW_MS);
	}
}

export async function trackActivityToSession(
	ctx: SessionHandlerContext, sessionId: string, path: string, action: SessionActivityAction,
	oldPath: string | undefined, dedupWindowMs: number,
): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session || session.status !== "running") return;

	if (isExcluded(path, ctx.globalActivityFilter, session.activityFilter)) return;

	const now = Date.now();
	const isDuplicate = session.activity.some(
		(a) => a.path === path && a.action === action &&
			(now - Date.parse(a.timestamp)) < dedupWindowMs,
	);
	if (isDuplicate) return;

	const entry: SessionActivity = { timestamp: new Date(now).toISOString(), action, path };
	if (oldPath !== undefined) entry.oldPath = oldPath;

	session.activity.push(entry);

	if (session.activity.length > MAX_SESSION_ACTIVITY) {
		session.activity = session.activity.slice(-MAX_SESSION_ACTIVITY);
	}

	await ctx.saveState();
	await ctx.eventBus?.emit("session.activity.tracked", { sessionId: session.id, activity: { ...entry } });
}

export async function updateActivityFilter(ctx: SessionHandlerContext, sessionId: string, filter: string[]): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;

	session.activityFilter = [...filter];
	await ctx.saveState();
	await ctx.eventBus?.emit("session.activity.filter.updated", { sessionId, filter: [...filter] });
}

// ── Path reconciliation (file/folder rename) ─────────────

export async function handleFileRenamed(ctx: SessionHandlerContext, oldPath: string, newPath: string): Promise<void> {
	const state = ctx.getState();
	const affectedIds = new Set<string>();

	for (const session of state.sessions) {
		if (updateSessionPathsForFileMove(session, oldPath, newPath)) {
			affectedIds.add(session.id);
		}
	}

	for (const tmpl of state.savedTemplates ?? []) {
		updateTemplatePathForFileMove(tmpl, oldPath, newPath);
	}

	if (affectedIds.size > 0) {
		await ctx.saveState();
		await ctx.eventBus?.emit("session.paths.updated", { sessionIds: [...affectedIds] });
	}
}

export async function handleFolderRenamed(ctx: SessionHandlerContext, oldPath: string, newPath: string): Promise<void> {
	const state = ctx.getState();
	const affectedIds = new Set<string>();

	for (const session of state.sessions) {
		if (updateSessionPathsForFolderMove(session, oldPath, newPath)) {
			affectedIds.add(session.id);
		}
	}

	for (const tmpl of state.savedTemplates ?? []) {
		updateTemplatePathForFolderMove(tmpl, oldPath, newPath);
	}

	if (affectedIds.size > 0) {
		await ctx.saveState();
		await ctx.eventBus?.emit("session.paths.updated", { sessionIds: [...affectedIds] });
	}
}
