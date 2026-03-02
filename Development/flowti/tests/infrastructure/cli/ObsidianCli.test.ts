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

		it("CliError carries command, exitCode, and stderr", () => {
			const runner = createMockRunner("", 127, "obsidian: not found");
			const cli = new ObsidianCli({ runner });

			try {
				cli.run("version");
				expect.fail("should have thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(CliError);
				const e = err as CliError;
				expect(e.command).toBe("version");
				expect(e.exitCode).toBe(127);
				expect(e.stderr).toBe("obsidian: not found");
			}
		});

		it("treats exit code 127 as CLI not found", () => {
			const runner = createMockRunner("", 127, "obsidian: command not found");
			const cli = new ObsidianCli({ runner });

			expect(() => cli.run("version")).toThrow(CliError);
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

		it("includes vault prefix in eval when configured", () => {
			const runner = createMockRunner("=> ok");
			const cli = new ObsidianCli({ vaultName: "flowti", runner });

			cli.eval("1+1");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"vault=flowti",
				"eval",
				"code=1+1",
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
		it("passes id= parameter to plugin:enable", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			cli.enablePlugin("flowti-ibde");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"plugin:enable",
				"id=flowti-ibde",
			]);
		});
	});

	describe("disablePlugin()", () => {
		it("passes id= parameter to plugin:disable", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			cli.disablePlugin("flowti-ibde");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"plugin:disable",
				"id=flowti-ibde",
			]);
		});

		it("throws CliError when plugin not found", () => {
			const runner = createMockRunner("", 1, "plugin not found");
			const cli = new ObsidianCli({ runner });

			expect(() => cli.disablePlugin("nonexistent")).toThrow(CliError);
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

		it("throws CliError when search command fails", () => {
			const runner = createMockRunner("", 1, "vault not found");
			const cli = new ObsidianCli({ runner });

			expect(() => cli.search("test")).toThrow(CliError);
		});

		it("handles array of plain strings", () => {
			const json = JSON.stringify(["notes/a.md", "notes/b.md"]);
			const runner = createMockRunner(json);
			const cli = new ObsidianCli({ runner });

			expect(cli.search("notes")).toEqual(["notes/a.md", "notes/b.md"]);
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

		it("uses default 8000ms duration when omitted", () => {
			const runner = createMockRunner("=> undefined");
			const cli = new ObsidianCli({ runner });

			cli.notice("Hello");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"eval",
				'code=new Notice("Hello", 8000)',
			]);
		});
	});

	describe("openFile()", () => {
		it("passes path= and newtab by default", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			cli.openFile("notes/hello.md");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"open",
				"path=notes/hello.md",
				"newtab",
			]);
		});

		it("omits newtab when newTab is false", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			cli.openFile("notes/hello.md", false);

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"open",
				"path=notes/hello.md",
			]);
		});

		it("throws CliError when file not found", () => {
			const runner = createMockRunner("", 1, "file not found");
			const cli = new ObsidianCli({ runner });

			expect(() => cli.openFile("nonexistent.md")).toThrow(CliError);
		});
	});

	describe("appendFile()", () => {
		it("passes path= and content= to append command", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			cli.appendFile("log.md", "new entry");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"append",
				"path=log.md",
				"content=new entry",
			]);
		});

		it("throws CliError when file does not exist", () => {
			const runner = createMockRunner("", 1, "file not found");
			const cli = new ObsidianCli({ runner });

			expect(() => cli.appendFile("missing.md", "text")).toThrow(CliError);
		});
	});

	describe("createFileOverwrite()", () => {
		it("passes path=, content=, and overwrite flag", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			cli.createFileOverwrite("test.md", "# Fresh");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"create",
				"path=test.md",
				"content=# Fresh",
				"overwrite",
			]);
		});
	});

	describe("setTheme()", () => {
		it("passes name= to theme:set", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			cli.setTheme("Minimal");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"theme:set",
				"name=Minimal",
			]);
		});

		it("throws CliError when theme not found", () => {
			const runner = createMockRunner("", 1, "theme not found");
			const cli = new ObsidianCli({ runner });

			expect(() => cli.setTheme("nonexistent")).toThrow(CliError);
		});
	});

	describe("fileExists()", () => {
		it("returns true when file command succeeds", () => {
			const runner = createMockRunner('{"path":"test.md","size":42}');
			const cli = new ObsidianCli({ runner });

			expect(cli.fileExists("test.md")).toBe(true);
			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"file",
				"path=test.md",
			]);
		});

		it("returns false when file command fails", () => {
			const runner = createMockRunner("", 1, "file not found");
			const cli = new ObsidianCli({ runner });

			expect(cli.fileExists("missing.md")).toBe(false);
		});
	});

	describe("domCount()", () => {
		it("returns parsed count from dev:dom total", () => {
			const runner = createMockRunner("3");
			const cli = new ObsidianCli({ runner });

			expect(cli.domCount(".nav-file")).toBe(3);
			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"dev:dom",
				"selector=.nav-file",
				"total",
			]);
		});

		it("returns 0 for non-numeric output", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			expect(cli.domCount(".missing")).toBe(0);
		});

		it("throws CliError when command fails", () => {
			const runner = createMockRunner("", 1, "invalid selector");
			const cli = new ObsidianCli({ runner });

			expect(() => cli.domCount("[bad")).toThrow(CliError);
		});
	});

	describe("domText()", () => {
		it("returns text content from dev:dom text", () => {
			const runner = createMockRunner("Hello World");
			const cli = new ObsidianCli({ runner });

			expect(cli.domText(".title")).toBe("Hello World");
			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"dev:dom",
				"selector=.title",
				"text",
			]);
		});

		it("throws CliError when element not found", () => {
			const runner = createMockRunner("", 1, "no match");
			const cli = new ObsidianCli({ runner });

			expect(() => cli.domText(".missing")).toThrow(CliError);
		});
	});

	describe("domAttr()", () => {
		it("returns attribute value from dev:dom attr", () => {
			const runner = createMockRunner("flowti-user-hub");
			const cli = new ObsidianCli({ runner });

			expect(cli.domAttr(".workspace-leaf-content", "data-type")).toBe("flowti-user-hub");
			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"dev:dom",
				"selector=.workspace-leaf-content",
				"attr=data-type",
			]);
		});

		it("throws CliError when element not found", () => {
			const runner = createMockRunner("", 1, "no match");
			const cli = new ObsidianCli({ runner });

			expect(() => cli.domAttr(".missing", "id")).toThrow(CliError);
		});
	});

	describe("prependFile()", () => {
		it("passes path= and content= to prepend command", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			cli.prependFile("log.md", "# Header");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"prepend",
				"path=log.md",
				"content=# Header",
			]);
		});

		it("throws CliError when file does not exist", () => {
			const runner = createMockRunner("", 1, "file not found");
			const cli = new ObsidianCli({ runner });

			expect(() => cli.prependFile("missing.md", "text")).toThrow(CliError);
		});
	});

	describe("moveFile()", () => {
		it("passes path= and to= to move command", () => {
			const runner = createMockRunner("");
			const cli = new ObsidianCli({ runner });

			cli.moveFile("old/note.md", "new/note.md");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"move",
				"path=old/note.md",
				"to=new/note.md",
			]);
		});

		it("throws CliError when source file not found", () => {
			const runner = createMockRunner("", 1, "file not found");
			const cli = new ObsidianCli({ runner });

			expect(() => cli.moveFile("missing.md", "dest.md")).toThrow(CliError);
		});
	});

	describe("getTabs()", () => {
		it("returns parsed JSON array of tab objects", () => {
			const json = JSON.stringify([
				{ path: "notes/hello.md", type: "markdown" },
				{ path: "E2E Test Run.md", type: "markdown" },
			]);
			const runner = createMockRunner(json);
			const cli = new ObsidianCli({ runner });

			const tabs = cli.getTabs();

			expect(tabs).toEqual([
				{ path: "notes/hello.md", type: "markdown" },
				{ path: "E2E Test Run.md", type: "markdown" },
			]);
			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"tabs",
				"format=json",
			]);
		});

		it("returns empty array for non-JSON output", () => {
			const runner = createMockRunner("not json");
			const cli = new ObsidianCli({ runner });

			expect(cli.getTabs()).toEqual([]);
		});
	});

	describe("createFolder()", () => {
		it("evals app.vault.createFolder with escaped path", () => {
			const runner = createMockRunner("=> undefined");
			const cli = new ObsidianCli({ runner });

			cli.createFolder("03 - Resources/Test Data");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"eval",
				"code=(async () => { try { await app.vault.createFolder('03 - Resources/Test Data'); } catch {} })()",
			]);
		});

		it("escapes single quotes in path", () => {
			const runner = createMockRunner("=> undefined");
			const cli = new ObsidianCli({ runner });

			cli.createFolder("it's a folder");

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"eval",
				"code=(async () => { try { await app.vault.createFolder('it\\'s a folder'); } catch {} })()",
			]);
		});
	});

	describe("dismissNotices()", () => {
		it("evals DOM notice removal", () => {
			const runner = createMockRunner("=> undefined");
			const cli = new ObsidianCli({ runner });

			cli.dismissNotices();

			expect(runner.run).toHaveBeenCalledWith("obsidian", [
				"eval",
				"code=document.querySelectorAll('.notice:not(.ft-e2e-spinner)').forEach(n => n.remove())",
			]);
		});
	});

	describe("getNotices()", () => {
		it("returns parsed array of notice texts", () => {
			const json = JSON.stringify(["Success!", "Warning: check input"]);
			const runner = createMockRunner(`=> ${json}`);
			const cli = new ObsidianCli({ runner });

			expect(cli.getNotices()).toEqual(["Success!", "Warning: check input"]);
		});

		it("returns empty array on eval failure", () => {
			const runner = createMockRunner("", 1, "error");
			const cli = new ObsidianCli({ runner });

			expect(cli.getNotices()).toEqual([]);
		});

		it("returns empty array on non-JSON result", () => {
			const runner = createMockRunner("=> not json");
			const cli = new ObsidianCli({ runner });

			expect(cli.getNotices()).toEqual([]);
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
