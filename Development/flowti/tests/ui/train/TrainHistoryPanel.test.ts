// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import type { TrainState } from "../../../src/domain/train/types";
import type { TrainService } from "../../../src/domain/train/TrainService";
import { TrainHistoryPanel } from "../../../src/ui/train/TrainHistoryPanel";

// ── Test helpers ──────────────────────────────────────────────

function makeTrain(overrides?: Partial<TrainState>): TrainState {
	return {
		id: `train_${Math.random().toString(36).slice(2, 8)}`,
		sessionId: "session_1",
		title: "Test Train",
		status: "completed",
		thoughts: [],
		relations: [],
		durationMinutes: 30,
		createdAt: "2026-02-22T10:00:00.000Z",
		pausedAt: null,
		completedAt: "2026-02-22T10:30:00.000Z",
		...overrides,
	};
}

function makeTrainService(trains: TrainState[]): TrainService {
	return {
		getAllTrains: () => trains,
	} as unknown as TrainService;
}

// ── Tests ─────────────────────────────────────────────────────

describe("TrainHistoryPanel", () => {
	let el: HTMLElement;
	let onSelectTrain: (trainId: string) => void;

	beforeEach(() => {
		el = document.createElement("div");
		onSelectTrain = vi.fn();
	});

	describe("rendering", () => {
		it("shows empty message when no trains exist", () => {
			const panel = new TrainHistoryPanel(el, {
				trainService: makeTrainService([]),
				onSelectTrain,
			});
			panel.render();

			expect(el.textContent).toContain("No trains yet");
		});

		it("renders a card for each train", () => {
			const trains = [
				makeTrain({ id: "t1", title: "Train Alpha" }),
				makeTrain({ id: "t2", title: "Train Beta" }),
			];
			const panel = new TrainHistoryPanel(el, {
				trainService: makeTrainService(trains),
				onSelectTrain,
			});
			panel.render();

			const cards = el.querySelectorAll(".ft-train-history-card");
			expect(cards.length).toBe(2);
		});

		it("displays train title in card", () => {
			const train = makeTrain({ title: "My Important Train" });
			const panel = new TrainHistoryPanel(el, {
				trainService: makeTrainService([train]),
				onSelectTrain,
			});
			panel.render();

			expect(el.textContent).toContain("My Important Train");
		});

		it("displays status badge", () => {
			const train = makeTrain({ status: "running" });
			const panel = new TrainHistoryPanel(el, {
				trainService: makeTrainService([train]),
				onSelectTrain,
			});
			panel.render();

			const badge = el.querySelector(".ft-train-history-status");
			expect(badge?.textContent).toBe("running");
		});

		it("displays thought and branch counts", () => {
			const train = makeTrain({
				thoughts: [
					{ id: "t1", trainId: "train_1", title: "A", path: "a.md", createdAt: "2026-02-22T10:00:00Z", order: 0 },
					{ id: "t2", trainId: "train_1", title: "B", path: "b.md", createdAt: "2026-02-22T10:01:00Z", order: 1 },
					{ id: "t3", trainId: "train_1", title: "C", path: "c.md", createdAt: "2026-02-22T10:02:00Z", order: 2 },
				],
				relations: [
					{ fromId: "t1", toId: "t2", direction: "next" },
					{ fromId: "t1", toId: "t3", direction: "branch" },
				],
			});
			const panel = new TrainHistoryPanel(el, {
				trainService: makeTrainService([train]),
				onSelectTrain,
			});
			panel.render();

			const stats = el.querySelector(".ft-train-history-stats");
			expect(stats?.textContent).toContain("3 thoughts");
			expect(stats?.textContent).toContain("1 branches");
		});

		it("sorts trains newest first", () => {
			const trains = [
				makeTrain({ id: "t1", title: "Older", createdAt: "2026-02-22T08:00:00.000Z" }),
				makeTrain({ id: "t2", title: "Newer", createdAt: "2026-02-22T12:00:00.000Z" }),
			];
			const panel = new TrainHistoryPanel(el, {
				trainService: makeTrainService(trains),
				onSelectTrain,
			});
			panel.render();

			const cards = el.querySelectorAll(".ft-train-history-card");
			expect(cards[0].textContent).toContain("Newer");
			expect(cards[1].textContent).toContain("Older");
		});

		it("renders header with Train History title", () => {
			const panel = new TrainHistoryPanel(el, {
				trainService: makeTrainService([]),
				onSelectTrain,
			});
			panel.render();

			expect(el.textContent).toContain("Train History");
		});
	});

	describe("filtering", () => {
		it("renders All / Active / Completed filter buttons", () => {
			const panel = new TrainHistoryPanel(el, {
				trainService: makeTrainService([]),
				onSelectTrain,
			});
			panel.render();

			const buttons = el.querySelectorAll(".ft-train-filter-btn");
			expect(buttons.length).toBe(3);
			expect(buttons[0].textContent).toBe("All");
			expect(buttons[1].textContent).toBe("Active");
			expect(buttons[2].textContent).toBe("Completed");
		});

		it("filters to active trains (running + paused)", () => {
			const trains = [
				makeTrain({ id: "t1", title: "Running", status: "running", completedAt: null }),
				makeTrain({ id: "t2", title: "Paused", status: "paused", completedAt: null }),
				makeTrain({ id: "t3", title: "Done", status: "completed" }),
			];
			const panel = new TrainHistoryPanel(el, {
				trainService: makeTrainService(trains),
				onSelectTrain,
			});
			panel.render();

			// Click "Active" filter
			const activeBtn = el.querySelectorAll(".ft-train-filter-btn")[1] as HTMLButtonElement;
			activeBtn.click();

			const cards = el.querySelectorAll(".ft-train-history-card");
			expect(cards.length).toBe(2);
			// Should contain running and paused, not completed
			const titles = Array.from(cards).map((c) => c.textContent ?? "");
			expect(titles.some((t) => t.includes("Running"))).toBe(true);
			expect(titles.some((t) => t.includes("Paused"))).toBe(true);
			expect(titles.some((t) => t.includes("Done"))).toBe(false);
		});

		it("filters to completed trains", () => {
			const trains = [
				makeTrain({ id: "t1", title: "Active", status: "running", completedAt: null }),
				makeTrain({ id: "t2", title: "Done A", status: "completed" }),
				makeTrain({ id: "t3", title: "Done B", status: "completed" }),
			];
			const panel = new TrainHistoryPanel(el, {
				trainService: makeTrainService(trains),
				onSelectTrain,
			});
			panel.render();

			// Click "Completed" filter
			const completedBtn = el.querySelectorAll(".ft-train-filter-btn")[2] as HTMLButtonElement;
			completedBtn.click();

			const cards = el.querySelectorAll(".ft-train-history-card");
			expect(cards.length).toBe(2);
		});

		it("shows no-match message when filter yields empty results", () => {
			const trains = [
				makeTrain({ id: "t1", title: "Done", status: "completed" }),
			];
			const panel = new TrainHistoryPanel(el, {
				trainService: makeTrainService(trains),
				onSelectTrain,
			});
			panel.render();

			// Click "Active" — no active trains
			const activeBtn = el.querySelectorAll(".ft-train-filter-btn")[1] as HTMLButtonElement;
			activeBtn.click();

			expect(el.textContent).toContain("No trains match this filter");
		});
	});

	describe("navigation", () => {
		it("calls onSelectTrain when card is clicked", () => {
			const train = makeTrain({ id: "train_abc" });
			const panel = new TrainHistoryPanel(el, {
				trainService: makeTrainService([train]),
				onSelectTrain,
			});
			panel.render();

			const card = el.querySelector(".ft-train-history-card") as HTMLElement;
			card.click();

			expect(onSelectTrain).toHaveBeenCalledWith("train_abc");
		});

		it("sets data-train-id on cards", () => {
			const train = makeTrain({ id: "train_xyz" });
			const panel = new TrainHistoryPanel(el, {
				trainService: makeTrainService([train]),
				onSelectTrain,
			});
			panel.render();

			const card = el.querySelector(".ft-train-history-card") as HTMLElement;
			expect(card.dataset.trainId).toBe("train_xyz");
		});
	});
});
