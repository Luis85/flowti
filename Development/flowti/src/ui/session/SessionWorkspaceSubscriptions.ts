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
import type { SessionEnergyIndicator } from "./SessionEnergyIndicator";
import type { SessionGoalsPanel } from "./SessionGoalsPanel";
import type { SessionExecutionPanel } from "./SessionExecutionPanel";
import type { SessionNotesPanel } from "./SessionNotesPanel";
import type { SessionActivityPanel } from "./SessionActivityPanel";
import type { SessionDecisionPanel } from "./SessionDecisionPanel";
import type { SessionReflectionPanel } from "./SessionReflectionPanel";
import type { SessionOutputPanel } from "./SessionOutputPanel";
import type { CognitiveLoadAlert } from "./CognitiveLoadAlert";

/** Narrow view context consumed by subscription wiring. */
export interface SubscriptionViewContext {
	getSession(): Session | null;
	setSession(session: Session | null): void;
	refreshSession(): Session;
	render(): void;
	scheduleRender(): void;
	schedulePanelRefresh(panelId: string): void;
	renderActions(): void;
	captureWorkspaceState(sessionId: string): Promise<void>;
	restoreWorkspaceState(sessionId: string, state: WorkspaceState): Promise<void>;

	// Panel accessors
	getTimerPanel(): SessionTimerPanel | null;
	getEnergyPanel(): SessionEnergyIndicator | null;
	getGoalsPanel(): SessionGoalsPanel | null;
	getExecutionPanel(): SessionExecutionPanel | null;
	getNotesPanel(): SessionNotesPanel | null;
	getActivityPanel(): SessionActivityPanel | null;
	getDecisionPanel(): SessionDecisionPanel | null;
	getReflectionPanel(): SessionReflectionPanel | null;
	getOutputPanel(): SessionOutputPanel | null;
	getOverloadAlert(): CognitiveLoadAlert | null;
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

	// ── Timer (synchronous — high frequency, lightweight) ───

	// Timer tick — incremental DOM update only (no debounce)
	unsubs.push(
		eventBus.on("session.timer.tick", (event) => {
			const timer = ctx.getTimerPanel();
			const session = ctx.getSession();
			if (timer && session && event.payload.sessionId === session.id) {
				timer.updateDisplay(event.payload.remainingMs);
			}
		}),
	);

	// Timer completed — immediate render (important status transition)
	unsubs.push(
		eventBus.on("session.timer.completed", () => {
			ctx.setSession(ctx.refreshSession());
			ctx.render();
		}),
	);

	// ── Full re-renders (debounced at 16ms) ─────────────────

