import { describe, it, expect } from "vitest";
import { validateComponents, generateSitemapFromMarkdown } from "../../../src/domain/make/markdown-sitemap-import.js";
import type { ComponentMarkdown } from "../../../src/domain/make/markdown-sitemap-types.js";

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
