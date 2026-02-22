import { describe, it, expect } from "vitest";
import type { TrainState, ThoughtNode, ThoughtRelation } from "../../../src/domain/train/types";
import { generateTrainSummary } from "../../../src/domain/train/TrainSummaryWriter";

// ── Test helpers ──────────────────────────────────────────────

function makeThought(id: string, title: string, order: number, createdAt?: string): ThoughtNode {
	return {
		id,
		trainId: "train_1",
		title,
		path: `thoughts/${title}.md`,
		createdAt: createdAt ?? `2026-02-22T10:${String(order).padStart(2, "0")}:00.000Z`,
		order,
	};
}

function makeRelation(fromId: string, toId: string, direction: ThoughtRelation["direction"]): ThoughtRelation {
	return { fromId, toId, direction };
}

function makeTrain(overrides?: Partial<TrainState>): TrainState {
	return {
		id: "train_1",
		sessionId: "session_1",
		title: "My Train",
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

// ── Tests ─────────────────────────────────────────────────────

describe("TrainSummaryWriter", () => {
	describe("generateTrainSummary", () => {
		describe("frontmatter", () => {
			it("includes correct type and train title", () => {
				const train = makeTrain({ title: "Architecture Brainstorm" });
				const md = generateTrainSummary(train);

				expect(md).toContain("type: TrainSummary");
				expect(md).toContain('train: "Architecture Brainstorm"');
			});

			it("includes status, thought count, dates", () => {
				const t1 = makeThought("t1", "First", 0);
				const t2 = makeThought("t2", "Second", 1);
				const train = makeTrain({
					thoughts: [t1, t2],
					relations: [makeRelation("t1", "t2", "next")],
				});
				const md = generateTrainSummary(train);

				expect(md).toContain("status: completed");
				expect(md).toContain("thoughts: 2");
				expect(md).toContain("created: 2026-02-22T10:00:00.000Z");
				expect(md).toContain("completed: 2026-02-22T10:30:00.000Z");
			});

			it("includes branch and merge counts", () => {
				const t1 = makeThought("t1", "Root", 0);
				const t2 = makeThought("t2", "Next", 1);
				const t3 = makeThought("t3", "Branch", 2);
				const train = makeTrain({
					thoughts: [t1, t2, t3],
					relations: [
						makeRelation("t1", "t2", "next"),
						makeRelation("t1", "t3", "branch"),
						makeRelation("t3", "t2", "merge"),
					],
				});
				const md = generateTrainSummary(train);

				expect(md).toContain("branches: 1");
				expect(md).toContain("merges: 1");
			});

			it("computes duration from timestamps", () => {
				const train = makeTrain({
					createdAt: "2026-02-22T10:00:00.000Z",
					completedAt: "2026-02-22T10:45:00.000Z",
				});
				const md = generateTrainSummary(train);

				expect(md).toContain("duration: 45");
			});

			it("escapes double quotes in train title", () => {
				const train = makeTrain({ title: 'Train "with quotes"' });
				const md = generateTrainSummary(train);

				expect(md).toContain('train: "Train \\"with quotes\\""');
			});
		});

		describe("heading and stats", () => {
			it("renders train title as h1 heading", () => {
				const train = makeTrain({ title: "Design Sprint" });
				const md = generateTrainSummary(train);

				expect(md).toContain("# Train Summary: Design Sprint");
			});

			it("renders stats section with correct counts", () => {
				const t1 = makeThought("t1", "Root", 0);
				const t2 = makeThought("t2", "Next", 1);
				const t3 = makeThought("t3", "Branch", 2);
				const train = makeTrain({
					thoughts: [t1, t2, t3],
					relations: [
						makeRelation("t1", "t2", "next"),
						makeRelation("t1", "t3", "branch"),
					],
				});
				const md = generateTrainSummary(train);

				expect(md).toContain("**Thoughts:** 3 (2 main + 1 branched)");
				expect(md).toContain("**Merges:** 0");
			});
		});

		describe("timeline section", () => {
			it("lists main chain thoughts in order with timestamps", () => {
				const t1 = makeThought("t1", "Initial idea", 0, "2026-02-22T10:00:00.000Z");
				const t2 = makeThought("t2", "Expand on idea", 1, "2026-02-22T10:05:00.000Z");
				const t3 = makeThought("t3", "Conclusion", 2, "2026-02-22T10:10:00.000Z");
				const train = makeTrain({
					thoughts: [t1, t2, t3],
					relations: [
						makeRelation("t1", "t2", "next"),
						makeRelation("t2", "t3", "next"),
					],
				});
				const md = generateTrainSummary(train);

				expect(md).toContain("1. [[Initial idea]] (10:00) — root");
				expect(md).toContain("2. [[Expand on idea]] (10:05)");
				expect(md).toContain("3. [[Conclusion]] (10:10)");
			});

			it("marks root thought with — root suffix", () => {
				const t1 = makeThought("t1", "Root", 0);
				const train = makeTrain({
					thoughts: [t1],
				});
				const md = generateTrainSummary(train);

				expect(md).toContain("1. [[Root]] (10:00) — root");
			});

			it("shows branch children inline under their parent", () => {
				const t1 = makeThought("t1", "Main idea", 0, "2026-02-22T10:00:00.000Z");
				const t2 = makeThought("t2", "Continue", 1, "2026-02-22T10:05:00.000Z");
				const t3 = makeThought("t3", "Side thought", 2, "2026-02-22T10:03:00.000Z");
				const train = makeTrain({
					thoughts: [t1, t2, t3],
					relations: [
						makeRelation("t1", "t2", "next"),
						makeRelation("t1", "t3", "branch"),
					],
				});
				const md = generateTrainSummary(train);

				// Branch should appear indented under t1
				const lines = md.split("\n");
				const mainLine = lines.findIndex((l) => l.includes("[[Main idea]]"));
				expect(mainLine).toBeGreaterThan(-1);
				expect(lines[mainLine + 1]).toContain("↗ [[Side thought]]");
			});
		});

		describe("branches section", () => {
			it("groups branch children by origin", () => {
				const t1 = makeThought("t1", "Root", 0);
				const t2 = makeThought("t2", "Branch A", 1);
				const t3 = makeThought("t3", "Branch B", 2);
				const train = makeTrain({
					thoughts: [t1, t2, t3],
					relations: [
						makeRelation("t1", "t2", "branch"),
						makeRelation("t1", "t3", "branch"),
					],
				});
				const md = generateTrainSummary(train);

				expect(md).toContain("## Branches");
				expect(md).toContain('Branch from "[[Root]]": [[Branch A]], [[Branch B]]');
			});

			it("omits branches section when no branches exist", () => {
				const t1 = makeThought("t1", "Root", 0);
				const t2 = makeThought("t2", "Next", 1);
				const train = makeTrain({
					thoughts: [t1, t2],
					relations: [makeRelation("t1", "t2", "next")],
				});
				const md = generateTrainSummary(train);

				expect(md).not.toContain("## Branches");
			});
		});

		describe("merges section", () => {
			it("lists merge pairs as source → target", () => {
				const t1 = makeThought("t1", "Main", 0);
				const t2 = makeThought("t2", "Next", 1);
				const t3 = makeThought("t3", "Branch idea", 2);
				const train = makeTrain({
					thoughts: [t1, t2, t3],
					relations: [
						makeRelation("t1", "t2", "next"),
						makeRelation("t1", "t3", "branch"),
						makeRelation("t3", "t2", "merge"),
					],
				});
				const md = generateTrainSummary(train);

				expect(md).toContain("## Merges");
				expect(md).toContain("[[Branch idea]] → [[Next]]");
			});

			it("omits merges section when no merges exist", () => {
				const t1 = makeThought("t1", "Root", 0);
				const train = makeTrain({ thoughts: [t1] });
				const md = generateTrainSummary(train);

				expect(md).not.toContain("## Merges");
			});
		});

		describe("edge cases", () => {
			it("produces valid markdown for an empty train (0 thoughts)", () => {
				const train = makeTrain();
				const md = generateTrainSummary(train);

				expect(md).toContain("type: TrainSummary");
				expect(md).toContain("thoughts: 0");
				expect(md).toContain("**Thoughts:** 0 (0 main + 0 branched)");
				expect(md).not.toContain("## Timeline");
				expect(md).not.toContain("## Branches");
				expect(md).not.toContain("## Merges");
			});

			it("produces valid markdown for a single thought", () => {
				const t1 = makeThought("t1", "Only thought", 0);
				const train = makeTrain({ thoughts: [t1] });
				const md = generateTrainSummary(train);

				expect(md).toContain("thoughts: 1");
				expect(md).toContain("## Timeline");
				expect(md).toContain("1. [[Only thought]]");
				expect(md).not.toContain("## Branches");
				expect(md).not.toContain("## Merges");
			});

			it("handles completedAt being null", () => {
				const train = makeTrain({
					status: "running",
					completedAt: null,
				});
				const md = generateTrainSummary(train);

				expect(md).toContain("completed: ");
				expect(md).toContain("status: running");
			});

			it("handles multiple branches from different origins", () => {
				const t1 = makeThought("t1", "Root", 0);
				const t2 = makeThought("t2", "Second", 1);
				const t3 = makeThought("t3", "Branch from root", 2);
				const t4 = makeThought("t4", "Branch from second", 3);
				const train = makeTrain({
					thoughts: [t1, t2, t3, t4],
					relations: [
						makeRelation("t1", "t2", "next"),
						makeRelation("t1", "t3", "branch"),
						makeRelation("t2", "t4", "branch"),
					],
				});
				const md = generateTrainSummary(train);

				expect(md).toContain('Branch from "[[Root]]": [[Branch from root]]');
				expect(md).toContain('Branch from "[[Second]]": [[Branch from second]]');
			});
		});
	});
});
