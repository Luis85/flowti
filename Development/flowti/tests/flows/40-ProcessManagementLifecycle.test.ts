/**
 * Flow 40: Process Management + Lifecycle Sessions
 *
 * Integration test covering:
 * - Process canvas parsing and validation
 * - Phase mapping for features
 * - Session feature binding and cross-domain events
 * - Process compliance computation
 * - Session metrics aggregation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import { parseProcessCanvas, isProcessCanvas } from "../../src/domain/process/canvasParser";
import { validateProcess } from "../../src/domain/process/validation";
import { ProcessService } from "../../src/domain/process/ProcessService";
import { generateDevelopmentLifecycle, generateDevelopmentLifecycleCanvas } from "../../src/domain/process/referenceProcess";
import { getActivePhase, getPhaseProgress, getStageForPhase } from "../../src/domain/process/phaseMapping";
import { computeFeatureSessionMetrics } from "../../src/domain/featureLifecycle/sessionMetrics";
import type { FeatureSessionRecord } from "../../src/domain/featureLifecycle/types";
import type { FeatureEntry } from "../../src/domain/featureLifecycle/types";

// ── Helpers ─────────────────────────────────────────────────

function makeFeature(stage: FeatureEntry["stage"] = "in-progress"): FeatureEntry {
	return {
		name: "Process Management",
		filePath: "docs/features/Process Management/Process Mapping PRD.md",
		stage,
		rawStage: stage,
		domain: "Flowti",
		fri: null,
		prioritization: null,
		pbis: [],
		relatedEvents: ["process.opened"],
		maturity: "L2",
	};
}

// ── Tests ───────────────────────────────────────────────────

describe("Flow 40: Process Management + Lifecycle Sessions", () => {
	let eventBus: EventBus;

	beforeEach(() => {
		eventBus = new EventBus();
	});

	describe("canvas → definition → validation pipeline", () => {
		it("parses and validates the reference Development Lifecycle canvas", () => {
			const canvasJson = generateDevelopmentLifecycleCanvas();
			const canvas = JSON.parse(canvasJson);

			expect(isProcessCanvas(canvas)).toBe(true);

			const def = parseProcessCanvas(canvas, "Development Lifecycle", "dev.canvas");
			expect(def).toBeDefined();
			expect(def!.nodes).toHaveLength(10);
			expect(def!.edges).toHaveLength(11);

			const result = validateProcess(def!);
			expect(result.valid).toBe(true);
			expect(result.errorCount).toBe(0);
		});

		it("rejects a canvas with no process nodes", () => {
			const canvas = {
				nodes: [{ id: "n1", type: "text", text: "Regular note", x: 0, y: 0, width: 100, height: 50 }],
				edges: [],
			};
			expect(isProcessCanvas(canvas)).toBe(false);
		});
	});

	describe("ProcessService scan + validate", () => {
		it("scans and validates reference process", async () => {
			const service = new ProcessService(eventBus);
			const canvasJson = generateDevelopmentLifecycleCanvas();

			service.setScanner(vi.fn().mockResolvedValue([
				{ name: "Development Lifecycle", filePath: "dev.canvas", content: canvasJson },
			]));

			const processes = await service.scanProcesses();
			expect(processes).toHaveLength(1);

			const validation = service.validateProcess(processes[0]);
			expect(validation.valid).toBe(true);

			const summary = service.getValidationSummary(processes[0]);
			expect(summary.errorCount).toBe(0);
		});
	});

	describe("phase mapping for features", () => {
		it("maps feature stages to lifecycle phases", () => {
			const feature = makeFeature("in-progress");
			const activePhase = getActivePhase(feature);
			expect(activePhase).toBeDefined();
			expect(activePhase!.stage).toBe("in-progress");
			expect(activePhase!.phase).toBeGreaterThanOrEqual(6);
		});

		it("computes progress percentage", () => {
			const ideaFeature = makeFeature("idea");
			const doneFeature = makeFeature("done");

			expect(getPhaseProgress(ideaFeature)).toBe(10); // 1 of 10
			expect(getPhaseProgress(doneFeature)).toBe(100); // 10 of 10
		});

		it("maps phase numbers back to stages", () => {
			expect(getStageForPhase(1)).toBe("idea");
			expect(getStageForPhase(6)).toBe("in-progress");
			expect(getStageForPhase(10)).toBe("done");
		});
	});

	describe("session metrics aggregation", () => {
		it("aggregates session records for a feature", () => {
			const records: FeatureSessionRecord[] = [
				{
					featureName: "Process Management",
					startTime: "2026-03-06T10:00:00.000Z",
					endTime: "2026-03-06T10:25:00.000Z",
					filesCreated: ["types.ts"],
					filesModified: ["events.ts", "catalog.ts"],
					notes: "Added types and events",
					stageAtStart: "in-progress",
					stageAtEnd: "in-progress",
				},
				{
					featureName: "Process Management",
					startTime: "2026-03-06T14:00:00.000Z",
					endTime: "2026-03-06T14:50:00.000Z",
					filesCreated: ["validation.ts"],
					filesModified: [],
					notes: "Added validation rules",
					stageAtStart: "in-progress",
					stageAtEnd: "in-progress",
				},
			];

			const metrics = computeFeatureSessionMetrics(records);
			expect(metrics.totalSessions).toBe(2);
			expect(metrics.totalTimeMs).toBe(25 * 60_000 + 50 * 60_000);
			expect(metrics.totalFilesChanged).toBe(4);
			expect(metrics.lastSessionEnd).toBe("2026-03-06T14:50:00.000Z");
		});
	});

	describe("process definition generator", () => {
		it("generates a valid ProcessDefinition with all types", () => {
			const def = generateDevelopmentLifecycle();
			expect(def.name).toBe("Development Lifecycle");
			expect(def.nodes).toHaveLength(10);
			expect(def.edges).toHaveLength(11);

			const types = new Set(def.nodes.map(n => n.type));
			expect(types.size).toBe(4);
		});

		it("every node has phase metadata matching LIFECYCLE_PHASES", () => {
			const def = generateDevelopmentLifecycle();
			for (let i = 0; i < def.nodes.length; i++) {
				expect(def.nodes[i].metadata.phase).toBe(i + 1);
			}
		});
	});

	describe("cross-domain event flow", () => {
		it("process.canvas.synced is emitted on scan", async () => {
			const events: string[] = [];
			eventBus.on("process.canvas.synced", () => { events.push("synced"); });

			const service = new ProcessService(eventBus);
			service.setScanner(vi.fn().mockResolvedValue([
				{ name: "Dev", filePath: "dev.canvas", content: generateDevelopmentLifecycleCanvas() },
			]));
			await service.scanProcesses();

			expect(events).toHaveLength(1);
		});
	});
});
