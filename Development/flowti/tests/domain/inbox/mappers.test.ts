import { describe, it, expect } from "vitest";
import {
	mapSubscriptionMatched,
	mapImportCompleted,
	mapImportFailed,
	mapExportCompleted,
	mapPipelineCompleted,
	mapPipelineFailed,
} from "../../../src/domain/inbox/mappers";

describe("Inbox mappers", () => {
	describe("mapSubscriptionMatched", () => {
		it("should create an info item with label", () => {
			const item = mapSubscriptionMatched(
				{
					eventType: "file.created",
					subscriptionId: "sub_123",
					subscriptionLabel: "New Reports",
					timestamp: "2026-02-15T10:00:00Z",
				},
				"inbox_1",
			);

			expect(item.id).toBe("inbox_1");
			expect(item.type).toBe("info");
			expect(item.title).toBe("Watcher matched: New Reports");
			expect(item.description).toContain("file.created");
			expect(item.description).toContain("sub_123");
			expect(item.sourceEvent).toBe("subscription.matched");
			expect(item.sourceHub).toBe("subscription");
			expect(item.timestamp).toBe("2026-02-15T10:00:00Z");
			expect(item.read).toBe(false);
		});

		it("should fall back to eventType when no label", () => {
			const item = mapSubscriptionMatched(
				{
					eventType: "file.modified",
					subscriptionId: "sub_456",
					timestamp: "2026-02-15T10:00:00Z",
				},
				"inbox_2",
			);

			expect(item.title).toBe("Watcher matched: file.modified");
		});

		it("should handle empty label the same as missing label", () => {
			const item = mapSubscriptionMatched(
				{
					eventType: "file.deleted",
					subscriptionId: "sub_789",
					subscriptionLabel: "",
					timestamp: "2026-02-15T10:00:00Z",
				},
				"inbox_3",
			);

			expect(item.title).toBe("Watcher matched: file.deleted");
		});
	});

	describe("mapImportCompleted", () => {
		it("should create an info item for successful import", () => {
			const item = mapImportCompleted(
				{
					result: {
						totalRows: 100,
						created: 80,
						updated: 10,
						skipped: 10,
						failed: 0,
					},
				},
				"inbox_4",
			);

			expect(item.id).toBe("inbox_4");
			expect(item.type).toBe("info");
			expect(item.title).toBe("Import completed: 80 created");
			expect(item.description).toContain("100 rows processed");
			expect(item.description).toContain("80 created");
			expect(item.description).toContain("10 updated");
			expect(item.description).toContain("10 skipped");
			expect(item.description).toContain("0 failed");
			expect(item.sourceEvent).toBe("dataExchange.import.completed");
			expect(item.sourceHub).toBe("data-exchange");
			expect(item.read).toBe(false);
		});

		it("should create an action item when there are failures", () => {
			const item = mapImportCompleted(
				{
					result: {
						totalRows: 50,
						created: 45,
						updated: 0,
						skipped: 0,
						failed: 5,
					},
				},
				"inbox_5",
			);

			expect(item.type).toBe("action");
			expect(item.title).toBe("Import completed with 5 errors");
		});

		it("should use singular 'error' for exactly 1 failure", () => {
			const item = mapImportCompleted(
				{
					result: {
						totalRows: 10,
						created: 9,
						updated: 0,
						skipped: 0,
						failed: 1,
					},
				},
				"inbox_6",
			);

			expect(item.title).toBe("Import completed with 1 error");
		});

		it("should handle zero rows", () => {
			const item = mapImportCompleted(
				{
					result: {
						totalRows: 0,
						created: 0,
						updated: 0,
						skipped: 0,
						failed: 0,
					},
				},
				"inbox_7",
			);

			expect(item.type).toBe("info");
			expect(item.title).toBe("Import completed: 0 created");
		});
	});

	describe("mapImportFailed", () => {
		it("should create an action item with error details", () => {
			const item = mapImportFailed(
				{
					error: "File not found",
					config: { sourcePath: "data/contacts.csv" },
				},
				"inbox_8",
			);

			expect(item.id).toBe("inbox_8");
			expect(item.type).toBe("action");
			expect(item.title).toBe("Import failed");
			expect(item.description).toContain("data/contacts.csv");
			expect(item.description).toContain("File not found");
			expect(item.sourceEvent).toBe("dataExchange.import.failed");
			expect(item.sourceHub).toBe("data-exchange");
			expect(item.read).toBe(false);
		});
	});

	describe("mapPipelineCompleted", () => {
		it("should create an info item for successful pipeline", () => {
			const item = mapPipelineCompleted(
				{
					result: {
						totalSources: 3,
						totalRows: 150,
						created: 120,
						updated: 20,
						skipped: 10,
						failed: 0,
					},
				},
				"inbox_20",
			);

			expect(item.id).toBe("inbox_20");
			expect(item.type).toBe("info");
			expect(item.title).toBe("Pipeline completed: 120 created, 20 updated");
			expect(item.description).toContain("3 sources");
			expect(item.description).toContain("150 rows processed");
			expect(item.description).toContain("120 created");
			expect(item.description).toContain("20 updated");
			expect(item.description).toContain("10 skipped");
			expect(item.description).toContain("0 failed");
			expect(item.sourceEvent).toBe("dataExchange.pipeline.completed");
			expect(item.sourceHub).toBe("data-exchange");
			expect(item.read).toBe(false);
		});

		it("should create an action item when there are failures", () => {
			const item = mapPipelineCompleted(
				{
					result: {
						totalSources: 2,
						totalRows: 50,
						created: 40,
						updated: 5,
						skipped: 0,
						failed: 5,
					},
				},
				"inbox_21",
			);

			expect(item.type).toBe("action");
			expect(item.title).toBe("Pipeline completed with 5 errors");
		});

		it("should use singular 'error' for exactly 1 failure", () => {
			const item = mapPipelineCompleted(
				{
					result: {
						totalSources: 1,
						totalRows: 10,
						created: 9,
						updated: 0,
						skipped: 0,
						failed: 1,
					},
				},
				"inbox_22",
			);

			expect(item.title).toBe("Pipeline completed with 1 error");
		});

		it("should use singular 'source' for exactly 1 source", () => {
			const item = mapPipelineCompleted(
				{
					result: {
						totalSources: 1,
						totalRows: 10,
						created: 10,
						updated: 0,
						skipped: 0,
						failed: 0,
					},
				},
				"inbox_23",
			);

			expect(item.description).toContain("1 source,");
		});
	});

	describe("mapPipelineFailed", () => {
		it("should create an action item with error details", () => {
			const item = mapPipelineFailed(
				{
					error: "Source file missing",
					pipelineId: "pipe_123",
				},
				"inbox_24",
			);

			expect(item.id).toBe("inbox_24");
			expect(item.type).toBe("action");
			expect(item.title).toBe("Pipeline failed");
			expect(item.description).toContain("pipe_123");
			expect(item.description).toContain("Source file missing");
			expect(item.sourceEvent).toBe("dataExchange.pipeline.failed");
			expect(item.sourceHub).toBe("data-exchange");
			expect(item.read).toBe(false);
		});
	});

	describe("mapExportCompleted", () => {
		it("should create an info item for successful export", () => {
			const item = mapExportCompleted(
				{
					result: {
						totalRows: 200,
						totalColumns: 5,
						outputPath: "exports/report.csv",
					},
				},
				"inbox_9",
			);

			expect(item.id).toBe("inbox_9");
			expect(item.type).toBe("info");
			expect(item.title).toBe("Export completed: 200 rows");
			expect(item.description).toContain("200 rows");
			expect(item.description).toContain("5 columns");
			expect(item.description).toContain("exports/report.csv");
			expect(item.sourceEvent).toBe("dataExchange.export.completed");
			expect(item.sourceHub).toBe("data-exchange");
			expect(item.read).toBe(false);
		});

		it("should create a skipped item when export was skipped", () => {
			const item = mapExportCompleted(
				{
					result: {
						totalRows: 0,
						totalColumns: 0,
						outputPath: "exports/existing.csv",
						skipped: true,
					},
				},
				"inbox_10",
			);

			expect(item.type).toBe("info");
			expect(item.title).toBe("Export skipped");
			expect(item.description).toContain("exports/existing.csv");
			expect(item.description).toContain("skipped");
		});

		it("should not treat skipped=false as skipped", () => {
			const item = mapExportCompleted(
				{
					result: {
						totalRows: 50,
						totalColumns: 3,
						outputPath: "out.csv",
						skipped: false,
					},
				},
				"inbox_11",
			);

			expect(item.title).toBe("Export completed: 50 rows");
		});
	});
});
