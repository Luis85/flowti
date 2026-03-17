// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnalyticsResultsPanel } from "../../../src/ui/hub/AnalyticsResultsPanel";
import type { AnalyticsResult } from "../../../src/domain/analytics/types";

function makeResult(overrides: Partial<AnalyticsResult> = {}): AnalyticsResult {
	return {
		columns: ["Category", "SUM(Amount)"],
		rows: [
			{ Category: "Electronics", "SUM(Amount)": 500 },
			{ Category: "Books", "SUM(Amount)": 150 },
			{ Category: "Clothing", "SUM(Amount)": 300 },
		],
		groupCount: 3,
		sourceRowCount: 100,
		...overrides,
	};
}

describe("AnalyticsResultsPanel", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
	});

	// ── Stat cards ────────────────────────────────────────────

	describe("stat cards", () => {
		it("renders stat cards with row count, groups, and source rows", () => {
			const panel = new AnalyticsResultsPanel(container, { result: makeResult() });
			panel.render();

			const statValues = container.querySelectorAll(".ft-catalog-stat-value");
			expect(statValues.length).toBeGreaterThanOrEqual(3);

			const values = Array.from(statValues).map((el) => el.textContent);
			expect(values).toContain("3"); // rows
			expect(values).toContain("3"); // groups
			expect(values).toContain("100"); // source rows
		});

		it("renders duration stat when durationMs is provided", () => {
			const panel = new AnalyticsResultsPanel(container, {
				result: makeResult(),
				durationMs: 42,
			});
			panel.render();

			const statValues = container.querySelectorAll(".ft-catalog-stat-value");
			const values = Array.from(statValues).map((el) => el.textContent);
			expect(values).toContain("42ms");
		});

		it("omits duration stat when durationMs is undefined", () => {
			const panel = new AnalyticsResultsPanel(container, { result: makeResult() });
			panel.render();

			const statLabels = container.querySelectorAll(".ft-catalog-stat-label");
			const labels = Array.from(statLabels).map((el) => el.textContent);
			expect(labels).not.toContain("Duration");
		});
	});

	// ── Results table ─────────────────────────────────────────

	describe("results table", () => {
		it("renders table headers matching result columns", () => {
			const panel = new AnalyticsResultsPanel(container, { result: makeResult() });
			panel.render();

			const ths = container.querySelectorAll("th");
			expect(ths.length).toBe(2);
			expect(ths[0].textContent).toContain("Category");
			expect(ths[1].textContent).toContain("SUM(Amount)");
		});

		it("renders all data rows", () => {
			const panel = new AnalyticsResultsPanel(container, { result: makeResult() });
			panel.render();

			const trs = container.querySelectorAll("tbody tr");
			expect(trs.length).toBe(3);
		});

		it("renders cell values correctly", () => {
			const panel = new AnalyticsResultsPanel(container, { result: makeResult() });
			panel.render();

			const tds = container.querySelectorAll("tbody td");
			expect(tds[0].textContent).toBe("Electronics");
		});

		it("shows empty state when no rows", () => {
			const panel = new AnalyticsResultsPanel(container, {
				result: makeResult({ rows: [], groupCount: 0, sourceRowCount: 0 }),
			});
			panel.render();

			expect(container.textContent).toContain("Query returned no results");
		});

		it("truncates at 100 rows and shows overflow message", () => {
			const rows = Array.from({ length: 150 }, (_, i) => ({
				Category: `Cat-${i}`,
				"SUM(Amount)": i * 10,
			}));
			const panel = new AnalyticsResultsPanel(container, {
				result: makeResult({ rows, groupCount: 150 }),
			});
			panel.render();

			const trs = container.querySelectorAll("tbody tr");
			expect(trs.length).toBe(100);
			expect(container.textContent).toContain("Showing 100 of 150 rows");
		});
	});

	// ── Sorting ───────────────────────────────────────────────

	describe("sorting", () => {
		it("sorts ascending on first column click", () => {
			const panel = new AnalyticsResultsPanel(container, { result: makeResult() });
			panel.render();

			// Click the "Category" header
			const ths = container.querySelectorAll("th");
			(ths[0] as HTMLElement).click();

			// Re-rendered — check row order
			const cells = container.querySelectorAll("tbody tr td:first-child");
			const values = Array.from(cells).map((el) => el.textContent);
			expect(values).toEqual(["Books", "Clothing", "Electronics"]);
		});

		it("toggles to descending on second click", () => {
			const panel = new AnalyticsResultsPanel(container, { result: makeResult() });
			panel.render();

			const ths = container.querySelectorAll("th");
			(ths[0] as HTMLElement).click();
			(ths[0] as HTMLElement).click();

			const cells = container.querySelectorAll("tbody tr td:first-child");
			const values = Array.from(cells).map((el) => el.textContent);
			expect(values).toEqual(["Electronics", "Clothing", "Books"]);
		});

		it("sorts numeric columns correctly", () => {
			const panel = new AnalyticsResultsPanel(container, { result: makeResult() });
			panel.render();

			// Click the SUM(Amount) header
			const ths = container.querySelectorAll("th");
			(ths[1] as HTMLElement).click();

			const cells = container.querySelectorAll("tbody tr td:nth-child(2)");
			const values = Array.from(cells).map((el) => el.textContent);
			// Ascending: 150, 300, 500 (using toLocaleString)
			expect(values[0]).toContain("150");
			expect(values[2]).toContain("500");
		});

		it("shows sort indicator on sorted column", () => {
			const panel = new AnalyticsResultsPanel(container, { result: makeResult() });
			panel.render();

			const ths = container.querySelectorAll("th");
			(ths[0] as HTMLElement).click();

			// After click triggers re-render, re-query the DOM
			const updatedThs = container.querySelectorAll("th");
			expect(updatedThs[0].textContent).toContain("\u25B2"); // ascending arrow
		});
	});

	// ── Export CSV ─────────────────────────────────────────────

	describe("export CSV", () => {
		it("renders export button when onExportCsv is provided", () => {
			const panel = new AnalyticsResultsPanel(container, {
				result: makeResult(),
				onExportCsv: vi.fn(),
			});
			panel.render();

			expect(container.textContent).toContain("Export CSV");
		});

		it("does not render export button when onExportCsv is not provided", () => {
			const panel = new AnalyticsResultsPanel(container, { result: makeResult() });
			panel.render();

			expect(container.textContent).not.toContain("Export CSV");
		});

		it("calls onExportCsv with CSV string when clicked", () => {
			const onExport = vi.fn();
			const panel = new AnalyticsResultsPanel(container, {
				result: makeResult(),
				onExportCsv: onExport,
			});
			panel.render();

			const exportLink = container.querySelector(".ft-detail-actions .ft-nav-link") as HTMLElement;
			exportLink.click();

			expect(onExport).toHaveBeenCalledOnce();
			const csv = onExport.mock.calls[0][0] as string;
			expect(csv).toContain("Category,SUM(Amount)");
			expect(csv).toContain("Electronics,500");
			expect(csv).toContain("Books,150");
		});

		it("escapes CSV fields with commas", () => {
			const result = makeResult({
				rows: [{ Category: "Books, Games", "SUM(Amount)": 100 }],
				groupCount: 1,
			});
			const onExport = vi.fn();
			const panel = new AnalyticsResultsPanel(container, {
				result,
				onExportCsv: onExport,
			});
			panel.render();

			const exportLink = container.querySelector(".ft-detail-actions .ft-nav-link") as HTMLElement;
			exportLink.click();

			const csv = onExport.mock.calls[0][0] as string;
			expect(csv).toContain('"Books, Games"');
		});
	});
});
