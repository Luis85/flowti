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

import * as fsMod from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { generateHealthReference } from "../../../../src/domain/reports/generators/health-reference.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("generateHealthReference", () => {
	it("generates successfully", () => {
		setDisk(createMockFs());
		const result = generateHealthReference("/mock/project", mockDeps);
		expect(result.success).toBe(true);
		expect(result.outputPath).toBeTruthy();
		expect(result.metrics.categories).toBe(6);
	});

	it("documents grade scale", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateHealthReference("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("Grade Scale");
		expect(content).toContain("90–100");
	});

	it("documents scoring categories with weights", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateHealthReference("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("Scoring Categories");
		expect(content).toContain("Tests");
		expect(content).toContain("Coverage");
		expect(content).toContain("25%");
	});

	it("documents default thresholds", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateHealthReference("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("Default Thresholds");
		expect(content).toContain("Coverage minimum");
	});

	it("documents quality gates", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateHealthReference("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("Quality Gates");
		expect(content).toContain("Supported Metrics");
	});

	it("writes frontmatter with type", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateHealthReference("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("type: HealthReference");
	});
});
