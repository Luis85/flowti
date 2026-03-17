import { describe, it, expect, vi } from "vitest";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import type { TabHandler, ActionHandler, ConditionHandler, DataSourceHandler } from "../../../src/infrastructure/handlers/plugin-handler-registry";

describe("PluginHandlerRegistry", () => {
	function createRegistry(): PluginHandlerRegistry {
		return new PluginHandlerRegistry();
	}

	describe("tab handlers", () => {
		it("registers and retrieves a tab handler", () => {
			const registry = createRegistry();
			const handler: TabHandler = vi.fn();
			registry.registerTabHandler("analytics:dashboard", handler);
			expect(registry.getTabHandler("analytics:dashboard")).toBe(handler);
		});

		it("returns undefined for unregistered tab handler", () => {
			const registry = createRegistry();
			expect(registry.getTabHandler("nonexistent")).toBeUndefined();
		});

		it("overwrites on duplicate registration", () => {
			const registry = createRegistry();
			const first: TabHandler = vi.fn();
			const second: TabHandler = vi.fn();
			registry.registerTabHandler("tab:x", first);
			registry.registerTabHandler("tab:x", second);
			expect(registry.getTabHandler("tab:x")).toBe(second);
		});
	});

	describe("action handlers", () => {
		it("registers and retrieves an action handler", () => {
			const registry = createRegistry();
			const handler: ActionHandler = vi.fn();
			registry.registerAction("capture:idea", handler);
			expect(registry.getAction("capture:idea")).toBe(handler);
		});

		it("returns undefined for unregistered action", () => {
			const registry = createRegistry();
			expect(registry.getAction("nope")).toBeUndefined();
		});
	});

	describe("condition handlers", () => {
		it("registers and retrieves a condition handler", () => {
			const registry = createRegistry();
			const handler: ConditionHandler = vi.fn(() => true);
			registry.registerCondition("no-active-train", handler);
			expect(registry.getCondition("no-active-train")).toBe(handler);
		});

		it("returns undefined for unregistered condition", () => {
			const registry = createRegistry();
			expect(registry.getCondition("nope")).toBeUndefined();
		});
	});

	describe("data source handlers", () => {
		it("registers and retrieves a data source handler", () => {
			const registry = createRegistry();
			const handler: DataSourceHandler = vi.fn(() => []);
			registry.registerDataSource("analytics:measurements", handler);
			expect(registry.getDataSource("analytics:measurements")).toBe(handler);
		});

		it("returns undefined for unregistered data source", () => {
			const registry = createRegistry();
			expect(registry.getDataSource("nope")).toBeUndefined();
		});
	});

	describe("introspection", () => {
		it("hasHandler returns true for any registered handler type", () => {
			const registry = createRegistry();
			registry.registerAction("action:x", vi.fn());
			registry.registerCondition("cond:y", vi.fn(() => false));
			expect(registry.hasHandler("action:x")).toBe(true);
			expect(registry.hasHandler("cond:y")).toBe(true);
			expect(registry.hasHandler("unknown")).toBe(false);
		});

		it("getRegisteredIds returns all handler IDs across types", () => {
			const registry = createRegistry();
			registry.registerTabHandler("tab:a", vi.fn());
			registry.registerAction("action:b", vi.fn());
			registry.registerCondition("cond:c", vi.fn(() => false));
			registry.registerDataSource("ds:d", vi.fn(() => null));
			const ids = registry.getRegisteredIds();
			expect(ids).toContain("tab:a");
			expect(ids).toContain("action:b");
			expect(ids).toContain("cond:c");
			expect(ids).toContain("ds:d");
			expect(ids).toHaveLength(4);
		});

		it("clear removes all handlers", () => {
			const registry = createRegistry();
			registry.registerTabHandler("tab:a", vi.fn());
			registry.registerAction("action:b", vi.fn());
			registry.registerCondition("cond:c", vi.fn(() => false));
			registry.registerDataSource("ds:d", vi.fn(() => null));
			registry.clear();
			expect(registry.getRegisteredIds()).toHaveLength(0);
			expect(registry.hasHandler("tab:a")).toBe(false);
		});
	});
});
