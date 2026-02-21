import { describe, it, expect, beforeEach } from "vitest";
import type { WorkItemMapping } from "../../../src/domain/signal/types";
import { htmlToMarkdown } from "../../../src/domain/signal/mappers/htmlToMarkdown";
import {
	toNoteFrontmatter,
	toNoteContent,
	toNotePath,
	writeWorkItemNote,
} from "../../../src/domain/signal/mappers/workItemNoteMapper";
import { createMockFileSystem } from "../../mocks/filesystem";

// ── Helpers ───────────────────────────────────────────────────

function makeMapping(overrides: Partial<WorkItemMapping> = {}): WorkItemMapping {
	return {
		id: 42,
		rev: 3,
		type: "Bug",
		title: "Fix login button",
		state: "Active",
		assignedTo: "Jane Doe",
		areaPath: "MyProject\\Area1",
		iterationPath: "MyProject\\Sprint 1",
		priority: 2,
		tags: ["frontend", "urgent"],
		url: "https://dev.azure.com/org/proj/_workitems/edit/42",
		description: "<p>The login button is broken</p>",
		createdDate: "2026-02-01T10:00:00Z",
		changedDate: "2026-02-20T15:30:00Z",
		...overrides,
	};
}

// ── htmlToMarkdown ────────────────────────────────────────────

describe("htmlToMarkdown", () => {
	it("should convert <p> tags to paragraphs", () => {
		expect(htmlToMarkdown("<p>Hello</p><p>World</p>")).toBe("Hello\n\nWorld");
	});

	it("should convert <br> variants to newlines", () => {
		expect(htmlToMarkdown("Line 1<br>Line 2<br/>Line 3<br />Line 4")).toBe(
			"Line 1\nLine 2\nLine 3\nLine 4",
		);
	});

	it("should convert <strong> and <b> to bold", () => {
		expect(htmlToMarkdown("<strong>bold</strong> and <b>also bold</b>")).toBe(
			"**bold** and **also bold**",
		);
	});

	it("should convert <em> and <i> to italic", () => {
		expect(htmlToMarkdown("<em>italic</em> and <i>also italic</i>")).toBe(
			"*italic* and *also italic*",
		);
	});

	it("should convert <code> to inline code", () => {
		expect(htmlToMarkdown("Use <code>npm test</code> to run")).toBe(
			"Use `npm test` to run",
		);
	});

	it("should convert <pre> to fenced code block", () => {
		const result = htmlToMarkdown("<pre><code>const x = 1;</code></pre>");
		expect(result).toContain("```");
		expect(result).toContain("const x = 1;");
	});

	it("should convert <a> to markdown links", () => {
		expect(htmlToMarkdown('<a href="https://example.com">click</a>')).toBe(
			"[click](https://example.com)",
		);
	});

	it("should convert <img> to markdown images", () => {
		expect(htmlToMarkdown('<img src="photo.jpg" alt="A photo">')).toBe(
			"![A photo](photo.jpg)",
		);
	});

	it("should convert <ul> + <li> to unordered list", () => {
		const result = htmlToMarkdown("<ul><li>Alpha</li><li>Beta</li></ul>");
		expect(result).toContain("- Alpha");
		expect(result).toContain("- Beta");
	});

	it("should convert <ol> + <li> to ordered list", () => {
		const result = htmlToMarkdown("<ol><li>First</li><li>Second</li></ol>");
		expect(result).toContain("1. First");
		expect(result).toContain("2. Second");
	});

	it("should convert headings", () => {
		expect(htmlToMarkdown("<h1>Title</h1>")).toContain("# Title");
		expect(htmlToMarkdown("<h2>Sub</h2>")).toContain("## Sub");
		expect(htmlToMarkdown("<h3>Deep</h3>")).toContain("### Deep");
	});

	it("should unwrap <div> tags", () => {
		expect(htmlToMarkdown("<div>Content inside div</div>")).toContain("Content inside div");
		expect(htmlToMarkdown("<div>Content inside div</div>")).not.toContain("<div>");
	});

	it("should strip <table> to plain text", () => {
		const result = htmlToMarkdown("<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>");
		expect(result).toContain("Cell 1");
		expect(result).toContain("Cell 2");
		expect(result).not.toContain("<table>");
		expect(result).not.toContain("<td>");
	});

	it("should handle empty input", () => {
		expect(htmlToMarkdown("")).toBe("");
		expect(htmlToMarkdown(null as unknown as string)).toBe("");
		expect(htmlToMarkdown(undefined as unknown as string)).toBe("");
	});

	it("should decode HTML entities", () => {
		expect(htmlToMarkdown("&amp; &lt; &gt; &quot; &#39;")).toBe('& < > " \'');
	});

	it("should strip unknown HTML tags", () => {
		expect(htmlToMarkdown("<span class='x'>text</span>")).toBe("text");
	});
});

// ── toNoteFrontmatter ─────────────────────────────────────────

describe("toNoteFrontmatter", () => {
	it("should include all required fields", () => {
		const fm = toNoteFrontmatter(makeMapping(), "sig_abc");

		expect(fm.id).toBe(42);
		expect(fm.type).toBe("Bug");
		expect(fm.state).toBe("Active");
		expect(fm.assignedTo).toBe("Jane Doe");
		expect(fm.areaPath).toBe("MyProject\\Area1");
		expect(fm.iterationPath).toBe("MyProject\\Sprint 1");
		expect(fm.priority).toBe(2);
		expect(fm.tags).toEqual(["frontend", "urgent"]);
		expect(fm.url).toBe("https://dev.azure.com/org/proj/_workitems/edit/42");
	});

	it("should include signalSource and lastSynced", () => {
		const fm = toNoteFrontmatter(makeMapping(), "sig_xyz");

		expect(fm.signalSource).toBe("sig_xyz");
		expect(fm.lastSynced).toBeDefined();
		expect(typeof fm.lastSynced).toBe("string");
		// ISO timestamp format
		expect(fm.lastSynced as string).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});
});

