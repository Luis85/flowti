import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", YELLOW: "", CYAN: "", RED: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/infrastructure/menu.js", () => ({ runMenu: vi.fn() }));
vi.mock("../../../src/domain/make/component/component-editor.js", () => ({
	addStore: vi.fn(),
	removeStore: vi.fn(),
	addChild: vi.fn(),
	removeChild: vi.fn(),
	writeComponentInstance: vi.fn(),
}));

import { runMenu } from "../../../src/infrastructure/menu.js";
import { addStore, removeStore, addChild, removeChild, writeComponentInstance } from "../../../src/domain/make/component/component-editor.js";
import { editStoresMenu, editChildrenMenu } from "../../../src/ui/menus/component-editor-menus.js";
import type { EditorMenuDeps } from "../../../src/infrastructure/deps.js";
import type { ComponentInstance } from "../../../src/domain/make/component/component-editor.js";
import type { ProjectComponent } from "../../../src/domain/make/component/component-types.js";

const mockRunMenu = vi.mocked(runMenu);
const mockAddStore = vi.mocked(addStore);
const mockRemoveStore = vi.mocked(removeStore);
const mockAddChild = vi.mocked(addChild);
const mockRemoveChild = vi.mocked(removeChild);
const mockWriteInstance = vi.mocked(writeComponentInstance);

