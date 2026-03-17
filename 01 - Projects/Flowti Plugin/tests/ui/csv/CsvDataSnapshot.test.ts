// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CsvDataSnapshot } from "../../../src/ui/csv/CsvDataSnapshot";
import type { CsvComponentDeps, CsvViewState } from "../../../src/ui/csv/types";

// ── Helpers ─────────────────────────────────────────────────

function createDefaultState(overrides: Partial<CsvViewState> = {}): CsvViewState {
	return {
		currentPage: "landing",
		importService: null,
		parsedCsv: null,
		parseError: null,
		targetFolder: "",
		nameColumn: "",
		namePrefix: "",
		nameSuffix: "",
		columnMappings: [],
		conflictStrategy: "skip",
		importResult: null,
		importError: null,
		importProgress: { current: 0, total: 0 },
		createBase: false,
		basePath: "",
		savedConfigs: [],
		pendingSavedConfig: null,
		columnSearchText: "",
		customProperties: {},
		loadedConfigId: null,
		detectedDelimiter: ",",
		previewSortColumn: null,
		previewSortDir: "asc",
		hiddenColumns: [],
		filterColumn: null,
		filterText: "",
		previewMaxRows: 100,
		lastImportedAt: null,
		...overrides,
	};
}

function createMockDeps(
	csvData: string,
	stateOverrides: Partial<CsvViewState> = {},
): { deps: CsvComponentDeps; state: CsvViewState; onChanged: () => void } {
	const state = createDefaultState(stateOverrides);
	const onChanged: () => void = vi.fn();
	const deps: CsvComponentDeps = {
		app: {} as CsvComponentDeps["app"],
		eventBus: {} as CsvComponentDeps["eventBus"],
		dataExchangeService: {} as CsvComponentDeps["dataExchangeService"],
		getState: () => state,
		setState: (partial) => Object.assign(state, partial),
		renderContent: vi.fn(),
		startImportWizard: vi.fn(),
		resetImportState: vi.fn(),
		openFolderPicker: vi.fn(),
		openBaseFolderPicker: vi.fn(),
		openHubImportConfig: vi.fn(),
		detachLeaf: vi.fn(),
		runImport: vi.fn(),
		promptSaveConfig: vi.fn(),
		hasUnsavedChanges: vi.fn(() => false),
		updateUnsavedHint: vi.fn(),
		getUnsavedHintEl: vi.fn(() => null),
		setUnsavedHintEl: vi.fn(),
		getFile: vi.fn(() => null),
		getData: () => csvData,
	};
	return { deps, state, onChanged };
}

const SIMPLE_CSV = "name,age,city\nAlice,30,NYC\nBob,25,LA\nCharlie,35,Chicago";
const TAB_CSV = "name\tage\nAlice\t30\nBob\t25";

// ── Tests ───────────────────────────────────────────────────

