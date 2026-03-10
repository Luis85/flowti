import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import { HELP, showHelp } from "../../../src/ui/help.js";
import { log } from "../../../src/infrastructure/logger.js";

const mockLog = log as ReturnType<typeof vi.fn>;

beforeEach(() => mockLog.mockClear());

describe("HELP", () => {
	it("contains the main help section", () => {
		expect(HELP.main).toBeDefined();
		expect(HELP.main).toContain("FLOWTI CLI");
	});

	it("contains all expected sections", () => {
		const expected = ["main", "make", "build", "review", "publish", "reports", "devtools", "capture", "info"];
		for (const key of expected) {
			expect(HELP[key]).toBeDefined();
		}
	});
});

describe("showHelp", () => {
	it("logs main help when no section is given", () => {
		showHelp();
		expect(mockLog).toHaveBeenCalledWith(HELP.main);
	});

	it("logs main help when section is 'main'", () => {
		showHelp("main");
		expect(mockLog).toHaveBeenCalledWith(HELP.main);
	});

	it("logs help for a known section", () => {
		showHelp("build");
		expect(mockLog).toHaveBeenCalledWith(HELP.build);
	});

	it("is case-insensitive", () => {
		showHelp("BUILD");
		expect(mockLog).toHaveBeenCalledWith(HELP.build);
	});

	it("shows error for unknown section", () => {
		showHelp("nonexistent");
		expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("No help available"));
	});

	it("lists available sections for unknown section", () => {
		showHelp("nonexistent");
		const calls = mockLog.mock.calls.flat().join(" ");
		expect(calls).toContain("main");
		expect(calls).toContain("build");
	});
});

describe("commands.help", () => {
	it("shows main help when no flags or args", async () => {
		const { commands } = await import("../../../src/ui/help.js");
		mockLog.mockClear();
		commands.help({}, []);
		expect(mockLog).toHaveBeenCalledWith(HELP.main);
	});

	it("shows section help from flags", async () => {
		const { commands } = await import("../../../src/ui/help.js");
		mockLog.mockClear();
		commands.help({ build: true }, []);
		expect(mockLog).toHaveBeenCalledWith(HELP.build);
	});

	it("shows section help from rawArgs", async () => {
		const { commands } = await import("../../../src/ui/help.js");
		mockLog.mockClear();
		commands.help({}, ["help", "make"]);
		expect(mockLog).toHaveBeenCalledWith(HELP.make);
	});
});
