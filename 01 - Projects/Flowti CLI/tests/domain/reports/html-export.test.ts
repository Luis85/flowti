import { describe, it, expect } from "vitest";
import {
	markdownToHtml,
	wrapHtml,
} from "../../../src/domain/reports/html-export.js";

// ── markdownToHtml ──────────────────────────────────────────────────

describe("markdownToHtml", () => {
	it("converts headings", () => {
		expect(markdownToHtml("# Title")).toContain("<h1>Title</h1>");
		expect(markdownToHtml("## Section")).toContain("<h2>Section</h2>");
		expect(markdownToHtml("### Sub")).toContain("<h3>Sub</h3>");
	});

	it("converts paragraphs", () => {
		expect(markdownToHtml("Hello world")).toContain("<p>Hello world</p>");
	});

	it("converts bold text", () => {
		const html = markdownToHtml("This is **bold** text");
		expect(html).toContain("<strong>bold</strong>");
	});

	it("converts italic text", () => {
		const html = markdownToHtml("This is *italic* text");
		expect(html).toContain("<em>italic</em>");
	});

	it("converts inline code", () => {
		const html = markdownToHtml("Use `npm test` to run");
		expect(html).toContain("<code>npm test</code>");
	});

	it("converts links", () => {
		const html = markdownToHtml("[Click here](https://example.com)");
		expect(html).toContain('<a href="https://example.com">Click here</a>');
	});

	it("converts horizontal rules", () => {
		expect(markdownToHtml("---")).toContain("<hr>");
	});

	it("converts unordered lists", () => {
		const html = markdownToHtml("- Item A\n- Item B\n- Item C");
		expect(html).toContain("<ul>");
		expect(html).toContain("<li>Item A</li>");
		expect(html).toContain("<li>Item B</li>");
		expect(html).toContain("</ul>");
	});

	it("converts ordered lists", () => {
		const html = markdownToHtml("1. First\n2. Second");
		expect(html).toContain("<ol>");
		expect(html).toContain("<li>First</li>");
		expect(html).toContain("</ol>");
	});

	it("converts tables", () => {
		const md = "| Name | Value |\n|------|-------|\n| A | 1 |\n| B | 2 |";
		const html = markdownToHtml(md);
		expect(html).toContain("<table>");
		expect(html).toContain("<th>Name</th>");
		expect(html).toContain("<td>A</td>");
		expect(html).toContain("<td>2</td>");
		expect(html).toContain("</table>");
	});

	it("converts blockquotes", () => {
		const html = markdownToHtml("> Some quote");
		expect(html).toContain("<blockquote>");
		expect(html).toContain("Some quote");
	});

	it("converts callout blocks", () => {
		const html = markdownToHtml("> [!warning] Be careful\n> This is important");
		expect(html).toContain("callout-warning");
		expect(html).toContain("Be careful");
		expect(html).toContain("This is important");
	});

	it("converts wikilinks to em", () => {
		const html = markdownToHtml("See [[My Note]]");
		expect(html).toContain("<em>My Note</em>");
	});

	it("escapes HTML entities", () => {
		const html = markdownToHtml("Use <script> & \"quotes\"");
		expect(html).toContain("&lt;script&gt;");
		expect(html).toContain("&amp;");
		expect(html).toContain("&quot;quotes&quot;");
	});

	it("handles empty input", () => {
		expect(markdownToHtml("")).toBe("");
	});

	it("closes open lists before headings", () => {
		const html = markdownToHtml("- Item\n## Heading");
		const ulClose = html.indexOf("</ul>");
		const h2Open = html.indexOf("<h2>");
		expect(ulClose).toBeLessThan(h2Open);
	});
});

// ── wrapHtml ────────────────────────────────────────────────────────

describe("wrapHtml", () => {
	it("produces valid HTML document", () => {
		const html = wrapHtml("Test Report", "<p>Content</p>");
		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("<title>Test Report</title>");
		expect(html).toContain("<p>Content</p>");
		expect(html).toContain("Flowti CLI");
	});

	it("includes inline CSS", () => {
		const html = wrapHtml("Title", "<p>Body</p>");
		expect(html).toContain("<style>");
		expect(html).toContain("font-family");
	});

	it("includes metadata when provided", () => {
		const html = wrapHtml("Title", "<p>Body</p>", { project: "my-app", score: 85 });
		expect(html).toContain("project");
		expect(html).toContain("my-app");
		expect(html).toContain("85");
	});

	it("omits metadata block when not provided", () => {
		const html = wrapHtml("Title", "<p>Body</p>");
		expect(html).not.toContain("class=\"meta\"");
	});

	it("escapes title in HTML", () => {
		const html = wrapHtml("Report <v2>", "<p>Body</p>");
		expect(html).toContain("Report &lt;v2&gt;");
	});
});
