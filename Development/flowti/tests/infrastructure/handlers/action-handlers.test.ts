import { describe, it, expect, beforeEach, vi } from "vitest";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import { registerActionHandlers, type ActionHandlerDeps } from "../../../src/infrastructure/handlers/action-handlers";

describe("registerActionHandlers", () => {
	let registry: PluginHandlerRegistry;
	let mockEventBus: { emit: ReturnType<typeof vi.fn> };
	let mockApp: Record<string, unknown>;
	let mockLogger: { debug: ReturnType<typeof vi.fn> };
	let deps: ActionHandlerDeps;

	beforeEach(() => {
		registry = new PluginHandlerRegistry();
		mockEventBus = { emit: vi.fn().mockResolvedValue(undefined) };
		mockApp = { workspace: { getLeaf: vi.fn() } };
		mockLogger = { debug: vi.fn() };
		deps = {
			trainService: { getActiveTrain: () => null },
		};
		registerActionHandlers(registry, deps);
	});

	it("registers all expected action handlers", () => {
		const expectedActions = [
			"view:open-event-catalog",
			"hub:open-user", "view:open-subscription-manager",
			"capture:open", "capture:idea", "capture:feedback", "capture:note",
			"capture:task", "capture:question", "capture:bug", "capture:risk",
			"capture:assumption", "capture:issue", "capture:decision", "capture:learning",
			"hub:open-train", "hub:open-analytics", "hub:open-test-management",
			"hub:open-data-exchange",
			"journey:run", "train:start", "train:resume", "train:complete",
			"train:open-canvas", "train:open-timeline", "train:open-view",
			"train:toggle-or-start",
			"canvas:start-session", "view:open-journey-builder",
			"installer:open",
			"data-exchange:import-csv", "data-exchange:export-csv",
			"data-exchange:export-tab", "data-exchange:signal-sync",
			"data-exchange:import-canvas",
			"session:open-workspace", "session:open-workspace-sidebar",
			"session:create", "session:resume",
		];
		for (const id of expectedActions) {
			expect(registry.getAction(id), `Missing action handler: ${id}`).toBeDefined();
		}
	});

	it("hub:open-user emits ui.openUserHub event", async () => {
		const handler = registry.getAction("hub:open-user")!;
		await handler({ eventBus: mockEventBus as never, app: mockApp, logger: mockLogger as never });
		expect(mockEventBus.emit).toHaveBeenCalledWith("ui.openUserHub", {});
	});

	it("capture:idea emits ui.openQuickCapture with type 'idea'", async () => {
		const handler = registry.getAction("capture:idea")!;
		await handler({ eventBus: mockEventBus as never, app: mockApp, logger: mockLogger as never });
		expect(mockEventBus.emit).toHaveBeenCalledWith("ui.openQuickCapture", { type: "idea" });
	});

	it("train:start emits ui.startTrain event", async () => {
		const handler = registry.getAction("train:start")!;
		await handler({ eventBus: mockEventBus as never, app: mockApp, logger: mockLogger as never });
		expect(mockEventBus.emit).toHaveBeenCalledWith("ui.startTrain", {});
	});

	describe("train:toggle-or-start", () => {
		it("emits ui.startTrain when no active train", async () => {
			const handler = registry.getAction("train:toggle-or-start")!;
			await handler({ eventBus: mockEventBus as never, app: mockApp, logger: mockLogger as never });
			expect(mockEventBus.emit).toHaveBeenCalledWith("ui.startTrain", {});
		});

		it("emits ui.openTrainView when active train exists", async () => {
			deps.trainService.getActiveTrain = () => ({ id: "t1", status: "running" });
			registry = new PluginHandlerRegistry();
			registerActionHandlers(registry, deps);
			const handler = registry.getAction("train:toggle-or-start")!;
			await handler({ eventBus: mockEventBus as never, app: mockApp, logger: mockLogger as never });
			expect(mockEventBus.emit).toHaveBeenCalledWith("ui.openTrainView", { trainId: "t1" });
		});
	});
});
