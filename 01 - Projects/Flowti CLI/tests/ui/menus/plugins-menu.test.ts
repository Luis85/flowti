import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/infrastructure/menu.js", () => ({ runMenu: vi.fn() }));
vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(), confirm: vi.fn(), select: vi.fn(), waitForEnter: vi.fn() },
}));
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), readdirSync: vi.fn(() => []), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
}));
vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => 0), runSilent: vi.fn(() => null), runCaptureStatus: vi.fn(() => ({ output: "", exitCode: 0 })) },
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		relative: (from: string, to: string) => to.replace(from + "/", ""),
	},
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	CLI_PROJECT: "/vault/cli",
}));
vi.mock("../../../src/domain/plugins/plugin-loader.js", () => ({
	loadPlugins: vi.fn(() => []),
	scaffoldPlugin: vi.fn(),
}));
vi.mock("../../../src/domain/plugins/plugin-reference.js", () => ({
	generatePluginReference: vi.fn(() => ({ save: vi.fn() })),
}));
vi.mock("../../../src/ui/plugins-display.js", () => ({
	renderPluginList: vi.fn(),
	renderPluginValidation: vi.fn(),
}));
vi.mock("../../../src/domain/plugins/plugin-commands.js", () => ({
	toPluginListItems: vi.fn(() => []),
	toPluginValidationItems: vi.fn(() => []),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { input } from "../../../src/infrastructure/input.js";
import { loadPlugins, scaffoldPlugin } from "../../../src/domain/plugins/plugin-loader.js";
import { generatePluginReference } from "../../../src/domain/plugins/plugin-reference.js";
import { renderPluginList, renderPluginValidation } from "../../../src/ui/plugins-display.js";
import { toPluginListItems, toPluginValidationItems } from "../../../src/domain/plugins/plugin-commands.js";
import { pluginsMenu } from "../../../src/ui/menus/plugins-menu.js";

const mockLog = vi.mocked(log);
const mockRunMenu = vi.mocked(runMenu);
const mockInput = vi.mocked(input);
const mockLoadPlugins = vi.mocked(loadPlugins);
const mockScaffoldPlugin = vi.mocked(scaffoldPlugin);
const mockGenRef = vi.mocked(generatePluginReference);
const mockRenderList = vi.mocked(renderPluginList);
const mockRenderValidation = vi.mocked(renderPluginValidation);
const mockToListItems = vi.mocked(toPluginListItems);
const mockToValidationItems = vi.mocked(toPluginValidationItems);

beforeEach(() => {
	vi.clearAllMocks();
});

describe("pluginsMenu", () => {
	it("builds menu with all 4 options plus back", async () => {
		mockRunMenu.mockResolvedValue(undefined);

		await pluginsMenu();

		expect(mockRunMenu).toHaveBeenCalledTimes(1);
		const [title, items] = mockRunMenu.mock.calls[0];
		expect(title).toBe("Plugins");
		// 4 items + separator + back = 6
		expect(items).toHaveLength(6);
	});

	it("returns 'main' always", async () => {
		mockRunMenu.mockResolvedValue(undefined);

		const result = await pluginsMenu();

		expect(result).toBe("main");
	});

	it("List Plugins action loads and renders plugins", async () => {
		const plugins = [{ name: "p1" }] as any;
		mockLoadPlugins.mockReturnValue(plugins);
		mockToListItems.mockReturnValue([{ name: "p1" }] as any);
		mockRunMenu.mockResolvedValue(undefined);

		await pluginsMenu();

		const [, items] = mockRunMenu.mock.calls[0];
		const listItem = items.find((i: any) => i.key === "1");
		const result = await (listItem as any).action();

		expect(mockLoadPlugins).toHaveBeenCalled();
		expect(mockToListItems).toHaveBeenCalledWith(plugins);
		expect(mockRenderList).toHaveBeenCalled();
		expect(result).toBe("main");
	});

	it("Validate Plugins action validates and renders", async () => {
		mockToValidationItems.mockReturnValue([{ name: "p1", valid: true }] as any);
		mockRunMenu.mockResolvedValue(undefined);

		await pluginsMenu();

		const [, items] = mockRunMenu.mock.calls[0];
		const validateItem = items.find((i: any) => i.key === "2");
		const result = await (validateItem as any).action();

		expect(mockToValidationItems).toHaveBeenCalled();
		expect(mockRenderValidation).toHaveBeenCalled();
		expect(result).toBe("main");
	});

	it("Create Plugin: scaffolds on success", async () => {
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask.mockResolvedValueOnce("my-plugin").mockResolvedValueOnce("A plugin");
		mockScaffoldPlugin.mockReturnValue({ path: "/vault/plugins/my-plugin" } as any);

		await pluginsMenu();

		const [, items] = mockRunMenu.mock.calls[0];
		const createItem = items.find((i: any) => i.key === "3");
		const result = await (createItem as any).action();

		expect(mockScaffoldPlugin).toHaveBeenCalledWith("/vault", "my-plugin", "A plugin", expect.anything());
		expect(result).toBe("main");
		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Created plugin at");
	});

	it("Create Plugin: cancelled when name is empty", async () => {
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask.mockResolvedValueOnce("");

		await pluginsMenu();

		const [, items] = mockRunMenu.mock.calls[0];
		const createItem = items.find((i: any) => i.key === "3");
		await (createItem as any).action();

		expect(mockScaffoldPlugin).not.toHaveBeenCalled();
		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Cancelled");
	});

	it("Create Plugin: shows error on scaffold failure", async () => {
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask.mockResolvedValueOnce("bad-plugin").mockResolvedValueOnce("desc");
		mockScaffoldPlugin.mockReturnValue({ error: "Already exists" } as any);

		await pluginsMenu();

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "3") as any).action();

		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Already exists");
	});

	it("Create Plugin: uses default description when empty", async () => {
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask.mockResolvedValueOnce("my-plugin").mockResolvedValueOnce("");
		mockScaffoldPlugin.mockReturnValue({ path: "/p" } as any);

		await pluginsMenu();

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "3") as any).action();

		expect(mockScaffoldPlugin).toHaveBeenCalledWith("/vault", "my-plugin", "A Flowti plugin", expect.anything());
	});

	it("Generate Reference action generates and saves", async () => {
		const mockSave = vi.fn();
		mockGenRef.mockReturnValue({ save: mockSave } as any);
		mockLoadPlugins.mockReturnValue([]);
		mockRunMenu.mockResolvedValue(undefined);

		await pluginsMenu();

		const [, items] = mockRunMenu.mock.calls[0];
		const genItem = items.find((i: any) => i.key === "4");
		const result = await (genItem as any).action();

		expect(mockGenRef).toHaveBeenCalled();
		expect(mockSave).toHaveBeenCalled();
		expect(result).toBe("main");
		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Reference saved");
	});

	it("Back returns 'quit'", async () => {
		mockRunMenu.mockResolvedValue(undefined);

		await pluginsMenu();

		const [, items] = mockRunMenu.mock.calls[0];
		const back = items.find((i: any) => i.key === "b");
		expect(await (back as any).action()).toBe("quit");
	});
});
