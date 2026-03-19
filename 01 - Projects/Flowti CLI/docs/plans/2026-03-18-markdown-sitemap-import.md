# Markdown-to-Sitemap Import — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import markdown component files with Obsidian-compatible YAML frontmatter and generate a v2 UnifiedSitemap that feeds into the existing storybook scaffold pipeline.

**Architecture:** Pipeline insert approach — a new `markdown-sitemap-import` domain module with two pure functions (`validateComponents`, `generateSitemapFromMarkdown`) sits before the existing `scaffoldStorybookFromSitemap()`. The controller handler (with access to `deps`) handles all I/O: scanning the folder, parsing YAML via the existing `parseFrontmatterContent()`, writing the output sitemap. The config type `ComponentsConfig` gains a `markdownSource` field.

**Tech Stack:** TypeScript (strict), Vitest, ESM imports with `.js` extensions, tab indentation.

**Spec:** `docs/specs/2026-03-18-markdown-sitemap-import-design.md`

---

## Chunk 1: Types & Validation

### Task 1: Create type definitions

**Files:**
- Create: `src/domain/make/markdown-sitemap-types.ts`

- [ ] **Step 1: Create the types file**

```typescript
/**
 * markdown-sitemap-types.ts — Types for markdown-to-sitemap import pipeline.
 *
 * Defines the shape of parsed component markdown, validation results,
 * import results, and the config contract for markdownSource.
 */

import type { UnifiedSitemap } from "../sitemap/unified-page.js";
import type { CliDeps } from "../../infrastructure/deps.js";

export type Strategy = "category" | "flat" | "hierarchical";

export const STRATEGIES: readonly Strategy[] = ["category", "flat", "hierarchical"] as const;

export const VALID_STATUSES = ["draft", "ready", "deprecated"] as const;
export type ComponentStatus = typeof VALID_STATUSES[number];

export interface ComponentMarkdown {
	readonly name: string;
	readonly category: string;
	readonly description: string;
	readonly status: ComponentStatus;
	readonly props: readonly string[];
	readonly slots: readonly string[];
	readonly variants: readonly string[];
}

export interface ImportWarning {
	readonly file: string;
	readonly reason: string;
}

export interface ValidationResult {
	readonly valid: readonly ComponentMarkdown[];
	readonly warnings: readonly ImportWarning[];
}

export interface ImportResult {
	readonly sitemap: UnifiedSitemap;
	readonly componentCount: number;
	readonly skippedCount: number;
	readonly warnings: readonly ImportWarning[];
}

export interface MarkdownSourceConfig {
	readonly path: string;
	readonly strategy: Strategy;
	readonly requiredFields: readonly string[];
}

export type ImportDeps = Pick<CliDeps, "disk" | "paths">;
```

- [ ] **Step 2: Verify it compiles**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | head -20`
Expected: No errors related to `markdown-sitemap-types.ts`

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/markdown-sitemap-types.ts"
git commit -m "feat(storybook): add markdown-sitemap import type definitions"
```

---

### Task 2: Add `markdownSource` to `ComponentsConfig`

**Files:**
- Modify: `src/infrastructure/types-config.ts:135-139`

- [ ] **Step 1: Add the field to ComponentsConfig**

In `src/infrastructure/types-config.ts`, add `markdownSource` to the `ComponentsConfig` interface at line 139 (before the closing `}`):

```typescript
export interface ComponentsConfig {
	storybook?: boolean;
	storybookDir?: string;
	framework?: ComponentFramework;
	markdownSource?: {
		readonly path: string;
		readonly strategy: "category" | "flat" | "hierarchical";
		readonly requiredFields: readonly string[];
	};
}
```

Note: We inline the shape here rather than importing from domain (infrastructure must not import domain types). The domain `MarkdownSourceConfig` type mirrors this shape.

- [ ] **Step 2: Verify it compiles**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/types-config.ts"
git commit -m "feat(storybook): add markdownSource config to ComponentsConfig"
```

---

### Task 3: Write validation tests (RED)

**Files:**
- Create: `tests/domain/make/markdown-sitemap-import.test.ts`

- [ ] **Step 1: Write the test file with validation tests**

```typescript
import { describe, it, expect } from "vitest";
import { validateComponents } from "../../../src/domain/make/markdown-sitemap-import.js";

