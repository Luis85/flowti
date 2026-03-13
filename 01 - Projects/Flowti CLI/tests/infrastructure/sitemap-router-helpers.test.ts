import { describe, it, expect } from "vitest";
import { parseNavigateResult, navigateWithParams } from "../../src/infrastructure/sitemap-router.js";

describe("parseNavigateResult", () => {
	it("parses simple navigate string", () => {
		const entry = parseNavigateResult("navigate:settings");
		expect(entry).toEqual({ viewId: "settings" });
	});

	it("parses navigate string with JSON params", () => {
		const entry = parseNavigateResult('navigate:detail?{"id":"btn-1","mode":"edit"}');
		expect(entry).toEqual({ viewId: "detail", params: { id: "btn-1", mode: "edit" } });
	});

	it("falls back to viewId only on invalid JSON", () => {
		const entry = parseNavigateResult("navigate:detail?not-json");
		expect(entry).toEqual({ viewId: "detail" });
	});

	it("handles empty params object", () => {
		const entry = parseNavigateResult("navigate:detail?{}");
		expect(entry).toEqual({ viewId: "detail", params: {} });
	});
});

describe("navigateWithParams", () => {
	it("builds simple navigate string without params", () => {
		expect(navigateWithParams("settings")).toBe("navigate:settings");
	});

	it("builds navigate string with undefined params", () => {
		expect(navigateWithParams("settings", undefined)).toBe("navigate:settings");
	});

	it("builds navigate string with params", () => {
		const result = navigateWithParams("detail", { id: "btn-1" });
		expect(result).toBe('navigate:detail?{"id":"btn-1"}');
	});

	it("round-trips through parseNavigateResult", () => {
		const nav = navigateWithParams("detail", { id: "abc", count: 42 });
		const parsed = parseNavigateResult(nav);
		expect(parsed.viewId).toBe("detail");
		expect(parsed.params).toEqual({ id: "abc", count: 42 });
	});
});
