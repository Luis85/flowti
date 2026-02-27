import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { NudgeService } from "../../../src/domain/nudge/NudgeService";
import type { NudgeConfig, NudgeState } from "../../../src/domain/nudge/types";
import { DEFAULT_NUDGE_CONFIGS } from "../../../src/domain/nudge/types";
import { createMockStorage } from "../../mocks/storage";

// ── Helpers ──────────────────────────────────────────────────

function makeConfig(overrides?: Partial<NudgeConfig>): NudgeConfig {
	return {
		id: "test-nudge",
		time: "09:00",
		sessionType: "documentation",
		title: "Test Nudge",
		durationMinutes: 25,
		enabled: true,
		...overrides,
	};
}

describe("NudgeService", () => {
	let eventBus: IEventBus;
	let storage: ReturnType<typeof createMockStorage<NudgeState>>;
	let service: NudgeService;
	let currentTime: [number, number];
	let currentDate: string;

	beforeEach(() => {
		eventBus = new EventBus();
		storage = createMockStorage<NudgeState>();
		currentTime = [9, 0];
		currentDate = "2026-02-18";
		service = new NudgeService({
			storage: storage.storage,
			eventBus,
			getNow: () => currentTime,
			getToday: () => currentDate,
		});
	});

	afterEach(() => {
		service.dispose();
	});

	// ── Load ──────────────────────────────────────────────────

	describe("load", () => {
		it("creates default state with 3 configs on first load", async () => {
			await service.load();
			const configs = service.getConfigs();
			expect(configs).toHaveLength(3);
			expect(configs[0].id).toBe("default-morning-review");
			expect(configs[1].id).toBe("default-afternoon-focus");
			expect(configs[2].id).toBe("default-backlog-refinement");
			expect(configs.every((c) => !c.enabled)).toBe(true);
		});

		it("restores persisted state on subsequent loads", async () => {
			const custom = makeConfig({ id: "custom-1", title: "Custom" });
			await storage.storage.save({
				configs: [custom],
				dismissedToday: ["custom-1"],
				lastRolloverDate: "2026-02-18",
			});

			await service.load();
			expect(service.getConfigs()).toHaveLength(1);
			expect(service.getConfigs()[0].title).toBe("Custom");
			expect(service.isDismissedToday("custom-1")).toBe(true);
		});

		it("emits nudge.loaded after loading", async () => {
			const loaded = vi.fn();
			eventBus.on("nudge.loaded", loaded);

			await service.load();
			expect(loaded).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						configs: expect.any(Array),
					}),
				}),
			);
		});
	});

	// ── Evaluate ──────────────────────────────────────────────

	describe("evaluate", () => {
		it("triggers nudge when time matches an enabled config", async () => {
			const triggered = vi.fn();
			eventBus.on("nudge.triggered", triggered);

			await service.load();
			// Enable the morning review nudge (09:00)
			await eventBus.emit("nudge.configure", {
				config: { ...DEFAULT_NUDGE_CONFIGS[0], enabled: true },
			});

			currentTime = [9, 0];
			await service.evaluate();

			expect(triggered).toHaveBeenCalledTimes(1);
			expect(triggered).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						config: expect.objectContaining({
							id: "default-morning-review",
							time: "09:00",
						}),
					}),
				}),
			);
		});

		it("does not trigger disabled nudge", async () => {
			const triggered = vi.fn();
			eventBus.on("nudge.triggered", triggered);

			await service.load();
			// Default configs are disabled
			currentTime = [9, 0];
			await service.evaluate();

			expect(triggered).not.toHaveBeenCalled();
		});

		it("does not trigger when time doesn't match", async () => {
			const triggered = vi.fn();
			eventBus.on("nudge.triggered", triggered);

			await service.load();
			await eventBus.emit("nudge.configure", {
				config: { ...DEFAULT_NUDGE_CONFIGS[0], enabled: true },
			});

			currentTime = [10, 30]; // Not 09:00
			await service.evaluate();

			expect(triggered).not.toHaveBeenCalled();
		});

		it("skips dismissed nudge", async () => {
			const triggered = vi.fn();
			eventBus.on("nudge.triggered", triggered);

			await service.load();
			await eventBus.emit("nudge.configure", {
				config: { ...DEFAULT_NUDGE_CONFIGS[0], enabled: true },
			});

			// Dismiss the nudge
			await eventBus.emit("nudge.dismiss", { id: "default-morning-review" });

			currentTime = [9, 0];
			await service.evaluate();

			expect(triggered).not.toHaveBeenCalled();
		});

		it("emits nudge.triggered before persisting dismiss state", async () => {
			const callOrder: string[] = [];

			// Track emit order
			eventBus.on("nudge.triggered", () => {
				callOrder.push("emitted");
			});

			// Track save order via storage mock
			const originalSave = storage.storage.save;
			storage.storage.save = async (state) => {
				callOrder.push("saved");
				return originalSave(state);
			};

			await service.load();
			await eventBus.emit("nudge.configure", {
				config: { ...DEFAULT_NUDGE_CONFIGS[0], enabled: true },
			});
			callOrder.length = 0; // Reset after configure save

			currentTime = [9, 0];
			await service.evaluate();

			expect(callOrder[0]).toBe("emitted");
			expect(callOrder[1]).toBe("saved");
		});

		it("auto-dismisses after triggering (prevents duplicate trigger same minute)", async () => {
			const triggered = vi.fn();
			eventBus.on("nudge.triggered", triggered);

			await service.load();
			await eventBus.emit("nudge.configure", {
				config: { ...DEFAULT_NUDGE_CONFIGS[0], enabled: true },
			});

			currentTime = [9, 0];
			await service.evaluate();
			expect(triggered).toHaveBeenCalledTimes(1);

			// Second evaluation same minute
			await service.evaluate();
			expect(triggered).toHaveBeenCalledTimes(1);
		});

		it("skips nudge when same-type session is already active", async () => {
			const triggered = vi.fn();
			eventBus.on("nudge.triggered", triggered);

			// Create service with isSessionTypeActive returning true for "documentation"
			service.dispose();
			service = new NudgeService({
				storage: storage.storage,
				eventBus,
				getNow: () => currentTime,
				getToday: () => currentDate,
				isSessionTypeActive: (type) => type === "documentation",
			});
			await service.load();
			await eventBus.emit("nudge.configure", {
				config: makeConfig({ id: "doc-nudge", sessionType: "documentation", time: "09:00", enabled: true }),
			});

			currentTime = [9, 0];
			await service.evaluate();

			expect(triggered).not.toHaveBeenCalled();
		});

		it("does not skip nudge when different-type session is active", async () => {
			const triggered = vi.fn();
			eventBus.on("nudge.triggered", triggered);

			service.dispose();
			service = new NudgeService({
				storage: storage.storage,
				eventBus,
				getNow: () => currentTime,
				getToday: () => currentDate,
				isSessionTypeActive: (type) => type === "review", // different type active
			});
			await service.load();
			await eventBus.emit("nudge.configure", {
				config: makeConfig({ id: "doc-nudge", sessionType: "documentation", time: "09:00", enabled: true }),
			});

			currentTime = [9, 0];
			await service.evaluate();

			expect(triggered).toHaveBeenCalledTimes(1);
		});

		it("triggers multiple nudges at same time", async () => {
			const triggered = vi.fn();
			eventBus.on("nudge.triggered", triggered);

			await service.load();
			// Add two nudges at 09:00
			await eventBus.emit("nudge.configure", {
				config: makeConfig({ id: "nudge-a", time: "09:00", enabled: true }),
			});
			await eventBus.emit("nudge.configure", {
				config: makeConfig({ id: "nudge-b", time: "09:00", enabled: true }),
			});

			currentTime = [9, 0];
			await service.evaluate();

			expect(triggered).toHaveBeenCalledTimes(2);
		});
	});

	// ── Midnight rollover ─────────────────────────────────────

	describe("midnight rollover", () => {
		it("clears dismissed set when date changes", async () => {
			await service.load();
			await eventBus.emit("nudge.configure", {
				config: { ...DEFAULT_NUDGE_CONFIGS[0], enabled: true },
			});

			// Dismiss at 09:00 today
			currentTime = [9, 0];
			await service.evaluate();
			expect(service.isDismissedToday("default-morning-review")).toBe(true);

			// Next day
			currentDate = "2026-02-19";
			currentTime = [9, 0];

			const triggered = vi.fn();
			eventBus.on("nudge.triggered", triggered);

			await service.evaluate();
			expect(triggered).toHaveBeenCalledTimes(1);
			expect(service.isDismissedToday("default-morning-review")).toBe(true); // Re-dismissed after trigger
		});
	});

	// ── Configure ─────────────────────────────────────────────

	describe("configure", () => {
		it("adds a new nudge config", async () => {
			await service.load();

			const custom = makeConfig({ id: "custom-1", title: "Custom Nudge" });
			await eventBus.emit("nudge.configure", { config: custom });

			const configs = service.getConfigs();
			const added = configs.find((c) => c.id === "custom-1");
			expect(added).toBeTruthy();
			expect(added!.title).toBe("Custom Nudge");
		});

		it("updates an existing nudge config", async () => {
			await service.load();

			await eventBus.emit("nudge.configure", {
				config: { ...DEFAULT_NUDGE_CONFIGS[0], title: "Updated Title", enabled: true },
			});

			const config = service.getConfigById("default-morning-review");
			expect(config!.title).toBe("Updated Title");
			expect(config!.enabled).toBe(true);
		});

		it("emits nudge.configured", async () => {
			const configured = vi.fn();
			eventBus.on("nudge.configured", configured);

			await service.load();
			await eventBus.emit("nudge.configure", { config: makeConfig() });

			expect(configured).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						config: expect.objectContaining({ id: "test-nudge" }),
					}),
				}),
			);
		});
	});

	// ── Remove ────────────────────────────────────────────────

	describe("remove", () => {
		it("removes a nudge config", async () => {
			await service.load();
			expect(service.getConfigs()).toHaveLength(3);

			await eventBus.emit("nudge.remove", { id: "default-morning-review" });

			expect(service.getConfigs()).toHaveLength(2);
			expect(service.getConfigById("default-morning-review")).toBeUndefined();
		});

		it("also removes from dismissed list", async () => {
			await service.load();
			await eventBus.emit("nudge.configure", {
				config: { ...DEFAULT_NUDGE_CONFIGS[0], enabled: true },
			});
			await eventBus.emit("nudge.dismiss", { id: "default-morning-review" });
			expect(service.isDismissedToday("default-morning-review")).toBe(true);

			await eventBus.emit("nudge.remove", { id: "default-morning-review" });
			expect(service.isDismissedToday("default-morning-review")).toBe(false);
		});

		it("emits nudge.removed", async () => {
			const removed = vi.fn();
			eventBus.on("nudge.removed", removed);

			await service.load();
			await eventBus.emit("nudge.remove", { id: "default-morning-review" });

			expect(removed).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ id: "default-morning-review" }),
				}),
			);
		});
	});

	// ── Dismiss ───────────────────────────────────────────────

	describe("dismiss", () => {
		it("marks nudge as dismissed for today", async () => {
			await service.load();
			expect(service.isDismissedToday("default-morning-review")).toBe(false);

			await eventBus.emit("nudge.dismiss", { id: "default-morning-review" });
			expect(service.isDismissedToday("default-morning-review")).toBe(true);
		});

		it("emits nudge.dismissed", async () => {
			const dismissed = vi.fn();
			eventBus.on("nudge.dismissed", dismissed);

			await service.load();
			await eventBus.emit("nudge.dismiss", { id: "default-morning-review" });

			expect(dismissed).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ id: "default-morning-review" }),
				}),
			);
		});

		it("is idempotent (does not duplicate)", async () => {
			await service.load();
			await eventBus.emit("nudge.dismiss", { id: "test-id" });
			await eventBus.emit("nudge.dismiss", { id: "test-id" });

			// Check state persisted correctly (no duplicate entries)
			const stored = await storage.storage.load();
			const dismissed = stored!.dismissedToday.filter((d) => d === "test-id");
			expect(dismissed).toHaveLength(1);
		});
	});

	// ── Start / Stop ──────────────────────────────────────────

	describe("start and stop", () => {
		it("start creates interval, stop clears it", async () => {
			vi.useFakeTimers();
			try {
				await service.load();
				await eventBus.emit("nudge.configure", {
					config: { ...DEFAULT_NUDGE_CONFIGS[0], enabled: true },
				});

				const triggered = vi.fn();
				eventBus.on("nudge.triggered", triggered);

				currentTime = [9, 0];
				service.start();

				// Advance to first tick
				await vi.advanceTimersByTimeAsync(60_000);
				expect(triggered).toHaveBeenCalledTimes(1);

				service.stop();

				// Advance more — should not trigger again (stopped + auto-dismissed)
				currentTime = [14, 0];
				await vi.advanceTimersByTimeAsync(60_000);
				expect(triggered).toHaveBeenCalledTimes(1);
			} finally {
				vi.useRealTimers();
			}
		});

		it("start is idempotent", () => {
			service.start();
			service.start(); // Should not create a second interval
			service.stop();
		});
	});

	// ── Queries ───────────────────────────────────────────────

	describe("queries", () => {
		it("getConfigs returns a copy", async () => {
			await service.load();
			const configs = service.getConfigs();
			configs.push(makeConfig());
			expect(service.getConfigs()).toHaveLength(3); // Original unchanged
		});

		it("getConfigById returns config or undefined", async () => {
			await service.load();
			expect(service.getConfigById("default-morning-review")).toBeTruthy();
			expect(service.getConfigById("nonexistent")).toBeUndefined();
		});
	});

	// ── Persistence ───────────────────────────────────────────

	describe("persistence", () => {
		it("persists state on configure", async () => {
			await service.load();
			await eventBus.emit("nudge.configure", { config: makeConfig() });

			const stored = await storage.storage.load();
			expect(stored!.configs.find((c) => c.id === "test-nudge")).toBeTruthy();
		});

		it("persists state on dismiss", async () => {
			await service.load();
			await eventBus.emit("nudge.dismiss", { id: "test-id" });

			const stored = await storage.storage.load();
			expect(stored!.dismissedToday).toContain("test-id");
		});

		it("persists state on remove", async () => {
			await service.load();
			await eventBus.emit("nudge.remove", { id: "default-morning-review" });

			const stored = await storage.storage.load();
			expect(stored!.configs.find((c) => c.id === "default-morning-review")).toBeUndefined();
		});
	});
});
