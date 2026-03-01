/**
 * CanvasSessionMonitor — pure state tracker for canvas session monitoring.
 *
 * Owns no I/O. Callers push operations in; the monitor maintains state
 * (stats, activity feed, phase progression) and returns snapshots.
 */
import type {
	CanvasActivity,
	CanvasActivityAction,
	CanvasSessionPhase,
	CanvasSessionState,
	CanvasSessionStats,
} from "./types";
import { MAX_ACTIVITIES } from "./types";

export interface CreateCanvasSessionInput {
	sessionId: string;
	goal: string;
	templateId: string | null;
	templateName: string | null;
	canvasPath: string;
	phases?: CanvasSessionPhase[];
}

export class CanvasSessionMonitor {
	private state: CanvasSessionState | null = null;

	/** Creates a new monitored session. Returns the initial state. */
	start(input: CreateCanvasSessionInput): CanvasSessionState {
		this.state = {
			sessionId: input.sessionId,
			goal: input.goal,
			templateId: input.templateId,
			templateName: input.templateName,
			canvasPath: input.canvasPath,
			stats: { nodesAdded: 0, nodesModified: 0, edgesAdded: 0 },
			activities: [],
			phases: input.phases ?? [],
			activePhaseIndex: input.phases && input.phases.length > 0 ? 0 : -1,
		};
		this.pushActivity("session-started", `Canvas session started: ${input.goal}`);
		if (this.state.phases.length > 0) {
			this.state.phases[0].visited = true;
		}
		return this.getSnapshot()!;
	}

	/** Returns a readonly snapshot of current state, or null if no session. */
	getSnapshot(): CanvasSessionState | null {
		if (!this.state) return null;
		return { ...this.state, stats: { ...this.state.stats }, activities: [...this.state.activities] };
	}

	/** Returns the session ID, or null. */
	getSessionId(): string | null {
		return this.state?.sessionId ?? null;
	}

	/** Returns true if a session is being monitored. */
	isActive(): boolean {
		return this.state !== null;
	}

	/** Record a node-added operation. */
	recordNodeAdded(detail: string): void {
		if (!this.state) return;
		this.state.stats.nodesAdded++;
		this.pushActivity("node-added", detail);
	}

	/** Record a node-modified operation. */
	recordNodeModified(detail: string): void {
		if (!this.state) return;
		this.state.stats.nodesModified++;
		this.pushActivity("node-modified", detail);
	}

	/** Record an edge-added operation. */
	recordEdgeAdded(detail: string): void {
		if (!this.state) return;
		this.state.stats.edgesAdded++;
		this.pushActivity("edge-added", detail);
	}

	/** Update the session goal. */
	setGoal(goal: string): void {
		if (!this.state) return;
		this.state.goal = goal;
		this.pushActivity("goal-set", `Goal updated: ${goal}`);
	}

	/** Advance to the next phase. Returns the new phase, or null if at end. */
	advancePhase(): CanvasSessionPhase | null {
		if (!this.state || this.state.phases.length === 0) return null;
		const next = this.state.activePhaseIndex + 1;
		if (next >= this.state.phases.length) return null;
		this.state.activePhaseIndex = next;
		this.state.phases[next].visited = true;
		const phase = this.state.phases[next];
		this.pushActivity("phase-changed", `Phase: ${phase.label}`);
		return phase;
	}

	/** Get the currently active phase, or null. */
	getActivePhase(): CanvasSessionPhase | null {
		if (!this.state || this.state.activePhaseIndex < 0) return null;
		return this.state.phases[this.state.activePhaseIndex] ?? null;
	}

	/** Record a pause event. */
	recordPause(): void {
		this.pushActivity("session-paused", "Session paused");
	}

	/** Record a resume event. */
	recordResume(): void {
		this.pushActivity("session-resumed", "Session resumed");
	}

	/** Finalize the session. Returns the final snapshot and clears internal state. */
	complete(): CanvasSessionState | null {
		if (!this.state) return null;
		this.pushActivity("session-completed", "Canvas session completed");
		const final = this.getSnapshot();
		this.state = null;
		return final;
	}

	/** Clears the monitor without completing. */
	dispose(): void {
		this.state = null;
	}

	/** Returns a summary of node stats. */
	getStats(): CanvasSessionStats {
		return this.state
			? { ...this.state.stats }
			: { nodesAdded: 0, nodesModified: 0, edgesAdded: 0 };
	}

	private pushActivity(action: CanvasActivityAction, detail: string): void {
		if (!this.state) return;
		const activity: CanvasActivity = {
			timestamp: new Date().toISOString(),
			action,
			detail,
		};
		this.state.activities.unshift(activity);
		if (this.state.activities.length > MAX_ACTIVITIES) {
			this.state.activities.length = MAX_ACTIVITIES;
		}
	}
}
