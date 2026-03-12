import { describe, it, expect } from "vitest";
import {
	ACTION_REFERENCE,
	getAllActionNames,
	searchActions,
	findActions,
} from "../../../../src/domain/make/component/action-reference.js";

describe("ACTION_REFERENCE", () => {
	it("has at least 10 categories", () => {
		expect(ACTION_REFERENCE.length).toBeGreaterThanOrEqual(10);
	});

	it("every category has a name and at least one action", () => {
		for (const cat of ACTION_REFERENCE) {
			expect(cat.category).toBeTruthy();
			expect(cat.actions.length).toBeGreaterThan(0);
		}
	});

	it("every action has a name and description", () => {
		for (const cat of ACTION_REFERENCE) {
			for (const a of cat.actions) {
				expect(a.name).toBeTruthy();
				expect(a.description).toBeTruthy();
			}
		}
	});

	it("contains no duplicate action names", () => {
		const names = getAllActionNames();
		const unique = new Set(names);
		expect(unique.size).toBe(names.length);
	});
});

describe("getAllActionNames", () => {
	it("returns flat list of all names", () => {
		const names = getAllActionNames();
		expect(names.length).toBeGreaterThan(50);
		expect(names).toContain("onClick");
		expect(names).toContain("onSubmit");
		expect(names).toContain("onMount");
	});
});

describe("searchActions", () => {
	it("returns matching categories for 'click'", () => {
		const results = searchActions("click");
		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(results[0].actions.some((a) => a.name === "onClick")).toBe(true);
	});

	it("returns empty array for unknown term", () => {
		expect(searchActions("xyznonexistent")).toEqual([]);
	});

	it("matches description text", () => {
		const results = searchActions("dragged");
		expect(results.length).toBeGreaterThanOrEqual(1);
	});

	it("is case-insensitive", () => {
		const results = searchActions("CLICK");
		expect(results.length).toBeGreaterThanOrEqual(1);
	});
});

describe("findActions", () => {
	it("returns flat list of matching actions", () => {
		const results = findActions("focus");
		expect(results.length).toBeGreaterThanOrEqual(2);
		expect(results.some((a) => a.name === "onFocus")).toBe(true);
	});

	it("returns empty array for unknown term", () => {
		expect(findActions("xyznonexistent")).toEqual([]);
	});
});
