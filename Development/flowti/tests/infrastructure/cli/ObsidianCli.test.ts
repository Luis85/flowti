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

describe("ObsidianCli", () => {
	describe("run()", () => {
		it("constructs correct args with vault prefix", () => {
			const runner = createMockRunner("output");
			const cli = new ObsidianCli({ vaultName: "test", runner });

			cli.run("plugins", ["versions"]);

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"vault=test",
				"plugins",
				"versions",
			]);
		});

		it("omits vault prefix when vaultName not set", () => {
			const runner = createMockRunner("output");
			const cli = new ObsidianCli({ runner });

			cli.run("version");

			expect(runner.run).toHaveBeenCalledWith("obsidian", ["version"]);
		});

		it("throws CliError on non-zero exit code", () => {
			const runner = createMockRunner("", 1, "command not found");
			const cli = new ObsidianCli({ runner });

			expect(() => cli.run("bad-command")).toThrow(CliError);
			expect(() => cli.run("bad-command")).toThrow(/bad-command/);
		});

		it("returns trimmed stdout on success", () => {
			const runner = createMockRunner("  hello world  \n");
			const cli = new ObsidianCli({ runner });

			expect(cli.run("version")).toBe("hello world");
		});
	});

	describe("eval()", () => {
		it("passes code as code= parameter", () => {
			const runner = createMockRunner("=> flowti");
			const cli = new ObsidianCli({ runner });

			cli.eval("app.vault.getName()");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"eval",
				"code=app.vault.getName()",
			]);
		});

		it("strips => prefix from eval output", () => {
			const runner = createMockRunner("=> flowti\n");
			const cli = new ObsidianCli({ runner });

			const result = cli.eval("app.vault.getName()");

			expect(result).toEqual({
				value: "flowti",
				success: true,
			});
		});

		it("returns success false on non-zero exit", () => {
			const runner = createMockRunner("", 1, "SyntaxError");
			const cli = new ObsidianCli({ runner });

			const result = cli.eval("invalid code{{{");

			expect(result.success).toBe(false);
			expect(result.error).toBe("SyntaxError");
		});
	});

	describe("runJson()", () => {
		it("appends format=json and parses JSON array", () => {
			const json = JSON.stringify([{ id: "flowti-ibde" }]);
			const runner = createMockRunner(json);
			const cli = new ObsidianCli({ runner });

			const result = cli.runJson("plugins");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"plugins",
				"format=json",
			]);
			expect(result).toEqual([{ id: "flowti-ibde" }]);
		});

		it("parses JSON object", () => {
			const json = JSON.stringify({ name: "flowti", files: 37036 });
			const runner = createMockRunner(json);
			const cli = new ObsidianCli({ runner });

			const result = cli.runJson("vault");

			expect(result).toEqual({ name: "flowti", files: 37036 });
		});

		it("throws CliError on non-JSON output", () => {
			const runner = createMockRunner("not json at all");
			const cli = new ObsidianCli({ runner });

			expect(() => cli.runJson("plugins")).toThrow(CliError);
			expect(() => cli.runJson("plugins")).toThrow(/non-JSON/);
		});
	});

	describe("getPlugins()", () => {
		it("returns typed PluginEntry array", () => {
			const json = JSON.stringify([
				{ id: "flowti-ibde", version: "0.0.1" },
				{ id: "hot-reload", version: "0.1.0" },
			]);
			const runner = createMockRunner(json);
			const cli = new ObsidianCli({ runner });

			const plugins = cli.getPlugins();

			expect(plugins).toHaveLength(2);
			expect(plugins[0]).toEqual({ id: "flowti-ibde", version: "0.0.1" });
		});

		it("returns empty array for empty JSON", () => {
			const runner = createMockRunner("[]");
			const cli = new ObsidianCli({ runner });

			expect(cli.getPlugins()).toEqual([]);
		});
	});

	describe("file operations", () => {
		it("createFile passes path= and content= parameters", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			cli.createFile("test/note.md", "# Hello");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"create",
				"path=test/note.md",
				"content=# Hello",
			]);
		});

		it("readFile passes path= parameter", () => {
			const runner = createMockRunner("# Hello\nWorld");
			const cli = new ObsidianCli({ runner });

			const content = cli.readFile("test/note.md");

			expect(content).toBe("# Hello\nWorld");
			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"read",
				"path=test/note.md",
			]);
		});

		it("deleteFile passes path= parameter", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			cli.deleteFile("test/note.md");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"delete",
				"path=test/note.md",
			]);
		});
	});

	describe("setProperty()", () => {
		it("passes path=, name=, and value= parameters", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			cli.setProperty("test/note.md", "status", "verified");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"property:set",
				"path=test/note.md",
				"name=status",
				"value=verified",
			]);
		});
	});

	describe("enablePlugin()", () => {
		it("evaluates enablePlugin call via eval", () => {
			const runner = createMockRunner("=> undefined");
			const cli = new ObsidianCli({ runner });

			cli.enablePlugin("flowti-ibde");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"eval",
				"code=app.plugins.enablePlugin('flowti-ibde')",
			]);
		});
	});

	describe("reloadPlugin()", () => {
		it("passes id= parameter to plugin:reload", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			cli.reloadPlugin("flowti-ibde");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"plugin:reload",
				"id=flowti-ibde",
			]);
		});

		it("includes vault prefix when configured", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ vaultName: "flowti", runner });

			cli.reloadPlugin("flowti-ibde");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"vault=flowti",
				"plugin:reload",
				"id=flowti-ibde",
			]);
		});
	});

	describe("executeCommand()", () => {
		it("passes id= parameter to command", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			cli.executeCommand("flowti-ibde:flowti:open-user-hub");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"command",
				"id=flowti-ibde:flowti:open-user-hub",
			]);
		});
	});

	describe("getConsoleOutput()", () => {
		it("returns console output", () => {
			const runner = createMockRunner("09:00:00 [flowti] loaded");
			const cli = new ObsidianCli({ runner });

			expect(cli.getConsoleOutput()).toBe("09:00:00 [flowti] loaded");
		});
	});

	describe("getErrors()", () => {
		it("returns error output", () => {
			const runner = createMockRunner("09:00:00 TypeError: ...");
			const cli = new ObsidianCli({ runner });

			expect(cli.getErrors()).toBe("09:00:00 TypeError: ...");
		});

		it("returns empty string when dev:errors fails", () => {
			const runner = createMockRunner("", 1, "not available");
			const cli = new ObsidianCli({ runner });

			expect(cli.getErrors()).toBe("");
		});
	});

	describe("search()", () => {
		it("returns paths from JSON array of objects", () => {
			const json = JSON.stringify([
				{ path: "notes/hello.md" },
				{ path: "notes/world.md" },
			]);
			const runner = createMockRunner(json);
			const cli = new ObsidianCli({ runner });

			const results = cli.search("hello");

			expect(results).toEqual(["notes/hello.md", "notes/world.md"]);
			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"search",
				"query=hello",
				"format=json",
			]);
		});

		it("returns empty array for non-array JSON", () => {
			const runner = createMockRunner(JSON.stringify({ total: 0 }));
			const cli = new ObsidianCli({ runner });

			expect(cli.search("nonexistent")).toEqual([]);
		});
	});

	describe("screenshot()", () => {
		it("passes path argument to dev:screenshot", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			cli.screenshot("/tmp/test.png");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"dev:screenshot",
				"path=/tmp/test.png",
			]);
		});
	});

	describe("notice()", () => {
		it("evals new Notice() with message and duration", () => {
			const runner = createMockRunner("=> undefined");
			const cli = new ObsidianCli({ runner });

			cli.notice("Test complete", 5000);

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"eval",
				'code=new Notice("Test complete", 5000)',
			]);
		});
	});

	describe("constructor defaults", () => {
		it("uses obsidian as default binary path", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			cli.run("version");

			expect(runner.run).toHaveBeenCalledWith("obsidian", ["version"]);
		});

		it("uses custom binary path when provided", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ binaryPath: "/usr/local/bin/obsidian", runner });

			cli.run("version");

			expect(runner.run).toHaveBeenCalledWith("/usr/local/bin/obsidian", [
				"version",
			]);
		});
	});
});
