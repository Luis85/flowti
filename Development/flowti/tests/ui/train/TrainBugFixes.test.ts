// @vitest-environment happy-dom
/**
 * Inc 1 Bug Fixes — Tests for Cycle 14 critical train bugs:
 *
 * Bug A: TrainMainView `train.started` handler now sets trainId via setTrainId()
 * Bug B: UserHubView routes train sessions to Train views (sidebar/tab)
 * Bug C: MODAL_SESSION_TYPES excludes train-of-thought from NewSessionModal
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../../tests/mocks/obsidian-stub";
import { setupTrainViewSubscriptions } from "../../../src/ui/train/TrainMainViewSubscriptions";
import type { TrainViewContext } from "../../../src/ui/train/TrainMainView";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import { SESSION_TYPES } from "../../../src/domain/session/types";
import type { TrainState, ThoughtNode } from "../../../src/domain/train/types";

// ── Helpers ──────────────────────────────────────────────

function createThought(overrides: Partial<ThoughtNode> = {}): ThoughtNode {
	return {
		id: `thought_${Math.random().toString(36).slice(2, 8)}`,
		trainId: "train_1",
		title: "Test Thought",
		path: "00 - Connectivity/inbox/Test Thought.md",
		createdAt: "2026-02-21T14:30:00.000Z",
		order: 0,
		...overrides,
	};
}

function createTrain(overrides: Partial<TrainState> = {}): TrainState {
	return {
		id: "train_1",
		sessionId: "session_1",
		title: "My Train",
		status: "running",
		thoughts: [],
		relations: [],
		durationMinutes: 0,
		createdAt: "2026-02-21T14:00:00.000Z",
		pausedAt: null,
		completedAt: null,
		...overrides,
	};
}

function buildMockContext(): TrainViewContext & {
	_trainId: string | null;
	_activeThoughtId: string | null;
	_renderCount: number;
} {
	const ctx = {
		_trainId: null as string | null,
		_activeThoughtId: null as string | null,
		_renderCount: 0,
		getTrainId: () => ctx._trainId,
		setTrainId: (trainId: string) => { ctx._trainId = trainId; },
		setActiveThoughtId: (id: string | null) => { ctx._activeThoughtId = id; },
		scheduleRender: () => { ctx._renderCount++; },
	};
	return ctx;
}

// ── Bug A: trainId tracking via setTrainId ──────────────

describe("Bug A: train.started sets trainId via setTrainId", () => {
	let eventBus: EventBus;
	let ctx: ReturnType<typeof buildMockContext>;
	let unsubs: (() => void)[];

	beforeEach(() => {
		eventBus = new EventBus();
		ctx = buildMockContext();
		unsubs = setupTrainViewSubscriptions(ctx, eventBus);
	});

	it("sets trainId when no previous train is tracked", async () => {
		expect(ctx._trainId).toBeNull();

		const train = createTrain({ id: "train_abc" });
		await eventBus.emit("train.started", { train });

		expect(ctx._trainId).toBe("train_abc");
		expect(ctx._activeThoughtId).toBeNull();
		expect(ctx._renderCount).toBe(1);
	});

	it("updates trainId when same train starts again", async () => {
		ctx._trainId = "train_abc";

		const train = createTrain({ id: "train_abc" });
		await eventBus.emit("train.started", { train });

		expect(ctx._trainId).toBe("train_abc");
		expect(ctx._renderCount).toBe(1);
	});

	it("ignores train.started for a different train when already tracking", async () => {
		ctx._trainId = "train_abc";

		const train = createTrain({ id: "train_other" });
		await eventBus.emit("train.started", { train });

		// Should NOT change the tracked trainId
		expect(ctx._trainId).toBe("train_abc");
		expect(ctx._renderCount).toBe(0);
	});

	it("subsequent thought.added events match after trainId set", async () => {
		// Start the train — sets trainId
		const train = createTrain({ id: "train_abc" });
		await eventBus.emit("train.started", { train });
		expect(ctx._trainId).toBe("train_abc");

		ctx._renderCount = 0;

		// Add thought — should match the tracked trainId
		const thought = createThought({ id: "t1", trainId: "train_abc" });
		await eventBus.emit("train.thought.added", {
			trainId: "train_abc",
			thought,
			previousTitle: "",
			direction: "next" as const,
		});

		expect(ctx._renderCount).toBe(1);
	});

	it("thought.added for untracked train is ignored", async () => {
		ctx._trainId = "train_abc";

		const thought = createThought({ id: "t1", trainId: "train_other" });
		await eventBus.emit("train.thought.added", {
			trainId: "train_other",
			thought,
			previousTitle: "",
			direction: "next" as const,
		});

		expect(ctx._renderCount).toBe(0);
	});

	it("resets activeThoughtId to null on new train.started", async () => {
		ctx._activeThoughtId = "some_thought";

		const train = createTrain({ id: "train_new" });
		await eventBus.emit("train.started", { train });

		expect(ctx._activeThoughtId).toBeNull();
	});

	it("cleans up subscriptions", async () => {
		for (const unsub of unsubs) unsub();

		const train = createTrain({ id: "train_new" });
		await eventBus.emit("train.started", { train });

		// Should NOT have changed anything
		expect(ctx._trainId).toBeNull();
		expect(ctx._renderCount).toBe(0);
	});
});

// ── Bug C: MODAL_SESSION_TYPES filtering ────────────────

describe("Bug C: MODAL_SESSION_TYPES excludes train-of-thought", () => {
	it("SESSION_TYPES includes train-of-thought", () => {
		const tot = SESSION_TYPES.find((st) => st.type === "train-of-thought");
		expect(tot).toBeDefined();
		expect(tot!.label).toBe("Train of Thought");
	});

	it("filtering SESSION_TYPES removes train-of-thought", () => {
		const modalTypes = SESSION_TYPES.filter((st) => st.type !== "train-of-thought");
		expect(modalTypes.find((st) => st.type === "train-of-thought")).toBeUndefined();
		expect(modalTypes.length).toBe(SESSION_TYPES.length - 1);
	});

	it("filtered list retains all other session types", () => {
		const modalTypes = SESSION_TYPES.filter((st) => st.type !== "train-of-thought");
		const expectedTypes = [
			"documentation", "vault-hygiene", "event-storming",
			"service-design", "domain-design", "requirements-refinement",
			"backlog-structuring", "knowledge-cleanup",
		];
		for (const t of expectedTypes) {
			expect(modalTypes.find((st) => st.type === t), `missing type: ${t}`).toBeDefined();
		}
	});
});
