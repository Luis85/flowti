import { describe, it, expect, vi, beforeEach } from "vitest";
import { SitemapBootstrap } from "../../../src/infrastructure/sitemap/sitemap-bootstrap";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import { ConditionEvaluator } from "../../../src/infrastructure/handlers/condition-evaluator";
import type { PluginSitemap } from "../../../src/domain/sitemap/plugin-sitemap-types";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { ILogger } from "../../../src/infrastructure/logger/types";

function createMockPlugin() {
	return {
		app: {
			workspace: {
				getLeaf: vi.fn(() => ({
					setViewState: vi.fn(),
				})),
			},
		},
		registerView: vi.fn(),
		addCommand: vi.fn(),
		addRibbonIcon: vi.fn(),
	};
}

function createMockEventBus(): IEventBus {
	return {
		emit: vi.fn().mockResolvedValue(undefined),
		emitCustom: vi.fn().mockResolvedValue(undefined),
		on: vi.fn(() => vi.fn()),
		once: vi.fn(),
		off: vi.fn(),
		clear: vi.fn(),
	} as unknown as IEventBus;
}

function createMockLogger(): ILogger {
	return {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		setContext: vi.fn().mockReturnThis(),
		setDebugMode: vi.fn(),
	};
}

function minimalSitemap(overrides?: Partial<PluginSitemap>): PluginSitemap {
	return {
		version: 2,
		views: {},
		commands: [],
		ribbon: [],
		...overrides,
	};
}

