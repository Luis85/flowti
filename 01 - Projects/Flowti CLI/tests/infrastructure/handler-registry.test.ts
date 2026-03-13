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
});
