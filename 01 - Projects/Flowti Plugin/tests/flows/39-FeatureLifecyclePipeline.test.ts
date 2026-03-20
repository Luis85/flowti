/**
 * Flow 39: Feature Lifecycle Pipeline
 *
 * Integration test covering the full feature lifecycle:
 * scan PRDs → gate checks → stage transitions → session tracking.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { FeatureLifecycleService } from "../../src/domain/featureLifecycle/FeatureLifecycleService";
import type { ScannedPRD } from "../../src/domain/featureLifecycle/FeatureLifecycleService";
import type { FeatureLifecycleState, FeatureStage } from "../../src/domain/featureLifecycle/types";
import { createDefaultGateContext, type GateContext } from "../../src/domain/featureLifecycle/gateChecks";
import { createMockStorage, collectEvents } from "./testHelpers";

/** Build a realistic scanned PRD with frontmatter. */
function buildPRD(name: string, overrides: Record<string, unknown> = {}): ScannedPRD {
	return {
		path: `Development/flowti/docs/prd/${name} PRD.md`,
		name: `${name} PRD`,
		frontmatter: {
			type: "PRD",
			stage: "idea",
			domain: "analytics",
			maturity: null,
			related_events: [],
			...overrides,
		},
	};
}

/** Build a GateContext that passes the Problem Gate (idea → draft). */
function passingProblemCtx(): GateContext {
	return {
		...createDefaultGateContext(),
		prdExists: true,
		hasProblemStatement: true,
		hasOutcome: true,
	};
}

/** Build a GateContext that passes the Design Gate (draft → approved). */
function passingDesignCtx(): GateContext {
	return {
		...passingProblemCtx(),
		hasScope: true,
		functionalRequirementCount: 5,
		hasEventImpact: true,
	};
}

/** Build a GateContext that passes the Readiness Gate (approved → in-progress). */
function passingReadinessCtx(): GateContext {
	return {
		...passingDesignCtx(),
		acceptanceCriteriaCount: 5,
		hasDataModel: true,
		hasTechnicalReview: true,
	};
}

/** Build a GateContext that passes the Build Gate (in-progress → review). */
function passingBuildCtx(): GateContext {
	return {
		...passingReadinessCtx(),
		pbisDone: 3,
		buildPasses: true,
		testsExist: true,
	};
}

/** Build a GateContext that passes the Quality Gate (review → done). */
function passingQualityCtx(): GateContext {
	return {
		...passingBuildCtx(),
		acceptanceCriteriaChecked: 5,
		docsUpdated: true,
		tasmScore: 20,
	};
}

