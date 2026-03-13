import { describe, it, expect } from "vitest";
import { validateSitemap, loadSitemap } from "../../src/infrastructure/sitemap-loader.js";
import type { IFileSystem } from "../../src/infrastructure/types.js";

// ── Helpers ─────────────────────────────────────────────────────────

function validSitemap(views: Record<string, unknown> = {}): unknown {
	return {
		version: 1,
		views: {
			start: {
				title: "Start",
				items: [
					{ key: "1", label: "Go", navigate: "start" },
					{ separator: true },
					{ key: "q", label: "Quit", signal: "quit" },
				],
			},
			...views,
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
	} as IFileSystem;
}

// ── validateSitemap ─────────────────────────────────────────────────

describe("validateSitemap", () => {
	it("accepts a valid sitemap", () => {
		const result = validateSitemap(validSitemap());
		expect(result.ok).toBe(true);
		expect(result.errors).toEqual([]);
		expect(result.sitemap?.version).toBe(1);
		expect(Object.keys(result.sitemap!.views)).toContain("start");
	});

	it("rejects non-object", () => {
		const result = validateSitemap("not an object");
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toContain("JSON object");
	});

	it("rejects wrong version", () => {
		const result = validateSitemap({ version: 2, views: { s: { title: "S", items: [{ key: "q", label: "Q", signal: "quit" }] } } });
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toContain("version");
	});

	it("rejects missing views", () => {
		const result = validateSitemap({ version: 1 });
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toContain("views");
	});

	it("rejects empty views", () => {
		const result = validateSitemap({ version: 1, views: {} });
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toContain("at least one view");
	});

	// ── View validation ───────────────────────────────────────────

	it("rejects view with missing title", () => {
		const result = validateSitemap({
			version: 1,
			views: { bad: { items: [{ key: "q", label: "Q", signal: "quit" }] } },
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("title"))).toBe(true);
	});

	it("rejects unknown view type", () => {
		const result = validateSitemap({
			version: 1,
			views: { bad: { type: "wizard", title: "Bad", items: [] } },
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("unknown type"))).toBe(true);
	});

	it("accepts dynamic view with handler", () => {
		const result = validateSitemap({
			version: 1,
			views: { comp: { type: "dynamic", title: "Components", handler: "component-list" } },
		});
		expect(result.ok).toBe(true);
	});

	it("rejects dynamic view without handler", () => {
		const result = validateSitemap({
			version: 1,
			views: { comp: { type: "dynamic", title: "Components" } },
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("handler"))).toBe(true);
	});

	it("rejects unknown context value", () => {
		const result = validateSitemap({
			version: 1,
			views: { v: { title: "V", context: ["user"], items: [{ key: "q", label: "Q", signal: "quit" }] } },
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("unknown context"))).toBe(true);
	});

	// ── Item validation ─────────────────────────────────────────────

	it("rejects item with no action", () => {
		const result = validateSitemap({
			version: 1,
			views: { v: { title: "V", items: [{ key: "1", label: "No action" }] } },
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("exactly one action"))).toBe(true);
	});

	it("rejects item with multiple actions", () => {
		const result = validateSitemap({
			version: 1,
			views: { v: { title: "V", items: [{ key: "1", label: "Multi", navigate: "v", command: "build" }] } },
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("multiple actions"))).toBe(true);
	});

	it("rejects navigate to unknown view", () => {
		const result = validateSitemap({
			version: 1,
			views: { v: { title: "V", items: [{ key: "1", label: "Go", navigate: "nowhere" }] } },
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("unknown view"))).toBe(true);
	});

	it("rejects invalid signal value", () => {
		const result = validateSitemap({
			version: 1,
			views: { v: { title: "V", items: [{ key: "1", label: "Bad", signal: "nope" }] } },
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes('"signal" must be'))).toBe(true);
	});

	it("rejects duplicate keys within a view", () => {
		const result = validateSitemap({
			version: 1,
			views: {
				v: {
					title: "V",
					items: [
						{ key: "1", label: "A", signal: "quit" },
						{ key: "1", label: "B", signal: "back" },
					],
				},
			},
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes('duplicate key "1"'))).toBe(true);
	});

	it("accepts all action types", () => {
		const result = validateSitemap({
			version: 1,
			views: {
				v: {
					title: "V",
					items: [
						{ key: "1", label: "Nav", navigate: "v" },
						{ key: "2", label: "Cmd", command: "build" },
						{ key: "3", label: "Handler", handler: "my:action" },
						{ key: "4", label: "Signal", signal: "back" },
						{ separator: true },
					],
				},
			},
		});
		expect(result.ok).toBe(true);
	});

	it("accepts disabled conditions in all forms", () => {
		const result = validateSitemap({
			version: 1,
			views: {
				v: {
					title: "V",
					items: [
						{ key: "1", label: "A", signal: "quit", disabled: true },
						{ key: "2", label: "B", signal: "back", disabled: "my:condition" },
						{ key: "3", label: "C", command: "x", disabled: { unless: "tools.esbuild" } },
					],
				},
			},
		});
		expect(result.ok).toBe(true);
	});

	// ── Dynamic view with items (hybrid) ────────────────────────────

	it("accepts dynamic view with items (hybrid mode)", () => {
		const result = validateSitemap({
			version: 1,
			views: {
				comp: {
					type: "dynamic",
					title: "Components",
					handler: "components",
					items: [
						{ slot: "component-list" },
						{ separator: true },
						{ key: "c", label: "Add", handler: "comp:add" },
						{ key: "b", label: "Back", signal: "back" },
					],
				},
			},
		});
		expect(result.ok).toBe(true);
	});

	it("validates items on dynamic views", () => {
		const result = validateSitemap({
			version: 1,
			views: {
				comp: {
					type: "dynamic",
					title: "Components",
					handler: "components",
					items: [
						{ key: "1", label: "A" },  // missing action
					],
				},
			},
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("exactly one action"))).toBe(true);
	});

	it("rejects dynamic view with non-array items", () => {
		const result = validateSitemap({
			version: 1,
			views: {
				comp: {
					type: "dynamic",
					title: "Components",
					handler: "components",
					items: "not-an-array",
				},
			},
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("array"))).toBe(true);
	});

	it("accepts slot entries in items", () => {
		const result = validateSitemap({
			version: 1,
			views: {
				v: {
					title: "V",
					items: [
						{ slot: "dynamic-content" },
						{ key: "b", label: "Back", signal: "back" },
					],
				},
			},
		});
		expect(result.ok).toBe(true);
	});

	it("rejects empty slot name", () => {
		const result = validateSitemap({
			version: 1,
			views: {
				v: {
					title: "V",
					items: [
						{ slot: "" },
						{ key: "b", label: "Back", signal: "back" },
					],
				},
			},
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("slot"))).toBe(true);
	});
});

// ── loadSitemap ─────────────────────────────────────────────────────

describe("loadSitemap", () => {
	it("loads a valid sitemap from disk", () => {
		const fs = stubFs({ "/sitemap.json": JSON.stringify(validSitemap()) });
		const result = loadSitemap("/sitemap.json", fs);
		expect(result.ok).toBe(true);
		expect(result.sitemap).toBeDefined();
	});

	it("returns error for missing file", () => {
		const fs = stubFs({});
		const result = loadSitemap("/nope.json", fs);
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toContain("not found");
	});

	it("returns error for invalid JSON", () => {
		const fs = stubFs({ "/sitemap.json": "not json{" });
		const result = loadSitemap("/sitemap.json", fs);
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toContain("parse");
	});

	it("returns validation errors for bad structure", () => {
		const fs = stubFs({ "/sitemap.json": JSON.stringify({ version: 99, views: {} }) });
		const result = loadSitemap("/sitemap.json", fs);
		expect(result.ok).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});
});
