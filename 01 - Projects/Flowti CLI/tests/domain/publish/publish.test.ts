import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockShell } from "../../mocks/mock-shell.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	config: {
		publish: {
			commands: {
				increment: "npm run build:increment",
				e2e: "npm run test:e2e",
				release: "npm run build:release",
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

vi.mock("../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

vi.mock("../../../src/domain/help/help.js", () => ({
	showHelp: vi.fn(),
}));

import * as shellMod from "../../../src/infrastructure/shell.js";
import { commands } from "../../../src/domain/publish/publish.js";

beforeEach(() => vi.clearAllMocks());

describe("publish commands", () => {
	it("publish runs release command", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["publish"]();

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toBe("npm run build:release");
	});

	it("publish:all runs full pipeline on success", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		// Mock process.exit to prevent actual exit
		const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

		commands["publish:all"]();

		expect(sh.calls).toHaveLength(3);
		expect(sh.calls[0].cmd).toBe("npm run build:increment");
		expect(sh.calls[1].cmd).toBe("npm run test:e2e");
		expect(sh.calls[2].cmd).toBe("npm run build:release");
		expect(mockExit).not.toHaveBeenCalled();

		mockExit.mockRestore();
	});

	it("publish:all exits on build failure", () => {
		const sh = createMockShell({ exitCodes: { "npm run build:increment": 1 } });
		Object.assign(shellMod, { shell: sh });

		const exitError = new Error("process.exit");
		const mockExit = vi.spyOn(process, "exit").mockImplementation(() => { throw exitError; });

		expect(() => commands["publish:all"]()).toThrow(exitError);
		expect(sh.calls).toHaveLength(1);
		expect(mockExit).toHaveBeenCalledWith(1);

		mockExit.mockRestore();
	});

	it("publish:all exits on test failure", () => {
		const sh = createMockShell({ exitCodes: { "npm run test:e2e": 1 } });
		Object.assign(shellMod, { shell: sh });

		const exitError = new Error("process.exit");
		const mockExit = vi.spyOn(process, "exit").mockImplementation(() => { throw exitError; });

		expect(() => commands["publish:all"]()).toThrow(exitError);
		expect(sh.calls).toHaveLength(2);
		expect(mockExit).toHaveBeenCalledWith(1);

		mockExit.mockRestore();
	});
});

describe("menu", () => {
	it("calls runMenu with Publish title and pipeline items", async () => {
		const { runMenu } = await import("../../../src/infrastructure/menu.js");
		vi.mocked(runMenu).mockResolvedValue("main");

		const { menu } = await import("../../../src/domain/publish/publish.js");
		await menu();

		expect(runMenu).toHaveBeenCalledWith(
			"Publish",
			expect.arrayContaining([
				expect.objectContaining({ key: "1" }),
				expect.objectContaining({ key: "2" }),
				expect.objectContaining({ key: "3" }),
			]),
			expect.objectContaining({ beforeMenu: expect.any(Function) }),
		);
	});

	it("beforeMenu renders pipeline status", async () => {
		const { runMenu } = await import("../../../src/infrastructure/menu.js");
		const { log } = await import("../../../src/infrastructure/logger.js");
		let capturedBeforeMenu: (() => void) | undefined;
		vi.mocked(runMenu).mockImplementation(async (_title, _items, opts) => {
			capturedBeforeMenu = opts?.beforeMenu;
			return "main";
		});

		const { menu } = await import("../../../src/domain/publish/publish.js");
		await menu();

		capturedBeforeMenu?.();
		expect(log).toHaveBeenCalled();
	});
});
