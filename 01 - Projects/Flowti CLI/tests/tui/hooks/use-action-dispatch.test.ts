import { describe, it, expect, vi } from "vitest";
import { dispatchAction } from "../../../src/tui/hooks/use-action-dispatch.js";
import type { SitemapActionDef } from "../../../src/tui/hooks/use-sitemap-actions.js";
import type { TuiHandlerRegistry } from "../../../src/tui/registry/tui-handler-registry.js";

describe("dispatchAction", () => {
	const nav = { navigate: vi.fn(), goBack: vi.fn(), refresh: vi.fn() };

	it("dispatches navigate action", async () => {
		nav.navigate.mockClear();
		const action: SitemapActionDef = { key: "1", label: "Go", type: "navigate", target: "health", disabled: false };
		await dispatchAction(action, nav, {} as TuiHandlerRegistry, {} as never, vi.fn());
		expect(nav.navigate).toHaveBeenCalledWith("health", undefined);
	});

	it("dispatches signal:back", async () => {
		nav.goBack.mockClear();
		const action: SitemapActionDef = { key: "b", label: "Back", type: "signal", target: "back", disabled: false };
		await dispatchAction(action, nav, {} as TuiHandlerRegistry, {} as never, vi.fn());
		expect(nav.goBack).toHaveBeenCalled();
	});

	it("dispatches signal:refresh", async () => {
		nav.refresh.mockClear();
		const action: SitemapActionDef = { key: "r", label: "Refresh", type: "signal", target: "refresh", disabled: false };
		await dispatchAction(action, nav, {} as TuiHandlerRegistry, {} as never, vi.fn());
		expect(nav.refresh).toHaveBeenCalled();
	});

	it("dispatches signal:start", async () => {
		nav.navigate.mockClear();
		const action: SitemapActionDef = { key: "s", label: "Start", type: "signal", target: "start", disabled: false };
		await dispatchAction(action, nav, {} as TuiHandlerRegistry, {} as never, vi.fn());
		expect(nav.navigate).toHaveBeenCalledWith("start");
	});

	it("skips disabled actions", async () => {
		nav.navigate.mockClear();
		const action: SitemapActionDef = { key: "1", label: "Go", type: "navigate", target: "health", disabled: true };
		await dispatchAction(action, nav, {} as TuiHandlerRegistry, {} as never, vi.fn());
		expect(nav.navigate).not.toHaveBeenCalled();
	});

	it("dispatches handler action via runEffect", async () => {
		const runEffect = vi.fn();
		const registry = { getHandler: vi.fn().mockReturnValue(async () => ({ kind: "ok" })), hasHandler: vi.fn().mockReturnValue(true) } as unknown as TuiHandlerRegistry;
		const action: SitemapActionDef = { key: "1", label: "Build", type: "handler", target: "build:run", disabled: false };
		await dispatchAction(action, nav, registry, {} as never, runEffect);
		expect(runEffect).toHaveBeenCalled();
	});
});
