import { describe, it, expect } from "vitest";
import { ComponentRegistry } from "../../../src/ui/components/ComponentRegistry";
import { DEFAULT_COMPONENTS } from "../../../src/ui/components/componentManifest";
import type { ComponentMeta } from "../../../src/ui/components/types";

// ── Fixtures ────────────────────────────────────────────────

function makeMeta(overrides: Partial<ComponentMeta> = {}): ComponentMeta {
	return {
		id: "test-component",
		name: "Test Component",
		category: "test",
		description: "A test component.",
		source: "ui/test/TestComponent.ts",
		layouts: ["single"],
		emits: [],
		tags: ["tab"],
		...overrides,
	};
}

// ── Tests ───────────────────────────────────────────────────

describe("ComponentRegistry", () => {
	describe("has", () => {
		it("returns true for registered component", () => {
			const registry = new ComponentRegistry([makeMeta({ id: "alpha" })]);
			expect(registry.has("alpha")).toBe(true);
		});

		it("returns false for unknown component", () => {
			const registry = new ComponentRegistry([makeMeta({ id: "alpha" })]);
			expect(registry.has("unknown")).toBe(false);
		});
	});

	describe("get", () => {
		it("returns metadata for registered component", () => {
			const meta = makeMeta({ id: "beta", name: "Beta" });
			const registry = new ComponentRegistry([meta]);
			const result = registry.get("beta");
			expect(result).not.toBeNull();
			expect(result!.name).toBe("Beta");
			expect(result!.category).toBe("test");
		});

		it("returns null for unknown component", () => {
			const registry = new ComponentRegistry([makeMeta()]);
			expect(registry.get("nonexistent")).toBeNull();
		});
	});

	describe("getAll", () => {
		it("returns all registered components", () => {
			const registry = new ComponentRegistry([
				makeMeta({ id: "a" }),
				makeMeta({ id: "b" }),
				makeMeta({ id: "c" }),
			]);
			expect(registry.getAll()).toHaveLength(3);
		});

		it("returns empty array for empty registry", () => {
			const registry = new ComponentRegistry([]);
			expect(registry.getAll()).toEqual([]);
		});
	});

	describe("getByCategory", () => {
		it("filters components by category", () => {
			const registry = new ComponentRegistry([
				makeMeta({ id: "a", category: "event-catalog" }),
				makeMeta({ id: "b", category: "analytics" }),
				makeMeta({ id: "c", category: "event-catalog" }),
				makeMeta({ id: "d", category: "user" }),
			]);
			const catalog = registry.getByCategory("event-catalog");
			expect(catalog).toHaveLength(2);
			expect(catalog.map((c) => c.id)).toEqual(["a", "c"]);
		});

		it("returns empty for unknown category", () => {
			const registry = new ComponentRegistry([makeMeta({ category: "user" })]);
			expect(registry.getByCategory("nonexistent")).toEqual([]);
		});
	});

	describe("getNameSet", () => {
		it("returns set of all component IDs", () => {
			const registry = new ComponentRegistry([
				makeMeta({ id: "x" }),
				makeMeta({ id: "y" }),
			]);
			const names = registry.getNameSet();
			expect(names.has("x")).toBe(true);
			expect(names.has("y")).toBe(true);
			expect(names.size).toBe(2);
		});
	});

	describe("validate", () => {
		it("returns empty array for valid entry", () => {
			const issues = new ComponentRegistry([]).validate(makeMeta());
			expect(issues).toEqual([]);
		});

		it("reports missing id", () => {
			const issues = new ComponentRegistry([]).validate({ ...makeMeta(), id: "" });
			expect(issues).toContain("Missing or invalid 'id'");
		});

		it("reports missing name", () => {
			const issues = new ComponentRegistry([]).validate({ ...makeMeta(), name: "" });
			expect(issues).toContain("Missing or invalid 'name'");
		});

		it("reports missing category", () => {
			const issues = new ComponentRegistry([]).validate({ ...makeMeta(), category: "" });
			expect(issues).toContain("Missing or invalid 'category'");
		});

		it("reports missing source", () => {
			const issues = new ComponentRegistry([]).validate({ ...makeMeta(), source: "" });
			expect(issues).toContain("Missing or invalid 'source'");
		});

		it("reports missing layouts", () => {
			const entry = { ...makeMeta() } as Record<string, unknown>;
			delete entry.layouts;
			const issues = new ComponentRegistry([]).validate(entry as Partial<ComponentMeta>);
			expect(issues).toContain("Missing or invalid 'layouts'");
		});

		it("reports multiple issues at once", () => {
			const issues = new ComponentRegistry([]).validate({});
			expect(issues.length).toBeGreaterThanOrEqual(4);
		});
	});

	describe("default manifest", () => {
		it("loads DEFAULT_COMPONENTS when no entries provided", () => {
			const registry = new ComponentRegistry();
			expect(registry.getAll().length).toBe(DEFAULT_COMPONENTS.length);
		});

		it("default manifest has at least 10 components", () => {
			expect(DEFAULT_COMPONENTS.length).toBeGreaterThanOrEqual(10);
		});

		it("all default entries pass validation", () => {
			const registry = new ComponentRegistry();
			for (const entry of registry.getAll()) {
				const issues = registry.validate(entry);
				expect(issues).toEqual([]);
			}
		});

		it("default entries have unique IDs", () => {
			const ids = DEFAULT_COMPONENTS.map((c) => c.id);
			expect(new Set(ids).size).toBe(ids.length);
		});
	});

	describe("edge cases", () => {
		it("duplicate IDs: last entry wins", () => {
			const registry = new ComponentRegistry([
				makeMeta({ id: "dup", name: "First" }),
				makeMeta({ id: "dup", name: "Second" }),
			]);
			expect(registry.get("dup")!.name).toBe("Second");
			expect(registry.getAll()).toHaveLength(1);
		});

		it("empty manifest works", () => {
			const registry = new ComponentRegistry([]);
			expect(registry.has("any")).toBe(false);
			expect(registry.getAll()).toEqual([]);
			expect(registry.getNameSet().size).toBe(0);
		});
	});
});