const logs: string[] = [];
const mockDeps: EditorMenuDeps = {
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

// ── editStoresMenu ──────────────────────────────────────────────────

describe("editStoresMenu", () => {
	it("calls runMenu with correct title", async () => {
		const instance = makeInstance();

		await editStoresMenu("/project", "MyButton", instance, undefined, mockDeps);

		expect(mockRunMenu).toHaveBeenCalledTimes(1);
		const [title] = mockRunMenu.mock.calls[0];
		expect(title).toBe("Edit Stores");
	});

	it("builds menu items from existing stores", async () => {
		const instance = makeInstance({
			stores: [
				{ name: "useAuthStore", technology: "pinia", description: "Auth state" },
				{ name: "useCartStore" },
			],
		});

		await editStoresMenu("/project", "MyButton", instance, undefined, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		// 2 stores + sep + Add Store + sep + Back = 6
		expect(items.length).toBe(6);
		expect(items[0].label).toContain("useAuthStore");
		expect(items[0].label).toContain("[pinia]");
		expect(items[0].label).toContain("Auth state");
		expect(items[1].label).toContain("useCartStore");
	});

	it("builds menu with no stores — only Add and Back", async () => {
		const instance = makeInstance();

		await editStoresMenu("/project", "MyButton", instance, undefined, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		// 0 stores + sep + Add Store + sep + Back = 4
		expect(items.length).toBe(4);
	});

	it("clicking existing store and confirming removes it", async () => {
		const instance = makeInstance({ stores: [{ name: "useAuthStore" }] });
		mockInput.askYesNo.mockResolvedValue(true);
		mockInput.waitForEnter.mockResolvedValue(undefined as any);

		await editStoresMenu("/project", "MyButton", instance, undefined, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockRemoveStore).toHaveBeenCalledWith(instance, "useAuthStore");
		expect(mockWriteInstance).toHaveBeenCalledWith("/project", "MyButton", instance, mockDeps, undefined);
		expect(output()).toContain("Removed useAuthStore");
	});

	it("clicking existing store and declining does not remove it", async () => {
		const instance = makeInstance({ stores: [{ name: "useAuthStore" }] });
		mockInput.askYesNo.mockResolvedValue(false);

		await editStoresMenu("/project", "MyButton", instance, undefined, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockRemoveStore).not.toHaveBeenCalled();
	});

	it("Add Store creates store with all fields", async () => {
		const instance = makeInstance();
		mockInput.ask
			.mockResolvedValueOnce("useAuthStore")
			.mockResolvedValueOnce("pinia")
			.mockResolvedValueOnce("Auth state");
		mockInput.waitForEnter.mockResolvedValue(undefined as any);

		await editStoresMenu("/project", "MyButton", instance, undefined, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		expect(addItem).toBeDefined();
		await (addItem as any).action();

		expect(mockAddStore).toHaveBeenCalledWith(instance, {
			name: "useAuthStore",
			technology: "pinia",
			description: "Auth state",
		});
		expect(mockWriteInstance).toHaveBeenCalled();
		expect(output()).toContain("Added useAuthStore");
	});

	it("Add Store creates store with name only when optional fields empty", async () => {
		const instance = makeInstance();
		mockInput.ask
			.mockResolvedValueOnce("useStore")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("");
		mockInput.waitForEnter.mockResolvedValue(undefined as any);

		await editStoresMenu("/project", "MyButton", instance, undefined, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		await (addItem as any).action();

		expect(mockAddStore).toHaveBeenCalledWith(instance, { name: "useStore" });
	});

	it("Add Store does nothing when name is empty", async () => {
		const instance = makeInstance();
		mockInput.ask.mockResolvedValueOnce("");

		await editStoresMenu("/project", "MyButton", instance, undefined, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		await (addItem as any).action();

		expect(mockAddStore).not.toHaveBeenCalled();
	});

	it("passes domain through to writeComponentInstance", async () => {
		const instance = makeInstance({ stores: [{ name: "useAuthStore" }] });
		mockInput.askYesNo.mockResolvedValue(true);
		mockInput.waitForEnter.mockResolvedValue(undefined as any);

		await editStoresMenu("/project", "MyButton", instance, "auth", mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockWriteInstance).toHaveBeenCalledWith("/project", "MyButton", instance, mockDeps, "auth");
	});

	it("back action returns 'main'", async () => {
		const instance = makeInstance();

		await editStoresMenu("/project", "MyButton", instance, undefined, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const backItem = items.find((i: any) => i.key === "b");
		expect(backItem).toBeDefined();
		expect(backItem!.action()).toBe("main");
	});
});

// ── editChildrenMenu ────────────────────────────────────────────────

describe("editChildrenMenu", () => {
	const allComponents: ProjectComponent[] = [
		{ name: "MyButton", kind: "component" as any, status: "draft", path: "/p/MyButton" },
		{ name: "MyCard", kind: "component" as any, status: "draft", path: "/p/MyCard" },
		{ name: "MyHeader", kind: "component" as any, status: "draft", path: "/p/MyHeader" },
	];

	it("calls runMenu with correct title", async () => {
		const instance = makeInstance();

		await editChildrenMenu("/project", "MyButton", instance, allComponents, undefined, mockDeps);

		expect(mockRunMenu).toHaveBeenCalledTimes(1);
		const [title] = mockRunMenu.mock.calls[0];
		expect(title).toBe("Edit Children");
	});

	it("builds menu items from existing children", async () => {
		const instance = makeInstance({
			children: [
				{ name: "MyCard", slot: "content" },
				{ name: "MyHeader", optional: true },
			],
		});

		await editChildrenMenu("/project", "MyButton", instance, allComponents, undefined, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		// 2 children + sep + Add Child + sep + Back = 6
		expect(items.length).toBe(6);
		expect(items[0].label).toContain("MyCard");
		expect(items[0].label).toContain("[content]");
		expect(items[1].label).toContain("MyHeader");
		expect(items[1].label).toContain("(optional)");
	});

	it("clicking existing child and confirming removes it", async () => {
		const instance = makeInstance({ children: [{ name: "MyCard" }] });
		mockInput.askYesNo.mockResolvedValue(true);
		mockInput.waitForEnter.mockResolvedValue(undefined as any);

		await editChildrenMenu("/project", "MyButton", instance, allComponents, undefined, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockRemoveChild).toHaveBeenCalledWith(instance, "MyCard");
		expect(mockWriteInstance).toHaveBeenCalledWith("/project", "MyButton", instance, mockDeps, undefined);
		expect(output()).toContain("Removed MyCard");
	});

	it("clicking existing child and declining does not remove it", async () => {
		const instance = makeInstance({ children: [{ name: "MyCard" }] });
		mockInput.askYesNo.mockResolvedValue(false);

		await editChildrenMenu("/project", "MyButton", instance, allComponents, undefined, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockRemoveChild).not.toHaveBeenCalled();
	});

	it("Add Child shows available components (excludes self and existing children)", async () => {
		const instance = makeInstance({ children: [{ name: "MyCard" }] });
		mockRunMenu.mockResolvedValueOnce(undefined as any).mockResolvedValueOnce("main");

		await editChildrenMenu("/project", "MyButton", instance, allComponents, undefined, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		expect(addItem).toBeDefined();
		await (addItem as any).action();

		// Second runMenu is the child picker
		expect(mockRunMenu).toHaveBeenCalledTimes(2);
		const [subTitle, subItems] = mockRunMenu.mock.calls[1];
		expect(subTitle).toBe("Add Child Component");
		// Only MyHeader available (MyButton=self, MyCard=already child), + sep + Back = 3
		expect(subItems.length).toBe(3);
		expect(subItems[0].label).toContain("MyHeader");
	});

	it("Add Child shows no-available message when all components are already children or self", async () => {
		const instance = makeInstance({ children: [{ name: "MyCard" }, { name: "MyHeader" }] });

		await editChildrenMenu("/project", "MyButton", instance, allComponents, undefined, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		await (addItem as any).action();

		expect(output()).toContain("No available components to add as children");
		// No second runMenu call
		expect(mockRunMenu).toHaveBeenCalledTimes(1);
	});

	it("selecting a child from the picker adds it with slot and optional", async () => {
		const instance = makeInstance();
		mockRunMenu.mockResolvedValueOnce(undefined as any).mockResolvedValueOnce("main");
		mockInput.ask.mockResolvedValue("header");
		mockInput.askYesNo.mockResolvedValue(true);
		mockInput.waitForEnter.mockResolvedValue(undefined as any);

		await editChildrenMenu("/project", "MyButton", instance, allComponents, undefined, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		await (addItem as any).action();

		const [, subItems] = mockRunMenu.mock.calls[1];
		// Pick MyCard (first available that isn't self)
		await (subItems[0] as any).action();

		expect(mockAddChild).toHaveBeenCalledWith(instance, { name: "MyCard", slot: "header", optional: true });
		expect(mockWriteInstance).toHaveBeenCalled();
		expect(output()).toContain("Added MyCard");
	});

	it("selecting a child without slot or optional adds minimal child", async () => {
		const instance = makeInstance();
		mockRunMenu.mockResolvedValueOnce(undefined as any).mockResolvedValueOnce("main");
		mockInput.ask.mockResolvedValue("");
		mockInput.askYesNo.mockResolvedValue(false);
		mockInput.waitForEnter.mockResolvedValue(undefined as any);

		await editChildrenMenu("/project", "MyButton", instance, allComponents, undefined, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		await (addItem as any).action();

		const [, subItems] = mockRunMenu.mock.calls[1];
		await (subItems[0] as any).action();

		expect(mockAddChild).toHaveBeenCalledWith(instance, { name: "MyCard" });
	});

	it("passes domain through to writeComponentInstance", async () => {
		const instance = makeInstance({ children: [{ name: "MyCard" }] });
		mockInput.askYesNo.mockResolvedValue(true);
		mockInput.waitForEnter.mockResolvedValue(undefined as any);

		await editChildrenMenu("/project", "MyButton", instance, allComponents, "auth", mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockWriteInstance).toHaveBeenCalledWith("/project", "MyButton", instance, mockDeps, "auth");
	});

	it("back action returns 'main'", async () => {
		const instance = makeInstance();

		await editChildrenMenu("/project", "MyButton", instance, allComponents, undefined, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const backItem = items.find((i: any) => i.key === "b");
		expect(backItem).toBeDefined();
		expect(backItem!.action()).toBe("main");
	});
});
