import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { TrainService } from "../../../src/domain/train/TrainService";
import { CaptureService } from "../../../src/domain/capture/CaptureService";
import { createMockStorage } from "../../mocks/storage";
import { createMockFileSystem } from "../../mocks/filesystem";
import type { TrainServiceState } from "../../../src/domain/train/types";
import { MAX_TRAINS, MAX_THOUGHTS_PER_TRAIN } from "../../../src/domain/train/types";

function createTestHarness(initialState?: TrainServiceState) {
	const eventBus: IEventBus = new EventBus();
	const fileSystem = createMockFileSystem();
	const { storage, getData } = createMockStorage<TrainServiceState>(initialState);

	const captureService = new CaptureService({
		eventBus,
		fileSystem,
		getSettings: () => ({ captureFolder: "00 - Connectivity/inbox" }),
	});

	// Wire up session.create → session.created handler (simulates SessionService)
	eventBus.on("session.create", (event) => {
		const sessionId = `session_mock_${Date.now()}`;
		void eventBus.emit("session.created", {
			session: {
				id: sessionId,
				type: event.payload.type,
				title: event.payload.title,
				status: "prepared",
				durationMinutes: 0,
				createdAt: new Date().toISOString(),
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
			},
		});
	});

	const service = new TrainService({
		storage,
		eventBus,
		fileSystem,
		captureService,
	});

	return { service, eventBus, fileSystem, storage, getData };
}

