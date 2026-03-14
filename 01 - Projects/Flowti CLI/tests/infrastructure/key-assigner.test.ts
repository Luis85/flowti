import { describe, it, expect } from "vitest";
import { assignKeys } from "../../src/infrastructure/key-assigner.js";
import type { PageAction } from "../../src/domain/sitemap/unified-page.js";

/** Helper to build a minimal PageAction. */
function action(overrides: Partial<PageAction> = {}): PageAction {
	return {
		name: overrides.name ?? "onClick",
		label: overrides.label ?? "Do something",
		type: overrides.type ?? "handler",
		...overrides,
	};
}

describe("assignKeys", () => {
	describe("explicit keys", () => {
		it("keeps an explicit key unchanged", () => {
			const result = assignKeys([action({ key: "x" })]);
			expect(result).toHaveLength(1);
			expect(result[0].assignedKey).toBe("x");
			expect(result[0].action.key).toBe("x");
		});

		it("lowercases explicit keys", () => {
			const result = assignKeys([action({ key: "X" })]);
			expect(result[0].assignedKey).toBe("x");
		});

		it("preserves multiple explicit keys", () => {
			const result = assignKeys([
				action({ key: "a", name: "a1" }),
				action({ key: "z", name: "a2" }),
			]);
			expect(result.map((r) => r.assignedKey)).toEqual(["a", "z"]);
		});
	});

	describe("auto-assignment from pool", () => {
		it("assigns keys starting from '1' when no explicit keys exist", () => {
			const result = assignKeys([
				action({ name: "a1" }),
				action({ name: "a2" }),
				action({ name: "a3" }),
			]);
			expect(result.map((r) => r.assignedKey)).toEqual(["1", "2", "3"]);
		});

		it("assigns 1-9 first, then a-z", () => {
			const actions = Array.from({ length: 12 }, (_, i) =>
				action({ name: `action-${i}` }),
			);
			const result = assignKeys(actions);
			const keys = result.map((r) => r.assignedKey);
			expect(keys.slice(0, 9)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
			expect(keys[9]).toBe("a");
			expect(keys[10]).toBe("c");
			expect(keys[11]).toBe("d");
		});
	});

	describe("explicit keys skip pool duplicates", () => {
		it("skips pool keys already claimed by explicit keys", () => {
			const result = assignKeys([
				action({ key: "1", name: "explicit" }),
				action({ name: "auto1" }),
				action({ name: "auto2" }),
			]);
			expect(result).toHaveLength(3);
			expect(result[0].assignedKey).toBe("1");
			expect(result[1].assignedKey).toBe("2");
			expect(result[2].assignedKey).toBe("3");
		});

		it("skips multiple explicit keys scattered in the pool", () => {
			const result = assignKeys([
				action({ key: "2", name: "e1" }),
				action({ key: "5", name: "e2" }),
				action({ name: "auto1" }),
				action({ name: "auto2" }),
			]);
			const keys = result.map((r) => r.assignedKey);
			expect(keys).toContain("2");
			expect(keys).toContain("5");
			// auto-assigned should skip 2 and 5
			const autoKeys = result.filter((r) => !r.action.key).map((r) => r.assignedKey);
			expect(autoKeys).not.toContain("2");
			expect(autoKeys).not.toContain("5");
			expect(autoKeys[0]).toBe("1");
			expect(autoKeys[1]).toBe("3");
		});
	});

	describe("hidden actions", () => {
		it("excludes literally hidden actions (hidden: true)", () => {
			const result = assignKeys([
				action({ name: "visible" }),
				action({ name: "hidden-action", hidden: true }),
				action({ name: "also-visible" }),
			]);
			expect(result).toHaveLength(2);
			expect(result.map((r) => r.action.name)).toEqual(["visible", "also-visible"]);
		});

		it("does NOT exclude conditionally hidden actions (hidden: string)", () => {
			const result = assignKeys([
				action({ name: "conditional", hidden: "some-condition" }),
			]);
			expect(result).toHaveLength(1);
			expect(result[0].action.name).toBe("conditional");
			expect(result[0].assignedKey).toBe("1");
		});

		it("treats hidden: false as visible", () => {
			const result = assignKeys([
				action({ name: "visible", hidden: false }),
			]);
			expect(result).toHaveLength(1);
		});
	});

	describe("pool exhaustion", () => {
		it("skips actions beyond pool capacity (>35 actions)", () => {
			// Pool has 9 digits + 24 letters = 33 keys
			const poolSize = 33;
			const actions = Array.from({ length: poolSize + 5 }, (_, i) =>
				action({ name: `action-${i}` }),
			);
			const result = assignKeys(actions);
			expect(result).toHaveLength(poolSize);
		});

		it("all assigned keys are unique even at capacity", () => {
			const poolSize = 33;
			const actions = Array.from({ length: poolSize }, (_, i) =>
				action({ name: `action-${i}` }),
			);
			const result = assignKeys(actions);
			const keys = result.map((r) => r.assignedKey);
			expect(new Set(keys).size).toBe(keys.length);
		});
	});

	describe("empty actions", () => {
		it("returns an empty array for empty input", () => {
			expect(assignKeys([])).toEqual([]);
		});
	});

	describe("mixed explicit and auto-assigned", () => {
		it("explicit actions appear before auto-assigned in result", () => {
			const result = assignKeys([
				action({ key: "z", name: "explicit-z" }),
				action({ name: "auto1" }),
				action({ key: "a", name: "explicit-a" }),
				action({ name: "auto2" }),
			]);
			expect(result).toHaveLength(4);
			// Explicit come first in result (they are pushed in first pass)
			expect(result[0].assignedKey).toBe("z");
			expect(result[1].assignedKey).toBe("a");
			// Then auto-assigned
			expect(result[2].assignedKey).toBe("1");
			expect(result[3].assignedKey).toBe("2");
		});

		it("preserves action references in output", () => {
			const original = action({ name: "test", label: "Test Label" });
			const result = assignKeys([original]);
			expect(result[0].action).toBe(original);
		});

		it("handles all hidden among mixed actions", () => {
			const result = assignKeys([
				action({ key: "a", name: "e1", hidden: true }),
				action({ name: "auto1" }),
				action({ name: "auto2", hidden: true }),
			]);
			expect(result).toHaveLength(1);
			expect(result[0].action.name).toBe("auto1");
			expect(result[0].assignedKey).toBe("1");
		});
	});
});
