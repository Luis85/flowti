import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", YELLOW: "", CYAN: "", RED: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/infrastructure/menu.js", () => ({ runMenu: vi.fn() }));
vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(), waitForEnter: vi.fn(), askYesNo: vi.fn() },
}));
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), writeFileSync: vi.fn(), mkdirSync: vi.fn(), readdirSync: vi.fn(() => []) },
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop() ?? "",
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		sep: "/",
	},
}));
vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-01-01T00:00:00.000Z", ms: () => 0, now: () => new Date("2026-01-01"), safeIso: () => "2026-01-01T00-00-00" },
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock",
	CLI_PROJECT: "/mock/cli",
	cliConfig: {},
}));
vi.mock("../../../src/domain/make/component/component-editor.js", () => ({
	readComponentInstance: vi.fn(),
	writeComponentInstance: vi.fn(),
	getEditableFields: vi.fn(() => ["name", "description", "status"]),
	setField: vi.fn(),
	addProperty: vi.fn(),
	removeProperty: vi.fn(),
	addAction: vi.fn(),
	removeAction: vi.fn(),
}));
vi.mock("../../../src/domain/make/component/component-commands.js", () => ({
	regenerateComponent: vi.fn(() => ({ success: true, name: "button", filesWritten: 3 })),
}));
vi.mock("../../../src/domain/make/component/storybook-settings.js", () => ({
	getFramework: vi.fn(() => "html"),
}));
vi.mock("../../../src/domain/make/component/storybook-service.js", () => ({
	getFrameworkPackages: vi.fn(() => ({ framework: "@storybook/html-vite" })),
}));
vi.mock("../../../src/domain/make/component/component-list.js", () => ({
	buildAncestryPath: vi.fn(() => "System > Button"),
	findSiblings: vi.fn(() => []),
	COMPONENTS_DIR: "components",
}));
vi.mock("../../../src/domain/make/component/action-reference.js", () => ({
	ACTION_REFERENCE: [
		{ category: "Mouse", actions: [{ name: "onClick", description: "Fired when clicked" }] },
		{ category: "Form", actions: [{ name: "onChange", description: "Fired on change" }] },
	],
	searchActions: vi.fn(() => []),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { input } from "../../../src/infrastructure/input.js";
import { readComponentInstance } from "../../../src/domain/make/component/component-editor.js";
import { regenerateComponent } from "../../../src/domain/make/component/component-commands.js";
import { componentDetailMenu } from "../../../src/ui/menus/component-detail-menu.js";
import type { ProjectComponent } from "../../../src/domain/make/component/component-types.js";

const mockLog = vi.mocked(log);
const mockRunMenu = vi.mocked(runMenu);
const mockReadInstance = vi.mocked(readComponentInstance);
const mockRegenerate = vi.mocked(regenerateComponent);
const mockInput = vi.mocked(input);

function output(): string {
	return mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
}

const COMPONENT: ProjectComponent = {
	name: "button",
	kind: "ui-component",
	status: "active",
	path: "components/button/button.md",
};

const INSTANCE = {
	name: "Button",
	id: "button",
	type: "ui-component",
	status: "active",
	description: "A clickable button",
	properties: { variant: "default", disabled: false },
	actions: ["onClick", "onFocus"],
	variants: { primary: { variant: "primary" } },
	states: { hover: { variant: "default" } },
};

beforeEach(() => {
	vi.clearAllMocks();
	mockRunMenu.mockResolvedValue("main");
});

describe("componentDetailMenu", () => {
	it("shows no-definition message when JSON missing", async () => {
		mockReadInstance.mockReturnValue(null);
		mockInput.waitForEnter.mockResolvedValue();

		await componentDetailMenu("/project", COMPONENT, [COMPONENT]);

		expect(output()).toContain("No definition JSON found");
	});

	it("displays component name and type", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT]);

		expect(output()).toContain("Button");
		expect(output()).toContain("ui-component");
	});

	it("displays description when present", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT]);

		expect(output()).toContain("A clickable button");
	});

	it("displays properties", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT]);

		expect(output()).toContain("Properties:");
		expect(output()).toContain("variant");
		expect(output()).toContain("disabled");
	});

	it("displays actions", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT]);

		expect(output()).toContain("Actions:");
		expect(output()).toContain("onClick");
		expect(output()).toContain("onFocus");
	});

	it("displays variants", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT]);

		expect(output()).toContain("Variants:");
		expect(output()).toContain("primary");
	});

	it("displays states", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT]);

		expect(output()).toContain("States:");
		expect(output()).toContain("hover");
	});

	it("shows dirty message when isDirty", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);
		const dirty = { ...COMPONENT, isDirty: true };

		await componentDetailMenu("/project", dirty, [dirty]);

		expect(output()).toContain("Definition modified");
	});

	it("includes Edit Fields menu item", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT]);

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items.find((i: any) => i.key === "e")).toBeDefined();
	});

	it("includes Edit Properties menu item", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT]);

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items.find((i: any) => i.key === "p")).toBeDefined();
	});

	it("includes Edit Actions menu item", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT]);

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items.find((i: any) => i.key === "a")).toBeDefined();
	});

	it("includes Regenerate item when dirty", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);
		const dirty = { ...COMPONENT, isDirty: true };

		await componentDetailMenu("/project", dirty, [dirty]);

		const [, items] = mockRunMenu.mock.calls[0];
		const regenItem = items.find((i: any) => i.key === "r");
		expect(regenItem).toBeDefined();
		expect(regenItem!.label).toContain("Regenerate");
	});

	it("does not include Regenerate item when clean", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT]);

		const [, items] = mockRunMenu.mock.calls[0];
		const regenItem = items.find((i: any) => i.key === "r");
		expect(regenItem).toBeUndefined();
	});

	it("Regenerate action prompts for confirmation", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);
		mockInput.askYesNo.mockResolvedValue(true);
		const dirty = { ...COMPONENT, isDirty: true };

		await componentDetailMenu("/project", dirty, [dirty]);

		const [, items] = mockRunMenu.mock.calls[0];
		const regenItem = items.find((i: any) => i.key === "r");
		await (regenItem as any).action();
		expect(mockInput.askYesNo).toHaveBeenCalled();
		expect(mockRegenerate).toHaveBeenCalledWith("button", "/project", expect.any(Object), undefined, "@storybook/html-vite");
	});

	it("Regenerate clears isDirty and shows fresh message", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);
		mockInput.askYesNo.mockResolvedValue(true);
		const dirty = { ...COMPONENT, isDirty: true };

		await componentDetailMenu("/project", dirty, [dirty]);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "r") as any).action();
		expect(dirty.isDirty).toBe(false);
		expect(output()).toContain("fresh");
	});

	it("Regenerate skips when user declines", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);
		mockInput.askYesNo.mockResolvedValue(false);
		const dirty = { ...COMPONENT, isDirty: true };

		await componentDetailMenu("/project", dirty, [dirty]);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "r") as any).action();
		expect(mockRegenerate).not.toHaveBeenCalled();
		expect(output()).toContain("Cancelled");
	});

	it("includes Back item", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT]);

		const [, items] = mockRunMenu.mock.calls[0];
		const backItem = items.find((i: any) => i.key === "b");
		expect(backItem).toBeDefined();
		expect(backItem!.action()).toBe("main");
	});
});
