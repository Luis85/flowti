import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(),
		readFileSync: vi.fn(),
	},
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: { join: (...args: string[]) => args.join("/") },
}));
vi.mock("../../../src/infrastructure/frontmatter.js", () => ({
	parseFrontmatterContent: vi.fn(),
}));
vi.mock("../../../src/domain/project/project-config.js", () => ({
	getReportsDir: vi.fn(() => "/reports"),
}));
vi.mock("../../../src/domain/build/build-freshness.js", () => ({
	checkFreshness: vi.fn(),
	resolveBuildPaths: vi.fn((p: string) => ({ srcDir: p + "/src", binDir: p + "/dist" })),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { parseFrontmatterContent } from "../../../src/infrastructure/frontmatter.js";
import { checkFreshness } from "../../../src/domain/build/build-freshness.js";
import { printProjectStatusBanner } from "../../../src/ui/renderers/project-status-banner.js";
import type { ProjectContext } from "../../../src/infrastructure/types.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const mockExistsSync = disk.existsSync as ReturnType<typeof vi.fn>;
const mockReadFileSync = disk.readFileSync as ReturnType<typeof vi.fn>;
const mockParseFm = parseFrontmatterContent as ReturnType<typeof vi.fn>;
const mockCheckFreshness = checkFreshness as ReturnType<typeof vi.fn>;

const ctx: ProjectContext = {
	path: "/project",
	pkg: null,
	config: {} as any,
	scripts: {},
};

beforeEach(() => {
	vi.clearAllMocks();
	mockExistsSync.mockReturnValue(false);
	mockCheckFreshness.mockReturnValue({ needsRebuild: false, reason: "fresh", added: [], modified: [], removed: [], currentHash: "a", manifestHash: "a" });
});

describe("printProjectStatusBanner", () => {
	it("logs nothing when no reports or freshness issues", () => {
		printProjectStatusBanner(ctx);
		expect(mockLog).not.toHaveBeenCalled();
	});

	it("shows build status from frontmatter", () => {
		mockExistsSync.mockImplementation((p: string) => p.includes("Build Report"));
		mockReadFileSync.mockReturnValue("---\nsuccess: true\ndate: 2026-01-01T00:00:00Z\n---");
		mockParseFm.mockReturnValue({ success: true, date: "2026-01-01T00:00:00Z" });

		printProjectStatusBanner(ctx);
		expect(mockLog).toHaveBeenCalled();
		const output = mockLog.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
		expect(output).toContain("Build:");
	});

	it("shows test status from frontmatter", () => {
		mockExistsSync.mockImplementation((p: string) => p.includes("Test Report"));
		mockReadFileSync.mockReturnValue("---\ntotal: 100\nfailed: 0\n---");
		mockParseFm.mockReturnValue({ total: 100, failed: 0 });

		printProjectStatusBanner(ctx);
		expect(mockLog).toHaveBeenCalled();
		const output = mockLog.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
		expect(output).toContain("Tests:");
	});

	it("shows rebuild needed when freshness check fails", () => {
		mockCheckFreshness.mockReturnValue({
			needsRebuild: true, reason: "stale",
			added: [], modified: [], removed: [],
			currentHash: "a", manifestHash: "b",
		});

		printProjectStatusBanner(ctx);
		expect(mockLog).toHaveBeenCalled();
		const output = mockLog.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
		expect(output).toContain("Rebuild needed");
	});

	it("shows failed test count", () => {
		mockExistsSync.mockImplementation((p: string) => p.includes("Test Report"));
		mockReadFileSync.mockReturnValue("---\ntotal: 100\nfailed: 5\n---");
		mockParseFm.mockReturnValue({ total: 100, failed: 5 });

		printProjectStatusBanner(ctx);
		const output = mockLog.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
		expect(output).toContain("5 failed");
	});

	it("handles read errors gracefully", () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockImplementation(() => { throw new Error("read error"); });

		expect(() => printProjectStatusBanner(ctx)).not.toThrow();
	});
});
