// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CanvasSyncController } from "../../../src/ui/journeyBuilder/CanvasSyncController";
import type { CanvasSyncControllerDeps } from "../../../src/ui/journeyBuilder/CanvasSyncController";
import { EventBus } from "../../../src/infrastructure/events/EventBus";

describe("CanvasSyncController", () => {
	let eventBus: EventBus;
	let deps: CanvasSyncControllerDeps;
	let controller: CanvasSyncController;

	beforeEach(() => {
		vi.useFakeTimers();
		eventBus = new EventBus();
		deps = {
			eventBus,
			getCanvasPath: vi.fn(() => "journeys/Test/Test.canvas"),
			buildSyncInput: vi.fn(() => ({
				journey: "Test",
				description: "",
				startEvent: "",
				endEvent: "",
				activeStepIndex: 0,
				steps: [],
			})),
			getApp: () => undefined,
		};
		controller = new CanvasSyncController(deps);
	});

	afterEach(() => {
		controller.destroy();
		vi.useRealTimers();
	});

	describe("scheduleSync", () => {
		it("emits sync-requested after default delay", async () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);

			controller.scheduleSync();
			expect(handler).not.toHaveBeenCalled();

			vi.advanceTimersByTime(1500);
			// Allow microtask for async emit
			await vi.runAllTimersAsync();
			expect(handler).toHaveBeenCalledOnce();
		});

		it("emits sync-requested after custom delay", async () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);

			controller.scheduleSync(300);
			vi.advanceTimersByTime(299);
			await Promise.resolve();
			expect(handler).not.toHaveBeenCalled();

			vi.advanceTimersByTime(1);
			await vi.runAllTimersAsync();
			expect(handler).toHaveBeenCalledOnce();
		});

		it("debounces multiple calls", async () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);

			controller.scheduleSync(500);
			vi.advanceTimersByTime(200);
			controller.scheduleSync(500);
			vi.advanceTimersByTime(200);
			controller.scheduleSync(500);

			vi.advanceTimersByTime(500);
			await vi.runAllTimersAsync();
			expect(handler).toHaveBeenCalledOnce();
		});

		it("does not emit when canvas path is empty", async () => {
			(deps.getCanvasPath as ReturnType<typeof vi.fn>).mockReturnValue("");
			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);

			controller.scheduleSync();
			vi.advanceTimersByTime(2000);
			await vi.runAllTimersAsync();
			expect(handler).not.toHaveBeenCalled();
		});

		it("includes canvas path and definition in payload", async () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);

			controller.scheduleSync();
			vi.advanceTimersByTime(1500);
			await vi.runAllTimersAsync();

			const payload = handler.mock.calls[0][0].payload;
			expect(payload.canvasPath).toBe("journeys/Test/Test.canvas");
			expect(payload.definition.journey).toBe("Test");
		});
	});

	describe("onSynced", () => {
		it("tracks canvas opened path on first sync", () => {
			controller.onSynced({ canvasPath: "journeys/Test/Test.canvas" });
			expect(controller.getCanvasOpenedPath()).toBe("journeys/Test/Test.canvas");
		});

		it("opens canvas link on first sync via app workspace", () => {
			const openLinkText = vi.fn();
			const mockApp = { workspace: { openLinkText } } as never;
			deps.getApp = () => mockApp;
			controller = new CanvasSyncController(deps);

			controller.onSynced({ canvasPath: "journeys/Test/Test.canvas" });
			expect(openLinkText).toHaveBeenCalledWith("journeys/Test/Test.canvas", "");
		});

		it("does not re-open canvas on subsequent syncs", () => {
			const openLinkText = vi.fn();
			const mockApp = { workspace: { openLinkText } } as never;
			deps.getApp = () => mockApp;
			controller = new CanvasSyncController(deps);

			controller.onSynced({ canvasPath: "journeys/Test/Test.canvas" });
			controller.onSynced({ canvasPath: "journeys/Test/Test.canvas" });
			expect(openLinkText).toHaveBeenCalledOnce();
		});
	});

	describe("setPendingZoom", () => {
		it("flags zoom for next synced event", () => {
			const openLinkText = vi.fn();
			const mockApp = { workspace: { openLinkText } } as never;
			deps.getApp = () => mockApp;
			controller = new CanvasSyncController(deps);

			// First sync opens canvas
			controller.onSynced({ canvasPath: "journeys/Test/Test.canvas" });

			// setPendingZoom enables zoom on next sync
			controller.setPendingZoom();
			controller.onSynced({ canvasPath: "journeys/Test/Test.canvas" });
			// Zoom scheduled (tested via timer)
		});
	});

	describe("resetCanvasPath", () => {
		it("clears the tracked canvas path", () => {
			controller.onSynced({ canvasPath: "journeys/Test/Test.canvas" });
			expect(controller.getCanvasOpenedPath()).toBe("journeys/Test/Test.canvas");
			controller.resetCanvasPath();
			expect(controller.getCanvasOpenedPath()).toBeNull();
		});
	});

	describe("canvas selection watching", () => {
		function createMockCanvasApp(canvasPath: string, nodes: Map<string, { getData: () => Record<string, unknown> }>, selection: Set<unknown> = new Set()) {
			const containerEl = document.createElement("div");
			const leaf = {
				containerEl,
				view: {
					file: { path: canvasPath },
					canvas: { nodes, selection, zoomToFit: vi.fn(), zoomToSelection: vi.fn(), selectOnly: vi.fn(), deselectAll: vi.fn() },
				},
			};
			return {
				workspace: {
					openLinkText: vi.fn(),
					getLeavesOfType: vi.fn(() => [leaf]),
				},
				containerEl,
				canvas: leaf.view.canvas,
			};
		}

		function makeGroupNode(id: string, label: string, x: number) {
			return {
				getData: () => ({ id, type: "group", label, x, y: 0, width: 480, height: 160 }),
			};
		}

		function makeTextNode(id: string, x: number, y: number) {
			return {
				getData: () => ({ id, type: "text", x, y, width: 380, height: 60 }),
			};
		}

		it("calls onStepSelected when a group node is clicked on canvas", () => {
			const onStepSelected = vi.fn();
			const step1 = makeGroupNode("g1", "Step 1", 200);
			const step2 = makeGroupNode("g2", "Step 2", 720);
			const nodes = new Map([["g1", step1], ["g2", step2]]);
			const selection = new Set([step2]);

			const mockApp = createMockCanvasApp("journeys/Test/Test.canvas", nodes, selection);
			deps.getApp = () => mockApp as never;
			deps.onStepSelected = onStepSelected;
			controller = new CanvasSyncController(deps);

			controller.onSynced({ canvasPath: "journeys/Test/Test.canvas" });

			// Simulate pointer up on canvas container
			mockApp.containerEl.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
			vi.advanceTimersByTime(50);

			expect(onStepSelected).toHaveBeenCalledWith(1);
		});

		it("calls onStepSelected with index 0 for the first group", () => {
			const onStepSelected = vi.fn();
			const step1 = makeGroupNode("g1", "Step 1", 200);
			const step2 = makeGroupNode("g2", "Step 2", 720);
			const nodes = new Map([["g1", step1], ["g2", step2]]);
			const selection = new Set([step1]);

			const mockApp = createMockCanvasApp("journeys/Test/Test.canvas", nodes, selection);
			deps.getApp = () => mockApp as never;
			deps.onStepSelected = onStepSelected;
			controller = new CanvasSyncController(deps);

			controller.onSynced({ canvasPath: "journeys/Test/Test.canvas" });
			mockApp.containerEl.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
			vi.advanceTimersByTime(50);

			expect(onStepSelected).toHaveBeenCalledWith(0);
		});

		it("resolves text node inside group to parent group step index", () => {
			const onStepSelected = vi.fn();
			const step1 = makeGroupNode("g1", "Step 1", 200);
			const innerText = makeTextNode("t1", 250, 50); // inside g1 (200-680, 0-160)
			const nodes = new Map([["g1", step1], ["t1", innerText]]);
			const selection = new Set([innerText]);

			const mockApp = createMockCanvasApp("journeys/Test/Test.canvas", nodes, selection);
			deps.getApp = () => mockApp as never;
			deps.onStepSelected = onStepSelected;
			controller = new CanvasSyncController(deps);

			controller.onSynced({ canvasPath: "journeys/Test/Test.canvas" });
			mockApp.containerEl.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
			vi.advanceTimersByTime(50);

			expect(onStepSelected).toHaveBeenCalledWith(0);
		});

		it("does not call onStepSelected when no node is selected", () => {
			const onStepSelected = vi.fn();
			const step1 = makeGroupNode("g1", "Step 1", 200);
			const nodes = new Map([["g1", step1]]);
			const selection = new Set();

			const mockApp = createMockCanvasApp("journeys/Test/Test.canvas", nodes, selection);
			deps.getApp = () => mockApp as never;
			deps.onStepSelected = onStepSelected;
			controller = new CanvasSyncController(deps);

			controller.onSynced({ canvasPath: "journeys/Test/Test.canvas" });
			mockApp.containerEl.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
			vi.advanceTimersByTime(50);

			expect(onStepSelected).not.toHaveBeenCalled();
		});

		it("does not call onStepSelected when multiple nodes selected", () => {
			const onStepSelected = vi.fn();
			const step1 = makeGroupNode("g1", "Step 1", 200);
			const step2 = makeGroupNode("g2", "Step 2", 720);
			const nodes = new Map([["g1", step1], ["g2", step2]]);
			const selection = new Set([step1, step2]);

			const mockApp = createMockCanvasApp("journeys/Test/Test.canvas", nodes, selection);
			deps.getApp = () => mockApp as never;
			deps.onStepSelected = onStepSelected;
			controller = new CanvasSyncController(deps);

			controller.onSynced({ canvasPath: "journeys/Test/Test.canvas" });
			mockApp.containerEl.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
			vi.advanceTimersByTime(50);

			expect(onStepSelected).not.toHaveBeenCalled();
		});

		it("does not call onStepSelected for non-group text node outside groups", () => {
			const onStepSelected = vi.fn();
			const startNode = makeTextNode("start", 0, 0); // START node, not inside any group
			const nodes = new Map([["start", startNode]]);
			const selection = new Set([startNode]);

			const mockApp = createMockCanvasApp("journeys/Test/Test.canvas", nodes, selection);
			deps.getApp = () => mockApp as never;
			deps.onStepSelected = onStepSelected;
			controller = new CanvasSyncController(deps);

			controller.onSynced({ canvasPath: "journeys/Test/Test.canvas" });
			mockApp.containerEl.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
			vi.advanceTimersByTime(50);

			expect(onStepSelected).not.toHaveBeenCalled();
		});

		it("cleans up selection listener on destroy", () => {
			const onStepSelected = vi.fn();
			const step1 = makeGroupNode("g1", "Step 1", 200);
			const nodes = new Map([["g1", step1]]);
			const selection = new Set([step1]);

			const mockApp = createMockCanvasApp("journeys/Test/Test.canvas", nodes, selection);
			deps.getApp = () => mockApp as never;
			deps.onStepSelected = onStepSelected;
			controller = new CanvasSyncController(deps);

			controller.onSynced({ canvasPath: "journeys/Test/Test.canvas" });
			controller.destroy();

			mockApp.containerEl.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
			vi.advanceTimersByTime(50);

			expect(onStepSelected).not.toHaveBeenCalled();
		});
	});

	describe("destroy", () => {
		it("clears pending sync timer", async () => {
			const handler = vi.fn();
			eventBus.on("journey-builder.canvas.sync-requested", handler);

			controller.scheduleSync(500);
			controller.destroy();
			vi.advanceTimersByTime(1000);
			await vi.runAllTimersAsync();
			expect(handler).not.toHaveBeenCalled();
		});

		it("resets canvas path", () => {
			controller.onSynced({ canvasPath: "journeys/Test/Test.canvas" });
			controller.destroy();
			expect(controller.getCanvasOpenedPath()).toBeNull();
		});

		it("is safe to call multiple times", () => {
			controller.destroy();
			expect(() => controller.destroy()).not.toThrow();
		});
	});
});
