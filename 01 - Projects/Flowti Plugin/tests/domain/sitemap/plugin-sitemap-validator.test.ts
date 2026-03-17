import { describe, it, expect } from "vitest";
import { validatePluginSitemap } from "../../../src/domain/sitemap/plugin-sitemap-validator";
import type { PluginSitemap } from "../../../src/domain/sitemap/plugin-sitemap-types";

function validSitemap(overrides?: Partial<PluginSitemap>): PluginSitemap {
	return {
		version: 2,
		views: {
			"test-hub": {
				kind: "hub",
				label: "Test Hub",
				icon: "home",
				type: "flowti-test-hub",
			},
		},
		commands: [
			{ id: "flowti:test", name: "Test", handler: "test:action" },
		],
		ribbon: [
			{ icon: "home", label: "Test", action: "view:flowti-test-hub" },
		],
		...overrides,
	};
}

describe("validatePluginSitemap", () => {
	describe("valid sitemaps", () => {
		it("accepts a valid sitemap", () => {
			const result = validatePluginSitemap(validSitemap());
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("accepts sitemap with tabs", () => {
			const sitemap = validSitemap({
				views: {
					"hub": {
						kind: "hub", label: "Hub", icon: "home", type: "flowti-hub",
						tabs: [
							{ id: "tab1", label: "Tab 1", icon: "star", handler: "hub:tab1" },
							{ id: "tab2", label: "Tab 2", icon: "zap", component: "flowti-widget" },
						],
					},
				},
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(true);
		});

		it("accepts sitemap with modals", () => {
			const sitemap = validSitemap({
				modals: {
					"capture": {
						kind: "form",
						label: "Capture",
						fields: [
							{ id: "title", type: "text", placeholder: "Title" },
							{ id: "kind", type: "select", options: ["idea", "task"] },
						],
						submit: "capture:create",
					},
				},
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(true);
		});

		it("accepts sitemap with conditions on commands", () => {
			const sitemap = validSitemap({
				commands: [
					{ id: "flowti:x", name: "X", handler: "x:run", conditions: { hidden: "no-train" } },
				],
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(true);
		});
	});

	describe("version", () => {
		it("rejects missing version", () => {
			const sitemap = { views: {}, commands: [], ribbon: [] };
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(expect.objectContaining({
				path: "version",
				severity: "error",
			}));
		});

		it("rejects wrong version", () => {
			const result = validatePluginSitemap({ ...validSitemap(), version: 1 as unknown as 2 });
			expect(result.valid).toBe(false);
		});
	});

	describe("views", () => {
		it("rejects view without type", () => {
			const sitemap = validSitemap({
				views: { "bad": { kind: "hub", label: "Bad", icon: "x", type: "" } },
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
			expect(result.errors[0].path).toContain("views.bad");
		});

		it("rejects view with invalid kind", () => {
			const sitemap = validSitemap({
				views: { "bad": { kind: "widget" as "hub", label: "Bad", icon: "x", type: "t" } },
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
		});

		it("rejects duplicate tab IDs within a view", () => {
			const sitemap = validSitemap({
				views: {
					"hub": {
						kind: "hub", label: "Hub", icon: "h", type: "t",
						tabs: [
							{ id: "dup", label: "A", icon: "a", handler: "a" },
							{ id: "dup", label: "B", icon: "b", handler: "b" },
						],
					},
				},
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
			expect(result.errors[0].message).toContain("duplicate");
		});

		it("warns when tab has neither handler nor component", () => {
			const sitemap = validSitemap({
				views: {
					"hub": {
						kind: "hub", label: "Hub", icon: "h", type: "t",
						tabs: [{ id: "empty", label: "Empty", icon: "e" }],
					},
				},
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(true);
			expect(result.errors).toContainEqual(expect.objectContaining({
				severity: "warning",
			}));
		});
	});

	describe("commands", () => {
		it("rejects command without handler", () => {
			const sitemap = validSitemap({
				commands: [{ id: "flowti:bad", name: "Bad", handler: "" }],
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
		});

		it("rejects duplicate command IDs", () => {
			const sitemap = validSitemap({
				commands: [
					{ id: "flowti:dup", name: "A", handler: "a" },
					{ id: "flowti:dup", name: "B", handler: "b" },
				],
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
		});
	});

	describe("ribbon", () => {
		it("rejects ribbon without action", () => {
			const sitemap = validSitemap({
				ribbon: [{ icon: "star", label: "Bad", action: "" }],
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
		});
	});

	describe("modals", () => {
		it("rejects modal with invalid kind", () => {
			const sitemap = validSitemap({
				modals: { "bad": { kind: "popup" as "form", label: "Bad" } },
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
		});

		it("rejects form field without id", () => {
			const sitemap = validSitemap({
				modals: {
					"form": {
						kind: "form", label: "Form",
						fields: [{ id: "", type: "text" }],
					},
				},
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
		});

		it("rejects field with invalid type", () => {
			const sitemap = validSitemap({
				modals: {
					"form": {
						kind: "form", label: "Form",
						fields: [{ id: "x", type: "color" as "text" }],
					},
				},
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
		});

		it("warns when select field has no options", () => {
			const sitemap = validSitemap({
				modals: {
					"form": {
						kind: "form", label: "Form",
						fields: [{ id: "x", type: "select" }],
					},
				},
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(true);
			expect(result.errors).toContainEqual(expect.objectContaining({
				severity: "warning",
			}));
		});
	});

	describe("non-object input", () => {
		it("rejects null", () => {
			const result = validatePluginSitemap(null);
			expect(result.valid).toBe(false);
		});

		it("rejects string", () => {
			const result = validatePluginSitemap("not a sitemap");
			expect(result.valid).toBe(false);
		});
	});
});
