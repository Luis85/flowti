import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { runAllDocs } from "../../../src/domain/reports/pipeline/doc-runner.js";
import type { ReferenceConfig } from "../../../src/infrastructure/types.js";

const refs: ReferenceConfig[] = [
	{ id: "cli-reference", label: "CLI Reference" },
	{ id: "entity-reference", label: "Entity Reference" },
];

function makeDeps() {
	return { disk: {}, paths: {}, clock: {}, log: () => {}, warn: () => {}, proc: {}, input: {}, shell: {} } as unknown as import("../../../src/infrastructure/deps.js").CliDeps;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockRunReference.mockReturnValue({ success: true, outputPath: "/ref.md", metrics: { total: 1 } });
});

describe("runAllDocs", () => {
	it("runs all reference generators and returns results", async () => {
		const result = await runAllDocs([], refs, "/project", makeDeps(), { enabled: false });

		expect(mockRunReference).toHaveBeenCalledTimes(2);
		expect(result.generators).toHaveLength(2);
		expect(result.passed).toBe(2);
		expect(result.failed).toBe(0);
	});

	it("continues after a reference fails", async () => {
		mockRunReference
			.mockReturnValueOnce({ success: false, outputPath: "", metrics: {} })
			.mockReturnValueOnce({ success: true, outputPath: "", metrics: {} });

		const result = await runAllDocs([], refs, "/project", makeDeps(), { enabled: false });

		expect(result.generators).toHaveLength(2);
		expect(result.passed).toBe(1);
		expect(result.failed).toBe(1);
	});

	it("records duration per generator", async () => {
		const result = await runAllDocs([], refs, "/project", makeDeps(), { enabled: false });

		for (const gen of result.generators) {
			expect(gen.durationMs).toBeGreaterThan(0);
		}
		expect(result.totalDurationMs).toBeGreaterThan(0);
	});

	it("converts pipeline output to GeneratorOutput", async () => {
		mockRunReference.mockReturnValue({
			success: true,
			outputPath: "/docs/ref.md",
			metrics: { entities: 13 },
		});

		const result = await runAllDocs([], refs, "/project", makeDeps(), { enabled: false });

		expect(result.generators[0].output).toEqual({
			success: true,
			outputPath: "/docs/ref.md",
			metrics: { entities: 13 },
			warnings: undefined,
		});
	});

	it("handles exception from a reference generator", async () => {
		mockRunReference
			.mockImplementationOnce(() => { throw new Error("Generator crashed"); })
			.mockReturnValueOnce({ success: true, outputPath: "", metrics: {} });

		const result = await runAllDocs([], refs, "/project", makeDeps(), { enabled: false });

		expect(result.passed).toBe(1);
		expect(result.failed).toBe(1);
		expect(result.generators[0].error).toContain("Generator crashed");
	});

	it("handles null reference output", async () => {
		mockRunReference.mockReturnValue(null);

		const result = await runAllDocs([], refs, "/project", makeDeps(), { enabled: false });

		expect(result.failed).toBe(2);
		expect(result.generators[0].error).toBeDefined();
	});

	it("returns empty results when no references configured", async () => {
		const result = await runAllDocs([], [], "/project", makeDeps(), { enabled: false });

		expect(result.generators).toHaveLength(0);
		expect(result.passed).toBe(0);
	});

	it("logs Documentation summary", async () => {
		const { log } = await import("../../../src/infrastructure/logger.js");
		const mockLog = log as ReturnType<typeof vi.fn>;

		await runAllDocs([], refs, "/project", makeDeps(), { enabled: false });

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Documentation Summary");
	});
});
