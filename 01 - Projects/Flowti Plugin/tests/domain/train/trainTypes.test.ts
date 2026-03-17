import { describe, it, expect } from "vitest";
import "../../mocks/obsidian-stub";
import { BUILT_IN_TRAIN_TYPES } from "../../../src/domain/train/types";
import type { TrainServiceState } from "../../../src/domain/train/types";
import { TrainService } from "../../../src/domain/train/TrainService";
import { CaptureService } from "../../../src/domain/capture/CaptureService";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { createMockStorage } from "../../mocks/storage";
import { createMockFileSystem } from "../../mocks/filesystem";

// ── Test helpers ──────────────────────────────────────────

function createTestHarness() {
	const eventBus: IEventBus = new EventBus();
	const { storage } = createMockStorage<TrainServiceState>({ trains: [] });
	const fileSystem = createMockFileSystem();
	const captureService = new CaptureService({
		eventBus,
		fileSystem,
		getSettings: () => ({ captureFolder: "00 - Connectivity/inbox" }),
	});

	eventBus.on("session.create", (event) => {
		void eventBus.emit("session.created", {
			session: {
				id: `session_${Math.random().toString(36).slice(2, 8)}`,
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
	void service.load();
	return { service, eventBus };
}

// ── Tests ─────────────────────────────────────────────────

describe("Train Types", () => {
	describe("BUILT_IN_TRAIN_TYPES", () => {
		it("has exactly 4 built-in types", () => {
			expect(BUILT_IN_TRAIN_TYPES).toHaveLength(4);
		});

		it("includes brainstorm with 15min default", () => {
			const bs = BUILT_IN_TRAIN_TYPES.find((t) => t.id === "brainstorm");
			expect(bs).toBeDefined();
			expect(bs!.defaultDuration).toBe(15);
			expect(bs!.label).toBe("Brainstorm");
			expect(bs!.icon).toBe("lightbulb");
		});

		it("includes research with 25min default", () => {
			const rs = BUILT_IN_TRAIN_TYPES.find((t) => t.id === "research");
			expect(rs).toBeDefined();
			expect(rs!.defaultDuration).toBe(25);
		});

		it("includes decision with 10min default", () => {
			const dc = BUILT_IN_TRAIN_TYPES.find((t) => t.id === "decision");
			expect(dc).toBeDefined();
			expect(dc!.defaultDuration).toBe(10);
		});

		it("includes free-form with 0 duration (no timer)", () => {
			const ff = BUILT_IN_TRAIN_TYPES.find((t) => t.id === "free-form");
			expect(ff).toBeDefined();
			expect(ff!.defaultDuration).toBe(0);
		});

		it("all types have required fields", () => {
			for (const t of BUILT_IN_TRAIN_TYPES) {
				expect(t.id).toBeTruthy();
				expect(t.label).toBeTruthy();
				expect(t.icon).toBeTruthy();
				expect(typeof t.defaultDuration).toBe("number");
			}
		});
	});

	describe("startTrain with trainType", () => {
		it("stores trainType on the created train", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("My Research", 25, "research");
			expect(train.trainType).toBe("research");
		});

		it("stores undefined trainType when not provided", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Quick Idea", 0);
			expect(train.trainType).toBeUndefined();
		});

		it("persists trainType through getTrain", async () => {
			const { service } = createTestHarness();
			const created = await service.startTrain("Decision Train", 10, "decision");
			const retrieved = service.getTrain(created.id);
			expect(retrieved?.trainType).toBe("decision");
		});
	});
});
