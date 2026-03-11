import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/infrastructure/menu.js", () => ({ runMenu: vi.fn() }));
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), readdirSync: vi.fn(() => []), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		relative: (from: string, to: string) => to.replace(from + "/", ""),
		resolve: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop() ?? "",
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
	},
}));
vi.mock("../../../src/domain/reports/export/report-archive.js", () => ({
	discoverArchiveCategories: vi.fn(() => []),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { discoverArchiveCategories } from "../../../src/domain/reports/export/report-archive.js";
import { browseArchive } from "../../../src/ui/menus/report-archive-menu.js";
import type { ArchiveCategory } from "../../../src/domain/reports/export/report-archive.js";

const mockLog = vi.mocked(log);
const mockRunMenu = vi.mocked(runMenu);
const mockDiscover = vi.mocked(discoverArchiveCategories);
const mockDisk = vi.mocked(disk);

beforeEach(() => {
	vi.clearAllMocks();
});

// ── browseArchive ────────────────────────────────────────────────────

describe("browseArchive", () => {
	it("returns 'main' when no categories found", async () => {
		mockDiscover.mockReturnValue([]);

		const result = await browseArchive("/reports");

		expect(result).toBe("main");
		expect(mockLog).toHaveBeenCalled();
		expect(mockRunMenu).not.toHaveBeenCalled();
	});

	it("builds menu items from discovered categories", async () => {
		const categories: ArchiveCategory[] = [
			{ subdir: "tests", label: "Test", files: ["report-1.md", "report-2.md"] },
			{ subdir: "builds", label: "Build", files: ["build-1.md"] },
		];
		mockDiscover.mockReturnValue(categories);
		mockRunMenu.mockResolvedValue("main");

		await browseArchive("/reports");

		expect(mockRunMenu).toHaveBeenCalledTimes(1);
		const [title, items] = mockRunMenu.mock.calls[0];
		expect(title).toBe("Report Archive");
		// 2 categories + separator + back = 4 items
		expect(items).toHaveLength(4);
		expect(items[0]).toMatchObject({ key: "1" });
		expect(items[0].label).toContain("Test");
		expect(items[0].label).toContain("2 reports");
		expect(items[1]).toMatchObject({ key: "2" });
		expect(items[1].label).toContain("Build");
		expect(items[1].label).toContain("1 report)");
	});

	it("back action returns 'main'", async () => {
		const categories: ArchiveCategory[] = [
			{ subdir: "tests", label: "Test", files: ["r.md"] },
		];
		mockDiscover.mockReturnValue(categories);
		mockRunMenu.mockResolvedValue("main");

		await browseArchive("/reports");

		const [, items] = mockRunMenu.mock.calls[0];
		const backItem = items.find((i: any) => i.key === "b");
		expect(backItem).toBeDefined();
		const result = await (backItem as any).action();
		expect(result).toBe("main");
	});

	it("category action opens a sub-menu via runMenu", async () => {
		const categories: ArchiveCategory[] = [
			{ subdir: "tests", label: "Test", files: ["2024-01-01.md", "2024-02-01.md"] },
		];
		mockDiscover.mockReturnValue(categories);
		// First call: main menu; second call: sub-menu
		mockRunMenu.mockResolvedValueOnce(undefined).mockResolvedValueOnce("main");

		await browseArchive("/reports");

		const [, items] = mockRunMenu.mock.calls[0];
		// Invoke the category action — triggers browseCategory internally
		await (items[0] as any).action();

		expect(mockRunMenu).toHaveBeenCalledTimes(2);
		const [subTitle, subItems] = mockRunMenu.mock.calls[1];
		expect(subTitle).toBe("Archive: Test");
		// 2 files + separator + back = 4
		expect(subItems).toHaveLength(4);
		expect(subItems[0].label).toBe("2024-01-01");
		expect(subItems[1].label).toBe("2024-02-01");
	});

	it("selecting a report file reads and displays it", async () => {
		const categories: ArchiveCategory[] = [
			{ subdir: "tests", label: "Test", files: ["report.md"] },
		];
		mockDiscover.mockReturnValue(categories);
		mockRunMenu.mockResolvedValue(undefined);

		const fileContent = "---\ntitle: Test Report\n---\n# My Report\nBody content";
		mockDisk.readFileSync.mockReturnValue(fileContent);

		await browseArchive("/reports");

		// Invoke category action
		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		// Invoke file action from sub-menu
		const [, subItems] = mockRunMenu.mock.calls[1];
		const result = await (subItems[0] as any).action();

		expect(result).toBe("main");
		expect(mockDisk.readFileSync).toHaveBeenCalledWith("/reports/tests/report.md", "utf-8");
		// Should log frontmatter and heading
		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("title: Test Report");
		expect(output).toContain("# My Report");
	});

	it("handles file read error gracefully", async () => {
		const categories: ArchiveCategory[] = [
			{ subdir: "tests", label: "Test", files: ["bad.md"] },
		];
		mockDiscover.mockReturnValue(categories);
		mockRunMenu.mockResolvedValue(undefined);
		mockDisk.readFileSync.mockImplementation(() => { throw new Error("ENOENT"); });

		await browseArchive("/reports");

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();
		const [, subItems] = mockRunMenu.mock.calls[1];
		await (subItems[0] as any).action();

		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Could not read file");
	});

	it("singular report label for 1 file", async () => {
		const categories: ArchiveCategory[] = [
			{ subdir: "tests", label: "Test", files: ["only.md"] },
		];
		mockDiscover.mockReturnValue(categories);
		mockRunMenu.mockResolvedValue("main");

		await browseArchive("/reports");

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items[0].label).toContain("1 report)");
		expect(items[0].label).not.toContain("1 reports");
	});
});
