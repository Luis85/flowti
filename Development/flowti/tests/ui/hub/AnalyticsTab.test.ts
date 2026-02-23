// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnalyticsTab } from "../../../src/ui/hub/AnalyticsTab";
import { createMockHubDeps } from "./testHelpers";
import type { HubComponentDeps, HubState } from "../../../src/ui/hub/types";
import type { CsvFileEntry } from "../../../src/ui/hub/types";
import type { AnalyticsResult } from "../../../src/domain/analytics/types";

function makeCsvFileEntry(overrides: Partial<CsvFileEntry> = {}): CsvFileEntry {
	return {
		path: "Data/sales.csv",
		name: "sales.csv",
		displayName: "sales.csv",
		importConfigs: [],
		exportConfigs: [],
		hasDoc: false,
		baseViews: [],
		...overrides,
	};
}

function createMockAnalyticsService() {
	const mockResult: AnalyticsResult = {
		columns: ["Category", "SUM(Amount)"],
		rows: [{ Category: "A", "SUM(Amount)": 100 }],
		groupCount: 1,
		sourceRowCount: 5,
	};
	return {
		loadCsv: vi.fn().mockResolvedValue({
			headers: ["Category", "Amount", "Date"],
			rows: [
				["A", "10", "2026-01-01"],
				["B", "20", "2026-01-02"],
				["A", "30", "2026-02-01"],
			],
		}),
		runQuery: vi.fn().mockResolvedValue(mockResult),
		listQueries: vi.fn().mockReturnValue([]),
	} as unknown as HubComponentDeps["analyticsService"];
}

