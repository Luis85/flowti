// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { CanvasResultPage } from "../../../src/ui/canvas/CanvasResultPage";
import type { CanvasComponentDeps, CanvasViewState } from "../../../src/ui/canvas/types";
import { DEFAULT_COLOR_MAP, DEFAULT_SHAPE_MAP } from "../../../src/domain/canvas/types";
import type { CanvasImportResult } from "../../../src/domain/canvas/types";

// ── Helpers ─────────────────────────────────────────────────

function createDefaultState(overrides: Partial<CanvasViewState> = {}): CanvasViewState {
	return {
		currentPage: "result",
		canvasPath: "Projects/architecture.canvas",
		targetFolder: "resources/canvas",
		configName: "Architecture Import",
		conflictStrategy: "skip",
		hierarchyMode: "flat",
		subfolderName: "",
		createCanvas: true,
		createBase: false,
		colorMap: { ...DEFAULT_COLOR_MAP },
		shapeMap: { ...DEFAULT_SHAPE_MAP },
		excludedTypes: [],
		previewItems: [],
		legendMap: null,
		parseError: null,
		importing: false,
		importDone: false,
		importSuccess: false,
		importMessage: "",
		importProgress: { current: 0, total: 0, title: "" },
		importResult: null,
		artifactPaths: {},
		loadedConfigId: null,
		...overrides,
	};
}

function createMockCanvasDeps(
	stateOverrides: Partial<CanvasViewState> = {},
): { deps: CanvasComponentDeps; state: CanvasViewState } {
	const state = createDefaultState(stateOverrides);
	const deps: CanvasComponentDeps = {
		app: {
			vault: { getAbstractFileByPath: vi.fn(() => null) },
			workspace: { getLeaf: vi.fn(() => ({ openFile: vi.fn() })) },
		} as unknown as CanvasComponentDeps["app"],
		eventBus: {} as CanvasComponentDeps["eventBus"],
		canvasService: {} as CanvasComponentDeps["canvasService"],
		getState: () => state,
		setState: (partial) => Object.assign(state, partial),
		renderContent: vi.fn(),
		parseAndPreview: vi.fn(),
		runImport: vi.fn(),
		saveConfig: vi.fn(),
		hasUnsavedChanges: vi.fn(() => false),
		updateUnsavedHint: vi.fn(),
		setUnsavedHintEl: vi.fn(),
		readCanvasFile: vi.fn(),
		openFolderPicker: vi.fn(),
		detachLeaf: vi.fn(),
	};
	return { deps, state };
}

function createMockResult(overrides: Partial<CanvasImportResult> = {}): CanvasImportResult {
	return {
		canvasPath: "Projects/architecture.canvas",
		targetFolder: "resources/canvas/architecture",
		totalNodes: 10,
		imported: 8,
		skipped: 2,
		errors: [],
		duration: 340,
		importedPaths: {},
		...overrides,
	};
}

// ── Tests ───────────────────────────────────────────────────

