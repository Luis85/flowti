import { describe, it, expect, vi } from "vitest";
import { createObsidianPluginProvider } from "../../../../../src/domain/e2e/journey/providers/obsidian-plugin-provider.js";
import type { ToolDeps } from "../../../../../src/domain/e2e/journey/journey-executor.js";
import type { JourneyExecutorOptions } from "../../../../../src/domain/e2e/journey/journey-types.js";

// ── Mock ToolDeps ────────────────────────────────────────────────────

function mockDeps(overrides?: Partial<ToolDeps>): ToolDeps {
	return {
		exec: vi.fn(() => ({ exitCode: 0, stdout: "", stderr: "" })),
		readFile: vi.fn(() => ""),
		writeFile: vi.fn(),
		exists: vi.fn(() => false),
		mkdir: vi.fn(),
		log: vi.fn(),
		sleep: vi.fn(async () => {}),
		clock: { ms: () => 1000 },
		...overrides,
	};
}

function opts(overrides?: Partial<JourneyExecutorOptions>): JourneyExecutorOptions {
	return { cwd: "/project", variables: {}, ...overrides };
}

function r(result: unknown): { success: boolean; output?: string; error?: string } {
	return result as { success: boolean; output?: string; error?: string };
}

// ── Provider shape ───────────────────────────────────────────────────

describe("createObsidianPluginProvider", () => {
	const provider = createObsidianPluginProvider();

	it("targets obsidian-plugin", () => {
		expect(provider.target).toBe("obsidian-plugin");
	});

	it("has label Obsidian Plugin", () => {
		expect(provider.label).toBe("Obsidian Plugin");
	});

	it("registers 30 tools", () => {
		expect(Object.keys(provider.tools)).toHaveLength(30);
	});

	it("declares all expected capabilities", () => {
		expect(provider.capabilities).toContain("command");
		expect(provider.capabilities).toContain("obsidian-cli");
		expect(provider.capabilities).toContain("plugin-deploy");
		expect(provider.capabilities).toContain("dom-interaction");
		expect(provider.capabilities).toContain("visual");
		expect(provider.capabilities).toContain("events");
		expect(provider.capabilities).toContain("batch");
	});

	// ── Tool category registration ───────────────────────────────

	describe("DOM Interaction tools (9)", () => {
		const domTools = ["click", "eval", "set-input", "select", "scroll-to", "navigate", "close-leaves", "close-modals", "ribbon"];
		for (const name of domTools) {
			it(`registers ${name}`, () => {
				expect(provider.tools[name]).toBeDefined();
			});
		}
	});

	describe("Visual tools (5)", () => {
		const visualTools = ["highlight", "screenshot", "spinner", "theme", "visual-inspection"];
		for (const name of visualTools) {
			it(`registers ${name}`, () => {
				expect(provider.tools[name]).toBeDefined();
			});
		}
	});

	describe("Vault Operation tools (6)", () => {
		const vaultTools = ["create-file", "delete-file", "open-file", "copy-file", "move-file", "seed"];
		for (const name of vaultTools) {
			it(`registers ${name}`, () => {
				expect(provider.tools[name]).toBeDefined();
			});
		}
	});

	describe("Event tools (3)", () => {
		const eventTools = ["emit", "assert-event", "query-trace"];
		for (const name of eventTools) {
			it(`registers ${name}`, () => {
				expect(provider.tools[name]).toBeDefined();
			});
		}
	});

	describe("UI Feedback tools (3)", () => {
		const feedbackTools = ["notice", "styled-notice", "manual"];
		for (const name of feedbackTools) {
			it(`registers ${name}`, () => {
				expect(provider.tools[name]).toBeDefined();
			});
		}
	});

	describe("Batch tools (1)", () => {
		it("registers parallel-group", () => {
			expect(provider.tools["parallel-group"]).toBeDefined();
		});
	});

	describe("Core tools (3)", () => {
		for (const name of ["obsidian-cli", "plugin-deploy", "plugin-state"]) {
			it(`registers ${name}`, () => {
				expect(provider.tools[name]).toBeDefined();
			});
		}
	});

	// ── Setup ────────────────────────────────────────────────────

	describe("setup", () => {
		it("creates .obsidian directory when missing", () => {
			const deps = mockDeps({ exists: vi.fn(() => false) });
			provider.setup!(deps, opts({ cwd: "/vault" }));
			expect(deps.mkdir).toHaveBeenCalledWith("/vault/.obsidian");
		});

		it("skips mkdir when .obsidian exists", () => {
			const deps = mockDeps({ exists: vi.fn(() => true) });
			provider.setup!(deps, opts({ cwd: "/vault" }));
			expect(deps.mkdir).not.toHaveBeenCalled();
		});
	});
});

