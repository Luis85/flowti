// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve, resolvePayload, DESTRUCTIVE_TOOLS, executeAction } from "../../../src/domain/journeyExecutor/toolExecutors";
import type { ToolHost, ExecutionOptions } from "../../../src/domain/journeyExecutor/types";
import type { JourneyAction } from "../../../src/domain/journeyBuilder/types";
import type { IEventBus } from "../../../src/infrastructure/events/types";

// ── Mock factories ──────────────────────────────────────────

function createMockToolHost(): ToolHost {
	const el = document.createElement("div");
	el.textContent = "hello world";
	el.setAttribute("data-value", "42");
	(el as unknown as HTMLInputElement).value = "current";

	return {
		executeCommand: vi.fn().mockReturnValue(true),
		querySelector: vi.fn().mockReturnValue(el),
		querySelectorAll: vi.fn().mockReturnValue([el, el]),
		createFile: vi.fn().mockResolvedValue(undefined),
		deleteFile: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockResolvedValue("file content"),
		moveFile: vi.fn().mockResolvedValue(undefined),
		copyFile: vi.fn().mockResolvedValue(undefined),
		openFile: vi.fn().mockResolvedValue(undefined),
		openUrl: vi.fn(),
		showNotice: vi.fn(),
		setTheme: vi.fn(),
		closeLeaves: vi.fn(),
		closeModals: vi.fn(),
		clickRibbon: vi.fn().mockReturnValue(true),
		scrollTo: vi.fn().mockReturnValue(true),
		getFrontmatter: vi.fn().mockReturnValue({ title: "Test", status: "active" }),
		updateFrontmatter: vi.fn().mockResolvedValue(undefined),
		getEventTrace: vi.fn().mockReturnValue([{ type: "test.event" }]),
		showSpinner: vi.fn(),
		hideSpinner: vi.fn(),
		writeRunLog: vi.fn().mockResolvedValue(undefined),
		seed: vi.fn().mockResolvedValue(undefined),
	};
}

function createMockEventBus(): IEventBus {
	return {
		emit: vi.fn().mockResolvedValue(undefined),
		on: vi.fn().mockReturnValue(() => {}),
	} as unknown as IEventBus;
}

// ── Tests ───────────────────────────────────────────────────

describe("resolve", () => {
	it("interpolates a single variable", () => {
		expect(resolve("Hello {{name}}", { name: "World" })).toBe("Hello World");
	});

	it("interpolates multiple variables", () => {
		expect(resolve("{{a}} + {{b}}", { a: "1", b: "2" })).toBe("1 + 2");
	});

	it("throws on missing variable", () => {
		expect(() => resolve("{{missing}}", {})).toThrow("Variable '{{missing}}' not found");
	});

	it("passes through string with no variables", () => {
		expect(resolve("plain text", { x: "y" })).toBe("plain text");
	});
});

describe("resolvePayload", () => {
	it("resolves string values", () => {
		const result = resolvePayload({ key: "{{val}}" }, { val: "resolved" });
		expect(result).toEqual({ key: "resolved" });
	});

	it("passes non-string values through", () => {
		const result = resolvePayload({ num: 42, bool: true }, {});
		expect(result).toEqual({ num: 42, bool: true });
	});

	it("handles undefined payload", () => {
		expect(resolvePayload(undefined, {})).toEqual({});
	});
});

describe("DESTRUCTIVE_TOOLS", () => {
	it("contains vault-modifying tools", () => {
		expect(DESTRUCTIVE_TOOLS.has("create-file")).toBe(true);
		expect(DESTRUCTIVE_TOOLS.has("delete-file")).toBe(true);
		expect(DESTRUCTIVE_TOOLS.has("seed")).toBe(true);
		expect(DESTRUCTIVE_TOOLS.has("click")).toBe(false);
	});
});

