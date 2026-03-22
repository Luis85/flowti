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
vi.mock("../../../../src/domain/reports/generators/event-catalog.js", () => ({
	extractCategories: vi.fn(() => []),
	extractCatalogEntries: vi.fn(() => []),
}));

import type { ReportDeps } from "../../../../src/infrastructure/deps.js";
import type { PipelineContext } from "../../../../src/infrastructure/pipeline/pipeline-types.js";
import { disk } from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { extractCategories, extractCatalogEntries } from "../../../../src/domain/reports/generators/event-catalog.js";
import { generateEventCatalog } from "../../../../src/domain/reports/cli/generate-event-catalog.js";

const mockShell = { run: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0, success: true })) };
const mockDeps: ReportDeps = { disk, paths, clock, shell: mockShell as any, log: () => {} };

function createMockCtx(source?: string): Partial<PipelineContext> {
	const stepData = new Map<string, Record<string, unknown>>();
	if (source) stepData.set("event-catalog", { source });
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

const sampleEvents = [
	{ type: "app.loaded", category: "Core", description: "App loaded", direction: "outbound", domain: "core", services: "AppService", stability: "stable", visibility: "public", tags: ["system"] },
	{ type: "user.login", category: "User", description: "User logged in", direction: "outbound", domain: "user", services: "UserService", stability: "stable", visibility: "public", tags: [] },
];

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generateEventCatalog", () => {
	it("returns failure when source not configured (no ctx)", () => {
		const result = generateEventCatalog("/project", mockDeps);

		expect(result.success).toBe(false);
		expect(result.outputPath).toBe("");
		expect((result as { error?: string }).error).toMatch(/source not configured/i);
	});

	it("returns failure when catalog source not found", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);

		const result = generateEventCatalog("/project", mockDeps, createMockCtx("src/infrastructure/events/catalog.ts") as any);

		expect(result.success).toBe(false);
		expect(result.outputPath).toBe("");
		expect((result as { error?: string }).error).toMatch(/catalog\.ts not found/i);
	});

	it("returns failure when no events extracted", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(extractCategories).mockReturnValue(["Core"]);
		vi.mocked(extractCatalogEntries).mockReturnValue([]);

		const result = generateEventCatalog("/project", mockDeps, createMockCtx("src/infrastructure/events/catalog.ts") as any);

		expect(result.success).toBe(false);
		expect(result.outputPath).toBe("");
		expect((result as { error?: string }).error).toMatch(/no events extracted/i);
	});

	it("generates report from valid catalog data", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(extractCategories).mockReturnValue(["Core", "User"]);
		vi.mocked(extractCatalogEntries).mockReturnValue(sampleEvents as any);

		const result = generateEventCatalog("/project", mockDeps, createMockCtx("src/infrastructure/events/catalog.ts") as any);

		expect(result.success).toBe(true);
		expect(result.outputPath).toBeTruthy();
		expect(result.metrics).toEqual(expect.objectContaining({
			total_events: 2,
			categories: 2,
			domains: 2,
		}));
	});

	it("groups events by category in metrics", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(extractCategories).mockReturnValue(["Core", "User"]);
		vi.mocked(extractCatalogEntries).mockReturnValue(sampleEvents as any);

		const result = generateEventCatalog("/project", mockDeps, createMockCtx("src/infrastructure/events/catalog.ts") as any);

		expect(result.success).toBe(true);
		expect(result.metrics?.["categories"]).toBe(2);
		expect(result.metrics?.["total_events"]).toBe(2);
	});

	it("passes pipeline context log messages", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(extractCategories).mockReturnValue(["Core", "User"]);
		vi.mocked(extractCatalogEntries).mockReturnValue(sampleEvents as any);

		const ctx = createMockCtx("src/infrastructure/events/catalog.ts");

		generateEventCatalog("/project", mockDeps, ctx as any);

		expect(ctx.log).toHaveBeenCalled();
	});
});
