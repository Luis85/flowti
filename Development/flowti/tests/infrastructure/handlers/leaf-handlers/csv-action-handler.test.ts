// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCsvOrchestrator } from "../../../../src/infrastructure/handlers/leaf-handlers/csv-action-handler";
import type { CsvActionHandlerDeps, CsvOrchestrator } from "../../../../src/infrastructure/handlers/leaf-handlers/csv-action-handler";
import type { IEventBus } from "../../../../src/infrastructure/events/types";

// ── Mock page components (render stubs) ──────────────────────

const pageMocks = {
	landing: { render: vi.fn() },
	config: { render: vi.fn() },
	preview: { render: vi.fn() },
	result: { render: vi.fn(), renderProgressIndicator: vi.fn() },
};

vi.mock("../../../../src/ui/csv", () => ({
	CsvLanding: class { render = pageMocks.landing.render; },
	CsvConfigPage: class { render = pageMocks.config.render; },
	CsvPreviewPage: class { render = pageMocks.preview.render; },
	CsvResultPage: class { render = pageMocks.result.render; renderProgressIndicator = pageMocks.result.renderProgressIndicator; },
	STEP_LABELS: { config: "Configure", preview: "Preview", result: "Import" },
	detectDelimiter: vi.fn(() => ","),
	generateBaseYaml: vi.fn(() => "---\ntype: base\n---"),
	getBaseFilename: vi.fn(() => "test.base"),
}));

vi.mock("../../../../src/ui/shared/FolderPickerModal", () => ({
	FolderPickerModal: class { open = vi.fn(); },
	getVaultFolders: vi.fn(() => []),
}));

vi.mock("../../../../src/ui/modals", () => ({
	ConfirmModal: class { open = vi.fn(); },
	ConfigChooserModal: class { open = vi.fn(); },
	InputModal: class { open = vi.fn(); },
}));

vi.mock("../../../../src/ui/hub/helpers", () => ({
	renderStepBar: vi.fn(),
	renderConfigDropdown: vi.fn(),
}));

vi.mock("../../../../src/utils/pathUtils", () => ({
	basename: vi.fn((p: string) => p.split("/").pop() ?? p),
}));

// ── Factories ────────────────────────────────────────────────

function createMockEventBus(): IEventBus {
	return {
		emit: vi.fn().mockResolvedValue(undefined),
		emitCustom: vi.fn().mockResolvedValue(undefined),
		on: vi.fn(() => vi.fn()),
		once: vi.fn(),
		off: vi.fn(),
		clear: vi.fn(),
	} as unknown as IEventBus;
}

function createMockDataExchangeService() {
	return {
		getImportService: vi.fn(() => ({
			parseFile: vi.fn().mockResolvedValue({
				headers: ["Name", "Age", "Email"],
				rows: [["Alice", "30", "alice@test.com"]],
				rowCount: 1,
				detectedDelimiter: ",",
			}),
			executeImport: vi.fn().mockResolvedValue({
				created: 1,
				updated: 0,
				skipped: 0,
				errors: [],
			}),
		})),
		getSavedImportConfigs: vi.fn(() => []),
		getImportConfigsForFile: vi.fn(() => []),
		saveImportConfig: vi.fn().mockResolvedValue({ id: "cfg-1", name: "test" }),
		updateImportConfig: vi.fn().mockResolvedValue({ id: "cfg-1", name: "test" }),
		resolveCsvDocPath: vi.fn(() => ""),
		getCsvDisplaySettings: vi.fn(() => null),
		saveCsvDisplaySettings: vi.fn().mockResolvedValue(undefined),
	};
}

function createMockFile() {
	return {
		path: "data/test.csv",
		basename: "test",
		extension: "csv",
	};
}

function createDeps(overrides: Partial<CsvActionHandlerDeps> = {}): CsvActionHandlerDeps {
	return {
		eventBus: createMockEventBus(),
		dataExchangeService: createMockDataExchangeService() as unknown as CsvActionHandlerDeps["dataExchangeService"],
		app: {
			vault: { getAbstractFileByPath: vi.fn(() => null) },
			metadataCache: { getFileCache: vi.fn(() => null) },
		} as unknown as CsvActionHandlerDeps["app"],
		getFile: vi.fn(() => createMockFile()) as unknown as CsvActionHandlerDeps["getFile"],
		getData: vi.fn(() => "Name,Age,Email\nAlice,30,alice@test.com"),
		detachLeaf: vi.fn(),
		...overrides,
	};
}

