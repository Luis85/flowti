import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/infrastructure/menu.js", () => ({ runMenu: vi.fn() }));
vi.mock("../../../src/domain/make/component/action-reference.js", () => ({
	ACTION_REFERENCE: [
		{
			category: "Navigation",
			actions: [
				{ name: "navigate", description: "Navigate to a route" },
				{ name: "goBack", description: "Go back" },
			],
		},
		{
			category: "Data",
			actions: [
				{ name: "fetchData", description: "Fetch remote data" },
			],
		},
	],
	searchActions: vi.fn(),
}));
vi.mock("../../../src/domain/make/component/component-editor.js", () => ({
	addAction: vi.fn(),
	writeComponentInstance: vi.fn(),
}));

import { runMenu } from "../../../src/infrastructure/menu.js";
import { searchActions } from "../../../src/domain/make/component/action-reference.js";
import { addAction, writeComponentInstance } from "../../../src/domain/make/component/component-editor.js";
import { actionReferenceMenu, addFromReferenceMenu } from "../../../src/ui/menus/action-reference-menu.js";
import type { ActionRefDeps } from "../../../src/infrastructure/deps.js";
import type { ComponentInstance } from "../../../src/domain/make/component/component-editor.js";

const mockRunMenu = vi.mocked(runMenu);
const mockSearchActions = vi.mocked(searchActions);
const mockAddAction = vi.mocked(addAction);
const mockWriteInstance = vi.mocked(writeComponentInstance);

const logs: string[] = [];
const mockDeps: ActionRefDeps = {
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), writeFileSync: vi.fn(), mkdirSync: vi.fn(), readdirSync: vi.fn(() => []) } as any,
	paths: { join: (...args: string[]) => args.join("/"), basename: (p: string) => p.split("/").pop() ?? "" } as any,
	input: { ask: vi.fn(), waitForEnter: vi.fn(), askYesNo: vi.fn() } as any,
	log: ((...args: unknown[]) => { logs.push(String(args[0] ?? "")); }) as any,
};

const mockInput = vi.mocked(mockDeps.input);

function output(): string {
	return logs.join("\n");
}

function makeInstance(overrides: Partial<ComponentInstance> = {}): ComponentInstance {
	return { name: "MyButton", id: "my-button", type: "component", status: "draft", ...overrides };
}

beforeEach(() => {
	vi.clearAllMocks();
	logs.length = 0;
	mockRunMenu.mockResolvedValue("main");
});

// ── actionReferenceMenu ─────────────────────────────────────────────