	// Duration updated
	unsubs.push(
		eventBus.on("session.duration.updated", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.scheduleRender();
			}
		}),
	);

	// Session lifecycle changes — debounced re-render for own session,
	// debounced action bar refresh for other sessions (Start button visibility)
	const lifecycleEvents = [
		"session.started", "session.paused", "session.resumed", "session.completed",
	] as const;
	for (const eventType of lifecycleEvents) {
		unsubs.push(
			eventBus.on(eventType, (event) => {
				if (event.payload.session.id === ctx.getSession()?.id) {
					ctx.setSession(event.payload.session);
					ctx.scheduleRender();
				} else {
					ctx.schedulePanelRefresh("actions");
				}
			}),
		);
	}

	// Closure started — debounced re-render to show closure overlay (FR-14)
	unsubs.push(
		eventBus.on("session.closure.started", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.scheduleRender();
			}
		}),
	);

	// Closure completed — debounced re-render to show completed state
	unsubs.push(
		eventBus.on("session.closure.completed", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.scheduleRender();
			}
		}),
	);

	// Notes file set — debounced re-render
	unsubs.push(
		eventBus.on("session.notesFile.updated", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.scheduleRender();
			}
		}),
	);

	// Canvas file set — debounced re-render
	unsubs.push(
		eventBus.on("session.canvasFile.updated", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.scheduleRender();
			}
		}),
	);

	// Context binding added/removed/changed — debounced re-render
	const contextEvents = ["session.context.bound", "session.context.unbound", "session.context.typeChanged"] as const;
	for (const eventType of contextEvents) {
		unsubs.push(
			eventBus.on(eventType, (event) => {
				if (event.payload.sessionId === ctx.getSession()?.id) {
					ctx.setSession(ctx.refreshSession());
					ctx.scheduleRender();
				}
			}),
		);
	}

	// Activity filter updated — debounced re-render
	unsubs.push(
		eventBus.on("session.activity.filter.updated", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.scheduleRender();
			}
		}),
	);

	// Path reconciliation — debounced re-render when files renamed/moved
	unsubs.push(
		eventBus.on("session.paths.updated", (event) => {
			const session = ctx.getSession();
			if (session && event.payload.sessionIds.includes(session.id)) {
				ctx.setSession(ctx.refreshSession());
				ctx.scheduleRender();
			}
		}),
	);

	// Session deleted — immediate render (must clear to empty state)
	unsubs.push(
		eventBus.on("session.deleted", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(null);
				ctx.render();
			}
		}),
	);

	// ── Panel refreshes (debounced + batched at 16ms) ───────

	// Energy changed
	unsubs.push(
		eventBus.on("session.energy.changed", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.schedulePanelRefresh("energy");
			}
		}),
	);

	// Goal changes
	const goalEvents = ["session.goal.added", "session.goal.toggled", "session.goal.removed", "session.goal.reordered"] as const;
	for (const eventType of goalEvents) {
		unsubs.push(
			eventBus.on(eventType, (event) => {
				if (event.payload.sessionId === ctx.getSession()?.id) {
					ctx.setSession(ctx.refreshSession());
					ctx.schedulePanelRefresh("goals");
				}
			}),
		);
	}

	// Task changes
	const taskEvents = ["session.task.added", "session.task.completed", "session.task.removed", "session.task.reordered"] as const;
	for (const eventType of taskEvents) {
		unsubs.push(
			eventBus.on(eventType, (event) => {
				if (event.payload.sessionId === ctx.getSession()?.id) {
					ctx.setSession(ctx.refreshSession());
					ctx.schedulePanelRefresh("tasks");
				}
			}),
		);
	}

	// Decision changes
	const decisionEvents = ["session.decision.recorded", "session.decision.removed"] as const;
	for (const eventType of decisionEvents) {
		unsubs.push(
			eventBus.on(eventType, (event) => {
				if (event.payload.sessionId === ctx.getSession()?.id) {
					ctx.setSession(ctx.refreshSession());
					ctx.schedulePanelRefresh("decisions");
				}
			}),
		);
	}

	// Reflection changes
	const reflectionEvents = ["session.reflection.added", "session.reflection.removed"] as const;
	for (const eventType of reflectionEvents) {
		unsubs.push(
			eventBus.on(eventType, (event) => {
				if (event.payload.sessionId === ctx.getSession()?.id) {
					ctx.setSession(ctx.refreshSession());
					ctx.schedulePanelRefresh("reflections");
				}
			}),
		);
	}

	// Notes updated
	unsubs.push(
		eventBus.on("session.notes.updated", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.schedulePanelRefresh("notes");
			}
		}),
	);

	// Artifact added
	unsubs.push(
		eventBus.on("session.artifact.added", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.schedulePanelRefresh("activity");
			}
		}),
	);

	// Activity tracked
	unsubs.push(
		eventBus.on("session.activity.tracked", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.schedulePanelRefresh("activity");
			}
		}),
	);

	// Output artifact generated
	unsubs.push(
		eventBus.on("session.output.generated", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.schedulePanelRefresh("output");
			}
		}),
	);

	// Cognitive overload detected
	unsubs.push(
		eventBus.on("session.overload.detected", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.schedulePanelRefresh("overload");
			}
		}),
	);

	// Reverse sync from notes file — batched panel refreshes (goals + tasks + notes)
	unsubs.push(
		eventBus.on("session.notes.reverseSynced", (event) => {
			if (event.payload.sessionId === ctx.getSession()?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.schedulePanelRefresh("goals");
				ctx.schedulePanelRefresh("tasks");
				ctx.schedulePanelRefresh("notes");
			}
		}),
	);

	// ── Workspace state (async, no debounce needed) ─────────

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