// ── Individual tool tests ────────────────────────────────────────────

describe("obsidian-plugin tools", () => {
	const provider = createObsidianPluginProvider();

	// ── click ────────────────────────────────────────────────────

	describe("click", () => {
		it("executes obsidian-cli eval with selector", () => {
			const deps = mockDeps();
			const result = r(provider.tools["click"](
				{ tool: "click", selector: ".my-button" }, deps, opts(),
			));
			expect(result.success).toBe(true);
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("obsidian-cli eval"),
				expect.anything(),
			);
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining(".my-button"),
				expect.anything(),
			);
		});

		it("fails when no selector", () => {
			const deps = mockDeps();
			const result = r(provider.tools["click"](
				{ tool: "click" }, deps, opts(),
			));
			expect(result.success).toBe(false);
			expect(result.error).toContain("No selector");
		});
	});

	// ── eval ─────────────────────────────────────────────────────

	describe("eval", () => {
		it("executes obsidian-cli eval with expression", () => {
			const deps = mockDeps();
			const result = r(provider.tools["eval"](
				{ tool: "eval", expression: "document.title" }, deps, opts(),
			));
			expect(result.success).toBe(true);
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("document.title"),
				expect.anything(),
			);
		});

		it("fails when no expression", () => {
			const deps = mockDeps();
			const result = r(provider.tools["eval"](
				{ tool: "eval" }, deps, opts(),
			));
			expect(result.success).toBe(false);
			expect(result.error).toContain("No expression");
		});

		it("stores result when storeAs provided", () => {
			const deps = mockDeps({
				exec: vi.fn(() => ({ exitCode: 0, stdout: "MyTitle", stderr: "" })),
			});
			const variables: Record<string, string> = {};
			r(provider.tools["eval"](
				{ tool: "eval", expression: "document.title", storeAs: "title" },
				deps, opts({ variables }),
			));
			expect(variables.title).toBe("MyTitle");
		});
	});

	// ── navigate ─────────────────────────────────────────────────

	describe("navigate", () => {
		it("opens path via obsidian-cli", () => {
			const deps = mockDeps();
			const result = r(provider.tools["navigate"](
				{ tool: "navigate", path: "notes/readme.md" }, deps, opts(),
			));
			expect(result.success).toBe(true);
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("open path="),
				expect.anything(),
			);
		});

		it("fails when no path", () => {
			const deps = mockDeps();
			const result = r(provider.tools["navigate"](
				{ tool: "navigate" }, deps, opts(),
			));
			expect(result.success).toBe(false);
			expect(result.error).toContain("No path");
		});
	});

	// ── screenshot ───────────────────────────────────────────────

	describe("screenshot", () => {
		it("runs screenshot command with output", () => {
			const deps = mockDeps();
			r(provider.tools["screenshot"](
				{ tool: "screenshot", output: "test.png" }, deps, opts(),
			));
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining('screenshot --output "test.png"'),
				expect.anything(),
			);
		});

		it("uses default output name when omitted", () => {
			const deps = mockDeps();
			r(provider.tools["screenshot"](
				{ tool: "screenshot" }, deps, opts(),
			));
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("screenshot.png"),
				expect.anything(),
			);
		});

		it("includes selector when provided", () => {
			const deps = mockDeps();
			r(provider.tools["screenshot"](
				{ tool: "screenshot", selector: ".main" }, deps, opts(),
			));
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("--selector"),
				expect.anything(),
			);
		});
	});

	// ── create-file ──────────────────────────────────────────────

	describe("create-file", () => {
		it("writes file with content", () => {
			const deps = mockDeps();
			const result = r(provider.tools["create-file"](
				{ tool: "create-file", path: "/vault/test.md", content: "# Hello" }, deps, opts(),
			));
			expect(result.success).toBe(true);
			expect(deps.writeFile).toHaveBeenCalledWith("/vault/test.md", "# Hello");
		});

		it("uses empty content when omitted", () => {
			const deps = mockDeps();
			r(provider.tools["create-file"](
				{ tool: "create-file", path: "/vault/empty.md" }, deps, opts(),
			));
			expect(deps.writeFile).toHaveBeenCalledWith("/vault/empty.md", "");
		});

		it("fails when no path", () => {
			const deps = mockDeps();
			const result = r(provider.tools["create-file"](
				{ tool: "create-file" }, deps, opts(),
			));
			expect(result.success).toBe(false);
			expect(result.error).toContain("No path");
		});

		it("fails on write error", () => {
			const deps = mockDeps({
				writeFile: vi.fn(() => { throw new Error("Disk full"); }),
			});
			const result = r(provider.tools["create-file"](
				{ tool: "create-file", path: "/vault/test.md" }, deps, opts(),
			));
			expect(result.success).toBe(false);
			expect(result.error).toContain("Disk full");
		});
	});

	// ── emit ─────────────────────────────────────────────────────

	describe("emit", () => {
		it("emits event via obsidian-cli eval", () => {
			const deps = mockDeps();
			const result = r(provider.tools["emit"](
				{ tool: "emit", event: "session:start", payload: { id: 1 } }, deps, opts(),
			));
			expect(result.success).toBe(true);
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("session:start"),
				expect.anything(),
			);
		});

		it("fails when no event", () => {
			const deps = mockDeps();
			const result = r(provider.tools["emit"](
				{ tool: "emit" }, deps, opts(),
			));
			expect(result.success).toBe(false);
			expect(result.error).toContain("No event");
		});

		it("uses empty payload when omitted", () => {
			const deps = mockDeps();
			r(provider.tools["emit"](
				{ tool: "emit", event: "test" }, deps, opts(),
			));
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("{}"),
				expect.anything(),
			);
		});
	});

	// ── notice ───────────────────────────────────────────────────

	describe("notice", () => {
		it("shows notice via obsidian-cli eval", () => {
			const deps = mockDeps();
			const result = r(provider.tools["notice"](
				{ tool: "notice", message: "Hello world" }, deps, opts(),
			));
			expect(result.success).toBe(true);
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("Notice"),
				expect.anything(),
			);
		});

		it("fails when no message", () => {
			const deps = mockDeps();
			const result = r(provider.tools["notice"](
				{ tool: "notice" }, deps, opts(),
			));
			expect(result.success).toBe(false);
			expect(result.error).toContain("No message");
		});
	});

	// ── manual ───────────────────────────────────────────────────

	describe("manual", () => {
		it("auto-approves after sleep", async () => {
			const deps = mockDeps();
			const result = r(await provider.tools["manual"](
				{ tool: "manual", message: "Check UI", waitMs: 100 }, deps, opts(),
			));
			expect(result.success).toBe(true);
			expect(result.output).toContain("Manual step");
			expect(deps.sleep).toHaveBeenCalled();
			expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("[manual]"));
		});

		it("uses default message when omitted", async () => {
			const deps = mockDeps();
			const result = r(await provider.tools["manual"](
				{ tool: "manual" }, deps, opts(),
			));
			expect(result.output).toContain("Manual verification required");
		});
	});

	// ── seed ─────────────────────────────────────────────────────

	describe("seed", () => {
		it("seeds multiple files", () => {
			const deps = mockDeps();
			const result = r(provider.tools["seed"](
				{
					tool: "seed",
					files: [
						{ path: "/vault/a.md", content: "A" },
						{ path: "/vault/b.md", content: "B" },
					],
				},
				deps, opts(),
			));
			expect(result.success).toBe(true);
			expect(result.output).toContain("2/2");
			expect(deps.writeFile).toHaveBeenCalledTimes(2);
		});

		it("fails when no files", () => {
			const deps = mockDeps();
			const result = r(provider.tools["seed"](
				{ tool: "seed", files: [] }, deps, opts(),
			));
			expect(result.success).toBe(false);
			expect(result.error).toContain("No files");
		});

		it("fails when files not provided", () => {
			const deps = mockDeps();
			const result = r(provider.tools["seed"](
				{ tool: "seed" }, deps, opts(),
			));
			expect(result.success).toBe(false);
		});

		it("counts partial failures", () => {
			let calls = 0;
			const deps = mockDeps({
				writeFile: vi.fn(() => {
					calls++;
					if (calls === 2) throw new Error("write error");
				}),
			});
			const result = r(provider.tools["seed"](
				{
					tool: "seed",
					files: [
						{ path: "/vault/a.md", content: "A" },
						{ path: "/vault/b.md", content: "B" },
						{ path: "/vault/c.md", content: "C" },
					],
				},
				deps, opts(),
			));
			expect(result.success).toBe(true);
			expect(result.output).toContain("2/3");
		});
	});

	// ── parallel-group ───────────────────────────────────────────

	describe("parallel-group", () => {
		it("combines assertions into a single eval", () => {
			const deps = mockDeps();
			const result = r(provider.tools["parallel-group"](
				{
					tool: "parallel-group",
					assertions: ["assert1()", "assert2()"],
				},
				deps, opts(),
			));
			expect(result.success).toBe(true);
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("assert1(); assert2()"),
				expect.anything(),
			);
		});

		it("fails when no assertions", () => {
			const deps = mockDeps();
			const result = r(provider.tools["parallel-group"](
				{ tool: "parallel-group", assertions: [] }, deps, opts(),
			));
			expect(result.success).toBe(false);
			expect(result.error).toContain("No assertions");
		});

		it("fails when assertions not provided", () => {
			const deps = mockDeps();
			const result = r(provider.tools["parallel-group"](
				{ tool: "parallel-group" }, deps, opts(),
			));
			expect(result.success).toBe(false);
		});
	});

	// ── Additional tools ─────────────────────────────────────────

	describe("set-input", () => {
		it("fails when no selector", () => {
			const deps = mockDeps();
			const result = r(provider.tools["set-input"](
				{ tool: "set-input", value: "hello" }, deps, opts(),
			));
			expect(result.success).toBe(false);
		});

		it("sets input value via eval", () => {
			const deps = mockDeps();
			const result = r(provider.tools["set-input"](
				{ tool: "set-input", selector: "#name", value: "test" }, deps, opts(),
			));
			expect(result.success).toBe(true);
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("#name"),
				expect.anything(),
			);
		});
	});

	describe("close-leaves", () => {
		it("runs eval to detach all leaves", () => {
			const deps = mockDeps();
			const result = r(provider.tools["close-leaves"](
				{ tool: "close-leaves" }, deps, opts(),
			));
			expect(result.success).toBe(true);
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("iterateAllLeaves"),
				expect.anything(),
			);
		});
	});

	describe("close-modals", () => {
		it("runs eval to close modals", () => {
			const deps = mockDeps();
			const result = r(provider.tools["close-modals"](
				{ tool: "close-modals" }, deps, opts(),
			));
			expect(result.success).toBe(true);
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("modal-close-button"),
				expect.anything(),
			);
		});
	});

	describe("ribbon", () => {
		it("clicks ribbon action by id", () => {
			const deps = mockDeps();
			const result = r(provider.tools["ribbon"](
				{ tool: "ribbon", id: "my-action" }, deps, opts(),
			));
			expect(result.success).toBe(true);
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("my-action"),
				expect.anything(),
			);
		});

		it("fails when no id", () => {
			const deps = mockDeps();
			const result = r(provider.tools["ribbon"](
				{ tool: "ribbon" }, deps, opts(),
			));
			expect(result.success).toBe(false);
		});
	});

	describe("highlight", () => {
		it("highlights element with default color", () => {
			const deps = mockDeps();
			const result = r(provider.tools["highlight"](
				{ tool: "highlight", selector: ".target" }, deps, opts(),
			));
			expect(result.success).toBe(true);
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("red"),
				expect.anything(),
			);
		});

		it("uses custom color", () => {
			const deps = mockDeps();
			r(provider.tools["highlight"](
				{ tool: "highlight", selector: ".target", color: "blue" }, deps, opts(),
			));
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("blue"),
				expect.anything(),
			);
		});
	});

	describe("theme", () => {
		it("switches to specified theme", () => {
			const deps = mockDeps();
			r(provider.tools["theme"](
				{ tool: "theme", theme: "light" }, deps, opts(),
			));
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("light"),
				expect.anything(),
			);
		});

		it("defaults to dark theme", () => {
			const deps = mockDeps();
			r(provider.tools["theme"](
				{ tool: "theme" }, deps, opts(),
			));
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("dark"),
				expect.anything(),
			);
		});
	});

	describe("copy-file", () => {
		it("copies src to dest", () => {
			const deps = mockDeps({ readFile: vi.fn(() => "content") });
			const result = r(provider.tools["copy-file"](
				{ tool: "copy-file", src: "/a.md", dest: "/b.md" }, deps, opts(),
			));
			expect(result.success).toBe(true);
			expect(deps.readFile).toHaveBeenCalledWith("/a.md");
			expect(deps.writeFile).toHaveBeenCalledWith("/b.md", "content");
		});

		it("fails when src or dest missing", () => {
			const deps = mockDeps();
			const result = r(provider.tools["copy-file"](
				{ tool: "copy-file", src: "/a.md" }, deps, opts(),
			));
			expect(result.success).toBe(false);
		});
	});

	describe("assert-event", () => {
		it("checks event in history", () => {
			const deps = mockDeps();
			const result = r(provider.tools["assert-event"](
				{ tool: "assert-event", event: "session:start" }, deps, opts(),
			));
			expect(result.success).toBe(true);
			expect(deps.exec).toHaveBeenCalledWith(
				expect.stringContaining("session:start"),
				expect.anything(),
			);
		});

		it("fails when no event", () => {
			const deps = mockDeps();
			const result = r(provider.tools["assert-event"](
				{ tool: "assert-event" }, deps, opts(),
			));
			expect(result.success).toBe(false);
		});
	});

	describe("obsidian-cli exec error handling", () => {
		it("reports failure when exec exits non-zero", () => {
			const deps = mockDeps({
				exec: vi.fn(() => ({ exitCode: 1, stdout: "", stderr: "command not found" })),
			});
			const result = r(provider.tools["click"](
				{ tool: "click", selector: ".btn" }, deps, opts(),
			));
			expect(result.success).toBe(false);
			expect(result.error).toContain("failed");
		});

		it("reports failure when exec throws", () => {
			const deps = mockDeps({
				exec: vi.fn(() => { throw new Error("connection refused"); }),
			});
			const result = r(provider.tools["click"](
				{ tool: "click", selector: ".btn" }, deps, opts(),
			));
			expect(result.success).toBe(false);
			expect(result.error).toContain("connection refused");
		});
	});
});