// ── Fixtures ────────────────────────────────────────────────────────

const ALL_FIELDS = ["name", "category", "description", "props", "slots", "variants", "status"];

const validButton: Record<string, unknown> = {
	name: "Button",
	category: "atoms",
	description: "Primary interactive element",
	status: "ready",
	props: ["variant", "disabled"],
	slots: ["default", "icon"],
	variants: ["primary", "outlined"],
};

const validCard: Record<string, unknown> = {
	name: "Card",
	category: "atoms",
	description: "Content container",
	status: "draft",
	props: ["elevation"],
	slots: ["header", "body"],
	variants: ["flat", "raised"],
};

// ── validateComponents ──────────────────────────────────────────────

describe("validateComponents", () => {
	it("accepts all valid records", () => {
		const files: Record<string, Record<string, unknown>> = {
			"Button.md": validButton,
			"Card.md": validCard,
		};
		const result = validateComponents(files, ALL_FIELDS);
		expect(result.valid).toHaveLength(2);
		expect(result.warnings).toHaveLength(0);
		expect(result.valid[0].name).toBe("Button");
		expect(result.valid[1].name).toBe("Card");
	});

	it("skips records missing a required field with warning", () => {
		const files: Record<string, Record<string, unknown>> = {
			"Button.md": validButton,
			"NoName.md": { category: "atoms", description: "Oops", status: "ready", props: [], slots: [], variants: [] },
		};
		const result = validateComponents(files, ALL_FIELDS);
		expect(result.valid).toHaveLength(1);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0].file).toBe("NoName.md");
		expect(result.warnings[0].reason).toContain("name");
	});

	it("skips records with invalid status value", () => {
		const files: Record<string, Record<string, unknown>> = {
			"Bad.md": { ...validButton, status: "archived" },
		};
		const result = validateComponents(files, ALL_FIELDS);
		expect(result.valid).toHaveLength(0);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0].reason).toContain("status");
	});

	it("accepts empty arrays for props, slots, variants", () => {
		const files: Record<string, Record<string, unknown>> = {
			"Empty.md": { ...validButton, props: [], slots: [], variants: [] },
		};
		const result = validateComponents(files, ALL_FIELDS);
		expect(result.valid).toHaveLength(1);
	});

	it("returns empty valid and no warnings for empty input", () => {
		const result = validateComponents({}, ALL_FIELDS);
		expect(result.valid).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);
	});

	it("validates only the fields in requiredFields", () => {
		const files: Record<string, Record<string, unknown>> = {
			"Minimal.md": { name: "Minimal", category: "atoms" },
		};
		const result = validateComponents(files, ["name", "category"]);
		expect(result.valid).toHaveLength(1);
		expect(result.valid[0].name).toBe("Minimal");
	});

	it("skips records where props is not an array", () => {
		const files: Record<string, Record<string, unknown>> = {
			"Bad.md": { ...validButton, props: "not-an-array" },
		};
		const result = validateComponents(files, ALL_FIELDS);
		expect(result.valid).toHaveLength(0);
		expect(result.warnings[0].reason).toContain("props");
	});

	it("skips records where name is empty string", () => {
		const files: Record<string, Record<string, unknown>> = {
			"Bad.md": { ...validButton, name: "" },
		};
		const result = validateComponents(files, ALL_FIELDS);
		expect(result.valid).toHaveLength(0);
		expect(result.warnings[0].reason).toContain("name");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/markdown-sitemap-import.test.ts --config configs/vitest.config.ts 2>&1 | tail -20`
Expected: FAIL — `validateComponents` is not exported / module not found

- [ ] **Step 3: Commit failing tests**

```bash
git add "01 - Projects/Flowti CLI/tests/domain/make/markdown-sitemap-import.test.ts"
git commit -m "test(storybook): add validation tests for markdown import (red)"
```

---

### Task 4: Implement `validateComponents` (GREEN)

**Files:**
- Create: `src/domain/make/markdown-sitemap-import.ts`

- [ ] **Step 1: Create the domain module with validateComponents**

```typescript
/**
 * markdown-sitemap-import.ts — Pure domain functions for markdown-to-sitemap import.
 *
 * Validates parsed frontmatter records and generates a v2 UnifiedSitemap
 * from validated component definitions. No I/O — caller handles file scanning,
 * YAML parsing, and sitemap writing.
 */

import type { UnifiedSitemap, PageObject, PageProperty, PageVariant, PageChild } from "../sitemap/unified-page.js";
import type { ComponentMarkdown, ValidationResult, ImportWarning, Strategy } from "./markdown-sitemap-types.js";
import { VALID_STATUSES } from "./markdown-sitemap-types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function toKebab(s: string): string {
	return s
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.toLowerCase()
		.replace(/^-+|-+$/g, "");
}

const STRING_FIELDS = ["name", "category", "description"] as const;
const ARRAY_FIELDS = ["props", "slots", "variants"] as const;

// ── Validation ───────────────────────────────────────────────────────

export function validateComponents(
	files: Record<string, Record<string, unknown>>,
	requiredFields: readonly string[],
): ValidationResult {
	const valid: ComponentMarkdown[] = [];
	const warnings: ImportWarning[] = [];

	for (const [file, fm] of Object.entries(files)) {
		const problem = checkRecord(fm, requiredFields);
		if (problem) {
			warnings.push({ file, reason: problem });
			continue;
		}

		// Always validate status if present (even when not in requiredFields)
		if ("status" in fm && !VALID_STATUSES.includes(fm.status as typeof VALID_STATUSES[number])) {
			warnings.push({ file, reason: `status must be one of: ${VALID_STATUSES.join(", ")}` });
			continue;
		}

		valid.push({
			name: fm.name as string,
			category: fm.category as string,
			description: (fm.description as string | undefined) ?? "",
			status: (fm.status as ComponentMarkdown["status"] | undefined) ?? "draft",
			props: asStringArray(fm.props),
			slots: asStringArray(fm.slots),
			variants: asStringArray(fm.variants),
		});
	}

	return { valid, warnings };
}

function checkRecord(fm: Record<string, unknown>, requiredFields: readonly string[]): string | null {
	for (const field of requiredFields) {
		if (!(field in fm)) return `missing required field: ${field}`;

		if (STRING_FIELDS.includes(field as typeof STRING_FIELDS[number])) {
			if (typeof fm[field] !== "string" || (fm[field] as string).trim() === "") {
				return `${field} must be a non-empty string`;
			}
		}

		if (ARRAY_FIELDS.includes(field as typeof ARRAY_FIELDS[number])) {
			if (!Array.isArray(fm[field])) {
				return `${field} must be an array`;
			}
		}

		if (field === "status") {
			if (!VALID_STATUSES.includes(fm[field] as typeof VALID_STATUSES[number])) {
				return `status must be one of: ${VALID_STATUSES.join(", ")}`;
			}
		}
	}
	return null;
}

function asStringArray(value: unknown): readonly string[] {
	if (!Array.isArray(value)) return [];
	return value.map(String);
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/markdown-sitemap-import.test.ts --config configs/vitest.config.ts 2>&1 | tail -20`
Expected: All 8 tests PASS

- [ ] **Step 3: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/markdown-sitemap-import.ts"
git commit -m "feat(storybook): implement validateComponents for markdown import"
```

---

## Chunk 2: Sitemap Generation

### Task 5: Write generation tests — category strategy (RED)

**Files:**
- Modify: `tests/domain/make/markdown-sitemap-import.test.ts`

- [ ] **Step 1: Add category strategy tests**

Add the new imports at the **top of the file** (after the existing `import` statements), then append the fixtures and test block after the `validateComponents` describe block:

**At top of file (after existing imports):**
```typescript
import { generateSitemapFromMarkdown } from "../../../src/domain/make/markdown-sitemap-import.js";
import type { ComponentMarkdown } from "../../../src/domain/make/markdown-sitemap-types.js";
```

**After the `validateComponents` describe block:**
```typescript
// ── Fixtures for generation ─────────────────────────────────────────

const button: ComponentMarkdown = {
	name: "Button",
	category: "atoms",
	description: "Primary interactive element",
	status: "ready",
	props: ["variant", "disabled"],
	slots: ["default", "icon"],
	variants: ["primary", "outlined"],
};

const badge: ComponentMarkdown = {
	name: "Badge",
	category: "atoms",
	description: "Status indicator",
	status: "draft",
	props: ["count"],
	slots: [],
	variants: ["dot", "number"],
};

const navbar: ComponentMarkdown = {
	name: "Navbar",
	category: "navigation",
	description: "Top navigation bar",
	status: "ready",
	props: ["sticky"],
	slots: ["brand", "links"],
	variants: ["fixed", "static"],
};

// ── generateSitemapFromMarkdown — category ──────────────────────────

describe("generateSitemapFromMarkdown — category strategy", () => {
	it("creates category parent pages and component child pages", () => {
		const sitemap = generateSitemapFromMarkdown([button, badge, navbar], "category");
		expect(sitemap.version).toBe(2);

		// Category pages
		expect(sitemap.pages["atoms"]).toBeDefined();
		expect(sitemap.pages["atoms"].kind).toBe("page");
		expect(sitemap.pages["atoms"].label).toBe("atoms");

		expect(sitemap.pages["navigation"]).toBeDefined();
		expect(sitemap.pages["navigation"].kind).toBe("page");

		// Component pages with parent
		expect(sitemap.pages["atoms-button"]).toBeDefined();
		expect(sitemap.pages["atoms-button"].kind).toBe("component");
		expect(sitemap.pages["atoms-button"].label).toBe("Button");
		expect(sitemap.pages["atoms-button"].parent).toBe("atoms");

		expect(sitemap.pages["atoms-badge"]).toBeDefined();
		expect(sitemap.pages["atoms-badge"].parent).toBe("atoms");

		expect(sitemap.pages["navigation-navbar"]).toBeDefined();
		expect(sitemap.pages["navigation-navbar"].parent).toBe("navigation");
	});

	it("maps status ready to active", () => {
		const sitemap = generateSitemapFromMarkdown([button], "category");
		expect(sitemap.pages["atoms-button"].status).toBe("active");
	});

	it("maps status draft as-is", () => {
		const sitemap = generateSitemapFromMarkdown([badge], "category");
		expect(sitemap.pages["atoms-badge"].status).toBe("draft");
	});

	it("maps props to PageProperty with key and type string", () => {
		const sitemap = generateSitemapFromMarkdown([button], "category");
		const props = sitemap.pages["atoms-button"].properties!;
		expect(props).toHaveLength(2);
		expect(props[0]).toEqual({ key: "variant", type: "string" });
		expect(props[1]).toEqual({ key: "disabled", type: "string" });
	});

	it("maps slots to PageChild with ref and slot", () => {
		const sitemap = generateSitemapFromMarkdown([button], "category");
		const children = sitemap.pages["atoms-button"].children!;
		expect(children).toHaveLength(2);
		expect(children[0]).toEqual({ ref: "atoms-button", slot: "default" });
		expect(children[1]).toEqual({ ref: "atoms-button", slot: "icon" });
	});

	it("maps variants to PageVariant with name and empty props", () => {
		const sitemap = generateSitemapFromMarkdown([button], "category");
		const variants = sitemap.pages["atoms-button"].variants!;
		expect(variants).toHaveLength(2);
		expect(variants[0]).toEqual({ name: "primary", props: {} });
		expect(variants[1]).toEqual({ name: "outlined", props: {} });
	});

	it("includes actions: [] on all pages", () => {
		const sitemap = generateSitemapFromMarkdown([button], "category");
		expect(sitemap.pages["atoms"].actions).toEqual([]);
		expect(sitemap.pages["atoms-button"].actions).toEqual([]);
	});

	it("returns empty sitemap for empty input", () => {
		const sitemap = generateSitemapFromMarkdown([], "category");
		expect(sitemap.version).toBe(2);
		expect(Object.keys(sitemap.pages)).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/markdown-sitemap-import.test.ts --config configs/vitest.config.ts 2>&1 | tail -20`
Expected: FAIL — `generateSitemapFromMarkdown` not exported

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/domain/make/markdown-sitemap-import.test.ts"
git commit -m "test(storybook): add category strategy generation tests (red)"
```

---

### Task 6: Implement `generateSitemapFromMarkdown` — category strategy (GREEN)

**Files:**
- Modify: `src/domain/make/markdown-sitemap-import.ts`

- [ ] **Step 1: Add the generation function**

Append to `src/domain/make/markdown-sitemap-import.ts`, after the existing code:

```typescript
// ── Status mapping ───────────────────────────────────────────────────

function mapStatus(status: ComponentMarkdown["status"]): "draft" | "active" | "deprecated" {
	if (status === "ready") return "active";
	return status;
}

// ── PageObject builders ──────────────────────────────────────────────

function buildProperties(props: readonly string[]): readonly PageProperty[] {
	return props.map((key) => ({ key, type: "string" as const }));
}

function buildChildren(componentId: string, slots: readonly string[]): readonly PageChild[] {
	return slots.map((slot) => ({ ref: componentId, slot }));
}

function buildVariants(variants: readonly string[]): readonly PageVariant[] {
	return variants.map((name) => ({ name, props: {} }));
}

function buildComponentPage(component: ComponentMarkdown, pageId: string, parent?: string): PageObject {
	return {
		kind: "component",
		label: component.name,
		description: component.description,
		status: mapStatus(component.status),
		actions: [],
		...(parent ? { parent } : {}),
		...(component.props.length > 0 ? { properties: buildProperties(component.props) } : {}),
		...(component.slots.length > 0 ? { children: buildChildren(pageId, component.slots) } : {}),
		...(component.variants.length > 0 ? { variants: buildVariants(component.variants) } : {}),
	};
}

function buildCategoryPage(category: string): PageObject {
	return {
		kind: "page",
		label: category,
		description: `${category} components`,
		actions: [],
	};
}

// ── Strategy implementations ─────────────────────────────────────────

function generateCategory(components: readonly ComponentMarkdown[]): Record<string, PageObject> {
	const pages: Record<string, PageObject> = {};
	const categories = new Set(components.map((c) => c.category));

	for (const cat of categories) {
		const catId = toKebab(cat);
		pages[catId] = buildCategoryPage(cat);
	}

	for (const comp of components) {
		const catId = toKebab(comp.category);
		const pageId = `${catId}-${toKebab(comp.name)}`;
		pages[pageId] = buildComponentPage(comp, pageId, catId);
	}

	return pages;
}

// ── Main export ──────────────────────────────────────────────────────

export function generateSitemapFromMarkdown(
	components: readonly ComponentMarkdown[],
	strategy: Strategy,
): UnifiedSitemap {
	let pages: Record<string, PageObject>;

	switch (strategy) {
		case "category":
			pages = generateCategory(components);
			break;
		case "flat":
			pages = {};
			break;
		case "hierarchical":
			pages = {};
			break;
		default:
			pages = generateCategory(components);
	}

	return { version: 2, pages };
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/markdown-sitemap-import.test.ts --config configs/vitest.config.ts 2>&1 | tail -20`
Expected: All tests PASS (validation + category generation)

- [ ] **Step 3: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/markdown-sitemap-import.ts"
git commit -m "feat(storybook): implement category strategy for sitemap generation"
```

---

### Task 7: Add flat strategy tests and implementation

**Files:**
- Modify: `tests/domain/make/markdown-sitemap-import.test.ts`
- Modify: `src/domain/make/markdown-sitemap-import.ts`

- [ ] **Step 1: Add flat strategy tests**

Append to the test file:

```typescript
// ── generateSitemapFromMarkdown — flat ──────────────────────────────

describe("generateSitemapFromMarkdown — flat strategy", () => {
	it("creates top-level component pages with no parent", () => {
		const sitemap = generateSitemapFromMarkdown([button, badge, navbar], "flat");
		expect(Object.keys(sitemap.pages)).toHaveLength(3);

		expect(sitemap.pages["atoms-button"]).toBeDefined();
		expect(sitemap.pages["atoms-button"].kind).toBe("component");
		expect(sitemap.pages["atoms-button"].parent).toBeUndefined();

		expect(sitemap.pages["atoms-badge"]).toBeDefined();
		expect(sitemap.pages["navigation-navbar"]).toBeDefined();
	});

	it("does not create category group pages", () => {
		const sitemap = generateSitemapFromMarkdown([button, navbar], "flat");
		expect(sitemap.pages["atoms"]).toBeUndefined();
		expect(sitemap.pages["navigation"]).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run tests to verify flat tests fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/markdown-sitemap-import.test.ts --config configs/vitest.config.ts -t "flat" 2>&1 | tail -20`
Expected: FAIL — flat returns empty pages

- [ ] **Step 3: Implement flat strategy**

In `src/domain/make/markdown-sitemap-import.ts`, add the `generateFlat` function before the main export, and update the switch case:

```typescript
function generateFlat(components: readonly ComponentMarkdown[]): Record<string, PageObject> {
	const pages: Record<string, PageObject> = {};

	for (const comp of components) {
		const catId = toKebab(comp.category);
		const pageId = `${catId}-${toKebab(comp.name)}`;
		pages[pageId] = buildComponentPage(comp, pageId);
	}

	return pages;
}
```

Update the switch in `generateSitemapFromMarkdown`:
```typescript
		case "flat":
			pages = generateFlat(components);
			break;
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/markdown-sitemap-import.test.ts --config configs/vitest.config.ts 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/markdown-sitemap-import.ts" "01 - Projects/Flowti CLI/tests/domain/make/markdown-sitemap-import.test.ts"
git commit -m "feat(storybook): implement flat strategy for sitemap generation"
```

---

### Task 8: Add hierarchical strategy tests and implementation

**Files:**
- Modify: `tests/domain/make/markdown-sitemap-import.test.ts`
- Modify: `src/domain/make/markdown-sitemap-import.ts`

- [ ] **Step 1: Add hierarchical strategy tests**

Append to the test file:

```typescript
// ── generateSitemapFromMarkdown — hierarchical ──────────────────────

const textInput: ComponentMarkdown = {
	name: "TextInput",
	category: "forms/inputs",
	description: "Single-line text field",
	status: "ready",
	props: ["placeholder"],
	slots: ["prefix"],
	variants: ["outlined"],
};

const selectComp: ComponentMarkdown = {
	name: "Select",
	category: "forms/selectors",
	description: "Dropdown selector",
	status: "ready",
	props: ["options"],
	slots: [],
	variants: ["native", "custom"],
};

describe("generateSitemapFromMarkdown — hierarchical strategy", () => {
	it("creates intermediate parent pages from nested categories", () => {
		const sitemap = generateSitemapFromMarkdown([textInput, selectComp], "hierarchical");

		// Root category page
		expect(sitemap.pages["forms"]).toBeDefined();
		expect(sitemap.pages["forms"].kind).toBe("page");
		expect(sitemap.pages["forms"].parent).toBeUndefined();

		// Subcategory pages
		expect(sitemap.pages["forms-inputs"]).toBeDefined();
		expect(sitemap.pages["forms-inputs"].kind).toBe("page");
		expect(sitemap.pages["forms-inputs"].parent).toBe("forms");

		expect(sitemap.pages["forms-selectors"]).toBeDefined();
		expect(sitemap.pages["forms-selectors"].parent).toBe("forms");
	});

	it("places components under their deepest category", () => {
		const sitemap = generateSitemapFromMarkdown([textInput, selectComp], "hierarchical");

		expect(sitemap.pages["forms-inputs-text-input"]).toBeDefined();
		expect(sitemap.pages["forms-inputs-text-input"].parent).toBe("forms-inputs");

		expect(sitemap.pages["forms-selectors-select"]).toBeDefined();
		expect(sitemap.pages["forms-selectors-select"].parent).toBe("forms-selectors");
	});

	it("treats non-nested categories like category strategy", () => {
		const sitemap = generateSitemapFromMarkdown([button], "hierarchical");

		expect(sitemap.pages["atoms"]).toBeDefined();
		expect(sitemap.pages["atoms"].kind).toBe("page");

		expect(sitemap.pages["atoms-button"]).toBeDefined();
		expect(sitemap.pages["atoms-button"].parent).toBe("atoms");
	});

	it("deduplicates intermediate pages from multiple components", () => {
		const sitemap = generateSitemapFromMarkdown([textInput, selectComp], "hierarchical");

		// Only one "forms" page even though two subcategories reference it
		const formsPages = Object.keys(sitemap.pages).filter((k) => k === "forms");
		expect(formsPages).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Run tests to verify hierarchical tests fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/markdown-sitemap-import.test.ts --config configs/vitest.config.ts -t "hierarchical" 2>&1 | tail -20`
Expected: FAIL — hierarchical returns empty pages

- [ ] **Step 3: Implement hierarchical strategy**

In `src/domain/make/markdown-sitemap-import.ts`, add the `generateHierarchical` function before the main export:

```typescript
function generateHierarchical(components: readonly ComponentMarkdown[]): Record<string, PageObject> {
	const pages: Record<string, PageObject> = {};

	for (const comp of components) {
		const segments = comp.category.split("/").map((s) => s.trim()).filter(Boolean);

		// Build intermediate category pages
		for (let i = 0; i < segments.length; i++) {
			const pathSegments = segments.slice(0, i + 1);
			const pageId = pathSegments.map(toKebab).join("-");
			if (!pages[pageId]) {
				const parentSegments = pathSegments.slice(0, -1);
				const parent = parentSegments.length > 0 ? parentSegments.map(toKebab).join("-") : undefined;
				pages[pageId] = buildCategoryPage(segments[i]);
				if (parent) {
					pages[pageId] = { ...pages[pageId], parent };
				}
			}
		}

		// Place component under deepest category
		const deepestId = segments.map(toKebab).join("-");
		const compId = `${deepestId}-${toKebab(comp.name)}`;
		pages[compId] = buildComponentPage(comp, compId, deepestId);
	}

	return pages;
}
```

Update the switch:
```typescript
		case "hierarchical":
			pages = generateHierarchical(components);
			break;
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/markdown-sitemap-import.test.ts --config configs/vitest.config.ts 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Run full lint + type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/domain/make/markdown-sitemap-import.ts src/domain/make/markdown-sitemap-types.ts --config configs/eslint.config.mjs 2>&1 | tail -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/markdown-sitemap-import.ts" "01 - Projects/Flowti CLI/tests/domain/make/markdown-sitemap-import.test.ts"
git commit -m "feat(storybook): implement hierarchical strategy for sitemap generation"
```

---

## Chunk 3: CLI Command & Renderer

### Task 9: Add the import result renderer

**Files:**
- Modify: `src/ui/renderers/storybook-renderers.ts`

- [ ] **Step 1: Add the import result model and renderer**

Append to `src/ui/renderers/storybook-renderers.ts`, before the final line:

```typescript
// ── Import renderer ─────────────────────────────────────────────────

export interface StorybookImportResultModel {
	componentCount: number;
	skippedCount: number;
	warnings: ReadonlyArray<{ file: string; reason: string }>;
	outputPath: string;
	configured: boolean;
}

export function renderStorybookImportResult(data: StorybookImportResultModel, log: Log): void {
	if (!data.configured) {
		log(`\n  ${YELLOW}No markdownSource configured in components config.${RESET}\n`);
		return;
	}

	if (data.componentCount === 0 && data.skippedCount === 0) {
		log(`\n  ${YELLOW}No markdown files found in source folder.${RESET}\n`);
		return;
	}

	log(`\n  ${GREEN}✓${RESET} Imported ${BOLD}${data.componentCount}${RESET} components → ${DIM}${data.outputPath}${RESET}`);

	if (data.skippedCount > 0) {
		log(`  ${YELLOW}⚠${RESET} Skipped ${data.skippedCount} file(s):`);
		for (const w of data.warnings) {
			log(`    ${DIM}${w.file}${RESET}: ${w.reason}`);
		}
	}
	log();
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/renderers/storybook-renderers.ts"
git commit -m "feat(storybook): add import result renderer"
```

---

### Task 10: Add the `storybook:import` CLI command

**Files:**
- Modify: `src/controller/storybook.controller.ts`

- [ ] **Step 1: Add imports**

At the top of `src/controller/storybook.controller.ts`, add after the existing imports (after line 38):

```typescript
import { parseFrontmatterContent } from "../infrastructure/frontmatter.js";
import { validateComponents, generateSitemapFromMarkdown } from "../domain/make/markdown-sitemap-import.js";
import {
	renderStorybookImportResult,
	type StorybookImportResultModel,
} from "../ui/renderers/storybook-renderers.js";
```

Note: `renderStorybookImportResult` and `StorybookImportResultModel` are added to the existing import block from `storybook-renderers.js`. Merge them into the existing import statement.

- [ ] **Step 2: Add the storybook:import command**

Add to the `commands` object, before the closing `};` (after the `storybook:scaffold` entry):

```typescript
	"storybook:import": adaptDescriptor<{ output: string }, StorybookImportResultModel>({
		requires: "project",
		flags: {
			output: {
				type: "string",
				required: false,
				hint: "--output=<path>",
			},
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const config = ctx.project!.config.components;
			const mdSource = config?.markdownSource;

			if (!mdSource?.path) {
				return { componentCount: 0, skippedCount: 0, warnings: [], outputPath: "", configured: false };
			}

			const srcDir = paths.resolve(ctx.project!.path, mdSource.path);
			const strategy = mdSource.strategy ?? "category";
			const requiredFields = mdSource.requiredFields ?? ["name", "category", "description", "props", "slots", "variants", "status"];

			// Scan folder for .md files
			const entries = disk.readdirSync(srcDir, { withFileTypes: true });
			const mdFiles: Record<string, Record<string, unknown>> = {};

			for (const entry of entries) {
				if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

				const content = disk.readFileSync(paths.join(srcDir, entry.name), "utf8");
				const fm = parseFrontmatterContent(content);
				if (fm) mdFiles[entry.name] = fm;
			}

			// Validate & generate
			const { valid, warnings } = validateComponents(mdFiles, requiredFields);
			const sitemap = generateSitemapFromMarkdown(valid, strategy);

			// Write output
			const storybookDir = config.storybookDir ?? "components";
			const outputPath = ctx.flags.output || paths.join(ctx.project!.path, storybookDir, "sitemap.json");
			const outputDir = paths.dirname(outputPath);
			if (!disk.existsSync(outputDir)) disk.mkdirSync(outputDir, { recursive: true });
			disk.writeFileSync(outputPath, JSON.stringify(sitemap, null, "\t") + "\n", "utf8");

			return {
				componentCount: valid.length,
				skippedCount: warnings.length,
				warnings: warnings.map((w) => ({ file: w.file, reason: w.reason })),
				outputPath,
				configured: true,
			};
		},
		renderer: renderStorybookImportResult,
	}),
```

- [ ] **Step 3: Verify it compiles**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Run lint**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/controller/storybook.controller.ts --config configs/eslint.config.mjs 2>&1 | tail -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/storybook.controller.ts"
git commit -m "feat(storybook): add storybook:import CLI command"
```

---

### Task 11: Add markdownSource to the CLI's own config (example)

**Files:**
- Modify: `configs/flowti.config.json`

- [ ] **Step 1: Add markdownSource to the components section**

In `configs/flowti.config.json`, find the `"components"` block and add the `markdownSource` field:

```json
"components": {
	"storybook": true,
	"storybookDir": "components",
	"framework": "html",
	"markdownSource": {
		"path": "../design-system/components",
		"strategy": "category",
		"requiredFields": ["name", "category", "description", "props", "slots", "variants", "status"]
	}
}
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/configs/flowti.config.json"
git commit -m "feat(storybook): add markdownSource example config"
```

---

## Chunk 4: Full Suite Verification

### Task 12: Run full test suite and fix any issues

- [ ] **Step 1: Run the full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts 2>&1 | tail -30`
Expected: All existing tests still pass, new tests pass

- [ ] **Step 2: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Run lint on all changed files**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/domain/make/markdown-sitemap-import.ts src/domain/make/markdown-sitemap-types.ts src/controller/storybook.controller.ts src/ui/renderers/storybook-renderers.ts src/infrastructure/types-config.ts --config configs/eslint.config.mjs`
Expected: No errors

- [ ] **Step 4: Fix any issues found in steps 1-3, then re-run and commit**

```bash
git add -A && git commit -m "fix(storybook): address lint/type issues from markdown import"
```

Only commit this if there were fixes needed.
