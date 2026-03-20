import { describe, it, expect } from "vitest";
import { parseFrontmatter, serializeFrontmatter } from "../../../src/domain/projects/frontmatter.js";

describe("parseFrontmatter", () => {
	it("parses YAML frontmatter from markdown", () => {
		const md = "---\ntype: Domain\nname: User Management\nstatus: active\n---\n\n# User Management\n\nDescription.";
		const result = parseFrontmatter(md);
		expect(result.fields).toEqual({ type: "Domain", name: "User Management", status: "active" });
		expect(result.body).toBe("# User Management\n\nDescription.");
	});

	it("returns empty fields when no frontmatter", () => {
		const result = parseFrontmatter("# Just a heading");
		expect(result.fields).toEqual({});
		expect(result.body).toBe("# Just a heading");
	});

	it("handles comma-separated values as strings", () => {
		const md = "---\nproducers: AuthService, NotificationService\n---\n\nBody";
		const result = parseFrontmatter(md);
		expect(result.fields.producers).toBe("AuthService, NotificationService");
	});

	it("handles frontmatter-only file with no trailing newline", () => {
		const md = "---\ntype: Domain\nname: Auth\n---";
		const result = parseFrontmatter(md);
		expect(result.fields).toEqual({ type: "Domain", name: "Auth" });
		expect(result.body).toBe("");
	});

	it("handles Windows line endings", () => {
		const md = "---\r\ntype: Event\r\nname: foo\r\n---\r\n\r\nBody";
		const result = parseFrontmatter(md);
		expect(result.fields).toEqual({ type: "Event", name: "foo" });
		expect(result.body).toBe("Body");
	});
});

describe("serializeFrontmatter", () => {
	it("serializes fields and body into markdown", () => {
		const result = serializeFrontmatter({ type: "Domain", name: "Auth" }, "# Auth\n\nService.");
		expect(result).toBe("---\ntype: Domain\nname: Auth\n---\n\n# Auth\n\nService.");
	});

	it("skips undefined values", () => {
		const result = serializeFrontmatter({ name: "Foo", domain: undefined }, "Body");
		expect(result).toBe("---\nname: Foo\n---\n\nBody");
	});

	it("produces valid output with empty body", () => {
		const result = serializeFrontmatter({ type: "Flow" }, "");
		expect(result).toBe("---\ntype: Flow\n---\n\n");
	});
});
