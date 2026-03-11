/**
 * help.controller.test.ts — Tests for the help controller.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/ui/help.js", () => ({ showHelp: vi.fn() }));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { commands } from "../../src/controller/help.controller.js";
import { showHelp } from "../../src/ui/help.js";

describe("help.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls showHelp with the first flag key", () => {
		commands.help({ health: true }, ["help", "health"], "help");

		expect(showHelp).toHaveBeenCalledOnce();
		expect(showHelp).toHaveBeenCalledWith("health");
	});

	it("calls showHelp with rawArgs[1] when no flags", () => {
		commands.help({}, ["help", "scaffold"], "help");

		expect(showHelp).toHaveBeenCalledOnce();
		expect(showHelp).toHaveBeenCalledWith("scaffold");
	});

	it('calls showHelp with "main" when no flags and no args', () => {
		commands.help({}, [], "help");

		expect(showHelp).toHaveBeenCalledOnce();
		expect(showHelp).toHaveBeenCalledWith("main");
	});

	it("prefers flag key over rawArgs", () => {
		commands.help({ build: true }, ["help", "scaffold"], "help");

		expect(showHelp).toHaveBeenCalledOnce();
		expect(showHelp).toHaveBeenCalledWith("build");
	});

	it("uses first flag key when multiple flags present", () => {
		commands.help({ capture: true, health: true }, ["help"], "help");

		expect(showHelp).toHaveBeenCalledOnce();
		expect(showHelp).toHaveBeenCalledWith("capture");
	});
});