describe("AnalyticsTab", () => {
	let masterEl: HTMLElement;
	let detailEl: HTMLElement;
	let deps: HubComponentDeps;
	let state: HubState;

	beforeEach(() => {
		masterEl = document.createElement("div");
		detailEl = document.createElement("div");
		({ deps, state } = createMockHubDeps());
	});

	// ── renderMaster ──────────────────────────────────────────

	describe("renderMaster", () => {
		it("shows Available CSVs header", () => {
			const tab = new AnalyticsTab(masterEl, detailEl, deps);
			tab.renderMaster();
			expect(masterEl.textContent).toContain("Available CSVs");
		});

		it("shows empty state when no CSV files exist", () => {
			const tab = new AnalyticsTab(masterEl, detailEl, deps);
			tab.renderMaster();
			expect(masterEl.textContent).toContain("No CSV files in vault");
		});

		it("lists CSV files from state", () => {
			state.csvFileEntries = [
				makeCsvFileEntry({ path: "Data/sales.csv", displayName: "sales.csv" }),
				makeCsvFileEntry({ path: "Data/orders.csv", displayName: "orders.csv" }),
			];
			const tab = new AnalyticsTab(masterEl, detailEl, deps);
			tab.renderMaster();

			expect(masterEl.textContent).toContain("sales.csv");
			expect(masterEl.textContent).toContain("orders.csv");
		});

		it("shows count badge for available CSVs", () => {
			state.csvFileEntries = [makeCsvFileEntry(), makeCsvFileEntry({ path: "b.csv", displayName: "b.csv" })];
			const tab = new AnalyticsTab(masterEl, detailEl, deps);
			tab.renderMaster();

			const countBadge = masterEl.querySelector(".ft-master-category-count");
			expect(countBadge).not.toBeNull();
			expect(countBadge!.textContent).toBe("2");
		});

		it("filters CSVs by filterText", () => {
			state.csvFileEntries = [
				makeCsvFileEntry({ path: "Data/sales.csv", displayName: "sales.csv" }),
				makeCsvFileEntry({ path: "Data/orders.csv", displayName: "orders.csv" }),
			];
			state.filterText = "sales";
			const tab = new AnalyticsTab(masterEl, detailEl, deps);
			tab.renderMaster();

			const items = masterEl.querySelectorAll(".ft-master-event-item");
			expect(items.length).toBe(1);
			expect(masterEl.textContent).toContain("sales.csv");
			expect(masterEl.textContent).not.toContain("orders.csv");
		});
	});

	// ── renderDetail ──────────────────────────────────────────

	describe("renderDetail", () => {
		it("shows empty state when no sources are selected", () => {
			state.currentPage = "analytics";
			const tab = new AnalyticsTab(masterEl, detailEl, deps);
			tab.renderDetail();

			expect(detailEl.textContent).toContain("Add a CSV source");
		});
	});

	// ── Source addition ───────────────────────────────────────

	describe("source addition", () => {
		it("clicking a CSV item adds it as a source", async () => {
			state.csvFileEntries = [makeCsvFileEntry()];
			deps.analyticsService = createMockAnalyticsService();
			const tab = new AnalyticsTab(masterEl, detailEl, deps);
			tab.renderMaster();

			// Click the CSV item
			const item = masterEl.querySelector(".ft-master-event-item") as HTMLElement;
			item.click();

			// Wait for async loadSourceData
			await vi.waitFor(() => {
				expect(deps.analyticsService!.loadCsv).toHaveBeenCalledWith("Data/sales.csv");
			});

			// Re-render to see the updated state
			tab.renderMaster();
			expect(masterEl.textContent).toContain("Query Sources");
		});

		it("shows Query Builder header in detail when sources are added", async () => {
			state.csvFileEntries = [makeCsvFileEntry()];
			deps.analyticsService = createMockAnalyticsService();
			const tab = new AnalyticsTab(masterEl, detailEl, deps);
			tab.renderMaster();

			const item = masterEl.querySelector(".ft-master-event-item") as HTMLElement;
			item.click();

			await vi.waitFor(() => {
				expect(detailEl.textContent).toContain("Query Builder");
			});
		});

		it("shows source config card with loaded row count", async () => {
			state.csvFileEntries = [makeCsvFileEntry()];
			deps.analyticsService = createMockAnalyticsService();
			const tab = new AnalyticsTab(masterEl, detailEl, deps);
			tab.renderMaster();

			const item = masterEl.querySelector(".ft-master-event-item") as HTMLElement;
			item.click();

			await vi.waitFor(() => {
				expect(detailEl.textContent).toContain("3 rows");
			});
		});

		it("shows column type hints after loading", async () => {
			state.csvFileEntries = [makeCsvFileEntry()];
			deps.analyticsService = createMockAnalyticsService();
			const tab = new AnalyticsTab(masterEl, detailEl, deps);
			tab.renderMaster();

			const item = masterEl.querySelector(".ft-master-event-item") as HTMLElement;
			item.click();

			await vi.waitFor(() => {
				expect(detailEl.textContent).toContain("Column Types");
				expect(detailEl.textContent).toContain("Category");
				expect(detailEl.textContent).toContain("Amount");
			});
		});

		it("removes source when X is clicked", async () => {
			state.csvFileEntries = [makeCsvFileEntry()];
			deps.analyticsService = createMockAnalyticsService();
			const tab = new AnalyticsTab(masterEl, detailEl, deps);
			tab.renderMaster();

			const item = masterEl.querySelector(".ft-master-event-item") as HTMLElement;
			item.click();

			await vi.waitFor(() => {
				expect(masterEl.textContent).toContain("Query Sources");
			});

			// Click the remove button on the selected source
			const removeBtn = masterEl.querySelector(".ft-master-event-selected .ft-nav-link") as HTMLElement;
			removeBtn.click();

			tab.renderMaster();
			expect(masterEl.textContent).not.toContain("Query Sources");
		});
	});

	// ── Query builder sections ────────────────────────────────

	describe("query builder sections", () => {
		async function setupWithSource(): Promise<AnalyticsTab> {
			state.csvFileEntries = [makeCsvFileEntry()];
			deps.analyticsService = createMockAnalyticsService();
			const tab = new AnalyticsTab(masterEl, detailEl, deps);
			tab.renderMaster();

			const item = masterEl.querySelector(".ft-master-event-item") as HTMLElement;
			item.click();

			await vi.waitFor(() => {
				expect(detailEl.textContent).toContain("Column Types");
			});

			return tab;
		}

		it("shows Dimensions section with checkboxes", async () => {
			await setupWithSource();
			expect(detailEl.textContent).toContain("Group By (Dimensions)");
			const checkboxes = detailEl.querySelectorAll(".ft-property-grid input[type='checkbox']");
			expect(checkboxes.length).toBeGreaterThan(0);
		});

		it("shows Measures section with add button", async () => {
			await setupWithSource();
			expect(detailEl.textContent).toContain("Measures");
			expect(detailEl.textContent).toContain("Add at least one measure");
		});

		it("shows Run Query button (disabled without measures)", async () => {
			await setupWithSource();
			const runLink = detailEl.querySelector(".ft-detail-actions .ft-nav-link") as HTMLElement;
			expect(runLink.textContent).toContain("Run Query");
			expect(runLink.style.opacity).toBe("0.5");
		});

		it("shows Reset button", async () => {
			await setupWithSource();
			expect(detailEl.textContent).toContain("Reset");
		});
	});

	// ── Query execution ───────────────────────────────────────

	describe("query execution", () => {
		it("runs query via analyticsService and shows results", async () => {
			state.csvFileEntries = [makeCsvFileEntry()];
			const analyticsSvc = createMockAnalyticsService();
			deps.analyticsService = analyticsSvc;
			const tab = new AnalyticsTab(masterEl, detailEl, deps);
			tab.renderMaster();

			const item = masterEl.querySelector(".ft-master-event-item") as HTMLElement;
			item.click();

			await vi.waitFor(() => {
				expect(detailEl.textContent).toContain("Measures");
			});

			// Add a measure by clicking the "Add" button in the Measures section
			const addBtns = Array.from(detailEl.querySelectorAll(".ft-nav-link"));
			let measureAddBtn: HTMLElement | null = null;
			for (const btn of addBtns) {
				if (btn.textContent?.includes("Add") && !btn.textContent?.includes("Join")) {
					measureAddBtn = btn as HTMLElement;
					break;
				}
			}
			expect(measureAddBtn).not.toBeNull();
			measureAddBtn!.click();

			// Now the Run Query button should be enabled — find and click it
			await vi.waitFor(() => {
				const runLinks = detailEl.querySelectorAll(".ft-detail-actions .ft-nav-link");
				const runLink = runLinks[0] as HTMLElement;
				expect(runLink.style.opacity).not.toBe("0.5");
			});

			const runLinks = detailEl.querySelectorAll(".ft-detail-actions .ft-nav-link");
			const runLink = runLinks[0] as HTMLElement;
			runLink.click();

			await vi.waitFor(() => {
				expect(analyticsSvc!.runQuery).toHaveBeenCalled();
				expect(detailEl.textContent).toContain("Result Rows");
			});
		});
	});

	// ── Reset ─────────────────────────────────────────────────

	describe("reset", () => {
		it("clears all state when Reset is clicked", async () => {
			state.csvFileEntries = [makeCsvFileEntry()];
			deps.analyticsService = createMockAnalyticsService();
			const tab = new AnalyticsTab(masterEl, detailEl, deps);
			tab.renderMaster();

			const item = masterEl.querySelector(".ft-master-event-item") as HTMLElement;
			item.click();

			await vi.waitFor(() => {
				expect(detailEl.textContent).toContain("Query Builder");
			});

			// Find and click Reset
			const links = Array.from(detailEl.querySelectorAll(".ft-detail-actions .ft-nav-link"));
			let resetLink: HTMLElement | null = null;
			for (const link of links) {
				if (link.textContent?.includes("Reset")) {
					resetLink = link as HTMLElement;
					break;
				}
			}
			expect(resetLink).not.toBeNull();
			resetLink!.click();

			// After reset, detail should show empty state
			expect(detailEl.textContent).toContain("Add a CSV source");
		});
	});
});
