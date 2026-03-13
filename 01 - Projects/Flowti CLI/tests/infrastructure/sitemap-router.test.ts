import { describe, it, expect, vi, beforeEach } from "vitest";
import { SitemapRouter } from "../../src/infrastructure/sitemap-router.js";
import { HandlerRegistry } from "../../src/infrastructure/handler-registry.js";
import { CommandRegistry } from "../../src/infrastructure/command-registry.js";
import type { Sitemap, RouterContext } from "../../src/infrastructure/sitemap-types.js";
import type { CliDeps } from "../../src/infrastructure/deps.js";
import type { MenuEntry, MenuResult, ProjectContext } from "../../src/infrastructure/types.js";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

vi.mock("../../src/infrastructure/context-provider.js", () => ({
	interpolate: vi.fn((template: string, _ctx: RouterContext) => template),
}));

vi.mock("../../src/infrastructure/sitemap-conditions.js", () => ({
	resolveDisabledCondition: vi.fn(
		(cond: unknown) => (typeof cond === "boolean" ? cond : false),
	),
	resolveHiddenCondition: vi.fn(
		(cond: unknown) => (typeof cond === "boolean" ? cond : false),
	),
}));

vi.mock("../../src/infrastructure/input.js", () => ({
	input: { waitForEnter: vi.fn() },
}));

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/ui.js", () => ({
	DIM: "", RESET: "", RED: "", YELLOW: "",
}));

import { runMenu } from "../../src/infrastructure/menu.js";
import { interpolate } from "../../src/infrastructure/context-provider.js";
import { resolveHiddenCondition } from "../../src/infrastructure/sitemap-conditions.js";

const mockRunMenu = vi.mocked(runMenu);
const mockInterpolate = vi.mocked(interpolate);

// ── Helpers ──────────────────────────────────────────────────────────

const stubDeps = {} as CliDeps;

function makeProject(name = "test-project"): ProjectContext {
	return {
		path: "/projects/test",
		pkg: { name, version: "1.0.0" },
		config: { name } as any,
		scripts: {},
	};
}

function makeSitemap(views: Sitemap["views"]): Sitemap {
	return { version: 1, views };
}

interface RouterHarness {
	router: SitemapRouter;
	handlers: HandlerRegistry;
	commands: CommandRegistry;
	getProject: ReturnType<typeof vi.fn>;
	getTools: ReturnType<typeof vi.fn>;
	onProjectSelected: ReturnType<typeof vi.fn>;
	onProjectCleared: ReturnType<typeof vi.fn>;
}

function createRouter(sitemap: Sitemap): RouterHarness {
	const handlers = new HandlerRegistry();
	const commands = new CommandRegistry();
	const getProject = vi.fn<() => ProjectContext | undefined>().mockReturnValue(undefined);
	const getTools = vi.fn<() => Record<string, boolean> | undefined>().mockReturnValue(undefined);
	const onProjectSelected = vi.fn();
	const onProjectCleared = vi.fn();

	const router = new SitemapRouter({
		sitemap,
		handlers,
		commands,
		deps: stubDeps,
		getProject,
		getTools,
		onProjectSelected,
		onProjectCleared,
	});

	return { router, handlers, commands, getProject, getTools, onProjectSelected, onProjectCleared };
}

/**
 * Helper: queue runMenu to simulate user selections.
 * Each call returns the result from the next queued value.
 * The action callbacks are invoked to simulate user picking a menu item.
 */
function queueMenuResults(...results: Array<MenuResult | { pickKey: string }>): void {
	for (const result of results) {
		if (result !== null && typeof result === "object" && "pickKey" in result) {
			const key = result.pickKey;
			mockRunMenu.mockImplementationOnce(async (_title, entries: MenuEntry[], _opts) => {
				const item = entries.find(
					(e): e is MenuEntry & { key: string; action: () => any } =>
						"key" in e && e.key === key,
				);
				if (!item) throw new Error(`Test: no menu entry with key "${key}"`);
				return item.action();
			});
		} else {
			mockRunMenu.mockResolvedValueOnce(result as MenuResult);
		}
	}
}

// ── Tests ────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.clearAllMocks();
	mockInterpolate.mockImplementation((template) => template);
});

// ── 1. Basic navigation ─────────────────────────────────────────────