describe("SitemapBootstrap", () => {
	let plugin: ReturnType<typeof createMockPlugin>;
	let eventBus: IEventBus;
	let logger: ILogger;
	let registry: PluginHandlerRegistry;
	let evaluator: ConditionEvaluator;

	beforeEach(() => {
		plugin = createMockPlugin();
		eventBus = createMockEventBus();
		logger = createMockLogger();
		registry = new PluginHandlerRegistry();
		evaluator = new ConditionEvaluator(registry);
	});

	function createBootstrap(sitemap: PluginSitemap) {
		return new SitemapBootstrap(sitemap, {
			plugin: plugin as never,
			eventBus,
			logger,
			handlerRegistry: registry,
			conditionEvaluator: evaluator,
			legacyViewFactories: new Map(),
		});
	}

	describe("registerViews", () => {
		it("registers legacy view using factory from legacyViewFactories map", () => {
			const factory = vi.fn();
			const sitemap = minimalSitemap({
				views: {
					"test": { kind: "hub", label: "Test", icon: "x", type: "flowti-test", legacy: true },
				},
			});
			const bootstrap = new SitemapBootstrap(sitemap, {
				plugin: plugin as never,
				eventBus,
				logger,
				handlerRegistry: registry,
				conditionEvaluator: evaluator,
				legacyViewFactories: new Map([["flowti-test", factory]]),
			});
			bootstrap.registerAll();
			expect(plugin.registerView).toHaveBeenCalledWith("flowti-test", expect.any(Function));
		});

		it("skips legacy view when factory not found", () => {
			const sitemap = minimalSitemap({
				views: {
					"test": { kind: "hub", label: "Test", icon: "x", type: "flowti-test", legacy: true },
				},
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			expect(plugin.registerView).not.toHaveBeenCalled();
			expect(logger.debug).toHaveBeenCalled();
		});

		it("registers non-legacy view with tabs as SitemapHubView", () => {
			const sitemap = minimalSitemap({
				views: {
					"new-hub": { kind: "hub", label: "New", icon: "star", type: "flowti-new-hub", tabs: [{ id: "t", label: "T", icon: "x", handler: "h" }] },
				},
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			expect(plugin.registerView).toHaveBeenCalledWith("flowti-new-hub", expect.any(Function));
		});

		it("registers view with handler field as SitemapLeafView", () => {
			const sitemap = minimalSitemap({
				views: {
					"leaf": { kind: "leaf", label: "Leaf", icon: "file", type: "flowti-leaf", handler: "leaf:main" },
				},
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			expect(plugin.registerView).toHaveBeenCalledWith("flowti-leaf", expect.any(Function));
		});

		it("registers view with component field as SitemapLeafView", () => {
			const sitemap = minimalSitemap({
				views: {
					"leaf": { kind: "leaf", label: "Leaf", icon: "file", type: "flowti-leaf", component: "flowti-widget" },
				},
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			expect(plugin.registerView).toHaveBeenCalledWith("flowti-leaf", expect.any(Function));
		});

		it("registers view with fileView flag using legacy factory", () => {
			const factory = vi.fn();
			const sitemap = minimalSitemap({
				views: {
					"csv": { kind: "leaf", label: "CSV", icon: "file", type: "flowti-csv", fileView: true },
				},
			});
			const bootstrap = new SitemapBootstrap(sitemap, {
				plugin: plugin as never,
				eventBus,
				logger,
				handlerRegistry: registry,
				conditionEvaluator: evaluator,
				legacyViewFactories: new Map([["flowti-csv", factory]]),
			});
			bootstrap.registerAll();
			expect(plugin.registerView).toHaveBeenCalledWith("flowti-csv", expect.any(Function));
		});

		it("skips fileView view when factory not found", () => {
			const sitemap = minimalSitemap({
				views: {
					"csv": { kind: "leaf", label: "CSV", icon: "file", type: "flowti-csv", fileView: true },
				},
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			expect(plugin.registerView).not.toHaveBeenCalled();
			expect(logger.debug).toHaveBeenCalled();
		});

		it("skips non-legacy view without tabs, handler, or component", () => {
			const sitemap = minimalSitemap({
				views: {
					"empty": { kind: "hub", label: "Empty", icon: "x", type: "flowti-empty" },
				},
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			expect(plugin.registerView).not.toHaveBeenCalled();
		});
	});

	describe("registerCommands", () => {
		it("registers unconditional command with callback", () => {
			const handler = vi.fn();
			registry.registerAction("test:action", handler);
			const sitemap = minimalSitemap({
				commands: [{ id: "flowti:test", name: "Test", handler: "test:action" }],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			expect(plugin.addCommand).toHaveBeenCalledWith(expect.objectContaining({
				id: "flowti:test",
				name: "Test",
				callback: expect.any(Function),
			}));
		});

		it("registers conditional command with checkCallback", () => {
			registry.registerAction("train:resume", vi.fn());
			registry.registerCondition("no-active-train", () => true);
			const sitemap = minimalSitemap({
				commands: [{
					id: "flowti:resume", name: "Resume", handler: "train:resume",
					conditions: { hidden: "no-active-train" },
				}],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			expect(plugin.addCommand).toHaveBeenCalledWith(expect.objectContaining({
				id: "flowti:resume",
				checkCallback: expect.any(Function),
			}));
		});

		it("checkCallback returns false when condition is true (hidden)", () => {
			registry.registerAction("train:resume", vi.fn());
			registry.registerCondition("no-active-train", () => true);
			const sitemap = minimalSitemap({
				commands: [{
					id: "flowti:resume", name: "Resume", handler: "train:resume",
					conditions: { hidden: "no-active-train" },
				}],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			const cmd = plugin.addCommand.mock.calls[0][0];
			expect(cmd.checkCallback(true)).toBe(false);
		});

		it("checkCallback returns true and executes when condition is false", () => {
			const handler = vi.fn();
			registry.registerAction("train:resume", handler);
			registry.registerCondition("no-active-train", () => false);
			const sitemap = minimalSitemap({
				commands: [{
					id: "flowti:resume", name: "Resume", handler: "train:resume",
					conditions: { hidden: "no-active-train" },
				}],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			const cmd = plugin.addCommand.mock.calls[0][0];
			expect(cmd.checkCallback(false)).toBe(true);
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("skips command when handler not registered", () => {
			const sitemap = minimalSitemap({
				commands: [{ id: "flowti:missing", name: "Missing", handler: "nope" }],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			expect(plugin.addCommand).not.toHaveBeenCalled();
			expect(logger.warn).toHaveBeenCalled();
		});
	});

	describe("registerRibbon", () => {
		it("registers ribbon icon with handler", () => {
			const handler = vi.fn();
			registry.registerAction("capture:idea", handler);
			const sitemap = minimalSitemap({
				ribbon: [{ icon: "lightbulb", label: "Idea", action: "capture:idea" }],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			expect(plugin.addRibbonIcon).toHaveBeenCalledWith("lightbulb", "Idea", expect.any(Function));
		});

		it("ribbon click calls handler", () => {
			const handler = vi.fn();
			registry.registerAction("capture:idea", handler);
			const sitemap = minimalSitemap({
				ribbon: [{ icon: "lightbulb", label: "Idea", action: "capture:idea" }],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			const clickHandler = plugin.addRibbonIcon.mock.calls[0][2];
			clickHandler();
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("ribbon with view: prefix opens view", () => {
			const sitemap = minimalSitemap({
				ribbon: [{ icon: "home", label: "Hub", action: "view:flowti-user-hub" }],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			const clickHandler = plugin.addRibbonIcon.mock.calls[0][2];
			clickHandler();
			expect(plugin.app.workspace.getLeaf).toHaveBeenCalled();
		});

		it("ribbon with condition skips when hidden", () => {
			const handler = vi.fn();
			registry.registerAction("train:open", handler);
			registry.registerCondition("no-train", () => true);
			const sitemap = minimalSitemap({
				ribbon: [{ icon: "train", label: "Train", action: "train:open", conditions: { hidden: "no-train" } }],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			const clickHandler = plugin.addRibbonIcon.mock.calls[0][2];
			clickHandler();
			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("unregisterAll", () => {
		it("resets internal tracking arrays", () => {
			registry.registerAction("test:action", vi.fn());
			const sitemap = minimalSitemap({
				views: { "v": { kind: "hub", label: "V", icon: "x", type: "flowti-v" } },
				commands: [{ id: "flowti:test", name: "Test", handler: "test:action" }],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			bootstrap.unregisterAll();
		});
	});
});
