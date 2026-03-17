// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerExportHandler } from "../../../../src/infrastructure/handlers/leaf-handlers/export-handler";
import type { ExportHandlerDeps, ExportViewConfig } from "../../../../src/infrastructure/handlers/leaf-handlers/export-handler";
import { PluginHandlerRegistry } from "../../../../src/infrastructure/handlers/plugin-handler-registry";
import type { IEventBus } from "../../../../src/infrastructure/events/types";

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

function createMockExportService() {
	return {
		parseBaseViews: vi.fn().mockResolvedValue({ views: [] }),
		resolveExportFiles: vi.fn().mockResolvedValue([]),
		scanColumns: vi.fn().mockResolvedValue(["col1", "col2"]),
		scanResolvedColumns: vi.fn().mockResolvedValue(null),
		scanViewFileProperties: vi.fn().mockResolvedValue(["file.name"]),
		scanDisplayNames: vi.fn().mockResolvedValue({}),
		executeExport: vi.fn().mockResolvedValue({
			outputPath: "test_export.csv",
			rowCount: 5,
			columnCount: 2,
		}),
	};
}

function createMockDataExchangeService(exportService: ReturnType<typeof createMockExportService>) {
	return {
		getExportService: vi.fn(() => exportService),
		getSavedExportConfigs: vi.fn(() => []),
		getExportConfigsForSource: vi.fn(() => []),
		saveExportConfig: vi.fn().mockResolvedValue({ id: "saved-1", name: "test" }),
		updateExportConfig: vi.fn().mockResolvedValue(undefined),
	};
}

function createDeps(overrides?: Partial<{
	config: ExportViewConfig | null;
	exportService: ReturnType<typeof createMockExportService>;
}>): {
	deps: ExportHandlerDeps;
	exportService: ReturnType<typeof createMockExportService>;
	eventBus: IEventBus;
} {
	const eventBus = createMockEventBus();
	const exportService = overrides?.exportService ?? createMockExportService();
	const dataExchangeService = createMockDataExchangeService(exportService);
	const config = overrides?.config !== undefined ? overrides.config : {
		sourcePath: "Notes/projects",
		sourceType: "folder" as const,
		format: "csv" as const,
	};

	return {
		deps: {
			dataExchangeService: dataExchangeService as unknown as ExportHandlerDeps["dataExchangeService"],
			eventBus,
			app: {},
			getConfig: () => config,
		},
		exportService,
		eventBus,
	};
}