describe("SitemapRouter", () => {
	describe("basic navigation", () => {
		it("renders the start view via runMenu", async () => {
			const sitemap = makeSitemap({
				start: {
					title: "Main Menu",
					items: [
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
			});

			const { router } = createRouter(sitemap);
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			expect(mockRunMenu).toHaveBeenCalledTimes(1);
			expect(mockRunMenu).toHaveBeenCalledWith(
				"Main Menu",
				expect.any(Array),
				expect.any(Object),
			);
		});

		it("navigate pushes target view onto the stack", async () => {
			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "s", label: "Settings", navigate: "settings" },
					],
				},
				settings: {
					title: "Settings",
					items: [
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
			});

			const { router } = createRouter(sitemap);

			// First: user picks "settings" from start view
			queueMenuResults({ pickKey: "s" });
			// Second: in settings view, user picks "quit"
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			expect(mockRunMenu).toHaveBeenCalledTimes(2);
			// Second call should be the settings view
			expect(mockRunMenu.mock.calls[1][0]).toBe("Settings");
		});
	});

	// ── 2. Signal handling ──────────────────────────────────────────

	describe("signal handling", () => {
		it('"quit" signal exits the router loop', async () => {
			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [{ key: "q", label: "Quit", signal: "quit" as const }],
				},
			});

			const { router } = createRouter(sitemap);
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			expect(mockRunMenu).toHaveBeenCalledTimes(1);
		});

		it('"back" signal pops the view stack', async () => {
			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "s", label: "Sub", navigate: "sub" },
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
				sub: {
					title: "Sub",
					items: [{ key: "b", label: "Back", signal: "back" as const }],
				},
			});

			const { router } = createRouter(sitemap);

			// Go to sub, then back, then quit from start
			queueMenuResults({ pickKey: "s" });
			queueMenuResults({ pickKey: "b" });
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			expect(mockRunMenu).toHaveBeenCalledTimes(3);
			// Third call should be back at start
			expect(mockRunMenu.mock.calls[2][0]).toBe("Main");
		});

		it('"start" signal clears stack and calls onProjectCleared', async () => {
			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "s", label: "Sub", navigate: "sub" },
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
				sub: {
					title: "Sub",
					items: [{ key: "h", label: "Home", signal: "start" as const }],
				},
			});

			const { router, onProjectCleared } = createRouter(sitemap);

			queueMenuResults({ pickKey: "s" });
			queueMenuResults({ pickKey: "h" });
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			expect(onProjectCleared).toHaveBeenCalledTimes(1);
			// After "start" signal, we should be back at start view
			expect(mockRunMenu.mock.calls[2][0]).toBe("Main");
		});
	});

	// ── 3. Dynamic views ────────────────────────────────────────────

	describe("dynamic views", () => {
		it("calls the registered view handler for dynamic views", async () => {
			const viewHandler = vi.fn<(ctx: RouterContext) => Promise<MenuResult>>()
				.mockResolvedValue("quit");

			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [{ key: "d", label: "Dynamic", navigate: "dyn" }],
				},
				dyn: {
					type: "dynamic",
					title: "Dynamic View",
					handler: "my-dynamic-handler",
				},
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerView("my-dynamic-handler", viewHandler);

			queueMenuResults({ pickKey: "d" });

			await router.run("start");

			expect(viewHandler).toHaveBeenCalledTimes(1);
			expect(viewHandler).toHaveBeenCalledWith(
				expect.objectContaining({ deps: stubDeps }),
			);
		});

		it("dynamic view returning navigate:X pushes X onto the stack", async () => {
			const viewHandler = vi.fn<(ctx: RouterContext) => Promise<MenuResult>>()
				.mockResolvedValueOnce("navigate:settings" as MenuResult)
				.mockResolvedValueOnce("quit");

			const sitemap = makeSitemap({
				start: {
					title: "Main",
					type: "dynamic",
					handler: "dyn",
				},
				settings: {
					title: "Settings",
					type: "dynamic",
					handler: "dyn",
				},
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerView("dyn", viewHandler);

			await router.run("start");

			expect(viewHandler).toHaveBeenCalledTimes(2);
		});
	});

	// ── 4. Command dispatch ─────────────────────────────────────────

	describe("command dispatch", () => {
		it("dispatches command through CommandRegistry", async () => {
			const cmdHandler = vi.fn().mockResolvedValue(undefined);

			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "b", label: "Build", command: "build" },
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
			});

			const { router, commands } = createRouter(sitemap);
			commands.registerDomain({
				domain: "build",
				commands: { build: cmdHandler },
			});

			// Pick build, then on second render pick quit
			queueMenuResults({ pickKey: "b" });
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			expect(cmdHandler).toHaveBeenCalledTimes(1);
			expect(cmdHandler).toHaveBeenCalledWith({}, [], "build", undefined);
		});

		it("logs error for unknown command", async () => {
			const { log } = await import("../../src/infrastructure/logger.js");
			const mockLog = vi.mocked(log);

			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "x", label: "Unknown", command: "nonexistent" },
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
			});

			const { router } = createRouter(sitemap);

			queueMenuResults({ pickKey: "x" });
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			expect(mockLog).toHaveBeenCalledWith(
				expect.stringContaining('Unknown command: "nonexistent"'),
			);
		});
	});

	// ── 5. Action handlers ──────────────────────────────────────────

	describe("action handlers", () => {
		it("calls registered action handler", async () => {
			const actionHandler = vi.fn().mockResolvedValue(undefined);

			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "a", label: "Action", handler: "my-action" },
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerAction("my-action", actionHandler);

			queueMenuResults({ pickKey: "a" });
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			expect(actionHandler).toHaveBeenCalledTimes(1);
			expect(actionHandler).toHaveBeenCalledWith(
				expect.objectContaining({ deps: stubDeps }),
			);
		});

		it("propagates quit signal from action handler", async () => {
			const actionHandler = vi.fn().mockResolvedValue("quit");

			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [{ key: "a", label: "Action", handler: "my-action" }],
				},
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerAction("my-action", actionHandler);

			queueMenuResults({ pickKey: "a" });

			await router.run("start");

			// Router should exit after quit signal, so only 1 menu render
			expect(mockRunMenu).toHaveBeenCalledTimes(1);
		});

		it("propagates start signal from action handler", async () => {
			const actionHandler = vi.fn().mockResolvedValue("start");

			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "s", label: "Sub", navigate: "sub" },
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
				sub: {
					title: "Sub",
					items: [{ key: "a", label: "Reset", handler: "reset-action" }],
				},
			});

			const { router, handlers, onProjectCleared } = createRouter(sitemap);
			handlers.registerAction("reset-action", actionHandler);

			queueMenuResults({ pickKey: "s" });
			queueMenuResults({ pickKey: "a" });
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			expect(onProjectCleared).toHaveBeenCalledTimes(1);
		});

		it("propagates main signal from action handler (stay in menu)", async () => {
			const actionHandler = vi.fn().mockResolvedValue("main");

			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "s", label: "Sub", navigate: "sub" },
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
				sub: {
					title: "Sub",
					items: [{ key: "a", label: "Go back", handler: "back-action" }],
				},
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerAction("back-action", actionHandler);

			queueMenuResults({ pickKey: "s" });
			// action returns "main" which becomes the runMenu result, popping back
			queueMenuResults({ pickKey: "a" });
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			// Should go: start -> sub -> (main pops) -> start -> quit
			expect(mockRunMenu).toHaveBeenCalledTimes(3);
		});
	});

	// ── 6. Disabled / hidden items ──────────────────────────────────

	describe("disabled and hidden items", () => {
		it("passes disabled condition to menu entries", async () => {
			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{
							key: "d",
							label: "Disabled Item",
							signal: "quit" as const,
							disabled: true,
							disabledMessage: "Not available",
						},
					],
				},
			});

			const { router } = createRouter(sitemap);

			// When the entry has disabled, the action wraps resolveDisabledCondition
			// We mock runMenu to inspect the entries and then quit
			mockRunMenu.mockImplementationOnce(async (_title, entries: MenuEntry[]) => {
				const item = entries.find((e): e is any => "key" in e && e.key === "d");
				expect(item).toBeDefined();
				expect(item.disabled).toBeDefined();
				expect(typeof item.disabled).toBe("function");
				// The disabled function should call resolveDisabledCondition
				expect(item.disabled()).toBe(true);
				expect(item.disabledMessage).toContain("Not available");
				return item.action();
			});

			await router.run("start");
		});

		it("hidden items are excluded from entries", async () => {
			vi.mocked(resolveHiddenCondition).mockReturnValueOnce(true);

			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "h", label: "Hidden", signal: "quit" as const, hidden: true },
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
			});

			const { router } = createRouter(sitemap);
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			const entries = mockRunMenu.mock.calls[0][1];
			const keys = entries.filter((e): e is any => "key" in e).map((e: any) => e.key);
			expect(keys).not.toContain("h");
			expect(keys).toContain("q");
		});

		it("separator entries are passed through", async () => {
			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "a", label: "A", signal: "quit" as const },
						{ separator: true as const },
						{ key: "b", label: "B", signal: "quit" as const },
					],
				},
			});

			const { router } = createRouter(sitemap);
			queueMenuResults({ pickKey: "a" });

			await router.run("start");

			const entries = mockRunMenu.mock.calls[0][1];
			expect(entries).toHaveLength(3);
			expect(entries[1]).toEqual({ separator: true });
		});
	});

	// ── 7. BeforeRender handlers ────────────────────────────────────

	describe("beforeRender handlers", () => {
		it("passes beforeMenu callback when beforeRender handler is registered", async () => {
			const beforeHandler = vi.fn();

			const sitemap = makeSitemap({
				start: {
					title: "Main",
					beforeRender: "my-banner",
					items: [{ key: "q", label: "Quit", signal: "quit" as const }],
				},
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerBeforeRender("my-banner", beforeHandler);

			mockRunMenu.mockImplementationOnce(async (_title, entries, opts) => {
				// The beforeMenu option should be provided
				expect(opts?.beforeMenu).toBeDefined();
				opts?.beforeMenu?.();
				const item = (entries as any[]).find((e: any) => e.key === "q");
				return item.action();
			});

			await router.run("start");

			expect(beforeHandler).toHaveBeenCalledTimes(1);
			expect(beforeHandler).toHaveBeenCalledWith(
				expect.objectContaining({ deps: stubDeps }),
			);
		});

		it("does not set beforeMenu when handler is not registered", async () => {
			const sitemap = makeSitemap({
				start: {
					title: "Main",
					beforeRender: "nonexistent-banner",
					items: [{ key: "q", label: "Quit", signal: "quit" as const }],
				},
			});

			const { router } = createRouter(sitemap);

			mockRunMenu.mockImplementationOnce(async (_title, entries, opts) => {
				expect(opts?.beforeMenu).toBeUndefined();
				const item = (entries as any[]).find((e: any) => e.key === "q");
				return item.action();
			});

			await router.run("start");
		});
	});

	// ── 8. Auto-navigation to project-detail ────────────────────────

	describe("auto-navigation to project-detail", () => {
		it("pushes project-detail when getProject() returns a project after popping", async () => {
			const project = makeProject();

			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "p", label: "Pick project", navigate: "project-picker" },
					],
				},
				"project-picker": {
					type: "dynamic",
					title: "Pick",
					handler: "pick-project",
				},
				"project-detail": {
					title: "Project: {{project.name}}",
					items: [
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
			});

			const { router, handlers, getProject, onProjectSelected } = createRouter(sitemap);

			// The dynamic picker returns "main" to pop back
			handlers.registerView("pick-project", vi.fn().mockResolvedValue("main"));

			// After the picker runs, getProject returns a project
			getProject
				.mockReturnValueOnce(undefined)  // buildContext for start
				.mockReturnValueOnce(undefined)  // buildContext for project-picker
				.mockReturnValueOnce(project)    // check after pop (auto-navigate)
				.mockReturnValue(project);        // subsequent calls

			queueMenuResults({ pickKey: "p" });
			// project-detail renders, user quits
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			expect(onProjectSelected).toHaveBeenCalledTimes(1);
			// The last static menu rendered should be project-detail
			const lastStaticCall = mockRunMenu.mock.calls[mockRunMenu.mock.calls.length - 1];
			expect(lastStaticCall[0]).toBe("Project: {{project.name}}");
		});
	});

	// ── 9. Stack never empties ──────────────────────────────────────

	describe("stack never empties", () => {
		it("re-pushes start view when back would empty the stack", async () => {
			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "b", label: "Back", signal: "back" as const },
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
			});

			const { router } = createRouter(sitemap);

			// "back" pops start, but stack re-pushes start. Then quit.
			queueMenuResults({ pickKey: "b" });
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			// Should render start twice — once before back, once after re-push
			expect(mockRunMenu).toHaveBeenCalledTimes(2);
		});
	});

	// ── 10. Template interpolation in titles ────────────────────────

	describe("template interpolation", () => {
		it("calls interpolate with title and context", async () => {
			mockInterpolate.mockReturnValue("Project: MyApp");

			const sitemap = makeSitemap({
				start: {
					title: "Project: {{project.name}}",
					items: [{ key: "q", label: "Quit", signal: "quit" as const }],
				},
			});

			const { router } = createRouter(sitemap);
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			expect(mockInterpolate).toHaveBeenCalledWith(
				"Project: {{project.name}}",
				expect.objectContaining({ deps: stubDeps }),
			);
			// runMenu receives the interpolated title
			expect(mockRunMenu.mock.calls[0][0]).toBe("Project: MyApp");
		});

		it("interpolates item labels too", async () => {
			mockInterpolate.mockImplementation((template: string) => {
				if (template.includes("{{project.name}}")) return template.replace("{{project.name}}", "MyApp");
				return template;
			});

			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "p", label: "Project: {{project.name}}", signal: "quit" as const },
					],
				},
			});

			const { router } = createRouter(sitemap);

			mockRunMenu.mockImplementationOnce(async (_title, entries: MenuEntry[]) => {
				const item = entries.find((e): e is any => "key" in e && e.key === "p");
				expect(item.label).toBe("Project: MyApp");
				return item.action();
			});

			await router.run("start");
		});
	});

	// ── 11. updateSitemap() hot-swaps the sitemap ───────────────────

	describe("updateSitemap()", () => {
		it("hot-swaps the sitemap definition used during navigation", async () => {
			const original = makeSitemap({
				start: {
					title: "Original",
					items: [{ key: "q", label: "Quit", signal: "quit" as const }],
				},
			});

			const updated = makeSitemap({
				start: {
					title: "Updated",
					items: [{ key: "q", label: "Quit", signal: "quit" as const }],
				},
			});

			const { router } = createRouter(original);

			// First render uses original, then we swap
			let callCount = 0;
			mockRunMenu.mockImplementation(async (title, entries: MenuEntry[]) => {
				callCount++;
				if (callCount === 1) {
					expect(title).toBe("Original");
					// Hot-swap for next iteration
					router.updateSitemap(updated);
					// Return void to pop, which triggers re-push of start
					const item = (entries as any[]).find((e: any) => e.key === "q");
					return "main" as MenuResult;
				}
				// Second render should use updated sitemap
				expect(title).toBe("Updated");
				const item = (entries as any[]).find((e: any) => e.key === "q");
				return item.action();
			});

			await router.run("start");

			expect(callCount).toBe(2);
		});
	});

	// ── Unknown view ────────────────────────────────────────────────

	describe("unknown view handling", () => {
		it("pops unknown view and continues", async () => {
			const { log } = await import("../../src/infrastructure/logger.js");
			const mockLog = vi.mocked(log);

			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "n", label: "Go nowhere", navigate: "nonexistent" },
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
			});

			const { router } = createRouter(sitemap);

			// Navigate to nonexistent view, it gets popped, back to start, then quit
			queueMenuResults({ pickKey: "n" });
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			expect(mockLog).toHaveBeenCalledWith(
				expect.stringContaining('Unknown view: "nonexistent"'),
			);
			expect(mockRunMenu).toHaveBeenCalledTimes(2);
		});
	});

	// ── Context requirement ─────────────────────────────────────────

	describe("context requirements", () => {
		it("pops a view that requires project context when no project is set", async () => {
			const { log } = await import("../../src/infrastructure/logger.js");
			const mockLog = vi.mocked(log);

			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "d", label: "Detail", navigate: "detail" },
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
				detail: {
					title: "Detail",
					context: ["project"],
					items: [{ key: "b", label: "Back", signal: "back" as const }],
				},
			});

			const { router } = createRouter(sitemap);

			// Navigate to detail (requires project, none set) -> pops -> back at start -> quit
			queueMenuResults({ pickKey: "d" });
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			expect(mockLog).toHaveBeenCalledWith(
				expect.stringContaining("No project selected"),
			);
		});
	});

	// ── Context building ────────────────────────────────────────────

	describe("context building", () => {
		it("passes project and tools to the context", async () => {
			const project = makeProject();
			const tools = { esbuild: true, tsc: false };

			const sitemap = makeSitemap({
				start: {
					type: "dynamic",
					title: "Main",
					handler: "check-ctx",
				},
			});

			const { router, handlers, getProject, getTools } = createRouter(sitemap);
			getProject.mockReturnValue(project);
			getTools.mockReturnValue(tools);

			let capturedCtx: RouterContext | undefined;
			handlers.registerView("check-ctx", vi.fn(async (ctx: RouterContext) => {
				capturedCtx = ctx;
				return "quit" as MenuResult;
			}));

			await router.run("start");

			expect(capturedCtx).toBeDefined();
			expect(capturedCtx!.project).toBe(project);
			expect(capturedCtx!.tools).toBe(tools);
			expect(capturedCtx!.deps).toBe(stubDeps);
		});
	});

	// ── Fallback action (no action field) ───────────────────────────

	describe("fallback action", () => {
		it("item with no action field returns undefined (stays in menu)", async () => {
			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "n", label: "No-op" },
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
			});

			const { router } = createRouter(sitemap);

			// First call: pick no-op (returns undefined, stays in menu)
			// runMenu returns undefined after the no-op action
			mockRunMenu.mockImplementationOnce(async (_title, entries: MenuEntry[]) => {
				const item = (entries as any[]).find((e: any) => e.key === "n");
				const result = item.action();
				expect(result).toBeUndefined();
				// Now simulate quitting
				const quit = (entries as any[]).find((e: any) => e.key === "q");
				return quit.action();
			});

			await router.run("start");
		});
	});

	// ── Command dispatch passes project context ─────────────────────

	describe("command with project context", () => {
		it("passes project to command handler when available", async () => {
			const project = makeProject();
			const cmdHandler = vi.fn().mockResolvedValue(undefined);

			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "b", label: "Build", command: "build" },
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
			});

			const { router, commands, getProject } = createRouter(sitemap);
			getProject.mockReturnValue(project);
			commands.registerDomain({
				domain: "build",
				commands: { build: cmdHandler },
			});

			queueMenuResults({ pickKey: "b" });
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			expect(cmdHandler).toHaveBeenCalledWith({}, [], "build", project);
		});
	});

	// ── 12. Hybrid dynamic views (items + handler) ──────────────────

	describe("hybrid dynamic views", () => {
		it("passes sitemapEntries to handler when dynamic view has items", async () => {
			let capturedCtx: RouterContext | undefined;

			const sitemap = makeSitemap({
				start: {
					type: "dynamic",
					title: "Hybrid",
					handler: "hybrid-handler",
					items: [
						{ key: "a", label: "Static Action", handler: "some-action" },
						{ separator: true },
						{ key: "b", label: "Back", signal: "back" as const },
					],
				},
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerAction("some-action", vi.fn().mockResolvedValue(undefined));
			handlers.registerView("hybrid-handler", vi.fn(async (ctx: RouterContext) => {
				capturedCtx = ctx;
				return "quit" as MenuResult;
			}));

			await router.run("start");

			expect(capturedCtx).toBeDefined();
			expect(capturedCtx!.sitemapEntries).toBeDefined();
			expect(capturedCtx!.sitemapEntries!.length).toBeGreaterThanOrEqual(2);
		});

		it("does not pass sitemapEntries for pure dynamic views (no items)", async () => {
			let capturedCtx: RouterContext | undefined;

			const sitemap = makeSitemap({
				start: {
					type: "dynamic",
					title: "Pure",
					handler: "pure-handler",
				},
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerView("pure-handler", vi.fn(async (ctx: RouterContext) => {
				capturedCtx = ctx;
				return "quit" as MenuResult;
			}));

			await router.run("start");

			expect(capturedCtx).toBeDefined();
			expect(capturedCtx!.sitemapEntries).toBeUndefined();
			expect(capturedCtx!.sitemapSlots).toBeUndefined();
		});

		it("passes sitemapSlots when items contain slot markers", async () => {
			let capturedCtx: RouterContext | undefined;

			const sitemap = makeSitemap({
				start: {
					type: "dynamic",
					title: "Slotted",
					handler: "slot-handler",
					items: [
						{ slot: "dynamic-list" },
						{ separator: true },
						{ key: "c", label: "Add", handler: "add-action" },
						{ key: "b", label: "Back", signal: "back" as const },
					],
				},
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerAction("add-action", vi.fn().mockResolvedValue(undefined));
			handlers.registerView("slot-handler", vi.fn(async (ctx: RouterContext) => {
				capturedCtx = ctx;
				return "quit" as MenuResult;
			}));

			await router.run("start");

			expect(capturedCtx).toBeDefined();
			expect(capturedCtx!.sitemapSlots).toBeDefined();

			const slots = capturedCtx!.sitemapSlots!;
			// _before is empty (slot is first)
			expect(slots["_before"]).toBeDefined();
			expect(slots["_before"].length).toBe(0);
			// slot name exists as empty array
			expect(slots["dynamic-list"]).toBeDefined();
			expect(slots["dynamic-list"].length).toBe(0);
			// _after has the separator + items after the slot
			expect(slots["_after"]).toBeDefined();
			expect(slots["_after"].length).toBeGreaterThanOrEqual(2);
		});

		it("segments multiple slots correctly", async () => {
			let capturedCtx: RouterContext | undefined;

			const sitemap = makeSitemap({
				start: {
					type: "dynamic",
					title: "Multi-Slot",
					handler: "multi-handler",
					items: [
						{ key: "h", label: "Header", signal: "back" as const },
						{ slot: "list" },
						{ key: "m", label: "Middle", signal: "back" as const },
						{ slot: "extras" },
						{ key: "f", label: "Footer", signal: "back" as const },
					],
				},
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerView("multi-handler", vi.fn(async (ctx: RouterContext) => {
				capturedCtx = ctx;
				return "quit" as MenuResult;
			}));

			await router.run("start");

			const slots = capturedCtx!.sitemapSlots!;
			// Header is before the first slot
			expect(slots["_before"].length).toBe(1);
			expect((slots["_before"][0] as any).label).toBe("Header");
			// "list" slot is empty
			expect(slots["list"]).toEqual([]);
			// Middle is between list and extras
			expect(slots["_between_list"]).toBeDefined();
			expect(slots["_between_list"].length).toBe(1);
			// "extras" slot is empty
			expect(slots["extras"]).toEqual([]);
			// Footer is after the last slot
			expect(slots["_after"].length).toBe(1);
			expect((slots["_after"][0] as any).label).toBe("Footer");
		});

		it("runs beforeRender for hybrid dynamic views", async () => {
			const beforeHandler = vi.fn();

			const sitemap = makeSitemap({
				start: {
					type: "dynamic",
					title: "Hybrid with Banner",
					handler: "hybrid",
					beforeRender: "my-banner",
					items: [
						{ key: "b", label: "Back", signal: "back" as const },
					],
				},
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerBeforeRender("my-banner", beforeHandler);
			handlers.registerView("hybrid", vi.fn().mockResolvedValue("quit"));

			await router.run("start");

			expect(beforeHandler).toHaveBeenCalledTimes(1);
		});

		it("navigation from sitemap items works in hybrid views", async () => {
			const sitemap = makeSitemap({
				start: {
					type: "dynamic",
					title: "Hybrid Nav",
					handler: "nav-handler",
					items: [
						{ key: "s", label: "Settings", navigate: "settings" },
					],
				},
				settings: {
					title: "Settings",
					items: [
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
			});

			const { router, handlers } = createRouter(sitemap);

			// Handler uses sitemapEntries and calls runMenu internally
			handlers.registerView("nav-handler", vi.fn(async (ctx: RouterContext) => {
				// Simulate the handler calling the navigate action from sitemap entries
				const navEntry = ctx.sitemapEntries?.find(
					(e): e is any => "key" in e && e.key === "s",
				);
				if (navEntry) {
					await navEntry.action();
				}
				return "main" as MenuResult;
			}));

			// After navigation, settings view renders -> quit
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			// Should have navigated to settings
			expect(mockRunMenu).toHaveBeenCalledTimes(1);
			expect(mockRunMenu.mock.calls[0][0]).toBe("Settings");
		});
	});

	// ── 13. Parameterized navigation ────────────────────────────────

	describe("parameterized navigation", () => {
		it("passes params to handler via RouterContext when navigating with params", async () => {
			let capturedCtx: RouterContext | undefined;

			const sitemap = makeSitemap({
				start: {
					type: "dynamic",
					title: "List",
					handler: "list-handler",
				},
				detail: {
					type: "dynamic",
					title: "Detail",
					handler: "detail-handler",
				},
			});

			const { router, handlers } = createRouter(sitemap);

			handlers.registerView("list-handler", vi.fn(async () => {
				return 'navigate:detail?{"id":"btn-1"}' as MenuResult;
			}));

			handlers.registerView("detail-handler", vi.fn(async (ctx: RouterContext) => {
				capturedCtx = ctx;
				return "quit" as MenuResult;
			}));

			await router.run("start");

			expect(capturedCtx).toBeDefined();
			expect(capturedCtx!.params).toEqual({ id: "btn-1" });
		});

		it("params is undefined when navigating without params", async () => {
			let capturedCtx: RouterContext | undefined;

			const sitemap = makeSitemap({
				start: {
					type: "dynamic",
					title: "Main",
					handler: "main-handler",
				},
			});

			const { router, handlers } = createRouter(sitemap);

			handlers.registerView("main-handler", vi.fn(async (ctx: RouterContext) => {
				capturedCtx = ctx;
				return "quit" as MenuResult;
			}));

			await router.run("start");

			expect(capturedCtx).toBeDefined();
			expect(capturedCtx!.params).toBeUndefined();
		});

		it("navigateParams from sitemap item passes params to target view", async () => {
			let capturedCtx: RouterContext | undefined;

			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ key: "d", label: "Detail", navigate: "detail", navigateParams: { id: "abc" } },
					],
				},
				detail: {
					type: "dynamic",
					title: "Detail",
					handler: "detail-handler",
				},
			});

			const { router, handlers } = createRouter(sitemap);

			handlers.registerView("detail-handler", vi.fn(async (ctx: RouterContext) => {
				capturedCtx = ctx;
				return "quit" as MenuResult;
			}));

			queueMenuResults({ pickKey: "d" });
			await router.run("start");

			expect(capturedCtx).toBeDefined();
			expect(capturedCtx!.params).toEqual({ id: "abc" });
		});
	});

	// ── 14. List providers ──────────────────────────────────────────

	describe("list providers", () => {
		it("resolves listProvider entries in static views", async () => {
			const sitemap = makeSitemap({
				start: {
					title: "Main",
					items: [
						{ listProvider: "my-list" },
						{ separator: true },
						{ key: "q", label: "Quit", signal: "quit" as const },
					],
				},
			});

			const { router, handlers } = createRouter(sitemap);

			handlers.registerListProvider("my-list", () => [
				{ key: "1", label: "Item A", action: () => undefined },
				{ key: "2", label: "Item B", action: () => undefined },
			]);

			mockRunMenu.mockImplementationOnce(async (_title, entries: MenuEntry[]) => {
				// List provider entries + separator + quit
				const keys = entries.filter((e): e is any => "key" in e).map((e: any) => e.key);
				expect(keys).toContain("1");
				expect(keys).toContain("2");
				expect(keys).toContain("q");
				const quit = (entries as any[]).find((e: any) => e.key === "q");
				return quit.action();
			});

			await router.run("start");

			expect(mockRunMenu).toHaveBeenCalledTimes(1);
		});

		it("resolves listProvider entries in hybrid dynamic view slots", async () => {
			let capturedCtx: RouterContext | undefined;

			const sitemap = makeSitemap({
				start: {
					type: "dynamic",
					title: "Hybrid",
					handler: "hybrid-handler",
					items: [
						{ slot: "data" },
						{ listProvider: "extra-list" },
						{ key: "b", label: "Back", signal: "back" as const },
					],
				},
			});

			const { router, handlers } = createRouter(sitemap);

			handlers.registerListProvider("extra-list", () => [
				{ key: "x", label: "Extra", action: () => undefined },
			]);

			handlers.registerView("hybrid-handler", vi.fn(async (ctx: RouterContext) => {
				capturedCtx = ctx;
				return "quit" as MenuResult;
			}));

			await router.run("start");

			expect(capturedCtx).toBeDefined();
			// The _after slot should contain the list provider entries + Back
			const afterSlot = capturedCtx!.sitemapSlots!["_after"];
			expect(afterSlot).toBeDefined();
			const keys = afterSlot.filter((e): e is any => "key" in e).map((e: any) => e.key);
			expect(keys).toContain("x");
			expect(keys).toContain("b");
		});
	});
});
