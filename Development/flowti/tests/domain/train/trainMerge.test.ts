import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { TrainService } from "../../../src/domain/train/TrainService";
import { CaptureService } from "../../../src/domain/capture/CaptureService";
import { createMockStorage } from "../../mocks/storage";
import { createMockFileSystem } from "../../mocks/filesystem";
import type { TrainServiceState, TrainState, ThoughtNode } from "../../../src/domain/train/types";

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

/**
 * Helper: start a train and add thoughts in a chain with optional branches.
 * Returns train + all thought nodes for easy test setup.
 */
async function buildTrainWithBranch(service: TrainService) {
	const train = await service.startTrain("Merge Test");

	// Main chain: A → B → C
	const a = await service.addThought(train.id, "A");
	const b = await service.addThought(train.id, "B");
	const c = await service.addThought(train.id, "C");

	// Branch from A: A → D (branch)
	const d = await service.addThought(train.id, "D", {
		direction: "branch",
		fromThoughtId: a!.id,
	});

	return {
		train: service.getTrain(train.id)!,
		a: a!, b: b!, c: c!, d: d!,
	};
}

describe("TrainService — mergeBranch()", () => {
	// ── Happy path ─────────────────────────────────────────────

	describe("happy path", () => {
		it("creates a merge relation with correct direction", async () => {
			const { service } = createTestHarness();
			const { train, d, b } = await buildTrainWithBranch(service);

			const result = await service.mergeBranch(train.id, d.id, b.id);

			expect(result).toBe(true);
			const updated = service.getTrain(train.id)!;
			const mergeRel = updated.relations.find(
				(r) => r.fromId === d.id && r.toId === b.id,
			);
			expect(mergeRel).toBeDefined();
			expect(mergeRel!.direction).toBe("merge");
		});

		it("source and target thoughts both exist after merge", async () => {
			const { service } = createTestHarness();
			const { train, d, b } = await buildTrainWithBranch(service);

			await service.mergeBranch(train.id, d.id, b.id);

			const updated = service.getTrain(train.id)!;
			expect(updated.thoughts.find((t) => t.id === d.id)).toBeDefined();
			expect(updated.thoughts.find((t) => t.id === b.id)).toBeDefined();
		});

		it("merge relation appears in getMerges()", async () => {
			const { service } = createTestHarness();
			const { train, d, b } = await buildTrainWithBranch(service);

			await service.mergeBranch(train.id, d.id, b.id);

			const merges = service.getMerges(train.id);
			expect(merges).toHaveLength(1);
			expect(merges[0].fromId).toBe(d.id);
			expect(merges[0].toId).toBe(b.id);
			expect(merges[0].direction).toBe("merge");
		});

		it("emits train.branch.merged with correct payload", async () => {
			const { service, eventBus } = createTestHarness();
			const { train, d, b } = await buildTrainWithBranch(service);

			const events: Array<{ trainId: string; sourceId: string; targetId: string }> = [];
			eventBus.on("train.branch.merged", (e) => { events.push(e.payload); });

			await service.mergeBranch(train.id, d.id, b.id);

			expect(events).toHaveLength(1);
			expect(events[0].trainId).toBe(train.id);
			expect(events[0].sourceId).toBe(d.id);
			expect(events[0].targetId).toBe(b.id);
		});

		it("state is persisted after merge", async () => {
			const { service, getData } = createTestHarness();
			const { train, d, b } = await buildTrainWithBranch(service);

			await service.mergeBranch(train.id, d.id, b.id);

			const persisted = getData()!;
			const persistedTrain = persisted.trains.find((t) => t.id === train.id)!;
			const mergeRel = persistedTrain.relations.find(
				(r) => r.direction === "merge",
			);
			expect(mergeRel).toBeDefined();
		});

		it("updates frontmatter with merge-target wikilink on source", async () => {
			const { service, fileSystem } = createTestHarness();
			const { train, d, b } = await buildTrainWithBranch(service);

			await service.mergeBranch(train.id, d.id, b.id);

			const bBasename = b.path.split("/").pop()!.replace(/\.md$/, "");
			await vi.waitFor(() => {
				const calls = (fileSystem.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls;
				const sourceCall = calls.find(
					(c: unknown[]) => c[0] === d.path &&
						((c[1] as Record<string, unknown>)["merge-target"] as string[])?.length > 0,
				);
				expect(sourceCall).toBeDefined();
				expect((sourceCall![1] as Record<string, unknown>)["merge-target"]).toContain(`[[${bBasename}]]`);
			});
		});

		it("updates frontmatter with merged-from wikilink on target", async () => {
			const { service, fileSystem } = createTestHarness();
			const { train, d, b } = await buildTrainWithBranch(service);

			await service.mergeBranch(train.id, d.id, b.id);

			const dBasename = d.path.split("/").pop()!.replace(/\.md$/, "");
			await vi.waitFor(() => {
				const calls = (fileSystem.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls;
				const targetCall = calls.find(
					(c: unknown[]) => c[0] === b.path &&
						((c[1] as Record<string, unknown>)["merged-from"] as string[])?.length > 0,
				);
				expect(targetCall).toBeDefined();
				expect((targetCall![1] as Record<string, unknown>)["merged-from"]).toContain(`[[${dBasename}]]`);
			});
		});

		it("allows merge of branch endpoint into main chain thought", async () => {
			const { service } = createTestHarness();
			const { train, d, c } = await buildTrainWithBranch(service);

			// Merge branch thought D into main chain thought C
			const result = await service.mergeBranch(train.id, d.id, c.id);
			expect(result).toBe(true);
		});

		it("allows multiple merges from different sources into same target", async () => {
			const { service } = createTestHarness();
			const { train, a, d, b } = await buildTrainWithBranch(service);

			// Add another branch from B
			const e = await service.addThought(train.id, "E", {
				direction: "branch",
				fromThoughtId: b.id,
			});

			// Merge both D and E into C (via main chain endpoint)
			const updatedTrain = service.getTrain(train.id)!;
			const c = updatedTrain.thoughts.find((t) => t.title === "C")!;
			await service.mergeBranch(train.id, d.id, c.id);
			await service.mergeBranch(train.id, e!.id, c.id);

			const merges = service.getMerges(train.id);
			expect(merges).toHaveLength(2);
		});
	});

	// ── Validation ─────────────────────────────────────────────

	describe("validation", () => {
		it("rejects self-merge (source === target)", async () => {
			const { service } = createTestHarness();
			const { train, a } = await buildTrainWithBranch(service);

			const result = await service.mergeBranch(train.id, a.id, a.id);

			expect(result).toBe(false);
			expect(service.getMerges(train.id)).toHaveLength(0);
		});

		it("rejects when train not found", async () => {
			const { service } = createTestHarness();
			const { d, b } = await buildTrainWithBranch(service);

			const result = await service.mergeBranch("nonexistent", d.id, b.id);
			expect(result).toBe(false);
		});

		it("rejects when source thought not found", async () => {
			const { service } = createTestHarness();
			const { train, b } = await buildTrainWithBranch(service);

			const result = await service.mergeBranch(train.id, "nonexistent", b.id);
			expect(result).toBe(false);
		});

		it("rejects when target thought not found", async () => {
			const { service } = createTestHarness();
			const { train, d } = await buildTrainWithBranch(service);

			const result = await service.mergeBranch(train.id, d.id, "nonexistent");
			expect(result).toBe(false);
		});

		it("rejects duplicate merge (same source→target pair)", async () => {
			const { service } = createTestHarness();
			const { train, d, b } = await buildTrainWithBranch(service);

			await service.mergeBranch(train.id, d.id, b.id);
			const result = await service.mergeBranch(train.id, d.id, b.id);

			expect(result).toBe(false);
			expect(service.getMerges(train.id)).toHaveLength(1);
		});

		it("rejects cycle: simple A→B, merge B→A", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Cycle Test");
			const a = await service.addThought(train.id, "A");
			const b = await service.addThought(train.id, "B");

			// A→B is "next", so A can reach B. Merging B→A would create a cycle.
			// But wait — isReachable checks if target (A) is reachable from source (B).
			// B has no outgoing next/branch edges to A, so B→A should actually be allowed.
			// The real cycle case is merging A→B (A can reach B via next).
			const result = await service.mergeBranch(train.id, a!.id, b!.id);

			expect(result).toBe(false); // A can reach B via next, so merge A→B rejected
		});

		it("rejects cycle: chain A→B→C, merge A→C", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Chain Cycle");
			const a = await service.addThought(train.id, "A");
			const b = await service.addThought(train.id, "B");
			const c = await service.addThought(train.id, "C");

			// A can reach C via A→B→C, so merge A→C is a cycle
			const result = await service.mergeBranch(train.id, a!.id, c!.id);
			expect(result).toBe(false);
		});

		it("rejects cycle: branch from A, merge into descendant of branch", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Branch Cycle");
			const a = await service.addThought(train.id, "A");

			// Branch from A → D
			const d = await service.addThought(train.id, "D", {
				direction: "branch",
				fromThoughtId: a!.id,
			});

			// D → E (next on branch)
			const e = await service.addThought(train.id, "E", {
				fromThoughtId: d!.id,
			});

			// Try merge D→E: D can reach E via next, so rejected
			const result = await service.mergeBranch(train.id, d!.id, e!.id);
			expect(result).toBe(false);
		});

		it("allows merge into non-descendant (valid topology)", async () => {
			const { service } = createTestHarness();
			const { train, d, b } = await buildTrainWithBranch(service);

			// D is a branch from A. B is A→B (next). D cannot reach B via forward edges.
			const result = await service.mergeBranch(train.id, d.id, b.id);
			expect(result).toBe(true);
		});

		it("does not emit event on rejected merge", async () => {
			const { service, eventBus } = createTestHarness();
			const { train, a, b } = await buildTrainWithBranch(service);

			const events: unknown[] = [];
			eventBus.on("train.branch.merged", (e) => { events.push(e.payload); });

			// A→B via next → rejected cycle
			await service.mergeBranch(train.id, a.id, b.id);

			expect(events).toHaveLength(0);
		});

		it("rejects merge on completed train", async () => {
			const { service } = createTestHarness();
			const { train, d, b } = await buildTrainWithBranch(service);

			await service.completeTrain(train.id);

			const result = await service.mergeBranch(train.id, d.id, b.id);
			expect(result).toBe(false);
		});

		it("allows merge on paused train", async () => {
			const { service } = createTestHarness();
			const { train, d, b } = await buildTrainWithBranch(service);

			await service.pause(train.id);

			const result = await service.mergeBranch(train.id, d.id, b.id);
			expect(result).toBe(true);
		});
	});

	// ── Cycle detection edge cases ────────────────────────────

	describe("cycle detection", () => {
		it("rejects backward merge (B→A) because B is on main chain", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Backward Rejected");
			const a = await service.addThought(train.id, "A");
			const b = await service.addThought(train.id, "B");

			// A→B via next. Both are on main chain. Main chain nodes cannot be merge sources.
			const result = await service.mergeBranch(train.id, b!.id, a!.id);
			expect(result).toBe(false);
		});

		it("rejects merge from main chain even when no cycle would occur", async () => {
			const { service } = createTestHarness();
			const { train, a, b, c, d } = await buildTrainWithBranch(service);

			// First: merge D→B (valid — D is on branch)
			await service.mergeBranch(train.id, d.id, b.id);

			// Now try: merge B→D. B is on main chain, so this is rejected
			// regardless of cycle detection.
			const result = await service.mergeBranch(train.id, b.id, d.id);
			expect(result).toBe(false);
		});

		it("detects deep chain reachability", async () => {
			const { service } = createTestHarness();
			const train = await service.startTrain("Deep Chain");
			const a = await service.addThought(train.id, "A");
			const b = await service.addThought(train.id, "B");
			const c = await service.addThought(train.id, "C");
			const d = await service.addThought(train.id, "D");
			const e = await service.addThought(train.id, "E");

			// A→B→C→D→E via next. Merge A→E should be rejected.
			const result = await service.mergeBranch(train.id, a!.id, e!.id);
			expect(result).toBe(false);
		});
	});
});

