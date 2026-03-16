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
	readProjectConfig: vi.fn(() => ({ config: { agents: { dir: "docs/agents" } }, warnings: [] })),
}));

vi.mock("../../../../src/domain/agents/agent-store.js", () => ({
	agentStore: { list: vi.fn(() => []), resolveDir: vi.fn(() => "") },
	listAgents: vi.fn(() => []),
}));

import * as fsMod from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { agentStore } from "../../../../src/domain/agents/agent-store.js";
import { generatePdcaDashboard } from "../../../../src/domain/reports/generators/pdca-dashboard.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("generatePdcaDashboard", () => {
	it("generates successfully with no agents", () => {
		setDisk(createMockFs());
		const result = generatePdcaDashboard("/mock/project", mockDeps);
		expect(result.success).toBe(true);
		expect(result.metrics.agents).toBe(0);
	});

	it("groups agents by PDCA tags", () => {
		setDisk(createMockFs());
		vi.mocked(agentStore.list).mockReturnValue([
			{ name: "Planner", agentType: "ai", description: "", skills: [], tools: [], roles: [], tags: ["plan"], file: "planner.md" },
			{ name: "Builder", agentType: "ai", description: "", skills: [], tools: [], roles: [], tags: ["do"], file: "builder.md" },
			{ name: "Reviewer", agentType: "ai", description: "", skills: [], tools: [], roles: [], tags: ["check"], file: "reviewer.md" },
			{ name: "Fixer", agentType: "ai", description: "", skills: [], tools: [], roles: [], tags: ["act"], file: "fixer.md" },
		]);

		const result = generatePdcaDashboard("/mock/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics.plan).toBe(1);
		expect(result.metrics.do).toBe(1);
		expect(result.metrics.check).toBe(1);
		expect(result.metrics.act).toBe(1);
		expect(result.metrics.untagged).toBe(0);
	});

	it("identifies untagged agents", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(agentStore.list).mockReturnValue([
			{ name: "Orphan", agentType: "ai", description: "No tags", skills: [], tools: [], roles: [], file: "orphan.md" },
		]);

		generatePdcaDashboard("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("Untagged Agents");
		expect(content).toContain("[[Orphan]]");
	});

	it("shows coverage gaps for missing phases", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(agentStore.list).mockReturnValue([
			{ name: "Planner", agentType: "ai", description: "", skills: [], tools: [], roles: [], tags: ["plan"], file: "p.md" },
		]);

		generatePdcaDashboard("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("Coverage Gaps");
		expect(content).toContain("DO");
		expect(content).toContain("CHECK");
		expect(content).toContain("ACT");
	});

	it("writes frontmatter with type", () => {
		const fs = createMockFs();
		setDisk(fs);
		generatePdcaDashboard("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("type: PDCADashboard");
	});
});
