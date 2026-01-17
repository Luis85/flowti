import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as obsidianModule from "obsidian";

// Spy on setTooltip from the obsidian stub
const setTooltipMock = vi.spyOn(obsidianModule, "setTooltip");

import { StatusBarService } from "../../src/services/StatusBarService";
import {
	createMockStatusBarContext,
	createMockSettings,
	createMockStats,
	createMockMapping,
} from "../mocks/factories";
import type { IStatusBarContext } from "../../src/services/types";
import type { ReconcileProgress } from "../../src/types";

describe("StatusBarService", () => {
	let ctx: IStatusBarContext;
	let service: StatusBarService;
	let mockElement: {
		addClass: ReturnType<typeof vi.fn>;
		setText: ReturnType<typeof vi.fn>;
		addEventListener: ReturnType<typeof vi.fn>;
		removeEventListener: ReturnType<typeof vi.fn>;
		detach: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Create a fresh mock element for each test
		mockElement = {
			addClass: vi.fn(),
			setText: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			detach: vi.fn(),
		};

		ctx = createMockStatusBarContext({
			addStatusBarItem: vi.fn().mockReturnValue(mockElement as unknown as HTMLElement),
		});

		service = new StatusBarService(ctx);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("constructor", () => {
		it("should create status bar element", () => {
			expect(ctx.addStatusBarItem).toHaveBeenCalled();
		});

		it("should add CSS class to element", () => {
			expect(mockElement.addClass).toHaveBeenCalledWith("filewatcher-status");
		});

		it("should set up click handler for dashboard", () => {
			expect(mockElement.addEventListener).toHaveBeenCalledWith(
				"click",
				expect.any(Function)
			);
		});

		it("should render initial state", () => {
			expect(mockElement.setText).toHaveBeenCalled();
		});
	});

	describe("render", () => {
		it("should display active watcher count and stats", () => {
			const stats = createMockStats({
				filesProcessed: 10,
				filesSkipped: 5,
				errors: 2,
			});

			ctx = createMockStatusBarContext({
				addStatusBarItem: vi.fn().mockReturnValue(mockElement as unknown as HTMLElement),
				stats,
				getActiveWatcherCount: vi.fn().mockReturnValue(3),
			});

			service = new StatusBarService(ctx);

			// Check the text was set with correct format
			expect(mockElement.setText).toHaveBeenCalledWith(
				expect.stringContaining("Sync 3")
			);
			expect(mockElement.setText).toHaveBeenCalledWith(
				expect.stringContaining("✅10")
			);
			expect(mockElement.setText).toHaveBeenCalledWith(
				expect.stringContaining("⏭️5")
			);
			expect(mockElement.setText).toHaveBeenCalledWith(
				expect.stringContaining("⚠️2")
			);
		});

		it("should display reconcile progress when active", () => {
			const reconcileProgress: ReconcileProgress = {
				mappingId: "m1",
				mappingLabel: "Test Mapping",
				phase: "syncing",
				total: 100,
				scanned: 50,
				processed: 30,
				skipped: 15,
				errors: 5,
			};

			service.setReconcileProgress(reconcileProgress, { mappingIndex: 1, mappingTotal: 2 });

			// Should display reconcile progress format
			expect(mockElement.setText).toHaveBeenLastCalledWith(
				expect.stringContaining("R 1/2")
			);
		});

		it("should set tooltip with detailed information", () => {
			const mapping = createMockMapping({ id: "m1", description: "Test Mapping" });

			ctx = createMockStatusBarContext({
				addStatusBarItem: vi.fn().mockReturnValue(mockElement as unknown as HTMLElement),
				settings: createMockSettings({ folderMappings: [mapping] }),
				stats: createMockStats({
					perMappingStats: {
						m1: { processed: 5, skipped: 2, errors: 1 },
					},
				}),
			});

			service = new StatusBarService(ctx);

			expect(setTooltipMock).toHaveBeenCalled();
			const tooltipCall = setTooltipMock.mock.calls[0];
			expect(tooltipCall[1]).toContain("Active mappings:");
			expect(tooltipCall[1]).toContain("Per mapping:");
		});
	});

	describe("setReconcileProgress", () => {
		it("should update reconcile state", () => {
			const progress: ReconcileProgress = {
				mappingId: "m1",
				mappingLabel: "Test",
				phase: "scanning",
				scanned: 10,
				processed: 0,
				skipped: 0,
				errors: 0,
			};

			service.setReconcileProgress(progress);

			// Should trigger a render with reconcile data
			expect(mockElement.setText).toHaveBeenLastCalledWith(
				expect.stringContaining("R")
			);
		});

		it("should update mapping metadata", () => {
			const progress: ReconcileProgress = {
				mappingId: "m1",
				mappingLabel: "Test",
				phase: "scanning",
				scanned: 10,
				processed: 0,
				skipped: 0,
				errors: 0,
			};

			service.setReconcileProgress(progress, { mappingIndex: 2, mappingTotal: 5 });

			expect(mockElement.setText).toHaveBeenLastCalledWith(
				expect.stringContaining("R 2/5")
			);
		});
	});

	describe("clearReconcileProgress", () => {
		it("should clear reconcile state and render normal status", () => {
			// First set some progress
			service.setReconcileProgress({
				mappingId: "m1",
				mappingLabel: "Test",
				phase: "syncing",
				scanned: 50,
				processed: 30,
				skipped: 10,
				errors: 5,
			});

			// Then clear it
			service.clearReconcileProgress();

			// Should show normal status (not reconcile)
			const lastCall = mockElement.setText.mock.calls[mockElement.setText.mock.calls.length - 1];
			expect(lastCall[0]).toContain("Sync");
			expect(lastCall[0]).not.toContain("R 1/");
		});
	});

	describe("onStatsChanged", () => {
		it("should trigger render", () => {
			const initialCallCount = mockElement.setText.mock.calls.length;

			service.onStatsChanged();

			// Should have called setText again (render)
			expect(mockElement.setText.mock.calls.length).toBeGreaterThan(initialCallCount);
		});
	});

	describe("destroy", () => {
		it("should remove click handler", () => {
			service.destroy();

			expect(mockElement.removeEventListener).toHaveBeenCalledWith(
				"click",
				expect.any(Function)
			);
		});

		it("should detach element", () => {
			service.destroy();

			expect(mockElement.detach).toHaveBeenCalled();
		});
	});

	describe("throttling", () => {
		beforeEach(() => {
			vi.useFakeTimers();
			// Mock window.setTimeout and window.clearTimeout for Node environment
			vi.stubGlobal("window", {
				setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
				clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
			});
		});

		afterEach(() => {
			vi.useRealTimers();
			vi.unstubAllGlobals();
		});

		it("should throttle rapid updates", () => {
			const initialCallCount = mockElement.setText.mock.calls.length;

			// Trigger many rapid updates
			for (let i = 0; i < 10; i++) {
				service.onStatsChanged();
			}

			// Should only have 1 immediate render (not 10)
			const afterRapidUpdates = mockElement.setText.mock.calls.length;
			expect(afterRapidUpdates - initialCallCount).toBeLessThanOrEqual(2);

			// Advance time past throttle
			vi.advanceTimersByTime(200);

			// Now should have rendered once more
			expect(mockElement.setText.mock.calls.length).toBeGreaterThan(afterRapidUpdates);
		});

		it("should render immediately when clearing progress", () => {
			service.setReconcileProgress({
				mappingId: "m1",
				mappingLabel: "Test",
				phase: "syncing",
				scanned: 10,
				processed: 5,
				skipped: 2,
				errors: 1,
			});

			const beforeClear = mockElement.setText.mock.calls.length;

			service.clearReconcileProgress();

			// Should render immediately, not throttled
			expect(mockElement.setText.mock.calls.length).toBe(beforeClear + 1);
		});
	});

	describe("click handler", () => {
		it("should open dashboard on click", () => {
			// Get the click handler that was registered
			const addEventListenerCall = mockElement.addEventListener.mock.calls.find(
				(call) => call[0] === "click"
			);
			const clickHandler = addEventListenerCall?.[1];

			// Simulate click
			clickHandler?.();

			expect(ctx.openDashboard).toHaveBeenCalled();
		});
	});
});
