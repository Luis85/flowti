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
import { generateAgentRosterReference } from "../../../../src/domain/reports/generators/agent-roster-reference.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("generateAgentRosterReference", () => {
	it("generates successfully with no agents", () => {
		setDisk(createMockFs());
		const result = generateAgentRosterReference("/mock/project", mockDeps);
		expect(result.success).toBe(true);
		expect(result.metrics.total).toBe(0);
	});

	it("generates with agents", () => {
		setDisk(createMockFs());
		vi.mocked(agentStore.list).mockReturnValue([
			{ name: "Architect", agentType: "ai", description: "Designs systems", domain: "dev", skills: [{ name: "design", level: "expert" }], tools: ["Read"], roles: ["architect"], tags: ["plan"], file: "architect.md" },
			{ name: "Tester", agentType: "human", description: "Tests things", domain: "qa", skills: [{ name: "testing", level: "senior" }], tools: [], roles: ["tester"], tags: ["check"], file: "tester.md" },
		]);

		const result = generateAgentRosterReference("/mock/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics.total).toBe(2);
		expect(result.metrics.ai).toBe(1);
		expect(result.metrics.human).toBe(1);
		expect(result.metrics.domains).toBe(2);
	});

	it("includes roster overview and domain sections", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(agentStore.list).mockReturnValue([
			{ name: "Agent-A", agentType: "ai", description: "", domain: "dev", skills: [], tools: [], roles: ["dev"], tags: [], file: "a.md" },
		]);

		generateAgentRosterReference("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("Roster Overview");
		expect(content).toContain("By Domain");
		expect(content).toContain("[[Agent-A]]");
	});

	it("includes attributes table when agents have attributes", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(agentStore.list).mockReturnValue([
			{ name: "Hero", agentType: "ai", description: "", domain: "dev", skills: [], tools: [], roles: [], tags: [], attributes: { str: 14, int: 16, wis: 12 }, file: "hero.md" },
		]);

		generateAgentRosterReference("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("Character Attributes");
		expect(content).toContain("14");
		expect(content).toContain("16");
	});

	it("writes frontmatter with type", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateAgentRosterReference("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("type: AgentRosterReference");
	});
});