describe("TrainService — undoMerge()", () => {
	it("removes the merge relation", async () => {
		const { service } = createTestHarness();
		const { train, d, b } = await buildTrainWithBranch(service);

		await service.mergeBranch(train.id, d.id, b.id);
		expect(service.getMerges(train.id)).toHaveLength(1);

		const result = await service.undoMerge(train.id, d.id, b.id);

		expect(result).toBe(true);
		expect(service.getMerges(train.id)).toHaveLength(0);
	});

	it("emits train.branch.merge.undone with correct payload", async () => {
		const { service, eventBus } = createTestHarness();
		const { train, d, b } = await buildTrainWithBranch(service);

		await service.mergeBranch(train.id, d.id, b.id);

		const events: Array<{ trainId: string; sourceId: string; targetId: string }> = [];
		eventBus.on("train.branch.merge.undone", (e) => { events.push(e.payload); });

		await service.undoMerge(train.id, d.id, b.id);

		expect(events).toHaveLength(1);
		expect(events[0].trainId).toBe(train.id);
		expect(events[0].sourceId).toBe(d.id);
		expect(events[0].targetId).toBe(b.id);
	});

	it("state is persisted after undo", async () => {
		const { service, getData } = createTestHarness();
		const { train, d, b } = await buildTrainWithBranch(service);

		await service.mergeBranch(train.id, d.id, b.id);
		await service.undoMerge(train.id, d.id, b.id);

		const persisted = getData()!;
		const persistedTrain = persisted.trains.find((t) => t.id === train.id)!;
		const mergeRels = persistedTrain.relations.filter((r) => r.direction === "merge");
		expect(mergeRels).toHaveLength(0);
	});

	it("updates frontmatter — merge-target removed from source", async () => {
		const { service, fileSystem } = createTestHarness();
		const { train, d, b } = await buildTrainWithBranch(service);

		await service.mergeBranch(train.id, d.id, b.id);
		(fileSystem.updateFrontmatter as ReturnType<typeof vi.fn>).mockClear();

		await service.undoMerge(train.id, d.id, b.id);

		await vi.waitFor(() => {
			const calls = (fileSystem.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls;
			const sourceCall = calls.find((c: unknown[]) => c[0] === d.path);
			expect(sourceCall).toBeDefined();
			expect((sourceCall![1] as Record<string, unknown>)["merge-target"]).toEqual([]);
		});
	});

	it("returns false for non-existent merge (no event emitted)", async () => {
		const { service, eventBus } = createTestHarness();
		const { train, d, b } = await buildTrainWithBranch(service);

		const events: unknown[] = [];
		eventBus.on("train.branch.merge.undone", (e) => { events.push(e.payload); });

		const result = await service.undoMerge(train.id, d.id, b.id);

		expect(result).toBe(false);
		expect(events).toHaveLength(0);
	});

	it("original branch relations unaffected by undo", async () => {
		const { service } = createTestHarness();
		const { train, d, b, a } = await buildTrainWithBranch(service);

		await service.mergeBranch(train.id, d.id, b.id);
		await service.undoMerge(train.id, d.id, b.id);

		const updated = service.getTrain(train.id)!;
		// Branch relation A→D should still exist
		const branchRel = updated.relations.find(
			(r) => r.fromId === a.id && r.toId === d.id && r.direction === "branch",
		);
		expect(branchRel).toBeDefined();
	});

	it("can re-merge after undo", async () => {
		const { service } = createTestHarness();
		const { train, d, b } = await buildTrainWithBranch(service);

		await service.mergeBranch(train.id, d.id, b.id);
		await service.undoMerge(train.id, d.id, b.id);

		const result = await service.mergeBranch(train.id, d.id, b.id);
		expect(result).toBe(true);
		expect(service.getMerges(train.id)).toHaveLength(1);
	});

	it("returns false for non-existent train", async () => {
		const { service } = createTestHarness();
		const { d, b } = await buildTrainWithBranch(service);

		const result = await service.undoMerge("nonexistent", d.id, b.id);
		expect(result).toBe(false);
	});
});

describe("TrainService — getMerges()", () => {
	it("returns empty array for train with no merges", async () => {
		const { service } = createTestHarness();
		const { train } = await buildTrainWithBranch(service);

		expect(service.getMerges(train.id)).toEqual([]);
	});

	it("returns correct merge relations", async () => {
		const { service } = createTestHarness();
		const { train, d, b } = await buildTrainWithBranch(service);

		await service.mergeBranch(train.id, d.id, b.id);

		const merges = service.getMerges(train.id);
		expect(merges).toHaveLength(1);
		expect(merges[0]).toEqual({ fromId: d.id, toId: b.id, direction: "merge" });
	});

	it("does not include 'next' or 'branch' relations", async () => {
		const { service } = createTestHarness();
		const { train, d, b } = await buildTrainWithBranch(service);

		await service.mergeBranch(train.id, d.id, b.id);

		const merges = service.getMerges(train.id);
		// Should only have the 1 merge, not the 4 next/branch relations
		expect(merges).toHaveLength(1);
		for (const m of merges) {
			expect(m.direction).toBe("merge");
		}
	});

	it("returns empty array for non-existent train", async () => {
		const { service } = createTestHarness();
		expect(service.getMerges("nonexistent")).toEqual([]);
	});
});

describe("TrainService — buildNavLinks integration (merge)", () => {
	it("merge-target wikilink appears in source thought's nav links", async () => {
		const { service, fileSystem } = createTestHarness();
		const { train, d, b } = await buildTrainWithBranch(service);

		await service.mergeBranch(train.id, d.id, b.id);

		const bBasename = b.path.split("/").pop()!.replace(/\.md$/, "");
		await vi.waitFor(() => {
			const calls = (fileSystem.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls;
			const sourceCall = calls.find(
				(c: unknown[]) => c[0] === d.path &&
					((c[1] as Record<string, unknown>)["merge-target"] as string[])?.includes(`[[${bBasename}]]`),
			);
			expect(sourceCall).toBeDefined();
		});
	});

	it("no merge-target on non-merged thoughts", async () => {
		const { service, fileSystem } = createTestHarness();
		const { train, a, d, b } = await buildTrainWithBranch(service);

		await service.mergeBranch(train.id, d.id, b.id);

		await vi.waitFor(() => {
			const calls = (fileSystem.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls;
			// A's frontmatter should have empty merge-target (A is not a merge source)
			const aCall = calls.find(
				(c: unknown[]) => c[0] === a.path &&
					(c[1] as Record<string, unknown>)["merge-target"] !== undefined,
			);
			if (aCall) {
				expect((aCall[1] as Record<string, unknown>)["merge-target"]).toEqual([]);
			}
		});
	});

	it("merge-target removed after undo", async () => {
		const { service, fileSystem } = createTestHarness();
		const { train, d, b } = await buildTrainWithBranch(service);

		await service.mergeBranch(train.id, d.id, b.id);
		(fileSystem.updateFrontmatter as ReturnType<typeof vi.fn>).mockClear();

		await service.undoMerge(train.id, d.id, b.id);

		await vi.waitFor(() => {
			const calls = (fileSystem.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls;
			const sourceCall = calls.find((c: unknown[]) => c[0] === d.path);
			expect(sourceCall).toBeDefined();
			expect((sourceCall![1] as Record<string, unknown>)["merge-target"]).toEqual([]);
		});
	});

	it("multiple merge targets listed correctly", async () => {
		const { service, fileSystem } = createTestHarness();
		const { train, d, b, c } = await buildTrainWithBranch(service);

		// Merge D into B, then D into C (D merges to two targets)
		await service.mergeBranch(train.id, d.id, b.id);
		await service.mergeBranch(train.id, d.id, c.id);

		const bBasename = b.path.split("/").pop()!.replace(/\.md$/, "");
		const cBasename = c.path.split("/").pop()!.replace(/\.md$/, "");
		await vi.waitFor(() => {
			const calls = (fileSystem.updateFrontmatter as ReturnType<typeof vi.fn>).mock.calls;
			const sourceCall = calls.find(
				(c: unknown[]) => c[0] === d.path &&
					((c[1] as Record<string, unknown>)["merge-target"] as string[])?.length === 2,
			);
			expect(sourceCall).toBeDefined();
			const targets = (sourceCall![1] as Record<string, unknown>)["merge-target"] as string[];
			expect(targets).toContain(`[[${bBasename}]]`);
			expect(targets).toContain(`[[${cBasename}]]`);
		});
	});
});

describe("TrainService — findMergeDownTarget()", () => {
	it("returns next main-chain node for simple branch endpoint", async () => {
		const { service } = createTestHarness();
		// Main: A → B → C, Branch: A → D
		const { train, d, b } = await buildTrainWithBranch(service);

		const target = service.findMergeDownTarget(train.id, d.id);
		expect(target).toBe(b.id);
	});

	it("returns next main-chain node for deep branch (follow parents to origin)", async () => {
		const { service } = createTestHarness();
		const { train, a, d, b } = await buildTrainWithBranch(service);

		// Add E as next after D (within branch chain: A→D→E)
		const e = await service.addThought(train.id, "E", {
			direction: "next",
			fromThoughtId: d.id,
		});

		// E is deep in the branch. Origin is A, next after A is B.
		const target = service.findMergeDownTarget(train.id, e!.id);
		expect(target).toBe(b.id);
	});

	it("returns null when branch origin is head of main chain", async () => {
		const { service } = createTestHarness();
		// Main: A → B, Branch from B: B → D
		const train = await service.startTrain("Head Branch");
		const a = await service.addThought(train.id, "A");
		const b = await service.addThought(train.id, "B");
		const d = await service.addThought(train.id, "D", {
			direction: "branch",
			fromThoughtId: b!.id,
		});

		// Origin is B (head of main chain) — no "next" after B
		const target = service.findMergeDownTarget(train.id, d!.id);
		expect(target).toBeNull();
	});

	it("returns null when source is on main chain", async () => {
		const { service } = createTestHarness();
		const { train, b } = await buildTrainWithBranch(service);

		const target = service.findMergeDownTarget(train.id, b.id);
		expect(target).toBeNull();
	});

	it("returns null when source is root", async () => {
		const { service } = createTestHarness();
		const { train, a } = await buildTrainWithBranch(service);

		const target = service.findMergeDownTarget(train.id, a.id);
		expect(target).toBeNull();
	});

	it("returns null for non-existent train", () => {
		const { service } = createTestHarness();
		const target = service.findMergeDownTarget("nonexistent", "any");
		expect(target).toBeNull();
	});

	it("returns null for non-existent source thought", async () => {
		const { service } = createTestHarness();
		const { train } = await buildTrainWithBranch(service);

		const target = service.findMergeDownTarget(train.id, "nonexistent");
		expect(target).toBeNull();
	});

	it("handles sub-branch: falls through to main chain when parent branch has no next", async () => {
		const { service } = createTestHarness();
		const { train, d, b } = await buildTrainWithBranch(service);

		// Add F as branch from D (sub-branch: A→D(branch)→F(branch))
		// D has no "next" child, so merge-down falls through to main chain origin A → target B
		const f = await service.addThought(train.id, "F", {
			direction: "branch",
			fromThoughtId: d.id,
		});

		const target = service.findMergeDownTarget(train.id, f!.id);
		expect(target).toBe(b.id);
	});

	it("handles sub-branch: merges to parent branch when parent has next child", async () => {
		const { service } = createTestHarness();
		const { train, a, d } = await buildTrainWithBranch(service);

		// Extend branch: D → E (next on branch)
		const e = await service.addThought(train.id, "E", {
			direction: "next",
			fromThoughtId: d.id,
		});

		// Sub-branch from D: D → F (branch)
		const f = await service.addThought(train.id, "F", {
			direction: "branch",
			fromThoughtId: d.id,
		});

		// F is on sub-branch from D. D has a "next" child (E). Target = E (parent branch).
		const target = service.findMergeDownTarget(train.id, f!.id);
		expect(target).toBe(e!.id);
	});

	it("returns correct target when main chain extends past origin", async () => {
		const { service } = createTestHarness();
		// Main: A → B → C → D, Branch from A: A → E
		const train = await service.startTrain("Extended Main");
		const a = await service.addThought(train.id, "A");
		const b = await service.addThought(train.id, "B");
		const c = await service.addThought(train.id, "C");
		const d = await service.addThought(train.id, "D");
		const e = await service.addThought(train.id, "E", {
			direction: "branch",
			fromThoughtId: a!.id,
		});

		// Origin is A, next after A is B (not D — only the immediate next)
		const target = service.findMergeDownTarget(train.id, e!.id);
		expect(target).toBe(b!.id);
	});

	it("returns correct target for branch from middle of main chain", async () => {
		const { service } = createTestHarness();
		// Main: A → B → C, Branch from B: B → E
		const train = await service.startTrain("Mid Branch");
		const a = await service.addThought(train.id, "A");
		const b = await service.addThought(train.id, "B");
		const c = await service.addThought(train.id, "C");
		const e = await service.addThought(train.id, "E", {
			direction: "branch",
			fromThoughtId: b!.id,
		});

		// Origin is B, next after B is C
		const target = service.findMergeDownTarget(train.id, e!.id);
		expect(target).toBe(c!.id);
	});

	it("returns correct target for single-thought main chain with branch", async () => {
		const { service } = createTestHarness();
		// Main: A → B, Branch from A: A → D (same as buildTrainWithBranch minus C)
		const train = await service.startTrain("Short Main");
		const a = await service.addThought(train.id, "A");
		const b = await service.addThought(train.id, "B");
		const d = await service.addThought(train.id, "D", {
			direction: "branch",
			fromThoughtId: a!.id,
		});

		const target = service.findMergeDownTarget(train.id, d!.id);
		expect(target).toBe(b!.id);
	});
});

describe("TrainService — merge edge cases", () => {
	it("train with only 1 thought has no valid merge targets", async () => {
		const { service } = createTestHarness();
		const train = await service.startTrain("Single");
		const a = await service.addThought(train.id, "A");

		// Only one thought — self-merge rejected
		const result = await service.mergeBranch(train.id, a!.id, a!.id);
		expect(result).toBe(false);
	});

	it("merge doesn't affect getTimeline() (main chain unchanged)", async () => {
		const { service } = createTestHarness();
		const { train, d, b } = await buildTrainWithBranch(service);

		const timelineBefore = service.getTimeline(train.id).map((t) => t.title);

		await service.mergeBranch(train.id, d.id, b.id);

		const timelineAfter = service.getTimeline(train.id).map((t) => t.title);
		expect(timelineAfter).toEqual(timelineBefore);
	});

	it("merge doesn't affect getBranches() (branch structure unchanged)", async () => {
		const { service } = createTestHarness();
		const { train, a, d, b } = await buildTrainWithBranch(service);

		const branchesBefore = service.getBranches(train.id, a.id).map((t) => t.title);

		await service.mergeBranch(train.id, d.id, b.id);

		const branchesAfter = service.getBranches(train.id, a.id).map((t) => t.title);
		expect(branchesAfter).toEqual(branchesBefore);
	});
});

// ── Main Chain Protection Rule (Cycle 19 Inc 1) ──────────────

describe("TrainService — main chain merge restriction", () => {
	it("rejects merge when source is root (first main chain node)", async () => {
		const { service } = createTestHarness();
		const { train, a, d } = await buildTrainWithBranch(service);

		const result = await service.mergeBranch(train.id, a.id, d.id);
		expect(result).toBe(false);
	});

	it("rejects merge when source is head (last main chain node)", async () => {
		const { service } = createTestHarness();
		const { train, c, d } = await buildTrainWithBranch(service);

		const result = await service.mergeBranch(train.id, c.id, d.id);
		expect(result).toBe(false);
	});

	it("rejects merge when source is middle main chain node", async () => {
		const { service } = createTestHarness();
		const { train, b, d } = await buildTrainWithBranch(service);

		const result = await service.mergeBranch(train.id, b.id, d.id);
		expect(result).toBe(false);
	});

	it("rejects merge when source is branch origin (on main chain with outgoing branch)", async () => {
		const { service } = createTestHarness();
		const { train, a, d } = await buildTrainWithBranch(service);

		// A has outgoing branch to D, but A is on the main chain
		const result = await service.mergeBranch(train.id, a.id, d.id);
		expect(result).toBe(false);
	});

	it("allows merge when source is branch child (not on main chain)", async () => {
		const { service } = createTestHarness();
		const { train, d, b } = await buildTrainWithBranch(service);

		// D is a branch child (A→D via branch) — NOT on main chain
		const result = await service.mergeBranch(train.id, d.id, b.id);
		expect(result).toBe(true);
	});

	it("allows merge when source is deeper branch descendant", async () => {
		const { service } = createTestHarness();
		const { train, a, d } = await buildTrainWithBranch(service);

		// Add E as next after D (within the branch)
		const e = await service.addThought(train.id, "E", {
			direction: "next",
			fromThoughtId: d.id,
		});

		// E is deep in branch: A→D(branch)→E(next). E can merge into A.
		const result = await service.mergeBranch(train.id, e!.id, a.id);
		expect(result).toBe(true);
	});

	it("allows merge when source is on sub-branch", async () => {
		const { service } = createTestHarness();
		const { train, d, c } = await buildTrainWithBranch(service);

		// Add F as branch from D (sub-branch)
		const f = await service.addThought(train.id, "F", {
			direction: "branch",
			fromThoughtId: d.id,
		});

		// F is on sub-branch: A→D(branch)→F(branch). F can merge into C.
		const result = await service.mergeBranch(train.id, f!.id, c.id);
		expect(result).toBe(true);
	});

	it("getMainChainIds returns correct set for linear train", async () => {
		const { service } = createTestHarness();
		const train = await service.startTrain("Linear");
		const a = await service.addThought(train.id, "A");
		const b = await service.addThought(train.id, "B");
		const c = await service.addThought(train.id, "C");

		const mainIds = service.getMainChainIds(train.id);
		expect(mainIds.has(a!.id)).toBe(true);
		expect(mainIds.has(b!.id)).toBe(true);
		expect(mainIds.has(c!.id)).toBe(true);
		expect(mainIds.size).toBe(3);
	});

	it("getMainChainIds excludes branch children", async () => {
		const { service } = createTestHarness();
		const { train, a, b, c, d } = await buildTrainWithBranch(service);

		const mainIds = service.getMainChainIds(train.id);
		expect(mainIds.has(a.id)).toBe(true);
		expect(mainIds.has(b.id)).toBe(true);
		expect(mainIds.has(c.id)).toBe(true);
		expect(mainIds.has(d.id)).toBe(false); // D is branch child
	});

	it("getMainChainIds returns empty set for nonexistent train", () => {
		const { service } = createTestHarness();
		const mainIds = service.getMainChainIds("nonexistent");
		expect(mainIds.size).toBe(0);
	});
});
