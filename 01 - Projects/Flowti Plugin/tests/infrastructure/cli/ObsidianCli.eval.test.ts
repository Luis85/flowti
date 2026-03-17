import { describe, it, expect, vi } from "vitest";
import { ObsidianCli } from "../../../src/infrastructure/cli/ObsidianCli";
import type { IProcessRunner } from "../../../src/infrastructure/cli/types";
import { CliError } from "../../../src/infrastructure/cli/types";

function createMockRunner(
	stdout = "",
	exitCode = 0,
	stderr = "",
): IProcessRunner {
	return {
		run: vi.fn(() => ({ stdout, stderr, exitCode })),
	};
}

describe("ObsidianCli eval methods", () => {
	describe("eval()", () => {
		it("passes code= parameter to the eval command", () => {
			const runner = createMockRunner("=> result");
			const cli = new ObsidianCli({ runner });

			cli.eval("1 + 1");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"eval",
				"code=1 + 1",
			]);
		});

		it("strips => prefix from output", () => {
			const runner = createMockRunner("=> hello world\n");
			const cli = new ObsidianCli({ runner });

			const result = cli.eval("'hello world'");

			expect(result.value).toBe("hello world");
			expect(result.success).toBe(true);
		});

		it("returns raw value when no => prefix", () => {
			const runner = createMockRunner("raw output");
			const cli = new ObsidianCli({ runner });

			const result = cli.eval("expression");

			expect(result.value).toBe("raw output");
			expect(result.success).toBe(true);
		});
	});

	describe("getPluginState()", () => {
		it("parses valid plugin state snapshot", () => {
			const state = {
				loaded: true,
				services: ["eventBus", "analyticsService"],
				hasErrors: false,
			};
			const runner = createMockRunner(`=> ${JSON.stringify(state)}`);
			const cli = new ObsidianCli({ runner });

			const snapshot = cli.getPluginState();

			expect(snapshot.loaded).toBe(true);
			expect(snapshot.services).toContain("analyticsService");
			expect(snapshot.hasErrors).toBe(false);
		});

		it("returns loaded:false when eval fails", () => {
			const runner = createMockRunner("", 1, "plugin not found");
			const cli = new ObsidianCli({ runner });

			const snapshot = cli.getPluginState();

			expect(snapshot.loaded).toBe(false);
			expect(snapshot.hasErrors).toBe(true);
		});

		it("throws CliError when eval returns non-JSON", () => {
			const runner = createMockRunner("=> not json");
			const cli = new ObsidianCli({ runner });

			expect(() => cli.getPluginState()).toThrow(CliError);
			expect(() => cli.getPluginState()).toThrow(/non-JSON/);
		});
	});

	describe("evalJson()", () => {
		it("parses JSON from eval result", () => {
			const data = { count: 42, items: ["a", "b"] };
			const runner = createMockRunner(`=> ${JSON.stringify(data)}`);
			const cli = new ObsidianCli({ runner });

			const result = cli.evalJson<{ count: number; items: string[] }>(
				"JSON.stringify(data)",
			);

			expect(result.count).toBe(42);
			expect(result.items).toEqual(["a", "b"]);
		});

		it("throws CliError when eval fails", () => {
			const runner = createMockRunner("", 1, "SyntaxError");
			const cli = new ObsidianCli({ runner });

			expect(() => cli.evalJson("bad code")).toThrow(CliError);
			expect(() => cli.evalJson("bad code")).toThrow(/evalJson failed/);
		});

		it("throws CliError when result is not JSON", () => {
			const runner = createMockRunner("=> undefined");
			const cli = new ObsidianCli({ runner });

			expect(() => cli.evalJson("undefined")).toThrow(CliError);
			expect(() => cli.evalJson("undefined")).toThrow(/non-JSON/);
		});
	});

	describe("executeCommand()", () => {
		it("uses native command id= for command execution", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			cli.executeCommand("flowti-ibde:flowti:open-user-hub");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"command",
				"id=flowti-ibde:flowti:open-user-hub",
			]);
		});

		it("throws CliError when command fails", () => {
			const runner = createMockRunner("", 1, "Command not found");
			const cli = new ObsidianCli({ runner });

			expect(() =>
				cli.executeCommand("nonexistent:command"),
			).toThrow(CliError);
		});
	});
});
