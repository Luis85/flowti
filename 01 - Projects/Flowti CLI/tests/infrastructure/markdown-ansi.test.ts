import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "[R]", BOLD: "[B]", DIM: "[D]", CYAN: "[C]",
}));

import { renderMarkdownToAnsi } from "../../src/infrastructure/markdown-ansi.js";

describe("renderMarkdownToAnsi", () => {
	it("renders h1 headings as bold", () => {
		const result = renderMarkdownToAnsi("# Title");
		expect(result).toContain("[B]Title[R]");
	});

	it("renders h2 headings as bold", () => {
		const result = renderMarkdownToAnsi("## Section");
		expect(result).toContain("[B]Section[R]");
	});

	it("renders h3 headings as cyan", () => {
		const result = renderMarkdownToAnsi("### Subsection");
		expect(result).toContain("[C]Subsection[R]");
	});

	it("renders inline code as cyan", () => {
		const result = renderMarkdownToAnsi("Use `flowti build` to compile");
		expect(result).toContain("[C]flowti build[R]");
	});

	it("renders horizontal rules as dim separator", () => {
		const result = renderMarkdownToAnsi("---");
		expect(result).toContain("[D]");
		expect(result).toContain("────");
	});

	it("renders indented lines as dim", () => {
		const result = renderMarkdownToAnsi("    npm run build");
		expect(result).toContain("[D]");
		expect(result).toContain("npm run build");
	});

	it("renders plain text with leading indent", () => {
		const result = renderMarkdownToAnsi("Hello world");
		expect(result).toBe("  Hello world");
	});

	it("handles multiple lines", () => {
		const input = "# Title\nSome text\n---\n### Sub";
		const lines = renderMarkdownToAnsi(input).split("\n");
		expect(lines).toHaveLength(4);
	});

	it("handles empty input", () => {
		expect(renderMarkdownToAnsi("")).toBe("  ");
	});

	it("supports --- and *** and ___ as horizontal rules", () => {
		for (const rule of ["---", "***", "___"]) {
			const result = renderMarkdownToAnsi(rule);
			expect(result).toContain("────");
		}
	});

	it("renders multiple inline code spans", () => {
		const result = renderMarkdownToAnsi("Use `foo` or `bar`");
		expect(result).toContain("[C]foo[R]");
		expect(result).toContain("[C]bar[R]");
	});
});
