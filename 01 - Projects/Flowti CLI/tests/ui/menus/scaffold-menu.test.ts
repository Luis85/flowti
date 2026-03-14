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
		resolve: (...args: string[]) => args.join("/"),
	},
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	PROJECTS_DIR: "/vault/projects",
	cliConfig: { defaultAuthor: "Default Author" },
}));
vi.mock("../../../src/domain/scaffold/scaffold-service.js", () => ({
	scaffold: vi.fn(),
	listDefinitions: vi.fn(() => []),
	resolvePromptDefault: vi.fn((d: string) => d ?? ""),
	deriveVariables: vi.fn((name: string, author?: string, _extra?: unknown, _defaultAuthor?: string) => ({
		name, id: name.toLowerCase(), pascal: name, camel: name, author: author ?? _defaultAuthor ?? "",
	})),
}));
vi.mock("../../../src/domain/scaffold/scaffold-plan.js", () => ({
	resolveNextSteps: vi.fn(() => []),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { input } from "../../../src/infrastructure/input.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { scaffold, listDefinitions, resolvePromptDefault, deriveVariables } from "../../../src/domain/scaffold/scaffold-service.js";
import { resolveNextSteps } from "../../../src/domain/scaffold/scaffold-plan.js";
import { scaffoldMenu } from "../../../src/ui/menus/scaffold-menu.js";
import type { ScaffoldDefinition } from "../../../src/domain/scaffold/scaffold-types.js";

const mockLog = vi.mocked(log);
const mockRunMenu = vi.mocked(runMenu);
const mockInput = vi.mocked(input);
const mockDisk = vi.mocked(disk);

const makeDeps = { disk, paths, input, log } as any;
const mockScaffold = vi.mocked(scaffold);
const mockListDefs = vi.mocked(listDefinitions);
const mockResolveNextSteps = vi.mocked(resolveNextSteps);

const MINIMAL_DEF: ScaffoldDefinition = {
	id: "test-project",
	label: "Test Project",
	description: "A test scaffold",
	prompts: [{ variable: "author", label: "Author", default: "Me", required: false }],
	package: { scripts: {}, devDependencies: {} },
	flowtiConfig: {},
	directories: [],
	files: [],
	nextSteps: [],
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("scaffoldMenu", () => {
	it("returns 'main' when no definitions", async () => {
		mockListDefs.mockReturnValue([]);

		const result = await scaffoldMenu(makeDeps);

		expect(result).toBe("main");
		expect(mockRunMenu).not.toHaveBeenCalled();
	});

	it("builds menu items from definitions", async () => {
		mockListDefs.mockReturnValue([MINIMAL_DEF]);
		mockRunMenu.mockResolvedValue("main");

		await scaffoldMenu(makeDeps);

		expect(mockRunMenu).toHaveBeenCalledTimes(1);
		const [title, items] = mockRunMenu.mock.calls[0];
		expect(title).toBe("New Project");
		// 1 def + separator + back + quit = 4
		expect(items).toHaveLength(4);
		expect(items[0].label).toContain("Test Project");
		expect(items[0].label).toContain("A test scaffold");
	});

	it("back returns 'main'", async () => {
		mockListDefs.mockReturnValue([MINIMAL_DEF]);
		mockRunMenu.mockResolvedValue("main");

		await scaffoldMenu(makeDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const back = items.find((i: any) => i.key === "b");
		expect(await (back as any).action()).toBe("main");
	});

	it("quit returns 'quit'", async () => {
		mockListDefs.mockReturnValue([MINIMAL_DEF]);
		mockRunMenu.mockResolvedValue("main");

		await scaffoldMenu(makeDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const quit = items.find((i: any) => i.key === "q");
		expect(await (quit as any).action()).toBe("quit");
	});

	it("interactive scaffold: happy path", async () => {
		mockListDefs.mockReturnValue([MINIMAL_DEF]);
		mockRunMenu.mockResolvedValue(undefined);

		// name, then author prompt
		mockInput.ask.mockResolvedValueOnce("My App").mockResolvedValueOnce("John");
		mockDisk.existsSync.mockReturnValue(false);
		mockScaffold.mockReturnValue({ created: 5 } as any);
		mockResolveNextSteps.mockReturnValue(["cd my-app", "npm install"]);

		await scaffoldMenu(makeDeps);

		// Invoke the definition action
		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockScaffold).toHaveBeenCalledTimes(1);
		expect(mockScaffold).toHaveBeenCalledWith("/vault/projects", expect.any(Object), expect.any(Object), "Default Author");
		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Created 5 files");
		expect(output).toContain("cd my-app");
	});

	it("interactive scaffold: cancels when name is empty", async () => {
		mockListDefs.mockReturnValue([MINIMAL_DEF]);
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask.mockResolvedValueOnce("");

		await scaffoldMenu(makeDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockScaffold).not.toHaveBeenCalled();
	});

	it("interactive scaffold: aborts when required prompt is empty", async () => {
		const defWithRequired: ScaffoldDefinition = {
			...MINIMAL_DEF,
			prompts: [{ variable: "author", label: "Author", required: true }],
		};
		mockListDefs.mockReturnValue([defWithRequired]);
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask.mockResolvedValueOnce("My App").mockResolvedValueOnce("");

		await scaffoldMenu(makeDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockScaffold).not.toHaveBeenCalled();
		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Required field");
	});

	it("interactive scaffold: aborts when directory exists", async () => {
		mockListDefs.mockReturnValue([MINIMAL_DEF]);
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask.mockResolvedValueOnce("My App").mockResolvedValueOnce("Author");
		mockDisk.existsSync.mockReturnValue(true);

		await scaffoldMenu(makeDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockScaffold).not.toHaveBeenCalled();
		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Directory already exists");
	});

	it("interactive scaffold: shows error when scaffold fails", async () => {
		mockListDefs.mockReturnValue([MINIMAL_DEF]);
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask.mockResolvedValueOnce("My App").mockResolvedValueOnce("Author");
		mockDisk.existsSync.mockReturnValue(false);
		mockScaffold.mockReturnValue({ error: "Template not found" } as any);

		await scaffoldMenu(makeDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Scaffold failed");
		expect(output).toContain("Template not found");
	});
});
