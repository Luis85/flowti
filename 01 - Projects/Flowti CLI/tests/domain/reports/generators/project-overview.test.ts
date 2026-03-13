import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../../mocks/mock-fs.js";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
}));

vi.mock("../../../../src/infrastructure/paths.js", async () => {
	const path = await import("node:path");
	return { paths: { join: path.default.join, resolve: path.default.resolve, dirname: path.default.dirname, basename: path.default.basename, sep: "/" } };
});

vi.mock("../../../../src/infrastructure/config.js", () => ({ CLI_PROJECT: "/mock/cli-project" }));
vi.mock("../../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-13T00:00:00Z", safeIso: () => "2026-03-13T00-00-00Z" },
}));

vi.mock("../../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({
		config: {
			name: "test-project",
			type: "cli",
			build: { commands: { fast: "npm run build" } },
			test: { commands: { unit: "npm test" } },
			reports: { generators: [{ id: "test", label: "Test" }] },
			docs: { references: [{ id: "cli-reference", label: "CLI Ref" }] },
			health: {},
		},
		warnings: [],
	})),
	readPackageJson: vi.fn(() => ({ name: "test-project", version: "1.0.0", scripts: {} })),
}));

vi.mock("../../../../src/domain/make/component/component-list.js", () => ({
	listProjectComponents: vi.fn(() => []),
	enrichComponentRelationships: vi.fn(),
	detectDirtyComponents: vi.fn(),
}));

import * as fsMod from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { generateProjectOverview } from "../../../../src/domain/reports/generators/project-overview.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("generateProjectOverview", () => {
	it("generates successfully", () => {
		setDisk(createMockFs());
		const result = generateProjectOverview("/mock/project", mockDeps);
		expect(result.success).toBe(true);
		expect(result.outputPath).toBeTruthy();
	});

	it("includes project identity", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateProjectOverview("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("Identity");
		expect(content).toContain("test-project");
		expect(content).toContain("1.0.0");
	});

	it("lists detected capabilities", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateProjectOverview("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("Capabilities");
		expect(content).toContain("Build pipeline");
		expect(content).toContain("Test runner");
	});

	it("writes frontmatter with type", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateProjectOverview("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("type: ProjectOverview");
	});

	it("reports capabilities count in metrics", () => {
		setDisk(createMockFs());
		const result = generateProjectOverview("/mock/project", mockDeps);
		expect(result.metrics.capabilities).toBeGreaterThan(0);
	});
});
