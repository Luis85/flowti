import { describe, it, expect } from "vitest";
import { validateSitemap, loadSitemap } from "../../src/infrastructure/sitemap-loader.js";
import type { IFileSystem } from "../../src/infrastructure/types.js";

// ── Helpers ─────────────────────────────────────────────────────────

function validPage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		kind: "page",
		label: "Start",
		description: "The start page",
		actions: [
			{ name: "onNavigate", label: "Go", type: "navigate", target: "start", key: "1" },
			{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
		],
		...overrides,
	};
}

function validSitemap(pages: Record<string, unknown> = {}): unknown {
	return {
		version: 2,
		pages: {
			start: validPage(),
			...pages,
		},
	};
}

function stubFs(files: Record<string, string>): IFileSystem {
	return {
		existsSync: (p: string) => p in files,
		readFileSync: (p: string) => {
			if (!(p in files)) throw new Error(`ENOENT: ${p}`);
			return files[p];
		},
		writeFileSync: () => {},
		mkdirSync: () => "",
		readdirSync: () => [],
	} as unknown as IFileSystem;
}

// ── validateSitemap ─────────────────────────────────────────────────

describe("validateSitemap", () => {
	it("accepts a valid sitemap", () => {
		const result = validateSitemap(validSitemap());
		expect(result.ok).toBe(true);
		expect(result.errors).toEqual([]);
		expect(result.warnings).toEqual([]);
		expect(result.sitemap?.version).toBe(2);
		expect(Object.keys(result.sitemap!.pages)).toContain("start");
	});

	it("rejects non-object", () => {
		const result = validateSitemap("not an object");
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toContain("JSON object");
	});

	it("rejects wrong version", () => {
		const result = validateSitemap({
			version: 1,
			pages: { s: validPage() },
		});
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toContain("version");
	});

	it("rejects missing pages", () => {
		const result = validateSitemap({ version: 2 });
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("pages"))).toBe(true);
	});

	it("rejects null input", () => {
		const result = validateSitemap(null);
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toContain("JSON object");
	});

	it("rejects array input", () => {
		const result = validateSitemap([1, 2, 3]);
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toContain("JSON object");
	});

	it("returns warnings field on valid sitemap", () => {
		const result = validateSitemap(validSitemap());
		expect(result).toHaveProperty("warnings");
		expect(Array.isArray(result.warnings)).toBe(true);
	});

	// ── Page identity validation ─────────────────────────────────

	it("rejects page with missing kind", () => {
		const result = validateSitemap({
			version: 2,
			pages: { bad: { label: "Bad", description: "No kind", actions: [] } },
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("kind"))).toBe(true);
	});

	it("rejects page with unknown kind", () => {
		const result = validateSitemap({
			version: 2,
			pages: { bad: { kind: "wizard", label: "Bad", description: "Unknown kind", actions: [] } },
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("unknown kind"))).toBe(true);
	});

	it("rejects page with missing label", () => {
		const result = validateSitemap({
			version: 2,
			pages: { bad: { kind: "page", description: "No label", actions: [] } },
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("label"))).toBe(true);
	});

	it("rejects page with empty label", () => {
		const result = validateSitemap({
			version: 2,
			pages: { bad: { kind: "page", label: "", description: "Empty label", actions: [] } },
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("label"))).toBe(true);
	});

	it("rejects page with missing description", () => {
		const result = validateSitemap({
			version: 2,
			pages: { bad: { kind: "page", label: "Bad", actions: [] } },
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("description"))).toBe(true);
	});

	it("rejects page with missing actions", () => {
		const result = validateSitemap({
			version: 2,
			pages: { bad: { kind: "page", label: "Bad", description: "No actions" } },
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("actions"))).toBe(true);
	});

	it("rejects page with non-array actions", () => {
		const result = validateSitemap({
			version: 2,
			pages: { bad: { kind: "page", label: "Bad", description: "Bad actions", actions: "not-an-array" } },
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("actions"))).toBe(true);
	});

	it("accepts all valid page kinds", () => {
		const kinds = [
			"page", "form", "layout", "dialog", "list",
			"component", "ui-component",
			"system", "container", "c4-component", "person",
		];
		for (const kind of kinds) {
			const page: Record<string, unknown> = {
				kind,
				label: `${kind} page`,
				description: `A ${kind} page`,
				actions: [],
			};
			if (kind === "form") {
				page.fields = [{ name: "f1", label: "Field 1", type: "text" }];
			}
			const result = validateSitemap({
				version: 2,
				pages: { test: page },
			});
			expect(result.ok).toBe(true);
		}
	});

	// ── Action validation ────────────────────────────────────────

	it("rejects action with missing name", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Test",
					actions: [{ label: "Go", type: "navigate", target: "v" }],
				},
			},
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("name"))).toBe(true);
	});

	it("rejects action with missing label", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Test",
					actions: [{ name: "onGo", type: "navigate", target: "v" }],
				},
			},
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("label"))).toBe(true);
	});

	it("rejects action with invalid type", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Test",
					actions: [{ name: "onGo", label: "Go", type: "teleport", target: "v" }],
				},
			},
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("type"))).toBe(true);
	});

	it("accepts all valid action types", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Test",
					actions: [
						{ name: "onNav", label: "Nav", type: "navigate", target: "v", key: "1" },
						{ name: "onHandle", label: "Handle", type: "handler", target: "my:action", key: "2" },
						{ name: "onCmd", label: "Cmd", type: "command", target: "build", key: "3" },
						{ name: "onSignal", label: "Signal", type: "signal", target: "back", key: "4" },
						{ name: "onForm", label: "Form", type: "form", target: "v", key: "5" },
					],
				},
			},
		});
		expect(result.ok).toBe(true);
	});

	it("warns on navigate target to unknown page", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Test",
					actions: [{ name: "onGo", label: "Go", type: "navigate", target: "nowhere" }],
				},
			},
		});
		// navigate to unknown page produces a warning, not an error
		expect(result.warnings.some((w) => w.includes("nowhere"))).toBe(true);
	});

	it("rejects invalid signal target", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Test",
					actions: [{ name: "onBad", label: "Bad", type: "signal", target: "nope" }],
				},
			},
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("signal"))).toBe(true);
	});

	it("warns on duplicate action keys within a page", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Test",
					actions: [
						{ name: "onA", label: "A", type: "signal", target: "quit", key: "1" },
						{ name: "onB", label: "B", type: "signal", target: "back", key: "1" },
					],
				},
			},
		});
		expect(result.warnings.some((w) => w.includes("duplicate key"))).toBe(true);
	});

	it("accepts actions with disabled conditions in all forms", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Test",
					actions: [
						{ name: "onA", label: "A", type: "signal", target: "quit", disabled: true, key: "1" },
						{ name: "onB", label: "B", type: "signal", target: "back", disabled: "my:condition", key: "2" },
						{ name: "onC", label: "C", type: "command", target: "x", disabled: { unless: "tools.esbuild" }, key: "3" },
					],
				},
			},
		});
		expect(result.ok).toBe(true);
	});

	it("accepts actions with hidden conditions", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Test",
					actions: [
						{ name: "onA", label: "A", type: "signal", target: "quit", hidden: true, key: "1" },
						{ name: "onB", label: "B", type: "signal", target: "back", hidden: "my:condition", key: "2" },
					],
				},
			},
		});
		expect(result.ok).toBe(true);
	});

	it("accepts actions with group property", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Test",
					actions: [
						{ name: "onA", label: "A", type: "handler", target: "do:thing", group: "primary", key: "1" },
						{ name: "onB", label: "B", type: "signal", target: "back", group: "nav", key: "2" },
					],
				},
			},
		});
		expect(result.ok).toBe(true);
	});

	it("rejects non-object action entries", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Test",
					actions: ["not-an-object"],
				},
			},
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("object"))).toBe(true);
	});

	// ── Navigation / context validation ─────────────────────────

	it("accepts valid context values", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Test",
					context: ["project"],
					actions: [],
				},
			},
		});
		expect(result.ok).toBe(true);
	});

	it("rejects invalid context values", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Test",
					context: ["user"],
					actions: [],
				},
			},
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("context"))).toBe(true);
	});

	it("warns on parent referencing unknown page", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Test",
					parent: "nonexistent",
					actions: [],
				},
			},
		});
		expect(result.warnings.some((w) => w.includes("parent"))).toBe(true);
	});

	it("accepts valid parent reference", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				parent: validPage(),
				child: validPage({ parent: "parent" }),
			},
		});
		expect(result.ok).toBe(true);
	});

	// ── Form page validation ────────────────────────────────────

	it("rejects form page without fields", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				f: {
					kind: "form", label: "My Form", description: "A form",
					actions: [],
				},
			},
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("fields"))).toBe(true);
	});

	it("accepts form page with fields", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				f: {
					kind: "form", label: "My Form", description: "A form",
					actions: [{ name: "onSubmit", label: "Submit", type: "handler", target: "form:submit" }],
					fields: [
						{ name: "title", label: "Title", type: "text" },
						{ name: "count", label: "Count", type: "number" },
					],
				},
			},
		});
		expect(result.ok).toBe(true);
	});

	it("warns when fields defined on non-form page", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Not a form",
					actions: [],
					fields: [{ name: "f1", label: "F1", type: "text" }],
				},
			},
		});
		expect(result.warnings.some((w) => w.includes("fields"))).toBe(true);
	});

	// ── Children validation ─────────────────────────────────────

	it("accepts page with children references", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				layout: {
					kind: "layout", label: "Main Layout", description: "The main layout",
					actions: [],
					children: [{ ref: "sidebar" }],
				},
				sidebar: validPage({ kind: "component", label: "Sidebar", description: "Side panel" }),
			},
		});
		expect(result.ok).toBe(true);
	});

	it("rejects non-array children", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Bad children",
					actions: [],
					children: "not-an-array",
				},
			},
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("children"))).toBe(true);
	});

	// ── DataSources validation ──────────────────────────────────

	it("accepts page with dataSources", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "With data sources",
					actions: [],
					dataSources: [{ id: "make:templates", slot: "templates" }],
				},
			},
		});
		expect(result.ok).toBe(true);
	});

	it("rejects non-array dataSources", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Bad data sources",
					actions: [],
					dataSources: "not-an-array",
				},
			},
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("dataSources"))).toBe(true);
	});

	// ── Lifecycle hooks ─────────────────────────────────────────

	it("accepts page with lifecycle hooks", () => {
		const result = validateSitemap({
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "With hooks",
					actions: [],
					onBeforeRender: "my:beforeRender",
					onNavigate: "my:navigate",
					onLeave: "my:leave",
				},
			},
		});
		expect(result.ok).toBe(true);
	});

	// ── Page with non-object entry ──────────────────────────────

	it("rejects non-object page entry", () => {
		const result = validateSitemap({
			version: 2,
			pages: { bad: "not-an-object" },
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("object"))).toBe(true);
	});
});

