import { describe, it, expect, vi, beforeEach } from "vitest";
import { SitemapRouter } from "../../src/infrastructure/sitemap-router.js";
import { HandlerRegistry } from "../../src/infrastructure/handler-registry.js";
import { CommandRegistry } from "../../src/infrastructure/command-registry.js";
import type { Sitemap, PageObject, RouterContext } from "../../src/infrastructure/sitemap-types.js";
import type { CliDeps } from "../../src/infrastructure/deps.js";
import type { MenuEntry, MenuResult, ProjectContext } from "../../src/infrastructure/types.js";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
	insertGroupSeparators: vi.fn((items: MenuEntry[]) => items),
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

vi.mock("../../src/infrastructure/key-assigner.js", () => ({
	assignKeys: vi.fn((actions: Array<{ key?: string; label: string }>) =>
		actions.map((action, i) => ({
			action,
			assignedKey: action.key ?? String(i + 1),
		})),
	),
}));

vi.mock("../../src/infrastructure/input.js", () => ({
	input: { waitForEnter: vi.fn() },
}));

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/ui.js", () => ({
	DIM: "", RESET: "", RED: "", YELLOW: "", CYAN: "", BOLD: "",
}));
vi.mock("../../src/ui/displays/status-bar-display.js", () => ({
	renderStatusBar: vi.fn(),
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

function makeSitemap(pages: Sitemap["pages"]): Sitemap {
	return { version: 2, pages };
}

function makePage(overrides: Partial<PageObject> & { actions: PageObject["actions"] }): PageObject {
	return {
		kind: "page",
		label: overrides.label ?? "Page",
		description: overrides.description ?? "",
		...overrides,
	};
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
				start: makePage({
					label: "Main Menu",
					actions: [
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
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
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onSettings", label: "Settings", type: "navigate", target: "settings", key: "s" },
					],
				}),
				settings: makePage({
					label: "Settings",
					actions: [
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
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
				start: makePage({
					label: "Main",
					actions: [{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" }],
				}),
			});

			const { router } = createRouter(sitemap);
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			expect(mockRunMenu).toHaveBeenCalledTimes(1);
		});

		it('"back" signal pops the view stack', async () => {
			const sitemap = makeSitemap({
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onSub", label: "Sub", type: "navigate", target: "sub", key: "s" },
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
				sub: makePage({
					label: "Sub",
					actions: [{ name: "onBack", label: "Back", type: "signal", target: "back", key: "b" }],
				}),
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
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onSub", label: "Sub", type: "navigate", target: "sub", key: "s" },
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
				sub: makePage({
					label: "Sub",
					actions: [{ name: "onHome", label: "Home", type: "signal", target: "start", key: "h" }],
				}),
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
				start: makePage({
					label: "Main",
					actions: [{ name: "onDynamic", label: "Dynamic", type: "navigate", target: "dyn", key: "d" }],
				}),
				dyn: makePage({
					label: "Dynamic View",
					actions: [],
				}),
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerView("dyn", viewHandler);

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
				start: makePage({
					label: "Main",
					actions: [],
				}),
				settings: makePage({
					label: "Settings",
					actions: [],
				}),
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerView("start", viewHandler);
			handlers.registerView("settings", viewHandler);

			await router.run("start");

			expect(viewHandler).toHaveBeenCalledTimes(2);
		});

		it("navigate to same page replaces stack top instead of pushing duplicate", async () => {
			// Simulates: detail view returns navigate:detail (e.g. after advance)
			// then "main" to go back. Should pop to parent, not to a duplicate.
			const detailHandler = vi.fn<(ctx: RouterContext) => Promise<MenuResult>>()
				.mockResolvedValueOnce("navigate:detail" as MenuResult) // self-navigate (replace)
				.mockResolvedValueOnce("main" as MenuResult);           // back → should go to start

			const sitemap = makeSitemap({
				start: makePage({
					label: "Start",
					actions: [
						{ name: "onNav", label: "Go", type: "navigate", target: "detail", key: "d" },
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
				detail: makePage({
					label: "Detail",
					actions: [],
				}),
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerView("detail", detailHandler);

			// start renders static: pick "d" → navigate:detail
			// detail (1st): returns navigate:detail → replace (not push)
			// detail (2nd): returns "main" → pop → back to start
			// start renders static again: pick "q" → quit
			queueMenuResults({ pickKey: "d" }, { pickKey: "q" });
			await router.run("start");

			// detail rendered exactly twice (not three times, which would indicate a duplicate)
			expect(detailHandler).toHaveBeenCalledTimes(2);
		});
	});

	// ── 4. Command dispatch ─────────────────────────────────────────

	describe("command dispatch", () => {
		it("dispatches command through CommandRegistry", async () => {
			const cmdHandler = vi.fn().mockResolvedValue(undefined);

			const sitemap = makeSitemap({
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onBuild", label: "Build", type: "command", target: "build", key: "b" },
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
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
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onUnknown", label: "Unknown", type: "command", target: "nonexistent", key: "x" },
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
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
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onAction", label: "Action", type: "handler", target: "my-action", key: "a" },
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
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
				start: makePage({
					label: "Main",
					actions: [{ name: "onAction", label: "Action", type: "handler", target: "my-action", key: "a" }],
				}),
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
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onSub", label: "Sub", type: "navigate", target: "sub", key: "s" },
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
				sub: makePage({
					label: "Sub",
					actions: [{ name: "onReset", label: "Reset", type: "handler", target: "reset-action", key: "a" }],
				}),
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
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onSub", label: "Sub", type: "navigate", target: "sub", key: "s" },
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
				sub: makePage({
					label: "Sub",
					actions: [{ name: "onGoBack", label: "Go back", type: "handler", target: "back-action", key: "a" }],
				}),
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

	// ── 6. Disabled / hidden actions ────────────────────────────────

	describe("disabled and hidden actions", () => {
		it("passes disabled condition to menu entries", async () => {
			const sitemap = makeSitemap({
				start: makePage({
					label: "Main",
					actions: [
						{
							name: "onDisabled",
							label: "Disabled Item",
							type: "signal",
							target: "quit",
							key: "d",
							disabled: true,
							disabledMessage: "Not available",
						},
					],
				}),
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

		it("hidden actions are excluded from entries", async () => {
			vi.mocked(resolveHiddenCondition).mockReturnValueOnce(true);

			const sitemap = makeSitemap({
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onHidden", label: "Hidden", type: "signal", target: "quit", key: "h", hidden: true },
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
			});

			const { router } = createRouter(sitemap);
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			const entries = mockRunMenu.mock.calls[0][1];
			const keys = entries.filter((e): e is any => "key" in e).map((e: any) => e.key);
			expect(keys).not.toContain("h");
			expect(keys).toContain("q");
		});

		it("group-based separators are inserted via insertGroupSeparators", async () => {
			const sitemap = makeSitemap({
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onA", label: "A", type: "signal", target: "quit", key: "a", group: "first" },
						{ name: "onB", label: "B", type: "signal", target: "quit", key: "b", group: "second" },
					],
				}),
			});

			const { insertGroupSeparators } = await import("../../src/infrastructure/menu.js");
			const mockInsertGroupSeparators = vi.mocked(insertGroupSeparators);

			const { router } = createRouter(sitemap);
			queueMenuResults({ pickKey: "a" });

			await router.run("start");

			// insertGroupSeparators should have been called to handle group-based separators
			expect(mockInsertGroupSeparators).toHaveBeenCalled();
		});
	});

	// ── 7. BeforeRender handlers ────────────────────────────────────

	describe("beforeRender handlers", () => {
		it("passes beforeMenu callback when onBeforeRender handler is registered", async () => {
			const beforeHandler = vi.fn();

			const sitemap = makeSitemap({
				start: makePage({
					label: "Main",
					onBeforeRender: "my-banner",
					actions: [{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" }],
				}),
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
				start: makePage({
					label: "Main",
					onBeforeRender: "nonexistent-banner",
					actions: [{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" }],
				}),
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
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onPick", label: "Pick project", type: "navigate", target: "project-picker", key: "p" },
					],
				}),
				"project-picker": makePage({
					label: "Pick",
					actions: [],
				}),
				"project-detail": makePage({
					label: "Project: {{project.name}}",
					actions: [
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
			});

			const { router, handlers, getProject, onProjectSelected } = createRouter(sitemap);

			// The dynamic picker returns "main" to pop back
			handlers.registerView("project-picker", vi.fn().mockResolvedValue("main"));

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
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onBack", label: "Back", type: "signal", target: "back", key: "b" },
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
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

	// ── 10. Template interpolation in labels ────────────────────────

	describe("template interpolation", () => {
		it("calls interpolate with label and context", async () => {
			mockInterpolate.mockReturnValue("Project: MyApp");

			const sitemap = makeSitemap({
				start: makePage({
					label: "Project: {{project.name}}",
					actions: [{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" }],
				}),
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

		it("interpolates action labels too", async () => {
			mockInterpolate.mockImplementation((template: string) => {
				if (template.includes("{{project.name}}")) return template.replace("{{project.name}}", "MyApp");
				return template;
			});

			const sitemap = makeSitemap({
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onProject", label: "Project: {{project.name}}", type: "signal", target: "quit", key: "p" },
					],
				}),
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
				start: makePage({
					label: "Original",
					actions: [{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" }],
				}),
			});

			const updated = makeSitemap({
				start: makePage({
					label: "Updated",
					actions: [{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" }],
				}),
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

	// ── Unknown page ────────────────────────────────────────────────

	describe("unknown page handling", () => {
		it("pops unknown page and continues", async () => {
			const { log } = await import("../../src/infrastructure/logger.js");
			const mockLog = vi.mocked(log);

			const sitemap = makeSitemap({
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onNowhere", label: "Go nowhere", type: "navigate", target: "nonexistent", key: "n" },
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
			});

			const { router } = createRouter(sitemap);

			// Navigate to nonexistent page, it gets popped, back to start, then quit
			queueMenuResults({ pickKey: "n" });
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			expect(mockLog).toHaveBeenCalledWith(
				expect.stringContaining('Unknown page: "nonexistent"'),
			);
			expect(mockRunMenu).toHaveBeenCalledTimes(2);
		});
	});

	// ── Context requirement ─────────────────────────────────────────

	describe("context requirements", () => {
		it("pops a page that requires project context when no project is set", async () => {
			const { log } = await import("../../src/infrastructure/logger.js");
			const mockLog = vi.mocked(log);

			const sitemap = makeSitemap({
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onDetail", label: "Detail", type: "navigate", target: "detail", key: "d" },
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
				detail: makePage({
					label: "Detail",
					context: ["project"],
					actions: [{ name: "onBack", label: "Back", type: "signal", target: "back", key: "b" }],
				}),
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
				start: makePage({
					label: "Main",
					actions: [],
				}),
			});

			const { router, handlers, getProject, getTools } = createRouter(sitemap);
			getProject.mockReturnValue(project);
			getTools.mockReturnValue(tools);

			let capturedCtx: RouterContext | undefined;
			handlers.registerView("start", vi.fn(async (ctx: RouterContext) => {
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

	// ── Fallback action (no action type match) ──────────────────────

	describe("fallback action", () => {
		it("action with no recognized handler returns undefined (stays in menu)", async () => {
			const sitemap = makeSitemap({
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onNoop", label: "No-op", type: "handler", target: "noop-action", key: "n" },
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
			});

			const { router, handlers } = createRouter(sitemap);
			// Register handler that returns undefined (no-op)
			handlers.registerAction("noop-action", vi.fn().mockResolvedValue(undefined));

			// First call: pick no-op (returns undefined, stays in menu)
			// runMenu returns undefined after the no-op action
			mockRunMenu.mockImplementationOnce(async (_title, entries: MenuEntry[]) => {
				const item = (entries as any[]).find((e: any) => e.key === "n");
				const result = await item.action();
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
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onBuild", label: "Build", type: "command", target: "build", key: "b" },
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
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

	// ── 12. Dynamic views with data sources ─────────────────────────

	describe("dynamic views with data sources", () => {
		it("passes dataSourceEntries to handler when page has dataSources", async () => {
			let capturedCtx: RouterContext | undefined;

			const sitemap = makeSitemap({
				start: makePage({
					label: "Hybrid",
					dataSources: [{ id: "my-provider", slot: "dynamic-list" }],
					actions: [
						{ name: "onAction", label: "Static Action", type: "handler", target: "some-action", key: "a" },
						{ name: "onBack", label: "Back", type: "signal", target: "back", key: "b", group: "nav" },
					],
				}),
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerAction("some-action", vi.fn().mockResolvedValue(undefined));
			handlers.registerDataSource("my-provider", () => [
				{ key: "1", label: "Item A", action: () => undefined },
				{ key: "2", label: "Item B", action: () => undefined },
			]);
			handlers.registerView("start", vi.fn(async (ctx: RouterContext) => {
				capturedCtx = ctx;
				return "quit" as MenuResult;
			}));

			await router.run("start");

			expect(capturedCtx).toBeDefined();
			expect(capturedCtx!.dataSourceEntries).toBeDefined();
			expect(capturedCtx!.dataSourceEntries!["dynamic-list"]).toBeDefined();
			expect(capturedCtx!.dataSourceEntries!["dynamic-list"].length).toBe(2);
			// _actions should contain the built action entries
			expect(capturedCtx!.dataSourceEntries!["_actions"]).toBeDefined();
		});

		it("does not pass dataSourceEntries content for pages without dataSources", async () => {
			let capturedCtx: RouterContext | undefined;

			const sitemap = makeSitemap({
				start: makePage({
					label: "Pure",
					actions: [],
				}),
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerView("start", vi.fn(async (ctx: RouterContext) => {
				capturedCtx = ctx;
				return "quit" as MenuResult;
			}));

			await router.run("start");

			expect(capturedCtx).toBeDefined();
			// dataSourceEntries still exists but has no data source keys, only _actions
			expect(capturedCtx!.dataSourceEntries).toBeDefined();
			expect(capturedCtx!.dataSourceEntries!["_actions"]).toBeDefined();
			// No data source keys beyond _actions
			const keys = Object.keys(capturedCtx!.dataSourceEntries!).filter((k) => k !== "_actions");
			expect(keys).toHaveLength(0);
		});

		it("resolves multiple data sources correctly", async () => {
			let capturedCtx: RouterContext | undefined;

			const sitemap = makeSitemap({
				start: makePage({
					label: "Multi-Source",
					dataSources: [
						{ id: "list-provider", slot: "list" },
						{ id: "extras-provider", slot: "extras" },
					],
					actions: [
						{ name: "onHeader", label: "Header", type: "signal", target: "back", key: "h" },
						{ name: "onFooter", label: "Footer", type: "signal", target: "back", key: "f", group: "nav" },
					],
				}),
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerDataSource("list-provider", () => [
				{ key: "1", label: "List Item", action: () => undefined },
			]);
			handlers.registerDataSource("extras-provider", () => [
				{ key: "2", label: "Extra Item", action: () => undefined },
			]);
			handlers.registerView("start", vi.fn(async (ctx: RouterContext) => {
				capturedCtx = ctx;
				return "quit" as MenuResult;
			}));

			await router.run("start");

			expect(capturedCtx!.dataSourceEntries!["list"]).toBeDefined();
			expect(capturedCtx!.dataSourceEntries!["list"].length).toBe(1);
			expect(capturedCtx!.dataSourceEntries!["extras"]).toBeDefined();
			expect(capturedCtx!.dataSourceEntries!["extras"].length).toBe(1);
		});

		it("runs onBeforeRender for dynamic views with data sources", async () => {
			const beforeHandler = vi.fn();

			const sitemap = makeSitemap({
				start: makePage({
					label: "Hybrid with Banner",
					onBeforeRender: "my-banner",
					actions: [
						{ name: "onBack", label: "Back", type: "signal", target: "back", key: "b" },
					],
				}),
			});

			const { router, handlers } = createRouter(sitemap);
			handlers.registerBeforeRender("my-banner", beforeHandler);
			handlers.registerView("start", vi.fn().mockResolvedValue("quit"));

			await router.run("start");

			expect(beforeHandler).toHaveBeenCalledTimes(1);
		});

		it("navigation from action entries works in dynamic views", async () => {
			const sitemap = makeSitemap({
				start: makePage({
					label: "Hybrid Nav",
					actions: [
						{ name: "onSettings", label: "Settings", type: "navigate", target: "settings", key: "s" },
					],
				}),
				settings: makePage({
					label: "Settings",
					actions: [
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
			});

			const { router, handlers } = createRouter(sitemap);

			// Dynamic views navigate by returning a navigate result string directly
			handlers.registerView("start", vi.fn(async () => {
				return "navigate:settings" as MenuResult;
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
				start: makePage({
					label: "List",
					actions: [],
				}),
				detail: makePage({
					label: "Detail",
					actions: [],
				}),
			});

			const { router, handlers } = createRouter(sitemap);

			handlers.registerView("start", vi.fn(async () => {
				return 'navigate:detail?{"id":"btn-1"}' as MenuResult;
			}));

			handlers.registerView("detail", vi.fn(async (ctx: RouterContext) => {
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
				start: makePage({
					label: "Main",
					actions: [],
				}),
			});

			const { router, handlers } = createRouter(sitemap);

			handlers.registerView("start", vi.fn(async (ctx: RouterContext) => {
				capturedCtx = ctx;
				return "quit" as MenuResult;
			}));

			await router.run("start");

			expect(capturedCtx).toBeDefined();
			expect(capturedCtx!.params).toBeUndefined();
		});

		it("navigate action with params passes params to target view", async () => {
			let capturedCtx: RouterContext | undefined;

			const sitemap = makeSitemap({
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onDetail", label: "Detail", type: "navigate", target: "detail", key: "d", params: { id: "abc" } },
					],
				}),
				detail: makePage({
					label: "Detail",
					actions: [],
				}),
			});

			const { router, handlers } = createRouter(sitemap);

			handlers.registerView("detail", vi.fn(async (ctx: RouterContext) => {
				capturedCtx = ctx;
				return "quit" as MenuResult;
			}));

			queueMenuResults({ pickKey: "d" });
			await router.run("start");

			expect(capturedCtx).toBeDefined();
			expect(capturedCtx!.params).toEqual({ id: "abc" });
		});
	});

	// ── 14. Data sources in static views ────────────────────────────

	describe("data sources in static views", () => {
		it("resolves dataSource entries in static views", async () => {
			const sitemap = makeSitemap({
				start: makePage({
					label: "Main",
					dataSources: [{ id: "my-list" }],
					actions: [
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
			});

			const { router, handlers } = createRouter(sitemap);

			handlers.registerDataSource("my-list", () => [
				{ key: "1", label: "Item A", action: () => undefined },
				{ key: "2", label: "Item B", action: () => undefined },
			]);

			mockRunMenu.mockImplementationOnce(async (_title, entries: MenuEntry[]) => {
				// Data source entries + separator + quit action
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

		it("resolves dataSource entries in dynamic view context", async () => {
			let capturedCtx: RouterContext | undefined;

			const sitemap = makeSitemap({
				start: makePage({
					label: "Hybrid",
					dataSources: [
						{ id: "data-source", slot: "data" },
						{ id: "extra-list" },
					],
					actions: [
						{ name: "onBack", label: "Back", type: "signal", target: "back", key: "b" },
					],
				}),
			});

			const { router, handlers } = createRouter(sitemap);

			handlers.registerDataSource("extra-list", () => [
				{ key: "x", label: "Extra", action: () => undefined },
			]);
			handlers.registerDataSource("data-source", () => [
				{ key: "d", label: "Data", action: () => undefined },
			]);

			handlers.registerView("start", vi.fn(async (ctx: RouterContext) => {
				capturedCtx = ctx;
				return "quit" as MenuResult;
			}));

			await router.run("start");

			expect(capturedCtx).toBeDefined();
			// Data sources should be in dataSourceEntries keyed by slot or id
			expect(capturedCtx!.dataSourceEntries!["data"]).toBeDefined();
			expect(capturedCtx!.dataSourceEntries!["data"].length).toBe(1);
			expect(capturedCtx!.dataSourceEntries!["extra-list"]).toBeDefined();
			expect(capturedCtx!.dataSourceEntries!["extra-list"].length).toBe(1);
		});
	});

	// ── Agent question hooks ─────────────────────────────────────────

	describe("agent question hooks", () => {
		it("passes onAgentQuestion and renderStatusBar to runMenu when agentShell exists", async () => {
			const sitemap = makeSitemap({
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
			});

			const mockShell = {
				pendingQuestions: vi.fn(() => []),
				answerAgent: vi.fn(),
			};
			const depsWithShell = { agentShell: mockShell, input: { ask: vi.fn() }, log: vi.fn() } as unknown as CliDeps;

			const handlers = new HandlerRegistry();
			const commands = new CommandRegistry();
			const router = new SitemapRouter({
				sitemap,
				handlers,
				commands,
				deps: depsWithShell,
				getProject: () => undefined,
				getTools: () => undefined,
				onProjectSelected: vi.fn(),
				onProjectCleared: vi.fn(),
			});

			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			const opts = mockRunMenu.mock.calls[0][2] as Record<string, unknown>;
			expect(opts.onAgentQuestion).toBeTypeOf("function");
			expect(opts.renderStatusBar).toBeTypeOf("function");
		});

		it("does not pass onAgentQuestion when agentShell is undefined", async () => {
			const sitemap = makeSitemap({
				start: makePage({
					label: "Main",
					actions: [
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
			});

			const { router } = createRouter(sitemap);
			queueMenuResults({ pickKey: "q" });

			await router.run("start");

			const opts = mockRunMenu.mock.calls[0][2] as Record<string, unknown>;
			expect(opts.onAgentQuestion).toBeUndefined();
			expect(opts.renderStatusBar).toBeUndefined();
		});
	});
});