describe("registerExportHandler", () => {
	let registry: PluginHandlerRegistry;

	beforeEach(() => {
		registry = new PluginHandlerRegistry();
	});

	it("registers the leaf:export tab handler", () => {
		const { deps } = createDeps();
		registerExportHandler(registry, deps);
		expect(registry.getTabHandler("leaf:export")).toBeDefined();
	});

	describe("when no config is provided", () => {
		it("renders a no-config message", () => {
			const { deps } = createDeps({ config: null });
			registerExportHandler(registry, deps);

			const container = document.createElement("div");
			const handler = registry.getTabHandler("leaf:export")!;
			handler(container, { tabId: "export", viewId: "test", eventBus: deps.eventBus });

			expect(container.textContent).toContain("No export configuration provided.");
		});

		it("does not create layout skeleton", () => {
			const { deps } = createDeps({ config: null });
			registerExportHandler(registry, deps);

			const container = document.createElement("div");
			const handler = registry.getTabHandler("leaf:export")!;
			handler(container, { tabId: "export", viewId: "test", eventBus: deps.eventBus });

			expect(container.querySelector(".ft-view-root-flex")).toBeNull();
		});
	});

	describe("when config is provided", () => {
		it("creates the layout skeleton with root, topbar, and workspace", () => {
			const { deps } = createDeps();
			registerExportHandler(registry, deps);

			const container = document.createElement("div");
			const handler = registry.getTabHandler("leaf:export")!;
			handler(container, { tabId: "export", viewId: "test", eventBus: deps.eventBus });

			expect(container.querySelector(".ft-view-root-flex")).not.toBeNull();
			expect(container.querySelector(".ft-view-top-bar")).not.toBeNull();
			expect(container.querySelector(".ft-view-workspace")).not.toBeNull();
		});

		it("renders the top bar with source name", () => {
			const { deps } = createDeps();
			registerExportHandler(registry, deps);

			const container = document.createElement("div");
			const handler = registry.getTabHandler("leaf:export")!;
			handler(container, { tabId: "export", viewId: "test", eventBus: deps.eventBus });

			// The top bar should contain the source path's last segment
			const topBar = container.querySelector(".ft-view-top-bar");
			expect(topBar).not.toBeNull();
			expect(topBar!.textContent).toContain("projects");
		});

		it("renders the export badge in the top bar", () => {
			const { deps } = createDeps();
			registerExportHandler(registry, deps);

			const container = document.createElement("div");
			const handler = registry.getTabHandler("leaf:export")!;
			handler(container, { tabId: "export", viewId: "test", eventBus: deps.eventBus });

			const badge = container.querySelector(".ft-operation-badge-export");
			expect(badge).not.toBeNull();
			expect(badge!.textContent).toBe("Export");
		});

		it("shows 'No config loaded' badge when no saved config is active", () => {
			const { deps } = createDeps();
			registerExportHandler(registry, deps);

			const container = document.createElement("div");
			const handler = registry.getTabHandler("leaf:export")!;
			handler(container, { tabId: "export", viewId: "test", eventBus: deps.eventBus });

			const mutedBadges = container.querySelectorAll(".ft-badge-muted");
			const texts = Array.from(mutedBadges).map((el) => el.textContent);
			expect(texts).toContain("No config loaded");
		});

		it("renders the step bar with correct steps for folder source", () => {
			const { deps } = createDeps();
			registerExportHandler(registry, deps);

			const container = document.createElement("div");
			const handler = registry.getTabHandler("leaf:export")!;
			handler(container, { tabId: "export", viewId: "test", eventBus: deps.eventBus });

			const stepBar = container.querySelector(".ft-step-bar");
			expect(stepBar).not.toBeNull();
			// Folder source: 3 steps (configure, preview, result)
			const steps = stepBar!.querySelectorAll(".ft-step-indicator");
			expect(steps.length).toBe(3);
		});

		it("renders the step bar with 4 steps for base source", () => {
			const { deps } = createDeps({
				config: {
					sourcePath: "Notes/data.base",
					sourceType: "base",
					format: "csv",
				},
			});
			registerExportHandler(registry, deps);

			const container = document.createElement("div");
			const handler = registry.getTabHandler("leaf:export")!;
			handler(container, { tabId: "export", viewId: "test", eventBus: deps.eventBus });

			const stepBar = container.querySelector(".ft-step-bar");
			expect(stepBar).not.toBeNull();
			// Base source: 4 steps (view-select, configure, preview, result)
			const steps = stepBar!.querySelectorAll(".ft-step-indicator");
			expect(steps.length).toBe(4);
		});

		it("renders the config dropdown", () => {
			const { deps } = createDeps();
			registerExportHandler(registry, deps);

			const container = document.createElement("div");
			const handler = registry.getTabHandler("leaf:export")!;
			handler(container, { tabId: "export", viewId: "test", eventBus: deps.eventBus });

			const dropdown = container.querySelector(".ft-config-dropdown");
			expect(dropdown).not.toBeNull();
		});

		it("clears previous container content on re-render", () => {
			const { deps } = createDeps();
			registerExportHandler(registry, deps);

			const container = document.createElement("div");
			container.innerHTML = "<div class='old-content'>old</div>";

			const handler = registry.getTabHandler("leaf:export")!;
			handler(container, { tabId: "export", viewId: "test", eventBus: deps.eventBus });

			expect(container.querySelector(".old-content")).toBeNull();
			expect(container.querySelector(".ft-view-root-flex")).not.toBeNull();
		});
	});

	describe("initial data loading", () => {
		it("calls resolveExportFiles for folder source", async () => {
			const { deps, exportService } = createDeps();
			registerExportHandler(registry, deps);

			const container = document.createElement("div");
			const handler = registry.getTabHandler("leaf:export")!;
			handler(container, { tabId: "export", viewId: "test", eventBus: deps.eventBus });

			// Allow async data load to complete
			await vi.waitFor(() => {
				expect(exportService.resolveExportFiles).toHaveBeenCalledWith(
					"Notes/projects",
					"folder",
					0,
				);
			});
		});

		it("calls scanColumns for folder source", async () => {
			const { deps, exportService } = createDeps();
			registerExportHandler(registry, deps);

			const container = document.createElement("div");
			const handler = registry.getTabHandler("leaf:export")!;
			handler(container, { tabId: "export", viewId: "test", eventBus: deps.eventBus });

			await vi.waitFor(() => {
				expect(exportService.scanColumns).toHaveBeenCalledWith(
					"Notes/projects",
					"folder",
				);
			});
		});

		it("calls parseBaseViews for base source", async () => {
			const { deps, exportService } = createDeps({
				config: {
					sourcePath: "Notes/data.base",
					sourceType: "base",
					format: "csv",
				},
			});
			registerExportHandler(registry, deps);

			const container = document.createElement("div");
			const handler = registry.getTabHandler("leaf:export")!;
			handler(container, { tabId: "export", viewId: "test", eventBus: deps.eventBus });

			await vi.waitFor(() => {
				expect(exportService.parseBaseViews).toHaveBeenCalledWith("Notes/data.base");
			});
		});

		it("sets loadError when data loading fails", async () => {
			const exportService = createMockExportService();
			exportService.resolveExportFiles.mockRejectedValue(new Error("File not found"));

			const { deps } = createDeps({ exportService });
			registerExportHandler(registry, deps);

			const container = document.createElement("div");
			const handler = registry.getTabHandler("leaf:export")!;
			handler(container, { tabId: "export", viewId: "test", eventBus: deps.eventBus });

			// Wait for async load to complete and error to be rendered
			await vi.waitFor(() => {
				const alert = container.querySelector(".ft-alert-error");
				expect(alert).not.toBeNull();
				expect(alert!.textContent).toContain("File not found");
			});
		});
	});

	describe("state transitions", () => {
		it("starts on configure page for folder source", () => {
			const { deps } = createDeps();
			registerExportHandler(registry, deps);

			const container = document.createElement("div");
			const handler = registry.getTabHandler("leaf:export")!;
			handler(container, { tabId: "export", viewId: "test", eventBus: deps.eventBus });

			// The first step should be active (configure)
			const steps = container.querySelectorAll(".ft-step-indicator");
			expect(steps[0]?.classList.contains("ft-step-running")).toBe(true);
		});

		it("starts on view-select page for base source", () => {
			const { deps } = createDeps({
				config: {
					sourcePath: "Notes/data.base",
					sourceType: "base",
					format: "csv",
				},
			});
			registerExportHandler(registry, deps);

			const container = document.createElement("div");
			const handler = registry.getTabHandler("leaf:export")!;
			handler(container, { tabId: "export", viewId: "test", eventBus: deps.eventBus });

			// The first step (view-select) should be running
			const steps = container.querySelectorAll(".ft-step-indicator");
			expect(steps[0]?.classList.contains("ft-step-running")).toBe(true);
		});
	});
});
