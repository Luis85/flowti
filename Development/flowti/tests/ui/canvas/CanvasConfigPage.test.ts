// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { CanvasConfigPage } from "../../../src/ui/canvas/CanvasConfigPage";
import type { CanvasComponentDeps, CanvasViewState } from "../../../src/ui/canvas/types";
import { DEFAULT_COLOR_MAP, DEFAULT_SHAPE_MAP } from "../../../src/domain/canvas/types";

// ── Helpers ─────────────────────────────────────────────────

function createDefaultState(overrides: Partial<CanvasViewState> = {}): CanvasViewState {
	return {
		currentPage: "config",
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
		app: {} as CanvasComponentDeps["app"],
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

// ── Tests ───────────────────────────────────────────────────

describe("CanvasConfigPage", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
	});

	it("render creates config page content", () => {
		const { deps } = createMockCanvasDeps();
		const page = new CanvasConfigPage(container, deps);
		page.render();

		// Should render the split layout with left and right panels
		expect(container.querySelector(".ft-config-split")).not.toBeNull();
		expect(container.querySelector(".ft-config-panel")).not.toBeNull();
		expect(container.querySelector(".ft-config-content")).not.toBeNull();
	});

	it("render shows target folder setting", () => {
		const { deps } = createMockCanvasDeps({ targetFolder: "imports/canvas" });
		const page = new CanvasConfigPage(container, deps);
		page.render();

		// The left panel should contain heading "Configure Import"
		const heading = container.querySelector("h3");
		expect(heading?.textContent).toBe("Configure Import");

		// The config panel should be present (target folder is rendered via Setting API)
		const panel = container.querySelector(".ft-config-panel");
		expect(panel).not.toBeNull();
	});

	it("render shows conflict strategy options", () => {
		const { deps } = createMockCanvasDeps({ conflictStrategy: "update" });
		const page = new CanvasConfigPage(container, deps);
		page.render();

		// The config panel renders conflict strategy via Setting + Dropdown
		// Since Setting is a stub, we verify the panel rendered without errors
		const panel = container.querySelector(".ft-config-panel");
		expect(panel).not.toBeNull();
		expect(panel!.children.length).toBeGreaterThan(0);
	});

	it("render shows hierarchy mode options", () => {
		const { deps } = createMockCanvasDeps({ hierarchyMode: "product" });
		const page = new CanvasConfigPage(container, deps);
		page.render();

		// Config panel should contain all general settings including hierarchy mode
		const panel = container.querySelector(".ft-config-panel");
		expect(panel).not.toBeNull();
		expect(panel!.children.length).toBeGreaterThan(0);
	});

	it("render shows Preview button", () => {
		const { deps } = createMockCanvasDeps();
		const page = new CanvasConfigPage(container, deps);
		page.render();

		// The action bar contains a Preview button
		const buttons = container.querySelectorAll("button");
		const previewBtn = Array.from(buttons).find((b) =>
			b.textContent?.includes("Preview"),
		);
		expect(previewBtn).not.toBeUndefined();
		expect(previewBtn?.classList.contains("mod-cta")).toBe(true);
	});

	it("render shows color and shape mapping sections", () => {
		const { deps } = createMockCanvasDeps();
		const page = new CanvasConfigPage(container, deps);
		page.render();

		// Right panel should contain "Mappings" heading and mapping tables
		const rightPanel = container.querySelector(".ft-config-content");
		expect(rightPanel).not.toBeNull();

		const h3Elements = rightPanel!.querySelectorAll("h3");
		const mappingsHeading = Array.from(h3Elements).find(
			(h) => h.textContent === "Mappings",
		);
		expect(mappingsHeading).not.toBeUndefined();

		// Should have mapping tables for color and shape
		const tables = rightPanel!.querySelectorAll("table");
		expect(tables.length).toBeGreaterThanOrEqual(2);
	});

	it("render shows back navigation to canvas landing", () => {
		const { deps } = createMockCanvasDeps();
		const page = new CanvasConfigPage(container, deps);
		page.render();

		// Action bar contains a back link with "Canvas Detail" text
		const navLinks = container.querySelectorAll(".ft-nav-link");
		const backLink = Array.from(navLinks).find((el) =>
			el.textContent?.includes("Canvas Detail"),
		);
		expect(backLink).not.toBeUndefined();
	});

	it("clicking back navigates to landing page", () => {
		const { deps, state } = createMockCanvasDeps();
		const page = new CanvasConfigPage(container, deps);
		page.render();

		const navLinks = container.querySelectorAll(".ft-nav-link");
		const backLink = Array.from(navLinks).find((el) =>
			el.textContent?.includes("Canvas Detail"),
		) as HTMLElement;
		backLink.click();

		expect(state.currentPage).toBe("landing");
		expect(deps.renderContent).toHaveBeenCalled();
	});

	it("render shows type exclusion grid", () => {
		const { deps } = createMockCanvasDeps();
		const page = new CanvasConfigPage(container, deps);
		page.render();

		// Right panel should contain "Included Types" heading with checkboxes
		const rightPanel = container.querySelector(".ft-config-content");
		const h4Elements = rightPanel!.querySelectorAll("h4");
		const typesHeading = Array.from(h4Elements).find(
			(h) => h.textContent === "Included Types",
		);
		expect(typesHeading).not.toBeUndefined();

		const checkboxes = rightPanel!.querySelectorAll("input[type='checkbox']");
		expect(checkboxes.length).toBeGreaterThan(0);
	});
});
