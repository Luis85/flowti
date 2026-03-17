/**
 * Flow 38: Journey Builder Canvas Round-Trip
 *
 * Tests end-to-end fidelity of the canvas sync pipeline:
 * buildJourneyCanvas() → parseJourneyCanvas() → identity
 *
 * Also validates preview runner integration and dual-input detection.
 *
 * Key domain functions under test:
 *   buildJourneyCanvas  (canvasSync.ts)   — JSON → Canvas
 *   parseJourneyCanvas  (canvasParser.ts)  — Canvas → JSON
 *   isJourneyCanvas     (canvasParser.ts)  — Canvas detection
 *   runPreview           (previewRunner.ts) — Step/action validation
 */
import { describe, it, expect, beforeEach } from "vitest";
import { buildJourneyCanvas, type CanvasSyncInput } from "../../src/domain/journeyBuilder/canvasSync";
import { parseJourneyCanvas, isJourneyCanvas } from "../../src/domain/journeyBuilder/canvasParser";
import { runPreview, validateAction, validateStep } from "../../src/domain/journeyBuilder/previewRunner";
import type { CanvasData } from "obsidian/canvas";
import type { JourneyAction } from "../../src/domain/journeyBuilder/types";

// ── Helpers ────────────────────────────────────────────────────────

let idCounter = 0;
function deterministicId(): string { return `id-${++idCounter}`; }
function resetIds(): void { idCounter = 0; }

function makeSyncInput(overrides?: Partial<CanvasSyncInput>): CanvasSyncInput {
	return {
		journey: "Test Journey",
		description: "A regression test journey",
		startEvent: "app.opened",
		endEvent: "app.closed",
		activeStepIndex: 1,
		steps: [
			{ id: "s1", title: "Open Hub", description: "Opens the hub view", actions: [{ tool: "command", id: "flowti:open-hub" }, { tool: "wait", ms: 500 }] },
			{ id: "s2", title: "Click Button", description: "Clicks the primary button", actions: [{ tool: "click", selector: ".primary-btn" }] },
			{ id: "s3", title: "Verify Result", description: "", actions: [{ tool: "assert", type: "visible", selector: ".result" }] },
		],
		...overrides,
	};
}

/** Convert buildJourneyCanvas output to CanvasData shape for the parser. */
function toCanvasData(result: ReturnType<typeof buildJourneyCanvas>): CanvasData {
	return { nodes: result.nodes, edges: result.edges } as CanvasData;
}

// ── Tests ──────────────────────────────────────────────────────────

