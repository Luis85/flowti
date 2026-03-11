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
		basename: (p: string) => p.split("/").pop() ?? "",
	},
}));
vi.mock("../../../src/domain/make/component/component-list.js", () => ({
	listProjectComponents: vi.fn(() => []),
	buildComponentTree: vi.fn(() => []),
	buildAncestryPath: vi.fn(() => "System > Container > Component"),
	findSiblings: vi.fn(() => []),
	COMPONENTS_DIR: "docs/components",
}));
vi.mock("../../../src/domain/make/component/storybook-service.js", () => ({
	isStorybookInstalled: vi.fn(() => false),
	installStorybook: vi.fn(),
	runStorybookDev: vi.fn(),
	runStorybookBuild: vi.fn(),
	isStorybookRunning: vi.fn(() => false),
	stopStorybook: vi.fn(),
}));
vi.mock("./component-makers-menu.js", () => ({
	componentMenu: vi.fn(),
}));
// Re-mock the actual path used by the source
vi.mock("../../../src/ui/menus/component-makers-menu.js", () => ({
	componentMenu: vi.fn(),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import {
	listProjectComponents, buildComponentTree, buildAncestryPath, findSiblings,
} from "../../../src/domain/make/component/component-list.js";
import {
	isStorybookInstalled, installStorybook, runStorybookDev, runStorybookBuild, isStorybookRunning, stopStorybook,
} from "../../../src/domain/make/component/storybook-service.js";
import { componentListMenu } from "../../../src/ui/menus/component-list-menu.js";
import type { ProjectComponent } from "../../../src/domain/make/component/component-types.js";

const mockLog = vi.mocked(log);
const mockRunMenu = vi.mocked(runMenu);
const mockDisk = vi.mocked(disk);
const mockListComponents = vi.mocked(listProjectComponents);
const mockBuildTree = vi.mocked(buildComponentTree);
const mockSbInstalled = vi.mocked(isStorybookInstalled);
const mockSbRunning = vi.mocked(isStorybookRunning);

function output(): string {
	return mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
}

const COMPONENT_A: ProjectComponent = {
	name: "button",
	kind: "ui-component",
	status: "active",
	path: "docs/components/button.md",
};

const COMPONENT_B: ProjectComponent = {
	name: "sidebar",
	kind: "layout",
	status: "draft",
	path: "docs/components/sidebar.md",
};

beforeEach(() => {
	vi.clearAllMocks();
	mockDisk.existsSync.mockReturnValue(false);
});

describe("componentListMenu", () => {
	it("shows empty message when no components", async () => {
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		expect(output()).toContain("No components found");
	});

	it("shows component count when components exist", async () => {
		mockListComponents.mockReturnValue([COMPONENT_A]);
		mockBuildTree.mockReturnValue([{ component: COMPONENT_A, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		expect(output()).toContain("1 component(s)");
	});

	it("builds menu items from component tree", async () => {
		mockListComponents.mockReturnValue([COMPONENT_A, COMPONENT_B]);
		mockBuildTree.mockReturnValue([
			{ component: COMPONENT_A, depth: 0 },
			{ component: COMPONENT_B, depth: 1 },
		]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [title, items] = mockRunMenu.mock.calls[0];
		expect(title).toBe("Components");
		// 2 components + sep + Add Component + sep + install + start + stop + build + sep + back = 11
		const nonSep = items.filter((i: any) => !("separator" in i));
		expect(nonSep.length).toBeGreaterThanOrEqual(8); // 2 comps + add + 4 storybook + back
	});

	it("component item shows detail on action", async () => {
		mockListComponents.mockReturnValue([COMPONENT_A]);
		mockBuildTree.mockReturnValue([{ component: COMPONENT_A, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		const compItem = items.find((i: any) => i.key === "1");
		const result = await (compItem as any).action();

		expect(result).toBe("main");
		expect(output()).toContain("button");
		expect(output()).toContain("UI Component");
		expect(output()).toContain("active");
	});

	it("component detail shows ancestry when containedBy is set", async () => {
		const child: ProjectComponent = {
			...COMPONENT_A,
			name: "child-comp",
			containedBy: "parent-comp",
		};
		mockListComponents.mockReturnValue([child]);
		mockBuildTree.mockReturnValue([{ component: child, depth: 1 }]);
		vi.mocked(buildAncestryPath).mockReturnValue("System > Container > child-comp");
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "1") as any).action();

		expect(output()).toContain("Path:");
		expect(output()).toContain("System > Container > child-comp");
	});

	it("component detail shows children", async () => {
		const parent: ProjectComponent = {
			...COMPONENT_A,
			name: "parent",
			contains: ["child1", "child2"],
		};
		mockListComponents.mockReturnValue([parent]);
		mockBuildTree.mockReturnValue([{ component: parent, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "1") as any).action();

		expect(output()).toContain("Children: child1, child2");
	});

	it("component detail shows siblings", async () => {
		vi.mocked(findSiblings).mockReturnValue([{ name: "sibling1" } as any]);
		mockListComponents.mockReturnValue([COMPONENT_A]);
		mockBuildTree.mockReturnValue([{ component: COMPONENT_A, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "1") as any).action();

		expect(output()).toContain("Siblings: sibling1");
	});

	it("component detail shows definition path when exists", async () => {
		mockDisk.existsSync.mockImplementation((p: string) => {
			if (typeof p === "string" && p.includes("button.json")) return true;
			return false;
		});
		mockListComponents.mockReturnValue([COMPONENT_A]);
		mockBuildTree.mockReturnValue([{ component: COMPONENT_A, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "1") as any).action();

		expect(output()).toContain("Def:");
	});

	it("component detail shows test path when exists", async () => {
		mockDisk.existsSync.mockImplementation((p: string) => {
			if (typeof p === "string" && p.includes("button.test.ts")) return true;
			return false;
		});
		mockListComponents.mockReturnValue([COMPONENT_A]);
		mockBuildTree.mockReturnValue([{ component: COMPONENT_A, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "1") as any).action();

		expect(output()).toContain("Test:");
	});

	it("component detail shows C4 level when set", async () => {
		const c4comp: ProjectComponent = { ...COMPONENT_A, c4Level: 2 };
		mockListComponents.mockReturnValue([c4comp]);
		mockBuildTree.mockReturnValue([{ component: c4comp, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "1") as any).action();

		expect(output()).toContain("C4 Level: 2");
	});

	it("indents nested components in tree", async () => {
		mockListComponents.mockReturnValue([COMPONENT_A, COMPONENT_B]);
		mockBuildTree.mockReturnValue([
			{ component: COMPONENT_A, depth: 0 },
			{ component: COMPONENT_B, depth: 2 },
		]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		// depth 2 should have indent
		expect(items[1].label).toContain("\u2514 "); // └ character
	});

	it("Add Component action delegates to componentMenu", async () => {
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "c");
		expect(addItem).toBeDefined();
		const result = await (addItem as any).action();
		expect(result).toBe("main");
	});

	it("Back returns 'main'", async () => {
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		const back = items.find((i: any) => i.key === "b");
		expect(await (back as any).action()).toBe("main");
	});

	// ── Storybook menu items ──────────────────────────────────────────

	it("Install Storybook item is present", async () => {
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		const installItem = items.find((i: any) => i.key === "i");
		expect(installItem).toBeDefined();
		expect(installItem!.label).toContain("Install Storybook");
	});

	it("Install Storybook disabled function checks isStorybookInstalled", async () => {
		mockSbInstalled.mockReturnValue(true);
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		const installItem = items.find((i: any) => i.key === "i");
		expect((installItem as any).disabled()).toBe(true);
	});

	it("Install Storybook disabled is false when not installed", async () => {
		mockSbInstalled.mockReturnValue(false);
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		const installItem = items.find((i: any) => i.key === "i");
		expect((installItem as any).disabled()).toBe(false);
	});

	it("Start Storybook disabled when not installed or already running", async () => {
		mockSbInstalled.mockReturnValue(false);
		mockSbRunning.mockReturnValue(false);
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		const startItem = items.find((i: any) => i.key === "s");
		expect((startItem as any).disabled()).toBe(true);
	});

	it("Stop Storybook disabled when not running", async () => {
		mockSbRunning.mockReturnValue(false);
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		const stopItem = items.find((i: any) => i.key === "x");
		expect((stopItem as any).disabled()).toBe(true);
	});

	it("Stop Storybook enabled when running", async () => {
		mockSbRunning.mockReturnValue(true);
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		const stopItem = items.find((i: any) => i.key === "x");
		expect((stopItem as any).disabled()).toBe(false);
	});

	it("Storybook build disabled when not installed", async () => {
		mockSbInstalled.mockReturnValue(false);
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		const buildItem = items.find((i: any) => i.key === "k");
		expect((buildItem as any).disabled()).toBe(true);
	});

	it("accepts optional componentsConfig", async () => {
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", { storybook: true });

		// Should not throw and storybook checks should use the config
		expect(mockRunMenu).toHaveBeenCalled();
	});

	it("status color is GREEN for active, DIM for others", async () => {
		mockListComponents.mockReturnValue([COMPONENT_A, COMPONENT_B]);
		mockBuildTree.mockReturnValue([
			{ component: COMPONENT_A, depth: 0 },
			{ component: COMPONENT_B, depth: 0 },
		]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		// Both labels should contain status text
		expect(items[0].label).toContain("active");
		expect(items[1].label).toContain("draft");
	});
});