describe("TrainService", () => {
	describe("load()", () => {
		it("loads persisted state", async () => {
			const existingState: TrainServiceState = {
				trains: [{
					id: "train_123",
					sessionId: "session_456",
					title: "Test Train",
					status: "completed",
					thoughts: [],
					relations: [],
					createdAt: "2026-02-21T10:00:00.000Z",
					pausedAt: null,
					completedAt: "2026-02-21T11:00:00.000Z",
				}],
			};
			const { service } = createTestHarness(existingState);
			await service.load();
			expect(service.getAllTrains()).toHaveLength(1);
			expect(service.getAllTrains()[0].title).toBe("Test Train");
		});

		it("handles empty storage", async () => {
			const { service } = createTestHarness();
			await service.load();
			expect(service.getAllTrains()).toHaveLength(0);
		});
	});

	describe("startTrain()", () => {
		it("creates a session via event and returns a running train", async () => {
			const { service, eventBus } = createTestHarness();
			const emitted: string[] = [];
			eventBus.on("train.started", () => { emitted.push("train.started"); });

			const train = await service.startTrain("My Thoughts");

			expect(train.title).toBe("My Thoughts");
			expect(train.status).toBe("running");
			expect(train.id).toMatch(/^train_/);
			expect(train.sessionId).toMatch(/^session_/);
			expect(train.thoughts).toHaveLength(0);
			expect(emitted).toContain("train.started");
		});

		it("persists state after starting", async () => {
			const { service, getData } = createTestHarness();
			await service.startTrain("Persisted Train");
			expect(getData()?.trains).toHaveLength(1);
		});

		it("emits session.start after creating session", async () => {
			const { service, eventBus } = createTestHarness();
			const startPayloads: Array<{ sessionId: string }> = [];
			eventBus.on("session.start", (e) => { startPayloads.push(e.payload); });

			await service.startTrain("Start Test");

			expect(startPayloads).toHaveLength(1);
			expect(startPayloads[0].sessionId).toMatch(/^session_/);
		});

		it("evicts oldest train when at MAX_TRAINS capacity", async () => {
			const trains = Array.from({ length: MAX_TRAINS }, (_, i) => ({
				id: `train_${i}`,
				sessionId: `session_${i}`,
				title: `Train ${i}`,
				status: "completed" as const,
				thoughts: [],
				relations: [],
				createdAt: new Date(2026, 0, 1 + i).toISOString(),
				pausedAt: null,
				completedAt: null,
			}));
			const { service } = createTestHarness({ trains });
			await service.load();

			const newTrain = await service.startTrain("Overflow Train");

			expect(service.getAllTrains()).toHaveLength(MAX_TRAINS);
			expect(service.getAllTrains()[0].id).toBe("train_1"); // train_0 evicted
			expect(newTrain.title).toBe("Overflow Train");
		});
	});

	describe("addThought()", () => {
		it("creates a note and returns a thought node", async () => {
			const { service, eventBus } = createTestHarness();
			const train = await service.startTrain("Thought Test");

			const thoughtEvents: Array<{ trainId: string; previousTitle: string | null }> = [];
			eventBus.on("train.thought.added", (e) => { thoughtEvents.push(e.payload); });

			const thought = await service.addThought(train.id, "First Idea");

			expect(thought).not.toBeNull();
			expect(thought!.title).toBe("First Idea");
			expect(thought!.order).toBe(0);
			expect(thought!.trainId).toBe(train.id);
			expect(thought!.path).toContain("First Idea.md");
			expect(thoughtEvents).toHaveLength(1);
			expect(thoughtEvents[0].previousTitle).toBeNull();
		});

		it("links second thought to first with a relation", async () => {
			const { service, eventBus } = createTestHarness();
			const train = await service.startTrain("Linking Test");

			await service.addThought(train.id, "Thought A");

			const events: Array<{ previousTitle: string | null }> = [];
			eventBus.on("train.thought.added", (e) => { events.push(e.payload); });

			const thoughtB = await service.addThought(train.id, "Thought B");

			expect(thoughtB!.order).toBe(1);
			expect(events[0].previousTitle).toBe("Thought A");

			const updatedTrain = service.getTrain(train.id)!;
			expect(updatedTrain.relations).toHaveLength(1);
			expect(updatedTrain.relations[0].type).toBe("next");
		});

		it("updates frontmatter on thought notes", async () => {
			const { service, fileSystem } = createTestHarness();
			const train = await service.startTrain("FM Test");

			await service.addThought(train.id, "First");
			await service.addThought(train.id, "Second");

			// Allow fire-and-forget promises to settle
			await vi.waitFor(() => {
				expect(fileSystem.updateFrontmatter).toHaveBeenCalled();
			});

			const calls = (fileSystem.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls;
			// First thought: train-session + thought-order
			const firstCall = calls.find((c: unknown[]) =>
				(c[1] as Record<string, unknown>)["thought-order"] === 0
			);
			expect(firstCall).toBeDefined();
			expect((firstCall![1] as Record<string, unknown>)["train-session"]).toBe("FM Test");

			// Second thought: includes previous-thought link
			const secondCall = calls.find((c: unknown[]) =>
				(c[1] as Record<string, unknown>)["thought-order"] === 1
			);
			expect(secondCall).toBeDefined();
			expect((secondCall![1] as Record<string, unknown>)["previous-thought"]).toBe("[[First]]");
		});

		it("returns null for non-existent train", async () => {
			const { service } = createTestHarness();
			const result = await service.addThought("nonexistent", "Test");
			expect(result).toBeNull();
		});

		it("returns null for paused train", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Paused Train");
			await service.pause(train.id);

			const result = await service.addThought(train.id, "Should Fail");
			expect(result).toBeNull();
		});

		it("returns null when thought limit is reached", async () => {
			const thoughts = Array.from({ length: MAX_THOUGHTS_PER_TRAIN }, (_, i) => ({
				id: `thought_${i}`,
				trainId: "train_full",
				title: `Thought ${i}`,
				path: `inbox/Thought ${i}.md`,
				createdAt: new Date().toISOString(),
				order: i,
			}));
			const { service } = createTestHarness({
				trains: [{
					id: "train_full",
					sessionId: "session_full",
					title: "Full Train",
					status: "running",
					thoughts,
					relations: [],
					createdAt: new Date().toISOString(),
					pausedAt: null,
					completedAt: null,
				}],
			});
			await service.load();

			const result = await service.addThought("train_full", "Overflow");
			expect(result).toBeNull();
		});
	});

	describe("pause()", () => {
		it("pauses a running train and emits events", async () => {
			const { service, eventBus } = createTestHarness();
			const train = await service.startTrain("Pause Test");

			const paused: string[] = [];
			const sessionPaused: string[] = [];
			eventBus.on("train.paused", () => { paused.push("paused"); });
			eventBus.on("session.pause", (e) => { sessionPaused.push(e.payload.sessionId); });

			const result = await service.pause(train.id);

			expect(result).toBe(true);
			expect(service.getTrain(train.id)!.status).toBe("paused");
			expect(service.getTrain(train.id)!.pausedAt).not.toBeNull();
			expect(paused).toHaveLength(1);
			expect(sessionPaused).toHaveLength(1);
		});

		it("returns false for non-running train", async () => {
			const { service } = createTestHarness();
			const result = await service.pause("nonexistent");
			expect(result).toBe(false);
		});

		it("returns false for already paused train", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Double Pause");
			await service.pause(train.id);
			const result = await service.pause(train.id);
			expect(result).toBe(false);
		});
	});

	describe("resume()", () => {
		it("resumes a paused train and emits events", async () => {
			const { service, eventBus } = createTestHarness();
			const train = await service.startTrain("Resume Test");
			await service.pause(train.id);

			const resumed: string[] = [];
			eventBus.on("train.resumed", () => { resumed.push("resumed"); });

			const result = await service.resume(train.id);

			expect(result).toBe(true);
			expect(service.getTrain(train.id)!.status).toBe("running");
			expect(service.getTrain(train.id)!.pausedAt).toBeNull();
			expect(resumed).toHaveLength(1);
		});

		it("returns false for running train", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Running Resume");
			const result = await service.resume(train.id);
			expect(result).toBe(false);
		});
	});

	describe("getActiveTrain()", () => {
		it("returns running train", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Active");
			expect(service.getActiveTrain()?.id).toBe(train.id);
		});

		it("returns paused train", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Will Pause");
			await service.pause(train.id);
			expect(service.getActiveTrain()?.id).toBe(train.id);
		});

		it("returns undefined when no active train", async () => {
			const { service } = createTestHarness();
			expect(service.getActiveTrain()).toBeUndefined();
		});
	});
});
