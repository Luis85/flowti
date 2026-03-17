import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { UiCommandService } from "../../../src/infrastructure/ui/UiCommandService";
import type {
	OpenCsvImportCallback,
	OpenExportViewCallback,
	OpenExportWithSavedConfigCallback,
	InputModalConfig,
} from "../../../src/infrastructure/ui/UiCommandService";
import type { ModalService } from "../../../src/infrastructure/ui/ModalService";
import type { SavedExportConfig, SavedImportConfig } from "../../../src/domain/dataExchange/types";

function createMockModalService() {
	return {
		openInput: vi.fn(),
		openSubscriptionManager: vi.fn(),
	} as unknown as ModalService;
}

// ─── Mock workspace helpers ──────────────────────────────────────

function createMockLeaf() {
	return {
		setViewState: vi.fn().mockResolvedValue(undefined),
		view: {},
	};
}

function createMockApp(options: { existingLeaves?: Record<string, unknown[]> } = {}) {
	const { existingLeaves = {} } = options;
	const rightLeaf = createMockLeaf();
	const mainLeaf = createMockLeaf();

	return {
		workspace: {
			getLeavesOfType: vi.fn((type: string) => existingLeaves[type] ?? []),
			getLeaf: vi.fn(() => mainLeaf),
			getRightLeaf: vi.fn(() => rightLeaf),
			revealLeaf: vi.fn(),
		},
		_rightLeaf: rightLeaf,
		_mainLeaf: mainLeaf,
	};
}

// ─── Tests ───────────────────────────────────────────────────────

