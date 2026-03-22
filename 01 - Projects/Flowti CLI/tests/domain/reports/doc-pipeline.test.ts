import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockShell } from "../../mocks/mock-shell.js";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
	warn: vi.fn(),
}));

vi.mock("../../../src/infrastructure/deps.js", () => ({
	createDefaultDeps: () => ({ disk: {}, paths: {}, clock: {}, log: () => {} }),
}));

vi.mock("../../../src/infrastructure/clock.js", () => {
	let time = 1000;
	return {
		clock: {
			ms: () => { time += 500; return time; },
			now: () => new Date(),
			iso: () => "2026-03-10T12:00:00.000Z",
			safeIso: () => "2026-03-10T12-00-00",
		},
	};
});

// Mock the generator registry
const { mockRunReference } = vi.hoisted(() => ({ mockRunReference: vi.fn() }));
vi.mock("../../../src/domain/reports/generator-registry.js", () => ({
	runReference: mockRunReference,
}));

import { toDocStep, toReferenceStep, buildDocSteps, runDocPipeline } from "../../../src/domain/reports/pipeline/doc-pipeline.js";
import type { DocGenerator, ReferenceConfig } from "../../../src/infrastructure/types.js";

beforeEach(() => {
	vi.clearAllMocks();
	mockRunReference.mockReturnValue({ success: true, outputPath: "/ref.md", metrics: { total: 1 } });
});

// ── toDocStep ────────────────────────────────────────────────────────

describe("toDocStep", () => {
	it("creates a step with normalized ID from label", () => {
		const sh = createMockShell();
		const step = toDocStep({ label: "Codebase (TypeDoc)", command: "npm run typedoc" }, { shell: sh });
		expect(step.id).toBe("codebase-typedoc");
		expect(step.label).toBe("Codebase (TypeDoc)");
	});

	it("executes the shell command", () => {
		const sh = createMockShell();

		const step = toDocStep({ label: "TypeDoc", command: "npm run typedoc" }, { shell: sh });
		const result = step.execute({ projectPath: "/project" } as Parameters<typeof step.execute>[0]);

		const calls = sh.calls.filter((c) => c.method === "runCaptureStatus");
		expect(calls).toHaveLength(1);
		expect(calls[0].cmd).toBe("npm run typedoc");
		expect((result as { success: boolean }).success).toBe(true);
	});

	it("reports failure when command exits non-zero", () => {
		const sh = createMockShell({ exitCodes: { "npm run broken": 1 } });

		const step = toDocStep({ label: "Broken", command: "npm run broken" }, { shell: sh });
		const result = step.execute({ projectPath: "/project" } as Parameters<typeof step.execute>[0]);

		expect((result as { success: boolean }).success).toBe(false);
	});
});

// ── toReferenceStep ──────────────────────────────────────────────────

describe("toReferenceStep", () => {
	it("creates a step with the configured label", () => {
		const step = toReferenceStep({ id: "cli-reference", label: "CLI Reference" });
		expect(step.id).toBe("cli-reference");
		expect(step.label).toBe("CLI Reference");
	});

	it("delegates to runReference with ctx", () => {
		const step = toReferenceStep({ id: "entity-reference", label: "Entity Reference", source: "src/registry.ts" });
		const mockCtx = { projectPath: "/project", deps: {}, setStepData: vi.fn(), getStepData: vi.fn() } as unknown as Parameters<typeof step.execute>[0];
		const result = step.execute(mockCtx);

		expect(mockRunReference).toHaveBeenCalledWith("entity-reference", "/project", {}, mockCtx);
		expect((result as { success: boolean }).success).toBe(true);
	});

	it("sets step data with source when provided", () => {
		const step = toReferenceStep({ id: "cli-reference", label: "CLI Reference", source: "src/commands.ts" });
		const setStepData = vi.fn();
		const mockCtx = { projectPath: "/project", deps: {}, setStepData, getStepData: vi.fn() } as unknown as Parameters<typeof step.execute>[0];
		step.execute(mockCtx);

		expect(setStepData).toHaveBeenCalledWith("cli-reference", { source: "src/commands.ts" });
	});

	it("returns failure when reference returns null", () => {
		mockRunReference.mockReturnValue(null);

		const step = toReferenceStep({ id: "cli-reference", label: "CLI Reference" });
		const result = step.execute({ projectPath: "/project", deps: {}, setStepData: vi.fn() } as unknown as Parameters<typeof step.execute>[0]);

		expect((result as { success: boolean }).success).toBe(false);
	});

	it("passes through metrics and outputPath", () => {
		mockRunReference.mockReturnValue({ success: true, outputPath: "/docs/ref.md", metrics: { count: 42 } });

		const step = toReferenceStep({ id: "entity-reference", label: "Entity Reference" });
		const result = step.execute({ projectPath: "/project", deps: {}, setStepData: vi.fn() } as unknown as Parameters<typeof step.execute>[0]);

		expect((result as { outputPath: string }).outputPath).toBe("/docs/ref.md");
		expect((result as { metrics: Record<string, number> }).metrics.count).toBe(42);
	});
});

