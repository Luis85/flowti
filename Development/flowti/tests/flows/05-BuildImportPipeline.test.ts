/**
 * Flow 05: Build Import Pipeline
 *
 * Tests the multi-step import pipeline workflow:
 * Create pipeline → add import sources → configure settings →
 * save pipeline → execute pipeline → sequential imports → review results.
 *
 * Event sequence:
 *   dataExchange.pipeline.execute → (pipeline internally runs imports) →
 *   dataExchange.pipeline.completed
 *
 * NOTE: Pipeline execution uses `pipelineId` to look up saved pipelines,
 * so pipelines must be saved before execution.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseYaml } from "obsidian";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { DataExchangeService } from "../../src/domain/dataExchange/DataExchangeService";
import type { DataExchangeState } from "../../src/domain/dataExchange/types";
import { createMockStorage, createMockFileSystem, waitForAsync } from "./testHelpers";

describe("Flow 05: Build Import Pipeline", () => {
	let eventBus: IEventBus;
	let service: DataExchangeService;
	let fileSystem: ReturnType<typeof createMockFileSystem>;

	beforeEach(async () => {
		eventBus = new EventBus();
		fileSystem = createMockFileSystem({
			"data/users.csv": "name,email\nAlice,alice@co.com\nBob,bob@co.com",
			"data/roles.csv": "name,role\nAlice,Admin\nBob,User",
		});
		const storageMock = createMockStorage<DataExchangeState>();
		service = new DataExchangeService({
			eventBus,
			fileSystem,
			yamlParser: { parse: (c: string) => parseYaml(c) as Record<string, unknown> | null },
			storage: storageMock.storage,
			listFiles: () => [],
		});
		await service.load();
	});

	describe("pipeline CRUD", () => {
		it("should save a pipeline with multiple sources", async () => {
			const pipeline = await service.savePipeline({
				name: "User Onboarding",
				targetFolder: "People",
				mergeKey: "name",
				sources: [
					{
						id: "src-1",
						csvPath: "data/users.csv",
						mergeKeyColumn: "name",
						columnMappings: [
							{ csvColumn: "email", frontmatterKey: "email", included: true },
						],
					},
					{
						id: "src-2",
						csvPath: "data/roles.csv",
						mergeKeyColumn: "name",
						columnMappings: [
							{ csvColumn: "role", frontmatterKey: "role", included: true },
						],
					},
				],
			});

			expect(pipeline.id).toBeDefined();
			expect(pipeline.name).toBe("User Onboarding");

			const retrieved = service.getPipeline(pipeline.id);
			expect(retrieved).toBeDefined();
			expect(retrieved!.sources).toHaveLength(2);
		});

		it("should delete a saved pipeline", async () => {
			const pipeline = await service.savePipeline({
				name: "Temp Pipeline",
				targetFolder: "Out",
				mergeKey: "id",
				sources: [],
			});

			await service.deletePipeline(pipeline.id);
			expect(service.getPipeline(pipeline.id)).toBeUndefined();
		});

		it("should toggle pipeline favourite", async () => {
			const pipeline = await service.savePipeline({
				name: "Fav Pipeline",
				targetFolder: "Out",
				mergeKey: "id",
				sources: [],
			});

			await service.togglePipelineFavourite(pipeline.id);
			const updated = service.getPipeline(pipeline.id);
			expect(updated?.favourite).toBe(true);

			await service.togglePipelineFavourite(pipeline.id);
			const toggled = service.getPipeline(pipeline.id);
			expect(toggled?.favourite).toBe(false);
		});

		it("should update a saved pipeline", async () => {
			const pipeline = await service.savePipeline({
				name: "Original",
				targetFolder: "Out",
				mergeKey: "id",
				sources: [],
			});

			const updated = await service.updatePipeline(pipeline.id, {
				name: "Updated Name",
			});
			expect(updated?.name).toBe("Updated Name");
		});
	});

	describe("pipeline execution", () => {
		it("should emit pipeline.completed after executing a saved pipeline", async () => {
			const completedHandler = vi.fn();
			eventBus.on("dataExchange.pipeline.completed", completedHandler);

			const pipeline = await service.savePipeline({
				name: "Test Pipeline",
				targetFolder: "People",
				mergeKey: "name",
				sources: [
					{
						id: "src-1",
						csvPath: "data/users.csv",
						mergeKeyColumn: "name",
						columnMappings: [
							{ csvColumn: "email", frontmatterKey: "email", included: true },
						],
					},
				],
			});

			await eventBus.emit("dataExchange.pipeline.execute", {
				pipelineId: pipeline.id,
			});

			await waitForAsync(300);
			expect(completedHandler).toHaveBeenCalledOnce();
		});

		it("should emit pipeline.failed when pipeline ID is not found", async () => {
			const failedHandler = vi.fn();
			eventBus.on("dataExchange.pipeline.failed", failedHandler);

			await eventBus.emit("dataExchange.pipeline.execute", {
				pipelineId: "nonexistent-id",
			});

			await waitForAsync(100);
			expect(failedHandler).toHaveBeenCalledOnce();
		});

		it("should execute multi-source pipeline", async () => {
			const completedHandler = vi.fn();
			eventBus.on("dataExchange.pipeline.completed", completedHandler);

			const pipeline = await service.savePipeline({
				name: "Multi-source",
				targetFolder: "People",
				mergeKey: "name",
				sources: [
					{
						id: "src-1",
						csvPath: "data/users.csv",
						mergeKeyColumn: "name",
						columnMappings: [
							{ csvColumn: "email", frontmatterKey: "email", included: true },
						],
					},
					{
						id: "src-2",
						csvPath: "data/roles.csv",
						mergeKeyColumn: "name",
						columnMappings: [
							{ csvColumn: "role", frontmatterKey: "role", included: true },
						],
					},
				],
			});

			await eventBus.emit("dataExchange.pipeline.execute", {
				pipelineId: pipeline.id,
			});

			await waitForAsync(300);
			expect(completedHandler).toHaveBeenCalledOnce();
		});
	});

	describe("pipeline list", () => {
		it("should list all saved pipelines", async () => {
			await service.savePipeline({
				name: "Pipeline A",
				targetFolder: "Out",
				mergeKey: "id",
				sources: [],
			});
			await service.savePipeline({
				name: "Pipeline B",
				targetFolder: "Out",
				mergeKey: "id",
				sources: [],
			});

			expect(service.getSavedPipelines()).toHaveLength(2);
		});
	});

	it.skip("should render pipeline wizard in Data Exchange Hub (requires Obsidian View)", () => {
		// Hub component renders pipeline management UI with step editors.
	});

	it.skip("should show per-step progress during pipeline execution (requires UI rendering)", () => {
		// Pipeline executor emits progress events per step.
	});
});