describe("UiCommandService", () => {
	let eventBus: IEventBus;
	let app: ReturnType<typeof createMockApp>;
	let service: UiCommandService;

	beforeEach(() => {
		eventBus = new EventBus();
		app = createMockApp();
		service = new UiCommandService({ app: app as never, eventBus });
	});

	// ── Navigation commands (open view) ─────────────────────────

	describe("ui.openEventCatalog", () => {
		it("should open a new leaf in main workspace when view not open", async () => {
			await eventBus.emit("ui.openEventCatalog", {});

			expect(app.workspace.getLeavesOfType).toHaveBeenCalledWith("flowti-event-catalog");
			expect(app.workspace.getLeaf).toHaveBeenCalledWith(true);
			expect(app._mainLeaf.setViewState).toHaveBeenCalledWith({
				type: "flowti-event-catalog",
				active: true,
			});
			expect(app.workspace.revealLeaf).toHaveBeenCalledWith(app._mainLeaf);
		});

		it("should reveal existing leaf when view already open", async () => {
			const existingLeaf = { view: {} };
			app.workspace.getLeavesOfType.mockReturnValue([existingLeaf]);

			await eventBus.emit("ui.openEventCatalog", {});

			expect(app.workspace.revealLeaf).toHaveBeenCalledWith(existingLeaf);
			expect(app.workspace.getLeaf).not.toHaveBeenCalled();
		});

		it("should emit ui.opened after opening", async () => {
			const spy = vi.fn();
			eventBus.on("ui.opened", spy);

			await eventBus.emit("ui.openEventCatalog", {});

			expect(spy).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ target: "eventCatalog" }),
				}),
			);
		});
	});

	describe("ui.openDataExchangeHub", () => {
		it("should open in main workspace when view not open", async () => {
			await eventBus.emit("ui.openDataExchangeHub", {});

			expect(app.workspace.getLeaf).toHaveBeenCalledWith(true);
			expect(app._mainLeaf.setViewState).toHaveBeenCalledWith({
				type: "flowti-data-exchange-hub",
				active: true,
			});
		});

		it("should reveal existing leaf when view already open", async () => {
			const existingLeaf = { view: {} };
			app.workspace.getLeavesOfType.mockReturnValue([existingLeaf]);

			await eventBus.emit("ui.openDataExchangeHub", {});

			expect(app.workspace.revealLeaf).toHaveBeenCalledWith(existingLeaf);
			expect(app.workspace.getLeaf).not.toHaveBeenCalled();
		});
	});

	describe("ui.openTrainHub", () => {
		it("should open in main workspace when view not open", async () => {
			await eventBus.emit("ui.openTrainHub", {});

			expect(app.workspace.getLeaf).toHaveBeenCalledWith(true);
			expect(app._mainLeaf.setViewState).toHaveBeenCalledWith({
				type: "flowti-train-hub",
				active: true,
			});
		});

		it("should reveal existing leaf when view already open", async () => {
			const existingLeaf = { view: {} };
			app.workspace.getLeavesOfType.mockReturnValue([existingLeaf]);

			await eventBus.emit("ui.openTrainHub", {});

			expect(app.workspace.revealLeaf).toHaveBeenCalledWith(existingLeaf);
			expect(app.workspace.getLeaf).not.toHaveBeenCalled();
		});

		it("should emit ui.opened with target trainHub", async () => {
			const spy = vi.fn();
			eventBus.on("ui.opened", spy);

			await eventBus.emit("ui.openTrainHub", {});

			expect(spy).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ target: "trainHub" }),
				}),
			);
		});
	});

	describe("ui.openAnalyticsHub", () => {
		it("should open in main workspace when view not open", async () => {
			await eventBus.emit("ui.openAnalyticsHub", {});

			expect(app.workspace.getLeaf).toHaveBeenCalledWith(true);
			expect(app._mainLeaf.setViewState).toHaveBeenCalledWith({
				type: "flowti-analytics-hub",
				active: true,
			});
		});

		it("should reveal existing leaf when view already open", async () => {
			const existingLeaf = { view: {} };
			app.workspace.getLeavesOfType.mockReturnValue([existingLeaf]);

			await eventBus.emit("ui.openAnalyticsHub", {});

			expect(app.workspace.revealLeaf).toHaveBeenCalledWith(existingLeaf);
			expect(app.workspace.getLeaf).not.toHaveBeenCalled();
		});

		it("should emit ui.opened with target analyticsHub", async () => {
			const spy = vi.fn();
			eventBus.on("ui.opened", spy);

			await eventBus.emit("ui.openAnalyticsHub", {});

			expect(spy).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ target: "analyticsHub" }),
				}),
			);
		});
	});

	// ── Subscription Manager modal ──────────────────────────────

	describe("ui.openSubscriptionManager", () => {
		it("should delegate to ModalService.openSubscriptionManager", async () => {
			const mockModal = createMockModalService();
			service.setModalService(mockModal);

			await eventBus.emit("ui.openSubscriptionManager", {});

			expect(mockModal.openSubscriptionManager).toHaveBeenCalled();
		});

		it("should emit ui.opened with target subscriptionManager", async () => {
			const mockModal = createMockModalService();
			service.setModalService(mockModal);

			const spy = vi.fn();
			eventBus.on("ui.opened", spy);

			await eventBus.emit("ui.openSubscriptionManager", {});

			expect(spy).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ target: "subscriptionManager" }),
				}),
			);
		});
	});

	// ── CSV import ──────────────────────────────────────────────

	describe("ui.openCsvImport", () => {
		let openCsvImportFn: Mock;

		beforeEach(() => {
			openCsvImportFn = vi.fn();
			service.setOpenCsvImport(openCsvImportFn as OpenCsvImportCallback);
		});

		it("should delegate directly when filePath is provided", async () => {
			await eventBus.emit("ui.openCsvImport", {
				filePath: "data/test.csv",
			});

			expect(openCsvImportFn).toHaveBeenCalledWith("data/test.csv", undefined);
		});

		it("should pass savedConfig when provided", async () => {
			const savedConfig = { name: "test-config" } as SavedImportConfig;

			await eventBus.emit("ui.openCsvImport", {
				filePath: "data/test.csv",
				savedConfig,
			});

			expect(openCsvImportFn).toHaveBeenCalledWith("data/test.csv", savedConfig);
		});

		it("should emit ui.opened after delegating", async () => {
			const spy = vi.fn();
			eventBus.on("ui.opened", spy);

			await eventBus.emit("ui.openCsvImport", {
				filePath: "data/test.csv",
			});

			expect(spy).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ target: "csvImport" }),
				}),
			);
		});

		it("should show InputModal when filePath is absent", async () => {
			const mockModal = createMockModalService();
			service.setModalService(mockModal);

			await eventBus.emit("ui.openCsvImport", {});

			expect(mockModal.openInput).toHaveBeenCalledWith(
				expect.objectContaining({
					title: "Import CSV",
					submitLabel: "Import",
				}),
			);
		});

		it("should delegate to openCsvImport when InputModal submits", async () => {
			const mockModal = createMockModalService();
			service.setModalService(mockModal);

			await eventBus.emit("ui.openCsvImport", {});

			// Extract and invoke the onSubmit callback
			const config: InputModalConfig = (mockModal.openInput as ReturnType<typeof vi.fn>).mock.calls[0][0];
			config.onSubmit("path/to/data.csv");

			expect(openCsvImportFn).toHaveBeenCalledWith("path/to/data.csv");
		});

		it("should not throw when callback is not set", async () => {
			const freshService = new UiCommandService({ app: app as never, eventBus: new EventBus() });
			const freshBus = (freshService as unknown as { eventBus: IEventBus }).eventBus;

			// No callback set — should not throw
			await expect(
				freshBus.emit("ui.openCsvImport", { filePath: "test.csv" }),
			).resolves.not.toThrow();

			freshService.dispose();
		});
	});

	// ── Export ───────────────────────────────────────────────────

	describe("ui.openExport", () => {
		let openExportViewFn: Mock;
		let openExportWithSavedConfigFn: Mock;

		beforeEach(() => {
			openExportViewFn = vi.fn();
			openExportWithSavedConfigFn = vi.fn();
			service.setOpenExportView(openExportViewFn as OpenExportViewCallback);
			service.setOpenExportWithSavedConfig(openExportWithSavedConfigFn as OpenExportWithSavedConfigCallback);
		});

		it("should delegate with savedConfig when provided", async () => {
			const savedConfig = { name: "my-export" } as SavedExportConfig;

			await eventBus.emit("ui.openExport", {
				format: "csv",
				savedConfig,
			});

			expect(openExportWithSavedConfigFn).toHaveBeenCalledWith(savedConfig);
			expect(openExportViewFn).not.toHaveBeenCalled();
		});

		it("should delegate with sourcePath/sourceType when provided", async () => {
			await eventBus.emit("ui.openExport", {
				sourcePath: "folder/data",
				sourceType: "folder",
				format: "csv",
			});

			expect(openExportViewFn).toHaveBeenCalledWith("folder/data", "folder", "csv");
		});

		it("should handle base sourceType correctly", async () => {
			await eventBus.emit("ui.openExport", {
				sourcePath: "views/people.base",
				sourceType: "base",
				format: "tab",
			});

			expect(openExportViewFn).toHaveBeenCalledWith("views/people.base", "base", "tab");
		});

		it("should emit ui.opened after delegating", async () => {
			const spy = vi.fn();
			eventBus.on("ui.opened", spy);

			await eventBus.emit("ui.openExport", {
				sourcePath: "test",
				sourceType: "folder",
				format: "csv",
			});

			expect(spy).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ target: "export" }),
				}),
			);
		});

		it("should show InputModal when sourcePath is absent and no savedConfig", async () => {
			const mockModal = createMockModalService();
			service.setModalService(mockModal);

			await eventBus.emit("ui.openExport", { format: "csv" });

			expect(mockModal.openInput).toHaveBeenCalledWith(
				expect.objectContaining({
					title: "Export as CSV",
					submitLabel: "Export",
				}),
			);
		});

		it("should show Tab label in InputModal for tab format", async () => {
			const mockModal = createMockModalService();
			service.setModalService(mockModal);

			await eventBus.emit("ui.openExport", { format: "tab" });

			expect(mockModal.openInput).toHaveBeenCalledWith(
				expect.objectContaining({
					title: "Export as Tab",
				}),
			);
		});

		it("should delegate with inferred sourceType from InputModal", async () => {
			const mockModal = createMockModalService();
			service.setModalService(mockModal);

			await eventBus.emit("ui.openExport", { format: "csv" });

			const config: InputModalConfig = (mockModal.openInput as ReturnType<typeof vi.fn>).mock.calls[0][0];

			// Submit a .base path — should infer sourceType as "base"
			config.onSubmit("views/people.base");
			expect(openExportViewFn).toHaveBeenCalledWith("views/people.base", "base", "csv");

			openExportViewFn.mockClear();

			// Submit a folder path — should infer sourceType as "folder"
			config.onSubmit("some/folder");
			expect(openExportViewFn).toHaveBeenCalledWith("some/folder", "folder", "csv");
		});

		it("should prioritize savedConfig over sourcePath", async () => {
			const savedConfig = { name: "cfg" } as SavedExportConfig;

			await eventBus.emit("ui.openExport", {
				sourcePath: "some/path",
				sourceType: "folder",
				format: "csv",
				savedConfig,
			});

			expect(openExportWithSavedConfigFn).toHaveBeenCalledWith(savedConfig);
			expect(openExportViewFn).not.toHaveBeenCalled();
		});
	});

	// ── Dispose ─────────────────────────────────────────────────

	describe("dispose", () => {
		it("should unsubscribe all listeners", async () => {
			const spy = vi.fn();
			eventBus.on("ui.opened", spy);

			service.dispose();

			// After dispose, emitting an event should not trigger UiCommandService handlers
			await eventBus.emit("ui.openEventCatalog", {});

			// The ui.opened spy should NOT have been called because UiCommandService
			// is disposed and no longer emitting ui.opened
			expect(spy).not.toHaveBeenCalled();
		});

		it("should be safe to call multiple times", () => {
			expect(() => {
				service.dispose();
				service.dispose();
			}).not.toThrow();
		});
	});
});