describe("actionReferenceMenu", () => {
	it("calls runMenu with correct title", async () => {
		await actionReferenceMenu(mockDeps);

		expect(mockRunMenu).toHaveBeenCalledTimes(1);
		const [title] = mockRunMenu.mock.calls[0];
		expect(title).toBe("Action Reference");
	});

	it("builds menu items from ACTION_REFERENCE categories", async () => {
		await actionReferenceMenu(mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		// 2 categories + sep + Search + sep + Back = 6
		expect(items.length).toBe(6);
		expect(items[0].key).toBe("1");
		expect(items[0].label).toContain("Navigation");
		expect(items[0].label).toContain("(2)");
		expect(items[1].key).toBe("2");
		expect(items[1].label).toContain("Data");
		expect(items[1].label).toContain("(1)");
	});

	it("category action logs actions and waits for enter", async () => {
		mockInput.waitForEnter.mockResolvedValue(undefined as any);

		await actionReferenceMenu(mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(output()).toContain("Navigation Actions");
		expect(output()).toContain("navigate");
		expect(output()).toContain("Navigate to a route");
		expect(output()).toContain("goBack");
		expect(mockInput.waitForEnter).toHaveBeenCalled();
	});

	it("search action with results logs matching categories", async () => {
		mockInput.ask.mockResolvedValue("fetch");
		mockSearchActions.mockReturnValue([
			{ category: "Data", actions: [{ name: "fetchData", description: "Fetch remote data" }] },
		]);

		await actionReferenceMenu(mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const searchItem = items.find((i: any) => i.key === "s");
		expect(searchItem).toBeDefined();
		await (searchItem as any).action();

		expect(mockSearchActions).toHaveBeenCalledWith("fetch");
		expect(output()).toContain("Data");
		expect(output()).toContain("fetchData");
	});

	it("search action with no results logs no-match message", async () => {
		mockInput.ask.mockResolvedValue("zzz");
		mockSearchActions.mockReturnValue([]);

		await actionReferenceMenu(mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const searchItem = items.find((i: any) => i.key === "s");
		await (searchItem as any).action();

		expect(output()).toContain('No actions matching "zzz"');
	});

	it("search action does nothing when term is empty", async () => {
		mockInput.ask.mockResolvedValue("");

		await actionReferenceMenu(mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const searchItem = items.find((i: any) => i.key === "s");
		await (searchItem as any).action();

		expect(mockSearchActions).not.toHaveBeenCalled();
	});

	it("back action returns 'main'", async () => {
		await actionReferenceMenu(mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const backItem = items.find((i: any) => i.key === "b");
		expect(backItem).toBeDefined();
		expect(backItem!.action()).toBe("main");
	});
});

// ── addFromReferenceMenu ────────────────────────────────────────────

describe("addFromReferenceMenu", () => {
	it("calls runMenu with correct title", async () => {
		const instance = makeInstance();

		await addFromReferenceMenu("/project", "MyButton", instance, mockDeps);

		expect(mockRunMenu).toHaveBeenCalledTimes(1);
		const [title] = mockRunMenu.mock.calls[0];
		expect(title).toBe("Choose Category");
	});

	it("builds category menu items plus back", async () => {
		const instance = makeInstance();

		await addFromReferenceMenu("/project", "MyButton", instance, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		// 2 categories + sep + Back = 4
		expect(items.length).toBe(4);
		expect(items[0].label).toContain("Navigation");
		expect(items[1].label).toContain("Data");
	});

	it("category action opens sub-menu for adding actions", async () => {
		const instance = makeInstance();
		// First runMenu is addFromReferenceMenu, second is addFromCategoryMenu
		mockRunMenu.mockResolvedValueOnce(undefined as any).mockResolvedValueOnce("main");

		await addFromReferenceMenu("/project", "MyButton", instance, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		// Should have opened a second runMenu for category actions
		expect(mockRunMenu).toHaveBeenCalledTimes(2);
		const [subTitle, subItems] = mockRunMenu.mock.calls[1];
		expect(subTitle).toContain("Navigation Actions");
		// 2 actions + sep + Back = 4
		expect(subItems.length).toBe(4);
	});

	it("adding an action calls addAction and writeComponentInstance", async () => {
		const instance = makeInstance();
		mockRunMenu.mockResolvedValueOnce(undefined as any).mockResolvedValueOnce("main");
		mockInput.waitForEnter.mockResolvedValue(undefined as any);

		await addFromReferenceMenu("/project", "MyButton", instance, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		const [, subItems] = mockRunMenu.mock.calls[1];
		await (subItems[0] as any).action();

		expect(mockAddAction).toHaveBeenCalledWith(instance, "navigate");
		expect(mockWriteInstance).toHaveBeenCalledWith("/project", "MyButton", instance, mockDeps, undefined);
		expect(output()).toContain("Added navigate");
	});

	it("adding an action with domain passes domain through", async () => {
		const instance = makeInstance();
		mockRunMenu.mockResolvedValueOnce(undefined as any).mockResolvedValueOnce("main");
		mockInput.waitForEnter.mockResolvedValue(undefined as any);

		await addFromReferenceMenu("/project", "MyButton", instance, mockDeps, "auth");

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		const [, subItems] = mockRunMenu.mock.calls[1];
		await (subItems[0] as any).action();

		expect(mockWriteInstance).toHaveBeenCalledWith("/project", "MyButton", instance, mockDeps, "auth");
	});

	it("skips already-added actions", async () => {
		const instance = makeInstance({ actions: ["navigate"] });
		mockRunMenu.mockResolvedValueOnce(undefined as any).mockResolvedValueOnce("main");

		await addFromReferenceMenu("/project", "MyButton", instance, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		const [, subItems] = mockRunMenu.mock.calls[1];
		// Label should show (added) indicator
		expect(subItems[0].label).toContain("(added)");

		// Clicking it should show "already exists" message
		await (subItems[0] as any).action();
		expect(output()).toContain("already exists");
		expect(mockAddAction).not.toHaveBeenCalled();
	});

	it("back action returns 'main'", async () => {
		const instance = makeInstance();

		await addFromReferenceMenu("/project", "MyButton", instance, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const backItem = items.find((i: any) => i.key === "b");
		expect(backItem).toBeDefined();
		expect(backItem!.action()).toBe("main");
	});
});
