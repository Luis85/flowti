# Canvas-to-Sitemap Import — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import an Obsidian `sitemap.canvas` into `configs/sitemap.json` with additive merge and change detection.

**Architecture:** Pure domain function parses canvas JSON → sitemap pages using color/shape mapping. CLI command wraps it with disk I/O. Plugin detects canvas changes via content hash and surfaces merge prompts. Scaffold modal gains canvas-aware state.

**Tech Stack:** TypeScript, Vitest, Obsidian Canvas JSON format, CLI command engine

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-19-canvas-sitemap-import-design.md`

---

## Chunk 1: Pure Domain — Canvas Parser + Types

### Task 1: Create canvas-sitemap types

**Files:**
- Create: `01 - Projects/Flowti CLI/src/domain/make/canvas-sitemap-types.ts`

- [ ] **Step 1: Create the types file**

```typescript
/**
 * canvas-sitemap-types.ts — Types for canvas-to-sitemap import.
 */

import type { PageKind } from "../sitemap/unified-page.js";

export interface CanvasNode {
	readonly id: string;
	readonly type: "text" | "group" | "file" | "link";
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly text?: string;
	readonly label?: string;
	readonly color?: string;
	readonly shape?: string;
}

export interface CanvasEdge {
	readonly id: string;
	readonly fromNode: string;
	readonly toNode: string;
	readonly fromSide?: string;
	readonly toSide?: string;
	readonly label?: string;
}

export interface CanvasData {
	readonly nodes: readonly CanvasNode[];
	readonly edges: readonly CanvasEdge[];
}

export interface CanvasImportResult {
	readonly added: number;
	readonly updated: number;
	readonly totalPages: number;
}

/** Color (1-6) → PageKind mapping */
export const COLOR_TO_KIND: Record<string, PageKind> = {
	"1": "dialog",
	"2": "form",
	"3": "list",
	"4": "page",
	"5": "layout",
	"6": "system",
};

/** Shape → PageKind mapping */
export const SHAPE_TO_KIND: Record<string, PageKind> = {
	"diamond": "ui-component",
	"circle": "person",
	"document": "c4-component",
};

/** Default kind when no color or shape is set */
export const DEFAULT_KIND: PageKind = "component";

/** Group nodes always become containers */
export const GROUP_KIND: PageKind = "container";
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/canvas-sitemap-types.ts"
git commit -m "feat(cli): add canvas-sitemap import types with color/shape mapping"
```

---

### Task 2: Create canvas-sitemap-import domain function (TDD)

**Files:**
- Create: `01 - Projects/Flowti CLI/src/domain/make/canvas-sitemap-import.ts`
- Create: `01 - Projects/Flowti CLI/tests/domain/make/canvas-sitemap-import.test.ts`

- [ ] **Step 1: Write tests first**

```typescript
/**
 * canvas-sitemap-import.test.ts — Tests for canvas → sitemap conversion.
 */
import { describe, it, expect } from "vitest";
import { parseCanvasToSitemap } from "../../../src/domain/make/canvas-sitemap-import.js";
import type { CanvasData } from "../../../src/domain/make/canvas-sitemap-types.js";

const group = (id: string, label: string, x: number, y: number, w: number, h: number): CanvasData["nodes"][number] =>
	({ id, type: "group", label, x, y, width: w, height: h });

const text = (id: string, t: string, x: number, y: number, opts: Record<string, string> = {}): CanvasData["nodes"][number] =>
	({ id, type: "text", text: t, x, y, width: 200, height: 100, ...opts });

const edge = (from: string, to: string): CanvasData["edges"][number] =>
	({ id: `${from}-${to}`, fromNode: from, toNode: to });

