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
	readProjectConfig: vi.fn(() => ({ config: { management: { deliverables: { dir: "docs/deliverables" } } }, warnings: [] })),
}));

vi.mock("../../../../src/domain/deliverables/deliverable-store.js", () => ({
	listDeliverables: vi.fn(() => []),
}));

import * as fsMod from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { listDeliverables } from "../../../../src/domain/deliverables/deliverable-store.js";
import { generateDeliverablesSchedule } from "../../../../src/domain/reports/generators/deliverables-schedule.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("generateDeliverablesSchedule", () => {
	it("generates successfully with no deliverables", () => {
		setDisk(createMockFs());
		const result = generateDeliverablesSchedule("/mock/project", mockDeps);
		expect(result.success).toBe(true);
		expect(result.metrics.total).toBe(0);
	});

	it("generates with deliverables", () => {
		setDisk(createMockFs());
		vi.mocked(listDeliverables).mockReturnValue([
			{ name: "MVP", status: "in-progress", dueDate: "2026-04-01", assignee: "team", completionPct: 60, file: "mvp.md" },
			{ name: "Docs", status: "planned", dueDate: "2026-04-15", assignee: "writer", completionPct: 0, file: "docs.md" },
		]);

		const result = generateDeliverablesSchedule("/mock/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics.total).toBe(2);
		expect(result.metrics.avgCompletion).toBe(30);
	});

	it("sorts timeline by due date", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(listDeliverables).mockReturnValue([
			{ name: "Later", status: "planned", dueDate: "2026-05-01", assignee: "", completionPct: 0, file: "later.md" },
			{ name: "Sooner", status: "planned", dueDate: "2026-04-01", assignee: "", completionPct: 0, file: "sooner.md" },
		]);

		generateDeliverablesSchedule("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		const soonerIdx = content.indexOf("Sooner");
		const laterIdx = content.indexOf("Later");
		expect(soonerIdx).toBeLessThan(laterIdx);
	});

	it("groups by assignee", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(listDeliverables).mockReturnValue([
			{ name: "Task A", status: "done", dueDate: "", assignee: "Alice", completionPct: 100, file: "a.md" },
			{ name: "Task B", status: "in-progress", dueDate: "", assignee: "Bob", completionPct: 50, file: "b.md" },
		]);

		generateDeliverablesSchedule("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("By Assignee");
		expect(content).toContain("Alice");
		expect(content).toContain("Bob");
	});

	it("writes frontmatter with type", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateDeliverablesSchedule("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("type: DeliverablesSchedule");
	});
});
