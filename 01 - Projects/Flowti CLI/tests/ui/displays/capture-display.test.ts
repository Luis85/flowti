import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "", UNDERLINE: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { renderSearchResults, renderImportResult } from "../../../src/ui/displays/capture-display.js";
import type { SearchResultsModel, ImportResultModel } from "../../../src/ui/displays/capture-display.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => { mockLog.mockClear(); });

// ── renderSearchResults ──────────────────────────────────────────────

describe("renderSearchResults", () => {
	it("renders empty message when no results", () => {
		renderSearchResults({ query: "test", results: [] });
		expect(output()).toContain('No captures matching "test"');
	});

	it("renders singular 'capture' for one result", () => {
		const data: SearchResultsModel = {
			query: "bug",
			results: [{ file: "a.md", title: "My Bug", type: "Bug", date: "2026-01-01", tags: [] }],
		};
		renderSearchResults(data);
		const out = output();
		expect(out).toContain("Found 1 capture:");
		expect(out).toContain("My Bug");
		expect(out).toContain("Bug");
	});

	it("renders plural 'captures' for multiple results", () => {
		const data: SearchResultsModel = {
			query: "q",
			results: [
				{ file: "a.md", title: "A", type: "Note", date: "2026-01-01", tags: [] },
				{ file: "b.md", title: "B", type: "Task", date: "2026-01-02", tags: [] },
			],
		};
		renderSearchResults(data);
		expect(output()).toContain("Found 2 captures:");
	});

	it("renders tags when present", () => {
		const data: SearchResultsModel = {
			query: "q",
			results: [{ file: "a.md", title: "A", type: "Note", date: "", tags: ["foo", "bar"] }],
		};
		renderSearchResults(data);
		expect(output()).toContain("[foo, bar]");
	});

	it("does not render tags when empty", () => {
		const data: SearchResultsModel = {
			query: "q",
			results: [{ file: "a.md", title: "A", type: "Note", date: "", tags: [] }],
		};
		renderSearchResults(data);
		expect(output()).not.toContain("[");
	});

	it("renders type for each result", () => {
		const data: SearchResultsModel = {
			query: "q",
			results: [
				{ file: "a.md", title: "A", type: "Idea", date: "", tags: [] },
				{ file: "b.md", title: "B", type: "Bug", date: "", tags: [] },
			],
		};
		renderSearchResults(data);
		const out = output();
		expect(out).toContain("Idea");
		expect(out).toContain("Bug");
	});
});

// ── renderImportResult ───────────────────────────────────────────────

describe("renderImportResult", () => {
	it("renders singular item for 1 created", () => {
		renderImportResult({ created: 1, skipped: 0 });
		expect(output()).toContain("Imported 1 item");
		expect(output()).not.toContain("items");
	});

	it("renders plural items for multiple created", () => {
		renderImportResult({ created: 5, skipped: 0 });
		expect(output()).toContain("Imported 5 items");
	});

	it("renders skipped count when > 0", () => {
		renderImportResult({ created: 3, skipped: 2 });
		expect(output()).toContain("2 skipped");
	});

	it("does not render skipped when 0", () => {
		renderImportResult({ created: 3, skipped: 0 });
		expect(output()).not.toContain("skipped");
	});

	it("renders zero created", () => {
		renderImportResult({ created: 0, skipped: 4 });
		expect(output()).toContain("Imported 0 items");
		expect(output()).toContain("4 skipped");
	});
});