// ── toNoteContent ─────────────────────────────────────────────

describe("toNoteContent", () => {
	it("should produce valid frontmatter + heading + body", () => {
		const content = toNoteContent(makeMapping(), "sig_test");

		// Frontmatter delimiters
		expect(content).toMatch(/^---\n/);
		expect(content).toContain("\n---\n");

		// Key frontmatter fields
		expect(content).toContain("id: 42");
		expect(content).toContain('type: "Bug"');
		expect(content).toContain('state: "Active"');
		expect(content).toContain('signalSource: "sig_test"');

		// Tags as YAML list
		expect(content).toContain('  - "frontend"');
		expect(content).toContain('  - "urgent"');

		// Heading
		expect(content).toContain("# Fix login button");

		// Body (HTML converted)
		expect(content).toContain("The login button is broken");
		expect(content).not.toContain("<p>");
	});

	it("should handle empty tags array", () => {
		const content = toNoteContent(makeMapping({ tags: [] }), "sig_test");
		expect(content).toContain("tags: []");
	});
});

// ── toNotePath ────────────────────────────────────────────────

describe("toNotePath", () => {
	it("should follow {id} - {title}.md pattern", () => {
		const path = toNotePath(makeMapping(), "signals/items");
		expect(path).toBe("signals/items/42 - Fix login button.md");
	});

	it("should sanitize illegal characters from title", () => {
		const path = toNotePath(makeMapping({ title: 'Fix: "login" <bug> #1' }), "folder");
		expect(path).not.toContain(":");
		expect(path).not.toContain('"');
		expect(path).not.toContain("<");
		expect(path).not.toContain(">");
		expect(path).not.toContain("#");
		expect(path).toContain("42 -");
		expect(path).toMatch(/\.md$/);
	});

	it("should truncate long titles to 80 characters", () => {
		const longTitle = "A".repeat(200);
		const path = toNotePath(makeMapping({ title: longTitle }), "folder");
		// "folder/{id} - {80 chars}.md" — title portion is 80 chars max
		const filename = path.split("/").pop()!;
		const titlePart = filename.replace(/^\d+ - /, "").replace(/\.md$/, "");
		expect(titlePart.length).toBeLessThanOrEqual(80);
	});

	it("should handle empty title", () => {
		const path = toNotePath(makeMapping({ title: "" }), "folder");
		expect(path).toContain("Untitled");
		expect(path).toMatch(/\.md$/);
	});
});

// ── writeWorkItemNote ─────────────────────────────────────────

describe("writeWorkItemNote", () => {
	const config = { id: "sig_test", targetFolder: "signals/items", conflictStrategy: "update" as const };

	it("should create new note when file does not exist", async () => {
		const fs = createMockFileSystem();

		const result = await writeWorkItemNote(makeMapping(), config, fs);

		expect(result.action).toBe("created");
		expect(result.path).toContain("42 - Fix login button.md");
		expect(fs.createFile).toHaveBeenCalledOnce();
		expect(fs.createFile).toHaveBeenCalledWith(
			result.path,
			expect.stringContaining("id: 42"),
			{ createFolders: true },
		);
	});

	it("should skip when file exists and strategy is 'skip'", async () => {
		const path = "signals/items/42 - Fix login button.md";
		const fs = createMockFileSystem({ [path]: "existing content" });

		const result = await writeWorkItemNote(
			makeMapping(),
			{ ...config, conflictStrategy: "skip" },
			fs,
		);

		expect(result.action).toBe("skipped");
		expect(fs.createFile).not.toHaveBeenCalled();
		expect(fs.updateFile).not.toHaveBeenCalled();
		expect(fs.updateFrontmatter).not.toHaveBeenCalled();
	});

	it("should update frontmatter only when strategy is 'update'", async () => {
		const path = "signals/items/42 - Fix login button.md";
		const fs = createMockFileSystem({ [path]: "existing content" });

		const result = await writeWorkItemNote(
			makeMapping(),
			{ ...config, conflictStrategy: "update" },
			fs,
		);

		expect(result.action).toBe("updated");
		expect(fs.updateFrontmatter).toHaveBeenCalledOnce();
		expect(fs.updateFrontmatter).toHaveBeenCalledWith(
			path,
			expect.objectContaining({ id: 42, type: "Bug", signalSource: "sig_test" }),
		);
		expect(fs.updateFile).not.toHaveBeenCalled();
	});

	it("should overwrite entirely when strategy is 'overwrite'", async () => {
		const path = "signals/items/42 - Fix login button.md";
		const fs = createMockFileSystem({ [path]: "existing content" });

		const result = await writeWorkItemNote(
			makeMapping(),
			{ ...config, conflictStrategy: "overwrite" },
			fs,
		);

		expect(result.action).toBe("updated");
		expect(fs.updateFile).toHaveBeenCalledOnce();
		expect(fs.updateFile).toHaveBeenCalledWith(
			path,
			expect.stringContaining("# Fix login button"),
		);
		expect(fs.updateFrontmatter).not.toHaveBeenCalled();
	});

	it("should pass createFolders option on create", async () => {
		const fs = createMockFileSystem();

		await writeWorkItemNote(makeMapping(), config, fs);

		expect(fs.createFile).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			{ createFolders: true },
		);
	});
});
