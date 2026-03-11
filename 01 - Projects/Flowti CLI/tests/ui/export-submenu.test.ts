import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));
vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: { join: (...args: string[]) => args.join("/"), basename: (p: string) => p.split("/").pop() },
}));
vi.mock("../../src/domain/scaffold/scaffold.js", () => ({
	listDefinitions: vi.fn(),
	buildMarketplaceListing: vi.fn(),
	resolveDefinitionsDir: vi.fn(() => "/defs"),
	BUNDLED_DEFINITIONS: [],
	getKnownTemplateIds: vi.fn(() => new Set()),
}));
vi.mock("../../src/ui/menus/marketplace-menu.js", () => ({
	displayMarketplace: vi.fn(),
}));
vi.mock("../../src/domain/build/build-freshness.js", () => ({
	checkFreshness: vi.fn(),
	resolveBuildPaths: vi.fn((p: string) => ({ srcDir: p + "/src", binDir: p + "/dist" })),
}));

import { log } from "../../src/infrastructure/logger.js";
import { buildExportSubmenu, buildScaffoldSubmenu } from "../../src/ui/export-submenu.js";
import { listDefinitions } from "../../src/domain/scaffold/scaffold.js";
import { checkFreshness } from "../../src/domain/build/build-freshness.js";

const mockLog = log as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("buildExportSubmenu", () => {
	it("returns menu entries with export and back", () => {
		const entries = buildExportSubmenu("/project", {} as any);
		const actionItems = entries.filter((e: any) => "key" in e);
		expect(actionItems.length).toBeGreaterThanOrEqual(2);
		expect(actionItems[0].key).toBe("1");
		expect(actionItems[0].label).toContain("Export");
	});

	it("back action returns main", () => {
		const entries = buildExportSubmenu("/project", {} as any);
		const back = entries.find((e: any) => e.key === "b") as any;
		expect(back.action()).toBe("main");
	});
});

describe("buildScaffoldSubmenu", () => {
	it("returns expected menu entries", () => {
		const entries = buildScaffoldSubmenu("/project");
		const actionItems = entries.filter((e: any) => "key" in e);
		expect(actionItems.length).toBeGreaterThanOrEqual(4);
	});

	it("list definitions action shows empty message when none", () => {
		(listDefinitions as ReturnType<typeof vi.fn>).mockReturnValue([]);
		const entries = buildScaffoldSubmenu("/project");
		const listAction = entries.find((e: any) => e.key === "1") as any;
		const result = listAction.action();
		expect(result).toBe("main");
		expect(mockLog).toHaveBeenCalled();
	});

	it("list definitions action shows definitions when present", () => {
		(listDefinitions as ReturnType<typeof vi.fn>).mockReturnValue([
			{ id: "a", label: "Alpha", description: "Desc A" },
		]);
		const entries = buildScaffoldSubmenu("/project");
		const listAction = entries.find((e: any) => e.key === "1") as any;
		listAction.action();
		const allOutput = mockLog.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
		expect(allOutput).toContain("Alpha");
	});

	it("browse marketplace action returns main", () => {
		const entries = buildScaffoldSubmenu("/project");
		const browse = entries.find((e: any) => e.key === "2") as any;
		expect(browse.action()).toBe("main");
	});

	it("check freshness shows rebuild needed", () => {
		(checkFreshness as ReturnType<typeof vi.fn>).mockReturnValue({
			needsRebuild: true, reason: "stale", added: ["f.ts"], modified: [], removed: ["g.ts"],
		});
		const entries = buildScaffoldSubmenu("/project");
		const freshAction = entries.find((e: any) => e.key === "3") as any;
		freshAction.action();
		const allOutput = mockLog.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
		expect(allOutput).toContain("Rebuild needed");
	});

	it("check freshness shows fresh when no rebuild needed", () => {
		(checkFreshness as ReturnType<typeof vi.fn>).mockReturnValue({
			needsRebuild: false, reason: "Build is fresh", added: [], modified: [], removed: [],
		});
		const entries = buildScaffoldSubmenu("/project");
		const freshAction = entries.find((e: any) => e.key === "3") as any;
		freshAction.action();
		const allOutput = mockLog.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
		expect(allOutput).toContain("Build is fresh");
	});
});
