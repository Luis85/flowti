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
	readProjectConfig: vi.fn(() => ({ config: { management: { requirements: { dir: "docs/requirements" } } }, warnings: [] })),
}));

vi.mock("../../../../src/domain/requirements/requirement-store.js", () => ({
	listRequirements: vi.fn(() => []),
	listUseCases: vi.fn(() => []),
	listUserStories: vi.fn(() => []),
}));

import * as fsMod from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { listRequirements, listUseCases, listUserStories } from "../../../../src/domain/requirements/requirement-store.js";
import { generateRequirementsTraceability } from "../../../../src/domain/reports/generators/requirements-traceability.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("generateRequirementsTraceability", () => {
	it("generates successfully with no requirements", () => {
		setDisk(createMockFs());
		const result = generateRequirementsTraceability("/mock/project", mockDeps);
		expect(result.success).toBe(true);
		expect(result.metrics.requirements).toBe(0);
	});

	it("generates with requirements, use cases, and user stories", () => {
		setDisk(createMockFs());
		vi.mocked(listRequirements).mockReturnValue([
			{ name: "Auth Login", id: "REQ-001", requirementType: "functional", status: "approved", priority: "must", file: "auth-login.md" },
		]);
		vi.mocked(listUseCases).mockReturnValue([
			{ name: "Login Flow", id: "UC-001", actor: "User", file: "login-flow.md" },
		]);
		vi.mocked(listUserStories).mockReturnValue([
			{ name: "User Login", id: "US-001", role: "user", status: "done", storyPoints: 5, file: "user-login.md" },
		]);

		const result = generateRequirementsTraceability("/mock/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics.requirements).toBe(1);
		expect(result.metrics.useCases).toBe(1);
		expect(result.metrics.userStories).toBe(1);
	});

	it("includes status summary for requirements", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(listRequirements).mockReturnValue([
			{ name: "R1", id: "REQ-001", requirementType: "functional", status: "approved", priority: "must", file: "r1.md" },
			{ name: "R2", id: "REQ-002", requirementType: "functional", status: "draft", priority: "should", file: "r2.md" },
		]);

		generateRequirementsTraceability("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("Status Summary");
		expect(content).toContain("approved");
		expect(content).toContain("draft");
	});

	it("shows story points total", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(listUserStories).mockReturnValue([
			{ name: "S1", id: "US-001", role: "dev", status: "done", storyPoints: 3, file: "s1.md" },
			{ name: "S2", id: "US-002", role: "dev", status: "backlog", storyPoints: 8, file: "s2.md" },
		]);

		generateRequirementsTraceability("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("11");
	});

	it("writes frontmatter with type", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateRequirementsTraceability("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("type: RequirementsTraceability");
	});
});
