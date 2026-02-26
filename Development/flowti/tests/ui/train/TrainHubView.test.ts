// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "../../mocks/obsidian-stub";
import { TrainHubView } from "../../../src/ui/train/TrainHubView";
import { VIEW_TYPE_TRAIN_HUB } from "../../../src/domain/hub/types";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { TrainState, ThoughtNode } from "../../../src/domain/train/types";
import type { TrainService } from "../../../src/domain/train/TrainService";
import type { OnboardingService } from "../../../src/domain/onboarding/OnboardingService";

// ── Helpers ──────────────────────────────────────────────

function createMockLeaf(): import("obsidian").WorkspaceLeaf {
	return {} as import("obsidian").WorkspaceLeaf;
}

function createThought(overrides: Partial<ThoughtNode> = {}): ThoughtNode {
	return {
		id: `thought_${Math.random().toString(36).slice(2, 8)}`,
		trainId: "train_1",
		title: "Test Thought",
		path: "trains/Test Thought.md",
		createdAt: "2026-02-23T10:00:00.000Z",
		order: 0,
		...overrides,
	};
}

function createTrain(overrides: Partial<TrainState> = {}): TrainState {
	return {
		id: `train_${Math.random().toString(36).slice(2, 8)}`,
		sessionId: "session_1",
		title: "Test Train",
		status: "running",
		thoughts: [],
		relations: [],
		durationMinutes: 0,
		createdAt: "2026-02-23T10:00:00.000Z",
		pausedAt: null,
		completedAt: null,
		folderPath: "trains/20260223-1000 Test Train",
		...overrides,
	};
}

function createMockTrainService(trains: TrainState[] = []): TrainService {
	return {
		getAllTrains: vi.fn(() => trains),
		getActiveTrain: vi.fn(() => trains.find((t) => t.status === "running" || t.status === "paused")),
		getTrain: vi.fn((id: string) => trains.find((t) => t.id === id)),
		pause: vi.fn(async () => true),
		resume: vi.fn(async () => true),
		deleteTrain: vi.fn(async () => true),
	} as unknown as TrainService;
}

function createMockOnboardingService(): OnboardingService {
	return {
		hasVisited: vi.fn(() => true),
		isCalloutDismissed: vi.fn(() => false),
		recordFirstVisit: vi.fn(async () => {}),
		markCalloutDismissed: vi.fn(async () => {}),
	} as unknown as OnboardingService;
}

/** Prepare containerEl for BaseHubView — needs 2 children (Obsidian adds them). */
function prepareContainerEl(view: TrainHubView): void {
	const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
	el.appendChild(document.createElement("div")); // [0] = header (hidden by ft-hide-header)
	el.appendChild(document.createElement("div")); // [1] = content area
}

// ── Tests ────────────────────────────────────────────────

