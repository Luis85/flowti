/**
 * EventBus subscriptions for the Session Workspace handler.
 *
 * Extracted from session-workspace-handler.ts to stay under max-lines.
 * Wires session domain events to the Lit workspace component properties.
 */

import type { IEventBus } from "../../events/types";
import type { SessionService } from "../../../domain/session/SessionService";
import type { Session } from "../../../domain/session/types";
import { computeActivityIntelligence, detectCognitiveOverload, isExcluded } from "../../../domain/session/helpers";
import type { FlowtiSessionWorkspace } from "../../../components/session/flowti-session-workspace";
import { captureWorkspaceState, restoreWorkspaceState } from "../../../ui/session/SessionWorkspaceHelpers";
import type { WorkspaceHelperContext } from "../../../ui/session/SessionWorkspaceHelpers";

export interface SubscriptionContext {
	eventBus: IEventBus;
	sessionService: SessionService;
	workspace: FlowtiSessionWorkspace;
	getSession: () => Session | null;
	setSession: (s: Session | null) => void;
	refreshSession: () => Session;
	scheduleSync: () => void;
	syncToComponent: () => void;
	buildHelperContext: () => WorkspaceHelperContext;
}

export function getFilteredActivity(
	s: Session,
	sessionService: SessionService,
): readonly { path: string; action: string; timestamp: string }[] {
	if (s.status === "completed" || s.status === "archived") {
		return s.activity;
	}
	const globalFilter = sessionService.globalActivityFilter;
	if (globalFilter.length === 0 && s.activityFilter.length === 0) {
		return s.activity;
	}
	return s.activity.filter(
		(entry) => !isExcluded(entry.path, globalFilter, s.activityFilter),
	);
}