describe("Flow 39: Feature Lifecycle Pipeline", () => {
	let eventBus: IEventBus;
	let svc: FeatureLifecycleService;
	let mock: ReturnType<typeof createMockStorage<FeatureLifecycleState>>;
	let updateFrontmatter: ReturnType<typeof vi.fn<(path: string, key: string, value: string) => Promise<void>>>;

	beforeEach(async () => {
		eventBus = new EventBus();
		mock = createMockStorage<FeatureLifecycleState>();
		updateFrontmatter = vi.fn<(path: string, key: string, value: string) => Promise<void>>();
	});

	async function createService(prds: ScannedPRD[] = []) {
		svc = new FeatureLifecycleService({
			storage: mock.storage,
			eventBus,
			scanPRDs: () => Promise.resolve(prds),
			updateFrontmatter,
			deferVaultScan: false,
		});
		await svc.load();
		return svc;
	}

	// ── Scan → Gate → Transition ─────────────────────────────

	describe("scan → gate → transition", () => {
		it("scans PRDs and advances through all stages", async () => {
			const prds = [
				buildPRD("Dashboard", {
					stage: "idea",
					domain: "analytics",
					maturity_score_strategy: 3,
					maturity_score_scope: 3,
					maturity_score_architecture: 3,
					maturity_score_event_integration: 3,
					maturity_score_data_model: 3,
					maturity_score_ui_consistency: 3,
					maturity_score_validation_testing: 3,
				}),
			];
			await createService(prds);

			const events = collectEvents(eventBus, "*");
			const feature = svc.getFeature("Dashboard")!;
			expect(feature).toBeDefined();
			expect(feature.stage).toBe("idea");
			expect(feature.fri!.total).toBe(21);

			// idea → draft (Problem Gate)
			const r1 = await svc.advanceStage("Dashboard", "draft", passingProblemCtx());
			expect(r1.success).toBe(true);
			expect(svc.getFeature("Dashboard")!.stage).toBe("draft");

			// draft → approved (Design Gate) — FRI 21 ≥ 11
			const r2 = await svc.advanceStage("Dashboard", "approved", passingDesignCtx());
			expect(r2.success).toBe(true);
			expect(svc.getFeature("Dashboard")!.stage).toBe("approved");

			// approved → in-progress (Readiness Gate) — FRI 21 ≥ 19
			const r3 = await svc.advanceStage("Dashboard", "in-progress", passingReadinessCtx());
			expect(r3.success).toBe(true);
			expect(svc.getFeature("Dashboard")!.stage).toBe("in-progress");

			// in-progress → review (Build Gate)
			const r4 = await svc.advanceStage("Dashboard", "review", passingBuildCtx());
			expect(r4.success).toBe(true);
			expect(svc.getFeature("Dashboard")!.stage).toBe("review");

			// review → done (Quality Gate)
			const r5 = await svc.advanceStage("Dashboard", "done", passingQualityCtx());
			expect(r5.success).toBe(true);
			expect(svc.getFeature("Dashboard")!.stage).toBe("done");

			// Verify frontmatter was updated 5 times
			expect(updateFrontmatter).toHaveBeenCalledTimes(5);

			// Verify event stream includes all transitions
			expect(events.filter((e) => e === "feature.stage.changed")).toHaveLength(5);
			expect(events.filter((e) => e === "feature.gate.passed")).toHaveLength(5);
		});

		it("blocks transition when gate fails", async () => {
			const prds = [buildPRD("Broken", { stage: "idea", domain: "analytics" })];
			await createService(prds);

			const events = collectEvents(eventBus, "*");

			// Attempt idea → draft with empty context (no PRD, no problem, no outcome)
			const result = await svc.advanceStage("Broken", "draft", createDefaultGateContext());
			expect(result.success).toBe(false);
			expect(result.gateResult!.passed).toBe(false);
			expect(svc.getFeature("Broken")!.stage).toBe("idea"); // unchanged

			expect(events).toContain("feature.gate.failed");
			expect(events).not.toContain("feature.stage.changed");
		});

		it("rejects invalid transition (stage skip)", async () => {
			const prds = [buildPRD("Skip", { stage: "idea" })];
			await createService(prds);

			const result = await svc.advanceStage("Skip", "approved", passingDesignCtx());
			expect(result.success).toBe(false);
			expect(result.error).toContain("Invalid transition");
		});
	});

	// ── Session Tracking ─────────────────────────────────────

	describe("session tracking with stage transitions", () => {
		it("tracks session across a stage transition", async () => {
			const prds = [buildPRD("Auth", {
				stage: "idea",
				domain: "user",
				maturity_score_strategy: 3,
				maturity_score_scope: 3,
				maturity_score_architecture: 3,
				maturity_score_event_integration: 3,
				maturity_score_data_model: 3,
				maturity_score_ui_consistency: 3,
				maturity_score_validation_testing: 3,
			})];
			await createService(prds);

			const events = collectEvents(eventBus, "*");

			// Start session
			expect(svc.startSession("Auth")).toBe(true);
			expect(svc.getActiveSession()).not.toBeNull();

			// Advance stage during session
			await svc.advanceStage("Auth", "draft", passingProblemCtx());
			expect(svc.getFeature("Auth")!.stage).toBe("draft");

			// End session
			const record = svc.endSession("Completed Problem Gate");
			expect(record).not.toBeNull();
			// Both stageAtStart and stageAtEnd read current stage at endSession() time
			expect(record!.stageAtStart).toBe("draft");
			expect(record!.stageAtEnd).toBe("draft");
			expect(record!.notes).toBe("Completed Problem Gate");
			expect(svc.getActiveSession()).toBeNull();

			// Verify events
			expect(events).toContain("feature.session.started");
			expect(events).toContain("feature.stage.changed");
			expect(events).toContain("feature.session.ended");
		});
	});

	// ── Multi-Feature Pipeline ───────────────────────────────

	describe("multi-feature pipeline", () => {
		it("manages multiple features at different stages", async () => {
			const prds = [
				buildPRD("Alpha", { stage: "idea", domain: "core" }),
				buildPRD("Beta", { stage: "draft", domain: "analytics", maturity_score_strategy: 3, maturity_score_scope: 3, maturity_score_architecture: 3, maturity_score_event_integration: 3, maturity_score_data_model: 0, maturity_score_ui_consistency: 0, maturity_score_validation_testing: 0 }),
				buildPRD("Gamma", { stage: "done", domain: "ui" }),
			];
			await createService(prds);

			const byStage = svc.getFeaturesByStage();
			expect(byStage["idea"]).toHaveLength(1);
			expect(byStage["draft"]).toHaveLength(1);
			expect(byStage["done"]).toHaveLength(1);
			expect(byStage["approved"]).toHaveLength(0);

			// Advance Alpha: idea → draft
			const r1 = await svc.advanceStage("Alpha", "draft", passingProblemCtx());
			expect(r1.success).toBe(true);

			// Beta has FRI = 12 (≥11), advance: draft → approved
			expect(svc.getFeature("Beta")!.fri!.total).toBe(12);
			const r2 = await svc.advanceStage("Beta", "approved", passingDesignCtx());
			expect(r2.success).toBe(true);

			// Verify updated grouping
			const updated = svc.getFeaturesByStage();
			expect(updated["idea"]).toHaveLength(0);
			expect(updated["draft"]).toHaveLength(1); // Alpha moved here
			expect(updated["approved"]).toHaveLength(1); // Beta moved here
			expect(updated["done"]).toHaveLength(1); // Gamma unchanged
		});
	});

	// ── Empty State and Edge Cases ───────────────────────────

	describe("empty state and edge cases", () => {
		it("handles no scanner (empty feature list)", async () => {
			svc = new FeatureLifecycleService({
				storage: mock.storage,
				eventBus,
			});
			await svc.load();

			expect(svc.getFeatures()).toHaveLength(0);
			expect(svc.getFeaturesByStage()["idea"]).toHaveLength(0);
		});

		it("handles scanner returning empty array", async () => {
			await createService([]);
			expect(svc.getFeatures()).toHaveLength(0);
		});

		it("handles advance on unknown feature", async () => {
			await createService([]);
			const result = await svc.advanceStage("Ghost", "draft", passingProblemCtx());
			expect(result.success).toBe(false);
			expect(result.error).toContain("not found");
		});
	});

	// ── Malformed Frontmatter ────────────────────────────────

	describe("malformed frontmatter resilience", () => {
		it("handles missing stage (defaults to idea)", async () => {
			const prds = [buildPRD("NoStage", { stage: undefined })];
			await createService(prds);
			expect(svc.getFeature("NoStage")!.stage).toBe("idea");
		});

		it("handles legacy stage names", async () => {
			const prds = [buildPRD("Legacy", { stage: "in_progress" })];
			await createService(prds);
			expect(svc.getFeature("Legacy")!.stage).toBe("in-progress");
		});

		it("handles garbage stage (defaults to idea)", async () => {
			const prds = [buildPRD("Garbage", { stage: "xyzzy-nonsense" })];
			await createService(prds);
			expect(svc.getFeature("Garbage")!.stage).toBe("idea");
		});

		it("handles invalid FRI scores (non-numeric defaults to null)", async () => {
			const prds = [buildPRD("BadScores", {
				maturity_score_strategy: "not-a-number",
				maturity_score_scope: "",
			})];
			await createService(prds);
			const feature = svc.getFeature("BadScores")!;
			// Zod coerces invalid values — NaN gets caught, empty string → null
			expect(feature.fri).toBeNull(); // no valid scores
		});

		it("handles missing domain (defaults to unknown)", async () => {
			const prds: ScannedPRD[] = [{
				path: "docs/prd/Orphan PRD.md",
				name: "Orphan PRD",
				frontmatter: {},
			}];
			await createService(prds);
			const feature = svc.getFeature("Orphan")!;
			expect(feature.domain).toBe("unknown");
			expect(feature.stage).toBe("idea");
		});
	});
});
