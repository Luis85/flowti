import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockShell } from "../../mocks/mock-shell.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	config: {
		build: {
			commands: {
				fast: "node esbuild.config.mjs --production --no-reports",
				increment: "npm run build:increment",
				full: "npm run build:full",
				watch: "node esbuild.config.mjs --watch",
				distribute: "node esbuild.config.mjs --production --no-reports --distribution",
			},
		},
		test: {
			commands: {
				unit: "npm run check && vitest run",
				increment: "npm run test:increment",
				e2e: "npm run test:e2e",
			},
		},
	},
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/readline.js", () => ({
	createRL: vi.fn(),
	ask: vi.fn(),
}));

vi.mock("../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

vi.mock("../../../src/domain/help/help.js", () => ({
	showHelp: vi.fn(),
}));

vi.mock("../../../src/domain/onboarding/onboarding.js", () => ({
	showPostBuildGuidance: vi.fn(),
}));

vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn() },
}));

import * as shellMod from "../../../src/infrastructure/shell.js";
import { showPostBuildGuidance } from "../../../src/domain/onboarding/onboarding.js";
import { commands, menu } from "../../../src/domain/build/build.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { showHelp } from "../../../src/domain/help/help.js";
import { input } from "../../../src/infrastructure/input.js";
import { log } from "../../../src/infrastructure/logger.js";

const mockGuidance = showPostBuildGuidance as ReturnType<typeof vi.fn>;
const mockRunMenu = runMenu as ReturnType<typeof vi.fn>;
const mockShowHelp = showHelp as ReturnType<typeof vi.fn>;
const mockInput = input.ask as ReturnType<typeof vi.fn>;
const mockLog = log as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("build commands", () => {
	it("build runs fast build and shows guidance on success", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["build"]();

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toContain("esbuild");
		expect(mockGuidance).toHaveBeenCalled();
	});

	it("build skips guidance on failure", () => {
		const sh = createMockShell({ exitCodes: { "node esbuild.config.mjs --production --no-reports": 1 } });
		Object.assign(shellMod, { shell: sh });

		commands["build"]();

		expect(mockGuidance).not.toHaveBeenCalled();
	});

	it("build:increment runs increment build", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["build:increment"]();

		expect(sh.calls[0].cmd).toBe("npm run build:increment");
	});

	it("build:increment shows guidance on success", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["build:increment"]();

		expect(mockGuidance).toHaveBeenCalled();
	});

	it("build:increment skips guidance on failure", () => {
		const sh = createMockShell({ exitCodes: { "npm run build:increment": 1 } });
		Object.assign(shellMod, { shell: sh });

		commands["build:increment"]();

		expect(mockGuidance).not.toHaveBeenCalled();
	});

	it("build:full runs full build", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["build:full"]();

		expect(sh.calls[0].cmd).toBe("npm run build:full");
	});

	it("build:full shows guidance on success", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["build:full"]();

		expect(mockGuidance).toHaveBeenCalled();
	});

	it("build:full skips guidance on failure", () => {
		const sh = createMockShell({ exitCodes: { "npm run build:full": 1 } });
		Object.assign(shellMod, { shell: sh });

		commands["build:full"]();

		expect(mockGuidance).not.toHaveBeenCalled();
	});

	it("build:watch passes reload flag", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["build:watch"]({ reload: true });

		expect(sh.calls[0].cmd).toContain("--reload");
	});

	it("build:watch omits reload flag when not set", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["build:watch"]({});

		expect(sh.calls[0].cmd).not.toContain("--reload");
	});

	it("build:watch uses default command", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["build:watch"]({});

		expect(sh.calls[0].cmd).toBe("node esbuild.config.mjs --watch");
	});

	it("build:distribute runs distribute command", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["build:distribute"]();

		expect(sh.calls[0].cmd).toContain("--distribution");
	});

	it("test runs unit tests", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["test"]();

		expect(sh.calls[0].cmd).toContain("vitest run");
	});

	it("test:increment runs increment tests", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["test:increment"]();

		expect(sh.calls[0].cmd).toBe("npm run test:increment");
	});

	it("test:e2e runs e2e tests", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["test:e2e"]();

		expect(sh.calls[0].cmd).toBe("npm run test:e2e");
	});
});

