import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { validatePluginSitemap } from "../../../src/domain/sitemap/plugin-sitemap-validator";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import { ConditionEvaluator } from "../../../src/infrastructure/handlers/condition-evaluator";
import { SitemapBootstrap } from "../../../src/infrastructure/sitemap/sitemap-bootstrap";
import type { PluginSitemap } from "../../../src/domain/sitemap/plugin-sitemap-types";

function loadSitemap(): PluginSitemap {
	const raw = readFileSync(resolve(__dirname, "../../../configs/sitemap.json"), "utf8");
	return JSON.parse(raw) as PluginSitemap;
}

describe("plugin-sitemap integration", () => {
	it("plugin-sitemap.json passes validation", () => {
		const sitemap = loadSitemap();
		const result = validatePluginSitemap(sitemap);
		const errors = result.errors.filter((e) => e.severity === "error");
		expect(errors).toHaveLength(0);
		expect(result.valid).toBe(true);
	});

	it("all command handler IDs can be registered and resolved", () => {
		const sitemap = loadSitemap();
		const registry = new PluginHandlerRegistry();

		// Register a stub handler for every unique handler ID referenced in commands
		const handlerIds = new Set(sitemap.commands.map((c) => c.handler));
		for (const id of handlerIds) {
			registry.registerAction(id, vi.fn());
		}

		// Register stub condition handlers for all conditions
		const conditionIds = new Set<string>();
		for (const cmd of sitemap.commands) {
			if (cmd.conditions?.hidden) conditionIds.add(cmd.conditions.hidden);
			if (cmd.conditions?.disabled) conditionIds.add(cmd.conditions.disabled);
		}
		for (const id of conditionIds) {
			// Register simple conditions (compound expressions may have multiple IDs)
			if (!id.includes("&&") && !id.includes("||") && !id.startsWith("!") && !id.includes("(")) {
				registry.registerCondition(id, () => false);
			}
		}

		// Register stub for ribbon handler IDs
		const ribbonActionIds = sitemap.ribbon
			.filter((r) => !r.action.startsWith("view:"))
			.map((r) => r.action);
		for (const id of ribbonActionIds) {
			if (!registry.hasHandler(id)) {
				registry.registerAction(id, vi.fn());
			}
		}

		// Bootstrap should not throw
		const mockPlugin = {
			app: { workspace: { getLeaf: vi.fn(() => ({ setViewState: vi.fn() })) } },
			registerView: vi.fn(),
			addCommand: vi.fn(),
			addRibbonIcon: vi.fn(),
		};

		const evaluator = new ConditionEvaluator(registry);
		const bootstrap = new SitemapBootstrap(sitemap, {
			plugin: mockPlugin as never,
			eventBus: { emit: vi.fn(), on: vi.fn(() => vi.fn()) } as never,
			logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), setContext: vi.fn(), setDebugMode: vi.fn() } as never,
			handlerRegistry: registry,
			conditionEvaluator: evaluator,
		});

		bootstrap.registerAll();

		// All commands should have been registered
		expect(mockPlugin.addCommand).toHaveBeenCalledTimes(sitemap.commands.length);

		// All ribbon icons should have been registered
		expect(mockPlugin.addRibbonIcon).toHaveBeenCalledTimes(sitemap.ribbon.length);
	});

	it("test-management-hub has tabs and refreshEvents", () => {
		const sitemap = loadSitemap();
		const view = sitemap.views["test-management-hub"];
		expect(view.tabs).toBeDefined();
		expect(view.tabs!.length).toBeGreaterThanOrEqual(8);
		expect(view.refreshEvents).toBeDefined();
		expect(view.refreshEvents!.length).toBeGreaterThan(0);
	});

	it("all view types in sitemap are declared", () => {
		const sitemap = loadSitemap();
		const viewTypes = Object.values(sitemap.views).map((v) => v.type);
		// Each view type should be unique
		expect(new Set(viewTypes).size).toBe(viewTypes.length);
		// Each should have a non-empty type
		for (const t of viewTypes) {
			expect(t.length).toBeGreaterThan(0);
		}
	});
});