describe("Flow 38: Journey Builder Canvas Round-Trip", () => {
	beforeEach(() => resetIds());

	describe("Journey A: Canvas sync round-trip fidelity", () => {
		it("recovers step titles and order from generated canvas", () => {
			const input = makeSyncInput();
			const canvas = buildJourneyCanvas(input, deterministicId);
			const parsed = parseJourneyCanvas(toCanvasData(canvas));

			expect(parsed).not.toBeNull();
			expect(parsed!.steps).toHaveLength(3);
			expect(parsed!.steps[0].title).toBe("Open Hub");
			expect(parsed!.steps[1].title).toBe("Click Button");
			expect(parsed!.steps[2].title).toBe("Verify Result");
		});

		it("preserves start and end events", () => {
			const input = makeSyncInput({ startEvent: "user.login", endEvent: "user.logout" });
			const canvas = buildJourneyCanvas(input, deterministicId);
			const parsed = parseJourneyCanvas(toCanvasData(canvas));

			expect(parsed!.startEvent).toBe("user.login");
			expect(parsed!.endEvent).toBe("user.logout");
		});

		it("preserves active step index via color", () => {
			const input = makeSyncInput({ activeStepIndex: 2 });
			const canvas = buildJourneyCanvas(input, deterministicId);
			const parsed = parseJourneyCanvas(toCanvasData(canvas));

			expect(parsed!.activeStepIndex).toBe(2);
		});

		it("preserves background images on step groups", () => {
			const input = makeSyncInput({
				steps: [
					{ id: "s1", title: "Step 1", description: "With image", actions: [], backgroundImage: "assets/mockup.png" },
					{ id: "s2", title: "Step 2", description: "No image", actions: [] },
				],
			});
			const canvas = buildJourneyCanvas(input, deterministicId);
			const parsed = parseJourneyCanvas(toCanvasData(canvas));

			expect(parsed!.steps[0].backgroundImage).toBe("assets/mockup.png");
			expect(parsed!.steps[1].backgroundImage).toBeUndefined();
		});

		it("round-trips a zero-step journey (START → END only)", () => {
			const input = makeSyncInput({ steps: [], startEvent: "begin", endEvent: "finish" });
			const canvas = buildJourneyCanvas(input, deterministicId);
			const parsed = parseJourneyCanvas(toCanvasData(canvas));

			expect(parsed!.steps).toHaveLength(0);
			expect(parsed!.startEvent).toBe("begin");
			expect(parsed!.endEvent).toBe("finish");
		});

		it("preserves step descriptions in inner text nodes", () => {
			const input = makeSyncInput();
			const canvas = buildJourneyCanvas(input, deterministicId);
			const parsed = parseJourneyCanvas(toCanvasData(canvas));

			expect(parsed!.steps[0].description).toBe("Opens the hub view");
			expect(parsed!.steps[1].description).toBe("Clicks the primary button");
			expect(parsed!.steps[2].description).toBe("");
		});

		it("recovers action counts from inner text nodes", () => {
			const input = makeSyncInput();
			const canvas = buildJourneyCanvas(input, deterministicId);
			const parsed = parseJourneyCanvas(toCanvasData(canvas));

			expect(parsed!.steps[0].actionCount).toBe(2);
			expect(parsed!.steps[1].actionCount).toBe(1);
			expect(parsed!.steps[2].actionCount).toBe(1);
		});

		it("round-trips with stepColors applied instead of activeStepIndex", () => {
			const input = makeSyncInput({
				activeStepIndex: undefined,
				stepColors: { 0: "4", 1: "1", 2: "5" },
			});
			const canvas = buildJourneyCanvas(input, deterministicId);
			const parsed = parseJourneyCanvas(toCanvasData(canvas));

			// Only color "5" maps to activeStepIndex
			expect(parsed!.activeStepIndex).toBe(2);
		});
	});

	describe("Journey B: Preview run validation", () => {
		it("detects missing required fields in actions", () => {
			const errors = validateAction(
				{ tool: "click" } as JourneyAction,
				0,
				0,
			);
			expect(errors.length).toBeGreaterThan(0);
			expect(errors[0]).toContain("missing required");
		});

		it("passes complete actions with all required fields", () => {
			const errors = validateAction(
				{ tool: "click", selector: ".btn" } as JourneyAction,
				0,
				0,
			);
			expect(errors).toHaveLength(0);
		});

		it("validates step title and action presence", () => {
			const result = validateStep(
				{ id: "s1", title: "", actions: [] },
				0,
			);
			expect(result.status).toBe("fail");
			expect(result.errors).toContain("Step 1: missing title");
			expect(result.errors).toContain("Step 1: no actions defined");
		});

		it("runPreview reports pass/fail counts across steps", () => {
			const result = runPreview([
				{ id: "s1", title: "Good step", actions: [{ tool: "wait", ms: 500 } as JourneyAction] },
				{ id: "s2", title: "", actions: [] },
			]);
			expect(result.totalSteps).toBe(2);
			expect(result.passed).toBe(1);
			expect(result.failed).toBe(1);
		});

		it("reports unknown tool as error", () => {
			const errors = validateAction(
				{ tool: "nonexistent-tool" } as unknown as JourneyAction,
				0,
				0,
			);
			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain("unknown tool");
		});
	});

	describe("Journey C: Canvas detection and dual input", () => {
		it("isJourneyCanvas returns true for generated canvases", () => {
			const canvas = buildJourneyCanvas(makeSyncInput(), deterministicId);
			expect(isJourneyCanvas(toCanvasData(canvas))).toBe(true);
		});

		it("isJourneyCanvas returns false for non-journey canvases", () => {
			const nonJourney: CanvasData = {
				nodes: [
					{ id: "1", type: "text", text: "Random note", x: 0, y: 0, width: 200, height: 100 },
				] as CanvasData["nodes"],
				edges: [],
			} as CanvasData;
			expect(isJourneyCanvas(nonJourney)).toBe(false);
		});

		it("detects canvas with START but no END as non-journey", () => {
			const partial: CanvasData = {
				nodes: [
					{ id: "1", type: "text", text: "▶ Start", x: 0, y: 0, width: 160, height: 80, color: "4" },
				] as CanvasData["nodes"],
				edges: [],
			} as CanvasData;
			expect(isJourneyCanvas(partial)).toBe(false);
		});
	});

	describe("Edge cases", () => {
		it("round-trips 5 steps preserving order", () => {
			const input = makeSyncInput({
				steps: Array.from({ length: 5 }, (_, i) => ({
					id: `s${i}`,
					title: `Step ${i + 1}`,
					description: `Description for step ${i + 1}`,
					actions: Array.from({ length: i + 1 }, () => ({ tool: "wait" as const, ms: 100 })),
				})),
			});
			const canvas = buildJourneyCanvas(input, deterministicId);
			const parsed = parseJourneyCanvas(toCanvasData(canvas));

			expect(parsed!.steps).toHaveLength(5);
			for (let i = 0; i < 5; i++) {
				expect(parsed!.steps[i].title).toBe(`Step ${i + 1}`);
				expect(parsed!.steps[i].description).toBe(`Description for step ${i + 1}`);
				expect(parsed!.steps[i].actionCount).toBe(i + 1);
			}
		});

		it("empty events round-trip as empty strings", () => {
			const input = makeSyncInput({ startEvent: "", endEvent: "" });
			const canvas = buildJourneyCanvas(input, deterministicId);
			const parsed = parseJourneyCanvas(toCanvasData(canvas));

			expect(parsed!.startEvent).toBe("");
			expect(parsed!.endEvent).toBe("");
		});

		it("activeStepIndex is undefined when no step has color 5", () => {
			const input = makeSyncInput({ activeStepIndex: undefined });
			const canvas = buildJourneyCanvas(input, deterministicId);
			const parsed = parseJourneyCanvas(toCanvasData(canvas));

			expect(parsed!.activeStepIndex).toBeUndefined();
		});
	});
});