describe("parseCanvasToSitemap", () => {
	it("converts a text node to a component page (default kind)", () => {
		const canvas: CanvasData = { nodes: [text("n1", "Header")], edges: [] };
		const { sitemap } = parseCanvasToSitemap(canvas);
		expect(sitemap.version).toBe(2);
		expect(sitemap.pages["header"]).toBeDefined();
		expect(sitemap.pages["header"].kind).toBe("component");
		expect(sitemap.pages["header"].label).toBe("Header");
	});

	it("maps color to page kind", () => {
		const canvas: CanvasData = {
			nodes: [
				text("n1", "Login", 0, 0, { color: "1" }),
				text("n2", "Settings Form", 0, 100, { color: "2" }),
				text("n3", "Items", 0, 200, { color: "3" }),
				text("n4", "Dashboard", 0, 300, { color: "4" }),
				text("n5", "Main Layout", 0, 400, { color: "5" }),
				text("n6", "Auth Service", 0, 500, { color: "6" }),
			],
			edges: [],
		};
		const { sitemap } = parseCanvasToSitemap(canvas);
		expect(sitemap.pages["login"].kind).toBe("dialog");
		expect(sitemap.pages["settings-form"].kind).toBe("form");
		expect(sitemap.pages["items"].kind).toBe("list");
		expect(sitemap.pages["dashboard"].kind).toBe("page");
		expect(sitemap.pages["main-layout"].kind).toBe("layout");
		expect(sitemap.pages["auth-service"].kind).toBe("system");
	});

	it("maps shape to page kind (overrides color)", () => {
		const canvas: CanvasData = {
			nodes: [text("n1", "Decision", 0, 0, { shape: "diamond" })],
			edges: [],
		};
		const { sitemap } = parseCanvasToSitemap(canvas);
		expect(sitemap.pages["decision"].kind).toBe("ui-component");
	});

	it("converts group nodes to container pages", () => {
		const canvas: CanvasData = {
			nodes: [group("g1", "Navigation", 0, 0, 600, 400)],
			edges: [],
		};
		const { sitemap } = parseCanvasToSitemap(canvas);
		expect(sitemap.pages["navigation"].kind).toBe("container");
	});

	it("assigns parent when text node is inside a group", () => {
		const canvas: CanvasData = {
			nodes: [
				group("g1", "Navigation", 0, 0, 600, 400),
				text("n1", "Home", 50, 50),
			],
			edges: [],
		};
		const { sitemap } = parseCanvasToSitemap(canvas);
		expect(sitemap.pages["home"].parent).toBe("navigation");
	});

	it("creates navigate actions from edges", () => {
		const canvas: CanvasData = {
			nodes: [text("n1", "Home", 0, 0), text("n2", "Dashboard", 300, 0)],
			edges: [edge("n1", "n2")],
		};
		const { sitemap } = parseCanvasToSitemap(canvas);
		const homeActions = sitemap.pages["home"].actions;
		expect(homeActions).toHaveLength(1);
		expect(homeActions[0].type).toBe("navigate");
		expect(homeActions[0].target).toBe("dashboard");
	});

	it("performs additive merge — preserves existing actions", () => {
		const canvas: CanvasData = {
			nodes: [text("n1", "Home", 0, 0), text("n2", "New Page", 300, 0)],
			edges: [],
		};
		const existing = {
			version: 2 as const,
			pages: {
				"home": {
					kind: "page" as const,
					label: "Old Home",
					description: "existing",
					actions: [{ name: "onFoo", label: "Foo", type: "handler" as const, target: "foo:bar" }],
					dataSources: [{ id: "my-source" }],
				},
			},
		};
		const { sitemap, added, updated } = parseCanvasToSitemap(canvas, existing);
		// Home: label+kind updated from canvas, actions preserved
		expect(sitemap.pages["home"].label).toBe("Home");
		expect(sitemap.pages["home"].kind).toBe("component");
		expect(sitemap.pages["home"].actions).toHaveLength(1);
		expect(sitemap.pages["home"].actions[0].target).toBe("foo:bar");
		expect((sitemap.pages["home"] as Record<string, unknown>).dataSources).toBeDefined();
		// New page added
		expect(sitemap.pages["new-page"]).toBeDefined();
		expect(added).toBe(1);
		expect(updated).toBe(1);
	});

	it("merge preserves pages removed from canvas", () => {
		const canvas: CanvasData = { nodes: [text("n1", "Home", 0, 0)], edges: [] };
		const existing = {
			version: 2 as const,
			pages: {
				"home": { kind: "page" as const, label: "Home", description: "", actions: [] },
				"old-page": { kind: "page" as const, label: "Old", description: "", actions: [] },
			},
		};
		const { sitemap } = parseCanvasToSitemap(canvas, existing);
		expect(sitemap.pages["old-page"]).toBeDefined();
	});

	it("returns correct stats for fresh import", () => {
		const canvas: CanvasData = {
			nodes: [text("n1", "A", 0, 0), text("n2", "B", 300, 0)],
			edges: [],
		};
		const { added, updated, totalPages } = parseCanvasToSitemap(canvas);
		expect(added).toBe(2);
		expect(updated).toBe(0);
		expect(totalPages).toBe(2);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/canvas-sitemap-import.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the domain function**

Create `01 - Projects/Flowti CLI/src/domain/make/canvas-sitemap-import.ts`:

```typescript
/**
 * canvas-sitemap-import.ts — Pure domain: parse Obsidian canvas → v2 sitemap.
 *
 * Converts canvas nodes to PageObjects using color/shape mapping.
 * Groups become containers. Edges become navigate actions.
 * Supports additive merge with existing sitemaps.
 */

import type { UnifiedSitemap, PageObject, PageAction } from "../sitemap/unified-page.js";
import type { CanvasData, CanvasNode, CanvasImportResult } from "./canvas-sitemap-types.js";
import { COLOR_TO_KIND, SHAPE_TO_KIND, DEFAULT_KIND, GROUP_KIND } from "./canvas-sitemap-types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function toKebab(s: string): string {
	return s
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.toLowerCase()
		.replace(/^-+|-+$/g, "");
}

function nodeLabel(node: CanvasNode): string {
	return (node.type === "group" ? node.label : node.text) ?? node.id;
}

function nodeKind(node: CanvasNode): PageObject["kind"] {
	if (node.type === "group") return GROUP_KIND;
	if (node.shape && SHAPE_TO_KIND[node.shape]) return SHAPE_TO_KIND[node.shape];
	if (node.color && COLOR_TO_KIND[node.color]) return COLOR_TO_KIND[node.color];
	return DEFAULT_KIND;
}

/** Check if a node's bounding box is inside a group's bounding box. */
function isInside(node: CanvasNode, grp: CanvasNode): boolean {
	return (
		node.x >= grp.x &&
		node.y >= grp.y &&
		node.x + node.width <= grp.x + grp.width &&
		node.y + node.height <= grp.y + grp.height
	);
}

// ── Canvas fields vs user fields ─────────────────────────────────────

/** Fields that canvas import owns — overwritten on merge. */
const CANVAS_FIELDS = new Set(["kind", "label", "description", "parent"]);

// ── Main export ──────────────────────────────────────────────────────

export function parseCanvasToSitemap(
	canvas: CanvasData,
	existingSitemap?: UnifiedSitemap,
): { sitemap: UnifiedSitemap } & CanvasImportResult {
	const groups = canvas.nodes.filter((n) => n.type === "group");
	const nonGroups = canvas.nodes.filter((n) => n.type !== "group");

	// Build node-id → page-id lookup
	const idMap = new Map<string, string>();
	for (const node of canvas.nodes) {
		idMap.set(node.id, toKebab(nodeLabel(node)));
	}

	// Build pages from canvas nodes
	const canvasPages: Record<string, PageObject> = {};

	// Groups first (containers)
	for (const grp of groups) {
		const pageId = idMap.get(grp.id)!;
		canvasPages[pageId] = {
			kind: nodeKind(grp),
			label: nodeLabel(grp),
			description: "",
			actions: [],
		};
	}

	// Non-group nodes
	for (const node of nonGroups) {
		const pageId = idMap.get(node.id)!;
		const parent = groups.find((g) => isInside(node, g));
		canvasPages[pageId] = {
			kind: nodeKind(node),
			label: nodeLabel(node),
			description: "",
			actions: [],
			...(parent ? { parent: idMap.get(parent.id) } : {}),
		};
	}

	// Build navigate actions from edges
	for (const edge of canvas.edges) {
		const fromId = idMap.get(edge.fromNode);
		const toId = idMap.get(edge.toNode);
		if (!fromId || !toId || !canvasPages[fromId]) continue;

		const action: PageAction = {
			name: `onNavigateTo${toId.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("")}`,
			label: canvasPages[toId]?.label ?? toId,
			type: "navigate",
			target: toId,
		};

		const existing = canvasPages[fromId];
		canvasPages[fromId] = { ...existing, actions: [...existing.actions, action] };
	}

	// Merge with existing sitemap
	let added = 0;
	let updated = 0;
	const mergedPages: Record<string, PageObject> = {};

	if (existingSitemap) {
		// Start with all existing pages (never delete)
		for (const [id, page] of Object.entries(existingSitemap.pages)) {
			mergedPages[id] = page;
		}

		// Apply canvas pages
		for (const [id, canvasPage] of Object.entries(canvasPages)) {
			if (mergedPages[id]) {
				// Update canvas-owned fields, preserve user-added fields
				const existing = mergedPages[id];
				const preserved: Record<string, unknown> = {};
				for (const [key, value] of Object.entries(existing)) {
					if (!CANVAS_FIELDS.has(key)) {
						preserved[key] = value;
					}
				}
				mergedPages[id] = { ...canvasPage, ...preserved } as PageObject;
				updated++;
			} else {
				mergedPages[id] = canvasPage;
				added++;
			}
		}
	} else {
		for (const [id, page] of Object.entries(canvasPages)) {
			mergedPages[id] = page;
			added++;
		}
	}

	return {
		sitemap: { version: 2, pages: mergedPages },
		added,
		updated,
		totalPages: Object.keys(mergedPages).length,
	};
}
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/canvas-sitemap-import.test.ts --config configs/vitest.config.ts`
Expected: PASS — all 8 tests green

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/canvas-sitemap-import.ts" "01 - Projects/Flowti CLI/tests/domain/make/canvas-sitemap-import.test.ts"
git commit -m "feat(cli): canvas-to-sitemap domain function with additive merge"
```

---

## Chunk 2: CLI Command + Sample Template

### Task 3: Add `storybook:canvas-import` CLI command

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/controller/storybook.controller.ts:332-344`
- Modify: `01 - Projects/Flowti CLI/tests/controller/storybook.controller.test.ts`

- [ ] **Step 1: Write tests**

Add to `storybook.controller.test.ts` at the end:

```typescript
describe("storybook:canvas-import", () => {
	it("reads canvas and writes sitemap", () => {
		const handler = getHandler("storybook:canvas-import");
		const canvasJson = JSON.stringify({
			nodes: [{ id: "n1", type: "text", text: "Home", x: 0, y: 0, width: 200, height: 100, color: "4" }],
			edges: [],
		});
		const ctx = createProjectContext({ command: "storybook:canvas-import", flags: {} });
		ctx.deps.disk.existsSync = vi.fn((p: string) => String(p).includes("sitemap.canvas"));
		ctx.deps.disk.readFileSync = vi.fn(() => canvasJson);
		ctx.deps.disk.writeFileSync = vi.fn();
		ctx.deps.disk.mkdirSync = vi.fn();
		const result = handler(ctx) as Record<string, unknown>;
		expect(result).toHaveProperty("added", 1);
		expect(ctx.deps.disk.writeFileSync).toHaveBeenCalled();
	});

	it("merges when --merge flag is set and sitemap exists", () => {
		const handler = getHandler("storybook:canvas-import");
		const canvasJson = JSON.stringify({
			nodes: [{ id: "n1", type: "text", text: "Home", x: 0, y: 0, width: 200, height: 100 }],
			edges: [],
		});
		const existingSitemap = JSON.stringify({ version: 2, pages: { "old": { kind: "page", label: "Old", description: "", actions: [] } } });
		const ctx = createProjectContext({ command: "storybook:canvas-import", flags: { merge: true } });
		ctx.deps.disk.existsSync = vi.fn(() => true);
		ctx.deps.disk.readFileSync = vi.fn((p: string) => String(p).includes("sitemap.json") ? existingSitemap : canvasJson);
		ctx.deps.disk.writeFileSync = vi.fn();
		ctx.deps.disk.mkdirSync = vi.fn();
		const result = handler(ctx) as Record<string, unknown>;
		expect(result).toHaveProperty("added", 1);
		expect(result).toHaveProperty("totalPages", 2);
	});
});
```

- [ ] **Step 2: Implement the command**

In `storybook.controller.ts`, add the import at the top:

```typescript
import { parseCanvasToSitemap } from "../domain/make/canvas-sitemap-import.js";
import type { CanvasData } from "../domain/make/canvas-sitemap-types.js";
```

Add the command before the closing `};` (after `storybook:clean`):

```typescript
	"storybook:canvas-import": adaptDescriptor<{ canvas: string; output: string; merge: boolean }, { added: number; updated: number; totalPages: number; outputPath: string }>({
		requires: "project",
		flags: {
			canvas: { type: "string", required: false, hint: "--canvas=<path>" },
			output: { type: "string", required: false, hint: "--output=<path>" },
			merge: { type: "boolean", required: false, hint: "--merge" },
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const canvasPath = ctx.flags.canvas || paths.join(ctx.project!.path, "sitemap.canvas");
			const outputPath = ctx.flags.output || paths.join(ctx.project!.path, "configs", "sitemap.json");

			if (!disk.existsSync(canvasPath)) {
				return { added: 0, updated: 0, totalPages: 0, outputPath: "" };
			}

			const canvasJson = disk.readFileSync(canvasPath, "utf8");
			const canvas = JSON.parse(canvasJson) as CanvasData;

			let existing: import("../domain/sitemap/unified-page.js").UnifiedSitemap | undefined;
			if (ctx.flags.merge && disk.existsSync(outputPath)) {
				existing = JSON.parse(disk.readFileSync(outputPath, "utf8")) as import("../domain/sitemap/unified-page.js").UnifiedSitemap;
			}

			const { sitemap, added, updated, totalPages } = parseCanvasToSitemap(canvas, existing);

			const outputDir = paths.dirname(outputPath);
			if (!disk.existsSync(outputDir)) disk.mkdirSync(outputDir, { recursive: true });
			disk.writeFileSync(outputPath, JSON.stringify(sitemap, null, "\t") + "\n", "utf8");

			// Write canvas hash metadata
			const crypto = require("node:crypto");
			const hash = crypto.createHash("md5").update(canvasJson).digest("hex");
			const metaPath = paths.join(paths.dirname(outputPath), ".sitemap-canvas-meta.json");
			disk.writeFileSync(metaPath, JSON.stringify({ canvasHash: hash, importedAt: new Date().toISOString() }) + "\n", "utf8");

			return { added, updated, totalPages, outputPath };
		},
		renderer: (data, log) => {
			if (data.totalPages === 0) {
				log("\n  No canvas found. Nothing to import.\n");
				return;
			}
			log(`\n  Imported canvas → ${data.outputPath}`);
			log(`  ${data.added} added, ${data.updated} updated, ${data.totalPages} total pages\n`);
		},
	}),
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/storybook.controller.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/storybook.controller.ts" "01 - Projects/Flowti CLI/tests/controller/storybook.controller.test.ts"
git commit -m "feat(cli): add storybook:canvas-import command with merge support"
```

---

### Task 4: Create sample sitemap.canvas template

**Files:**
- Create: `01 - Projects/Flowti CLI/configs/templates/sitemap.canvas`

- [ ] **Step 1: Create templates directory and canvas file**

Create `01 - Projects/Flowti CLI/configs/templates/sitemap.canvas` — a standard Obsidian canvas JSON with a typical app structure:

```json
{
	"nodes": [
		{ "id": "g-nav", "type": "group", "label": "Navigation", "x": 0, "y": 0, "width": 800, "height": 300 },
		{ "id": "g-content", "type": "group", "label": "Content", "x": 0, "y": 350, "width": 800, "height": 300 },
		{ "id": "g-system", "type": "group", "label": "System", "x": 0, "y": 700, "width": 800, "height": 300 },

		{ "id": "n-home", "type": "text", "text": "Home", "x": 50, "y": 50, "width": 200, "height": 100, "color": "4" },
		{ "id": "n-dashboard", "type": "text", "text": "Dashboard", "x": 300, "y": 50, "width": 200, "height": 100, "color": "4" },
		{ "id": "n-settings", "type": "text", "text": "Settings", "x": 550, "y": 50, "width": 200, "height": 100, "color": "2" },

		{ "id": "n-list", "type": "text", "text": "Items List", "x": 50, "y": 400, "width": 200, "height": 100, "color": "3" },
		{ "id": "n-detail", "type": "text", "text": "Item Detail", "x": 300, "y": 400, "width": 200, "height": 100, "color": "4" },
		{ "id": "n-edit", "type": "text", "text": "Edit Item", "x": 550, "y": 400, "width": 200, "height": 100, "color": "2" },

		{ "id": "n-login", "type": "text", "text": "Login", "x": 50, "y": 750, "width": 200, "height": 100, "color": "1" },
		{ "id": "n-error", "type": "text", "text": "Error", "x": 300, "y": 750, "width": 200, "height": 100, "color": "1" },
		{ "id": "n-notfound", "type": "text", "text": "Not Found", "x": 550, "y": 750, "width": 200, "height": 100, "color": "6" },

		{ "id": "n-header", "type": "text", "text": "Header", "x": 850, "y": 50, "width": 200, "height": 100 },
		{ "id": "n-sidebar", "type": "text", "text": "Sidebar", "x": 850, "y": 200, "width": 200, "height": 100 },
		{ "id": "n-footer", "type": "text", "text": "Footer", "x": 850, "y": 350, "width": 200, "height": 100 },
		{ "id": "n-layout", "type": "text", "text": "Main Layout", "x": 850, "y": 500, "width": 200, "height": 100, "color": "5" }
	],
	"edges": [
		{ "id": "e1", "fromNode": "n-home", "toNode": "n-dashboard", "fromSide": "right", "toSide": "left" },
		{ "id": "e2", "fromNode": "n-dashboard", "toNode": "n-list", "fromSide": "bottom", "toSide": "top" },
		{ "id": "e3", "fromNode": "n-list", "toNode": "n-detail", "fromSide": "right", "toSide": "left" },
		{ "id": "e4", "fromNode": "n-detail", "toNode": "n-edit", "fromSide": "right", "toSide": "left" },
		{ "id": "e5", "fromNode": "n-home", "toNode": "n-settings", "fromSide": "right", "toSide": "left" },
		{ "id": "e6", "fromNode": "n-header", "toNode": "n-home", "fromSide": "left", "toSide": "right" },
		{ "id": "e7", "fromNode": "n-login", "toNode": "n-home", "fromSide": "top", "toSide": "bottom" },
		{ "id": "e8", "fromNode": "n-dashboard", "toNode": "n-settings", "fromSide": "right", "toSide": "left" }
	]
}
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/configs/templates/sitemap.canvas"
git commit -m "feat(cli): add sample sitemap.canvas template for new projects"
```

---

## Chunk 3: Plugin Integration — Detection + Service + UI

### Task 5: Add `hasCanvas` + `canvasChanged` to ProjectDetail + service

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/domain/projects/types.ts:30-36`
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/projects/vault-project-service.ts`
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/projects/http-project-service.ts`
- Modify: `01 - Projects/Flowti Plugin/tests/domain/projects/types.test.ts`
- Modify: `01 - Projects/Flowti Plugin/tests/infrastructure/handlers/project-handlers.test.ts`

- [ ] **Step 1: Extend types**

In `types.ts`, add to `ProjectDetail`:
```typescript
	readonly hasCanvas: boolean;
	readonly canvasChanged: boolean;
```

Add to `IProjectService`:
```typescript
	importCanvasSitemap(project: string, onOutput?: OutputCallback, opts?: { merge?: boolean }): Promise<{ ok: boolean; error?: string }>;
```

- [ ] **Step 2: Implement in VaultProjectService**

In `getProject()`, after hasSitemap detection, add:
```typescript
		const canvasPath = join(absProjectPath, "sitemap.canvas");
		const hasCanvas = existsSync(canvasPath);
		let canvasChanged = false;
		if (hasCanvas) {
			const metaPath = join(absProjectPath, "configs", ".sitemap-canvas-meta.json");
			if (existsSync(metaPath)) {
				try {
					const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as { canvasHash?: string };
					const crypto = require("node:crypto");
					const currentHash = crypto.createHash("md5").update(readFileSync(canvasPath, "utf-8")).digest("hex");
					canvasChanged = meta.canvasHash !== currentHash;
				} catch { canvasChanged = true; }
			} else {
				canvasChanged = true;
			}
		}
```

Add `hasCanvas` and `canvasChanged` to the return object.

Add `importCanvasSitemap` method:
```typescript
	async importCanvasSitemap(project: string, onOutput?: OutputCallback, opts?: { merge?: boolean }): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const cliBin = join(vaultBase, ".flowti", "bin");
		const args = [cliBin, "storybook:canvas-import", `--project="${project}"`];
		if (opts?.merge) args.push("--merge");
		return runAsync("node", args, vaultBase, onOutput);
	}
```

- [ ] **Step 3: Add stubs to HttpProjectService**

```typescript
	async importCanvasSitemap(project: string, _onOutput?: (line: string) => void, opts?: { merge?: boolean }): Promise<ApiResult> {
		return this.post("/api/storybook/canvas-import", { project, merge: opts?.merge });
	}
```

- [ ] **Step 4: Update mocks**

In `project-handlers.test.ts` mockService, add:
```typescript
		importCanvasSitemap: vi.fn(async () => ({ ok: true })),
```

Add `hasCanvas: false, canvasChanged: false` to the getProject mock.

- [ ] **Step 5: Pass canvas state in loadProject**

In `project-handlers.ts` `loadProject()`, add:
```typescript
		el.hasCanvas = detail.hasCanvas;
		el.canvasChanged = detail.canvasChanged;
```

- [ ] **Step 6: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/projects/types.test.ts tests/infrastructure/handlers/project-handlers.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/domain/projects/types.ts" "01 - Projects/Flowti Plugin/src/infrastructure/projects/vault-project-service.ts" "01 - Projects/Flowti Plugin/src/infrastructure/projects/http-project-service.ts" "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts" "01 - Projects/Flowti Plugin/tests/domain/projects/types.test.ts" "01 - Projects/Flowti Plugin/tests/infrastructure/handlers/project-handlers.test.ts"
git commit -m "feat(plugin): canvas detection, change tracking, importCanvasSitemap service"
```

---

### Task 6: Update scaffold modal + project detail for canvas support

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-scaffold-modal.ts:95-156`
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts:409-436`
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts:238-266`

- [ ] **Step 1: Add canvas properties to scaffold modal**

In `flowti-scaffold-modal.ts`, add properties:
```typescript
		hasCanvas: { type: Boolean },
		canvasChanged: { type: Boolean },
```

And instance defaults:
```typescript
	hasCanvas = false;
	canvasChanged = false;
```

- [ ] **Step 2: Update renderContent for canvas awareness**

Replace `renderContent()`:
```typescript
	protected renderContent() {
		if (this.hasCanvas && !this.hasSitemap) {
			return this.renderCanvasImportPrompt();
		}
		if (this.hasSitemap) {
			return this.renderSitemapPrompt();
		}
		if (this.hasMarkdownSource) {
			return this.renderImportPrompt();
		}
		return this.renderNoSitemap();
	}
```

Add new render method:
```typescript
	private renderCanvasImportPrompt() {
		return html`
			<div class="overlay" @click="${this.dispatchDismiss}">
				<div class="modal" @click="${(e: Event) => e.stopPropagation()}">
					<div class="modal-title">Import from canvas</div>
					<div class="modal-body">
						A sitemap canvas was found. Import it to generate the project sitemap
						and create component stubs and stories.
					</div>
					<div class="modal-actions">
						<button class="btn" @click="${this.dispatchDismiss}">Cancel</button>
						<button class="btn btn--primary" @click="${this.dispatchConfirmCanvas}">Import &amp; Generate</button>
					</div>
				</div>
			</div>
		`;
	}
```

Add dispatch method:
```typescript
	private dispatchConfirmCanvas(): void {
		this.dispatchEvent(new CustomEvent("scaffold-confirm", {
			detail: { canvasImport: true },
			bubbles: true, composed: true,
		}));
	}
```

- [ ] **Step 3: Add canvas change banner to project detail**

In `flowti-project-detail.ts`, add properties:
```typescript
		hasCanvas: { type: Boolean },
		canvasChanged: { type: Boolean },
```

And instance defaults:
```typescript
	hasCanvas = false;
	canvasChanged = false;
```

In `renderContent()`, add a canvas change banner after the status banner:
```typescript
			${this.canvasChanged ? html`
				<div class="status-banner">
					sitemap.canvas has changed
					<button class="note-create" @click="${() => this.dispatchEvent(new CustomEvent('canvas-merge', { bubbles: true, composed: true }))}">Merge</button>
				</div>
			` : ""}
```

Pass canvas props to scaffold modal:
```typescript
			${this.showScaffoldModal ? html`
				<flowti-scaffold-modal
					.hasSitemap="${this.hasSitemap}"
					.hasMarkdownSource="${this.hasMarkdownSource}"
					.hasCanvas="${this.hasCanvas}"
					.canvasChanged="${this.canvasChanged}"
				></flowti-scaffold-modal>
			` : ""}
```

- [ ] **Step 4: Wire canvas events in handlers**

In `project-handlers.ts`, update `scaffold-confirm` to handle `canvasImport`:

Add at the start of the scaffold-confirm handler (before the `importFirst` check):
```typescript
		const canvasImport = e.detail?.canvasImport === true;

		if (canvasImport) {
			startBusy("Importing canvas sitemap...");
			void projectService.importCanvasSitemap(currentProject, appendOutput)
				.then((importResult) => {
					if (!importResult.ok) { endBusy(importResult); return; }
					appendOutput("Scaffolding components...");
					void projectService.scaffoldStorybook(currentProject, appendOutput, { adoptImport: true })
						.then((scaffoldResult) => {
							if (!scaffoldResult.ok) { endBusy(scaffoldResult); return; }
							endBusy(scaffoldResult);
							el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
						});
				});
			return;
		}
```

Add canvas-merge handler:
```typescript
	el.addEventListener("canvas-merge", (() => {
		startBusy("Merging canvas changes...");
		void projectService.importCanvasSitemap(currentProject, appendOutput, { merge: true })
			.then((r) => endBusy(r));
	}) as EventListener);
```

- [ ] **Step 5: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/handlers/project-handlers.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-scaffold-modal.ts" "01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts" "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts"
git commit -m "feat(plugin): canvas-aware scaffold modal + change detection banner + merge"
```

---

## Chunk 4: Verification

### Task 7: Build + verify

- [ ] **Step 1: Run CLI tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/canvas-sitemap-import.test.ts tests/controller/storybook.controller.test.ts --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 2: Run Plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/projects/ tests/infrastructure/handlers/`
Expected: All pass

- [ ] **Step 3: Build CLI**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`
Expected: `Built: .flowti/bin/main.mjs`

- [ ] **Step 4: Build Plugin**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Expected: `Build done...`
