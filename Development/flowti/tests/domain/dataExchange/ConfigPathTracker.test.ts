import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConfigPathTracker } from "../../../src/domain/dataExchange/ConfigPathTracker";
import type { DataExchangeState } from "../../../src/domain/dataExchange/types";

function makeState(overrides: Partial<DataExchangeState> = {}): DataExchangeState {
	return {
		savedImportConfigs: [],
		savedExportConfigs: [],
		savedPipelines: [],
		...overrides,
	};
}

describe("ConfigPathTracker", () => {
	let state: DataExchangeState;
	let saveState: ReturnType<typeof vi.fn>;
	let emitConfigChanged: ReturnType<typeof vi.fn>;
	let tracker: ConfigPathTracker;

	beforeEach(() => {
		state = makeState();
		saveState = vi.fn(async () => {});
		emitConfigChanged = vi.fn();
		tracker = new ConfigPathTracker({
			getState: () => state,
			saveState,
			emitConfigChanged,
		});
	});

	// ── handleFileRenamed ────────────────────────────────────

	describe("handleFileRenamed", () => {
		it("should update import config sourcePath", async () => {
			state.savedImportConfigs = [
				{ id: "i1", name: "cfg", createdAt: 1, sourcePath: "data/old.csv", targetFolder: "out", nameColumn: "id", columnMappings: [], conflictStrategy: "skip" },
			];
			await tracker.handleFileRenamed("data/old.csv", "data/new.csv");
			expect(state.savedImportConfigs[0].sourcePath).toBe("data/new.csv");
			expect(saveState).toHaveBeenCalled();
			expect(emitConfigChanged).toHaveBeenCalled();
		});

		it("should not update import config when path doesn't match", async () => {
			state.savedImportConfigs = [
				{ id: "i1", name: "cfg", createdAt: 1, sourcePath: "data/other.csv", targetFolder: "out", nameColumn: "id", columnMappings: [], conflictStrategy: "skip" },
			];
			await tracker.handleFileRenamed("data/old.csv", "data/new.csv");
			expect(state.savedImportConfigs[0].sourcePath).toBe("data/other.csv");
			expect(saveState).not.toHaveBeenCalled();
		});

		it("should update export config sourcePath", async () => {
			state.savedExportConfigs = [
				{ id: "e1", name: "exp", createdAt: 1, sourcePath: "data/old.csv", sourceType: "folder", format: "csv", outputPath: "out/export.csv", columns: [], fileProperties: [] },
			];
			await tracker.handleFileRenamed("data/old.csv", "data/new.csv");
			expect(state.savedExportConfigs[0].sourcePath).toBe("data/new.csv");
			expect(saveState).toHaveBeenCalled();
		});

		it("should update export config outputPath when not external", async () => {
			state.savedExportConfigs = [
				{ id: "e1", name: "exp", createdAt: 1, sourcePath: "src", sourceType: "folder", format: "csv", outputPath: "reports/old.csv", columns: [], fileProperties: [] },
			];
			await tracker.handleFileRenamed("reports/old.csv", "reports/new.csv");
			expect(state.savedExportConfigs[0].outputPath).toBe("reports/new.csv");
		});

		it("should NOT update export config outputPath when external", async () => {
			state.savedExportConfigs = [
				{ id: "e1", name: "exp", createdAt: 1, sourcePath: "src", sourceType: "folder", format: "csv", outputPath: "/abs/old.csv", columns: [], fileProperties: [], isExternal: true },
			];
			await tracker.handleFileRenamed("/abs/old.csv", "/abs/new.csv");
			expect(state.savedExportConfigs[0].outputPath).toBe("/abs/old.csv");
			expect(saveState).not.toHaveBeenCalled();
		});

		it("should update pipeline source csvPath", async () => {
			state.savedPipelines = [
				{
					id: "p1", name: "pipe", createdAt: 1, targetFolder: "out", mergeKey: "id",
					sources: [{ id: "s1", csvPath: "data/report.csv", mergeKeyColumn: "id", columnMappings: [] }],
				},
			];
			await tracker.handleFileRenamed("data/report.csv", "data/report-v2.csv");
			expect(state.savedPipelines![0].sources[0].csvPath).toBe("data/report-v2.csv");
			expect(saveState).toHaveBeenCalled();
		});

		it("should not update pipeline source when path doesn't match", async () => {
			state.savedPipelines = [
				{
					id: "p1", name: "pipe", createdAt: 1, targetFolder: "out", mergeKey: "id",
					sources: [{ id: "s1", csvPath: "data/other.csv", mergeKeyColumn: "id", columnMappings: [] }],
				},
			];
			await tracker.handleFileRenamed("data/report.csv", "data/report-v2.csv");
			expect(state.savedPipelines![0].sources[0].csvPath).toBe("data/other.csv");
			expect(saveState).not.toHaveBeenCalled();
		});

		it("should update multiple configs in a single rename", async () => {
			state.savedImportConfigs = [
				{ id: "i1", name: "a", createdAt: 1, sourcePath: "data/file.csv", targetFolder: "out", nameColumn: "id", columnMappings: [], conflictStrategy: "skip" },
			];
			state.savedExportConfigs = [
				{ id: "e1", name: "b", createdAt: 1, sourcePath: "data/file.csv", sourceType: "folder", format: "csv", outputPath: "out/x.csv", columns: [], fileProperties: [] },
			];
			await tracker.handleFileRenamed("data/file.csv", "data/file-v2.csv");
			expect(state.savedImportConfigs[0].sourcePath).toBe("data/file-v2.csv");
			expect(state.savedExportConfigs[0].sourcePath).toBe("data/file-v2.csv");
			expect(saveState).toHaveBeenCalledOnce();
		});
	});

	// ── handleFolderRenamed ──────────────────────────────────

	describe("handleFolderRenamed", () => {
		it("should update export sourcePath with exact folder match", async () => {
			state.savedExportConfigs = [
				{ id: "e1", name: "exp", createdAt: 1, sourcePath: "projects/alpha", sourceType: "folder", format: "csv", outputPath: "out.csv", columns: [], fileProperties: [] },
			];
			await tracker.handleFolderRenamed("projects/alpha", "projects/beta");
			expect(state.savedExportConfigs[0].sourcePath).toBe("projects/beta");
			expect(saveState).toHaveBeenCalled();
		});

		it("should update export sourcePath with prefix match", async () => {
			state.savedExportConfigs = [
				{ id: "e1", name: "exp", createdAt: 1, sourcePath: "projects/alpha/data", sourceType: "folder", format: "csv", outputPath: "out.csv", columns: [], fileProperties: [] },
			];
			await tracker.handleFolderRenamed("projects/alpha", "projects/beta");
			expect(state.savedExportConfigs[0].sourcePath).toBe("projects/beta/data");
		});

		it("should update export outputPath with prefix match (non-external)", async () => {
			state.savedExportConfigs = [
				{ id: "e1", name: "exp", createdAt: 1, sourcePath: "src", sourceType: "folder", format: "csv", outputPath: "projects/alpha/export.csv", columns: [], fileProperties: [] },
			];
			await tracker.handleFolderRenamed("projects/alpha", "projects/beta");
			expect(state.savedExportConfigs[0].outputPath).toBe("projects/beta/export.csv");
		});

		it("should NOT update export outputPath when external", async () => {
			state.savedExportConfigs = [
				{ id: "e1", name: "exp", createdAt: 1, sourcePath: "src", sourceType: "folder", format: "csv", outputPath: "projects/alpha/export.csv", columns: [], fileProperties: [], isExternal: true },
			];
			await tracker.handleFolderRenamed("projects/alpha", "projects/beta");
			expect(state.savedExportConfigs[0].outputPath).toBe("projects/alpha/export.csv");
		});

		it("should update import sourcePath with prefix match", async () => {
			state.savedImportConfigs = [
				{ id: "i1", name: "cfg", createdAt: 1, sourcePath: "projects/alpha/data.csv", targetFolder: "out", nameColumn: "id", columnMappings: [], conflictStrategy: "skip" },
			];
			await tracker.handleFolderRenamed("projects/alpha", "projects/beta");
			expect(state.savedImportConfigs[0].sourcePath).toBe("projects/beta/data.csv");
		});

		it("should update import targetFolder with exact match", async () => {
			state.savedImportConfigs = [
				{ id: "i1", name: "cfg", createdAt: 1, targetFolder: "projects/alpha", nameColumn: "id", columnMappings: [], conflictStrategy: "skip" },
			];
			await tracker.handleFolderRenamed("projects/alpha", "projects/beta");
			expect(state.savedImportConfigs[0].targetFolder).toBe("projects/beta");
		});

		it("should update import targetFolder with prefix match", async () => {
			state.savedImportConfigs = [
				{ id: "i1", name: "cfg", createdAt: 1, targetFolder: "projects/alpha/items", nameColumn: "id", columnMappings: [], conflictStrategy: "skip" },
			];
			await tracker.handleFolderRenamed("projects/alpha", "projects/beta");
			expect(state.savedImportConfigs[0].targetFolder).toBe("projects/beta/items");
		});

		it("should update pipeline targetFolder", async () => {
			state.savedPipelines = [
				{
					id: "p1", name: "pipe", createdAt: 1, targetFolder: "projects/alpha/items", mergeKey: "id",
					sources: [],
				},
			];
			await tracker.handleFolderRenamed("projects/alpha", "projects/beta");
			expect(state.savedPipelines![0].targetFolder).toBe("projects/beta/items");
		});

		it("should update pipeline source csvPath with prefix match", async () => {
			state.savedPipelines = [
				{
					id: "p1", name: "pipe", createdAt: 1, targetFolder: "out", mergeKey: "id",
					sources: [{ id: "s1", csvPath: "projects/alpha/data.csv", mergeKeyColumn: "id", columnMappings: [] }],
				},
			];
			await tracker.handleFolderRenamed("projects/alpha", "projects/beta");
			expect(state.savedPipelines![0].sources[0].csvPath).toBe("projects/beta/data.csv");
		});

		it("should not match partial folder name overlap", async () => {
			state.savedPipelines = [
				{
					id: "p1", name: "pipe", createdAt: 1, targetFolder: "projects/alpha-backup/items", mergeKey: "id",
					sources: [],
				},
			];
			await tracker.handleFolderRenamed("projects/alpha", "projects/beta");
			expect(state.savedPipelines![0].targetFolder).toBe("projects/alpha-backup/items");
			expect(saveState).not.toHaveBeenCalled();
		});

		it("should not save or emit when no paths match", async () => {
			state.savedImportConfigs = [
				{ id: "i1", name: "cfg", createdAt: 1, targetFolder: "other/path", nameColumn: "id", columnMappings: [], conflictStrategy: "skip" },
			];
			await tracker.handleFolderRenamed("projects/alpha", "projects/beta");
			expect(saveState).not.toHaveBeenCalled();
			expect(emitConfigChanged).not.toHaveBeenCalled();
		});

		it("should update across all config types in a single rename", async () => {
			state.savedImportConfigs = [
				{ id: "i1", name: "imp", createdAt: 1, sourcePath: "projects/alpha/src.csv", targetFolder: "projects/alpha/out", nameColumn: "id", columnMappings: [], conflictStrategy: "skip" },
			];
			state.savedExportConfigs = [
				{ id: "e1", name: "exp", createdAt: 1, sourcePath: "projects/alpha", sourceType: "folder", format: "csv", outputPath: "projects/alpha/export.csv", columns: [], fileProperties: [] },
			];
			state.savedPipelines = [
				{
					id: "p1", name: "pipe", createdAt: 1, targetFolder: "projects/alpha/items", mergeKey: "id",
					sources: [{ id: "s1", csvPath: "projects/alpha/data.csv", mergeKeyColumn: "id", columnMappings: [] }],
				},
			];

			await tracker.handleFolderRenamed("projects/alpha", "projects/beta");

			expect(state.savedImportConfigs[0].sourcePath).toBe("projects/beta/src.csv");
			expect(state.savedImportConfigs[0].targetFolder).toBe("projects/beta/out");
			expect(state.savedExportConfigs[0].sourcePath).toBe("projects/beta");
			expect(state.savedExportConfigs[0].outputPath).toBe("projects/beta/export.csv");
			expect(state.savedPipelines![0].targetFolder).toBe("projects/beta/items");
			expect(state.savedPipelines![0].sources[0].csvPath).toBe("projects/beta/data.csv");
			expect(saveState).toHaveBeenCalledOnce();
			expect(emitConfigChanged).toHaveBeenCalledOnce();
		});

		it("should handle pipeline with undefined savedPipelines", async () => {
			state.savedPipelines = undefined;
			state.savedExportConfigs = [
				{ id: "e1", name: "exp", createdAt: 1, sourcePath: "projects/alpha", sourceType: "folder", format: "csv", outputPath: "out.csv", columns: [], fileProperties: [] },
			];
			await tracker.handleFolderRenamed("projects/alpha", "projects/beta");
			expect(state.savedExportConfigs[0].sourcePath).toBe("projects/beta");
			expect(saveState).toHaveBeenCalled();
		});

		it("should handle pipeline with undefined savedPipelines in file rename", async () => {
			state.savedPipelines = undefined;
			state.savedImportConfigs = [
				{ id: "i1", name: "cfg", createdAt: 1, sourcePath: "data/old.csv", targetFolder: "out", nameColumn: "id", columnMappings: [], conflictStrategy: "skip" },
			];
			await tracker.handleFileRenamed("data/old.csv", "data/new.csv");
			expect(state.savedImportConfigs[0].sourcePath).toBe("data/new.csv");
			expect(saveState).toHaveBeenCalled();
		});
	});
});
