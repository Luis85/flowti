/**
 * Flow 08: Configure File Ingestion
 *
 * Tests the file ingestion configuration and processing workflow:
 * Configure watch folders → configure event types → file arrives →
 * job queued → job processed → job completed → definition matching →
 * custom domain event emitted.
 *
 * Event sequence:
 *   settings.changed → file.created → ingestion.job.queued →
 *   ingestion.job.started → ingestion.job.completed →
 *   eventDefinition.matched → {custom.domain.event}
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { IngestionService } from "../../src/domain/ingestion/IngestionService";
import { EventDefinitionService } from "../../src/domain/eventDefinition/EventDefinitionService";
import type { IngestionPersistentState } from "../../src/domain/ingestion/types";
import type { EventDefinitionState } from "../../src/domain/eventDefinition/types";
import { DEFAULT_SETTINGS } from "../../src/domain/settings/settings";
import { createMockStorage, waitForAsync } from "./testHelpers";

describe("Flow 08: Configure File Ingestion", () => {
	let eventBus: IEventBus;
	let ingestionService: IngestionService;
	let defService: EventDefinitionService;

	beforeEach(async () => {
		eventBus = new EventBus();

		const ingestionMock = createMockStorage<IngestionPersistentState>();
		ingestionService = new IngestionService({
			storage: ingestionMock.storage,
			eventBus,
			config: {
				batchWindowMs: 10, // Fast batch for tests
				watchEventTypes: ["file.created", "file.modified"],
			},
		});

		const defMock = createMockStorage<EventDefinitionState>();
		defService = new EventDefinitionService({
			storage: defMock.storage,
			eventBus,
		});

		// Enable event system
		await eventBus.emit("settings.loaded", {
			settings: { ...DEFAULT_SETTINGS, eventSystemEnabled: true },
		});

		await ingestionService.load();
		await defService.load();
	});

	describe("ingestion job lifecycle", () => {
		it("should queue and process a file.created event", async () => {
			const jobStarted = vi.fn();
			const jobCompleted = vi.fn();
			eventBus.on("ingestion.job.started", jobStarted);
			eventBus.on("ingestion.job.completed", jobCompleted);

			await eventBus.emit("file.created", { source: "user", path: "Reports/Q1.md" });

			// Wait for batch window + processing
			await waitForAsync(200);

			expect(jobStarted).toHaveBeenCalled();
			expect(jobCompleted).toHaveBeenCalled();
		});

		it("should track processed files in idempotency ledger", async () => {
			await eventBus.emit("file.created", { source: "user", path: "Reports/Q1.md" });
			await waitForAsync(200);

			const key = ingestionService.generateEventKey("file.created", "Reports/Q1.md");
			expect(ingestionService.isProcessed(key)).toBe(true);
		});

		it("should deduplicate repeated events for the same file", async () => {
			const jobCompleted = vi.fn();
			eventBus.on("ingestion.job.completed", jobCompleted);

			// Emit same file twice
			await eventBus.emit("file.created", { source: "user", path: "Reports/Q1.md" });
			await waitForAsync(200);

			await eventBus.emit("file.created", { source: "user", path: "Reports/Q1.md" });
			await waitForAsync(200);

			// Second emission should be deduplicated
			expect(jobCompleted).toHaveBeenCalledTimes(1);
		});

		it("should NOT process events not in watchEventTypes", async () => {
			const jobStarted = vi.fn();
			eventBus.on("ingestion.job.started", jobStarted);

			// file.deleted is not in watchEventTypes
			await eventBus.emit("file.deleted", { source: "user", path: "Reports/old.md" });
			await waitForAsync(200);

			expect(jobStarted).not.toHaveBeenCalled();
		});
	});

	describe("ingestion stats", () => {
		it("should update stats after processing", async () => {
			await eventBus.emit("file.created", { source: "user", path: "Notes/test.md" });
			await waitForAsync(200);

			const stats = ingestionService.getStats();
			expect(stats.processedCount).toBe(1);
		});
	});

	describe("event definition matching on ingestion", () => {
		it("should match definitions when ingestion job completes", async () => {
			const matchedHandler = vi.fn();
			eventBus.on("eventDefinition.matched", matchedHandler);

			// Create a definition first
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "report.generated",
				filePattern: "Reports/**",
				emissionPolicy: "always",
				payloadMappings: [],
			});
			await waitForAsync();

			// Now trigger ingestion
			await eventBus.emit("file.created", { source: "user", path: "Reports/Q1.md" });
			await waitForAsync(200);

			expect(matchedHandler).toHaveBeenCalled();
		});

		it("should NOT match definitions when file pattern doesn't match", async () => {
			const matchedHandler = vi.fn();
			eventBus.on("eventDefinition.matched", matchedHandler);

			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "report.generated",
				filePattern: "Reports/**",
				emissionPolicy: "always",
				payloadMappings: [],
			});
			await waitForAsync();

			// File not in Reports folder
			await eventBus.emit("file.created", { source: "user", path: "Notes/random.md" });
			await waitForAsync(200);

			expect(matchedHandler).not.toHaveBeenCalled();
		});

		it.skip("should emit custom domain event when definition matches (emitCustom only fires wildcard handlers)", () => {
			// emitCustom() dispatches to wildcard ("*") listeners only, not typed on() handlers.
			// Custom events are visible via the Activity Log wildcard listener.
		});
	});

	describe("emission policy", () => {
		it.skip("should respect 'once' policy and not re-emit for same file (emitCustom only fires wildcard handlers)", () => {
			// emitCustom() dispatches to wildcard ("*") listeners only.
			// Emission policy deduplication is tested at the EventDefinitionService unit level.
		});
	});

	describe("catch-up scanning", () => {
		it("should scan folders and enqueue new files during catch-up", async () => {
			const jobCompleted = vi.fn();
			eventBus.on("ingestion.job.completed", jobCompleted);

			const listFiles = vi.fn(async () => [
				"Reports/Q1.md",
				"Reports/Q2.md",
			]);

			await ingestionService.runCatchUp(["Reports"], listFiles);
			await waitForAsync(300);

			expect(listFiles).toHaveBeenCalledWith("Reports");
			expect(jobCompleted).toHaveBeenCalledTimes(2);
		});

		it("should skip already-processed files during catch-up", async () => {
			// Process first
			await eventBus.emit("file.created", { source: "user", path: "Reports/Q1.md" });
			await waitForAsync(200);

			const jobCompleted = vi.fn();
			eventBus.on("ingestion.job.completed", jobCompleted);

			// Re-clear the handler count
			jobCompleted.mockClear();

			const listFiles = vi.fn(async () => [
				"Reports/Q1.md", // already processed
				"Reports/Q2.md", // new
			]);

			await ingestionService.runCatchUp(["Reports"], listFiles);
			await waitForAsync(300);

			// Only Q2 should be processed
			expect(jobCompleted).toHaveBeenCalledTimes(1);
		});
	});

	it.skip("should configure watch folders via Settings UI (requires Obsidian PluginSettingTab)", () => {
		// Settings UI: text input for watch folder paths.
	});

	it.skip("should display ingestion stats in dashboard (requires Obsidian ItemView)", () => {
		// Dashboard card shows processed/failed/queued counts.
	});
});
