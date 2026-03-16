import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventBus } from "../../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../../src/infrastructure/events/types";
import { registerTrainEventHandlers, type TrainHandlerContext } from "../../../../src/domain/train/handlers/train-event-handlers";
import type { TrainState } from "../../../../src/domain/train/types";

function makeTrain(overrides: Partial<TrainState> = {}): TrainState {
	return {
		id: "train_1",
		sessionId: "session_1",
		title: "Test Train",
		status: "running",
		thoughts: [{ id: "t1" }, { id: "t2" }] as TrainState["thoughts"],
		relations: [],
		createdAt: "2026-03-16T10:00:00Z",
		completedAt: null,
		pausedAt: null,
		folderPath: "trains/test",
		parentTrainId: null,
		trainType: "exploration",
		branches: [],
		...overrides,
	};
}

function makeSession(id: string) {
	return {
		id,
		type: "train",
		title: "Test",
		status: "active",
		durationMinutes: 0,
		createdAt: "2026-03-16T10:00:00Z",
		startedAt: null,
		pausedAt: null,
		elapsedBeforePauseMs: 0,
		completedAt: null,
		artifacts: [],
		notes: "",
		focusFile: null,
		timeline: [],
		goals: [],
		links: [],
		notesFile: null,
		canvasFile: null,
		activity: [],
		activityFilter: [],
		contextBindings: [],
		decisions: [],
		workspaceState: null,
		outputArtifacts: [],
		intent: null,
		energy: null,
		executionTasks: [],
		reflections: [],
		closureResponse: null,
		featureName: null,
	};
}

describe("registerTrainEventHandlers", () => {
	let eventBus: IEventBus;
	let trains: TrainState[];
	let ctx: TrainHandlerContext;

	beforeEach(() => {
		eventBus = new EventBus();
		trains = [makeTrain()];
		ctx = {
			trains: () => trains,
			findBySessionId: (sid) => trains.find((t) => t.sessionId === sid),
			persist: vi.fn().mockResolvedValue(undefined),
			writeSummary: vi.fn().mockResolvedValue(undefined),
			eventBus,
		};
		registerTrainEventHandlers(ctx);
	});

	describe("session.completed", () => {
		it("completes the linked train when session completes", async () => {
			await eventBus.emit("session.completed", { session: makeSession("session_1") });

			expect(trains[0].status).toBe("completed");
			expect(trains[0].completedAt).toBeTruthy();
			expect(ctx.persist).toHaveBeenCalled();
			expect(ctx.writeSummary).toHaveBeenCalledWith(trains[0]);
		});

		it("ignores already-completed trains", async () => {
			trains[0].status = "completed";
			await eventBus.emit("session.completed", { session: makeSession("session_1") });

			expect(ctx.persist).not.toHaveBeenCalled();
		});

		it("ignores events for unknown sessions", async () => {
			await eventBus.emit("session.completed", { session: makeSession("unknown") });

			expect(trains[0].status).toBe("running");
			expect(ctx.persist).not.toHaveBeenCalled();
		});
	});

	describe("session.resumed", () => {
		it("resumes the linked train when session resumes", async () => {
			trains[0].status = "paused";
			trains[0].pausedAt = "2026-03-16T10:30:00Z";
			await eventBus.emit("session.resumed", { session: makeSession("session_1") });

			expect(trains[0].status).toBe("running");
			expect(trains[0].pausedAt).toBeNull();
			expect(ctx.persist).toHaveBeenCalled();
		});

		it("ignores non-paused trains", async () => {
			trains[0].status = "running";
			await eventBus.emit("session.resumed", { session: makeSession("session_1") });

			expect(ctx.persist).not.toHaveBeenCalled();
		});

		it("ignores events for unknown sessions", async () => {
			trains[0].status = "paused";
			await eventBus.emit("session.resumed", { session: makeSession("unknown") });

			expect(trains[0].status).toBe("paused");
		});
	});

	describe("session.paused", () => {
		it("pauses the linked train when session pauses", async () => {
			await eventBus.emit("session.paused", { session: makeSession("session_1") });

			expect(trains[0].status).toBe("paused");
			expect(trains[0].pausedAt).toBeTruthy();
			expect(ctx.persist).toHaveBeenCalled();
		});

		it("ignores non-running trains", async () => {
			trains[0].status = "completed";
			await eventBus.emit("session.paused", { session: makeSession("session_1") });

			expect(ctx.persist).not.toHaveBeenCalled();
		});

		it("ignores events for unknown sessions", async () => {
			await eventBus.emit("session.paused", { session: makeSession("unknown") });

			expect(trains[0].status).toBe("running");
		});
	});
});
