import { describe, it, expect, beforeEach } from "vitest";
import { loadHelpSection, listHelpSections, clearHelpCache } from "../../../src/domain/shared/help-loader.js";
import type { HelpLoaderDeps } from "../../../src/domain/shared/help-loader.js";

function createDeps(files: Record<string, string>): HelpLoaderDeps {
	return {
		disk: {
			existsSync: (p: string) => {
				if (Object.keys(files).some((k) => p.endsWith(k))) return true;
				if (Object.keys(files).length > 0 && !p.endsWith(".md")) return true;
				return false;
			},
			readFileSync: (p: string) => {
				const match = Object.entries(files).find(([k]) => p.endsWith(k));
				return match ? match[1] : "";
			},
			readdirSync: () => Object.keys(files),
		},
		paths: {
			join: (...args: string[]) => args.join("/"),
			basename: (p: string, ext?: string) => {
				const name = p.split("/").pop() ?? p;
				return ext && name.endsWith(ext) ? name.slice(0, -ext.length) : name;
			},
		},
	};
}

beforeEach(() => clearHelpCache());

describe("loadHelpSection", () => {
	it("returns file content for existing section", () => {
		const deps = createDeps({ "build.md": "# BUILD\nHelp content" });
		const result = loadHelpSection("/help", "build", deps);
		expect(result).toBe("# BUILD\nHelp content");
	});

	it("returns null for missing section", () => {
		const deps = createDeps({});
		deps.disk.existsSync = () => false;
		const result = loadHelpSection("/help", "nonexistent", deps);
		expect(result).toBeNull();
	});

	it("caches loaded content", () => {
		let readCount = 0;
		const deps = createDeps({ "main.md": "# MAIN" });
		const origRead = deps.disk.readFileSync;
		deps.disk.readFileSync = (...args: [string, string]) => { readCount++; return origRead(...args); };

		loadHelpSection("/help", "main", deps);
		loadHelpSection("/help", "main", deps);
		expect(readCount).toBe(1);
	});

	it("clearHelpCache resets the cache", () => {
		let readCount = 0;
		const deps = createDeps({ "main.md": "# MAIN" });
		const origRead = deps.disk.readFileSync;
		deps.disk.readFileSync = (...args: [string, string]) => { readCount++; return origRead(...args); };

		loadHelpSection("/help", "main", deps);
		clearHelpCache();
		loadHelpSection("/help", "main", deps);
		expect(readCount).toBe(2);
	});
});

describe("listHelpSections", () => {
	it("returns section names without .md extension", () => {
		const deps = createDeps({ "main.md": "", "build.md": "", "review.md": "" });
		const sections = listHelpSections("/help", deps);
		expect(sections).toEqual(["main", "build", "review"]);
	});

	it("returns empty array when directory missing", () => {
		const deps = createDeps({});
		deps.disk.existsSync = () => false;
		const sections = listHelpSections("/help", deps);
		expect(sections).toEqual([]);
	});

	it("filters to .md files only", () => {
		const deps = createDeps({ "main.md": "", "notes.txt": "", "build.md": "" });
		const sections = listHelpSections("/help", deps);
		expect(sections).toEqual(["main", "build"]);
	});
});
