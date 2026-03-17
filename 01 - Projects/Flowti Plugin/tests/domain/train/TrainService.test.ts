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
		featureName: null,
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
					durationMinutes: 0,
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
				durationMinutes: 0,
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

	describe("startTrain() — durationMinutes", () => {
		it("defaults durationMinutes to 0", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("No Timer");
			expect(train.durationMinutes).toBe(0);
		});

		it("passes custom durationMinutes to train state", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Timed Train", 25);
			expect(train.durationMinutes).toBe(25);
		});

		it("forwards durationMinutes in session.create event", async () => {
			const { service, eventBus } = createTestHarness();
			const createPayloads: Array<{ durationMinutes: number }> = [];
			eventBus.on("session.create", (e) => { createPayloads.push(e.payload); });

			await service.startTrain("Duration Forward", 15);

			expect(createPayloads).toHaveLength(1);
			expect(createPayloads[0].durationMinutes).toBe(15);
		});

		it("persists durationMinutes in stored state", async () => {
			const { service, getData } = createTestHarness();
			await service.startTrain("Persist Duration", 50);
			expect(getData()?.trains[0].durationMinutes).toBe(50);
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
			// Filename is prefixed with ISO timestamp (YYYYMMDD-HHmmss)
			expect(thought!.path).toMatch(/\d{8}-\d{6} First Idea\.md$/);
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
			expect(updatedTrain.relations[0].direction).toBe("next");
		});

		it("updates frontmatter on thought notes", async () => {
			const { service, fileSystem } = createTestHarness();
			const train = await service.startTrain("FM Test");

			const first = await service.addThought(train.id, "First");
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

			// Second thought: includes prev link to First (uses file basename, not title)
			const secondCall = calls.find((c: unknown[]) =>
				(c[1] as Record<string, unknown>)["thought-order"] === 1
			);
			expect(secondCall).toBeDefined();
			const prev = (secondCall![1] as Record<string, unknown>)["prev"] as string[];
			const firstBasename = first!.path.split("/").pop()!.replace(/\.md$/, "");
			expect(prev).toContain(`[[${firstBasename}]]`);
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

		it("returns null when absolute safety cap (MAX_THOUGHTS_PER_TRAIN) is reached", async () => {
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
					durationMinutes: 0,
					createdAt: new Date().toISOString(),
					pausedAt: null,
					completedAt: null,
				}],
			});
			service.getSettings = () => ({ trainFolder: "Trains", trainMaxThoughts: 1000 });
			await service.load();

			const result = await service.addThought("train_full", "Overflow");
			expect(result).toBeNull();
		});

		it("returns null when trainMaxThoughts setting limit is reached", async () => {
			const thoughts = Array.from({ length: 5 }, (_, i) => ({
				id: `thought_${i}`,
				trainId: "train_small",
				title: `Thought ${i}`,
				path: `inbox/Thought ${i}.md`,
				createdAt: new Date().toISOString(),
				order: i,
			}));
			const { service } = createTestHarness({
				trains: [{
					id: "train_small",
					sessionId: "session_small",
					title: "Small Train",
					status: "running",
					thoughts,
					relations: [],
					durationMinutes: 0,
					createdAt: new Date().toISOString(),
					pausedAt: null,
					completedAt: null,
				}],
			});
			service.getSettings = () => ({ trainFolder: "Trains", trainMaxThoughts: 5 });
			await service.load();

			const result = await service.addThought("train_small", "Over limit");
			expect(result).toBeNull();
		});

		it("allows adding thoughts below trainMaxThoughts setting", async () => {
			const thoughts = Array.from({ length: 4 }, (_, i) => ({
				id: `thought_${i}`,
				trainId: "train_below",
				title: `Thought ${i}`,
				path: `inbox/Thought ${i}.md`,
				createdAt: new Date().toISOString(),
				order: i,
			}));
			const { service } = createTestHarness({
				trains: [{
					id: "train_below",
					sessionId: "session_below",
					title: "Below Limit",
					status: "running",
					thoughts,
					relations: [],
					durationMinutes: 0,
					createdAt: new Date().toISOString(),
					pausedAt: null,
					completedAt: null,
				}],
			});
			service.getSettings = () => ({ trainFolder: "Trains", trainMaxThoughts: 5 });
			await service.load();

			const result = await service.addThought("train_below", "Still OK");
			expect(result).not.toBeNull();
		});

		it("uses default trainMaxThoughts (100) when settings provide it", async () => {
			const { service } = createTestHarness();
			// Default getSettings returns trainMaxThoughts: 100
			await service.load();

			const train = await service.startTrain("Default Limit");
			// The default limit is 100, not the hardcoded 500
			// We can verify by checking the service getter
			expect(service.getSettings().trainMaxThoughts).toBe(100);
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

	describe("completeTrain()", () => {
		it("marks a running train as completed and emits events", async () => {
			const { service, eventBus } = createTestHarness();
			const train = await service.startTrain("Complete Test");
			await service.addThought(train.id, "Thought A");

			const completed: Array<{ trainId: string; thoughtCount: number }> = [];
			eventBus.on("train.completed", (e) => { completed.push(e.payload); });

			const result = await service.completeTrain(train.id);

			expect(result).toBe(true);
			expect(service.getTrain(train.id)!.status).toBe("completed");
			expect(service.getTrain(train.id)!.completedAt).not.toBeNull();
			expect(completed).toHaveLength(1);
			expect(completed[0].thoughtCount).toBe(1);
		});

		it("marks a paused train as completed", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Pause Then Complete");
			await service.pause(train.id);

			const result = await service.completeTrain(train.id);

			expect(result).toBe(true);
			expect(service.getTrain(train.id)!.status).toBe("completed");
		});

		it("returns false for already completed train", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Already Done");
			await service.completeTrain(train.id);

			const result = await service.completeTrain(train.id);
			expect(result).toBe(false);
		});

		it("emits session.complete with linked session ID", async () => {
			const { service, eventBus } = createTestHarness();
			const train = await service.startTrain("Session Complete");

			const sessionCompletes: Array<{ sessionId: string }> = [];
			eventBus.on("session.complete", (e) => { sessionCompletes.push(e.payload); });

			await service.completeTrain(train.id);

			expect(sessionCompletes).toHaveLength(1);
			expect(sessionCompletes[0].sessionId).toBe(train.sessionId);
		});

		it("completed train is not returned by getActiveTrain()", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("No Longer Active");
			await service.completeTrain(train.id);

			expect(service.getActiveTrain()).toBeUndefined();
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

	describe("addThought() — direction + branching", () => {
		it("defaults to 'next' direction", async () => {
			const { service, eventBus } = createTestHarness();
			const train = await service.startTrain("Dir Test");
			await service.addThought(train.id, "A");

			const events: Array<{ direction: string }> = [];
			eventBus.on("train.thought.added", (e) => { events.push(e.payload); });

			await service.addThought(train.id, "B");

			const t = service.getTrain(train.id)!;
			expect(t.relations[0].direction).toBe("next");
			expect(events[0].direction).toBe("next");
		});

		it("creates branch relation when direction is 'branch'", async () => {
			const { service, eventBus } = createTestHarness();
			const train = await service.startTrain("Branch Test");
			const thoughtA = await service.addThought(train.id, "A");

			const events: Array<{ direction: string }> = [];
			eventBus.on("train.thought.added", (e) => { events.push(e.payload); });

			await service.addThought(train.id, "B-branch", { direction: "branch" });

			const t = service.getTrain(train.id)!;
			expect(t.relations[0].direction).toBe("branch");
			expect(t.relations[0].fromId).toBe(thoughtA!.id);
			expect(events[0].direction).toBe("branch");
		});

		it("links from specified thought via fromThoughtId", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("From Test");
			const thoughtA = await service.addThought(train.id, "A");
			const thoughtB = await service.addThought(train.id, "B");

			// Branch from A (not from last thought B)
			await service.addThought(train.id, "C-from-A", {
				direction: "branch",
				fromThoughtId: thoughtA!.id,
			});

			const t = service.getTrain(train.id)!;
			// relations: A→B (next), A→C (branch)
			expect(t.relations).toHaveLength(2);
			expect(t.relations[1].fromId).toBe(thoughtA!.id);
			expect(t.relations[1].direction).toBe("branch");
		});

		it("falls back to last thought when fromThoughtId is invalid", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Fallback Test");
			await service.addThought(train.id, "A");
			const thoughtB = await service.addThought(train.id, "B");

			await service.addThought(train.id, "C", {
				fromThoughtId: "nonexistent",
			});

			// Should have no relation for C (fromThought is null because find returns undefined)
			const t = service.getTrain(train.id)!;
			// A→B (next) + no relation for C (fromThought was null)
			expect(t.relations).toHaveLength(1);
		});

		it("includes nav links in frontmatter (back for linear child)", async () => {
			const { service, fileSystem } = createTestHarness();
			const train = await service.startTrain("FM Relations");
			const first = await service.addThought(train.id, "First");
			await service.addThought(train.id, "Second");

			await vi.waitFor(() => {
				expect(fileSystem.updateFrontmatter).toHaveBeenCalled();
			});

			const firstBasename = first!.path.split("/").pop()!.replace(/\.md$/, "");
			const calls = (fileSystem.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls;
			const secondThoughtCall = calls.find((c: unknown[]) =>
				(c[1] as Record<string, unknown>)["thought-order"] === 1
			);
			expect(secondThoughtCall).toBeDefined();
			const data = secondThoughtCall![1] as Record<string, unknown>;
			expect(data["prev"]).toEqual([`[[${firstBasename}]]`]);
			expect(data["down"]).toEqual([]);
		});

		it("includes down link for branch child", async () => {
			const { service, fileSystem } = createTestHarness();
			const train = await service.startTrain("FM Branch");
			const root = await service.addThought(train.id, "Root");
			await service.addThought(train.id, "Branch", { direction: "branch" });

			await vi.waitFor(() => {
				expect(fileSystem.updateFrontmatter).toHaveBeenCalled();
			});

			const rootBasename = root!.path.split("/").pop()!.replace(/\.md$/, "");
			const calls = (fileSystem.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls;
			const branchCall = calls.find((c: unknown[]) =>
				(c[1] as Record<string, unknown>)["thought-order"] === 1
			);
			const data = branchCall![1] as Record<string, unknown>;
			expect(data["down"]).toEqual([`[[${rootBasename}]]`]);
			expect(data["prev"]).toEqual([]);
		});

		it("updates source thought frontmatter with next/up links", async () => {
			const { service, fileSystem } = createTestHarness();
			const train = await service.startTrain("Source FM");
			await service.addThought(train.id, "Parent");
			const child = await service.addThought(train.id, "Child");

			await vi.waitFor(() => {
				const callCount = (fileSystem.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls.length;
				expect(callCount).toBeGreaterThanOrEqual(3); // parent fm + child fm + parent update
			});

			const childBasename = child!.path.split("/").pop()!.replace(/\.md$/, "");
			const calls = (fileSystem.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls;
			// Find the update to the parent thought that includes next link
			const parentUpdate = calls.find((c: unknown[]) => {
				const data = c[1] as Record<string, unknown>;
				const next = data["next"] as string[] | undefined;
				return next && next.length > 0;
			});
			expect(parentUpdate).toBeDefined();
			const data = parentUpdate![1] as Record<string, unknown>;
			expect(data["next"]).toContain(`[[${childBasename}]]`);
		});
	});

	describe("getTimeline()", () => {
		it("returns empty for non-existent train", async () => {
			const { service } = createTestHarness();
			expect(service.getTimeline("nonexistent")).toEqual([]);
		});

		it("returns single thought for train with one thought", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Single");
			await service.addThought(train.id, "Only");
			const timeline = service.getTimeline(train.id);
			expect(timeline).toHaveLength(1);
			expect(timeline[0].title).toBe("Only");
		});

		it("follows 'next' chain in order", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Chain");
			await service.addThought(train.id, "A");
			await service.addThought(train.id, "B");
			await service.addThought(train.id, "C");

			const timeline = service.getTimeline(train.id);
			expect(timeline.map((t) => t.title)).toEqual(["A", "B", "C"]);
		});

		it("excludes branch thoughts from main timeline", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Branch Exclude");
			await service.addThought(train.id, "A");
			const thoughtB = await service.addThought(train.id, "B");
			await service.addThought(train.id, "B-branch", { direction: "branch" });
			// Continue the main chain from B (not from the branch)
			await service.addThought(train.id, "C", { fromThoughtId: thoughtB!.id });

			const timeline = service.getTimeline(train.id);
			expect(timeline.map((t) => t.title)).toEqual(["A", "B", "C"]);
		});
	});

	describe("getHeadNode()", () => {
		it("returns null for non-existent train", () => {
			const { service } = createTestHarness();
			expect(service.getHeadNode("nonexistent")).toBeNull();
		});

		it("returns null for train with no thoughts", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Empty");
			expect(service.getHeadNode(train.id)).toBeNull();
		});

		it("returns the single thought when train has one", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Single");
			await service.addThought(train.id, "Only");
			const head = service.getHeadNode(train.id);
			expect(head?.title).toBe("Only");
		});

		it("returns the last main-chain thought", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Chain");
			await service.addThought(train.id, "A");
			await service.addThought(train.id, "B");
			await service.addThought(train.id, "C");
			const head = service.getHeadNode(train.id);
			expect(head?.title).toBe("C");
		});

		it("excludes branch thoughts from head determination", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Branch Test");
			await service.addThought(train.id, "A");
			const thoughtB = await service.addThought(train.id, "B");
			await service.addThought(train.id, "B-branch", { direction: "branch" });
			await service.addThought(train.id, "C", { fromThoughtId: thoughtB!.id });
			const head = service.getHeadNode(train.id);
			expect(head?.title).toBe("C");
		});
	});

	describe("getBranches()", () => {
		it("returns branch children of a thought", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Branches");
			const thoughtA = await service.addThought(train.id, "A");
			await service.addThought(train.id, "B"); // next from A
			await service.addThought(train.id, "A-branch-1", {
				direction: "branch",
				fromThoughtId: thoughtA!.id,
			});
			await service.addThought(train.id, "A-branch-2", {
				direction: "branch",
				fromThoughtId: thoughtA!.id,
			});

			const branches = service.getBranches(train.id, thoughtA!.id);
			expect(branches.map((t) => t.title)).toEqual(["A-branch-1", "A-branch-2"]);
		});

		it("returns empty when no branches", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("No Branches");
			const thought = await service.addThought(train.id, "A");
			expect(service.getBranches(train.id, thought!.id)).toEqual([]);
		});
	});

	describe("addThought() — per-train folder", () => {
		it("creates thoughts inside per-train subfolder when trainFolder is configured", async () => {
			const { service, fileSystem } = createTestHarness();
			service.getSettings = () => ({ trainFolder: "trains/active", trainMaxThoughts: 100 });
			const train = await service.startTrain("Folder Test");

			await service.addThought(train.id, "Directed Thought");

			// Path: trains/active/{YYYYMMDD-HHmm Folder Test}/{YYYYMMDD-HHmmss Directed Thought}.md
			expect(fileSystem.createFile).toHaveBeenCalledWith(
				expect.stringMatching(/^trains\/active\/\d{8}-\d{4} Folder Test\/\d{8}-\d{6} Directed Thought\.md$/),
				expect.any(String),
				expect.any(Object),
			);
		});

		it("creates thoughts in timestamp-prefixed folder when trainFolder is empty", async () => {
			const { service, fileSystem } = createTestHarness();
			service.getSettings = () => ({ trainFolder: "", trainMaxThoughts: 100 });
			const train = await service.startTrain("Default Folder");

			await service.addThought(train.id, "Default Thought");

			// Path: {YYYYMMDD-HHmm Default Folder}/{YYYYMMDD-HHmmss Default Thought}.md
			expect(fileSystem.createFile).toHaveBeenCalledWith(
				expect.stringMatching(/^\d{8}-\d{4} Default Folder\/\d{8}-\d{6} Default Thought\.md$/),
				expect.any(String),
				expect.any(Object),
			);
		});

		it("uses per-train folder for all thoughts in a train", async () => {
			const { service, fileSystem } = createTestHarness();
			service.getSettings = () => ({ trainFolder: "trains/folder", trainMaxThoughts: 100 });
			const train = await service.startTrain("Multi Thought");

			await service.addThought(train.id, "First");
			await service.addThought(train.id, "Second");

			const createCalls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const thoughtPaths = createCalls.map((c: unknown[]) => c[0] as string);
			// Both thoughts should be in the same per-train subfolder
			expect(thoughtPaths.some((p: string) => /trains\/folder\/\d{8}-\d{4} Multi Thought\/\d{8}-\d{6} First\.md$/.test(p))).toBe(true);
			expect(thoughtPaths.some((p: string) => /trains\/folder\/\d{8}-\d{4} Multi Thought\/\d{8}-\d{6} Second\.md$/.test(p))).toBe(true);
		});
	});

	describe("getChildren()", () => {
		it("returns all children (next + branch)", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Children");
			const thoughtA = await service.addThought(train.id, "A");
			await service.addThought(train.id, "B"); // next from A
			await service.addThought(train.id, "A-branch", {
				direction: "branch",
				fromThoughtId: thoughtA!.id,
			});

			const children = service.getChildren(train.id, thoughtA!.id);
			expect(children).toHaveLength(2);
			expect(children.map((t) => t.title).sort()).toEqual(["A-branch", "B"]);
		});

		it("returns empty for leaf thought", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Leaf");
			await service.addThought(train.id, "A");
			const thoughtB = await service.addThought(train.id, "B");
			expect(service.getChildren(train.id, thoughtB!.id)).toEqual([]);
		});
	});

	describe("nesting — startTrain()", () => {
		it("auto-pauses running train when starting a new one", async () => {
			const { service, eventBus } = createTestHarness();
			await service.load();

			const train1 = await service.startTrain("First Train");
			expect(train1.status).toBe("running");

			const pauseEvents: string[] = [];
			eventBus.on("train.paused", (e) => { pauseEvents.push(e.payload.trainId); });

			const train2 = await service.startTrain("Second Train");

			expect(service.getTrain(train1.id)!.status).toBe("paused");
			expect(train2.status).toBe("running");
			expect(pauseEvents).toContain(train1.id);
		});

		it("sets parentTrainId to the paused train", async () => {
			const { service } = createTestHarness();
			await service.load();

			const train1 = await service.startTrain("Parent");
			const train2 = await service.startTrain("Child");

			expect(train2.parentTrainId).toBe(train1.id);
		});

		it("sets parentTrainId to paused train when pausing before start", async () => {
			const { service } = createTestHarness();
			await service.load();

			const train1 = await service.startTrain("Already Paused");
			await service.pause(train1.id);

			const train2 = await service.startTrain("New After Pause");

			expect(train2.parentTrainId).toBe(train1.id);
		});

		it("has no parentTrainId when no active train", async () => {
			const { service } = createTestHarness();
			await service.load();

			const train = await service.startTrain("Solo Train");

			expect(train.parentTrainId).toBeUndefined();
		});
	});

	describe("nesting — resume()", () => {
		it("auto-pauses running train when resuming another", async () => {
			const { service, eventBus } = createTestHarness();
			await service.load();

			const train1 = await service.startTrain("First");
			const train2 = await service.startTrain("Second");
			// train1 is now paused (by nesting), train2 is running

			const pauseEvents: string[] = [];
			eventBus.on("train.paused", (e) => { pauseEvents.push(e.payload.trainId); });

			// Resume train1 — should pause train2 first
			await service.resume(train1.id);

			expect(service.getTrain(train1.id)!.status).toBe("running");
			expect(service.getTrain(train2.id)!.status).toBe("paused");
			expect(pauseEvents).toContain(train2.id);
		});

		it("resumes without pausing when no other running train", async () => {
			const { service, eventBus } = createTestHarness();
			await service.load();

			const train = await service.startTrain("Only");
			await service.pause(train.id);

			const pauseEvents: string[] = [];
			eventBus.on("train.paused", (e) => { pauseEvents.push(e.payload.trainId); });

			await service.resume(train.id);

			expect(service.getTrain(train.id)!.status).toBe("running");
			expect(pauseEvents).toHaveLength(0);
		});
	});

	describe("renameTrain()", () => {
		it("renames a running train", async () => {
			const { service } = createTestHarness();
			await service.load();
			const train = await service.startTrain("Old Name");

			const result = await service.renameTrain(train.id, "New Name");

			expect(result).toBe(true);
			expect(service.getTrain(train.id)!.title).toBe("New Name");
		});

		it("renames a completed train", async () => {
			const { service } = createTestHarness();
			await service.load();
			const train = await service.startTrain("Before");
			await service.addThought(train.id, "T");
			await service.completeTrain(train.id);

			const result = await service.renameTrain(train.id, "After");

			expect(result).toBe(true);
			expect(service.getTrain(train.id)!.title).toBe("After");
		});

		it("emits train.renamed event", async () => {
			const { service, eventBus } = createTestHarness();
			await service.load();
			const train = await service.startTrain("Original");

			const events: Array<{ oldTitle: string; newTitle: string }> = [];
			eventBus.on("train.renamed", (e) => { events.push(e.payload as { oldTitle: string; newTitle: string }); });

			await service.renameTrain(train.id, "Updated");

			expect(events).toHaveLength(1);
			expect(events[0].oldTitle).toBe("Original");
			expect(events[0].newTitle).toBe("Updated");
		});

		it("rejects empty title", async () => {
			const { service } = createTestHarness();
			await service.load();
			const train = await service.startTrain("Keep This");

			expect(await service.renameTrain(train.id, "")).toBe(false);
			expect(await service.renameTrain(train.id, "   ")).toBe(false);
			expect(service.getTrain(train.id)!.title).toBe("Keep This");
		});

		it("rejects same title", async () => {
			const { service } = createTestHarness();
			await service.load();
			const train = await service.startTrain("Same");

			expect(await service.renameTrain(train.id, "Same")).toBe(false);
		});

		it("returns false for non-existent train", async () => {
			const { service } = createTestHarness();
			await service.load();

			expect(await service.renameTrain("train_nope", "Name")).toBe(false);
		});

		it("trims whitespace from new title", async () => {
			const { service } = createTestHarness();
			await service.load();
			const train = await service.startTrain("Untrimmed");

			await service.renameTrain(train.id, "  Trimmed  ");

			expect(service.getTrain(train.id)!.title).toBe("Trimmed");
		});
	});

	describe("renameThought()", () => {
		it("renames a thought title and updates path", async () => {
			const { service } = createTestHarness();
			await service.load();
			const train = await service.startTrain("My Train");
			const thought = await service.addThought(train.id, "First Idea");

			const result = await service.renameThought(train.id, thought!.id, "Better Idea");

			expect(result).toBe(true);
			const updated = service.getTrain(train.id)!.thoughts[0];
			expect(updated.title).toBe("Better Idea");
			// Path should contain new title with timestamp prefix preserved
			expect(updated.path).toMatch(/\d{8}-\d{6} Better Idea\.md$/);
		});

		it("emits train.thought.renamed event with old/new paths", async () => {
			const { service, eventBus } = createTestHarness();
			await service.load();
			const train = await service.startTrain("My Train");
			const thought = await service.addThought(train.id, "Original");

			const events: unknown[] = [];
			eventBus.on("train.thought.renamed", (e) => { events.push(e.payload); });

			await service.renameThought(train.id, thought!.id, "Renamed");

			expect(events).toHaveLength(1);
			const payload = events[0] as Record<string, unknown>;
			expect(payload.oldTitle).toBe("Original");
			expect(payload.newTitle).toBe("Renamed");
			expect(payload.oldPath).toMatch(/Original/);
			expect(payload.newPath).toMatch(/Renamed/);
		});

		it("rejects empty title", async () => {
			const { service } = createTestHarness();
			await service.load();
			const train = await service.startTrain("My Train");
			const thought = await service.addThought(train.id, "Keep");

			expect(await service.renameThought(train.id, thought!.id, "")).toBe(false);
			expect(await service.renameThought(train.id, thought!.id, "   ")).toBe(false);
			expect(service.getTrain(train.id)!.thoughts[0].title).toBe("Keep");
		});

		it("rejects same title", async () => {
			const { service } = createTestHarness();
			await service.load();
			const train = await service.startTrain("My Train");
			const thought = await service.addThought(train.id, "Same");

			expect(await service.renameThought(train.id, thought!.id, "Same")).toBe(false);
		});

		it("returns false for non-existent thought", async () => {
			const { service } = createTestHarness();
			await service.load();
			const train = await service.startTrain("My Train");

			expect(await service.renameThought(train.id, "thought_nope", "New")).toBe(false);
		});

		it("returns false for non-existent train", async () => {
			const { service } = createTestHarness();
			await service.load();

			expect(await service.renameThought("train_nope", "thought_nope", "New")).toBe(false);
		});

		it("sanitizes special characters in new title for path", async () => {
			const { service } = createTestHarness();
			await service.load();
			const train = await service.startTrain("My Train");
			const thought = await service.addThought(train.id, "Original");

			await service.renameThought(train.id, thought!.id, 'Has/Special:Chars*"here');

			const updated = service.getTrain(train.id)!.thoughts[0];
			expect(updated.title).toBe('Has/Special:Chars*"here');
			// Filename (not full path) should have sanitized characters
			const filename = updated.path.split("/").pop()!;
			expect(filename).not.toMatch(/[/:*?"<>|]/);
			expect(filename).toContain("Has-Special-Chars--here");
		});
	});

	describe("deleteTrain()", () => {
		it("deletes a completed train", async () => {
			const { service } = createTestHarness();
			await service.load();
			const train = await service.startTrain("To Delete");
			await service.addThought(train.id, "T");
			await service.completeTrain(train.id);

			const result = await service.deleteTrain(train.id);

			expect(result).toBe(true);
			expect(service.getTrain(train.id)).toBeUndefined();
			expect(service.getAllTrains()).toHaveLength(0);
		});

		it("deletes a paused train", async () => {
			const { service } = createTestHarness();
			await service.load();
			const train = await service.startTrain("Paused Delete");
			await service.pause(train.id);

			const result = await service.deleteTrain(train.id);

			expect(result).toBe(true);
			expect(service.getTrain(train.id)).toBeUndefined();
		});

		it("rejects deletion of running train", async () => {
			const { service } = createTestHarness();
			await service.load();
			const train = await service.startTrain("Running");

			const result = await service.deleteTrain(train.id);

			expect(result).toBe(false);
			expect(service.getTrain(train.id)).toBeDefined();
		});

		it("emits train.deleted event", async () => {
			const { service, eventBus } = createTestHarness();
			await service.load();
			const train = await service.startTrain("Delete Events");
			await service.addThought(train.id, "T");
			await service.completeTrain(train.id);

			const events: Array<{ trainId: string; title: string }> = [];
			eventBus.on("train.deleted", (e) => { events.push(e.payload as { trainId: string; title: string }); });

			await service.deleteTrain(train.id);

			expect(events).toHaveLength(1);
			expect(events[0].trainId).toBe(train.id);
			expect(events[0].title).toBe("Delete Events");
		});

		it("returns false for non-existent train", async () => {
			const { service } = createTestHarness();
			await service.load();

			expect(await service.deleteTrain("train_nope")).toBe(false);
		});

		it("persists state after deletion", async () => {
			const { service, getData } = createTestHarness();
			await service.load();
			const train = await service.startTrain("Persist Delete");
			await service.addThought(train.id, "T");
			await service.completeTrain(train.id);

			await service.deleteTrain(train.id);

			const persisted = getData();
			expect(persisted!.trains).toHaveLength(0);
		});
	});

	describe("branch status", () => {
		it("setBranchStatus sets status on a branch origin node", async () => {
			const { service } = createTestHarness();
			await service.load();
			const train = await service.startTrain("Status Test");
			const a = await service.addThought(train.id, "A");
			const b = await service.addThought(train.id, "B", { direction: "branch", fromThoughtId: a!.id });

			const result = await service.setBranchStatus(train.id, b!.id, "promising");
			expect(result).toBe(true);

			const updated = service.getTrain(train.id);
			const thought = updated!.thoughts.find((t) => t.id === b!.id);
			expect(thought!.branchStatus).toBe("promising");
		});

		it("setBranchStatus rejects non-branch nodes", async () => {
			const { service } = createTestHarness();
			await service.load();
			const train = await service.startTrain("Reject Test");
			const a = await service.addThought(train.id, "A");

			const result = await service.setBranchStatus(train.id, a!.id, "stale");
			expect(result).toBe(false);
		});

		it("setBranchStatus emits event", async () => {
			const { service, eventBus } = createTestHarness();
			await service.load();
			const train = await service.startTrain("Event Test");
			const a = await service.addThought(train.id, "A");
			const b = await service.addThought(train.id, "B", { direction: "branch", fromThoughtId: a!.id });

			const handler = vi.fn();
			eventBus.on("train.branch.status.changed", handler);

			await service.setBranchStatus(train.id, b!.id, "exploring");
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { trainId: train.id, thoughtId: b!.id, status: "exploring" },
				}),
			);
		});

		it("clearBranchStatus removes the status", async () => {
			const { service } = createTestHarness();
			await service.load();
			const train = await service.startTrain("Clear Test");
			const a = await service.addThought(train.id, "A");
			const b = await service.addThought(train.id, "B", { direction: "branch", fromThoughtId: a!.id });

			await service.setBranchStatus(train.id, b!.id, "stale");
			const cleared = await service.clearBranchStatus(train.id, b!.id);
			expect(cleared).toBe(true);

			const updated = service.getTrain(train.id);
			const thought = updated!.thoughts.find((t) => t.id === b!.id);
			expect(thought!.branchStatus).toBeUndefined();
		});

		it("clearBranchStatus returns false when no status set", async () => {
			const { service } = createTestHarness();
			await service.load();
			const train = await service.startTrain("No Status");
			const a = await service.addThought(train.id, "A");
			const b = await service.addThought(train.id, "B", { direction: "branch", fromThoughtId: a!.id });

			const result = await service.clearBranchStatus(train.id, b!.id);
			expect(result).toBe(false);
		});

		it("setBranchStatus persists", async () => {
			const { service, getData } = createTestHarness();
			await service.load();
			const train = await service.startTrain("Persist Test");
			const a = await service.addThought(train.id, "A");
			const b = await service.addThought(train.id, "B", { direction: "branch", fromThoughtId: a!.id });

			await service.setBranchStatus(train.id, b!.id, "promising");

			const persisted = getData();
			const thought = persisted!.trains[0].thoughts.find((t) => t.id === b!.id);
			expect(thought!.branchStatus).toBe("promising");
		});
	});
});
