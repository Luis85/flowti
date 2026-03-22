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
import type { PipelineContext } from "../../../../src/infrastructure/pipeline/pipeline-types.js";
import { disk } from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { generateCommandReference } from "../../../../src/domain/reports/cli/generate-command-reference.js";

const mockShell = { run: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0, success: true })) };
const mockDeps: ReportDeps = { disk, paths, clock, shell: mockShell as any, log: () => {} };

const VALID_REGISTRY_SOURCE = `function createCommandDefinitions() { return [
{ id: "flowti:open-hub", name: "Open Hub", description: "Opens the hub view", domain: "core", category: "navigation", icon: "layout-dashboard", callback: () => {} },
{ id: "flowti:run-test", name: "Run Tests", description: "Runs the test suite", domain: "testing", category: "development", icon: "play", callback: () => {} },
]; }`;

function createMockCtx(source?: string): Partial<PipelineContext> {
	const stepData = new Map<string, Record<string, unknown>>();
	if (source) stepData.set("command-reference", { source });
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

describe("generateCommandReference", () => {
	it("returns failure when source not configured (no ctx)", () => {
		const result = generateCommandReference("/project", mockDeps);

		expect(result.success).toBe(false);
		expect((result as { error?: string }).error).toBe("Source not configured");
	});

	it("returns failure when registry source not found", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);

		const result = generateCommandReference("/project", mockDeps, createMockCtx("src/infrastructure/commands/registry.ts") as any);

		expect(result.success).toBe(false);
		expect(result.outputPath).toBe("");
		expect((result as { error?: string }).error).toContain("CommandRegistry source not found");
	});

	it("returns failure when no commands extracted", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue("const x = 1;" as never);

		const result = generateCommandReference("/project", mockDeps, createMockCtx("src/infrastructure/commands/registry.ts") as any);

		expect(result.success).toBe(false);
		expect(result.outputPath).toBe("");
		expect((result as { error?: string }).error).toContain("No commands extracted from registry");
	});

	it("generates report from valid registry source", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(VALID_REGISTRY_SOURCE as never);

		const result = generateCommandReference("/project", mockDeps, createMockCtx("src/infrastructure/commands/registry.ts") as any);

		expect(result.success).toBe(true);
		expect(result.outputPath).toBeTruthy();
		expect(result.metrics).toEqual(expect.objectContaining({
			total_commands: 2,
			domains: 2,
		}));
	});

	it("groups commands by domain", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(VALID_REGISTRY_SOURCE as never);

		const result = generateCommandReference("/project", mockDeps, createMockCtx("src/infrastructure/commands/registry.ts") as any);

		expect(result.success).toBe(true);
		expect(result.metrics.domains).toBe(2);
	});

	it("passes pipeline context log messages", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(VALID_REGISTRY_SOURCE as never);

		const ctx = createMockCtx("src/infrastructure/commands/registry.ts");

		generateCommandReference("/project", mockDeps, ctx as any);

		expect(ctx.log).toHaveBeenCalled();
	});
});
