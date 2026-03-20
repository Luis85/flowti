import { describe, it, expect, beforeEach, vi } from "vitest";
import { FeatureLifecycleService } from "../../../src/domain/featureLifecycle/FeatureLifecycleService";
import type { ScannedPRD } from "../../../src/domain/featureLifecycle/FeatureLifecycleService";
import type { FeatureLifecycleState } from "../../../src/domain/featureLifecycle/types";
import { createDefaultGateContext, type GateContext } from "../../../src/domain/featureLifecycle/gateChecks";

// ── Mock Storage ─────────────────────────────────────────────

function createMockStorage(initialState?: Partial<FeatureLifecycleState>) {
	let stored: FeatureLifecycleState | null = initialState
		? { sessions: [], activeSession: null, ...initialState }
		: null;
	return {
		load: vi.fn(async () => stored),
		save: vi.fn(async (data: FeatureLifecycleState) => { stored = data; }),
		safeLoad: vi.fn(async (defaults: FeatureLifecycleState) => stored ?? defaults),
	};
}

// ── Mock EventBus ────────────────────────────────────────────

function createMockEventBus() {
	return {
		emit: vi.fn(async () => {}),
		on: vi.fn(() => () => {}),
	};
}

// ── Test PRD Data ────────────────────────────────────────────

function createTestPRD(overrides: Partial<ScannedPRD> = {}): ScannedPRD {
	return {
		path: "docs/features/Test Feature/Test Feature PRD.md",
		name: "Test Feature PRD",
		frontmatter: {
			type: "ProductRequirementsDocument",
			stage: "approved",
			domain: "Flowti",
			related_events: ["feature.scored"],
			maturity: "L2",
		},
		...overrides,
	};
}

// ── Service Factory ──────────────────────────────────────────

type ServiceOpts = ConstructorParameters<typeof FeatureLifecycleService>[0];

function createService(opts: {
	storage?: ReturnType<typeof createMockStorage>;
	eventBus?: ReturnType<typeof createMockEventBus>;
	prds?: ScannedPRD[];
	noScanner?: boolean;
	updateFrontmatter?: (path: string, key: string, value: string) => Promise<void>;
}) {
	const storage = opts.storage ?? createMockStorage();
	const eventBus = opts.eventBus ?? createMockEventBus();
	const prds = opts.prds ?? [createTestPRD()];
	const service = new FeatureLifecycleService({
		storage: storage as unknown as ServiceOpts["storage"],
		eventBus: eventBus as unknown as ServiceOpts["eventBus"],
		scanPRDs: opts.noScanner ? undefined : async () => prds,
		updateFrontmatter: opts.updateFrontmatter,
		deferVaultScan: false,
	});
	return { service, storage, eventBus };
}

// ── Tests ────────────────────────────────────────────────────