describe("CsvDataSnapshot", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
	});

	// ── Rendering ────────────────────────────────────────────

	describe("rendering", () => {
		it("should render heading and table for valid CSV", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV);
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			expect(container.querySelector("h3")?.textContent).toBe("Data snapshot");
			expect(container.querySelector("table")).not.toBeNull();
		});

		it("should render column header cells", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV);
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const headers = container.querySelectorAll("th");
			expect(headers.length).toBe(3);
			expect(headers[0].textContent).toContain("name");
			expect(headers[1].textContent).toContain("age");
			expect(headers[2].textContent).toContain("city");
		});

		it("should render data rows", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV);
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const rows = container.querySelectorAll("tbody tr");
			expect(rows.length).toBe(3);
		});

		it("should show row count badge", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV);
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const badges = container.querySelectorAll(".ft-badge");
			const rowBadge = badges[0];
			expect(rowBadge?.textContent).toContain("3 rows");
		});

		it("should not render when CSV has fewer than 2 lines", () => {
			const { deps, onChanged } = createMockDeps("name,age");
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			expect(container.querySelector("table")).toBeNull();
		});

		it("should render column chips for each header", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV);
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const chips = container.querySelectorAll(".ft-column-chip");
			expect(chips.length).toBe(3);
			expect(chips[0].textContent).toBe("name");
			expect(chips[1].textContent).toBe("age");
			expect(chips[2].textContent).toBe("city");
		});

		it("should handle tab-delimited data", () => {
			const { deps, onChanged } = createMockDeps(TAB_CSV, { detectedDelimiter: "\t" });
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const headers = container.querySelectorAll("th");
			expect(headers.length).toBe(2);
			expect(headers[0].textContent).toContain("name");
			expect(headers[1].textContent).toContain("age");
		});
	});

	// ── Column Visibility ────────────────────────────────────

	describe("column visibility", () => {
		it("should hide columns in hiddenColumns state", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, { hiddenColumns: ["city"] });
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const headers = container.querySelectorAll("th");
			expect(headers.length).toBe(2);
			const headerTexts = Array.from(headers).map((h) => h.textContent);
			expect(headerTexts).not.toContain(expect.stringContaining("city"));
		});

		it("should show hidden count badge when columns are hidden", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, { hiddenColumns: ["city"] });
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const hiddenBadge = container.querySelectorAll(".ft-badge")[1];
			expect(hiddenBadge?.textContent).toContain("1 hidden");
		});

		it("should hide data cells for hidden columns", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, { hiddenColumns: ["city"] });
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const firstRow = container.querySelector("tbody tr");
			const cells = firstRow?.querySelectorAll("td");
			expect(cells?.length).toBe(2);
		});

		it("should add ft-column-hidden class to hidden column chips", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, { hiddenColumns: ["city"] });
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const chips = container.querySelectorAll(".ft-column-chip");
			const cityChip = Array.from(chips).find((c) => c.textContent === "city");
			expect(cityChip?.classList.contains("ft-column-hidden")).toBe(true);
		});

		it("should toggle column visibility when chip is clicked", () => {
			const { deps, state, onChanged } = createMockDeps(SIMPLE_CSV);
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			// Click "city" chip to hide it
			const chips = container.querySelectorAll(".ft-column-chip");
			const cityChip = Array.from(chips).find((c) => c.textContent === "city") as HTMLElement;
			cityChip.click();

			expect(state.hiddenColumns).toContain("city");
			expect(onChanged).toHaveBeenCalled();
		});
	});

	// ── Filtering ────────────────────────────────────────────

	describe("filtering", () => {
		it("should filter rows by text across all columns", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, { filterText: "alice" });
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const rows = container.querySelectorAll("tbody tr");
			expect(rows.length).toBe(1);
		});

		it("should filter rows by single column", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, {
				filterText: "30",
				filterColumn: "age",
			});
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const rows = container.querySelectorAll("tbody tr");
			expect(rows.length).toBe(1);
		});

		it("should show filtered row count in badge", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, { filterText: "alice" });
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const badge = container.querySelector(".ft-badge");
			expect(badge?.textContent).toContain("1 rows");
			expect(badge?.textContent).toContain("filtered from 3");
		});

		it("should be case-insensitive", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, { filterText: "ALICE" });
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const rows = container.querySelectorAll("tbody tr");
			expect(rows.length).toBe(1);
		});

		it("should show all rows when filter text is empty", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, { filterText: "" });
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const rows = container.querySelectorAll("tbody tr");
			expect(rows.length).toBe(3);
		});

		it("should show no rows when filter matches nothing", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, { filterText: "zzzzz" });
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const rows = container.querySelectorAll("tbody tr");
			expect(rows.length).toBe(0);
		});
	});

	// ── Sorting ──────────────────────────────────────────────

	describe("sorting", () => {
		it("should sort ascending by column", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, {
				previewSortColumn: "name",
				previewSortDir: "asc",
			});
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const firstCell = container.querySelector("tbody tr td");
			expect(firstCell?.textContent).toBe("Alice");
		});

		it("should sort descending by column", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, {
				previewSortColumn: "name",
				previewSortDir: "desc",
			});
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const firstCell = container.querySelector("tbody tr td");
			expect(firstCell?.textContent).toBe("Charlie");
		});

		it("should sort numerically when values are numeric", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, {
				previewSortColumn: "age",
				previewSortDir: "asc",
			});
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const rows = container.querySelectorAll("tbody tr");
			const ages = Array.from(rows).map((r) => r.querySelectorAll("td")[1]?.textContent);
			expect(ages).toEqual(["25", "30", "35"]);
		});

		it("should show ascending indicator on sorted column header", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, {
				previewSortColumn: "name",
				previewSortDir: "asc",
			});
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const nameHeader = container.querySelector("th");
			expect(nameHeader?.textContent).toContain("\u25B2");
		});

		it("should show descending indicator on sorted column header", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, {
				previewSortColumn: "name",
				previewSortDir: "desc",
			});
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const nameHeader = container.querySelector("th");
			expect(nameHeader?.textContent).toContain("\u25BC");
		});

		it("should cycle sort on header click: asc → desc → reset", () => {
			const { deps, state, onChanged } = createMockDeps(SIMPLE_CSV);
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const nameHeader = container.querySelector("th") as HTMLElement;

			// Click 1: set to asc
			nameHeader.click();
			expect(state.previewSortColumn).toBe("name");
			expect(state.previewSortDir).toBe("asc");

			// Click 2: switch to desc
			nameHeader.click();
			expect(state.previewSortDir).toBe("desc");

			// Click 3: reset
			nameHeader.click();
			expect(state.previewSortColumn).toBeNull();
		});
	});

	// ── Row Limit ────────────────────────────────────────────

	describe("row limit", () => {
		it("should truncate to previewMaxRows", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, { previewMaxRows: 2 });
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const rows = container.querySelectorAll("tbody tr");
			expect(rows.length).toBe(2);
		});

		it("should show truncation message when rows exceed limit", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, { previewMaxRows: 2 });
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			const moreText = container.querySelector(".flowti-csv-more");
			expect(moreText?.textContent).toContain("Showing first 2 of 3 rows");
		});

		it("should not show truncation message when within limit", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, { previewMaxRows: 100 });
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			expect(container.querySelector(".flowti-csv-more")).toBeNull();
		});
	});

	// ── Combined ─────────────────────────────────────────────

	describe("combined filter + sort + column hide", () => {
		it("should apply filter, sort, and column hiding together", () => {
			const { deps, onChanged } = createMockDeps(SIMPLE_CSV, {
				filterText: "a",             // matches Alice (name), LA (city), Charlie (name), Chicago (city)
				previewSortColumn: "name",
				previewSortDir: "desc",
				hiddenColumns: ["city"],
			});
			const snapshot = new CsvDataSnapshot(deps, onChanged);
			snapshot.render(container);

			// Verify hidden column
			const headers = container.querySelectorAll("th");
			expect(headers.length).toBe(2); // name, age (city hidden)

			// Verify sort + filter: should have Alice, Charlie, LA→Bob filtered
			const rows = container.querySelectorAll("tbody tr");
			expect(rows.length).toBeGreaterThan(0);

			// First row should be Charlie (descending by name)
			const firstCells = Array.from(rows[0].querySelectorAll("td")).map((td) => td.textContent);
			expect(firstCells[0]).toBe("Charlie");
		});
	});
});
