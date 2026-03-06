/**
 * Flow 20: Train Enhancements — Summary, History, Navigation
 *
 * Tests the complete lifecycle of enhanced train features:
 * Start train → add thoughts → branch → complete → summary generated → history browsable.
 * Verifies summary document content, event emission, keyboard navigation model,
 * and history panel filtering.
 *
 * Event sequence:
 *   train.started → train.thought.added (×N) → train.completed → train.summary.created
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { TrainService } from "../../src/domain/train/TrainService";
import { CaptureService } from "../../src/domain/capture/CaptureService";
import { generateTrainSummary } from "../../src/domain/train/TrainSummaryWriter";
import type { TrainServiceState, TrainState } from "../../src/domain/train/types";
import { createMockStorage, createMockFileSystem, waitForAsync } from "./testHelpers";

function createTestHarness() {
	const eventBus: IEventBus = new EventBus();
	const fileSystem = createMockFileSystem();
	const { storage } = createMockStorage<TrainServiceState>();

	const captureService = new CaptureService({
		eventBus,
		fileSystem,
		getSettings: () => ({ captureFolder: "00 - Connectivity/inbox" }),
	});

	// Simulate SessionService: session.create → session.created
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

	// Stub session.start/complete/pause/resume — no-ops in this test
	eventBus.on("session.start", () => {});
	eventBus.on("session.complete", () => {});

	const trainService = new TrainService({ storage, eventBus, fileSystem, captureService });
	trainService.getSettings = () => ({ trainFolder: "Trains", trainMaxThoughts: 100 });

	return { trainService, eventBus, fileSystem };
}

describe("Flow 20: Train Enhancements", () => {
	let trainService: TrainService;
	let eventBus: IEventBus;
	let fileSystem: ReturnType<typeof createMockFileSystem>;

	beforeEach(async () => {
		const harness = createTestHarness();
		trainService = harness.trainService;
		eventBus = harness.eventBus;
		fileSystem = harness.fileSystem;
		await trainService.load();
	});

	// ── Summary Generation ────────────────────────────────────

	describe("summary generation on completion", () => {
		it("creates summary document when train completes", async () => {
			const train = await trainService.startTrain("API Design");
			await trainService.addThought(train.id, "Endpoints");
			await trainService.addThought(train.id, "Auth patterns");
			await trainService.addThought(train.id, "Error handling");

			await trainService.completeTrain(train.id);
			await waitForAsync(100);

			// Summary file should be created in train folder
			const createCalls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const summaryCall = createCalls.find(
				(c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("Summary"),
			);
			expect(summaryCall).toBeDefined();
			// Summary path is now inside the per-train subfolder
			expect(summaryCall![0]).toMatch(/^Trains\/\d{8}-\d{4} API Design\/API Design — Summary\.md$/);
		});

		it("emits train.summary.created event", async () => {
			const events: string[] = [];
			eventBus.on("train.summary.created", (e) => {
				events.push(e.type);
			});

			const train = await trainService.startTrain("Summary Test");
			await trainService.addThought(train.id, "Thought A");
			await trainService.completeTrain(train.id);
			await waitForAsync(100);

			expect(events).toContain("train.summary.created");
		});

		it("summary contains train title and stats", async () => {
			const train = await trainService.startTrain("Architecture");
			await trainService.addThought(train.id, "Foundations");
			await trainService.addThought(train.id, "Patterns");
			const t1 = trainService.getTrain(train.id)!.thoughts[0];
			await trainService.addThought(train.id, "Branch idea", {
				direction: "branch",
				fromThoughtId: t1.id,
			});

			await trainService.completeTrain(train.id);
			await waitForAsync(100);

			// Verify summary content via the pure function
			const completedTrain = trainService.getTrain(train.id)!;
			const summary = generateTrainSummary(completedTrain);

			// Wikilinks use file basenames (includes ISO timestamp prefix)
			const basename = (t: { path: string }) => t.path.split("/").pop()!.replace(/\.md$/, "");
			const foundationsLink = `[[${basename(completedTrain.thoughts[0])}]]`;
			const patternsLink = `[[${basename(completedTrain.thoughts[1])}]]`;

			expect(summary).toContain("# Train Summary: Architecture");
			expect(summary).toContain("thoughts: 3");
			expect(summary).toContain("branches: 1");
			expect(summary).toContain("## Timeline");
			expect(summary).toContain(foundationsLink);
			expect(summary).toContain(patternsLink);
			expect(summary).toContain("## Branches");
		});

		it("does not create summary for empty train", async () => {
			const train = await trainService.startTrain("Empty");
			await trainService.completeTrain(train.id);
			await waitForAsync(100);

			const createCalls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const summaryCall = createCalls.find(
				(c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("Summary"),
			);
			expect(summaryCall).toBeUndefined();
		});
	});

	// ── Train History ─────────────────────────────────────────

	describe("train history browsing", () => {
		it("completed trains remain accessible via getAllTrains", async () => {
			const train = await trainService.startTrain("Completed Train");
			await trainService.addThought(train.id, "Idea");
			await trainService.completeTrain(train.id);

			const all = trainService.getAllTrains();
			expect(all.length).toBe(1);
			expect(all[0].status).toBe("completed");
		});

		it("multiple trains are all listed", async () => {
			const t1 = await trainService.startTrain("Train Alpha");
			await trainService.addThought(t1.id, "A");
			await trainService.completeTrain(t1.id);

			const t2 = await trainService.startTrain("Train Beta");
			await trainService.addThought(t2.id, "B");

			const all = trainService.getAllTrains();
			expect(all.length).toBe(2);
		});

		it("completed train data includes completedAt timestamp", async () => {
			const train = await trainService.startTrain("Timestamped");
			await trainService.addThought(train.id, "Thought");
			await trainService.completeTrain(train.id);

			const completed = trainService.getTrain(train.id)!;
			expect(completed.completedAt).not.toBeNull();
			expect(completed.status).toBe("completed");
		});
	});

	// ── Full Lifecycle ────────────────────────────────────────

	describe("full enhanced train lifecycle", () => {
		it("start → capture → branch → complete → summary → accessible", async () => {
			// Step 1: Start train
			const train = await trainService.startTrain("Full Lifecycle");
			expect(train.status).toBe("running");

			// Step 2: Add thoughts (main chain)
			await trainService.addThought(train.id, "Problem statement");
			await trainService.addThought(train.id, "Possible solutions");
			await trainService.addThought(train.id, "Decision");

			// Step 3: Add branch
			const t1 = trainService.getTrain(train.id)!.thoughts[0];
			await trainService.addThought(train.id, "Alternative approach", {
				direction: "branch",
				fromThoughtId: t1.id,
			});

			// Step 4: Complete
			const summaryEvents: Array<{ trainId: string; summaryPath: string }> = [];
			eventBus.on("train.summary.created", (e) => {
				summaryEvents.push(e.payload as { trainId: string; summaryPath: string });
			});

			await trainService.completeTrain(train.id);
			await waitForAsync(100);

			// Step 5: Verify summary created
			expect(summaryEvents.length).toBe(1);
			expect(summaryEvents[0].summaryPath).toMatch(/^Trains\/\d{8}-\d{4} Full Lifecycle\/Full Lifecycle — Summary\.md$/);

			// Step 6: Train accessible in history
			const all = trainService.getAllTrains();
			const completed = all.find((t) => t.id === train.id);
			expect(completed).toBeDefined();
			expect(completed!.status).toBe("completed");
			expect(completed!.thoughts.length).toBe(4);
			expect(completed!.relations.length).toBe(3); // 2 next + 1 branch
		});
	});

	// ── Event Sequencing ──────────────────────────────────────

	describe("event sequencing", () => {
		it("emits events in correct order: completed → summary.created", async () => {
			const sequence: string[] = [];
			eventBus.on("train.completed", () => { sequence.push("completed"); });
			eventBus.on("train.summary.created", () => { sequence.push("summary"); });

			const train = await trainService.startTrain("Sequence Test");
			await trainService.addThought(train.id, "A");
			await trainService.completeTrain(train.id);
			await waitForAsync(100);

			expect(sequence[0]).toBe("completed");
			expect(sequence[1]).toBe("summary");
		});
	});

	// ── Summary Writer Pure Function ──────────────────────────

	describe("summary writer edge cases", () => {
		it("handles train with merges", async () => {
			const train = await trainService.startTrain("Merge Summary");
			await trainService.addThought(train.id, "Main");
			await trainService.addThought(train.id, "Continue");

			const t1 = trainService.getTrain(train.id)!.thoughts[0];
			await trainService.addThought(train.id, "Branch", {
				direction: "branch",
				fromThoughtId: t1.id,
			});

			const branchThought = trainService.getTrain(train.id)!.thoughts[2];
			const continueThought = trainService.getTrain(train.id)!.thoughts[1];
			await trainService.mergeBranch(train.id, branchThought.id, continueThought.id);

			const currentTrain = trainService.getTrain(train.id)!;
			const summary = generateTrainSummary(currentTrain);

			// Wikilinks use file basenames (includes ISO timestamp prefix)
			const basename = (t: { path: string }) => t.path.split("/").pop()!.replace(/\.md$/, "");
			const branchLink = `[[${basename(branchThought)}]]`;
			const continueLink = `[[${basename(continueThought)}]]`;

			expect(summary).toContain("merges: 1");
			expect(summary).toContain("## Merges");
			expect(summary).toContain(`${branchLink} → ${continueLink}`);
		});
	});
});
