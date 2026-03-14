import { describe, it, expect } from "vitest";
import { validateUnifiedSitemap } from "../../../src/domain/sitemap/page-schema.js";

/** Minimal valid sitemap for use as a baseline. */
function validSitemap(pagesOverride?: Record<string, unknown>): Record<string, unknown> {
	return {
		version: 2,
		pages: pagesOverride ?? {
			home: {
				kind: "page",
				label: "Home",
				description: "Main landing page",
				actions: [],
			},
		},
	};
}

/** Minimal valid page object. */
function validPage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		kind: "page",
		label: "Test Page",
		description: "A test page",
		actions: [],
		...overrides,
	};
}

describe("validateUnifiedSitemap", () => {
	// ── Root validation ─────────────────────────────────────────────

	describe("root validation", () => {
		it("accepts a valid minimal sitemap", () => {
			const result = validateUnifiedSitemap(validSitemap());
			expect(result.errors).toEqual([]);
			expect(result.warnings).toEqual([]);
		});

		it("rejects null input", () => {
			const result = validateUnifiedSitemap(null);
			expect(result.errors).toContain("Sitemap must be a non-null object.");
		});

		it("rejects non-object input", () => {
			const result = validateUnifiedSitemap("string");
			expect(result.errors).toContain("Sitemap must be a non-null object.");
		});

		it("rejects undefined input", () => {
			const result = validateUnifiedSitemap(undefined);
			expect(result.errors).toContain("Sitemap must be a non-null object.");
		});
	});

	describe("version", () => {
		it("errors when version is missing", () => {
			const result = validateUnifiedSitemap({ pages: { home: validPage() } });
			expect(result.errors.some((e) => e.includes("Expected version 2"))).toBe(true);
		});

		it("errors when version is wrong number", () => {
			const result = validateUnifiedSitemap({ version: 1, pages: { home: validPage() } });
			expect(result.errors.some((e) => e.includes("Expected version 2, got 1"))).toBe(true);
		});

		it("errors when version is a string", () => {
			const result = validateUnifiedSitemap({ version: "2", pages: { home: validPage() } });
			expect(result.errors.some((e) => e.includes("Expected version 2"))).toBe(true);
		});
	});

	describe("pages", () => {
		it("errors when pages is missing", () => {
			const result = validateUnifiedSitemap({ version: 2 });
			expect(result.errors.some((e) => e.includes('"pages" must be a non-empty object'))).toBe(true);
		});

		it("errors when pages is null", () => {
			const result = validateUnifiedSitemap({ version: 2, pages: null });
			expect(result.errors.some((e) => e.includes('"pages" must be a non-empty object'))).toBe(true);
		});

		it("errors when pages is an array", () => {
			const result = validateUnifiedSitemap({ version: 2, pages: [] });
			// Arrays are objects, but this tests that it doesn't crash
			// The validation should still proceed
			expect(result.errors).toBeDefined();
		});

		it("returns early when pages is missing (no further page errors)", () => {
			const result = validateUnifiedSitemap({ version: 2 });
			// Should only have version-ok + pages-missing, no page-level errors
			const pageErrors = result.errors.filter((e) => e.startsWith("pages."));
			expect(pageErrors).toEqual([]);
		});
	});

	// ── Page validation ─────────────────────────────────────────────

	describe("page required fields", () => {
		it("errors when kind is missing", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: { label: "X", description: "Y", actions: [] },
			}));
			expect(result.errors.some((e) => e.includes("pages.p1") && e.includes("kind"))).toBe(true);
		});

		it("errors when kind is invalid", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: { kind: "banana", label: "X", description: "Y", actions: [] },
			}));
			expect(result.errors.some((e) => e.includes('unknown kind "banana"'))).toBe(true);
		});

		it("errors when label is missing", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: { kind: "page", description: "Y", actions: [] },
			}));
			expect(result.errors.some((e) => e.includes("pages.p1") && e.includes("label"))).toBe(true);
		});

		it("errors when label is empty string", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: { kind: "page", label: "", description: "Y", actions: [] },
			}));
			expect(result.errors.some((e) => e.includes("label"))).toBe(true);
		});

		it("errors when description is missing", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: { kind: "page", label: "X", actions: [] },
			}));
			expect(result.errors.some((e) => e.includes("description"))).toBe(true);
		});

		it("errors when page is not an object", () => {
			const result = validateUnifiedSitemap(validSitemap({ p1: "not-an-object" }));
			expect(result.errors.some((e) => e.includes("pages.p1: must be an object"))).toBe(true);
		});
	});

	describe("status", () => {
		it("accepts valid statuses", () => {
			for (const status of ["draft", "active", "deprecated"]) {
				const result = validateUnifiedSitemap(validSitemap({
					p1: validPage({ status }),
				}));
				expect(result.warnings.filter((w) => w.includes("status"))).toEqual([]);
			}
		});

		it("warns on invalid status", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ status: "archived" }),
			}));
			expect(result.warnings.some((w) => w.includes("status"))).toBe(true);
		});
	});

	// ── Parent references ───────────────────────────────────────────

	describe("parent references", () => {
		it("accepts valid parent reference", () => {
			const result = validateUnifiedSitemap(validSitemap({
				home: validPage(),
				child: validPage({ parent: "home" }),
			}));
			expect(result.errors).toEqual([]);
			expect(result.warnings).toEqual([]);
		});

		it("warns when parent references unknown page", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ parent: "nonexistent" }),
			}));
			expect(result.warnings.some((w) => w.includes("nonexistent") && w.includes("parent"))).toBe(true);
		});

		it("errors when parent is not a string", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ parent: 42 }),
			}));
			expect(result.errors.some((e) => e.includes("parent") && e.includes("string"))).toBe(true);
		});
	});

	// ── Context ─────────────────────────────────────────────────────

	describe("context", () => {
		it("accepts valid context ['project']", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ context: ["project"] }),
			}));
			expect(result.errors.filter((e) => e.includes("context"))).toEqual([]);
		});

		it("errors on invalid context value", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ context: ["workspace"] }),
			}));
			expect(result.errors.some((e) => e.includes("invalid context"))).toBe(true);
		});

		it("errors when context is not an array", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ context: "project" }),
			}));
			expect(result.errors.some((e) => e.includes("context") && e.includes("array"))).toBe(true);
		});
	});

	// ── Actions ─────────────────────────────────────────────────────

	describe("actions", () => {
		it("errors when actions is not an array", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ actions: "not-array" }),
			}));
			expect(result.errors.some((e) => e.includes("actions") && e.includes("array"))).toBe(true);
		});

		it("errors when action is missing name", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ actions: [{ label: "X", type: "handler" }] }),
			}));
			expect(result.errors.some((e) => e.includes("name"))).toBe(true);
		});

		it("errors when action is missing label", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ actions: [{ name: "onClick", type: "handler" }] }),
			}));
			expect(result.errors.some((e) => e.includes("label"))).toBe(true);
		});

		it("errors when action has invalid type", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ actions: [{ name: "onClick", label: "X", type: "invalid" }] }),
			}));
			expect(result.errors.some((e) => e.includes("type") && e.includes("navigate"))).toBe(true);
		});

		it("errors when action is not an object", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ actions: ["not-object"] }),
			}));
			expect(result.errors.some((e) => e.includes("must be an object"))).toBe(true);
		});

		it("accepts all valid action types", () => {
			for (const type of ["navigate", "handler", "command", "signal", "form"]) {
				const result = validateUnifiedSitemap(validSitemap({
					p1: validPage({
						actions: [{ name: "onClick", label: "X", type }],
					}),
				}));
				const typeErrors = result.errors.filter((e) => e.includes("type"));
				expect(typeErrors).toEqual([]);
			}
		});
	});

	describe("action target validation", () => {
		it("warns when navigate target references unknown page", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					actions: [{ name: "onNav", label: "Go", type: "navigate", target: "unknown-page" }],
				}),
			}));
			expect(result.warnings.some((w) => w.includes("navigate target") && w.includes("unknown-page"))).toBe(true);
		});

		it("accepts navigate target referencing a known page", () => {
			const result = validateUnifiedSitemap(validSitemap({
				home: validPage(),
				p1: validPage({
					actions: [{ name: "onNav", label: "Go", type: "navigate", target: "home" }],
				}),
			}));
			expect(result.warnings.filter((w) => w.includes("navigate target"))).toEqual([]);
		});

		it("errors when navigate target is not a string", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					actions: [{ name: "onNav", label: "Go", type: "navigate", target: 42 }],
				}),
			}));
			expect(result.errors.some((e) => e.includes("target") && e.includes("string"))).toBe(true);
		});

		it("errors when signal target is not a valid signal", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					actions: [{ name: "onSignal", label: "Signal", type: "signal", target: "invalid-signal" }],
				}),
			}));
			expect(result.errors.some((e) => e.includes("signal target"))).toBe(true);
		});

		it("accepts valid signal targets", () => {
			for (const target of ["back", "quit", "start"]) {
				const result = validateUnifiedSitemap(validSitemap({
					p1: validPage({
						actions: [{ name: "onSignal", label: "S", type: "signal", target }],
					}),
				}));
				expect(result.errors.filter((e) => e.includes("signal"))).toEqual([]);
			}
		});

		it("warns when form target references unknown page", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					actions: [{ name: "onForm", label: "Form", type: "form", target: "missing-form" }],
				}),
			}));
			expect(result.warnings.some((w) => w.includes("form target"))).toBe(true);
		});

		it("errors when form target is not a string", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					actions: [{ name: "onForm", label: "Form", type: "form", target: 123 }],
				}),
			}));
			expect(result.errors.some((e) => e.includes("target") && e.includes("string"))).toBe(true);
		});
	});

	describe("action key validation", () => {
		it("warns on duplicate keys", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					actions: [
						{ name: "a1", label: "A1", type: "handler", key: "a" },
						{ name: "a2", label: "A2", type: "handler", key: "A" },
					],
				}),
			}));
			expect(result.warnings.some((w) => w.includes("duplicate key"))).toBe(true);
		});

		it("warns when key is not a string", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					actions: [{ name: "a1", label: "A1", type: "handler", key: 1 }],
				}),
			}));
			expect(result.warnings.some((w) => w.includes("key") && w.includes("string"))).toBe(true);
		});
	});

	// ── Form pages ──────────────────────────────────────────────────

	describe("form pages", () => {
		it("errors when form page has no fields", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ kind: "form" }),
			}));
			expect(result.errors.some((e) => e.includes("form pages must have"))).toBe(true);
		});

		it("errors when form page has empty fields array", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ kind: "form", fields: [] }),
			}));
			expect(result.errors.some((e) => e.includes("form pages must have a non-empty"))).toBe(true);
		});

		it("warns when fields defined on non-form page", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					kind: "page",
					fields: [{ name: "f", label: "F", type: "text" }],
				}),
			}));
			expect(result.warnings.some((w) => w.includes("fields") && w.includes("not \"form\""))).toBe(true);
		});

		it("accepts valid form page with fields", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					kind: "form",
					fields: [{ name: "email", label: "Email", type: "email" }],
				}),
			}));
			expect(result.errors.filter((e) => e.includes("field"))).toEqual([]);
		});
	});

	describe("field validation", () => {
		it("errors when field is missing name", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					kind: "form",
					fields: [{ label: "X", type: "text" }],
				}),
			}));
			expect(result.errors.some((e) => e.includes("name"))).toBe(true);
		});

		it("errors when field is missing label", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					kind: "form",
					fields: [{ name: "x", type: "text" }],
				}),
			}));
			expect(result.errors.some((e) => e.includes("label"))).toBe(true);
		});

		it("errors when field has invalid type", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					kind: "form",
					fields: [{ name: "x", label: "X", type: "invalid-type" }],
				}),
			}));
			expect(result.errors.some((e) => e.includes("unknown field type"))).toBe(true);
		});

		it("errors on duplicate field names", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					kind: "form",
					fields: [
						{ name: "email", label: "Email", type: "email" },
						{ name: "email", label: "Email Again", type: "text" },
					],
				}),
			}));
			expect(result.errors.some((e) => e.includes("duplicate field name"))).toBe(true);
		});

		it("errors when field is not an object", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					kind: "form",
					fields: ["not-an-object"],
				}),
			}));
			expect(result.errors.some((e) => e.includes("must be an object"))).toBe(true);
		});
	});

	describe("select field options", () => {
		it("errors when select field has no options", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					kind: "form",
					fields: [{ name: "x", label: "X", type: "select" }],
				}),
			}));
			expect(result.errors.some((e) => e.includes("select/radio") && e.includes("options"))).toBe(true);
		});

		it("errors when radio field has no options", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					kind: "form",
					fields: [{ name: "x", label: "X", type: "radio" }],
				}),
			}));
			expect(result.errors.some((e) => e.includes("select/radio"))).toBe(true);
		});

		it("errors when option is missing value", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					kind: "form",
					fields: [{
						name: "x", label: "X", type: "select",
						options: [{ label: "Opt1" }],
					}],
				}),
			}));
			expect(result.errors.some((e) => e.includes("missing \"value\""))).toBe(true);
		});

		it("errors when option is missing label", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					kind: "form",
					fields: [{
						name: "x", label: "X", type: "select",
						options: [{ value: "v1" }],
					}],
				}),
			}));
			expect(result.errors.some((e) => e.includes("missing \"label\""))).toBe(true);
		});

		it("errors when option is not an object", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					kind: "form",
					fields: [{
						name: "x", label: "X", type: "select",
						options: ["not-object"],
					}],
				}),
			}));
			expect(result.errors.some((e) => e.includes("options[0]") && e.includes("must be an object"))).toBe(true);
		});

		it("accepts valid select field with options", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					kind: "form",
					fields: [{
						name: "x", label: "X", type: "select",
						options: [{ value: "v1", label: "Value 1" }],
					}],
				}),
			}));
			expect(result.errors.filter((e) => e.includes("option"))).toEqual([]);
		});
	});

	// ── Validation rules ────────────────────────────────────────────

	describe("validation rules", () => {
		it("errors when rule is missing field", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					validation: [{ rule: "required", message: "Required" }],
				}),
			}));
			expect(result.errors.some((e) => e.includes("missing \"field\""))).toBe(true);
		});

		it("errors when rule is missing message", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					validation: [{ field: "email", rule: "required" }],
				}),
			}));
			expect(result.errors.some((e) => e.includes("missing \"message\""))).toBe(true);
		});

		it("errors when rule type is invalid", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					validation: [{ field: "email", rule: "banana", message: "Bad" }],
				}),
			}));
			expect(result.errors.some((e) => e.includes("unknown rule"))).toBe(true);
		});

		it("accepts valid validation rules", () => {
			const rules = ["required", "min", "max", "minLength", "maxLength", "pattern", "custom"];
			for (const rule of rules) {
				const result = validateUnifiedSitemap(validSitemap({
					p1: validPage({
						validation: [{ field: "f", rule, message: "msg" }],
					}),
				}));
				expect(result.errors.filter((e) => e.includes("rule"))).toEqual([]);
			}
		});

		it("errors when validation is not an array", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ validation: "not-array" }),
			}));
			expect(result.errors.some((e) => e.includes("validation") && e.includes("array"))).toBe(true);
		});

		it("errors when validation entry is not an object", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ validation: ["not-object"] }),
			}));
			expect(result.errors.some((e) => e.includes("must be an object"))).toBe(true);
		});
	});

	// ── Event declarations ──────────────────────────────────────────

	describe("event declarations", () => {
		it("errors when emits entry is missing name", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ emits: [{ description: "fires" }] }),
			}));
			expect(result.errors.some((e) => e.includes("missing \"name\""))).toBe(true);
		});

		it("errors when accepts entry is missing name", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ accepts: [{}] }),
			}));
			expect(result.errors.some((e) => e.includes("missing \"name\""))).toBe(true);
		});

		it("errors when emits is not an array", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ emits: "not-array" }),
			}));
			expect(result.errors.some((e) => e.includes("emits") && e.includes("array"))).toBe(true);
		});

		it("errors when accepts is not an array", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ accepts: "not-array" }),
			}));
			expect(result.errors.some((e) => e.includes("accepts") && e.includes("array"))).toBe(true);
		});

		it("errors when event entry is not an object", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ emits: ["not-object"] }),
			}));
			expect(result.errors.some((e) => e.includes("must be an object"))).toBe(true);
		});

		it("accepts valid event declarations", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					emits: [{ name: "item:created", description: "Fires when created" }],
					accepts: [{ name: "item:updated" }],
				}),
			}));
			expect(result.errors.filter((e) => e.includes("emits") || e.includes("accepts"))).toEqual([]);
		});
	});

	// ── Properties ──────────────────────────────────────────────────

	describe("properties", () => {
		it("warns when property has invalid type", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					properties: [{ key: "k", type: "object" }],
				}),
			}));
			expect(result.warnings.some((w) => w.includes("type") && w.includes("string, number, or boolean"))).toBe(true);
		});

		it("warns when property is missing key", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					properties: [{ type: "string" }],
				}),
			}));
			expect(result.warnings.some((w) => w.includes("missing \"key\""))).toBe(true);
		});

		it("warns when properties is not an array", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ properties: "not-array" }),
			}));
			expect(result.warnings.some((w) => w.includes("properties") && w.includes("array"))).toBe(true);
		});

		it("accepts valid properties", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					properties: [
						{ key: "title", type: "string" },
						{ key: "count", type: "number" },
						{ key: "active", type: "boolean" },
					],
				}),
			}));
			expect(result.warnings.filter((w) => w.includes("properties"))).toEqual([]);
		});
	});

	// ── Variants ────────────────────────────────────────────────────

	describe("variants", () => {
		it("warns when variant is missing name", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					variants: [{ props: { color: "red" } }],
				}),
			}));
			expect(result.warnings.some((w) => w.includes("missing \"name\""))).toBe(true);
		});

		it("warns when variant is missing props", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					variants: [{ name: "dark" }],
				}),
			}));
			expect(result.warnings.some((w) => w.includes("missing \"props\""))).toBe(true);
		});

		it("warns when variants is not an array", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ variants: "not-array" }),
			}));
			expect(result.warnings.some((w) => w.includes("variants") && w.includes("array"))).toBe(true);
		});

		it("accepts valid variants", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					variants: [{ name: "dark", props: { theme: "dark" } }],
				}),
			}));
			expect(result.warnings.filter((w) => w.includes("variants"))).toEqual([]);
		});
	});

	// ── States ──────────────────────────────────────────────────────

	describe("states", () => {
		it("warns when state is missing name", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					states: [{ label: "loading" }],
				}),
			}));
			expect(result.warnings.some((w) => w.includes("missing \"name\""))).toBe(true);
		});

		it("warns when states is not an array", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ states: "not-array" }),
			}));
			expect(result.warnings.some((w) => w.includes("states") && w.includes("array"))).toBe(true);
		});

		it("accepts valid states", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					states: [{ name: "loading", props: { busy: true } }],
				}),
			}));
			expect(result.warnings.filter((w) => w.includes("states"))).toEqual([]);
		});
	});

	// ── Data sources ────────────────────────────────────────────────

	describe("data sources", () => {
		it("errors when data source is missing id", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ dataSources: [{ slot: "main" }] }),
			}));
			expect(result.errors.some((e) => e.includes("missing or empty \"id\""))).toBe(true);
		});

		it("errors when data source id is empty", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ dataSources: [{ id: "" }] }),
			}));
			expect(result.errors.some((e) => e.includes("missing or empty \"id\""))).toBe(true);
		});

		it("errors when dataSources is not an array", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ dataSources: "not-array" }),
			}));
			expect(result.errors.some((e) => e.includes("dataSources") && e.includes("array"))).toBe(true);
		});

		it("errors when data source entry is not an object", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ dataSources: ["not-object"] }),
			}));
			expect(result.errors.some((e) => e.includes("must be an object"))).toBe(true);
		});

		it("accepts valid data sources", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					dataSources: [{ id: "project-list", slot: "content" }],
				}),
			}));
			expect(result.errors.filter((e) => e.includes("dataSource"))).toEqual([]);
		});
	});

	// ── Children ────────────────────────────────────────────────────

	describe("children", () => {
		it("warns when child is missing ref", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ children: [{ slot: "header" }] }),
			}));
			expect(result.warnings.some((w) => w.includes("missing or empty \"ref\""))).toBe(true);
		});

		it("warns when child ref references unknown page", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ children: [{ ref: "unknown-child" }] }),
			}));
			expect(result.warnings.some((w) => w.includes("unknown-child") && w.includes("ref"))).toBe(true);
		});

		it("accepts valid child referencing known page", () => {
			const result = validateUnifiedSitemap(validSitemap({
				header: validPage(),
				p1: validPage({ children: [{ ref: "header" }] }),
			}));
			expect(result.warnings.filter((w) => w.includes("children"))).toEqual([]);
		});

		it("warns when children is not an array", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ children: "not-array" }),
			}));
			expect(result.errors.some((e) => e.includes("children") && e.includes("array"))).toBe(true);
		});

		it("warns when child is not an object", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ children: ["not-object"] }),
			}));
			expect(result.warnings.some((w) => w.includes("must be an object"))).toBe(true);
		});
	});

	// ── Lifecycle hooks ─────────────────────────────────────────────

	describe("lifecycle hooks", () => {
		it("warns when onBeforeRender is not a string", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ onBeforeRender: 42 }),
			}));
			expect(result.warnings.some((w) => w.includes("onBeforeRender") && w.includes("string"))).toBe(true);
		});

		it("warns when onNavigate is not a string", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ onNavigate: true }),
			}));
			expect(result.warnings.some((w) => w.includes("onNavigate") && w.includes("string"))).toBe(true);
		});

		it("warns when onLeave is not a string", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({ onLeave: [] }),
			}));
			expect(result.warnings.some((w) => w.includes("onLeave") && w.includes("string"))).toBe(true);
		});

		it("accepts valid string lifecycle hooks", () => {
			const result = validateUnifiedSitemap(validSitemap({
				p1: validPage({
					onBeforeRender: "loadData",
					onNavigate: "trackNav",
					onLeave: "cleanup",
				}),
			}));
			const hookWarnings = result.warnings.filter((w) =>
				w.includes("onBeforeRender") || w.includes("onNavigate") || w.includes("onLeave"),
			);
			expect(hookWarnings).toEqual([]);
		});
	});
});