describe("CanvasResultPage", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
	});

	it("render shows progress indicator when importDone is false", () => {
		const { deps } = createMockCanvasDeps({ importDone: false });
		const page = new CanvasResultPage(container, deps);
		page.render();

		const heading = container.querySelector("h3");
		expect(heading?.textContent).toBe("Importing...");
		expect(container.querySelector(".ft-import-progress")).not.toBeNull();
	});

	it("render shows success state when importDone and importSuccess", () => {
		const { deps } = createMockCanvasDeps({
			importDone: true,
			importSuccess: true,
			importResult: createMockResult(),
		});
		const page = new CanvasResultPage(container, deps);
		page.render();

		const heading = container.querySelector("h3");
		expect(heading?.textContent).toBe("Import Complete");

		// Should show "What happened" card
		const sectionHeaders = container.querySelectorAll(".ft-detail-section-header");
		const whatHappened = Array.from(sectionHeaders).find(
			(el) => el.textContent === "What happened",
		);
		expect(whatHappened).not.toBeUndefined();
	});

	it("render shows error state when importDone and not importSuccess", () => {
		const { deps } = createMockCanvasDeps({
			importDone: true,
			importSuccess: false,
			importMessage: "Canvas file not found",
		});
		const page = new CanvasResultPage(container, deps);
		page.render();

		const heading = container.querySelector("h3");
		expect(heading?.textContent).toBe("Import failed");

		// Should display the error message
		const errorText = container.querySelector(".ft-text-sm");
		expect(errorText?.textContent).toBe("Canvas file not found");
	});

	it("render shows per-type breakdown when result has imported items", () => {
		const result = createMockResult({
			imported: 5,
			importedPaths: {
				"node-1": "resources/canvas/architecture/Alpha.md",
				"node-2": "resources/canvas/architecture/Beta.md",
				"node-3": "resources/canvas/architecture/Gamma.md",
				"node-4": "resources/canvas/architecture/Delta.md",
				"node-5": "resources/canvas/architecture/Epsilon.md",
			},
		});
		const { deps } = createMockCanvasDeps({
			importDone: true,
			importSuccess: true,
			importResult: result,
			previewItems: [
				{ id: "node-1", title: "Alpha", type: "Epic" },
				{ id: "node-2", title: "Beta", type: "Epic" },
				{ id: "node-3", title: "Gamma", type: "Feature" },
				{ id: "node-4", title: "Delta", type: "Feature" },
				{ id: "node-5", title: "Epsilon", type: "Task" },
			] as CanvasViewState["previewItems"],
		});
		const page = new CanvasResultPage(container, deps);
		page.render();

		// Per-type breakdown should appear when there are multiple types
		const sectionHeaders = container.querySelectorAll(".ft-detail-section-header");
		const breakdown = Array.from(sectionHeaders).find(
			(el) => el.textContent === "Per-type breakdown",
		);
		expect(breakdown).not.toBeUndefined();

		// Should have table rows for each type inside the same card
		const breakdownCard = breakdown?.parentElement;
		const breakdownTable = breakdownCard?.querySelector("table");
		expect(breakdownTable).not.toBeNull();
	});

	it("renderProgressIndicator updates progress bar percentage", () => {
		const { deps, state } = createMockCanvasDeps({
			importDone: false,
			importProgress: { current: 3, total: 10, title: "Creating notes" },
		});
		const page = new CanvasResultPage(container, deps);
		page.render();

		// Progress bar should reflect 30%
		const fill = container.querySelector(".ft-progress-bar-fill") as HTMLElement;
		expect(fill).not.toBeNull();
		expect(fill.style.width).toBe("30%");

		// Label should show "3 of 10 (30%)"
		const label = container.querySelector(".ft-text-sm");
		expect(label?.textContent).toContain("3 of 10");
		expect(label?.textContent).toContain("30%");

		// Update progress and re-render the indicator
		Object.assign(state, {
			importProgress: { current: 7, total: 10, title: "Linking relations" },
		});
		page.renderProgressIndicator();

		const updatedFill = container.querySelector(".ft-progress-bar-fill") as HTMLElement;
		expect(updatedFill.style.width).toBe("70%");

		const updatedLabel = container.querySelector(".ft-text-sm");
		expect(updatedLabel?.textContent).toContain("7 of 10");
		expect(updatedLabel?.textContent).toContain("70%");
	});

	it("render shows What's next actions on success", () => {
		const { deps } = createMockCanvasDeps({
			importDone: true,
			importSuccess: true,
			importResult: createMockResult(),
		});
		const page = new CanvasResultPage(container, deps);
		page.render();

		const sectionHeaders = container.querySelectorAll(".ft-detail-section-header");
		const whatsNext = Array.from(sectionHeaders).find(
			(el) => el.textContent === "What's next",
		);
		expect(whatsNext).not.toBeUndefined();

		// Should have action buttons: Open Target Folder, Run Again, Edit Config, Close
		const buttons = container.querySelectorAll("button");
		const buttonTexts = Array.from(buttons).map((b) => b.textContent?.trim());
		expect(buttonTexts.some((t) => t?.includes("Open Target Folder"))).toBe(true);
		expect(buttonTexts.some((t) => t?.includes("Run Again"))).toBe(true);
		expect(buttonTexts.some((t) => t?.includes("Edit Config"))).toBe(true);
		expect(buttonTexts.some((t) => t?.includes("Close"))).toBe(true);
	});

	it("render shows What's next actions on error", () => {
		const { deps } = createMockCanvasDeps({
			importDone: true,
			importSuccess: false,
			importMessage: "Permission denied",
		});
		const page = new CanvasResultPage(container, deps);
		page.render();

		const sectionHeaders = container.querySelectorAll(".ft-detail-section-header");
		const whatsNext = Array.from(sectionHeaders).find(
			(el) => el.textContent === "What's next",
		);
		expect(whatsNext).not.toBeUndefined();

		// Error page should have Retry, Edit Config, and Close buttons
		const buttons = container.querySelectorAll("button");
		const buttonTexts = Array.from(buttons).map((b) => b.textContent?.trim());
		expect(buttonTexts.some((t) => t?.includes("Retry"))).toBe(true);
		expect(buttonTexts.some((t) => t?.includes("Edit Config"))).toBe(true);
		expect(buttonTexts.some((t) => t?.includes("Close"))).toBe(true);
	});

	it("render shows starting message when progress total is zero", () => {
		const { deps } = createMockCanvasDeps({
			importDone: false,
			importProgress: { current: 0, total: 0, title: "" },
		});
		const page = new CanvasResultPage(container, deps);
		page.render();

		const label = container.querySelector(".ft-text-sm");
		expect(label?.textContent).toBe("Starting...");

		const fill = container.querySelector(".ft-progress-bar-fill") as HTMLElement;
		expect(fill.style.width).toBe("0%");
	});
});
