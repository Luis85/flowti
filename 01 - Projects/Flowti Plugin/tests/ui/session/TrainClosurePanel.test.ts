// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { TrainClosurePanel } from "../../../src/ui/session/TrainClosurePanel";
import type { TrainState, ThoughtNode, ThoughtRelation } from "../../../src/domain/train/types";

// ── Helpers ──────────────────────────────────────────────

function createThought(id: string, title: string, order = 0): ThoughtNode {
	return { id, trainId: "t1", title, path: `path/${id}.md`, createdAt: "2026-02-23T10:00:00Z", order };
}

function createTrain(overrides: Partial<TrainState> = {}): TrainState {
	return {
		id: "t1",
		sessionId: "s1",
		title: "Test Train",
		status: "running",
		thoughts: [],
		relations: [],
		durationMinutes: 15,
		createdAt: "2026-02-23T10:00:00Z",
		pausedAt: null,
		completedAt: null,
		trainType: "brainstorm",
		...overrides,
	};
}

function renderPanel(train: TrainState): HTMLElement {
	const container = document.createElement("div");
	new TrainClosurePanel(container, train).render();
	return container;
}

// ── Tests ────────────────────────────────────────────────

describe("TrainClosurePanel", () => {
	describe("rendering", () => {
		it("renders train title", () => {
			const el = renderPanel(createTrain({ title: "My Brainstorm" }));
			expect(el.textContent).toContain("My Brainstorm");
		});

		it("renders type badge with label", () => {
			const el = renderPanel(createTrain({ trainType: "research" }));
			expect(el.textContent).toContain("Research");
		});

		it("renders no type badge for legacy trains without trainType", () => {
			const el = renderPanel(createTrain({ trainType: undefined }));
			expect(el.querySelector(".ft-badge")).toBeNull();
		});

		it("renders thought count", () => {
			const thoughts = [
				createThought("a", "First", 0),
				createThought("b", "Second", 1),
				createThought("c", "Third", 2),
			];
			const el = renderPanel(createTrain({ thoughts }));
			expect(el.textContent).toContain("3 thoughts");
		});

		it("renders branch count from relations", () => {
			const thoughts = [createThought("a", "Main"), createThought("b", "Branch")];
			const relations: ThoughtRelation[] = [
				{ fromId: "a", toId: "b", direction: "branch" },
			];
			const el = renderPanel(createTrain({ thoughts, relations }));
			expect(el.textContent).toContain("1 branch");
		});

		it("renders merge count when merges exist", () => {
			const thoughts = [createThought("a", "Main"), createThought("b", "Branch")];
			const relations: ThoughtRelation[] = [
				{ fromId: "a", toId: "b", direction: "branch" },
				{ fromId: "b", toId: "a", direction: "merge" },
			];
			const el = renderPanel(createTrain({ thoughts, relations }));
			expect(el.textContent).toContain("1 merge");
		});

		it("hides merge stat when no merges", () => {
			const el = renderPanel(createTrain({ thoughts: [createThought("a", "Solo")] }));
			expect(el.textContent).not.toContain("merge");
		});

		it("renders elapsed time in minutes", () => {
			const now = new Date();
			const start = new Date(now.getTime() - 5 * 60_000); // 5 min ago
			const el = renderPanel(createTrain({ createdAt: start.toISOString() }));
			expect(el.textContent).toContain("5 min");
		});
	});

	describe("key thoughts", () => {
		it("lists head node title", () => {
			const thoughts = [
				createThought("a", "Root", 0),
				createThought("b", "Middle", 1),
				createThought("c", "Head", 2),
			];
			const relations: ThoughtRelation[] = [
				{ fromId: "a", toId: "b", direction: "next" },
				{ fromId: "b", toId: "c", direction: "next" },
			];
			const el = renderPanel(createTrain({ thoughts, relations }));
			expect(el.textContent).toContain("Head");
		});

		it("lists branch origin titles", () => {
			const thoughts = [
				createThought("a", "Root", 0),
				createThought("b", "Branch Start", 1),
			];
			const relations: ThoughtRelation[] = [
				{ fromId: "a", toId: "b", direction: "branch" },
			];
			const el = renderPanel(createTrain({ thoughts, relations }));
			expect(el.textContent).toContain("Branch Start");
		});

		it("truncates at 5 key thoughts", () => {
			const thoughts = Array.from({ length: 8 }, (_, i) => createThought(`t${i}`, `Thought ${i}`, i));
			const relations: ThoughtRelation[] = [
				// Head is t0 (no next relations)
				// 7 branches
				...thoughts.slice(1).map((t) => ({
					fromId: "t0", toId: t.id, direction: "branch" as const,
				})),
			];
			const el = renderPanel(createTrain({ thoughts, relations }));
			const items = el.querySelectorAll(".ft-train-closure-thought-item");
			expect(items.length).toBe(5);
		});

		it("does not show key thoughts section when train has no thoughts", () => {
			const el = renderPanel(createTrain({ thoughts: [] }));
			expect(el.querySelector(".ft-train-closure-thoughts")).toBeNull();
		});
	});
});
