// @vitest-environment happy-dom

/**
 * Tests for the canvas-import-handler (sitemap-driven wizard orchestrator).
 *
 * Validates layout skeleton creation, default state, page rendering,
 * and page transition logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PluginHandlerRegistry } from "../../../../src/infrastructure/handlers/plugin-handler-registry";
import {
	registerCanvasImportHandler,
	createCanvasImportWizard,
} from "../../../../src/infrastructure/handlers/leaf-handlers/canvas-import-handler";
import type { CanvasImportHandlerDeps } from "../../../../src/infrastructure/handlers/leaf-handlers/canvas-import-handler";
import type { TabContext } from "../../../../src/infrastructure/handlers/plugin-handler-registry";
import type { IEventBus } from "../../../../src/infrastructure/events/types";

// ── Mocks ──────────────────────────────────────────────────────

/** Tracks all page component instances for assertion access. */
interface MockPageInstance {
	render: ReturnType<typeof vi.fn>;
	container: HTMLElement;
	deps: unknown;
}
const pageInstances: {
	landing: MockPageInstance | null;
	config: MockPageInstance | null;
	preview: MockPageInstance | null;
	result: (MockPageInstance & { renderProgressIndicator: ReturnType<typeof vi.fn> }) | null;
} = { landing: null, config: null, preview: null, result: null };

vi.mock("../../../../src/ui/canvas/CanvasLanding", () => {
	return {
		CanvasLanding: class MockCanvasLanding {
			render = vi.fn();
			constructor(public container: HTMLElement, public deps: unknown) {
				pageInstances.landing = this;
			}
		},
	};
});

vi.mock("../../../../src/ui/canvas/CanvasConfigPage", () => {
	return {
		CanvasConfigPage: class MockCanvasConfigPage {
			render = vi.fn();
			constructor(public container: HTMLElement, public deps: unknown) {
				pageInstances.config = this;
			}
		},
	};
});

vi.mock("../../../../src/ui/canvas/CanvasPreviewPage", () => {
	return {
		CanvasPreviewPage: class MockCanvasPreviewPage {
			render = vi.fn();
			constructor(public container: HTMLElement, public deps: unknown) {
				pageInstances.preview = this;
			}
		},
	};
});

vi.mock("../../../../src/ui/canvas/CanvasResultPage", () => {
	return {
		CanvasResultPage: class MockCanvasResultPage {
			render = vi.fn();
			renderProgressIndicator = vi.fn();
			constructor(public container: HTMLElement, public deps: unknown) {
				pageInstances.result = this;
			}
		},
	};
});

vi.mock("../../../../src/ui/hub/helpers", () => ({
	renderStepBar: vi.fn(),
	revealFolderInExplorer: vi.fn(),
}));

vi.mock("../../../../src/ui/shared/FolderPickerModal", () => ({
	FolderPickerModal: vi.fn(),
	getVaultFolders: vi.fn(() => []),
}));