describe("FeatureLifecycleService", () => {
	let service: FeatureLifecycleService;
	let storage: ReturnType<typeof createMockStorage>;
	let eventBus: ReturnType<typeof createMockEventBus>;

	beforeEach(() => {
		const ctx = createService({});
		service = ctx.service;
		storage = ctx.storage;
		eventBus = ctx.eventBus;
	});

	describe("lifecycle", () => {
		it("loads state from storage", async () => {
			await service.load();
			expect(storage.load).toHaveBeenCalledOnce();
		});

		it("restores persisted sessions on load", async () => {
			const ctx = createService({
				storage: createMockStorage({
					sessions: [{
						featureName: "My Feature",
						startTime: "2026-03-06T10:00:00Z",
						endTime: "2026-03-06T11:00:00Z",
						filesCreated: [],
						filesModified: [],
						notes: "test",
						stageAtStart: "approved",
						stageAtEnd: "approved",
					}],
				}),
			});
			await ctx.service.load();
			expect(ctx.service.getState().sessions).toHaveLength(1);
			expect(ctx.service.getState().sessions[0].featureName).toBe("My Feature");
		});

		it("handles null storage state gracefully", async () => {
			const ctx = createService({ storage: createMockStorage() });
			await ctx.service.load();
			expect(ctx.service.getState().sessions).toEqual([]);
			expect(ctx.service.getState().activeSession).toBeNull();
		});

		it("saves state to storage", async () => {
			await service.load();
			await service.save();
			expect(storage.save).toHaveBeenCalledOnce();
		});
	});

	describe("scanFeatures", () => {
		it("scans PRDs from vault", async () => {
			await service.load();
			const features = service.getFeatures();
			expect(features).toHaveLength(1);
			expect(features[0].name).toBe("Test Feature");
		});

		it("strips ' PRD' suffix from file name", async () => {
			await service.load();
			expect(service.getFeatures()[0].name).toBe("Test Feature");
		});

		it("extracts file path", async () => {
			await service.load();
			expect(service.getFeatures()[0].filePath).toBe("docs/features/Test Feature/Test Feature PRD.md");
		});

		it("extracts domain from frontmatter", async () => {
			await service.load();
			expect(service.getFeatures()[0].domain).toBe("Flowti");
		});

		it("extracts related events from frontmatter", async () => {
			await service.load();
			expect(service.getFeatures()[0].relatedEvents).toEqual(["feature.scored"]);
		});

		it("extracts maturity from frontmatter", async () => {
			await service.load();
			expect(service.getFeatures()[0].maturity).toBe("L2");
		});

		it("returns empty array when no scanner is set", async () => {
			const ctx = createService({ noScanner: true });
			await ctx.service.load();
			expect(ctx.service.getFeatures()).toEqual([]);
		});

		it("can set scanner after construction", async () => {
			const ctx = createService({ noScanner: true });
			ctx.service.setScanner(async () => [createTestPRD()]);
			await ctx.service.scanFeatures();
			expect(ctx.service.getFeatures()).toHaveLength(1);
		});

		it("handles multiple PRDs", async () => {
			const ctx = createService({
				prds: [
					createTestPRD({ name: "Feature A PRD", frontmatter: { stage: "idea", domain: "D1" } }),
					createTestPRD({ name: "Feature B PRD", frontmatter: { stage: "done", domain: "D2" } }),
					createTestPRD({ name: "Feature C PRD", frontmatter: { stage: "draft", domain: "D1" } }),
				],
			});
			await ctx.service.load();
			expect(ctx.service.getFeatures()).toHaveLength(3);
		});
	});

	describe("stage normalization", () => {
		it("passes through valid stages", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "approved", domain: "D1" } })],
			});
			await ctx.service.load();
			expect(ctx.service.getFeatures()[0].stage).toBe("approved");
		});

		it("preserves raw stage value", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "approved", domain: "D1" } })],
			});
			await ctx.service.load();
			expect(ctx.service.getFeatures()[0].rawStage).toBe("approved");
		});

		it("defaults unknown stages to idea", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "random-value", domain: "D1" } })],
			});
			await ctx.service.load();
			expect(ctx.service.getFeatures()[0].stage).toBe("idea");
			expect(ctx.service.getFeatures()[0].rawStage).toBe("random-value");
		});

		it("defaults missing stage to idea", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { domain: "D1" } })],
			});
			await ctx.service.load();
			expect(ctx.service.getFeatures()[0].stage).toBe("idea");
		});
	});

	describe("getFeaturesByStage", () => {
		it("groups features by stage", async () => {
			const ctx = createService({
				prds: [
					createTestPRD({ name: "A PRD", frontmatter: { stage: "idea", domain: "D1" } }),
					createTestPRD({ name: "B PRD", frontmatter: { stage: "idea", domain: "D1" } }),
					createTestPRD({ name: "C PRD", frontmatter: { stage: "approved", domain: "D1" } }),
					createTestPRD({ name: "D PRD", frontmatter: { stage: "done", domain: "D1" } }),
				],
			});
			await ctx.service.load();
			const grouped = ctx.service.getFeaturesByStage();
			expect(grouped["idea"]).toHaveLength(2);
			expect(grouped["approved"]).toHaveLength(1);
			expect(grouped["done"]).toHaveLength(1);
			expect(grouped["draft"]).toHaveLength(0);
			expect(grouped["in-progress"]).toHaveLength(0);
			expect(grouped["review"]).toHaveLength(0);
		});

		it("returns empty arrays for all stages when no features", async () => {
			const ctx = createService({ prds: [] });
			await ctx.service.load();
			const grouped = ctx.service.getFeaturesByStage();
			expect(Object.keys(grouped)).toHaveLength(6);
			for (const features of Object.values(grouped)) {
				expect(features).toHaveLength(0);
			}
		});
	});

	describe("getFeature", () => {
		it("finds a feature by name", async () => {
			await service.load();
			const feature = service.getFeature("Test Feature");
			expect(feature).toBeDefined();
			expect(feature!.name).toBe("Test Feature");
		});

		it("returns undefined for unknown feature", async () => {
			await service.load();
			expect(service.getFeature("Nonexistent")).toBeUndefined();
		});
	});

	describe("FRI extraction via service", () => {
		it("extracts FRI from scored PRD", async () => {
			const ctx = createService({
				prds: [createTestPRD({
					frontmatter: {
						stage: "approved",
						domain: "Flowti",
						maturity_score_strategy: 5,
						maturity_score_scope: 5,
						maturity_score_architecture: 4,
						maturity_score_event_integration: 4,
						maturity_score_data_model: 4,
						maturity_score_ui_consistency: 3,
						maturity_score_validation_testing: 2,
					},
				})],
			});
			await ctx.service.load();
			const feature = ctx.service.getFeatures()[0];
			expect(feature.fri).not.toBeNull();
			expect(feature.fri!.total).toBe(27);
			expect(feature.fri!.level).toBe("integration-ready");
		});

		it("returns null FRI for unscored PRD", async () => {
			const ctx = createService({
				prds: [createTestPRD({
					frontmatter: { stage: "idea", domain: "D1" },
				})],
			});
			await ctx.service.load();
			expect(ctx.service.getFeatures()[0].fri).toBeNull();
		});
	});

	describe("prioritization extraction via service", () => {
		it("extracts prioritization from scored PRD", async () => {
			const ctx = createService({
				prds: [createTestPRD({
					frontmatter: {
						stage: "approved",
						domain: "Flowti",
						business_value: 5,
						implementation_cost: 4,
						maintenance_cost: 2,
						discovery_cost: 1,
						design_cost: 3,
						test_cost: 3,
						priority: 2,
					},
				})],
			});
			await ctx.service.load();
			const feature = ctx.service.getFeatures()[0];
			expect(feature.prioritization).not.toBeNull();
			expect(feature.prioritization!.dimensions.business_value).toBe(5);
			expect(feature.prioritization!.signal).toBe(2);
		});

		it("returns null prioritization for unscored PRD", async () => {
			const ctx = createService({
				prds: [createTestPRD({
					frontmatter: { stage: "idea", domain: "D1" },
				})],
			});
			await ctx.service.load();
			expect(ctx.service.getFeatures()[0].prioritization).toBeNull();
		});
	});

	describe("legacy stage normalization via service", () => {
		it.each([
			["new", "idea"],
			["open", "draft"],
			["planned", "approved"],
			["development", "in-progress"],
			["active", "in-progress"],
			["testing", "review"],
			["completed", "done"],
			["closed", "done"],
		] as const)("normalizes '%s' to '%s'", async (legacy, expected) => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: legacy, domain: "D1" } })],
			});
			await ctx.service.load();
			expect(ctx.service.getFeatures()[0].stage).toBe(expected);
		});
	});

	describe("advanceStage", () => {
		function passingProblemCtx(): GateContext {
			return {
				...createDefaultGateContext(),
				prdExists: true,
				hasProblemStatement: true,
				hasOutcome: true,
			};
		}

		it("advances idea → draft when problem gate passes", async () => {
			const updateFm = vi.fn(async () => {});
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "idea", domain: "Flowti" } })],
				updateFrontmatter: updateFm,
			});
			await ctx.service.load();

			const result = await ctx.service.advanceStage("Test Feature", "draft", passingProblemCtx());
			expect(result.success).toBe(true);
			expect(result.gateResult?.passed).toBe(true);
			expect(ctx.service.getFeature("Test Feature")?.stage).toBe("draft");
		});

		it("updates frontmatter via callback", async () => {
			const updateFm = vi.fn(async () => {});
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "idea", domain: "Flowti" } })],
				updateFrontmatter: updateFm,
			});
			await ctx.service.load();

			await ctx.service.advanceStage("Test Feature", "draft", passingProblemCtx());
			expect(updateFm).toHaveBeenCalledWith(
				"docs/features/Test Feature/Test Feature PRD.md",
				"stage",
				"draft",
			);
		});

		it("emits feature.stage.changed on success", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "idea", domain: "Flowti" } })],
			});
			await ctx.service.load();

			await ctx.service.advanceStage("Test Feature", "draft", passingProblemCtx());
			const emitCalls = ctx.eventBus.emit.mock.calls as unknown[][];
			const stageChanged = emitCalls.find((c) => c[0] === "feature.stage.changed");
			expect(stageChanged).toBeDefined();
			expect(stageChanged![1]).toMatchObject({
				featureName: "Test Feature",
				previousStage: "idea",
				newStage: "draft",
			});
		});

		it("emits feature.gate.passed on success", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "idea", domain: "Flowti" } })],
			});
			await ctx.service.load();

			await ctx.service.advanceStage("Test Feature", "draft", passingProblemCtx());
			const emitCalls = ctx.eventBus.emit.mock.calls as unknown[][];
			const gatePassed = emitCalls.find((c) => c[0] === "feature.gate.passed");
			expect(gatePassed).toBeDefined();
			expect(gatePassed![1]).toMatchObject({
				featureName: "Test Feature",
				gateName: "problem",
				stage: "draft",
			});
		});

		it("rejects invalid transition (skip stages)", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "idea", domain: "Flowti" } })],
			});
			await ctx.service.load();

			const result = await ctx.service.advanceStage("Test Feature", "approved", passingProblemCtx());
			expect(result.success).toBe(false);
			expect(result.error).toContain("Invalid transition");
			expect(ctx.service.getFeature("Test Feature")?.stage).toBe("idea");
		});

		it("rejects backward transition", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "approved", domain: "Flowti" } })],
			});
			await ctx.service.load();

			const result = await ctx.service.advanceStage("Test Feature", "draft", createDefaultGateContext());
			expect(result.success).toBe(false);
			expect(result.error).toContain("Invalid transition");
		});

		it("rejects unknown feature", async () => {
			const ctx = createService({});
			await ctx.service.load();

			const result = await ctx.service.advanceStage("Nonexistent", "draft", createDefaultGateContext());
			expect(result.success).toBe(false);
			expect(result.error).toContain("not found");
		});

		it("fails when gate check fails", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "idea", domain: "Flowti" } })],
			});
			await ctx.service.load();

			// Default context has all false — problem gate will fail
			const result = await ctx.service.advanceStage("Test Feature", "draft", createDefaultGateContext());
			expect(result.success).toBe(false);
			expect(result.gateResult?.passed).toBe(false);
			expect(ctx.service.getFeature("Test Feature")?.stage).toBe("idea");
		});

		it("emits feature.gate.failed when gate fails", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "idea", domain: "Flowti" } })],
			});
			await ctx.service.load();

			await ctx.service.advanceStage("Test Feature", "draft", createDefaultGateContext());
			const emitCalls = ctx.eventBus.emit.mock.calls as unknown[][];
			const gateFailed = emitCalls.find((c) => c[0] === "feature.gate.failed");
			expect(gateFailed).toBeDefined();
			expect(gateFailed![1]).toMatchObject({
				featureName: "Test Feature",
				gateName: "problem",
			});
		});

		it("works without updateFrontmatter callback", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "idea", domain: "Flowti" } })],
				// no updateFrontmatter
			});
			await ctx.service.load();

			const result = await ctx.service.advanceStage("Test Feature", "draft", passingProblemCtx());
			expect(result.success).toBe(true);
			expect(ctx.service.getFeature("Test Feature")?.stage).toBe("draft");
		});

		it("can set updateFrontmatter after construction", async () => {
			const updateFm = vi.fn(async () => {});
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "idea", domain: "Flowti" } })],
			});
			ctx.service.setUpdateFrontmatter(updateFm);
			await ctx.service.load();

			await ctx.service.advanceStage("Test Feature", "draft", passingProblemCtx());
			expect(updateFm).toHaveBeenCalledOnce();
		});
	});

	describe("session tracking", () => {
		it("starts a session for a feature", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "idea", domain: "Flowti" } })],
			});
			await ctx.service.load();

			const result = ctx.service.startSession("Test Feature");
			expect(result).toBe(true);
			expect(ctx.service.getActiveSession()).not.toBeNull();
			expect(ctx.service.getActiveSession()?.featureName).toBe("Test Feature");
		});

		it("emits feature.session.started", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "idea", domain: "Flowti" } })],
			});
			await ctx.service.load();

			ctx.service.startSession("Test Feature");
			const emitCalls = ctx.eventBus.emit.mock.calls as unknown[][];
			const sessionStarted = emitCalls.find((c) => c[0] === "feature.session.started");
			expect(sessionStarted).toBeDefined();
			expect(sessionStarted![1]).toMatchObject({ featureName: "Test Feature" });
		});

		it("rejects starting a second session", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "idea", domain: "Flowti" } })],
			});
			await ctx.service.load();

			ctx.service.startSession("Test Feature");
			const result = ctx.service.startSession("Test Feature");
			expect(result).toBe(false);
		});

		it("rejects starting session for unknown feature", async () => {
			const ctx = createService({});
			await ctx.service.load();

			const result = ctx.service.startSession("Nonexistent");
			expect(result).toBe(false);
		});

		it("ends a session and returns the record", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "idea", domain: "Flowti" } })],
			});
			await ctx.service.load();

			ctx.service.startSession("Test Feature");
			const record = ctx.service.endSession("some notes");
			expect(record).not.toBeNull();
			expect(record!.featureName).toBe("Test Feature");
			expect(record!.notes).toBe("some notes");
			expect(record!.endTime).not.toBeNull();
		});

		it("emits feature.session.ended", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "idea", domain: "Flowti" } })],
			});
			await ctx.service.load();

			ctx.service.startSession("Test Feature");
			ctx.service.endSession();
			const emitCalls = ctx.eventBus.emit.mock.calls as unknown[][];
			const sessionEnded = emitCalls.find((c) => c[0] === "feature.session.ended");
			expect(sessionEnded).toBeDefined();
		});

		it("clears active session on end", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "idea", domain: "Flowti" } })],
			});
			await ctx.service.load();

			ctx.service.startSession("Test Feature");
			ctx.service.endSession();
			expect(ctx.service.getActiveSession()).toBeNull();
		});

		it("returns null when ending with no active session", async () => {
			const ctx = createService({});
			await ctx.service.load();

			const record = ctx.service.endSession();
			expect(record).toBeNull();
		});

		it("persists sessions in state", async () => {
			const ctx = createService({
				prds: [createTestPRD({ frontmatter: { stage: "idea", domain: "Flowti" } })],
			});
			await ctx.service.load();

			ctx.service.startSession("Test Feature");
			ctx.service.endSession("session 1");
			expect(ctx.service.getState().sessions).toHaveLength(1);
		});

		it("retrieves sessions by feature name", async () => {
			const ctx = createService({
				prds: [
					createTestPRD({ name: "A PRD", frontmatter: { stage: "idea", domain: "D1" } }),
					createTestPRD({ name: "B PRD", frontmatter: { stage: "idea", domain: "D1" } }),
				],
			});
			await ctx.service.load();

			ctx.service.startSession("A");
			ctx.service.endSession("session A");
			ctx.service.startSession("B");
			ctx.service.endSession("session B");

			expect(ctx.service.getSessionsForFeature("A")).toHaveLength(1);
			expect(ctx.service.getSessionsForFeature("B")).toHaveLength(1);
			expect(ctx.service.getSessionsForFeature("C")).toHaveLength(0);
		});
	});
});
