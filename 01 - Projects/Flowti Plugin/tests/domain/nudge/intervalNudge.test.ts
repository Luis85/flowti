import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import { NudgeService } from "../../../src/domain/nudge/NudgeService";
import { createMockStorage } from "../../mocks/storage";
import type { NudgeConfig, NudgeState } from "../../../src/domain/nudge/types";

function makeConfig(overrides: Partial<NudgeConfig> = {}): NudgeConfig {
	return {
		id: "interval-nudge",
		time: "10:00",
		sessionType: "backlog-structuring",
		title: "Backlog Refinement",
		durationMinutes: 0,
		enabled: true,
		intervalDays: 7,
		navigateTo: "inbox",
		...overrides,
	};
}

describe("NudgeService — interval-based nudges", () => {
	let eventBus: EventBus;
	let storage: ReturnType<typeof createMockStorage<NudgeState>>;
	let service: NudgeService;
	let currentDate: string;

	beforeEach(async () => {
		eventBus = new EventBus();
		storage = createMockStorage<NudgeState>();
		currentDate = "2026-02-27";
		service = new NudgeService({
			storage: storage.storage,
			eventBus,
			getNow: () => [10, 0],
			getToday: () => currentDate,
			getInboxCount: () => 42,
		});
		await service.load();
	});

	it("triggers interval nudge when no lastTriggeredDate exists", async () => {
		const config = makeConfig({ lastTriggeredDate: undefined });
		await eventBus.emit("nudge.configure", { config });

		const handler = vi.fn();
		eventBus.on("nudge.triggered", handler);

		await service.evaluate();

		expect(handler).toHaveBeenCalledOnce();
		expect(handler.mock.calls[0][0].payload.config.id).toBe("interval-nudge");
	});

	it("triggers interval nudge when intervalDays has elapsed", async () => {
		const config = makeConfig({ lastTriggeredDate: "2026-02-20" }); // 7 days ago
		await eventBus.emit("nudge.configure", { config });

		const handler = vi.fn();
		eventBus.on("nudge.triggered", handler);

		await service.evaluate();

		expect(handler).toHaveBeenCalledOnce();
	});

	it("skips interval nudge when intervalDays has NOT elapsed", async () => {
		const config = makeConfig({ lastTriggeredDate: "2026-02-25" }); // 2 days ago, need 7
		await eventBus.emit("nudge.configure", { config });

		const handler = vi.fn();
		eventBus.on("nudge.triggered", handler);

		await service.evaluate();

		expect(handler).not.toHaveBeenCalled();
	});

	it("sets lastTriggeredDate on trigger", async () => {
		const config = makeConfig({ lastTriggeredDate: "2026-02-19" });
		await eventBus.emit("nudge.configure", { config });

		await service.evaluate();

		const updated = service.getConfigById("interval-nudge");
		expect(updated?.lastTriggeredDate).toBe("2026-02-27");
	});

	it("sets lastTriggeredDate on dismiss", async () => {
		const config = makeConfig({ lastTriggeredDate: "2026-02-10" });
		await eventBus.emit("nudge.configure", { config });

		await eventBus.emit("nudge.dismiss", { id: "interval-nudge" });

		const updated = service.getConfigById("interval-nudge");
		expect(updated?.lastTriggeredDate).toBe("2026-02-27");
	});

	it("includes inboxItemCount in triggered payload for navigateTo=inbox nudges", async () => {
		const config = makeConfig();
		await eventBus.emit("nudge.configure", { config });

		const handler = vi.fn();
		eventBus.on("nudge.triggered", handler);

		await service.evaluate();

		expect(handler.mock.calls[0][0].payload.inboxItemCount).toBe(42);
	});

	it("does NOT include inboxItemCount for non-navigation nudges", async () => {
		const config = makeConfig({ navigateTo: undefined, intervalDays: undefined });
		await eventBus.emit("nudge.configure", { config });

		const handler = vi.fn();
		eventBus.on("nudge.triggered", handler);

		await service.evaluate();

		expect(handler.mock.calls[0][0].payload.inboxItemCount).toBeUndefined();
	});

	it("existing time-based nudges still work without intervalDays", async () => {
		const config: NudgeConfig = {
			id: "daily-nudge",
			time: "10:00",
			sessionType: "documentation",
			title: "Daily Check",
			durationMinutes: 25,
			enabled: true,
		};
		await eventBus.emit("nudge.configure", { config });

		const handler = vi.fn();
		eventBus.on("nudge.triggered", handler);

		await service.evaluate();

		expect(handler).toHaveBeenCalledOnce();
		expect(handler.mock.calls[0][0].payload.config.id).toBe("daily-nudge");
	});
});