export function setupEventSubscriptions(ctx: SubscriptionContext): (() => void)[] {
	const { eventBus, sessionService, workspace } = ctx;
	const unsubs: (() => void)[] = [];

	// Timer tick — direct property update (high frequency)
	unsubs.push(
		eventBus.on("session.timer.tick", (event) => {
			const session = ctx.getSession();
			if (session && event.payload.sessionId === session.id) {
				workspace.remainingMs = event.payload.remainingMs;
			}
		}),
	);

	// Timer completed — immediate full sync
	unsubs.push(
		eventBus.on("session.timer.completed", () => {
			ctx.setSession(ctx.refreshSession());
			ctx.syncToComponent();
		}),
	);

	// Duration updated
	unsubs.push(
		eventBus.on("session.duration.updated", (event) => {
			const session = ctx.getSession();
			if (event.payload.sessionId === session?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.scheduleSync();
			}
		}),
	);

	// Session lifecycle changes
	const lifecycleEvents = [
		"session.started", "session.paused", "session.resumed", "session.completed",
	] as const;
	for (const eventType of lifecycleEvents) {
		unsubs.push(
			eventBus.on(eventType, (event) => {
				const session = ctx.getSession();
				if (event.payload.session.id === session?.id) {
					ctx.setSession(event.payload.session);
					ctx.scheduleSync();
				} else {
					ctx.scheduleSync();
				}
			}),
		);
	}

	// Closure started/completed
	unsubs.push(
		eventBus.on("session.closure.started", (event) => {
			const session = ctx.getSession();
			if (event.payload.sessionId === session?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.syncToComponent();
			}
		}),
	);
	unsubs.push(
		eventBus.on("session.closure.completed", (event) => {
			const session = ctx.getSession();
			if (event.payload.sessionId === session?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.syncToComponent();
			}
		}),
	);

	// Notes file / canvas file set
	unsubs.push(
		eventBus.on("session.notesFile.updated", (event) => {
			const session = ctx.getSession();
			if (event.payload.sessionId === session?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.scheduleSync();
			}
		}),
	);
	unsubs.push(
		eventBus.on("session.canvasFile.updated", (event) => {
			const session = ctx.getSession();
			if (event.payload.sessionId === session?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.scheduleSync();
			}
		}),
	);

	// Context binding changes
	const contextEvents = ["session.context.bound", "session.context.unbound", "session.context.typeChanged"] as const;
	for (const eventType of contextEvents) {
		unsubs.push(
			eventBus.on(eventType, (event) => {
				const session = ctx.getSession();
				if (event.payload.sessionId === session?.id) {
					ctx.setSession(ctx.refreshSession());
					ctx.scheduleSync();
				}
			}),
		);
	}

	// Activity filter updated
	unsubs.push(
		eventBus.on("session.activity.filter.updated", (event) => {
			const session = ctx.getSession();
			if (event.payload.sessionId === session?.id) {
				ctx.setSession(ctx.refreshSession());
				ctx.scheduleSync();
			}
		}),
	);

	// Path reconciliation
	unsubs.push(
		eventBus.on("session.paths.updated", (event) => {
			const session = ctx.getSession();
			if (session && event.payload.sessionIds.includes(session.id)) {
				ctx.setSession(ctx.refreshSession());
				ctx.scheduleSync();
			}
		}),
	);

	// Session deleted
	unsubs.push(
		eventBus.on("session.deleted", (event) => {
			const session = ctx.getSession();
			if (event.payload.sessionId === session?.id) {
				ctx.setSession(null);
				ctx.syncToComponent();
			}
		}),
	);

	// Energy changed
	unsubs.push(
		eventBus.on("session.energy.changed", (event) => {
			const session = ctx.getSession();
			if (event.payload.sessionId === session?.id) {
				const refreshed = ctx.refreshSession();
				ctx.setSession(refreshed);
				workspace.energyLevel = refreshed.energy ?? 0;
			}
		}),
	);

	// Goal changes
	const goalEvents = ["session.goal.added", "session.goal.toggled", "session.goal.removed", "session.goal.reordered"] as const;
	for (const eventType of goalEvents) {
		unsubs.push(
			eventBus.on(eventType, (event) => {
				const session = ctx.getSession();
				if (event.payload.sessionId === session?.id) {
					const refreshed = ctx.refreshSession();
					ctx.setSession(refreshed);
					workspace.goals = [...refreshed.goals];
				}
			}),
		);
	}

	// Task changes
	const taskEvents = ["session.task.added", "session.task.completed", "session.task.removed", "session.task.reordered"] as const;
	for (const eventType of taskEvents) {
		unsubs.push(
			eventBus.on(eventType, (event) => {
				const session = ctx.getSession();
				if (event.payload.sessionId === session?.id) {
					const refreshed = ctx.refreshSession();
					ctx.setSession(refreshed);
					workspace.tasks = [...refreshed.executionTasks];
					const intel = computeActivityIntelligence(refreshed);
					workspace.intelligence = {
						filesModified: intel.filesModified, artifactsProduced: intel.artifactsProduced,
						tasksCompleted: intel.tasksCompleted, eventsEmitted: intel.eventsEmitted,
						activeTimeMs: intel.activeTimeMs, pauseTimeMs: intel.pauseTimeMs,
					};
				}
			}),
		);
	}

	// Decision changes
	const decisionEvents = ["session.decision.recorded", "session.decision.removed"] as const;
	for (const eventType of decisionEvents) {
		unsubs.push(
			eventBus.on(eventType, (event) => {
				const session = ctx.getSession();
				if (event.payload.sessionId === session?.id) {
					const refreshed = ctx.refreshSession();
					ctx.setSession(refreshed);
					workspace.decisions = [...refreshed.decisions];
				}
			}),
		);
	}

	// Reflection changes
	const reflectionEvents = ["session.reflection.added", "session.reflection.removed"] as const;
	for (const eventType of reflectionEvents) {
		unsubs.push(
			eventBus.on(eventType, (event) => {
				const session = ctx.getSession();
				if (event.payload.sessionId === session?.id) {
					const refreshed = ctx.refreshSession();
					ctx.setSession(refreshed);
					workspace.reflections = [...refreshed.reflections];
				}
			}),
		);
	}

	// Notes updated
	unsubs.push(
		eventBus.on("session.notes.updated", (event) => {
			const session = ctx.getSession();
			if (event.payload.sessionId === session?.id) {
				const refreshed = ctx.refreshSession();
				ctx.setSession(refreshed);
				workspace.notesText = refreshed.notes;
			}
		}),
	);

	// Artifact added
	unsubs.push(
		eventBus.on("session.artifact.added", (event) => {
			const session = ctx.getSession();
			if (event.payload.sessionId === session?.id) {
				const refreshed = ctx.refreshSession();
				ctx.setSession(refreshed);
				workspace.activities = [...getFilteredActivity(refreshed, sessionService)];
			}
		}),
	);

	// Activity tracked
	unsubs.push(
		eventBus.on("session.activity.tracked", (event) => {
			const session = ctx.getSession();
			if (event.payload.sessionId === session?.id) {
				const refreshed = ctx.refreshSession();
				ctx.setSession(refreshed);
				workspace.activities = [...getFilteredActivity(refreshed, sessionService)];
				const intel = computeActivityIntelligence(refreshed);
				workspace.intelligence = {
					filesModified: intel.filesModified, artifactsProduced: intel.artifactsProduced,
					tasksCompleted: intel.tasksCompleted, eventsEmitted: intel.eventsEmitted,
					activeTimeMs: intel.activeTimeMs, pauseTimeMs: intel.pauseTimeMs,
				};
			}
		}),
	);

	// Output artifact generated
	unsubs.push(
		eventBus.on("session.output.generated", (event) => {
			const session = ctx.getSession();
			if (event.payload.sessionId === session?.id) {
				const refreshed = ctx.refreshSession();
				ctx.setSession(refreshed);
				workspace.outputArtifacts = [...refreshed.outputArtifacts];
			}
		}),
	);

	// Cognitive overload detected
	unsubs.push(
		eventBus.on("session.overload.detected", (event) => {
			const session = ctx.getSession();
			if (event.payload.sessionId === session?.id) {
				if (session) {
					const result = detectCognitiveOverload(session);
					workspace.overloaded = result.overloaded;
					workspace.overloadReasons = [...result.reasons];
				}
			}
		}),
	);

	// Reverse sync from notes file
	unsubs.push(
		eventBus.on("session.notes.reverseSynced", (event) => {
			const session = ctx.getSession();
			if (event.payload.sessionId === session?.id) {
				const refreshed = ctx.refreshSession();
				ctx.setSession(refreshed);
				workspace.goals = [...refreshed.goals];
				workspace.tasks = [...refreshed.executionTasks];
				workspace.notesText = refreshed.notes;
			}
		}),
	);

	// Workspace state capture/restore
	unsubs.push(
		eventBus.on("session.state.save", (event) => {
			const session = ctx.getSession();
			if (event.payload.sessionId === session?.id) {
				void captureWorkspaceState(ctx.buildHelperContext(), event.payload.sessionId);
			}
		}),
	);

	unsubs.push(
		eventBus.on("session.state.restore", (event) => {
			const session = ctx.getSession();
			if (event.payload.sessionId === session?.id) {
				void restoreWorkspaceState(ctx.buildHelperContext(), event.payload.sessionId, event.payload.state);
			}
		}),
	);

	return unsubs;
}
