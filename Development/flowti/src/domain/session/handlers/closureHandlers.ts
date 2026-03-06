/**
 * Closure ritual handlers — complete closure, skip closure,
 * finish review, and the shared transition helper.
 *
 * Extracted from SessionService (TD-101).
 */

import type { ClosureResponse, Session } from "../types";
import type { SessionHandlerContext } from "./types";
import { generateSessionDoc, getSessionDocPath } from "../sessionDocGenerator";

/**
 * Transitions a session from reviewing → completed.
 * Internal helper shared by completeClosure(), skipClosure(), and finishReview().
 */
export async function transitionToCompleted(ctx: SessionHandlerContext, session: Session): Promise<void> {
	session.status = "completed";
	session.completedAt = new Date().toISOString();
	session.timeline.push({ action: "completed", timestamp: session.completedAt });

	await ctx.saveState();
	await ctx.eventBus?.emit("session.completed", { session: { ...session } });
	await ctx.eventBus?.emit("session.state.save", { sessionId: session.id });

	// Cross-domain: notify feature lifecycle of session completion
	if (session.featureName) {
		const filesChanged = session.artifacts.length;
		const durationMs = session.elapsedBeforePauseMs;
		await ctx.eventBus?.emit("feature.session.ended", {
			featureName: session.featureName,
			endTime: session.completedAt!,
			duration: durationMs,
			filesChanged,
		});
	}

	// Auto-documentation: generate completion summary
	if (ctx.fileSystem) {
		try {
			const docPath = getSessionDocPath(session);
			const docContent = generateSessionDoc(session);
			await ctx.fileSystem.createFile(docPath, docContent, { createFolders: true });
			await ctx.eventBus?.emit("session.documentation.generated", { sessionId: session.id, path: docPath });
		} catch {
			// Non-critical — don't fail the completion
		}
	}
}

/**
 * Transitions reviewing → completed. Gated: requires closureResponse.
 */
export async function finishReview(ctx: SessionHandlerContext, session: Session): Promise<void> {
	if (session.status !== "reviewing") return;
	if (!session.closureResponse) return;
	await transitionToCompleted(ctx, session);
}

/**
 * Completes the closure ritual by saving the user's response
 * and transitioning reviewing → completed.
 */
export async function completeClosure(ctx: SessionHandlerContext, sessionId: string, response: ClosureResponse): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session || session.status !== "reviewing") return;
	session.closureResponse = response;
	await transitionToCompleted(ctx, session);
	await ctx.eventBus?.emit("session.closure.completed", { sessionId, response });
	ctx.scheduleSyncNotesFile(sessionId);
}

/**
 * Skips the closure ritual and transitions directly
 * from reviewing → completed without a closure response.
 */
export async function skipClosure(ctx: SessionHandlerContext, sessionId: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session || session.status !== "reviewing") return;
	await transitionToCompleted(ctx, session);
	ctx.scheduleSyncNotesFile(sessionId);
}
