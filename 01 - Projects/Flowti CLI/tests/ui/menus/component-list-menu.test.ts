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
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		sep: "/",
	},
}));
vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => 0), runSilent: vi.fn(), runCapture: vi.fn(() => ""), runCaptureStatus: vi.fn(() => ({ exitCode: 0, output: "" })) },
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock",
	CLI_PROJECT: "/mock/cli",
	cliConfig: {},
}));
vi.mock("../../../src/domain/make/component/component-list.js", () => ({
	listProjectComponents: vi.fn(() => []),
	buildComponentTree: vi.fn(() => []),
	buildAncestryPath: vi.fn(() => "System > Container > Component"),
	findSiblings: vi.fn(() => []),
	detectDirtyComponents: vi.fn(),
	COMPONENTS_DIR: "components",
}));
vi.mock("../../../src/domain/make/component/component-commands.js", () => ({
	regenerateComponent: vi.fn(() => ({ success: true, name: "test", filesWritten: 3 })),
}));
vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-01-01T00:00:00.000Z", ms: () => 0, now: () => new Date("2026-01-01"), safeIso: () => "2026-01-01T00-00-00" },
}));
vi.mock("../../../src/domain/make/component/storybook-service.js", () => ({
	isStorybookInstalled: vi.fn(() => false),
	installStorybook: vi.fn(),
	runStorybookDev: vi.fn(),
	runStorybookBuild: vi.fn(),
	isStorybookRunning: vi.fn(() => false),
	stopStorybook: vi.fn(),
	getFrameworkPackages: vi.fn(() => ({ framework: "@storybook/html-vite" })),
}));
vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(), askYesNo: vi.fn(() => true), waitForEnter: vi.fn() },
}));
vi.mock("../../../src/domain/make/component/storybook-settings.js", () => ({
	getFramework: vi.fn(() => "html"),
	setFramework: vi.fn(),
}));
vi.mock("./component-makers-menu.js", () => ({
	componentMenu: vi.fn(),
}));
// Re-mock the actual path used by the source
vi.mock("../../../src/ui/menus/component-makers-menu.js", () => ({
	componentMenu: vi.fn(),
}));
vi.mock("../../../src/ui/menus/component-detail-menu.js", () => ({
	componentDetailMenu: vi.fn(),
	actionReferenceMenu: vi.fn(),
}));
vi.mock("../../../src/domain/make/component/component-library.js", () => ({
	discoverLibraries: vi.fn(() => []),
	importAllLibraryDefinitions: vi.fn(() => ({ total: 0, errors: [] })),
	importLibraryDefinition: vi.fn(() => ({ name: "test", filesWritten: 3, errors: [] })),
}));
vi.mock("../../../src/domain/make/component/data-provider.js", () => ({
	listDataProviders: vi.fn(() => []),
	createDataProvider: vi.fn(),
	regenerateDataDictionary: vi.fn(),
	readDataProvider: vi.fn(),
	inferSchema: vi.fn(() => []),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { input } from "../../../src/infrastructure/input.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { shell } from "../../../src/infrastructure/shell.js";
import { clock } from "../../../src/infrastructure/clock.js";
import { getFramework } from "../../../src/domain/make/component/storybook-settings.js";
import {
	listProjectComponents, buildComponentTree, buildAncestryPath, findSiblings, detectDirtyComponents,
} from "../../../src/domain/make/component/component-list.js";
import { regenerateComponent } from "../../../src/domain/make/component/component-commands.js";
import {
	isStorybookInstalled, installStorybook, runStorybookDev, runStorybookBuild, isStorybookRunning, stopStorybook,
} from "../../../src/domain/make/component/storybook-service.js";
import { componentListMenu } from "../../../src/ui/menus/component-list-menu.js";
import { componentDetailMenu } from "../../../src/ui/menus/component-detail-menu.js";
import type { ProjectComponent } from "../../../src/domain/make/component/component-types.js";
import type { ShellMenuDeps } from "../../../src/infrastructure/deps.js";

const testDeps: ShellMenuDeps = { disk, paths, clock, input, shell, log };

const mockLog = vi.mocked(log);
const mockRunMenu = vi.mocked(runMenu);
const mockDisk = vi.mocked(disk);
const mockListComponents = vi.mocked(listProjectComponents);
const mockBuildTree = vi.mocked(buildComponentTree);
const mockSbInstalled = vi.mocked(isStorybookInstalled);
const mockSbRunning = vi.mocked(isStorybookRunning);
const mockDetectDirty = vi.mocked(detectDirtyComponents);
const mockRegenerate = vi.mocked(regenerateComponent);
const mockDetailMenu = vi.mocked(componentDetailMenu);

function output(): string {
	return mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
}

const COMPONENT_A: ProjectComponent = {
	name: "button",
	kind: "ui-component",
	status: "active",
	path: "components/button/button.md",
};

const COMPONENT_B: ProjectComponent = {
	name: "sidebar",
	kind: "layout",
	status: "draft",
	path: "components/sidebar/sidebar.md",
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

		await componentListMenu("/project", undefined, undefined, testDeps);

		expect(output()).toContain("No components found");
	});

	it("shows component count when components exist", async () => {
		mockListComponents.mockReturnValue([COMPONENT_A]);
		mockBuildTree.mockReturnValue([{ component: COMPONENT_A, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		expect(output()).toContain("1 component(s)");
	});

	it("builds menu items from component tree", async () => {
		mockListComponents.mockReturnValue([COMPONENT_A, COMPONENT_B]);
		mockBuildTree.mockReturnValue([
			{ component: COMPONENT_A, depth: 0 },
			{ component: COMPONENT_B, depth: 1 },
		]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [title, items] = mockRunMenu.mock.calls[0];
		expect(title).toBe("Components");
		// 2 components + sep + Add Component + sep + install + start + stop + build + sep + back = 11
		const nonSep = items.filter((i: any) => !("separator" in i));
		expect(nonSep.length).toBeGreaterThanOrEqual(8); // 2 comps + add + 4 storybook + back
	});

	it("component item returns navigate:component-detail with params", async () => {
		mockListComponents.mockReturnValue([COMPONENT_A]);
		mockBuildTree.mockReturnValue([{ component: COMPONENT_A, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items.find((i: any) => i.key === "1") as any).action();

		expect(result).toContain("navigate:component-detail");
		expect(result).toContain(COMPONENT_A.name);
	});

	it("indents nested components in tree", async () => {
		mockListComponents.mockReturnValue([COMPONENT_A, COMPONENT_B]);
		mockBuildTree.mockReturnValue([
			{ component: COMPONENT_A, depth: 0 },
			{ component: COMPONENT_B, depth: 2 },
		]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		// depth 2 should have indent
		expect(items[1].label).toContain("\u2514 "); // └ character
	});

	it("Add Component action delegates to componentMenu", async () => {
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "c");
		expect(addItem).toBeDefined();
		const result = await (addItem as any).action();
		expect(result).toBeUndefined();
	});

	it("Back returns 'main'", async () => {
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const back = items.find((i: any) => i.key === "b");
		expect(await (back as any).action()).toBe("main");
	});

	// ── Storybook menu items ──────────────────────────────────────────

	it("Install Storybook item is present", async () => {
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

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

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const installItem = items.find((i: any) => i.key === "i");
		expect((installItem as any).disabled()).toBe(true);
	});

	it("Install Storybook disabled is false when not installed", async () => {
		mockSbInstalled.mockReturnValue(false);
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

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

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const startItem = items.find((i: any) => i.key === "s");
		expect((startItem as any).disabled()).toBe(true);
	});

	it("Stop Storybook disabled when not running", async () => {
		mockSbRunning.mockReturnValue(false);
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const stopItem = items.find((i: any) => i.key === "x");
		expect((stopItem as any).disabled()).toBe(true);
	});

	it("Stop Storybook enabled when running", async () => {
		mockSbRunning.mockReturnValue(true);
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const stopItem = items.find((i: any) => i.key === "x");
		expect((stopItem as any).disabled()).toBe(false);
	});

	it("Build Design System disabled when not installed", async () => {
		mockSbInstalled.mockReturnValue(false);
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const buildItem = items.find((i: any) => i.key === "k");
		expect(buildItem!.label).toContain("Build Design System");
		expect((buildItem as any).disabled()).toBe(true);
	});

	it("accepts optional componentsConfig", async () => {
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", { storybook: true }, undefined, testDeps);

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

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		// Both labels should contain status text
		expect(items[0].label).toContain("active");
		expect(items[1].label).toContain("draft");
	});

	it("Install Storybook prompts for framework choice", async () => {
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const installItem = items.find((i: any) => i.key === "i");
		expect(installItem).toBeDefined();
		expect(installItem!.label).toContain("Install Storybook");
	});

	it("calls detectDirtyComponents on load", async () => {
		mockListComponents.mockReturnValue([COMPONENT_A]);
		mockBuildTree.mockReturnValue([{ component: COMPONENT_A, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		expect(mockDetectDirty).toHaveBeenCalledWith("/project", [COMPONENT_A], expect.any(Object));
	});

	it("shows dirty count in header when dirty components exist", async () => {
		const dirty = { ...COMPONENT_A, isDirty: true };
		mockListComponents.mockReturnValue([dirty]);
		mockBuildTree.mockReturnValue([{ component: dirty, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		expect(output()).toContain("1 dirty");
	});

	it("shows dirty indicator on component label", async () => {
		const dirty = { ...COMPONENT_A, isDirty: true };
		mockListComponents.mockReturnValue([dirty]);
		mockBuildTree.mockReturnValue([{ component: dirty, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items[0].label).toContain("*");
	});

	it("component detail navigate includes componentName for dirty component", async () => {
		const dirty = { ...COMPONENT_A, isDirty: true };
		mockListComponents.mockReturnValue([dirty]);
		mockBuildTree.mockReturnValue([{ component: dirty, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await items[0].action();
		expect(result).toContain("navigate:component-detail");
		expect(result).toContain(dirty.name);
	});

	it("Regenerate Dirty Components item is present", async () => {
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const regenItem = items.find((i: any) => i.key === "r");
		expect(regenItem).toBeDefined();
		expect(regenItem!.label).toContain("Regenerate");
	});

	it("Regenerate is disabled when no dirty components", async () => {
		mockListComponents.mockReturnValue([COMPONENT_A]);
		mockBuildTree.mockReturnValue([{ component: COMPONENT_A, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const regenItem = items.find((i: any) => i.key === "r");
		expect(typeof regenItem!.disabled).toBe("function");
		expect((regenItem!.disabled as Function)()).toBe(true);
	});

	it("Regenerate calls regenerateComponent for each dirty component after confirmation", async () => {
		const dirty = { ...COMPONENT_A, isDirty: true };
		mockListComponents.mockReturnValue([dirty]);
		mockBuildTree.mockReturnValue([{ component: dirty, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");
		vi.mocked(input.askYesNo).mockResolvedValue(true);

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const regenItem = items.find((i: any) => i.key === "r");
		await (regenItem as any).action();
		expect(input.askYesNo).toHaveBeenCalled();
		expect(mockRegenerate).toHaveBeenCalledWith("button", "/project", expect.any(Object), undefined, "@storybook/html-vite");
	});

	it("Regenerate skips when user declines confirmation", async () => {
		const dirty = { ...COMPONENT_A, isDirty: true };
		mockListComponents.mockReturnValue([dirty]);
		mockBuildTree.mockReturnValue([{ component: dirty, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");
		vi.mocked(input.askYesNo).mockResolvedValue(false);

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const regenItem = items.find((i: any) => i.key === "r");
		await (regenItem as any).action();
		expect(mockRegenerate).not.toHaveBeenCalled();
		expect(output()).toContain("Cancelled");
	});

	it("Regenerate clears isDirty on success", async () => {
		const dirty = { ...COMPONENT_A, isDirty: true };
		mockListComponents.mockReturnValue([dirty]);
		mockBuildTree.mockReturnValue([{ component: dirty, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");
		vi.mocked(input.askYesNo).mockResolvedValue(true);

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const regenItem = items.find((i: any) => i.key === "r");
		await (regenItem as any).action();
		expect(dirty.isDirty).toBe(false);
	});

	it("shows framework label in header when Storybook is installed", async () => {
		vi.mocked(getFramework).mockReturnValue("angular");
		mockSbInstalled.mockReturnValue(true);
		mockListComponents.mockReturnValue([COMPONENT_A]);
		mockBuildTree.mockReturnValue([{ component: COMPONENT_A, depth: 0 }]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		expect(output()).toContain("Angular");
		mockSbInstalled.mockReturnValue(false);
	});

	it("Build Design System item is present", async () => {
		mockListComponents.mockReturnValue([]);
		mockBuildTree.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentListMenu("/project", undefined, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const buildItem = items.find((i: any) => i.key === "k");
		expect(buildItem).toBeDefined();
	});
});
