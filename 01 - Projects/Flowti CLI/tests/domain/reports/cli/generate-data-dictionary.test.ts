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
vi.mock("../../../../src/domain/reports/generators/data-dictionary.js", () => ({
	extractEntityTypes: vi.fn(() => []),
	groupLabel: vi.fn((g: string) => g.charAt(0).toUpperCase() + g.slice(1)),
}));

import type { ReportDeps } from "../../../../src/infrastructure/deps.js";
import type { PipelineContext } from "../../../../src/infrastructure/pipeline/pipeline-types.js";
import { disk } from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { extractEntityTypes } from "../../../../src/domain/reports/generators/data-dictionary.js";
import { generateDataDictionary } from "../../../../src/domain/reports/cli/generate-data-dictionary.js";

const mockShell = { run: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0, success: true })) };
const mockDeps: ReportDeps = { disk, paths, clock, shell: mockShell as any, log: () => {} };

function createMockCtx(source?: string): Partial<PipelineContext> {
	const stepData = new Map<string, Record<string, unknown>>();
	if (source) stepData.set("data-dictionary", { source });
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

const sampleEntities = [
	{
		typeName: "PBI",
		group: "planning",
		tab: "Backlog",
		folder: "backlog",
		nameField: "title",
		filePattern: "PBI-*.md",
		description: "Product Backlog Item",
		fields: [
			{ name: "title", type: "string", required: true, description: "PBI title" },
			{ name: "stage", type: "string", required: true, description: "Current stage" },
		],
	},
	{
		typeName: "TechDebt",
		group: "planning",
		tab: "Debt",
		folder: "debt",
		nameField: "title",
		filePattern: "TD-*.md",
		description: "Technical debt item",
		fields: [
			{ name: "title", type: "string", required: true, description: "Debt title" },
		],
	},
];

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generateDataDictionary", () => {
	it("returns failure when source not configured (no ctx)", () => {
		const result = generateDataDictionary("/project", mockDeps);

		expect(result.success).toBe(false);
		expect((result as { error?: string }).error).toMatch(/source not configured/i);
	});

	it("returns failure when registry source not found", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);

		const result = generateDataDictionary("/project", mockDeps, createMockCtx("src/domain/docs/entityTypeRegistry.ts") as any);

		expect(result.success).toBe(false);
		expect(result.outputPath).toBe("");
		expect((result as { error?: string }).error).toMatch(/entityTypeRegistry\.ts not found/i);
	});

	it("returns failure when no entity types extracted", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue("// empty registry source" as never);
		vi.mocked(extractEntityTypes).mockReturnValue([]);

		const result = generateDataDictionary("/project", mockDeps, createMockCtx("src/domain/docs/entityTypeRegistry.ts") as any);

		expect(result.success).toBe(false);
		expect(result.outputPath).toBe("");
		expect((result as { error?: string }).error).toMatch(/no entity types extracted/i);
	});

	it("generates report from valid entity data", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue("// registry source" as never);
		vi.mocked(extractEntityTypes).mockReturnValue(sampleEntities as any);

		const result = generateDataDictionary("/project", mockDeps, createMockCtx("src/domain/docs/entityTypeRegistry.ts") as any);

		expect(result.success).toBe(true);
		expect(result.outputPath).toBeTruthy();
		expect(result.metrics).toEqual(expect.objectContaining({
			total_types: 2,
			groups: 1,
			total_fields: 3,
		}));
	});

	it("counts total fields across all entities", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue("// registry source" as never);
		vi.mocked(extractEntityTypes).mockReturnValue(sampleEntities as any);

		const result = generateDataDictionary("/project", mockDeps, createMockCtx("src/domain/docs/entityTypeRegistry.ts") as any);

		expect(result.success).toBe(true);
		// PBI has 2 fields, TechDebt has 1 — total should be 3
		expect(result.metrics?.["total_fields"]).toBe(3);
	});

	it("passes pipeline context log messages", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue("// registry source" as never);
		vi.mocked(extractEntityTypes).mockReturnValue(sampleEntities as any);

		const ctx = createMockCtx("src/domain/docs/entityTypeRegistry.ts");

		generateDataDictionary("/project", mockDeps, ctx as any);

		expect(ctx.log).toHaveBeenCalled();
	});
});
