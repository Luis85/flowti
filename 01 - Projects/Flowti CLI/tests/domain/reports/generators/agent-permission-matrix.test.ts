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

vi.mock("../../../../src/domain/agents/agent-state.js", () => ({
	readAgentState: vi.fn(() => ({ name: "", status: "idle", tasks: [], briefs: [], grants: [], pendingPermissions: [] })),
}));

import * as fsMod from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { agentStore } from "../../../../src/domain/agents/agent-store.js";
import { readAgentState } from "../../../../src/domain/agents/agent-state.js";
import { generateAgentPermissionMatrix } from "../../../../src/domain/reports/generators/agent-permission-matrix.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("generateAgentPermissionMatrix", () => {
	it("generates successfully with no agents", () => {
		setDisk(createMockFs());
		const result = generateAgentPermissionMatrix("/mock/project", mockDeps);
		expect(result.success).toBe(true);
		expect(result.metrics.agents).toBe(0);
	});

	it("shows permission modes for agents", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(agentStore.list).mockReturnValue([
			{ name: "Trusted", agentType: "ai", description: "", skills: [], tools: [], roles: [], ai: { permissions: { mode: "trust" } }, file: "trusted.md" },
			{ name: "Restricted", agentType: "ai", description: "", skills: [], tools: [], roles: [], ai: { permissions: { mode: "ask" } }, file: "restricted.md" },
		]);

		const result = generateAgentPermissionMatrix("/mock/project", mockDeps);
		expect(result.success).toBe(true);
		expect(result.metrics.agents).toBe(2);

		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("Permission Modes");
		expect(content).toContain("trust");
		expect(content).toContain("ask");
	});

	it("shows grants detail when agents have active grants", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(agentStore.list).mockReturnValue([
			{ name: "Agent-X", agentType: "ai", description: "", skills: [], tools: [], roles: [], file: "x.md" },
		]);
		vi.mocked(readAgentState).mockReturnValue({
			name: "Agent-X", status: "idle", tasks: [], briefs: [], pendingPermissions: [],
			grants: [{ tool: "Edit", scope: "always", grantedAt: "2026-03-15", grantedBy: "user" }],
		});

		generateAgentPermissionMatrix("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("Active Grants");
		expect(content).toContain("Edit");
	});

	it("includes default safe tools section", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateAgentPermissionMatrix("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("Default Safe Tools");
		expect(content).toContain("Read");
		expect(content).toContain("Glob");
	});

	it("writes frontmatter with type", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateAgentPermissionMatrix("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("type: AgentPermissionMatrix");
	});
});
