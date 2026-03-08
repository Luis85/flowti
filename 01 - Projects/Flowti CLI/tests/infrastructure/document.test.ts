import { describe, it, expect } from "vitest";
import { yamlEscape, Document } from "../../src/infrastructure/document.js";

describe("yamlEscape", () => {
	it("returns 'null' for null", () => {
		expect(yamlEscape(null)).toBe("null");
	});

	it("returns 'null' for undefined", () => {
		expect(yamlEscape(undefined)).toBe("null");
	});

	it("returns string for booleans", () => {
		expect(yamlEscape(true)).toBe("true");
		expect(yamlEscape(false)).toBe("false");
	});

	it("returns string for numbers", () => {
		expect(yamlEscape(42)).toBe("42");
		expect(yamlEscape(3.14)).toBe("3.14");
	});

	it("returns plain string when safe", () => {
		expect(yamlEscape("hello")).toBe("hello");
	});

	it("quotes strings with special characters", () => {
		expect(yamlEscape("hello: world")).toBe('"hello: world"');
		expect(yamlEscape("line\nnewline")).toBe('"line\\nnewline"');
	});

	it("quotes strings with leading/trailing whitespace", () => {
		expect(yamlEscape(" leading")).toBe('" leading"');
		expect(yamlEscape("trailing ")).toBe('"trailing "');
	});
});

describe("Document", () => {
	describe("create", () => {
		it("creates a document with a name", () => {
			const doc = Document.create("Test");
			expect(doc.toString()).toBe("");
		});
	});

	describe("wikilink", () => {
		it("creates a simple wikilink", () => {
			expect(Document.wikilink("Page")).toBe("[[Page]]");
		});

		it("creates a wikilink with alias", () => {
			expect(Document.wikilink("Page", "alias")).toBe("[[Page|alias]]");
		});
	});

	describe("frontmatter", () => {
		it("renders YAML frontmatter", () => {
			const doc = Document.create("Test")
				.setFrontmatter("type", "Report")
				.setFrontmatter("version", 1);
			const output = doc.toString();
			expect(output).toContain("---");
			expect(output).toContain("type: Report");
			expect(output).toContain("version: 1");
		});

		it("merges frontmatter from object", () => {
			const doc = Document.create("Test")
				.mergeFrontmatter({ a: "1", b: "2" });
			const output = doc.toString();
			expect(output).toContain("a: 1");
			expect(output).toContain("b: 2");
		});

		it("renders array frontmatter", () => {
			const doc = Document.create("Test")
				.setTags(["foo", "bar"]);
			const output = doc.toString();
			expect(output).toContain("tags:");
			expect(output).toContain("  - foo");
			expect(output).toContain("  - bar");
		});
	});

	describe("body elements", () => {
		it("renders headings", () => {
			const doc = Document.create("Test")
				.heading(1, "Title")
				.heading(2, "Subtitle");
			expect(doc.toString()).toBe("# Title\n## Subtitle");
		});

		it("renders text", () => {
			const doc = Document.create("Test").text("Hello world");
			expect(doc.toString()).toBe("Hello world");
		});

		it("renders blank lines", () => {
			const doc = Document.create("Test")
				.text("A")
				.addBlank()
				.text("B");
			expect(doc.toString()).toBe("A\n\nB");
		});

		it("renders separators", () => {
			const doc = Document.create("Test").addSeparator();
			expect(doc.toString()).toBe("---");
		});

		it("renders callouts", () => {
			const doc = Document.create("Test")
				.callout("info", "Note", ["line 1", "line 2"]);
			const output = doc.toString();
			expect(output).toContain("> [!info] Note");
			expect(output).toContain("> line 1");
			expect(output).toContain("> line 2");
		});

		it("renders quotes", () => {
			const doc = Document.create("Test").quote("Quote text");
			expect(doc.toString()).toBe("> Quote text");
		});

		it("renders tables", () => {
			const doc = Document.create("Test")
				.table(["A", "B"], [["1", "2"], ["3", "4"]]);
			const output = doc.toString();
			expect(output).toContain("| A | B |");
			expect(output).toContain("|---|---|");
			expect(output).toContain("| 1 | 2 |");
		});

		it("renders tables with right-aligned columns", () => {
			const doc = Document.create("Test")
				.table(["Name", "Count"], [["a", "1"]], { alignRight: [1] });
			const output = doc.toString();
			expect(output).toContain("|---|---:|");
		});

		it("renders lists", () => {
			const doc = Document.create("Test").list(["a", "b", "c"]);
			expect(doc.toString()).toBe("- a\n- b\n- c");
		});

		it("renders ordered lists", () => {
			const doc = Document.create("Test").orderedList(["a", "b"]);
			expect(doc.toString()).toBe("1. a\n2. b");
		});

		it("renders code blocks", () => {
			const doc = Document.create("Test")
				.codeBlock("ts", "const x = 1;");
			const output = doc.toString();
			expect(output).toContain("```ts");
			expect(output).toContain("const x = 1;");
			expect(output).toContain("```");
		});
	});

	describe("toLines", () => {
		it("returns body as string array", () => {
			const doc = Document.create("Test")
				.heading(1, "Title")
				.addBlank()
				.text("Body text");
			const lines = doc.toLines();
			expect(lines).toEqual(["# Title", "", "Body text"]);
		});

		it("includes frontmatter lines", () => {
			const doc = Document.create("Test")
				.setFrontmatter("type", "Note")
				.addBlank()
				.heading(1, "Title");
			const lines = doc.toLines();
			expect(lines[0]).toBe("---");
			expect(lines).toContain("type: Note");
			expect(lines).toContain("# Title");
		});

		it("returns empty array for empty document", () => {
			const doc = Document.create("Empty");
			expect(doc.toLines()).toEqual([""]);
		});
	});

	describe("combined output", () => {
		it("renders frontmatter + body", () => {
			const doc = Document.create("Test")
				.setFrontmatter("type", "Note")
				.addBlank()
				.heading(1, "Title");
			const output = doc.toString();
			expect(output).toMatch(/^---\ntype: Note\n---\n/);
			expect(output).toContain("# Title");
		});
	});
});