describe("TrainHubView", () => {
	let eventBus: IEventBus;
	let openTrainCb: (trainId: string) => void;

	beforeEach(() => {
		eventBus = new EventBus();
		openTrainCb = vi.fn<(trainId: string) => void>();
	});

	// ── Identity ────────────────────────────────────────────

	describe("identity", () => {
		it("returns correct view type", () => {
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), openTrainCb, createMockOnboardingService());
			expect(view.getViewType()).toBe(VIEW_TYPE_TRAIN_HUB);
			expect(view.getViewType()).toBe("flowti-train-hub");
		});

		it("returns train-front icon", () => {
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), openTrainCb, createMockOnboardingService());
			expect(view.getIcon()).toBe("train-front");
		});

		it("returns Train Hub display text", () => {
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), openTrainCb, createMockOnboardingService());
			expect(view.getDisplayText()).toBe("Train Hub");
		});

		it("has hub ID 'train-hub'", () => {
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), openTrainCb, createMockOnboardingService());
			expect(view.getHubId()).toBe("train-hub");
		});

		it("has hub type 'domain'", () => {
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), openTrainCb, createMockOnboardingService());
			expect(view.getHubType()).toBe("domain");
		});
	});

	// ── Tab definitions ─────────────────────────────────────

	describe("tabs", () => {
		it("defines 2 tabs: active and history", () => {
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), openTrainCb, createMockOnboardingService());
			const tabs = view.getTabDefinitions();
			expect(tabs).toHaveLength(2);
			expect(tabs[0].id).toBe("active");
			expect(tabs[1].id).toBe("history");
		});

		it("active tab has play icon", () => {
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), openTrainCb, createMockOnboardingService());
			const tabs = view.getTabDefinitions();
			expect(tabs[0].icon).toBe("play");
		});

		it("history tab has history icon", () => {
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), openTrainCb, createMockOnboardingService());
			const tabs = view.getTabDefinitions();
			expect(tabs[1].icon).toBe("history");
		});
	});

	// ── Dashboard rendering ─────────────────────────────────

	describe("dashboard rendering", () => {
		it("renders dashboard with Train Hub heading", async () => {
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), openTrainCb, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
			expect(el.textContent).toContain("Train Hub");
		});

		it("renders stats cards with train counts", async () => {
			const trains = [
				createTrain({ id: "t1", status: "running" }),
				createTrain({ id: "t2", status: "paused" }),
				createTrain({ id: "t3", status: "completed", completedAt: "2026-02-23T11:00:00Z" }),
			];
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(trains), openTrainCb, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
			expect(el.textContent).toContain("Total Trains");
			expect(el.textContent).toContain("3");
		});

		it("renders active train card when a train is running", async () => {
			const train = createTrain({
				id: "running_1",
				title: "Deep Research",
				status: "running",
				thoughts: [createThought(), createThought()],
			});
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService([train]), openTrainCb, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
			expect(el.textContent).toContain("Currently Running");
			expect(el.textContent).toContain("Deep Research");
			expect(el.textContent).toContain("2 thoughts");
		});

		it("does not render active train card when no train is running", async () => {
			const train = createTrain({ status: "completed", completedAt: "2026-02-23T11:00:00Z" });
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService([train]), openTrainCb, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
			expect(el.textContent).not.toContain("Currently Running");
		});

		it("computes average thoughts correctly", async () => {
			const trains = [
				createTrain({ id: "t1", thoughts: [createThought(), createThought(), createThought()] }),
				createTrain({ id: "t2", thoughts: [createThought()] }),
			];
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(trains), openTrainCb, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
			// (3 + 1) / 2 = 2.0
			expect(el.textContent).toContain("2.0");
		});
	});

	// ── Event subscriptions ─────────────────────────────────

	describe("event subscriptions", () => {
		it("subscribes to train lifecycle events on open", async () => {
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), openTrainCb, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			// Verify subscription by emitting events and checking that getAllTrains is called again
			const trainService = (view as unknown as { trainService: TrainService }).trainService;
			const spy = trainService.getAllTrains as ReturnType<typeof vi.fn>;
			const initialCallCount = spy.mock.calls.length;

			await eventBus.emit("train.started", { train: createTrain() });
			expect(spy.mock.calls.length).toBeGreaterThan(initialCallCount);
		});

		it("subscribes to train.completed for re-render", async () => {
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), openTrainCb, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			const trainService = (view as unknown as { trainService: TrainService }).trainService;
			const spy = trainService.getAllTrains as ReturnType<typeof vi.fn>;
			const initialCallCount = spy.mock.calls.length;

			await eventBus.emit("train.completed", { trainId: "t1", thoughtCount: 5 });
			expect(spy.mock.calls.length).toBeGreaterThan(initialCallCount);
		});

		it("subscribes to train.deleted for re-render", async () => {
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), openTrainCb, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			const trainService = (view as unknown as { trainService: TrainService }).trainService;
			const spy = trainService.getAllTrains as ReturnType<typeof vi.fn>;
			const initialCallCount = spy.mock.calls.length;

			await eventBus.emit("train.deleted", { trainId: "t1", title: "Gone" });
			expect(spy.mock.calls.length).toBeGreaterThan(initialCallCount);
		});

		it("cleans up subscriptions on close", async () => {
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), openTrainCb, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();
			await view.onClose();

			const trainService = (view as unknown as { trainService: TrainService }).trainService;
			const spy = trainService.getAllTrains as ReturnType<typeof vi.fn>;
			const callCountAfterClose = spy.mock.calls.length;

			// Events after close should not trigger further calls
			await eventBus.emit("train.started", { train: createTrain() });
			expect(spy.mock.calls.length).toBe(callCountAfterClose);
		});
	});

	// ── Open train callback ─────────────────────────────────

	describe("open train callback", () => {
		it("calls openTrain when Open button clicked on dashboard active card", async () => {
			const train = createTrain({ id: "active_train", status: "running" });
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService([train]), openTrainCb, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
			const openBtn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent === "Open");
			expect(openBtn).toBeDefined();
			openBtn!.click();
			expect(openTrainCb).toHaveBeenCalledWith("active_train");
		});
	});

	// ── Hub lifecycle events ────────────────────────────────

	describe("hub lifecycle events", () => {
		it("emits hub.opened on open", async () => {
			const spy = vi.fn();
			eventBus.on("hub.opened", spy);

			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), openTrainCb, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			expect(spy).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ hubId: "train-hub" }),
				}),
			);
		});

		it("emits hub.closed on close", async () => {
			const spy = vi.fn();
			eventBus.on("hub.closed", spy);

			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), openTrainCb, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();
			await view.onClose();

			expect(spy).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ hubId: "train-hub" }),
				}),
			);
		});
	});

	describe("type filter and sort", () => {
		/** Wait for BaseHubView's 16ms scheduleRender debounce. */
		const tick = () => new Promise((r) => setTimeout(r, 50));

		it("renders type filter dropdown in top bar", async () => {
			const trains = [createTrain({ trainType: "brainstorm" })];
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(trains), openTrainCb, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			const select = view.containerEl.querySelector(".ft-train-hub-filter") as HTMLSelectElement;
			expect(select).not.toBeNull();
			expect(select.querySelectorAll("option").length).toBe(5); // All + 4 types
		});

		it("renders sort dropdown in top bar", async () => {
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(), openTrainCb, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			const select = view.containerEl.querySelector(".ft-train-hub-sort") as HTMLSelectElement;
			expect(select).not.toBeNull();
			expect(select.querySelectorAll("option").length).toBe(3); // recent, most-thoughts, longest
		});

		it("type filter restricts list to matching trains", async () => {
			const trains = [
				createTrain({ id: "t1", title: "Brainstorm A", trainType: "brainstorm", status: "completed", completedAt: "2026-02-23T11:00:00Z" }),
				createTrain({ id: "t2", title: "Research B", trainType: "research", status: "completed", completedAt: "2026-02-23T12:00:00Z" }),
				createTrain({ id: "t3", title: "Brainstorm C", trainType: "brainstorm", status: "completed", completedAt: "2026-02-23T13:00:00Z" }),
			];
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(trains), openTrainCb, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			// Navigate to history tab and wait for debounced render
			(view as unknown as { navigateTo: (page: string) => void }).navigateTo("history");
			await tick();

			// Set type filter to brainstorm
			const select = view.containerEl.querySelector(".ft-train-hub-filter") as HTMLSelectElement;
			select.value = "brainstorm";
			select.dispatchEvent(new Event("change"));
			await tick();

			// Count badge should reflect filtered count
			const badge = (view as unknown as { countBadge: HTMLElement }).countBadge;
			expect(badge.textContent).toBe("2");
		});

		it("sort by most thoughts orders correctly", async () => {
			const trains = [
				createTrain({ id: "t1", title: "Few", trainType: "brainstorm", status: "completed", completedAt: "2026-02-23T11:00:00Z", thoughts: [createThought()] }),
				createTrain({ id: "t2", title: "Many", trainType: "research", status: "completed", completedAt: "2026-02-23T12:00:00Z", thoughts: [createThought(), createThought(), createThought()] }),
			];
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(trains), openTrainCb, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			(view as unknown as { navigateTo: (page: string) => void }).navigateTo("history");
			await tick();

			// Set sort to most-thoughts
			const sortSelect = view.containerEl.querySelector(".ft-train-hub-sort") as HTMLSelectElement;
			sortSelect.value = "most-thoughts";
			sortSelect.dispatchEvent(new Event("change"));
			await tick();

			// First list item should be "Many" (3 thoughts)
			const rows = view.containerEl.querySelectorAll(".ft-list-item");
			expect(rows[0]?.textContent).toContain("Many");
		});

		it("combined filter + search works", async () => {
			const trains = [
				createTrain({ id: "t1", title: "Alpha Brainstorm", trainType: "brainstorm", status: "completed", completedAt: "2026-02-23T11:00:00Z" }),
				createTrain({ id: "t2", title: "Beta Brainstorm", trainType: "brainstorm", status: "completed", completedAt: "2026-02-23T12:00:00Z" }),
				createTrain({ id: "t3", title: "Alpha Research", trainType: "research", status: "completed", completedAt: "2026-02-23T13:00:00Z" }),
			];
			const view = new TrainHubView(createMockLeaf(), eventBus, createMockTrainService(trains), openTrainCb, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			(view as unknown as { navigateTo: (page: string) => void }).navigateTo("history");
			await tick();

			// Filter by brainstorm
			const typeSelect = view.containerEl.querySelector(".ft-train-hub-filter") as HTMLSelectElement;
			typeSelect.value = "brainstorm";
			typeSelect.dispatchEvent(new Event("change"));
			await tick();

			// Search for "Alpha"
			const searchInput = (view as unknown as { searchInput: HTMLInputElement }).searchInput;
			searchInput.value = "Alpha";
			searchInput.dispatchEvent(new Event("input"));
			await tick();

			const badge = (view as unknown as { countBadge: HTMLElement }).countBadge;
			expect(badge.textContent).toBe("1");
		});
	});
});