// ── Tests ────────────────────────────────────────────────────

describe("createCsvOrchestrator", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
		vi.clearAllMocks();
	});

	it("creates an orchestrator with the expected interface", () => {
		const orch = createCsvOrchestrator(container, createDeps());
		expect(typeof orch.onDataChanged).toBe("function");
		expect(typeof orch.setSavedConfig).toBe("function");
		expect(typeof orch.destroy).toBe("function");
	});

	describe("onDataChanged", () => {
		it("renders landing page by default", () => {
			const orch = createCsvOrchestrator(container, createDeps());
			orch.onDataChanged("Name,Age\nAlice,30", false);

			expect(pageMocks.landing.render).toHaveBeenCalled();
		});

		it("creates layout skeleton with correct CSS classes", () => {
			const orch = createCsvOrchestrator(container, createDeps());
			orch.onDataChanged("Name,Age\nAlice,30", false);

			expect(container.querySelector(".flowti-container")).not.toBeNull();
			expect(container.querySelector(".ft-view-top-bar")).not.toBeNull();
			expect(container.querySelector(".ft-view-landing")).not.toBeNull();
			expect(container.querySelector(".ft-view-workspace")).not.toBeNull();
		});

		it("hides top bar and workspace on landing page", () => {
			const orch = createCsvOrchestrator(container, createDeps());
			orch.onDataChanged("Name,Age\nAlice,30", false);

			const topBar = container.querySelector(".ft-view-top-bar")!;
			const workspace = container.querySelector(".ft-view-workspace")!;
			expect(topBar.classList.contains("ft-hidden")).toBe(true);
			expect(workspace.classList.contains("ft-hidden")).toBe(true);
		});

		it("shows landing container on landing page", () => {
			const orch = createCsvOrchestrator(container, createDeps());
			orch.onDataChanged("Name,Age\nAlice,30", false);

			const landing = container.querySelector(".ft-view-landing")!;
			expect(landing.classList.contains("ft-hidden")).toBe(false);
		});

		it("does not render config/preview/result pages on landing", () => {
			const orch = createCsvOrchestrator(container, createDeps());
			orch.onDataChanged("Name,Age\nAlice,30", false);

			expect(pageMocks.config.render).not.toHaveBeenCalled();
			expect(pageMocks.preview.render).not.toHaveBeenCalled();
			expect(pageMocks.result.render).not.toHaveBeenCalled();
		});
	});

	describe("destroy", () => {
		it("clears DOM references without throwing", () => {
			const orch = createCsvOrchestrator(container, createDeps());
			orch.onDataChanged("Name,Age\nAlice,30", false);
			expect(() => orch.destroy()).not.toThrow();
		});

		it("can be called multiple times safely", () => {
			const orch = createCsvOrchestrator(container, createDeps());
			orch.onDataChanged("test", false);
			orch.destroy();
			expect(() => orch.destroy()).not.toThrow();
		});
	});

	describe("setSavedConfig", () => {
		it("accepts a saved config without throwing", () => {
			const orch = createCsvOrchestrator(container, createDeps());
			expect(() => orch.setSavedConfig({
				id: "cfg-1",
				name: "Test Config",
				sourcePath: "data/test.csv",
				targetFolder: "imported",
				nameColumn: "Name",
				columnMappings: [],
				conflictStrategy: "skip",
			} as unknown as import("../../../../src/domain/dataExchange/types").SavedImportConfig)).not.toThrow();
		});
	});

	describe("re-rendering on data change", () => {
		it("resets to landing when data changes and not on landing", () => {
			const orch = createCsvOrchestrator(container, createDeps());
			// First render sets landing
			orch.onDataChanged("Name,Age\nAlice,30", false);
			vi.clearAllMocks();

			// Second data change should re-render landing
			orch.onDataChanged("Name,Age\nBob,25", false);
			expect(pageMocks.landing.render).toHaveBeenCalled();
		});
	});
});
