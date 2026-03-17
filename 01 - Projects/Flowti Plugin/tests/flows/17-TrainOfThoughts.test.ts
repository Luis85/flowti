/**
 * Flow 17: Start a Train of Thoughts
 *
 * Tests the serial thought capture lifecycle:
 * Start train → add thoughts → pause → resume → complete.
 * Verifies direction-based linking, branching, timeline navigation,
 * frontmatter enrichment, and event sequencing.
 *
 * Event sequence:
 *   session.create → session.created → session.start → train.started
 *   train.thought.added (per thought)
 *   train.paused / train.resumed
 *   train.completed
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { TrainService } from "../../src/domain/train/TrainService";
import { CaptureService } from "../../src/domain/capture/CaptureService";
import type { TrainServiceState, TrainState, ThoughtDirection } from "../../src/domain/train/types";
import { createMockStorage, createMockFileSystem, waitForAsync } from "./testHelpers";

function createTestHarness(initialState?: TrainServiceState) {
	const eventBus: IEventBus = new EventBus();
	const fileSystem = createMockFileSystem();
	const { storage, getData } = createMockStorage<TrainServiceState>(initialState);

	const captureService = new CaptureService({
		eventBus,
		fileSystem,
		getSettings: () => ({ captureFolder: "00 - Connectivity/inbox" }),
	});

	// Simulate SessionService: session.create → session.created → ready
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

	const service = new TrainService({ storage, eventBus, fileSystem, captureService });

	return { service, eventBus, fileSystem, storage, getData };
}

describe("Flow 17: Start a Train of Thoughts", () => {
	let service: TrainService;
	let eventBus: IEventBus;
	let fileSystem: ReturnType<typeof createMockFileSystem>;

	beforeEach(() => {
		const harness = createTestHarness();
		service = harness.service;
		eventBus = harness.eventBus;
		fileSystem = harness.fileSystem;
	});

	describe("start → capture → pause → resume → complete lifecycle", () => {
		it("should start a train with linked session and emit train.started", async () => {
			const started = vi.fn();
			eventBus.on("train.started", started);

			const train = await service.startTrain("Deep Dive");

			expect(train.title).toBe("Deep Dive");
			expect(train.status).toBe("running");
			expect(train.sessionId).toMatch(/^session_/);
			expect(started).toHaveBeenCalledOnce();
		});

		it("should capture thoughts in sequence with train.thought.added events", async () => {
			const train = await service.startTrain("Sequence Test");
			const thoughts: Array<{ previousTitle: string | null; direction: ThoughtDirection }> = [];
			eventBus.on("train.thought.added", (e) => {
				thoughts.push({ previousTitle: e.payload.previousTitle, direction: e.payload.direction });
			});

			await service.addThought(train.id, "First Idea");
			await service.addThought(train.id, "Second Idea");
			await service.addThought(train.id, "Third Idea");

			expect(thoughts).toHaveLength(3);
			expect(thoughts[0].previousTitle).toBeNull();
			expect(thoughts[1].previousTitle).toBe("First Idea");
			expect(thoughts[2].previousTitle).toBe("Second Idea");
			expect(thoughts.every((t) => t.direction === "next")).toBe(true);
		});

		it("should pause, resume, then add more thoughts", async () => {
			const train = await service.startTrain("Pause Resume");
			await service.addThought(train.id, "Before Pause");

			// Pause
			const pauseResult = await service.pause(train.id);
			expect(pauseResult).toBe(true);
			expect(service.getTrain(train.id)!.status).toBe("paused");

			// Cannot add thought while paused
			const blocked = await service.addThought(train.id, "Should Fail");
			expect(blocked).toBeNull();

			// Resume
			const resumeResult = await service.resume(train.id);
			expect(resumeResult).toBe(true);
			expect(service.getTrain(train.id)!.status).toBe("running");

			// Add more after resume
			const afterResume = await service.addThought(train.id, "After Resume");
			expect(afterResume).not.toBeNull();
			expect(service.getTrain(train.id)!.thoughts).toHaveLength(2);
		});

		it("should complete a train and free slot for new train", async () => {
			const completed = vi.fn();
			eventBus.on("train.completed", completed);

			const train = await service.startTrain("Will Complete");
			await service.addThought(train.id, "Only Thought");

			await service.completeTrain(train.id);

			expect(service.getTrain(train.id)!.status).toBe("completed");
			expect(completed).toHaveBeenCalledOnce();
			expect(completed.mock.calls[0][0].payload.thoughtCount).toBe(1);

			// No active train — new one can be started
			expect(service.getActiveTrain()).toBeUndefined();

			const newTrain = await service.startTrain("Fresh Start");
			expect(newTrain.status).toBe("running");
		});
	});

	describe("direction-based linking and branching", () => {
		it("should create branch relation when direction is 'branch'", async () => {
			const train = await service.startTrain("Branch Test");
			await service.addThought(train.id, "Root");
			await service.addThought(train.id, "Main Line", { direction: "next" });
			await service.addThought(train.id, "Side Track", { direction: "branch" });

			const updatedTrain = service.getTrain(train.id)!;
			expect(updatedTrain.relations).toHaveLength(2);

			const nextRel = updatedTrain.relations.find((r) => r.direction === "next");
			const branchRel = updatedTrain.relations.find((r) => r.direction === "branch");
			expect(nextRel).toBeDefined();
			expect(branchRel).toBeDefined();
		});

		it("should link from specific thought via fromThoughtId", async () => {
			const train = await service.startTrain("FromId Test");
			const root = await service.addThought(train.id, "Root");
			await service.addThought(train.id, "Child A");

			// Branch from root, not from last thought
			const branchB = await service.addThought(train.id, "Branch B", {
				direction: "branch",
				fromThoughtId: root!.id,
			});

			expect(branchB).not.toBeNull();
			const updatedTrain = service.getTrain(train.id)!;
			const branchRel = updatedTrain.relations.find(
				(r) => r.toId === branchB!.id && r.direction === "branch",
			);
			expect(branchRel).toBeDefined();
			expect(branchRel!.fromId).toBe(root!.id);
		});
	});

	describe("timeline and navigation helpers", () => {
		it("should return main timeline following 'next' chain", async () => {
			const train = await service.startTrain("Timeline Test");
			await service.addThought(train.id, "A");
			const thoughtB = await service.addThought(train.id, "B");
			await service.addThought(train.id, "B-branch", {
				direction: "branch",
				fromThoughtId: thoughtB!.id,
			});
			await service.addThought(train.id, "C", { fromThoughtId: thoughtB!.id });

			const timeline = service.getTimeline(train.id);
			expect(timeline.map((t) => t.title)).toEqual(["A", "B", "C"]);
		});

		it("should return branch children of a thought", async () => {
			const train = await service.startTrain("Branch Nav");
			await service.addThought(train.id, "Root");
			const root = service.getTrain(train.id)!.thoughts[0];
			await service.addThought(train.id, "Branch 1", { direction: "branch", fromThoughtId: root.id });
			await service.addThought(train.id, "Branch 2", { direction: "branch", fromThoughtId: root.id });

			const branches = service.getBranches(train.id, root.id);
			expect(branches.map((t) => t.title)).toEqual(["Branch 1", "Branch 2"]);
		});

		it("should return all children (next + branch) of a thought", async () => {
			const train = await service.startTrain("Children Nav");
			await service.addThought(train.id, "Parent");
			const parent = service.getTrain(train.id)!.thoughts[0];
			await service.addThought(train.id, "Next Child");
			await service.addThought(train.id, "Branch Child", { direction: "branch", fromThoughtId: parent.id });

			const children = service.getChildren(train.id, parent.id);
			expect(children).toHaveLength(2);
		});
	});

	describe("frontmatter enrichment", () => {
		it("should enrich thought notes with train-session and thought-order", async () => {
			const train = await service.startTrain("FM Flow");
			await service.addThought(train.id, "First");

			await vi.waitFor(() => {
				expect(fileSystem.updateFrontmatter).toHaveBeenCalled();
			});

			const calls = (fileSystem.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls;
			const firstCall = calls.find((c: unknown[]) =>
				(c[1] as Record<string, unknown>)["thought-order"] === 0,
			);
			expect(firstCall).toBeDefined();
			expect((firstCall![1] as Record<string, unknown>)["train-session"]).toBe("FM Flow");
		});

		it("should add nav links (next/back/up/down) on linked thoughts", async () => {
			const train = await service.startTrain("Relations FM");
			await service.addThought(train.id, "A");
			await service.addThought(train.id, "B");

			await vi.waitFor(() => {
				const calls = (fileSystem.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls;
				const navCall = calls.find((c: unknown[]) => {
					const data = c[1] as Record<string, unknown>;
					return Array.isArray(data["prev"]) && (data["prev"] as string[]).length > 0;
				});
				expect(navCall).toBeDefined();
			});
		});
	});

	describe("event sequencing", () => {
		it("should emit events in correct order for full lifecycle", async () => {
			const events: string[] = [];
			eventBus.on("train.started", () => { events.push("train.started"); });
			eventBus.on("train.thought.added", () => { events.push("train.thought.added"); });
			eventBus.on("train.paused", () => { events.push("train.paused"); });
			eventBus.on("train.resumed", () => { events.push("train.resumed"); });
			eventBus.on("train.completed", () => { events.push("train.completed"); });

			const train = await service.startTrain("Event Order");
			await service.addThought(train.id, "Idea 1");
			await service.addThought(train.id, "Idea 2");
			await service.pause(train.id);
			await service.resume(train.id);
			await service.addThought(train.id, "Idea 3");
			await service.completeTrain(train.id);

			await waitForAsync();

			expect(events).toEqual([
				"train.started",
				"train.thought.added",
				"train.thought.added",
				"train.paused",
				"train.resumed",
				"train.thought.added",
				"train.completed",
			]);
		});

		it("should emit session lifecycle events alongside train events", async () => {
			const sessionEvents: string[] = [];
			eventBus.on("session.start", () => { sessionEvents.push("session.start"); });
			eventBus.on("session.pause", () => { sessionEvents.push("session.pause"); });
			eventBus.on("session.resume", () => { sessionEvents.push("session.resume"); });
			eventBus.on("session.complete", () => { sessionEvents.push("session.complete"); });

			const train = await service.startTrain("Session Events");
			await service.pause(train.id);
			await service.resume(train.id);
			await service.completeTrain(train.id);

			await waitForAsync();

			expect(sessionEvents).toEqual([
				"session.start",
				"session.pause",
				"session.resume",
				"session.complete",
			]);
		});
	});

	// ── Cycle 14: Tree structure, stats, and live updates ────

	describe("tree structure after branching (Cycle 14)", () => {
		it("should produce correct timeline and branch structure", async () => {
			const train = await service.startTrain("Tree Test");
			await service.addThought(train.id, "Root");
			const root = service.getTrain(train.id)!.thoughts[0];

			await service.addThought(train.id, "Main A");
			await service.addThought(train.id, "Main B");

			// Branch from root
			await service.addThought(train.id, "Branch 1", {
				direction: "branch",
				fromThoughtId: root.id,
			});
			await service.addThought(train.id, "Branch 2", {
				direction: "branch",
				fromThoughtId: root.id,
			});

			const updatedTrain = service.getTrain(train.id)!;

			// Main timeline follows "next" chain
			const timeline = service.getTimeline(train.id);
			expect(timeline.map((t) => t.title)).toEqual(["Root", "Main A", "Main B"]);

			// Branches from root
			const branches = service.getBranches(train.id, root.id);
			expect(branches.map((t) => t.title)).toEqual(["Branch 1", "Branch 2"]);

			// All children of root
			const allChildren = service.getChildren(train.id, root.id);
			expect(allChildren).toHaveLength(3); // Main A + Branch 1 + Branch 2

			// Relations
			const nextRels = updatedTrain.relations.filter((r) => r.direction === "next");
			const branchRels = updatedTrain.relations.filter((r) => r.direction === "branch");
			expect(nextRels).toHaveLength(2); // Root→Main A, Main A→Main B
			expect(branchRels).toHaveLength(2); // Root→Branch 1, Root→Branch 2
		});

		it("should track thought count and branch count accurately for stats", async () => {
			const train = await service.startTrain("Stats Test");
			await service.addThought(train.id, "A");
			const thoughtA = service.getTrain(train.id)!.thoughts[0];
			await service.addThought(train.id, "B");
			await service.addThought(train.id, "C", {
				direction: "branch",
				fromThoughtId: thoughtA.id,
			});

			const t = service.getTrain(train.id)!;
			expect(t.thoughts).toHaveLength(3);

			const branchCount = t.relations.filter((r) => r.direction === "branch").length;
			expect(branchCount).toBe(1);

			const chainLength = service.getTimeline(train.id).length;
			expect(chainLength).toBe(2); // A → B (C is a branch)
		});
	});

	describe("live update events (Cycle 14)", () => {
		it("should emit train.thought.added with trainId for view subscription matching", async () => {
			const train = await service.startTrain("Live Update");
			const captured: Array<{ trainId: string; direction: ThoughtDirection }> = [];
			eventBus.on("train.thought.added", (e) => {
				captured.push({
					trainId: e.payload.trainId,
					direction: e.payload.direction,
				});
			});

			await service.addThought(train.id, "Idea");
			await service.addThought(train.id, "Follow-up");

			expect(captured).toHaveLength(2);
			expect(captured[0].trainId).toBe(train.id);
			expect(captured[1].trainId).toBe(train.id);
			expect(captured[0].direction).toBe("next");
		});

		it("should provide train state in train.started payload for view initialization", async () => {
			let receivedTrain: TrainState | null = null;
			eventBus.on("train.started", (e) => {
				receivedTrain = e.payload.train;
			});

			const train = await service.startTrain("Init Test");

			expect(receivedTrain).not.toBeNull();
			expect(receivedTrain!.id).toBe(train.id);
			expect(receivedTrain!.status).toBe("running");
			expect(receivedTrain!.sessionId).toMatch(/^session_/);
		});
	});

	describe("User Hub integration data (Cycle 14)", () => {
		it("should expose train-of-thought sessions via getAllTrains for User Hub lookup", async () => {
			const train1 = await service.startTrain("Train A");
			await service.completeTrain(train1.id);
			const train2 = await service.startTrain("Train B");

			const allTrains = service.getAllTrains();
			expect(allTrains).toHaveLength(2);
			expect(allTrains.find((t) => t.title === "Train A")!.status).toBe("completed");
			expect(allTrains.find((t) => t.title === "Train B")!.status).toBe("running");
		});

		it("should allow finding train by sessionId for detail panel rendering", async () => {
			const train = await service.startTrain("Lookup Test");
			const sessionId = train.sessionId;

			const found = service.getAllTrains().find((t) => t.sessionId === sessionId);
			expect(found).toBeDefined();
			expect(found!.title).toBe("Lookup Test");
		});
	});
});
