import { describe, it, expect, beforeEach } from "vitest";
import { createPipelineContext } from "../../../src/infrastructure/pipeline/pipeline-context.js";
import type { PipelineContext, StepResult } from "../../../src/infrastructure/pipeline/pipeline-types.js";
import { createTestDeps } from "../../mocks/mock-deps.js";

function makeResult(overrides: Partial<StepResult> = {}): StepResult {
	return {
		id: "step-1",
		label: "Step One",
		success: true,
		durationMs: 100,
		output: null,
		...overrides,
	};
}

describe("PipelineContext", () => {
	let ctx: PipelineContext;

	beforeEach(() => {
		ctx = createPipelineContext("/project", createTestDeps());
	});

	it("exposes the project path", () => {
		expect(ctx.projectPath).toBe("/project");
	});

	// ── Results ──────────────────────────────────────────────────────

	describe("results", () => {
		it("starts empty", () => {
			expect(ctx.getResults()).toHaveLength(0);
		});

		it("accumulates pushed results", () => {
			ctx.pushResult(makeResult({ id: "a" }));
			ctx.pushResult(makeResult({ id: "b" }));
			expect(ctx.getResults()).toHaveLength(2);
		});

		it("preserves insertion order", () => {
			ctx.pushResult(makeResult({ id: "first" }));
			ctx.pushResult(makeResult({ id: "second" }));
			expect(ctx.getResults()[0].id).toBe("first");
			expect(ctx.getResults()[1].id).toBe("second");
		});

		it("finds a step result by ID", () => {
			ctx.pushResult(makeResult({ id: "target", label: "Target Step" }));
			ctx.pushResult(makeResult({ id: "other" }));
			expect(ctx.getStepResult("target")?.label).toBe("Target Step");
		});

		it("returns undefined for unknown step ID", () => {
			expect(ctx.getStepResult("nonexistent")).toBeUndefined();
		});
	});

	// ── Command outputs ──────────────────────────────────────────────

	describe("command outputs", () => {
		it("returns undefined for unknown command", () => {
			expect(ctx.getCommandOutput("npm run lint")).toBeUndefined();
		});

		it("stores and retrieves command output", () => {
			ctx.setCommandOutput("npm run lint", "0 problems");
			expect(ctx.getCommandOutput("npm run lint")).toBe("0 problems");
		});

		it("overwrites on same key", () => {
			ctx.setCommandOutput("npm run lint", "first");
			ctx.setCommandOutput("npm run lint", "second");
			expect(ctx.getCommandOutput("npm run lint")).toBe("second");
		});

		it("stores different commands independently", () => {
			ctx.setCommandOutput("cmd-a", "output-a");
			ctx.setCommandOutput("cmd-b", "output-b");
			expect(ctx.getCommandOutput("cmd-a")).toBe("output-a");
			expect(ctx.getCommandOutput("cmd-b")).toBe("output-b");
		});
	});

	// ── Step data ────────────────────────────────────────────────────

	describe("step data", () => {
		it("returns undefined for unknown step", () => {
			expect(ctx.getStepData("unknown")).toBeUndefined();
		});

		it("stores and retrieves step data", () => {
			ctx.setStepData("test", { passCount: 42 });
			expect(ctx.getStepData("test")).toEqual({ passCount: 42 });
		});

		it("overwrites step data on same key", () => {
			ctx.setStepData("test", { v: 1 });
			ctx.setStepData("test", { v: 2 });
			expect(ctx.getStepData("test")).toEqual({ v: 2 });
		});
	});

	// ── Isolation ────────────────────────────────────────────────────

	describe("isolation", () => {
		it("separate context instances do not share state", () => {
			const ctx2 = createPipelineContext("/other", createTestDeps());
			ctx.pushResult(makeResult({ id: "only-in-ctx1" }));
			ctx.setCommandOutput("cmd", "only-in-ctx1");
			ctx.setStepData("data", { v: 1 });

			expect(ctx2.getResults()).toHaveLength(0);
			expect(ctx2.getCommandOutput("cmd")).toBeUndefined();
			expect(ctx2.getStepData("data")).toBeUndefined();
		});
	});
});
