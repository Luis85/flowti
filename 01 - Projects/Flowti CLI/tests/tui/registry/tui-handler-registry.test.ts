vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect, vi } from "vitest";
import { TuiHandlerRegistry } from "../../../src/tui/registry/tui-handler-registry.js";
import type { TuiActionHandler, TuiFormHandler, TuiConditionHandler, TuiDataSourceHandler } from "../../../src/tui/registry/tui-handler-types.js";

describe("TuiHandlerRegistry", () => {
	it("registers and retrieves a handler", () => {
		const reg = new TuiHandlerRegistry();
		const handler: TuiActionHandler = async () => ({ kind: "ok" });
		reg.registerHandler("test:action", handler);
		expect(reg.hasHandler("test:action")).toBe(true);
		expect(reg.getHandler("test:action")).toBe(handler);
	});

	it("throws on duplicate handler registration", () => {
		const reg = new TuiHandlerRegistry();
		const handler: TuiActionHandler = async () => ({ kind: "ok" });
		reg.registerHandler("test:dup", handler);
		expect(() => reg.registerHandler("test:dup", handler)).toThrow();
	});

	it("throws on missing handler lookup", () => {
		const reg = new TuiHandlerRegistry();
		expect(() => reg.getHandler("missing")).toThrow();
	});

	it("registers and retrieves a form handler", () => {
		const reg = new TuiHandlerRegistry();
		const handler: TuiFormHandler = async () => ({ kind: "ok" });
		reg.registerFormHandler("test:form", handler);
		expect(reg.hasFormHandler("test:form")).toBe(true);
		expect(reg.getFormHandler("test:form")).toBe(handler);
	});

	it("registers and retrieves a condition handler", () => {
		const reg = new TuiHandlerRegistry();
		const handler: TuiConditionHandler = () => true;
		reg.registerCondition("test:cond", handler);
		expect(reg.hasCondition("test:cond")).toBe(true);
		expect(reg.getCondition("test:cond")({} as never)).toBe(true);
	});

	it("registers and retrieves a data source handler", () => {
		const reg = new TuiHandlerRegistry();
		const handler: TuiDataSourceHandler = () => [];
		reg.registerDataSource("test:ds", handler);
		expect(reg.hasDataSource("test:ds")).toBe(true);
	});

	it("implements IConditionRegistry", () => {
		const reg = new TuiHandlerRegistry();
		const handler: TuiConditionHandler = () => false;
		reg.registerCondition("cond:test", handler);
		// IConditionRegistry shape: hasCondition + getCondition
		expect(reg.hasCondition("cond:test")).toBe(true);
		expect(typeof reg.getCondition("cond:test")).toBe("function");
	});
});
