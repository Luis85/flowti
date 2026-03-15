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
	readProjectConfig: vi.fn(() => ({ config: { management: { iterations: { dir: "docs/iterations" } } }, warnings: [] })),
}));

vi.mock("../../../../src/domain/iterations/iteration-store.js", () => ({
	listIterations: vi.fn(() => []),
}));

import * as fsMod from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { listIterations } from "../../../../src/domain/iterations/iteration-store.js";
import { generateIterationRetrospective } from "../../../../src/domain/reports/generators/iteration-retrospective.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("generateIterationRetrospective", () => {
	it("generates successfully with no iterations", () => {
		setDisk(createMockFs());
		const result = generateIterationRetrospective("/mock/project", mockDeps);
		expect(result.success).toBe(true);
		expect(result.metrics.total).toBe(0);
	});

	it("generates with iterations", () => {
		setDisk(createMockFs());
		vi.mocked(listIterations).mockReturnValue([
			{ name: "Sprint 1", number: 1, startDate: "2026-03-01", endDate: "2026-03-14", goal: "Setup", capacity: "", description: "", status: "done", file: "iteration-001-plan.md", agents: [{ name: "Dev", file: "dev.md" }], resources: [], capacities: [], scopeItems: [{ text: "Task A", done: true }, { text: "Task B", done: true }] },
			{ name: "Sprint 2", number: 2, startDate: "2026-03-15", endDate: "2026-03-28", goal: "Build", capacity: "", description: "", status: "in-progress", file: "iteration-002-plan.md", agents: [{ name: "Dev", file: "dev.md" }], resources: [], capacities: [], scopeItems: [{ text: "Task C", done: false }] },
		]);

		const result = generateIterationRetrospective("/mock/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics.total).toBe(2);
		expect(result.metrics.completed).toBe(1);
		expect(result.metrics.active).toBe(1);
	});

	it("includes velocity data for completed iterations", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(listIterations).mockReturnValue([
			{ name: "Sprint 1", number: 1, startDate: "2026-03-01", endDate: "2026-03-14", goal: "", capacity: "", description: "", status: "done", file: "f.md", agents: [], resources: [], capacities: [], scopeItems: [{ text: "A", done: true }, { text: "B", done: false }] },
		]);

		generateIterationRetrospective("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("Velocity");
		expect(content).toContain("50%");
	});

	it("tracks agent participation across iterations", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(listIterations).mockReturnValue([
			{ name: "S1", number: 1, startDate: "", endDate: "", goal: "", capacity: "", description: "", status: "done", file: "f.md", agents: [{ name: "Alice", file: "alice.md" }], resources: [], capacities: [], scopeItems: [] },
			{ name: "S2", number: 2, startDate: "", endDate: "", goal: "", capacity: "", description: "", status: "done", file: "f2.md", agents: [{ name: "Alice", file: "alice.md" }], resources: [], capacities: [], scopeItems: [] },
		]);

		generateIterationRetrospective("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("Agent Participation");
		expect(content).toContain("[[Alice]]");
	});

	it("writes frontmatter with type", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateIterationRetrospective("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("type: IterationRetrospective");
	});
});
