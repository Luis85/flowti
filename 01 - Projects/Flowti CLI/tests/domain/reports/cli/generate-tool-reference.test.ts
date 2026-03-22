import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => "{}"),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		copyFileSync: vi.fn(),
	},
}));
vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop() || "",
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
	},
}));
vi.mock("../../../../src/infrastructure/config.js", () => ({
	CLI_PROJECT: "/project",
}));
vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: {
		iso: () => "2026-01-01T00:00:00.000Z",
		ms: () => 1000000,
		now: () => new Date("2026-01-01T00:00:00.000Z"),
		safeIso: () => "2026-01-01T00-00-00.000Z",
	},
}));
vi.mock("../../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: { reports: { dir: "reports" }, docs: { referenceDir: "docs/reference" } } })),
}));

import type { ReportDeps } from "../../../../src/infrastructure/deps.js";
import { disk } from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { generateToolReference } from "../../../../src/domain/reports/cli/generate-tool-reference.js";
import type { PipelineContext } from "../../../../src/infrastructure/pipeline/pipeline-types.js";

const mockShell = { run: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0, success: true })) };
const mockDeps: ReportDeps = { disk, paths, clock, shell: mockShell as any, log: () => {} };

const VALID_CATALOG_SOURCE = `export const TOOL_CATALOG = {
	"navigate": {
		name: "navigate",
		description: "Navigate to a specific view",
		tags: ["navigation"],
		useCases: ["Open a hub view"],
		params: [
			{ name: "target", type: "string", required: true, description: "Target view ID", values: ["hub", "settings"] },
		],
		examples: [
			{ title: "Open hub", action: { tool: "navigate", target: "hub" } },
		],
	},
	"click": {
		name: "click",
		description: "Click an element",
		tags: ["interaction"],
		useCases: ["Click a button"],
		params: [
			{ name: "selector", type: "string", required: true, description: "CSS selector" },
		],
		examples: [],
	},
};`;

function createMockCtx(source?: string): Partial<PipelineContext> {
	const stepData = new Map<string, Record<string, unknown>>();
	if (source) stepData.set("tool-reference", { source });
	return {
		log: vi.fn(),
		projectPath: "/project",
		getResults: () => [],
		pushResult: vi.fn(),
		getStepResult: vi.fn(),
		setCommandOutput: vi.fn(),
		getCommandOutput: vi.fn(),
		setStepData: vi.fn((id, data) => stepData.set(id, data)),
		getStepData: vi.fn((id) => stepData.get(id)),
		deps: mockDeps as any,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generateToolReference", () => {
	it("returns failure when source not configured (no ctx)", () => {
		const result = generateToolReference("/project", mockDeps);

		expect(result.success).toBe(false);
		expect((result as { error?: string }).error).toContain("Source not configured");
	});

	it("returns failure when catalog source file not found", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		const ctx = createMockCtx("tests/e2e/helpers/toolCatalog.ts");

		const result = generateToolReference("/project", mockDeps, ctx as any);

		expect(result.success).toBe(false);
		expect((result as { error?: string }).error).toContain("Tool catalog source not found");
	});

	it("returns failure when no tools extracted", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue("const x = 1;" as never);
		const ctx = createMockCtx("tests/e2e/helpers/toolCatalog.ts");

		const result = generateToolReference("/project", mockDeps, ctx as any);

		expect(result.success).toBe(false);
		expect((result as { error?: string }).error).toContain("No tools extracted from catalog");
	});

	it("generates report from valid catalog source with tool metadata", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(VALID_CATALOG_SOURCE as never);
		const ctx = createMockCtx("tests/e2e/helpers/toolCatalog.ts");

		const result = generateToolReference("/project", mockDeps, ctx as any);

		expect(result.success).toBe(true);
		expect(result.outputPath).toBeTruthy();
		expect(result.metrics).toEqual(expect.objectContaining({
			total_tools: 2,
			categories: 2,
		}));
	});

	it("resolves source path relative to project path", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(VALID_CATALOG_SOURCE as never);
		const ctx = createMockCtx("tests/e2e/helpers/toolCatalog.ts");

		generateToolReference("/project", mockDeps, ctx as any);

		expect(disk.readFileSync).toHaveBeenCalledWith(
			"/project/tests/e2e/helpers/toolCatalog.ts",
			"utf-8",
		);
	});

	it("passes pipeline context log messages", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(VALID_CATALOG_SOURCE as never);
		const ctx = createMockCtx("tests/e2e/helpers/toolCatalog.ts");

		generateToolReference("/project", mockDeps, ctx as any);

		expect(ctx.log).toHaveBeenCalled();
	});
});
