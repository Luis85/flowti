import { describe, it, expect, vi } from "vitest";
import { HandlerRegistry } from "../../src/infrastructure/handler-registry.js";

describe("HandlerRegistry", () => {
	// ── View handlers ───────────────────────────────────────────────

	it("registers and retrieves a view handler", () => {
		const reg = new HandlerRegistry();
		const handler = vi.fn();
		reg.registerView("publish", handler);
		expect(reg.getView("publish")).toBe(handler);
		expect(reg.hasView("publish")).toBe(true);
	});

	it("throws on duplicate view handler", () => {
		const reg = new HandlerRegistry();
		reg.registerView("publish", vi.fn());
		expect(() => reg.registerView("publish", vi.fn())).toThrow('Duplicate view handler: "publish"');
	});

	it("throws on unknown view handler", () => {
		const reg = new HandlerRegistry();
		expect(() => reg.getView("nope")).toThrow('Unknown view handler: "nope"');
	});

	// ── Action handlers ─────────────────────────────────────────────

	it("registers and retrieves an action handler", () => {
		const reg = new HandlerRegistry();
		const handler = vi.fn();
		reg.registerAction("health:show", handler);
		expect(reg.getAction("health:show")).toBe(handler);
		expect(reg.hasAction("health:show")).toBe(true);
	});

	it("throws on duplicate action handler", () => {
		const reg = new HandlerRegistry();
		reg.registerAction("health:show", vi.fn());
		expect(() => reg.registerAction("health:show", vi.fn())).toThrow('Duplicate action handler: "health:show"');
	});

	it("throws on unknown action handler", () => {
		const reg = new HandlerRegistry();
		expect(() => reg.getAction("nope")).toThrow('Unknown action handler: "nope"');
	});

	// ── Condition handlers ──────────────────────────────────────────

	it("registers and retrieves a condition handler", () => {
		const reg = new HandlerRegistry();
		const cond = () => true;
		reg.registerCondition("kb:available", cond);
		expect(reg.getCondition("kb:available")).toBe(cond);
		expect(reg.hasCondition("kb:available")).toBe(true);
	});

	it("throws on duplicate condition handler", () => {
		const reg = new HandlerRegistry();
		reg.registerCondition("kb:available", () => true);
		expect(() => reg.registerCondition("kb:available", () => false)).toThrow('Duplicate condition handler: "kb:available"');
	});

	it("throws on unknown condition handler", () => {
		const reg = new HandlerRegistry();
		expect(() => reg.getCondition("nope")).toThrow('Unknown condition handler: "nope"');
	});

	// ── BeforeRender handlers ───────────────────────────────────────

	it("registers and retrieves a beforeRender handler", () => {
		const reg = new HandlerRegistry();
		const handler = vi.fn();
		reg.registerBeforeRender("project:banner", handler);
		expect(reg.getBeforeRender("project:banner")).toBe(handler);
		expect(reg.hasBeforeRender("project:banner")).toBe(true);
	});

	it("throws on duplicate beforeRender handler", () => {
		const reg = new HandlerRegistry();
		reg.registerBeforeRender("project:banner", vi.fn());
		expect(() => reg.registerBeforeRender("project:banner", vi.fn())).toThrow('Duplicate beforeRender handler: "project:banner"');
	});

	// ── List provider handlers ──────────────────────────────────────

	// ── Form handlers ──────────────────────────────────────────────

	it("registers and retrieves a form handler", () => {
		const reg = new HandlerRegistry();
		const handler = vi.fn();
		reg.registerFormHandler("create-project", handler);
		expect(reg.getFormHandler("create-project")).toBe(handler);
		expect(reg.hasFormHandler("create-project")).toBe(true);
	});

	it("throws on duplicate form handler", () => {
		const reg = new HandlerRegistry();
		reg.registerFormHandler("create-project", vi.fn());
		expect(() => reg.registerFormHandler("create-project", vi.fn())).toThrow('Duplicate form handler: "create-project"');
	});

	it("throws on unknown form handler", () => {
		const reg = new HandlerRegistry();
		expect(() => reg.getFormHandler("nope")).toThrow('Unknown form handler: "nope"');
	});

	it("reports hasFormHandler false for unregistered id", () => {
		const reg = new HandlerRegistry();
		expect(reg.hasFormHandler("missing")).toBe(false);
	});

	// ── Data source handlers ───────────────────────────────────────

	it("registers and retrieves a data source handler", () => {
		const reg = new HandlerRegistry();
		const handler = vi.fn().mockReturnValue([]);
		reg.registerDataSource("project-list", handler);
		expect(reg.getDataSource("project-list")).toBe(handler);
		expect(reg.hasDataSource("project-list")).toBe(true);
	});

	it("throws on duplicate data source handler", () => {
		const reg = new HandlerRegistry();
		reg.registerDataSource("project-list", vi.fn().mockReturnValue([]));
		expect(() => reg.registerDataSource("project-list", vi.fn().mockReturnValue([]))).toThrow('Duplicate data source handler: "project-list"');
	});

	it("throws on unknown data source handler", () => {
		const reg = new HandlerRegistry();
		expect(() => reg.getDataSource("nope")).toThrow('Unknown data source handler: "nope"');
	});

	it("reports hasDataSource false for unregistered id", () => {
		const reg = new HandlerRegistry();
		expect(reg.hasDataSource("missing")).toBe(false);
	});

	// ── Query methods ───────────────────────────────────────────────

	it("reports counts and lists IDs", () => {
		const reg = new HandlerRegistry();
		reg.registerView("v1", vi.fn());
		reg.registerView("v2", vi.fn());
		reg.registerAction("a1", vi.fn());
		reg.registerCondition("c1", () => true);

		expect(reg.viewCount).toBe(2);
		expect(reg.actionCount).toBe(1);
		expect(reg.conditionCount).toBe(1);
		expect(reg.viewIds()).toEqual(["v1", "v2"]);
		expect(reg.actionIds()).toEqual(["a1"]);
		expect(reg.conditionIds()).toEqual(["c1"]);
	});

	it("reports counts and lists IDs for v2 handler types", () => {
		const reg = new HandlerRegistry();
		reg.registerFormHandler("f1", vi.fn());
		reg.registerFormHandler("f2", vi.fn());
		reg.registerDataSource("ds1", vi.fn().mockReturnValue([]));

		expect(reg.formHandlerCount).toBe(2);
		expect(reg.dataSourceCount).toBe(1);
		expect(reg.formHandlerIds()).toEqual(["f1", "f2"]);
		expect(reg.dataSourceIds()).toEqual(["ds1"]);
	});
});
