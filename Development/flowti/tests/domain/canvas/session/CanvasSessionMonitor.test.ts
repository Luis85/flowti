import { describe, it, expect, beforeEach } from "vitest";
import { CanvasSessionMonitor } from "../../../../src/domain/canvas/session/CanvasSessionMonitor";
import type { CreateCanvasSessionInput } from "../../../../src/domain/canvas/session/CanvasSessionMonitor";
import { MAX_ACTIVITIES } from "../../../../src/domain/canvas/session/types";

function defaultInput(overrides?: Partial<CreateCanvasSessionInput>): CreateCanvasSessionInput {
	return {
		sessionId: "sess-1",
		goal: "Domain modelling",
		templateId: "domain-design",
		templateName: "Domain Design",
		canvasPath: "sessions/dd.canvas",
		...overrides,
	};
}

describe("CanvasSessionMonitor", () => {
	let monitor: CanvasSessionMonitor;

	beforeEach(() => {
		monitor = new CanvasSessionMonitor();
	});

	describe("lifecycle", () => {
		it("starts inactive", () => {
			expect(monitor.isActive()).toBe(false);
			expect(monitor.getSnapshot()).toBeNull();
		});

		it("starts a session and returns initial state", () => {
			const state = monitor.start(defaultInput());
			expect(monitor.isActive()).toBe(true);
			expect(state.sessionId).toBe("sess-1");
			expect(state.goal).toBe("Domain modelling");
			expect(state.templateId).toBe("domain-design");
			expect(state.canvasPath).toBe("sessions/dd.canvas");
		});

		it("records session-started activity on start", () => {
			const state = monitor.start(defaultInput());
			expect(state.activities).toHaveLength(1);
			expect(state.activities[0].action).toBe("session-started");
		});

		it("complete() returns final snapshot and clears state", () => {
			monitor.start(defaultInput());
			const final = monitor.complete();
			expect(final).not.toBeNull();
			expect(final!.activities[final!.activities.length - 1].action).toBe("session-started");
			expect(final!.activities[0].action).toBe("session-completed");
			expect(monitor.isActive()).toBe(false);
		});

		it("complete() returns null when no session", () => {
			expect(monitor.complete()).toBeNull();
		});

		it("dispose() clears without completing", () => {
			monitor.start(defaultInput());
			monitor.dispose();
			expect(monitor.isActive()).toBe(false);
			expect(monitor.getSnapshot()).toBeNull();
		});
	});

	describe("node tracking", () => {
		beforeEach(() => {
			monitor.start(defaultInput());
		});

		it("records node added", () => {
			monitor.recordNodeAdded("Added Actor card");
			const snap = monitor.getSnapshot()!;
			expect(snap.stats.nodesAdded).toBe(1);
			expect(snap.activities[0].action).toBe("node-added");
			expect(snap.activities[0].detail).toBe("Added Actor card");
		});

		it("records node modified", () => {
			monitor.recordNodeModified("Renamed Service card");
			const snap = monitor.getSnapshot()!;
			expect(snap.stats.nodesModified).toBe(1);
			expect(snap.activities[0].action).toBe("node-modified");
		});

		it("records edge added", () => {
			monitor.recordEdgeAdded("Connected Actor to Event");
			const snap = monitor.getSnapshot()!;
			expect(snap.stats.edgesAdded).toBe(1);
			expect(snap.activities[0].action).toBe("edge-added");
		});

		it("accumulates stats across multiple operations", () => {
			monitor.recordNodeAdded("A");
			monitor.recordNodeAdded("B");
			monitor.recordEdgeAdded("C");
			monitor.recordNodeModified("D");
			const stats = monitor.getStats();
			expect(stats.nodesAdded).toBe(2);
			expect(stats.nodesModified).toBe(1);
			expect(stats.edgesAdded).toBe(1);
		});

		it("no-ops when no active session", () => {
			const orphan = new CanvasSessionMonitor();
			orphan.recordNodeAdded("should not crash");
			expect(orphan.getStats().nodesAdded).toBe(0);
		});
	});

	describe("goal", () => {
		it("updates goal and records activity", () => {
			monitor.start(defaultInput());
			monitor.setGoal("New goal");
			const snap = monitor.getSnapshot()!;
			expect(snap.goal).toBe("New goal");
			expect(snap.activities[0].action).toBe("goal-set");
		});
	});

	describe("phase progression", () => {
		const phases = [
			{ id: "actors", label: "Actors", visited: false },
			{ id: "events", label: "Events", visited: false },
			{ id: "services", label: "Services", visited: false },
		];

		it("initialises active phase to first phase", () => {
			monitor.start(defaultInput({ phases }));
			const snap = monitor.getSnapshot()!;
			expect(snap.activePhaseIndex).toBe(0);
			expect(snap.phases[0].visited).toBe(true);
		});

		it("advances to the next phase", () => {
			monitor.start(defaultInput({ phases }));
			const next = monitor.advancePhase();
			expect(next).not.toBeNull();
			expect(next!.id).toBe("events");
			expect(monitor.getSnapshot()!.activePhaseIndex).toBe(1);
		});

		it("returns null when at last phase", () => {
			monitor.start(defaultInput({ phases }));
			monitor.advancePhase(); // events
			monitor.advancePhase(); // services
			const beyond = monitor.advancePhase();
			expect(beyond).toBeNull();
		});

		it("marks visited phases", () => {
			monitor.start(defaultInput({ phases }));
			monitor.advancePhase();
			monitor.advancePhase();
			const snap = monitor.getSnapshot()!;
			expect(snap.phases.every((p) => p.visited)).toBe(true);
		});

		it("getActivePhase returns current phase", () => {
			monitor.start(defaultInput({ phases }));
			expect(monitor.getActivePhase()?.id).toBe("actors");
			monitor.advancePhase();
			expect(monitor.getActivePhase()?.id).toBe("events");
		});

		it("handles no-phase sessions", () => {
			monitor.start(defaultInput({ phases: [] }));
			expect(monitor.getActivePhase()).toBeNull();
			expect(monitor.advancePhase()).toBeNull();
		});
	});

	describe("pause / resume", () => {
		it("records pause and resume activities", () => {
			monitor.start(defaultInput());
			monitor.recordPause();
			monitor.recordResume();
			const snap = monitor.getSnapshot()!;
			expect(snap.activities[0].action).toBe("session-resumed");
			expect(snap.activities[1].action).toBe("session-paused");
		});
	});

	describe("activity feed", () => {
		it("maintains newest-first order", () => {
			monitor.start(defaultInput());
			monitor.recordNodeAdded("First");
			monitor.recordNodeAdded("Second");
			const snap = monitor.getSnapshot()!;
			expect(snap.activities[0].detail).toBe("Second");
			expect(snap.activities[1].detail).toBe("First");
		});

		it("trims activities beyond MAX_ACTIVITIES", () => {
			monitor.start(defaultInput());
			for (let i = 0; i < MAX_ACTIVITIES + 10; i++) {
				monitor.recordNodeAdded(`Node ${i}`);
			}
			const snap = monitor.getSnapshot()!;
			expect(snap.activities.length).toBe(MAX_ACTIVITIES);
		});

		it("each activity has a timestamp", () => {
			monitor.start(defaultInput());
			monitor.recordNodeAdded("test");
			const activity = monitor.getSnapshot()!.activities[0];
			expect(activity.timestamp).toBeTruthy();
			expect(new Date(activity.timestamp).getTime()).not.toBeNaN();
		});
	});

	describe("snapshot isolation", () => {
		it("returns a new object on each call", () => {
			monitor.start(defaultInput());
			const snap1 = monitor.getSnapshot()!;
			const snap2 = monitor.getSnapshot()!;
			expect(snap1).not.toBe(snap2);
			expect(snap1.stats).not.toBe(snap2.stats);
			expect(snap1.activities).not.toBe(snap2.activities);
		});

		it("mutations to snapshot do not affect monitor state", () => {
			monitor.start(defaultInput());
			const snap = monitor.getSnapshot()!;
			snap.stats.nodesAdded = 999;
			expect(monitor.getStats().nodesAdded).toBe(0);
		});
	});
});