// ── loadSitemap ─────────────────────────────────────────────────────

describe("loadSitemap", () => {
	it("loads a valid sitemap from disk", () => {
		const fs = stubFs({ "/sitemap.json": JSON.stringify(validSitemap()) });
		const result = loadSitemap("/sitemap.json", fs);
		expect(result.ok).toBe(true);
		expect(result.sitemap).toBeDefined();
		expect(result.warnings).toEqual([]);
	});

	it("returns error for missing file", () => {
		const fs = stubFs({});
		const result = loadSitemap("/nope.json", fs);
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toContain("not found");
		expect(result.warnings).toEqual([]);
	});

	it("returns error for invalid JSON", () => {
		const fs = stubFs({ "/sitemap.json": "not json{" });
		const result = loadSitemap("/sitemap.json", fs);
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toContain("parse");
		expect(result.warnings).toEqual([]);
	});

	it("returns validation errors for bad structure", () => {
		const fs = stubFs({ "/sitemap.json": JSON.stringify({ version: 99, pages: {} }) });
		const result = loadSitemap("/sitemap.json", fs);
		expect(result.ok).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});

	it("passes through warnings from validation", () => {
		const sitemap = {
			version: 2,
			pages: {
				v: {
					kind: "page", label: "V", description: "Test",
					parent: "nonexistent",
					actions: [],
				},
			},
		};
		const fs = stubFs({ "/sitemap.json": JSON.stringify(sitemap) });
		const result = loadSitemap("/sitemap.json", fs);
		expect(result.ok).toBe(true);
		expect(result.warnings.length).toBeGreaterThan(0);
	});
});
