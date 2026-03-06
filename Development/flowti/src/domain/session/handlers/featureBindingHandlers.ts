/**
 * Feature binding handlers — bind/unbind a session to a feature.
 *
 * Part of Session v3 (Cycle 59).
 */

import type { SessionHandlerContext } from "./types";

/**
 * Binds a session to a feature by name.
 * Only allowed for sessions that are not yet completed or archived.
 */
export async function handleFeatureBind(ctx: SessionHandlerContext, sessionId: string, featureName: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;
	if (session.status === "completed" || session.status === "archived") return;

	session.featureName = featureName;
	await ctx.saveState();
	await ctx.eventBus?.emit("session.feature.bound", { sessionId, featureName });
	ctx.scheduleSyncNotesFile(sessionId);
}

/**
 * Unbinds a session from its current feature.
 */
export async function handleFeatureUnbind(ctx: SessionHandlerContext, sessionId: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session || !session.featureName) return;

	const featureName = session.featureName;
	session.featureName = null;
	await ctx.saveState();
	await ctx.eventBus?.emit("session.feature.unbound", { sessionId, featureName });
	ctx.scheduleSyncNotesFile(sessionId);
}
