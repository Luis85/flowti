import { describe, it, expect, vi } from "vitest";
import { runPipeline } from "../../../src/infrastructure/pipeline/pipeline-runner.js";
import type { PipelineStep, PipelineDeps, PipelineResult } from "../../../src/infrastructure/pipeline/pipeline-types.js";

function createDeps(): PipelineDeps {
	return {
		runCommand: vi.fn(() => ({ output: "", exitCode: 0 })),
		now: (() => {
			let t = 1000;
			return () => t++;
		})(),
		log: vi.fn(),
	};
}

function step(id: string, overrides: Partial<PipelineStep> = {}): PipelineStep {
	return {
		id,
		label: id.charAt(0).toUpperCase() + id.slice(1),
		execute: () => ({ success: true }),
		...overrides,
	};
}

describe("runPipeline", () => {
	// ── Basic execution ──────────────────────────────────────────────

	it("runs a single step successfully", () => {
		const deps = createDeps();
		const result = runPipeline([step("test")], "/project", {}, deps);
		expect(result.passed).toBe(1);
		expect(result.failed).toBe(0);
		expect(result.steps).toHaveLength(1);
		expect(result.steps[0].success).toBe(true);
	});

	it("runs multiple steps in order", () => {
		const order: string[] = [];
		const deps = createDeps();
		const steps = [
			step("first", { execute: () => { order.push("first"); return { success: true }; } }),
			step("second", { execute: () => { order.push("second"); return { success: true }; } }),
			step("third", { execute: () => { order.push("third"); return { success: true }; } }),
		];
		runPipeline(steps, "/project", {}, deps);
		expect(order).toEqual(["first", "second", "third"]);
	});

	it("returns empty result for no steps", () => {
		const deps = createDeps();
		const result = runPipeline([], "/project", {}, deps);
		expect(result.steps).toHaveLength(0);
		expect(result.passed).toBe(0);
		expect(result.failed).toBe(0);
	});

	// ── Resilient execution ──────────────────────────────────────────

	it("catches step exceptions and records as failed", () => {
		const deps = createDeps();
		const steps = [
			step("broken", { execute: () => { throw new Error("boom"); } }),
		];
		const result = runPipeline(steps, "/project", {}, deps);
		expect(result.failed).toBe(1);
		expect(result.steps[0].error).toBe("boom");
		expect(result.steps[0].success).toBe(false);
	});

	it("continues after a step failure", () => {
		const deps = createDeps();
		const steps = [
			step("fail", { execute: () => ({ success: false }) }),
			step("pass", { execute: () => ({ success: true }) }),
		];
		const result = runPipeline(steps, "/project", {}, deps);
		expect(result.passed).toBe(1);
		expect(result.failed).toBe(1);
		expect(result.steps).toHaveLength(2);
	});

	it("records step that reports failure (not exception)", () => {
		const deps = createDeps();
		const result = runPipeline(
			[step("soft-fail", { execute: () => ({ success: false }) })],
			"/project", {}, deps,
		);
		expect(result.steps[0].success).toBe(false);
		expect(result.steps[0].error).toBe("Step reported failure");
	});

	// ── Metrics and warnings ─────────────────────────────────────────

	it("captures step metrics", () => {
		const deps = createDeps();
		const result = runPipeline(
			[step("metrics", { execute: () => ({ success: true, metrics: { tests: 42 } }) })],
			"/project", {}, deps,
		);
		expect(result.steps[0].output?.metrics).toEqual({ tests: 42 });
	});

	it("captures step warnings", () => {
		const deps = createDeps();
		const result = runPipeline(
			[step("warned", { execute: () => ({ success: true, warnings: ["low coverage"] }) })],
			"/project", {}, deps,
		);
		expect(result.steps[0].warnings).toEqual(["low coverage"]);
	});

	// ── Prerequisites ────────────────────────────────────────────────

	it("runs prerequisites before step execution", () => {
		const order: string[] = [];
		const deps = createDeps();
		(deps.runCommand as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
			order.push(`prereq:${cmd}`);
			return { output: "out", exitCode: 0 };
		});
		const steps = [
			step("test", {
				prerequisites: ["npm run build"],
				execute: () => { order.push("execute:test"); return { success: true }; },
			}),
		];
		runPipeline(steps, "/project", {}, deps);
		expect(order).toEqual(["prereq:npm run build", "execute:test"]);
	});

	it("deduplicates prerequisites across steps", () => {
		const deps = createDeps();
		const steps = [
			step("a", { prerequisites: ["npm run build"] }),
			step("b", { prerequisites: ["npm run build"] }),
		];
		runPipeline(steps, "/project", {}, deps);
		expect(deps.runCommand).toHaveBeenCalledTimes(1);
	});

	it("stores prerequisite output in context for downstream steps", () => {
		const deps = createDeps();
		(deps.runCommand as ReturnType<typeof vi.fn>).mockReturnValue({
			output: "lint output here",
			exitCode: 0,
		});
		let capturedOutput: string | undefined;
		const steps = [
			step("lint", { prerequisites: ["npm run lint"] }),
			step("summary", {
				execute: (ctx) => {
					capturedOutput = ctx.getCommandOutput("npm run lint");
					return { success: true };
				},
			}),
		];
		runPipeline(steps, "/project", {}, deps);
		expect(capturedOutput).toBe("lint output here");
	});

	it("fails step when prerequisite fails", () => {
		const deps = createDeps();
		(deps.runCommand as ReturnType<typeof vi.fn>).mockReturnValue({ output: "", exitCode: 1 });
		const result = runPipeline(
			[step("test", { prerequisites: ["npm run bad"] })],
			"/project", {}, deps,
		);
		expect(result.steps[0].success).toBe(false);
		expect(result.steps[0].error).toContain("Prerequisite failed");
	});

	// ── Step data passing ────────────────────────────────────────────

	it("stores step data for downstream consumption", () => {
		const deps = createDeps();
		let receivedData: Record<string, unknown> | undefined;
		const steps = [
			step("producer", {
				execute: () => ({ success: true, data: { count: 5 } }),
			}),
			step("consumer", {
				execute: (ctx) => {
					receivedData = ctx.getStepData("producer");
					return { success: true };
				},
			}),
		];
		runPipeline(steps, "/project", {}, deps);
		expect(receivedData).toEqual({ count: 5 });
	});

	// ── Context access ───────────────────────────────────────────────

	it("passes project path through context", () => {
		const deps = createDeps();
		let receivedPath: string | undefined;
		const steps = [
			step("check", {
				execute: (ctx) => { receivedPath = ctx.projectPath; return { success: true }; },
			}),
		];
		runPipeline(steps, "/my/project", {}, deps);
		expect(receivedPath).toBe("/my/project");
	});

	it("step can read prior step results from context", () => {
		const deps = createDeps();
		let priorResult: unknown;
		const steps = [
			step("first", { execute: () => ({ success: true, metrics: { x: 1 } }) }),
			step("second", {
				execute: (ctx) => {
					priorResult = ctx.getStepResult("first");
					return { success: true };
				},
			}),
		];
		runPipeline(steps, "/project", {}, deps);
		expect(priorResult).toBeDefined();
		expect((priorResult as { success: boolean }).success).toBe(true);
	});

	// ── Phased execution ─────────────────────────────────────────────

	it("runs steps in dependency-ordered phases", () => {
		const order: string[] = [];
		const deps = createDeps();
		const steps = [
			step("summary", {
				dependencies: ["test"],
				execute: () => { order.push("summary"); return { success: true }; },
			}),
			step("test", {
				execute: () => { order.push("test"); return { success: true }; },
			}),
		];
		runPipeline(steps, "/project", { phased: true }, deps);
		expect(order).toEqual(["test", "summary"]);
	});

	it("skips dependent step when dependency failed (phased mode)", () => {
		const deps = createDeps();
		const steps = [
			step("base", { execute: () => ({ success: false }) }),
			step("derived", {
				dependencies: ["base"],
				execute: () => ({ success: true }),
			}),
		];
		const result = runPipeline(steps, "/project", { phased: true }, deps);
		const derived = result.steps.find((s) => s.id === "derived");
		expect(derived?.success).toBe(false);
		expect(derived?.error).toContain("Dependency failed");
	});

	// ── Timing ───────────────────────────────────────────────────────

	it("records step duration", () => {
		const deps = createDeps();
		const result = runPipeline([step("timed")], "/project", {}, deps);
		expect(result.steps[0].durationMs).toBeGreaterThanOrEqual(0);
	});

	it("records total pipeline duration", () => {
		const deps = createDeps();
		const result = runPipeline([step("a"), step("b")], "/project", {}, deps);
		expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
	});

	// ── Logging ──────────────────────────────────────────────────────

	it("logs step start and completion", () => {
		const deps = createDeps();
		runPipeline([step("test")], "/project", {}, deps);
		const calls = (deps.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
		expect(calls.some((c: string) => c.includes("Test"))).toBe(true);
		expect(calls.some((c: string) => c.includes("✓"))).toBe(true);
	});

	it("logs failure with ✗", () => {
		const deps = createDeps();
		runPipeline(
			[step("broken", { execute: () => { throw new Error("fail"); } })],
			"/project", {}, deps,
		);
		const calls = (deps.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
		expect(calls.some((c: string) => c.includes("✗"))).toBe(true);
	});

	it("uses custom run label", () => {
		const deps = createDeps();
		runPipeline([step("a")], "/project", { label: "Report Run" }, deps);
		const calls = (deps.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
		expect(calls.some((c: string) => c.includes("Report Run"))).toBe(true);
	});
});
