import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { IngestionService } from "../../../src/domain/ingestion/IngestionService";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { IngestionPersistentState } from "../../../src/domain/ingestion/types";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/settings";
import { createMockStorage } from "../../mocks/storage";

describe("IngestionService", () => {
	let service: IngestionService;
	let storage: ITypedStorage<IngestionPersistentState>;
	let eventBus: IEventBus;

	beforeEach(() => {
		vi.useFakeTimers();
		const mock = createMockStorage<IngestionPersistentState>();
		storage = mock.storage;
		eventBus = new EventBus();
		service = new IngestionService({
			storage,
			eventBus,
			config: {
				concurrency: 2,
				batchWindowMs: 100,
				maxRetries: 2,
				baseRetryDelayMs: 10,
				watchEventTypes: ["file.created", "file.modified"],
			},
		});
	});

	afterEach(() => {
		service.dispose();
		vi.useRealTimers();
	});

	describe("load", () => {
		it("should complete without error", async () => {
			await expect(service.load()).resolves.toBeUndefined();
		});
	});

	describe("event routing", () => {
		it("should queue jobs for watched event types", async () => {
			const handler = vi.fn();
			eventBus.on("ingestion.job.queued", handler);

			await eventBus.emit("file.created", { path: "test.md", source: "user" });

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						eventType: "file.created",
					}),
				})
			);
		});

		it("should ignore non-watched event types", async () => {
			const handler = vi.fn();
			eventBus.on("ingestion.job.queued", handler);

			await eventBus.emit("file.deleted", { path: "test.md", source: "user" });

			expect(handler).not.toHaveBeenCalled();
		});

		it("should skip ingestion.* events to avoid loops", async () => {
			// Override with a service that watches ingestion events (edge case)
			service.dispose();
			const mock = createMockStorage<IngestionPersistentState>();
			service = new IngestionService({
				storage: mock.storage,
				eventBus,
				config: {
					concurrency: 1,
					batchWindowMs: 100,
					maxRetries: 0,
					baseRetryDelayMs: 10,
					watchEventTypes: ["ingestion.job.queued"],
				},
			});

			const handler = vi.fn();
			eventBus.on("ingestion.job.queued", handler);

			await eventBus.emit("ingestion.job.queued", {
				jobId: "test",
				eventType: "file.created",
			});

			// Should not re-queue the ingestion event
			expect(handler).toHaveBeenCalledTimes(1); // only the emit above, not a re-queue
		});
	});

	describe("batching", () => {
		it("should batch events within the window", async () => {
			const batchHandler = vi.fn();
			eventBus.on("ingestion.batch.started", batchHandler);

			await eventBus.emit("file.created", { path: "a.md", source: "user" });
			await eventBus.emit("file.created", { path: "b.md", source: "user" });
			await eventBus.emit("file.created", { path: "c.md", source: "user" });

			// Batch hasn't fired yet
			expect(batchHandler).not.toHaveBeenCalled();

			// Advance past the batch window
			await vi.advanceTimersByTimeAsync(150);

			expect(batchHandler).toHaveBeenCalledTimes(1);
			expect(batchHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { jobCount: 3 },
				})
			);
		});

		it("should emit batch.completed after processing", async () => {
			const completedHandler = vi.fn();
			eventBus.on("ingestion.batch.completed", completedHandler);

			await eventBus.emit("file.created", { path: "a.md", source: "user" });

			// Advance past batch window + processing
			await vi.advanceTimersByTimeAsync(200);

			expect(completedHandler).toHaveBeenCalledTimes(1);
		});
	});

	describe("stats", () => {
		it("should return initial stats", () => {
			const stats = service.getStats();
			expect(stats.processedCount).toBe(0);
			expect(stats.failedCount).toBe(0);
			expect(stats.queuedCount).toBe(0);
			expect(stats.activeCount).toBe(0);
		});

		it("should emit stats after batch completion", async () => {
			const statsHandler = vi.fn();
			eventBus.on("ingestion.stats", statsHandler);

			await eventBus.emit("file.created", { path: "a.md", source: "user" });

			await vi.advanceTimersByTimeAsync(200);

			expect(statsHandler).toHaveBeenCalled();
			const stats = statsHandler.mock.calls[0][0].payload.stats;
			expect(stats.processedCount).toBe(1);
		});
	});

	describe("idempotency", () => {
		it("should generate deterministic event keys", () => {
			const key1 = service.generateEventKey("file.created", "Reports/jan.csv");
			const key2 = service.generateEventKey("file.created", "Reports/jan.csv");
			expect(key1).toBe(key2);
			expect(key1).toBe("file.created::Reports/jan.csv");
		});

		it("should generate different keys for different paths", () => {
			const key1 = service.generateEventKey("file.created", "a.md");
			const key2 = service.generateEventKey("file.created", "b.md");
			expect(key1).not.toBe(key2);
		});

		it("should skip duplicate events", async () => {
			const handler = vi.fn();
			eventBus.on("ingestion.job.queued", handler);

			// First event gets queued
			await eventBus.emit("file.created", { path: "test.md", source: "user" });
			expect(handler).toHaveBeenCalledTimes(1);

			// Process the batch so it goes into the ledger
			await vi.advanceTimersByTimeAsync(200);

			// Same event again should be skipped
			handler.mockClear();
			await eventBus.emit("file.created", { path: "test.md", source: "user" });
			expect(handler).not.toHaveBeenCalled();
		});

		it("should persist ledger to storage after processing", async () => {
			const mock = createMockStorage<IngestionPersistentState>();
			service.dispose();
			service = new IngestionService({
				storage: mock.storage,
				eventBus,
				config: {
					concurrency: 1,
					batchWindowMs: 50,
					maxRetries: 0,
					baseRetryDelayMs: 10,
					watchEventTypes: ["file.created"],
				},
			});

			await eventBus.emit("file.created", { path: "test.md", source: "user" });
			await vi.advanceTimersByTimeAsync(100);

			const state = mock.getData();
			expect(state?.processedKeys).toContain("file.created::test.md");
		});

		it("should load persisted ledger from storage", async () => {
			const mock = createMockStorage({
				processedKeys: ["file.created::existing.md"],
			});
			service.dispose();
			service = new IngestionService({
				storage: mock.storage,
				eventBus,
				config: {
					concurrency: 1,
					batchWindowMs: 50,
					maxRetries: 0,
					baseRetryDelayMs: 10,
					watchEventTypes: ["file.created"],
				},
			});

			await service.load();
			expect(service.isProcessed("file.created::existing.md")).toBe(true);

			// This event should be skipped because it's in the ledger
			const handler = vi.fn();
			eventBus.on("ingestion.job.queued", handler);
			await eventBus.emit("file.created", { path: "existing.md", source: "user" });
			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("catch-up", () => {
		it("should scan folders and enqueue new files", async () => {
			const handler = vi.fn();
			eventBus.on("ingestion.job.queued", handler);

			const listFiles = vi.fn(async () => [
				"Reports/a.csv",
				"Reports/b.csv",
			]);

			await service.runCatchUp(["Reports"], listFiles);

			expect(listFiles).toHaveBeenCalledWith("Reports");
			expect(handler).toHaveBeenCalledTimes(2);
		});

		it("should skip files already in the ledger", async () => {
			const mock = createMockStorage({
				processedKeys: ["file.created::Reports/a.csv"],
			});
			service.dispose();
			service = new IngestionService({
				storage: mock.storage,
				eventBus,
				config: {
					concurrency: 1,
					batchWindowMs: 50,
					maxRetries: 0,
					baseRetryDelayMs: 10,
					watchEventTypes: ["file.created"],
				},
			});
			await service.load();

			const handler = vi.fn();
			eventBus.on("ingestion.job.queued", handler);

			await service.runCatchUp(["Reports"], async () => [
				"Reports/a.csv",
				"Reports/b.csv",
				"Reports/c.csv",
			]);

			// a.csv is in ledger, so only b.csv and c.csv should be queued
			expect(handler).toHaveBeenCalledTimes(2);
		});

		it("should emit catch-up lifecycle events", async () => {
			const startedHandler = vi.fn();
			const fileFoundHandler = vi.fn();
			const completedHandler = vi.fn();

			eventBus.on("catchup.started", startedHandler);
			eventBus.on("catchup.file.found", fileFoundHandler);
			eventBus.on("catchup.completed", completedHandler);

			await service.runCatchUp(["Reports", "Data"], async (folder) => {
				return folder === "Reports" ? ["Reports/a.csv"] : ["Data/b.csv"];
			});

			expect(startedHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { folderCount: 2 },
				})
			);
			expect(fileFoundHandler).toHaveBeenCalledTimes(2);
			expect(completedHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { scannedCount: 2, newCount: 2 },
				})
			);
		});
	});

	describe("master toggle", () => {
		it("should not enqueue when disabled via settings.changed", async () => {
			const handler = vi.fn();
			eventBus.on("ingestion.job.queued", handler);

			// Disable the event system
			await eventBus.emit("settings.changed", {
				settings: { ...DEFAULT_SETTINGS, eventSystemEnabled: false },
			});

			await eventBus.emit("file.created", { path: "test.md", source: "user" });

			expect(handler).not.toHaveBeenCalled();
		});

		it("should re-enable when settings.changed sets eventSystemEnabled back to true", async () => {
			const handler = vi.fn();
			eventBus.on("ingestion.job.queued", handler);

			// Disable
			await eventBus.emit("settings.changed", {
				settings: { ...DEFAULT_SETTINGS, eventSystemEnabled: false },
			});
			await eventBus.emit("file.created", { path: "a.md", source: "user" });
			expect(handler).not.toHaveBeenCalled();

			// Re-enable
			await eventBus.emit("settings.changed", {
				settings: { ...DEFAULT_SETTINGS, eventSystemEnabled: true },
			});
			await eventBus.emit("file.created", { path: "b.md", source: "user" });
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("should respect settings.loaded for initial state", async () => {
			const handler = vi.fn();
			eventBus.on("ingestion.job.queued", handler);

			// Simulate settings loaded with disabled
			await eventBus.emit("settings.loaded", {
				settings: { ...DEFAULT_SETTINGS, eventSystemEnabled: false },
			});

			await eventBus.emit("file.created", { path: "test.md", source: "user" });
			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("crash recovery", () => {
		it("should persist pending jobs to storage", async () => {
			const mock = createMockStorage<IngestionPersistentState>();
			service.dispose();
			service = new IngestionService({
				storage: mock.storage,
				eventBus,
				config: {
					concurrency: 1,
					batchWindowMs: 50,
					maxRetries: 0,
					baseRetryDelayMs: 10,
					watchEventTypes: ["file.created"],
				},
			});

			await eventBus.emit("file.created", { path: "pending.md", source: "user" });

			// Advance to trigger flush (which persists state before processing)
			await vi.advanceTimersByTimeAsync(100);

			const state = mock.getData();
			// After processing, pendingJobs should be cleared and processedKeys populated
			expect(state?.processedKeys).toContain("file.created::pending.md");
		});

		it("should recover pending jobs on load", async () => {
			const pendingJob = {
				id: "recovered-1",
				eventType: "file.created",
				payload: { path: "recovered.md", source: "catchup" },
				status: "queued" as const,
				retryCount: 0,
				queuedAt: "2026-02-10T00:00:00Z",
			};
			const mock = createMockStorage({
				processedKeys: [],
				pendingJobs: [pendingJob],
			});
			service.dispose();
			service = new IngestionService({
				storage: mock.storage,
				eventBus,
				config: {
					concurrency: 1,
					batchWindowMs: 50,
					maxRetries: 0,
					baseRetryDelayMs: 10,
					watchEventTypes: ["file.created"],
				},
			});

			const recoveryHandler = vi.fn();
			eventBus.on("ingestion.recovery.completed", recoveryHandler);

			const completedHandler = vi.fn();
			eventBus.on("ingestion.job.completed", completedHandler);

			await service.load();

			expect(recoveryHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { recoveredCount: 1 },
				})
			);

			// Advance past batch window to process recovered job
			await vi.advanceTimersByTimeAsync(100);

			expect(completedHandler).toHaveBeenCalledTimes(1);
		});

		it("should not re-enqueue already-processed jobs on recovery", async () => {
			const pendingJob = {
				id: "already-done",
				eventType: "file.created",
				payload: { path: "done.md", source: "catchup" },
				status: "queued" as const,
				retryCount: 0,
				queuedAt: "2026-02-10T00:00:00Z",
			};
			const mock = createMockStorage({
				processedKeys: ["file.created::done.md"],
				pendingJobs: [pendingJob],
			});
			service.dispose();
			service = new IngestionService({
				storage: mock.storage,
				eventBus,
				config: {
					concurrency: 1,
					batchWindowMs: 50,
					maxRetries: 0,
					baseRetryDelayMs: 10,
					watchEventTypes: ["file.created"],
				},
			});

			const recoveryHandler = vi.fn();
			eventBus.on("ingestion.recovery.completed", recoveryHandler);

			await service.load();

			// No recovery event because all pending jobs were already processed
			expect(recoveryHandler).not.toHaveBeenCalled();
		});

		it("should emit ingestion.recovery.completed with correct count", async () => {
			const pendingJobs = [
				{ id: "r-1", eventType: "file.created", payload: { path: "a.md" }, status: "queued" as const, retryCount: 0, queuedAt: "2026-02-10T00:00:00Z" },
				{ id: "r-2", eventType: "file.created", payload: { path: "b.md" }, status: "queued" as const, retryCount: 0, queuedAt: "2026-02-10T00:00:00Z" },
				{ id: "r-3", eventType: "file.created", payload: { path: "c.md" }, status: "queued" as const, retryCount: 0, queuedAt: "2026-02-10T00:00:00Z" },
			];
			const mock = createMockStorage({
				processedKeys: ["file.created::b.md"], // b.md already done
				pendingJobs,
			});
			service.dispose();
			service = new IngestionService({
				storage: mock.storage,
				eventBus,
				config: {
					concurrency: 2,
					batchWindowMs: 50,
					maxRetries: 0,
					baseRetryDelayMs: 10,
					watchEventTypes: ["file.created"],
				},
			});

			const recoveryHandler = vi.fn();
			eventBus.on("ingestion.recovery.completed", recoveryHandler);

			await service.load();

			// Only a.md and c.md should be recovered (b.md already processed)
			expect(recoveryHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { recoveredCount: 2 },
				})
			);
		});
	});

	describe("dispose", () => {
		it("should stop listening after dispose", async () => {
			service.dispose();

			const handler = vi.fn();
			eventBus.on("ingestion.job.queued", handler);

			await eventBus.emit("file.created", { path: "test.md", source: "user" });

			expect(handler).not.toHaveBeenCalled();
		});
	});
});