// ── buildDocSteps ────────────────────────────────────────────────────

describe("buildDocSteps", () => {
	it("combines external generators and configured references", () => {
		const sh = createMockShell();
		const generators: DocGenerator[] = [
			{ label: "TypeDoc", command: "npm run typedoc" },
		];
		const references: ReferenceConfig[] = [
			{ id: "cli-reference", label: "CLI Reference" },
			{ id: "entity-reference", label: "Entity Reference" },
		];
		const steps = buildDocSteps(generators, references, { shell: sh });

		expect(steps).toHaveLength(3); // 1 external + 2 references
		expect(steps[0].id).toBe("typedoc");
		expect(steps[1].id).toBe("cli-reference");
		expect(steps[2].id).toBe("entity-reference");
	});

	it("returns only references when no external generators", () => {
		const sh = createMockShell();
		const references: ReferenceConfig[] = [
			{ id: "cli-reference", label: "CLI Reference" },
		];
		const steps = buildDocSteps([], references, { shell: sh });

		expect(steps).toHaveLength(1);
		expect(steps[0].id).toBe("cli-reference");
	});

	it("returns empty when no generators and no references", () => {
		const sh = createMockShell();
		const steps = buildDocSteps([], [], { shell: sh });
		expect(steps).toHaveLength(0);
	});

	it("handles multiple external generators", () => {
		const sh = createMockShell();
		const generators: DocGenerator[] = [
			{ label: "TypeDoc", command: "npm run typedoc" },
			{ label: "API Docs", command: "npm run api-docs" },
		];
		const steps = buildDocSteps(generators, [], { shell: sh });

		expect(steps).toHaveLength(2);
		expect(steps[0].id).toBe("typedoc");
		expect(steps[1].id).toBe("api-docs");
	});
});

// ── runDocPipeline ───────────────────────────────────────────────────

describe("runDocPipeline", () => {
	function makeDeps(sh?: ReturnType<typeof createMockShell>) {
		const shell = sh ?? createMockShell();
		return { disk: {}, paths: {}, clock: {}, log: () => {}, warn: () => {}, proc: {}, input: {}, shell } as unknown as import("../../../src/infrastructure/deps.js").CliDeps;
	}

	const refs: ReferenceConfig[] = [
		{ id: "cli-reference", label: "CLI Reference" },
		{ id: "entity-reference", label: "Entity Reference" },
	];

	it("runs all steps and returns pipeline result", async () => {
		const sh = createMockShell();
		const deps = makeDeps(sh);

		const generators: DocGenerator[] = [
			{ label: "TypeDoc", command: "npm run typedoc" },
		];

		const result = await runDocPipeline(generators, refs, "/project", deps, { enabled: false });

		expect(result.steps).toHaveLength(3);
		expect(result.passed).toBe(3);
		expect(result.failed).toBe(0);
	});

	it("continues after a step fails", async () => {
		const sh = createMockShell({ exitCodes: { "npm run broken": 1 } });
		const deps = makeDeps(sh);

		const generators: DocGenerator[] = [
			{ label: "Broken", command: "npm run broken" },
		];

		const result = await runDocPipeline(generators, refs, "/project", deps, { enabled: false });

		expect(result.steps).toHaveLength(3);
		expect(result.passed).toBe(2);
		expect(result.failed).toBe(1);
	});

	it("runs with empty generators (references only)", async () => {
		const deps = makeDeps();
		const result = await runDocPipeline([], refs, "/project", deps, { enabled: false });

		expect(result.steps).toHaveLength(2);
		expect(result.passed).toBe(2);
		expect(mockRunReference).toHaveBeenCalledTimes(2);
	});

	it("records timing for each step", async () => {
		const deps = makeDeps();
		const result = await runDocPipeline([], refs, "/project", deps, { enabled: false });

		for (const step of result.steps) {
			expect(step.durationMs).toBeGreaterThan(0);
		}
		expect(result.totalDurationMs).toBeGreaterThan(0);
	});
});
