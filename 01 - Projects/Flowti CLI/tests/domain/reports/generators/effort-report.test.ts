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
	readProjectConfig: vi.fn(() => ({ config: { management: { timelog: { dir: "docs/timelog" } } }, warnings: [] })),
}));

vi.mock("../../../../src/domain/timelog/timelog-store.js", () => ({
	listTimeLogEntries: vi.fn(() => []),
	summarizeTimeLog: vi.fn(() => ({ totalHours: 0, byPerson: {}, byCategory: {}, entries: [] })),
}));

import * as fsMod from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { listTimeLogEntries, summarizeTimeLog } from "../../../../src/domain/timelog/timelog-store.js";
import { generateEffortReport } from "../../../../src/domain/reports/generators/effort-report.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("generateEffortReport", () => {
	it("generates successfully with no entries", () => {
		setDisk(createMockFs());
		const result = generateEffortReport("/mock/project", mockDeps);
		expect(result.success).toBe(true);
		expect(result.metrics.entries).toBe(0);
		expect(result.metrics.totalHours).toBe(0);
	});

	it("generates with time entries", () => {
		setDisk(createMockFs());
		const entries = [
			{ date: "2026-03-15", person: "Alice", hours: 4, category: "dev", task: "Feature X", description: "" },
			{ date: "2026-03-15", person: "Bob", hours: 6, category: "review", task: "PR Review", description: "" },
		];
		vi.mocked(listTimeLogEntries).mockReturnValue(entries);
		vi.mocked(summarizeTimeLog).mockReturnValue({
			totalHours: 10,
			byPerson: { Alice: 4, Bob: 6 },
			byCategory: { dev: 4, review: 6 },
			entries,
		});

		const result = generateEffortReport("/mock/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics.totalHours).toBe(10);
		expect(result.metrics.contributors).toBe(2);
	});

	it("includes hours by person and category", () => {
		const fs = createMockFs();
		setDisk(fs);
		const entries = [
			{ date: "2026-03-15", person: "Alice", hours: 8, category: "dev", task: "", description: "" },
		];
		vi.mocked(listTimeLogEntries).mockReturnValue(entries);
		vi.mocked(summarizeTimeLog).mockReturnValue({
			totalHours: 8, byPerson: { Alice: 8 }, byCategory: { dev: 8 }, entries,
		});

		generateEffortReport("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("Hours by Person");
		expect(content).toContain("Alice");
		expect(content).toContain("Hours by Category");
		expect(content).toContain("dev");
	});

	it("writes frontmatter with type", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateEffortReport("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("type: EffortReport");
	});
});