vi.mock("../../../../src/domain/canvas/CanvasParser", () => ({
	parseCanvasJson: vi.fn(),
	extractLegend: vi.fn(),
	buildCanvasItems: vi.fn(() => []),
	resolveParentage: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────

function createMockEventBus(): IEventBus {
	const handlers = new Map<string, Set<(event: unknown) => void>>();
	return {
		emit: vi.fn(async () => {}),
		emitCustom: vi.fn(async () => {}),
		on: vi.fn((type: string, handler: (event: unknown) => void) => {
			if (!handlers.has(type)) handlers.set(type, new Set());
			handlers.get(type)!.add(handler);
			return () => { handlers.get(type)?.delete(handler); };
		}),
		once: vi.fn(() => () => {}),
		off: vi.fn(),
		onAny: vi.fn(() => () => {}),
	} as unknown as IEventBus;
}

function createMockCanvasService() {
	return {
		getConfigs: vi.fn(() => []),
		getConfig: vi.fn(() => undefined),
		saveConfig: vi.fn(async () => ({ id: "test-id", name: "test" })),
		updateConfig: vi.fn(async () => undefined),
		runImport: vi.fn(async () => ({
			canvasPath: "test.canvas",
			targetFolder: "output",
			totalNodes: 5,
			imported: 5,
			skipped: 0,
			errors: [],
			duration: 100,
			importedPaths: {},
		})),
		removeConfig: vi.fn(async () => true),
		load: vi.fn(async () => {}),
		dispose: vi.fn(),
	};
}

function createMockApp() {
	return {
		vault: {
			getAbstractFileByPath: vi.fn(() => null),
			read: vi.fn(async () => ""),
		},
		workspace: {
			getLeaf: vi.fn(() => ({
				openFile: vi.fn(),
				setViewState: vi.fn(),
			})),
			getLeavesOfType: vi.fn(() => []),
			revealLeaf: vi.fn(),
		},
	};
}

function createDeps(): CanvasImportHandlerDeps {
	return {
		canvasService: createMockCanvasService() as unknown as CanvasImportHandlerDeps["canvasService"],
		eventBus: createMockEventBus(),
		app: createMockApp() as unknown as CanvasImportHandlerDeps["app"],
	};
}

function createCtx(): TabContext {
	return {
		tabId: "test-tab",
		viewId: "canvas-import",
		eventBus: createMockEventBus(),
	};
}

// ── Tests ──────────────────────────────────────────────────────

describe("canvas-import-handler", () => {
	let container: HTMLElement;
	let deps: CanvasImportHandlerDeps;
	let ctx: TabContext;

	beforeEach(() => {
		container = document.createElement("div");
		deps = createDeps();
		ctx = createCtx();
	});

	describe("registerCanvasImportHandler", () => {
		it("registers a tab handler with id leaf:canvas-import", () => {
			const registry = new PluginHandlerRegistry();
			registerCanvasImportHandler(registry, deps);

			const handler = registry.getTabHandler("leaf:canvas-import");
			expect(handler).toBeDefined();
		});

		it("registered handler can be invoked with a container and context", () => {
			const registry = new PluginHandlerRegistry();
			registerCanvasImportHandler(registry, deps);

			const handler = registry.getTabHandler("leaf:canvas-import")!;
			expect(() => handler(container, ctx)).not.toThrow();
		});
	});

	describe("layout skeleton", () => {
		it("creates root element with flowti-container class", () => {
			createCanvasImportWizard(container, ctx, deps);

			const root = container.querySelector(".flowti-container");
			expect(root).not.toBeNull();
			expect(root!.classList.contains("ft-view-root-flex")).toBe(true);
		});

		it("creates top bar element (hidden by default on landing)", () => {
			createCanvasImportWizard(container, ctx, deps);

			const topBar = container.querySelector(".ft-view-top-bar");
			expect(topBar).not.toBeNull();
			expect(topBar!.classList.contains("ft-hidden")).toBe(true);
		});

		it("creates landing container (visible by default)", () => {
			createCanvasImportWizard(container, ctx, deps);

			const landing = container.querySelector(".ft-view-landing");
			expect(landing).not.toBeNull();
			expect(landing!.classList.contains("ft-hidden")).toBe(false);
		});

		it("creates workspace container (hidden by default on landing)", () => {
			createCanvasImportWizard(container, ctx, deps);

			const workspace = container.querySelector(".ft-view-workspace");
			expect(workspace).not.toBeNull();
			expect(workspace!.classList.contains("ft-hidden")).toBe(true);
		});
	});

	describe("initial state", () => {
		it("starts on landing page", () => {
			createCanvasImportWizard(container, ctx, deps);

			// Landing page is rendered (not hidden)
			const landing = container.querySelector(".ft-view-landing");
			expect(landing).not.toBeNull();
			expect(landing!.classList.contains("ft-hidden")).toBe(false);
		});

		it("renders landing page by default", () => {
			createCanvasImportWizard(container, ctx, deps);

			// CanvasLanding instance was created and render() called
			expect(pageInstances.landing).not.toBeNull();
			expect(pageInstances.landing!.render).toHaveBeenCalled();
		});
	});

	describe("event subscriptions", () => {
		it("subscribes to canvas.import.started events", () => {
			createCanvasImportWizard(container, ctx, deps);

			expect(deps.eventBus.on).toHaveBeenCalledWith(
				"canvas.import.started",
				expect.any(Function),
			);
		});

		it("subscribes to canvas.import.progress events", () => {
			createCanvasImportWizard(container, ctx, deps);

			expect(deps.eventBus.on).toHaveBeenCalledWith(
				"canvas.import.progress",
				expect.any(Function),
			);
		});
	});

	describe("cleanup", () => {
		it("returns a cleanup function", () => {
			const cleanup = createCanvasImportWizard(container, ctx, deps);

			expect(typeof cleanup).toBe("function");
		});

		it("cleanup clears the container", () => {
			const cleanup = createCanvasImportWizard(container, ctx, deps);

			// Container has content
			expect(container.innerHTML).not.toBe("");

			cleanup();

			// Container is cleared
			expect(container.innerHTML).toBe("");
		});
	});

	describe("page transitions", () => {
		it("CanvasLanding receives deps with setState and renderContent for navigation", () => {
			createCanvasImportWizard(container, ctx, deps);

			const landingDeps = pageInstances.landing!.deps as Record<string, unknown>;
			expect(typeof landingDeps.setState).toBe("function");
			expect(typeof landingDeps.renderContent).toBe("function");
			expect(typeof landingDeps.getState).toBe("function");
		});

		it("setState updates internal state accessible via getState", () => {
			createCanvasImportWizard(container, ctx, deps);

			const canvasDeps = pageInstances.landing!.deps as {
				getState: () => { currentPage: string };
				setState: (p: Record<string, unknown>) => void;
			};
			expect(canvasDeps.getState().currentPage).toBe("landing");

			canvasDeps.setState({ currentPage: "config" });
			expect(canvasDeps.getState().currentPage).toBe("config");
		});

		it("renderContent re-renders and shows workspace when not on landing", () => {
			createCanvasImportWizard(container, ctx, deps);

			const canvasDeps = pageInstances.landing!.deps as {
				setState: (p: Record<string, unknown>) => void;
				renderContent: () => void;
			};

			// Navigate to config
			canvasDeps.setState({ currentPage: "config" });
			canvasDeps.renderContent();

			// Top bar should now be visible
			const topBar = container.querySelector(".ft-view-top-bar");
			expect(topBar!.classList.contains("ft-hidden")).toBe(false);

			// Landing should now be hidden
			const landing = container.querySelector(".ft-view-landing");
			expect(landing!.classList.contains("ft-hidden")).toBe(true);

			// Workspace should now be visible
			const workspace = container.querySelector(".ft-view-workspace");
			expect(workspace!.classList.contains("ft-hidden")).toBe(false);
		});

		it("navigating to config page renders CanvasConfigPage", () => {
			createCanvasImportWizard(container, ctx, deps);

			const canvasDeps = pageInstances.landing!.deps as {
				setState: (p: Record<string, unknown>) => void;
				renderContent: () => void;
			};

			canvasDeps.setState({ currentPage: "config" });
			canvasDeps.renderContent();

			expect(pageInstances.config!.render).toHaveBeenCalled();
		});

		it("navigating to preview page renders CanvasPreviewPage", () => {
			createCanvasImportWizard(container, ctx, deps);

			const canvasDeps = pageInstances.landing!.deps as {
				setState: (p: Record<string, unknown>) => void;
				renderContent: () => void;
			};

			canvasDeps.setState({ currentPage: "preview" });
			canvasDeps.renderContent();

			expect(pageInstances.preview!.render).toHaveBeenCalled();
		});

		it("navigating to result page renders CanvasResultPage", () => {
			createCanvasImportWizard(container, ctx, deps);

			const canvasDeps = pageInstances.landing!.deps as {
				setState: (p: Record<string, unknown>) => void;
				renderContent: () => void;
			};

			canvasDeps.setState({ currentPage: "result" });
			canvasDeps.renderContent();

			expect(pageInstances.result!.render).toHaveBeenCalled();
		});

		it("navigating back to landing hides workspace and shows landing", () => {
			createCanvasImportWizard(container, ctx, deps);

			const canvasDeps = pageInstances.landing!.deps as {
				setState: (p: Record<string, unknown>) => void;
				renderContent: () => void;
			};

			// Go to config
			canvasDeps.setState({ currentPage: "config" });
			canvasDeps.renderContent();

			// Go back to landing
			canvasDeps.setState({ currentPage: "landing" });
			canvasDeps.renderContent();

			const topBar = container.querySelector(".ft-view-top-bar");
			expect(topBar!.classList.contains("ft-hidden")).toBe(true);

			const landing = container.querySelector(".ft-view-landing");
			expect(landing!.classList.contains("ft-hidden")).toBe(false);

			const workspace = container.querySelector(".ft-view-workspace");
			expect(workspace!.classList.contains("ft-hidden")).toBe(true);
		});
	});

	describe("deps wiring", () => {
		it("deps include canvasService from handler deps", () => {
			createCanvasImportWizard(container, ctx, deps);

			const canvasDeps = pageInstances.landing!.deps as Record<string, unknown>;
			expect(canvasDeps.canvasService).toBe(deps.canvasService);
		});

		it("deps include eventBus from handler deps", () => {
			createCanvasImportWizard(container, ctx, deps);

			const canvasDeps = pageInstances.landing!.deps as Record<string, unknown>;
			expect(canvasDeps.eventBus).toBe(deps.eventBus);
		});

		it("deps include app from handler deps", () => {
			createCanvasImportWizard(container, ctx, deps);

			const canvasDeps = pageInstances.landing!.deps as Record<string, unknown>;
			expect(canvasDeps.app).toBe(deps.app);
		});

		it("deps include parseAndPreview function", () => {
			createCanvasImportWizard(container, ctx, deps);

			const canvasDeps = pageInstances.landing!.deps as Record<string, unknown>;
			expect(typeof canvasDeps.parseAndPreview).toBe("function");
		});

		it("deps include runImport function", () => {
			createCanvasImportWizard(container, ctx, deps);

			const canvasDeps = pageInstances.landing!.deps as Record<string, unknown>;
			expect(typeof canvasDeps.runImport).toBe("function");
		});

		it("deps include saveConfig function", () => {
			createCanvasImportWizard(container, ctx, deps);

			const canvasDeps = pageInstances.landing!.deps as Record<string, unknown>;
			expect(typeof canvasDeps.saveConfig).toBe("function");
		});

		it("deps include detachLeaf that clears container", () => {
			createCanvasImportWizard(container, ctx, deps);

			const canvasDeps = pageInstances.landing!.deps as {
				detachLeaf: () => void;
			};
			expect(typeof canvasDeps.detachLeaf).toBe("function");

			canvasDeps.detachLeaf();
			expect(container.innerHTML).toBe("");
		});
	});
});