describe("build menu()", () => {
	it("calls runMenu with 'Build' title", async () => {
		mockRunMenu.mockResolvedValue("main");

		await menu();

		expect(mockRunMenu).toHaveBeenCalledWith("Build", expect.any(Array));
	});

	it("returns the result from runMenu", async () => {
		mockRunMenu.mockResolvedValue("quit");

		const result = await menu();

		expect(result).toBe("quit");
	});

	it("menu item 1 (fast build) calls shell.run and shows guidance on success", async () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		mockRunMenu.mockImplementation(async (_title: string, items: Array<{ key: string; action: () => unknown }>) => {
			const item = items.find((i: { key: string }) => i.key === "1");
			await item!.action();
			return "main";
		});

		await menu();

		expect(sh.calls[0].cmd).toContain("esbuild");
		expect(mockGuidance).toHaveBeenCalled();
	});

	it("menu item 1 (fast build) skips guidance on failure", async () => {
		const sh = createMockShell({ exitCodes: { "node esbuild.config.mjs --production --no-reports": 1 } });
		Object.assign(shellMod, { shell: sh });

		mockRunMenu.mockImplementation(async (_title: string, items: Array<{ key: string; action: () => unknown }>) => {
			const item = items.find((i: { key: string }) => i.key === "1");
			await item!.action();
			return "main";
		});

		await menu();

		expect(mockGuidance).not.toHaveBeenCalled();
	});

	it("menu item 2 (increment build) runs increment and shows guidance", async () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		mockRunMenu.mockImplementation(async (_title: string, items: Array<{ key: string; action: () => unknown }>) => {
			const item = items.find((i: { key: string }) => i.key === "2");
			await item!.action();
			return "main";
		});

		await menu();

		expect(sh.calls[0].cmd).toBe("npm run build:increment");
		expect(mockGuidance).toHaveBeenCalled();
	});

	it("menu item 3 (full build) runs full and shows guidance", async () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		mockRunMenu.mockImplementation(async (_title: string, items: Array<{ key: string; action: () => unknown }>) => {
			const item = items.find((i: { key: string }) => i.key === "3");
			await item!.action();
			return "main";
		});

		await menu();

		expect(sh.calls[0].cmd).toBe("npm run build:full");
		expect(mockGuidance).toHaveBeenCalled();
	});

	it("menu item 4 (watch) prompts for reload and passes flag when 'y'", async () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		mockInput.mockResolvedValue("y");

		mockRunMenu.mockImplementation(async (_title: string, items: Array<{ key: string; action: () => unknown }>) => {
			const item = items.find((i: { key: string }) => i.key === "4");
			await item!.action();
			return "main";
		});

		await menu();

		expect(sh.calls[0].cmd).toContain("--reload");
	});

	it("menu item 4 (watch) omits reload flag when 'N'", async () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		mockInput.mockResolvedValue("N");

		mockRunMenu.mockImplementation(async (_title: string, items: Array<{ key: string; action: () => unknown }>) => {
			const item = items.find((i: { key: string }) => i.key === "4");
			await item!.action();
			return "main";
		});

		await menu();

		expect(sh.calls[0].cmd).not.toContain("--reload");
	});

	it("menu item 4 (watch) logs watch mode message with auto-reload info", async () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		mockInput.mockResolvedValue("y");

		mockRunMenu.mockImplementation(async (_title: string, items: Array<{ key: string; action: () => unknown }>) => {
			const item = items.find((i: { key: string }) => i.key === "4");
			await item!.action();
			return "main";
		});

		await menu();

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Starting watch mode");
	});

	it("menu item 5 (distribute) runs distribute command", async () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		mockRunMenu.mockImplementation(async (_title: string, items: Array<{ key: string; action: () => unknown }>) => {
			const item = items.find((i: { key: string }) => i.key === "5");
			await item!.action();
			return "main";
		});

		await menu();

		expect(sh.calls[0].cmd).toContain("--distribution");
	});

	it("menu item ? (help) shows build help", async () => {
		mockRunMenu.mockImplementation(async (_title: string, items: Array<{ key: string; action: () => unknown }>) => {
			const item = items.find((i: { key: string }) => i.key === "?");
			await item!.action();
			return "main";
		});

		await menu();

		expect(mockShowHelp).toHaveBeenCalledWith("build");
	});

	it("menu item b (back) returns 'main'", async () => {
		mockRunMenu.mockImplementation(async (_title: string, items: Array<{ key: string; action: () => unknown }>) => {
			const item = items.find((i: { key: string }) => i.key === "b");
			const result = await item!.action();
			return result;
		});

		const result = await menu();

		expect(result).toBe("main");
	});

	it("menu item q (quit) returns 'quit'", async () => {
		mockRunMenu.mockImplementation(async (_title: string, items: Array<{ key: string; action: () => unknown }>) => {
			const item = items.find((i: { key: string }) => i.key === "q");
			const result = await item!.action();
			return result;
		});

		const result = await menu();

		expect(result).toBe("quit");
	});
});
