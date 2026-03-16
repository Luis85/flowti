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
	clock: { iso: () => "2026-03-15T00:00:00Z", safeIso: () => "2026-03-15T00-00-00Z" },
}));

vi.mock("../../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: { management: { resources: { dir: "docs/resources" } } }, warnings: [] })),
}));

vi.mock("../../../../src/domain/resources/resource-store.js", () => ({
	resourceStore: { list: vi.fn(() => []), resolveDir: vi.fn(() => "") },
	listResources: vi.fn(() => []),
}));

import * as fsMod from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { resourceStore } from "../../../../src/domain/resources/resource-store.js";
import { generateResourceInventory } from "../../../../src/domain/reports/generators/resource-inventory.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("generateResourceInventory", () => {
	it("generates successfully with no resources", () => {
		setDisk(createMockFs());
		const result = generateResourceInventory("/mock/project", mockDeps);
		expect(result.success).toBe(true);
		expect(result.metrics.total).toBe(0);
	});

	it("generates with resources", () => {
		setDisk(createMockFs());
		vi.mocked(resourceStore.list).mockReturnValue([
			{ name: "Dev-1", resourceType: "human", price: 100, amount: 160, consumed: 80, remaining: 80, totalCost: 16000, consumedCost: 8000, file: "dev-1.md" },
			{ name: "Budget", resourceType: "budget", price: 1, amount: 50000, consumed: 20000, remaining: 30000, totalCost: 50000, consumedCost: 20000, file: "budget.md" },
		]);

		const result = generateResourceInventory("/mock/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics.total).toBe(2);
		expect(result.metrics.types).toBe(2);
	});

	it("shows cost summary", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(resourceStore.list).mockReturnValue([
			{ name: "Dev", resourceType: "human", price: 50, amount: 100, consumed: 60, remaining: 40, totalCost: 5000, consumedCost: 3000, file: "dev.md" },
		]);

		generateResourceInventory("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("Cost Summary");
		expect(content).toContain("5000");
		expect(content).toContain("3000");
	});

	it("warns about over-utilized resources", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(resourceStore.list).mockReturnValue([
			{ name: "Overworked", resourceType: "human", price: 50, amount: 40, consumed: 55, remaining: 0, totalCost: 2000, consumedCost: 2750, file: "ow.md" },
		]);

		generateResourceInventory("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("Over-Utilized");
		expect(content).toContain("Overworked");
	});

	it("writes frontmatter with type", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateResourceInventory("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("type: ResourceInventory");
	});
});
