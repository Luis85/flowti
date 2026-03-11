import { describe, it, expect } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";
import { discoverArchiveCategories } from "../../../src/domain/reports/report-archive.js";
import path from "node:path";

function makeDeps(files: Record<string, string> = {}) {
	return {
		disk: createMockFs(files),
		paths: { ...path, sep: "/" } as typeof import("../../../src/infrastructure/types.js").IPaths extends never ? never : { join: (...args: string[]) => string; resolve: (...args: string[]) => string; dirname: (p: string) => string; basename: (p: string, ext?: string) => string; relative: (from: string, to: string) => string; extname: (p: string) => string; isAbsolute: (p: string) => boolean; sep: string },
	};
}

describe("discoverArchiveCategories", () => {
	it("discovers categories with timestamped .md files", () => {
		const deps = makeDeps({
			"/reports/tests/2026-03-08-test-report.md": "# Test",
			"/reports/tests/2026-03-07-test-report.md": "# Test",
			"/reports/coverage/2026-03-08-coverage.md": "# Coverage",
		});

		const categories = discoverArchiveCategories("/reports", deps);
		expect(categories).toHaveLength(2);
		expect(categories[0].label).toBe("Test");
		expect(categories[0].files).toHaveLength(2);
		// Most recent first
		expect(categories[0].files[0]).toBe("2026-03-08-test-report.md");
		expect(categories[1].label).toBe("Coverage");
		expect(categories[1].files).toHaveLength(1);
	});

	it("returns empty array when no reports exist", () => {
		const deps = makeDeps();
		expect(discoverArchiveCategories("/reports", deps)).toEqual([]);
	});

	it("ignores non-timestamped markdown files", () => {
		const deps = makeDeps({
			"/reports/tests/README.md": "readme",
			"/reports/tests/Stable Report.md": "stable",
		});

		expect(discoverArchiveCategories("/reports", deps)).toEqual([]);
	});

	it("ignores non-md files", () => {
		const deps = makeDeps({
			"/reports/tests/2026-03-08-test-report.json": "{}",
		});

		expect(discoverArchiveCategories("/reports", deps)).toEqual([]);
	});

	it("skips empty subdirectories", () => {
		const deps = makeDeps({
			"/reports/tests/2026-03-08-test.md": "# Test",
			// coverage dir exists but empty — no files match
		});

		const categories = discoverArchiveCategories("/reports", deps);
		expect(categories).toHaveLength(1);
		expect(categories[0].label).toBe("Test");
	});

	it("sorts files most recent first", () => {
		const deps = makeDeps({
			"/reports/builds/2026-01-01-build.md": "old",
			"/reports/builds/2026-03-08-build.md": "new",
			"/reports/builds/2026-02-15-build.md": "mid",
		});

		const categories = discoverArchiveCategories("/reports", deps);
		expect(categories[0].files[0]).toBe("2026-03-08-build.md");
		expect(categories[0].files[1]).toBe("2026-02-15-build.md");
		expect(categories[0].files[2]).toBe("2026-01-01-build.md");
	});
});
