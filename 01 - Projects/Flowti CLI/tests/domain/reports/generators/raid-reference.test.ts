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

vi.mock("../../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: { management: { raid: { dir: "docs/raid" } } }, warnings: [] })),
}));

vi.mock("../../../../src/domain/raid/raid-store.js", () => ({
	listRAIDItems: vi.fn(() => []),
}));

import * as fsMod from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { listRAIDItems } from "../../../../src/domain/raid/raid-store.js";
import { generateRaidReference } from "../../../../src/domain/reports/generators/raid-reference.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("generateRaidReference", () => {
	it("generates successfully with no items", () => {
		setDisk(createMockFs());
		const result = generateRaidReference("/mock/project", mockDeps);
		expect(result.success).toBe(true);
		expect(result.metrics.total).toBe(0);
	});

	it("generates with RAID items", () => {
		setDisk(createMockFs());
		vi.mocked(listRAIDItems).mockReturnValue([
			{ name: "Risk-001", itemType: "risk", status: "open", severity: "high", owner: "team", dueDate: "", file: "" },
			{ name: "Issue-001", itemType: "issue", status: "open", severity: "critical", owner: "", dueDate: "", file: "" },
			{ name: "Dec-001", itemType: "decision", status: "accepted", severity: "low", owner: "", dueDate: "", file: "" },
		]);

		const result = generateRaidReference("/mock/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics.total).toBe(3);
		expect(result.metrics.open).toBe(2);
	});

	it("includes summary table and type sections", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(listRAIDItems).mockReturnValue([
			{ name: "Risk-001", itemType: "risk", status: "open", severity: "high", owner: "", dueDate: "", file: "" },
		]);

		generateRaidReference("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("Summary");
		expect(content).toContain("Risks");
		expect(content).toContain("[[Risk-001]]");
	});

	it("writes frontmatter with type", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateRaidReference("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("type: RAIDReference");
	});
});
