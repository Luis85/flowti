// tests/components/agents/simple-markdown.test.ts
import { describe, it, expect } from "vitest";
import { simpleMarkdown } from "../../../src/components/agents/simple-markdown.js";

describe("simpleMarkdown", () => {
	it("converts h1-h4 headers", () => {
		expect(simpleMarkdown("# Heading 1")).toContain("<h1>Heading 1</h1>");
		expect(simpleMarkdown("## Heading 2")).toContain("<h2>Heading 2</h2>");
		expect(simpleMarkdown("### Heading 3")).toContain("<h3>Heading 3</h3>");
		expect(simpleMarkdown("#### Heading 4")).toContain("<h4>Heading 4</h4>");
	});

	it("converts bold text", () => {
		expect(simpleMarkdown("This is **bold** text")).toContain("<strong>bold</strong>");
	});

	it("converts italic text", () => {
		expect(simpleMarkdown("This is *italic* text")).toContain("<em>italic</em>");
	});

	it("does not break bold when processing italic", () => {
		const result = simpleMarkdown("**bold** and *italic*");
		expect(result).toContain("<strong>bold</strong>");
		expect(result).toContain("<em>italic</em>");
	});

	it("converts inline code", () => {
		expect(simpleMarkdown("Use `console.log()` here")).toContain("<code>console.log()</code>");
	});

	it("converts fenced code blocks with language class", () => {
		const input = "```typescript\nconst x = 1;\n```";
		const result = simpleMarkdown(input);
		expect(result).toContain('<pre><code class="language-typescript">');
		expect(result).toContain("const x = 1;");
		expect(result).toContain("</code></pre>");
	});

	it("converts fenced code blocks without language", () => {
		const input = "```\nhello world\n```";
		const result = simpleMarkdown(input);
		expect(result).toContain("<pre><code>");
		expect(result).toContain("hello world");
	});

	it("does not transform markdown inside fenced code blocks", () => {
		const input = "```\n# not a heading\n**not bold**\n```";
		const result = simpleMarkdown(input);
		expect(result).not.toContain("<h1>");
		expect(result).not.toContain("<strong>");
		expect(result).toContain("# not a heading");
		expect(result).toContain("**not bold**");
	});

	it("groups consecutive list items into a single ul", () => {
		const input = "- first\n- second\n- third";
		const result = simpleMarkdown(input);
		expect(result).toContain("<ul>");
		expect(result).toContain("<li>first</li>");
		expect(result).toContain("<li>second</li>");
		expect(result).toContain("<li>third</li>");
		expect(result).toContain("</ul>");
		// Should only have one <ul>
		expect(result.match(/<ul>/g)?.length).toBe(1);
	});

	it("supports * as list marker", () => {
		const input = "* alpha\n* beta";
		const result = simpleMarkdown(input);
		expect(result).toContain("<li>alpha</li>");
		expect(result).toContain("<li>beta</li>");
	});

	it("escapes HTML entities to prevent XSS", () => {
		const input = '<script>alert("xss")</script>';
		const result = simpleMarkdown(input);
		expect(result).not.toContain("<script>");
		expect(result).toContain("&lt;script&gt;");
		expect(result).toContain("&amp;quot;");
	});

	it("converts blank lines to br", () => {
		const input = "first paragraph\n\nsecond paragraph";
		const result = simpleMarkdown(input);
		expect(result).toContain("<br/>");
	});

	it("renders mixed content correctly", () => {
		const input = [
			"# Title",
			"",
			"Some **bold** paragraph.",
			"",
			"```js",
			"const x = 1;",
			"```",
			"",
			"- item one",
			"- item two",
		].join("\n");
		const result = simpleMarkdown(input);
		expect(result).toContain("<h1>Title</h1>");
		expect(result).toContain("<strong>bold</strong>");
		expect(result).toContain('<pre><code class="language-js">');
		expect(result).toContain("<li>item one</li>");
		expect(result).toContain("<li>item two</li>");
	});

	it("passes through plain text unchanged (except wrapping)", () => {
		const result = simpleMarkdown("Hello world");
		expect(result).toContain("Hello world");
		expect(result).not.toContain("<h1>");
		expect(result).not.toContain("<strong>");
		expect(result).not.toContain("<em>");
	});
});
