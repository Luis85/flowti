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
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		relative: (from: string, to: string) => to.replace(from + "/", ""),
	},
}));
vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: vi.fn(() => "2026-01-01T00:00:00.000Z") },
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	CLI_PROJECT: "/vault/cli",
}));
vi.mock("../../../src/domain/ai-tools/ai-tool-loader.js", () => ({
	loadAiTools: vi.fn(() => []),
	scaffoldAiTool: vi.fn(),
}));
vi.mock("../../../src/domain/ai-tools/ai-tool-reference.js", () => ({
	generateAiToolReference: vi.fn(() => ({ save: vi.fn() })),
}));
vi.mock("../../../src/ui/ai-tools-display.js", () => ({
	renderToolList: vi.fn(),
	renderToolValidation: vi.fn(),
}));
vi.mock("../../../src/domain/ai-tools/ai-tool-commands.js", () => ({
	toToolListItems: vi.fn(() => []),
	toToolValidationItems: vi.fn(() => []),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { input } from "../../../src/infrastructure/input.js";
import { loadAiTools, scaffoldAiTool } from "../../../src/domain/ai-tools/ai-tool-loader.js";
import { generateAiToolReference } from "../../../src/domain/ai-tools/ai-tool-reference.js";
import { renderToolList, renderToolValidation } from "../../../src/ui/ai-tools-display.js";
import { toToolListItems, toToolValidationItems } from "../../../src/domain/ai-tools/ai-tool-commands.js";
import { aiToolsMenu } from "../../../src/ui/menus/ai-tools-menu.js";

const mockLog = vi.mocked(log);
const mockRunMenu = vi.mocked(runMenu);
const mockInput = vi.mocked(input);
const mockLoadTools = vi.mocked(loadAiTools);
const mockScaffoldTool = vi.mocked(scaffoldAiTool);
const mockGenRef = vi.mocked(generateAiToolReference);

beforeEach(() => {
	vi.clearAllMocks();
});

describe("aiToolsMenu", () => {
	it("builds menu with all 4 options plus back", async () => {
		mockRunMenu.mockResolvedValue(undefined);

		await aiToolsMenu();

		const [title, items] = mockRunMenu.mock.calls[0];
		expect(title).toBe("AI Tools");
		// 4 items + separator + back = 6
		expect(items).toHaveLength(6);
	});

	it("returns 'main'", async () => {
		mockRunMenu.mockResolvedValue(undefined);
		const result = await aiToolsMenu();
		expect(result).toBe("main");
	});

	it("List Tools loads and renders", async () => {
		const tools = [{ name: "t1" }] as any;
		mockLoadTools.mockReturnValue(tools);
		vi.mocked(toToolListItems).mockReturnValue([{ name: "t1" }] as any);
		mockRunMenu.mockResolvedValue(undefined);

		await aiToolsMenu();

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items.find((i: any) => i.key === "1") as any).action();

		expect(mockLoadTools).toHaveBeenCalled();
		expect(vi.mocked(renderToolList)).toHaveBeenCalled();
		expect(result).toBe("main");
	});

	it("Validate Tools renders validation", async () => {
		vi.mocked(toToolValidationItems).mockReturnValue([]);
		mockRunMenu.mockResolvedValue(undefined);

		await aiToolsMenu();

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items.find((i: any) => i.key === "2") as any).action();

		expect(vi.mocked(renderToolValidation)).toHaveBeenCalled();
		expect(result).toBe("main");
	});

	it("Create Tool: happy path", async () => {
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask
			.mockResolvedValueOnce("my-tool")   // name
			.mockResolvedValueOnce("A tool")     // description
			.mockResolvedValueOnce("echo hello"); // run command
		mockScaffoldTool.mockReturnValue({ path: "/vault/tools/my-tool" } as any);

		await aiToolsMenu();

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items.find((i: any) => i.key === "3") as any).action();

		expect(mockScaffoldTool).toHaveBeenCalledWith(expect.any(Object), "/vault", "my-tool", "A tool", "echo hello", expect.anything());
		expect(result).toBe("main");
		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Created tool at");
	});

	it("Create Tool: cancelled when name is empty", async () => {
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask.mockResolvedValueOnce("");

		await aiToolsMenu();

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "3") as any).action();

		expect(mockScaffoldTool).not.toHaveBeenCalled();
	});

	it("Create Tool: cancelled when run command is empty", async () => {
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask
			.mockResolvedValueOnce("my-tool")
			.mockResolvedValueOnce("desc")
			.mockResolvedValueOnce(""); // empty run

		await aiToolsMenu();

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "3") as any).action();

		expect(mockScaffoldTool).not.toHaveBeenCalled();
		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Cancelled");
	});

	it("Create Tool: shows error on scaffold failure", async () => {
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask
			.mockResolvedValueOnce("bad-tool")
			.mockResolvedValueOnce("desc")
			.mockResolvedValueOnce("cmd");
		mockScaffoldTool.mockReturnValue({ error: "Invalid name" } as any);

		await aiToolsMenu();

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "3") as any).action();

		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Invalid name");
	});

	it("Create Tool: uses default description when empty", async () => {
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask
			.mockResolvedValueOnce("my-tool")
			.mockResolvedValueOnce("")          // empty desc
			.mockResolvedValueOnce("echo hi");
		mockScaffoldTool.mockReturnValue({ path: "/p" } as any);

		await aiToolsMenu();

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "3") as any).action();

		expect(mockScaffoldTool).toHaveBeenCalledWith(expect.any(Object), "/vault", "my-tool", "An AI tool", "echo hi", expect.anything());
	});

	it("Generate Reference saves doc", async () => {
		const mockSave = vi.fn();
		mockGenRef.mockReturnValue({ save: mockSave } as any);
		mockRunMenu.mockResolvedValue(undefined);

		await aiToolsMenu();

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items.find((i: any) => i.key === "4") as any).action();

		expect(mockGenRef).toHaveBeenCalled();
		expect(mockSave).toHaveBeenCalled();
		expect(result).toBe("main");
	});

	it("Back returns 'quit'", async () => {
		mockRunMenu.mockResolvedValue(undefined);

		await aiToolsMenu();

		const [, items] = mockRunMenu.mock.calls[0];
		const back = items.find((i: any) => i.key === "b");
		expect(await (back as any).action()).toBe("quit");
	});
});
