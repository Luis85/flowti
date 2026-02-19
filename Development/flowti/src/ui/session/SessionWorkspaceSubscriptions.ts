/**
 * Event subscription wiring for the SessionWorkspaceView.
 *
 * Extracted from SessionWorkspaceView to keep the main view under 450 LOC.
 * All 24 event listeners follow a consistent pattern:
 *   check session ID match → refresh session or full render → notify panels.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { Session, WorkspaceState } from "../../domain/session/types";
import type { SessionTimerPanel } from "./SessionTimerPanel";
import type { SessionGoalsPanel } from "./SessionGoalsPanel";
import type { SessionNotesPanel } from "./SessionNotesPanel";
import type { SessionActivityPanel } from "./SessionActivityPanel";
import type { SessionDecisionPanel } from "./SessionDecisionPanel";
import type { SessionOutputPanel } from "./SessionOutputPanel";

/** Narrow view context consumed by subscription wiring. */
export interface SubscriptionViewContext {
	getSession(): Session | null;
	setSession(session: Session | null): void;
	refreshSession(): Session;
	render(): void;
	renderActions(): void;
	captureWorkspaceState(sessionId: string): Promise<void>;
	restoreWorkspaceState(sessionId: string, state: WorkspaceState): Promise<void>;

	// Panel accessors
	getTimerPanel(): SessionTimerPanel | null;
	getGoalsPanel(): SessionGoalsPanel | null;
	getNotesPanel(): SessionNotesPanel | null;
	getActivityPanel(): SessionActivityPanel | null;
	getDecisionPanel(): SessionDecisionPanel | null;
	getOutputPanel(): SessionOutputPanel | null;
}

/**
 * Registers all event listeners for the session workspace view.
 * Returns an array of unsubscribe functions for cleanup in `onClose()`.
 */
export function setupEventSubscriptions(
	ctx: SubscriptionViewContext,
	eventBus: IEventBus,
): (() => void)[] {
	const unsubs: (() => void)[] = [];

	// Timer tick — incremental DOM update only
	unsubs.push(
		eventBus.on("session.timer.tick", (event) => {
			const timer = ctx.getTimerPanel();
			const session = ctx.getSession();
			if (timer && session && event.payload.sessionId === session.id) {
				timer.updateDisplay(event.payload.remainingMs);
			}
		}),
	);

	// Timer completed — full re-render for status change
	unsubs.push(
		eventBus.on("session.timer.completed", () => {
			ctx.setSession(ctx.refreshSession());
			ctx.render();
		}),
	);

	// Duration updated — full re-render to update timer display
	unsubs.push(
		eventBus.on("session.duration.updated", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.render();
			}
		}),
	);

	// Session lifecycle changes — full re-render for own session,
	// action bar refresh for other sessions (Start button visibility depends on active session)
	const lifecycleEvents = [
		"session.started", "session.paused", "session.resumed", "session.completed",
	] as const;
	for (const eventType of lifecycleEvents) {
		unsubs.push(
			eventBus.on(eventType, (event) => {
				if (event.payload.session.id === ctx.getSession()?.id) {
					ctx.setSession(event.payload.session);
					ctx.render();
				} else {
					ctx.renderActions();
				}
			}),
		);
	}

	// Goal changes — refresh goals panel
	const goalEvents = ["session.goal.added", "session.goal.toggled", "session.goal.removed"] as const;
	for (const eventType of goalEvents) {
		unsubs.push(
			eventBus.on(eventType, (event) => {
				if (event.payload.sessionId === ctx.getSession()?.id) {
					ctx.setSession(ctx.refreshSession());
					ctx.getGoalsPanel()?.refreshGoals();
				}
			}),
		);
	}

	// Decision changes — refresh decisions panel
	const decisionEvents = ["session.decision.recorded", "session.decision.removed"] as const;
	for (const eventType of decisionEvents) {
		unsubs.push(
			eventBus.on(eventType, (event) => {
				if (event.payload.sessionId === ctx.getSession()?.id) {
					ctx.setSession(ctx.refreshSession());
					ctx.getDecisionPanel()?.refreshList();
				}
			}),
		);
	}

	// Notes updated — update textarea if not focused
	unsubs.push(
		eventBus.on("session.notes.updated", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.getNotesPanel()?.updateNotes(event.payload.notes);
			}
		}),
	);

	// Artifact added — refresh activity list
	unsubs.push(
		eventBus.on("session.artifact.added", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.getActivityPanel()?.refreshList();
			}
		}),
	);

	// Notes file set — full re-render
	unsubs.push(
		eventBus.on("session.notesFile.updated", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.render();
			}
		}),
	);

	// Canvas file set — full re-render
	unsubs.push(
		eventBus.on("session.canvasFile.updated", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.render();
			}
		}),
	);

	// Context binding added/removed/changed — full re-render
	unsubs.push(
		eventBus.on("session.context.bound", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.render();
			}
		}),
	);
	unsubs.push(
		eventBus.on("session.context.unbound", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.render();
			}
		}),
	);
	unsubs.push(
		eventBus.on("session.context.typeChanged", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.render();
			}
		}),
	);

	// Activity tracked — incremental update to activity list
	unsubs.push(
		eventBus.on("session.activity.tracked", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.getActivityPanel()?.refreshList();
			}
		}),
	);

	// Activity filter updated — full re-render
	unsubs.push(
		eventBus.on("session.activity.filter.updated", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.render();
			}
		}),
	);

	// Path reconciliation — re-render when attached files are renamed/moved
	unsubs.push(
		eventBus.on("session.paths.updated", (event) => {
			const session = ctx.getSession();
			if (session && event.payload.sessionIds.includes(session.id)) {
				ctx.setSession(ctx.refreshSession());
				ctx.render();
			}
		}),
	);

	// Output artifact generated — refresh output panel
	unsubs.push(
		eventBus.on("session.output.generated", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.getOutputPanel()?.refreshList();
			}
		}),
	);

	// Session deleted — show empty state
	unsubs.push(
		eventBus.on("session.deleted", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(null);
				ctx.render();
			}
		}),
	);

	// Workspace state capture — service requests snapshot on pause/complete
	unsubs.push(
		eventBus.on("session.state.save", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				void ctx.captureWorkspaceState(event.payload.sessionId);
			}
		}),
	);

	// Workspace state restore — service requests file reopening on resume
	unsubs.push(
		eventBus.on("session.state.restore", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				void ctx.restoreWorkspaceState(event.payload.sessionId, event.payload.state);
			}
		}),
	);

	return unsubs;
}
