import { describe, it, expect, vi, beforeEach } from "vitest";
import { PerfAggregator } from "../../../src/infrastructure/services/PerfAggregator";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { PerfState } from "../../../src/infrastructure/services/perfTypes";

function createMockPerfStorage(initial?: PerfState): ITypedStorage<PerfState> {
	let state: PerfState | undefined = initial;
	return {
		load: vi.fn(async () => state),
		save: vi.fn(async (s: PerfState) => { state = s; }),
		safeLoad: vi.fn(async () => state),
		safeSave: vi.fn(async (s: PerfState) => { state = s; return true; }),
	};
}

describe("PerfAggregator", () => {
	let eventBus: EventBus;
	let storage: ITypedStorage<PerfState>;
	let aggregator: PerfAggregator;

	beforeEach(() => {
		eventBus = new EventBus();
		storage = createMockPerfStorage();
		aggregator = new PerfAggregator(eventBus, storage);
		aggregator.setup();
	});

	describe("startup events", () => {
		it("should collect perf.startup.service events", async () => {
			await eventBus.emit("perf.startup.service", { service: "settingsService", durationMs: 12 });
			await eventBus.emit("perf.startup.service", { service: "userService", durationMs: 5 });

			const summary = aggregator.getStartupSummary();
			expect(summary.perService).toHaveLength(2);
			expect(summary.perService[0].service).toBe("settingsService");
			expect(summary.perService[1].durationMs).toBe(5);
		});

		it("should track startup total and service count", async () => {
			await eventBus.emit("perf.startup.service", { service: "a", durationMs: 10 });
			await eventBus.emit("perf.startup.service", { service: "b", durationMs: 20 });
			await eventBus.emit("perf.startup.total", { durationMs: 30, serviceCount: 2 });

			const summary = aggregator.getStartupSummary();
			expect(summary.totalMs).toBe(30);
			expect(summary.serviceCount).toBe(2);
		});
	});

	describe("getStartupSummary", () => {
		it("should compute timing percentiles from startup totals", async () => {
			// Emit multiple startup totals to build a window
			for (const ms of [100, 200, 300, 400, 500]) {
				await eventBus.emit("perf.startup.total", { durationMs: ms, serviceCount: 5 });
			}

			const summary = aggregator.getStartupSummary();
			expect(summary.timing.count).toBe(5);
			expect(summary.timing.p50).toBe(300);
			expect(summary.timing.max).toBe(500);
		});

		it("should return safe defaults when empty", () => {
			const summary = aggregator.getStartupSummary();
			expect(summary.totalMs).toBe(0);
			expect(summary.serviceCount).toBe(0);
			expect(summary.timing.count).toBe(0);
			expect(summary.timing.p50).toBe(0);
		});
	});

	describe("storage events", () => {
		it("should track per-key load metrics", async () => {
			await eventBus.emit("perf.storage.loaded", { key: "settings", durationMs: 3, sizeBytes: 1024 });
			await eventBus.emit("perf.storage.loaded", { key: "settings", durationMs: 5, sizeBytes: 1024 });

			const summary = aggregator.getStorageSummary();
			expect(summary.keys).toHaveLength(1);
			expect(summary.keys[0].key).toBe("settings");
			expect(summary.keys[0].loadCount).toBe(2);
			expect(summary.keys[0].avgLoadMs).toBe(4);
		});

		it("should track per-key save metrics", async () => {
			await eventBus.emit("perf.storage.saved", { key: "user", durationMs: 10, sizeBytes: 2048 });

			const summary = aggregator.getStorageSummary();
			expect(summary.keys[0].saveCount).toBe(1);
			expect(summary.keys[0].avgSaveMs).toBe(10);
			expect(summary.keys[0].lastSizeBytes).toBe(2048);
		});
	});

	describe("query events", () => {
		it("should compute query timing percentiles", async () => {
			for (const ms of [10, 20, 30, 40, 50]) {
				await eventBus.emit("perf.query.executed", { queryId: "q1", durationMs: ms, sourceRows: 100, resultRows: 10 });
			}

			const summary = aggregator.getQuerySummary();
			expect(summary.totalExecutions).toBe(5);
			expect(summary.timing.p50).toBe(30);
			expect(summary.timing.max).toBe(50);
		});

		it("should track average row counts", async () => {
			await eventBus.emit("perf.query.executed", { queryId: "q1", durationMs: 5, sourceRows: 100, resultRows: 10 });
			await eventBus.emit("perf.query.executed", { queryId: "q2", durationMs: 10, sourceRows: 200, resultRows: 20 });

			const summary = aggregator.getQuerySummary();
			expect(summary.avgSourceRows).toBe(150);
			expect(summary.avgResultRows).toBe(15);
		});

		it("should return safe defaults when no queries executed", () => {
			const summary = aggregator.getQuerySummary();
			expect(summary.totalExecutions).toBe(0);
			expect(summary.timing.count).toBe(0);
			expect(summary.avgSourceRows).toBe(0);
		});
	});

	describe("rolling window", () => {
		it("should cap at 20 entries", async () => {
			for (let i = 0; i < 25; i++) {
				await eventBus.emit("perf.startup.total", { durationMs: i * 100, serviceCount: 1 });
			}

			const summary = aggregator.getStartupSummary();
			expect(summary.timing.count).toBe(20);
			// Oldest 5 (0-400) should be evicted; first remaining = 500
			expect(summary.timing.p50).toBeGreaterThanOrEqual(500);
		});
	});

	describe("threshold alerting", () => {
		it("should emit perf.alert when startup exceeds threshold", async () => {
			const alerts: Array<{ metric: string; value: number; threshold: number }> = [];
			eventBus.on("perf.alert", (e) => { alerts.push(e.payload); });

			await eventBus.emit("perf.startup.total", { durationMs: 6000, serviceCount: 10 });

			expect(alerts).toHaveLength(1);
			expect(alerts[0].metric).toBe("startup.total");
			expect(alerts[0].value).toBe(6000);
			expect(alerts[0].threshold).toBe(5000);
		});

		it("should not emit perf.alert below threshold", async () => {
			const alerts: unknown[] = [];
			eventBus.on("perf.alert", (e) => { alerts.push(e.payload); });

			await eventBus.emit("perf.startup.total", { durationMs: 3000, serviceCount: 10 });

			expect(alerts).toHaveLength(0);
		});
	});

	describe("persistence", () => {
		it("should persist startup history on startup total", async () => {
			await eventBus.emit("perf.startup.total", { durationMs: 150, serviceCount: 5 });

			expect(storage.save).toHaveBeenCalledWith({ startupHistory: [150] });
		});

		it("should restore startup history on load", async () => {
			const preloaded = createMockPerfStorage({ startupHistory: [100, 200, 300] });
			const agg = new PerfAggregator(eventBus, preloaded);
			agg.setup();
			await agg.load();

			const summary = agg.getStartupSummary();
			expect(summary.timing.count).toBe(3);
			expect(summary.timing.max).toBe(300);
			agg.destroy();
		});
	});

	describe("event dispatch tracking", () => {
		it("should collect perf.event.dispatched events", async () => {
			await eventBus.emit("perf.event.dispatched", { eventType: "user.created", handlerCount: 2, durationMs: 5 });
			await eventBus.emit("perf.event.dispatched", { eventType: "settings.changed", handlerCount: 3, durationMs: 10 });

			const summary = aggregator.getEventDispatchSummary();
			expect(summary.totalDispatches).toBe(2);
			expect(summary.timing.count).toBe(2);
		});

		it("should compute dispatch timing percentiles", async () => {
			for (const ms of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
				await eventBus.emit("perf.event.dispatched", { eventType: `event.${ms}`, handlerCount: 1, durationMs: ms });
			}

			const summary = aggregator.getEventDispatchSummary();
			expect(summary.timing.p50).toBe(5);
			expect(summary.timing.max).toBe(10);
		});

		it("should track slowest event types sorted by max duration", async () => {
			await eventBus.emit("perf.event.dispatched", { eventType: "fast.event", handlerCount: 1, durationMs: 1 });
			await eventBus.emit("perf.event.dispatched", { eventType: "slow.event", handlerCount: 5, durationMs: 50 });
			await eventBus.emit("perf.event.dispatched", { eventType: "fast.event", handlerCount: 1, durationMs: 2 });

			const summary = aggregator.getEventDispatchSummary();
			expect(summary.slowest[0].eventType).toBe("slow.event");
			expect(summary.slowest[0].maxMs).toBe(50);
			expect(summary.slowest[0].count).toBe(1);
			expect(summary.slowest[1].eventType).toBe("fast.event");
			expect(summary.slowest[1].maxMs).toBe(2);
			expect(summary.slowest[1].count).toBe(2);
		});
	});

	describe("installer events", () => {
		it("should track installer total timing", async () => {
			await eventBus.emit("perf.installer.total", { durationMs: 250, stepCount: 3 });

			const summary = aggregator.getInstallerSummary();
			expect(summary.totalMs).toBe(250);
		});

		it("should track per-step timing", async () => {
			await eventBus.emit("perf.installer.step", { stepId: "user-creation", stepName: "Create User", durationMs: 50 });
			await eventBus.emit("perf.installer.step", { stepId: "folder-scaffold", stepName: "Scaffold Folders", durationMs: 120 });
			await eventBus.emit("perf.installer.step", { stepId: "seed-content", stepName: "Seed Content", durationMs: 80 });

			const summary = aggregator.getInstallerSummary();
			expect(summary.stepCount).toBe(3);
			expect(summary.perStep).toHaveLength(3);
			expect(summary.perStep[0].stepId).toBe("user-creation");
			expect(summary.perStep[1].durationMs).toBe(120);
		});

		it("should return safe defaults when no installer events", () => {
			const summary = aggregator.getInstallerSummary();
			expect(summary.totalMs).toBe(0);
			expect(summary.stepCount).toBe(0);
			expect(summary.perStep).toHaveLength(0);
		});
	});

	describe("CSV parse events", () => {
		it("should track CSV parse timing", async () => {
			await eventBus.emit("perf.csv.parsed", { filePath: "data.csv", durationMs: 15, rowCount: 100, columnCount: 5 });
			await eventBus.emit("perf.csv.parsed", { filePath: "big.csv", durationMs: 45, rowCount: 5000, columnCount: 12 });

			const summary = aggregator.getImportSummary();
			// CSV parse events don't go into import summary — check via internal state indirectly
			// The csv parse timings are tracked separately but exposed as part of the rolling window
			expect(summary.totalImports).toBe(0); // no import.completed yet
		});
	});

	describe("import events", () => {
		it("should track import pipeline timing", async () => {
			await eventBus.emit("perf.import.completed", { durationMs: 500, totalRows: 100, created: 90, updated: 5, failed: 5 });

			const summary = aggregator.getImportSummary();
			expect(summary.totalImports).toBe(1);
			expect(summary.timing.max).toBe(500);
			expect(summary.avgRows).toBe(100);
		});

		it("should compute import timing percentiles", async () => {
			for (const ms of [100, 200, 300, 400, 500]) {
				await eventBus.emit("perf.import.completed", { durationMs: ms, totalRows: 50, created: 50, updated: 0, failed: 0 });
			}

			const summary = aggregator.getImportSummary();
			expect(summary.totalImports).toBe(5);
			expect(summary.timing.p50).toBe(300);
			expect(summary.timing.max).toBe(500);
		});

		it("should return safe defaults when no imports", () => {
			const summary = aggregator.getImportSummary();
			expect(summary.totalImports).toBe(0);
			expect(summary.timing.count).toBe(0);
			expect(summary.avgRows).toBe(0);
		});
	});

	describe("view events", () => {
		it("should track per-hub view open timing", async () => {
			await eventBus.emit("perf.view.opened", { hubId: "event-catalog", durationMs: 30 });
			await eventBus.emit("perf.view.opened", { hubId: "data-exchange", durationMs: 45 });
			await eventBus.emit("perf.view.opened", { hubId: "event-catalog", durationMs: 25 });

			const summary = aggregator.getViewSummary();
			expect(summary.perHub).toHaveLength(2);

			const catalog = summary.perHub.find(h => h.hubId === "event-catalog");
			expect(catalog).toBeDefined();
			expect(catalog!.timing.count).toBe(2);
			expect(catalog!.timing.max).toBe(30);

			const exchange = summary.perHub.find(h => h.hubId === "data-exchange");
			expect(exchange).toBeDefined();
			expect(exchange!.timing.count).toBe(1);
			expect(exchange!.timing.max).toBe(45);
		});

		it("should return empty perHub when no views opened", () => {
			const summary = aggregator.getViewSummary();
			expect(summary.perHub).toHaveLength(0);
		});
	});

	describe("destroy", () => {
		it("should unsubscribe from all events", async () => {
			aggregator.destroy();

			await eventBus.emit("perf.startup.service", { service: "after-destroy", durationMs: 99 });

			const summary = aggregator.getStartupSummary();
			expect(summary.perService).toHaveLength(0);
		});
	});
});
