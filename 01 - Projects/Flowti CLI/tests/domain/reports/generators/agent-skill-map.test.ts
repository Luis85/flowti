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
	listAgents: vi.fn(() => []),
}));

import * as fsMod from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { listAgents } from "../../../../src/domain/agents/agent-store.js";
import { generateAgentSkillMap } from "../../../../src/domain/reports/generators/agent-skill-map.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("generateAgentSkillMap", () => {
	it("generates successfully with no agents", () => {
		setDisk(createMockFs());
		const result = generateAgentSkillMap("/mock/project", mockDeps);
		expect(result.success).toBe(true);
		expect(result.metrics.agents).toBe(0);
		expect(result.metrics.uniqueSkills).toBe(0);
	});

	it("generates skill matrix with agents", () => {
		setDisk(createMockFs());
		vi.mocked(listAgents).mockReturnValue([
			{ name: "A", agentType: "ai", description: "", skills: [{ name: "typescript", level: "expert" }, { name: "testing", level: "senior" }], tools: [], roles: [], file: "a.md" },
			{ name: "B", agentType: "ai", description: "", skills: [{ name: "typescript", level: "mid" }], tools: [], roles: [], file: "b.md" },
		]);

		const result = generateAgentSkillMap("/mock/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics.uniqueSkills).toBe(2);
		expect(result.metrics.singleAgentSkills).toBe(1);
	});

	it("identifies single-agent skills as coverage gaps", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(listAgents).mockReturnValue([
			{ name: "Solo", agentType: "ai", description: "", skills: [{ name: "rare-skill", level: "expert" }], tools: [], roles: [], file: "solo.md" },
		]);

		generateAgentSkillMap("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("Coverage Gaps");
		expect(content).toContain("rare-skill");
	});

	it("writes frontmatter with type", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateAgentSkillMap("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("type: AgentSkillMap");
	});
});