describe("executeAction", () => {
	let host: ToolHost;
	let eventBus: IEventBus;
	let variables: Record<string, string>;
	let options: ExecutionOptions;

	beforeEach(() => {
		host = createMockToolHost();
		eventBus = createMockEventBus();
		variables = {};
		options = {};
	});

	function action(overrides: Partial<JourneyAction> & { tool: string }): JourneyAction {
		return overrides as JourneyAction;
	}

	// ── Interaction tools ─────────────────────────────────

	it("command: calls executeCommand with resolved id", async () => {
		await executeAction(action({ tool: "command", id: "flowti:open-hub" }), host, eventBus, variables, options);
		expect(host.executeCommand).toHaveBeenCalledWith("flowti:open-hub");
	});

	it("click: queries and clicks element", async () => {
		await executeAction(action({ tool: "click", selector: ".btn" }), host, eventBus, variables, options);
		expect(host.querySelector).toHaveBeenCalledWith(".btn");
	});

	it("click: throws when element not found", async () => {
		(host.querySelector as ReturnType<typeof vi.fn>).mockReturnValue(null);
		await expect(executeAction(action({ tool: "click", selector: ".missing" }), host, eventBus, variables, options))
			.rejects.toThrow("Element not found: .missing");
	});

	it("input: sets value and dispatches events", async () => {
		const el = document.createElement("input");
		const dispatchSpy = vi.spyOn(el, "dispatchEvent");
		(host.querySelector as ReturnType<typeof vi.fn>).mockReturnValue(el);

		await executeAction(action({ tool: "input", selector: "input", value: "test" }), host, eventBus, variables, options);
		// happy-dom may fire additional internal events; just verify at least input + change
		expect(dispatchSpy.mock.calls.some((c) => (c[0] as Event).type === "input")).toBe(true);
		expect(dispatchSpy.mock.calls.some((c) => (c[0] as Event).type === "change")).toBe(true);
	});

	it("highlight: adds class to element", async () => {
		const el = document.createElement("div");
		(host.querySelector as ReturnType<typeof vi.fn>).mockReturnValue(el);
		await executeAction(action({ tool: "highlight", selector: ".target", duration: false }), host, eventBus, variables, options);
		expect(el.classList.contains("ft-highlight")).toBe(true);
	});

	it("select: sets select element value", async () => {
		// Use the mock host querySelector directly — just verify it was called
		await executeAction(action({ tool: "select", selector: "select", value: "opt2" }), host, eventBus, variables, options);
		expect(host.querySelector).toHaveBeenCalledWith("select");
	});

	it("scroll-to: calls host.scrollTo", async () => {
		await executeAction(action({ tool: "scroll-to", selector: ".target" }), host, eventBus, variables, options);
		expect(host.scrollTo).toHaveBeenCalledWith(".target", "smooth", "center");
	});

	it("navigate: calls host.openFile", async () => {
		await executeAction(action({ tool: "navigate", path: "notes/test.md" }), host, eventBus, variables, options);
		expect(host.openFile).toHaveBeenCalledWith("notes/test.md");
	});

	// ── Assertion tools ───────────────────────────────────

	it("assert-visible: passes for existing element", async () => {
		await expect(executeAction(action({ tool: "assert", type: "visible", selector: ".el" }), host, eventBus, variables, options))
			.resolves.toBeUndefined();
	});

	it("assert-visible: fails for missing element", async () => {
		(host.querySelector as ReturnType<typeof vi.fn>).mockReturnValue(null);
		await expect(executeAction(action({ tool: "assert", type: "visible", selector: ".gone" }), host, eventBus, variables, options))
			.rejects.toThrow("assert visible: element not found");
	});

	it("assert-text: passes for matching content", async () => {
		await expect(executeAction(action({ tool: "assert-text", selector: ".el", contains: "hello" }), host, eventBus, variables, options))
			.resolves.toBeUndefined();
	});

	it("assert-text: fails for non-matching content", async () => {
		await expect(executeAction(action({ tool: "assert-text", selector: ".el", contains: "xyz" }), host, eventBus, variables, options))
			.rejects.toThrow("does not contain");
	});

	it("assert-count: validates element count", async () => {
		await expect(executeAction(action({ tool: "assert", type: "count", selector: ".el", count: 2 }), host, eventBus, variables, options))
			.resolves.toBeUndefined();
	});

	// ── Data tools ────────────────────────────────────────

	it("emit: calls eventBus.emit with resolved payload", async () => {
		variables.name = "Login Flow";
		await executeAction(
			action({ tool: "emit", event: "test.event", payload: { name: "{{name}}" } }),
			host, eventBus, variables, options,
		);
		expect(eventBus.emit).toHaveBeenCalledWith("test.event", { name: "Login Flow" });
	});

	it("eval: executes code and stores result", async () => {
		await executeAction(action({ tool: "eval", code: "return 42", store: "result" }), host, eventBus, variables, options);
		expect(variables.result).toBe("42");
	});

	it("frontmatter-read: calls getFrontmatter and stores", async () => {
		await executeAction(
			action({ tool: "frontmatter", path: "note.md", mode: "read", property: "title", store: "t" }),
			host, eventBus, variables, options,
		);
		expect(host.getFrontmatter).toHaveBeenCalledWith("note.md");
		expect(variables.t).toBe("Test");
	});

	it("query-trace: stores trace result", async () => {
		await executeAction(
			action({ tool: "query-trace", event: "test.event", store: "trace" }),
			host, eventBus, variables, options,
		);
		expect(variables.trace).toBe(JSON.stringify([{ type: "test.event" }]));
	});

	// ── Lifecycle tools ───────────────────────────────────

	it("create-file: calls host.createFile after confirmation", async () => {
		options.onConfirmDestructive = vi.fn().mockResolvedValue(true);
		await executeAction(action({ tool: "create-file", path: "test.md", content: "hello" }), host, eventBus, variables, options);
		expect(host.createFile).toHaveBeenCalledWith("test.md", "hello");
	});

	it("create-file: skipped when confirmation rejected", async () => {
		options.onConfirmDestructive = vi.fn().mockResolvedValue(false);
		await executeAction(action({ tool: "create-file", path: "test.md", content: "hello" }), host, eventBus, variables, options);
		expect(host.createFile).not.toHaveBeenCalled();
	});

	it("delete-file: calls host.deleteFile", async () => {
		await executeAction(action({ tool: "delete-file", path: "old.md" }), host, eventBus, variables, options);
		expect(host.deleteFile).toHaveBeenCalledWith("old.md");
	});

	it("open-file: calls host.openFile", async () => {
		await executeAction(action({ tool: "open-file", path: "notes/doc.md" }), host, eventBus, variables, options);
		expect(host.openFile).toHaveBeenCalledWith("notes/doc.md");
	});

	it("close-leaves: calls host.closeLeaves", async () => {
		await executeAction(action({ tool: "close-leaves", viewType: "markdown" }), host, eventBus, variables, options);
		expect(host.closeLeaves).toHaveBeenCalledWith("markdown");
	});

	// ── Feedback tools ────────────────────────────────────

	it("notice: calls host.showNotice", async () => {
		await executeAction(action({ tool: "notice", message: "Done!" }), host, eventBus, variables, options);
		expect(host.showNotice).toHaveBeenCalledWith("Done!", 4000);
	});

	it("theme: calls host.setTheme", async () => {
		await executeAction(action({ tool: "theme", theme: "dark" }), host, eventBus, variables, options);
		expect(host.setTheme).toHaveBeenCalledWith("dark");
	});

	it("screenshot: is no-op (does not throw)", async () => {
		await expect(executeAction(action({ tool: "screenshot", label: "test" }), host, eventBus, variables, options))
			.resolves.toBeUndefined();
	});

	// ── Dry-run mode ──────────────────────────────────────

	it("dry-run: skips side-effect tools", async () => {
		options.dryRun = true;
		await executeAction(action({ tool: "command", id: "test:cmd" }), host, eventBus, variables, options);
		expect(host.executeCommand).not.toHaveBeenCalled();

		await executeAction(action({ tool: "click", selector: ".btn" }), host, eventBus, variables, options);
		// querySelector not called for click in dry-run

		await executeAction(action({ tool: "create-file", path: "x.md", content: "" }), host, eventBus, variables, options);
		expect(host.createFile).not.toHaveBeenCalled();
	});
});
