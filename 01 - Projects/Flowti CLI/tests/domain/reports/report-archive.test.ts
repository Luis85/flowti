import { describe, it, expect, vi } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

vi.mock("../../../src/infrastructure/paths.js", async () => {
	const path = await import("node:path");
	return { paths: { ...path, sep: "/" } };
});

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", DIM: "", BOLD: "", CYAN: "", GREEN: "", RED: "", YELLOW: "",
}));

vi.mock("../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn() },
}));

import * as fsMod from "../../../src/infrastructure/filesystem.js";
import { discoverArchiveCategories } from "../../../src/domain/reports/report-archive.js";

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
}

describe("discoverArchiveCategories", () => {
	it("discovers categories with timestamped .md files", () => {
		const fs = createMockFs({
			"/reports/tests/2026-03-08-test-report.md": "# Test",
			"/reports/tests/2026-03-07-test-report.md": "# Test",
			"/reports/coverage/2026-03-08-coverage.md": "# Coverage",
		});
		setDisk(fs);

		const categories = discoverArchiveCategories("/reports");
		expect(categories).toHaveLength(2);
		expect(categories[0].label).toBe("Tests");
		expect(categories[0].files).toHaveLength(2);
		// Most recent first
		expect(categories[0].files[0]).toBe("2026-03-08-test-report.md");
		expect(categories[1].label).toBe("Coverage");
		expect(categories[1].files).toHaveLength(1);
	});

	it("returns empty array when no reports exist", () => {
		setDisk(createMockFs());
		expect(discoverArchiveCategories("/reports")).toEqual([]);
	});

	it("ignores non-timestamped markdown files", () => {
		const fs = createMockFs({
			"/reports/tests/README.md": "readme",
			"/reports/tests/Stable Report.md": "stable",
		});
		setDisk(fs);

		expect(discoverArchiveCategories("/reports")).toEqual([]);
	});

	it("ignores non-md files", () => {
		const fs = createMockFs({
			"/reports/tests/2026-03-08-test-report.json": "{}",
		});
		setDisk(fs);

		expect(discoverArchiveCategories("/reports")).toEqual([]);
	});

	it("skips empty subdirectories", () => {
		const fs = createMockFs({
			"/reports/tests/2026-03-08-test.md": "# Test",
			// coverage dir exists but empty — no files match
		});
		setDisk(fs);

		const categories = discoverArchiveCategories("/reports");
		expect(categories).toHaveLength(1);
		expect(categories[0].label).toBe("Tests");
	});

	it("sorts files most recent first", () => {
		const fs = createMockFs({
			"/reports/builds/2026-01-01-build.md": "old",
			"/reports/builds/2026-03-08-build.md": "new",
			"/reports/builds/2026-02-15-build.md": "mid",
		});
		setDisk(fs);

		const categories = discoverArchiveCategories("/reports");
		expect(categories[0].files[0]).toBe("2026-03-08-build.md");
		expect(categories[0].files[1]).toBe("2026-02-15-build.md");
		expect(categories[0].files[2]).toBe("2026-01-01-build.md");
	});
});
