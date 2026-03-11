import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/frontmatter.js", () => ({
	parseFrontmatterContent: vi.fn(() => null),
}));

import { scanDir } from "../../../../src/domain/reports/generators/trace-report.js";
import { parseFrontmatterContent } from "../../../../src/infrastructure/frontmatter.js";

function makeDeps(files: Record<string, string> = {}, dirEntries: string[] = []) {
	return {
		disk: {
			existsSync: vi.fn((p: string) => p in files || dirEntries.length > 0),
			readdirSync: vi.fn(() => dirEntries),
			readFileSync: vi.fn((p: string) => files[p] ?? ""),
		} as any,
		paths: {
			join: (...args: string[]) => args.join("/"),
		} as any,
	};
}

describe("scanDir", () => {
	beforeEach(() => {
		vi.mocked(parseFrontmatterContent).mockReset();
		vi.mocked(parseFrontmatterContent).mockReturnValue(null);
	});

	it("returns empty array when dir doesn't exist", () => {
		const deps = makeDeps({}, []);
		deps.disk.existsSync = vi.fn(() => false);

		const result = scanDir("/some/dir", "story", deps);

		expect(result).toEqual([]);
		expect(deps.disk.readdirSync).not.toHaveBeenCalled();
	});

	it("returns empty array when no .md files", () => {
		const deps = makeDeps({}, ["readme.txt", "image.png", "notes.json"]);

		const result = scanDir("/some/dir", "story", deps);

		expect(result).toEqual([]);
	});

	it("returns results for files with valid frontmatter", () => {
		const fm = { title: "Test Story", status: "done" };
		vi.mocked(parseFrontmatterContent).mockReturnValue(fm);

		const deps = makeDeps(
			{ "/some/dir/US-001.md": "---\ntitle: Test Story\nstatus: done\n---" },
			["US-001.md"],
		);

		const result = scanDir("/some/dir", "story", deps);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({ id: "US-001", type: "story", frontmatter: fm });
	});

	it("skips files without frontmatter", () => {
		vi.mocked(parseFrontmatterContent).mockReturnValue(null);

		const deps = makeDeps(
			{ "/some/dir/US-001.md": "no frontmatter here" },
			["US-001.md"],
		);

		const result = scanDir("/some/dir", "story", deps);

		expect(result).toEqual([]);
	});

	it("strips .md extension from filename for id", () => {
		const fm = { title: "My Feature" };
		vi.mocked(parseFrontmatterContent).mockReturnValue(fm);

		const deps = makeDeps(
			{ "/docs/FEAT-42.md": "---\ntitle: My Feature\n---" },
			["FEAT-42.md"],
		);

		const result = scanDir("/docs", "feature", deps);

		expect(result[0].id).toBe("FEAT-42");
	});

	it("filters out non-.md files", () => {
		const fm = { title: "Story" };
		vi.mocked(parseFrontmatterContent).mockReturnValue(fm);

		const deps = makeDeps(
			{ "/docs/story.md": "---\ntitle: Story\n---" },
			["story.md", "image.png", "config.json", "notes.txt"],
		);

		const result = scanDir("/docs", "story", deps);

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("story");
		expect(deps.disk.readFileSync).toHaveBeenCalledTimes(1);
	});

	it("sets docType from the parameter on each result", () => {
		const fm = { title: "A" };
		vi.mocked(parseFrontmatterContent).mockReturnValue(fm);

		const deps = makeDeps(
			{
				"/dir/one.md": "---\ntitle: A\n---",
				"/dir/two.md": "---\ntitle: A\n---",
			},
			["one.md", "two.md"],
		);

		const result = scanDir("/dir", "acceptance-test", deps);

		expect(result).toHaveLength(2);
		expect(result.every((r) => r.type === "acceptance-test")).toBe(true);
	});
});
