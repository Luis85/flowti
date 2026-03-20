import { describe, it, expect } from "vitest";
import {
	generateDomainMarkdown,
	generateServiceMarkdown,
	generateEventMarkdown,
	generateFlowMarkdown,
	parseEntityFromMarkdown,
	toKebabCase,
} from "../../../src/domain/projects/catalog-service.js";
import type { CatalogEntityDef } from "../../../src/domain/projects/types.js";

describe("toKebabCase", () => {
	it("converts name to kebab-case", () => {
		expect(toKebabCase("User Management")).toBe("user-management");
	});

	it("handles special characters", () => {
		expect(toKebabCase("Auth & Identity")).toBe("auth-identity");
	});
});

describe("generateDomainMarkdown", () => {
	it("generates domain markdown with frontmatter", () => {
		const def: CatalogEntityDef = { name: "User Management", status: "active", description: "Handles users." };
		const md = generateDomainMarkdown(def, "2026-03-20");
		expect(md).toContain("type: Domain");
		expect(md).toContain("name: User Management");
		expect(md).toContain("# User Management");
		expect(md).toContain("## Services");
		expect(md).toContain("## Events");
	});
});

describe("generateServiceMarkdown", () => {
	it("generates service markdown with producers/consumers", () => {
		const def: CatalogEntityDef = { name: "AuthService", domain: "User Management", producers: "user.created", consumers: "session.expired" };
		const md = generateServiceMarkdown(def, "2026-03-20");
		expect(md).toContain("type: Service");
		expect(md).toContain("domain: User Management");
		expect(md).toContain("## Produces");
		expect(md).toContain("- user.created");
		expect(md).toContain("## Consumes");
		expect(md).toContain("- session.expired");
	});
});

describe("generateEventMarkdown", () => {
	it("generates event markdown with version and payload section", () => {
		const def: CatalogEntityDef = { name: "user.created", domain: "user", version: "1.0.0", producers: "AuthService", consumers: "Analytics" };
		const md = generateEventMarkdown(def, "2026-03-20");
		expect(md).toContain("type: Event");
		expect(md).toContain("version: 1.0.0");
		expect(md).toContain("## Payload");
		expect(md).toContain("## Version History");
	});
});

describe("generateFlowMarkdown", () => {
	it("generates flow markdown with steps section", () => {
		const def: CatalogEntityDef = { name: "User Onboarding", domain: "User Management", description: "Onboarding flow." };
		const md = generateFlowMarkdown(def, "2026-03-20");
		expect(md).toContain("type: Flow");
		expect(md).toContain("## Steps");
	});
});

describe("parseEntityFromMarkdown", () => {
	it("parses entity metadata from markdown", () => {
		const md = "---\ntype: Domain\nname: Auth\nstatus: active\ndate: 2026-03-20\n---\n\n# Auth";
		const entity = parseEntityFromMarkdown(md, "docs/catalog/domains/auth.md");
		expect(entity).toEqual({
			name: "Auth",
			type: "Domain",
			status: "active",
			date: "2026-03-20",
			domain: undefined,
			path: "docs/catalog/domains/auth.md",
		});
	});

	it("includes domain when present", () => {
		const md = "---\ntype: Service\nname: API\ndomain: Core\nstatus: draft\ndate: 2026-03-20\n---\n\nBody";
		const entity = parseEntityFromMarkdown(md, "path.md");
		expect(entity?.domain).toBe("Core");
	});

	it("returns null for invalid frontmatter", () => {
		expect(parseEntityFromMarkdown("no frontmatter", "path.md")).toBeNull();
	});
});
