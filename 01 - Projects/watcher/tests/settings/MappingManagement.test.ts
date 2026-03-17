import { describe, it, expect, beforeEach, vi } from "vitest";
import { type FolderMapping, createDefaultMapping } from "../../src/types";
import { type MappingModalResult } from "../../src/modals/FolderMappingModal";

/**
 * Tests for mapping creation and editing logic.
 * These tests verify the data flow without requiring DOM/Obsidian dependencies.
 */

describe("Mapping Management", () => {
	describe("createDefaultMapping", () => {
		it("should create a mapping with default values", () => {
			const mapping = createDefaultMapping();

			// ID is now auto-generated (non-empty string)
			expect(mapping.id).toBeTruthy();
			expect(typeof mapping.id).toBe("string");
			expect(mapping.enabled).toBe(true);
			expect(mapping.sourceFolder).toBe("");
			expect(mapping.targetFolder).toBe("");
			expect(mapping.watchSubfolders).toBe(true);
			expect(mapping.fileExtensions).toEqual([]);
			expect(mapping.conflictResolution).toBe("keepNewer");
			expect(mapping.debounceDelay).toBe(800);
			expect(mapping.description).toBe("");
			expect(mapping.usePolling).toBe(false);
			expect(mapping.pollingInterval).toBe(300);
			expect(mapping.reconcileOnStart).toBe(true);
		});

		it("should generate unique IDs for each mapping", () => {
			const mapping1 = createDefaultMapping();
			const mapping2 = createDefaultMapping();

			expect(mapping1.id).not.toBe(mapping2.id);
		});
	});

	describe("Mapping creation flow", () => {
		let folderMappings: FolderMapping[];
		let saveSettingsCalled: boolean;

		beforeEach(() => {
			folderMappings = [];
			saveSettingsCalled = false;
		});

		const simulateSaveSettings = async () => {
			saveSettingsCalled = true;
		};

		const simulateCreateMappingFlow = async (
			result: MappingModalResult
		): Promise<void> => {
			// This simulates the callback logic from FileWatcherSettingTab.openNewMappingModal
			if (result.saved && result.mapping) {
				folderMappings.push(result.mapping);
			}
			await simulateSaveSettings();
		};

		it("should add mapping when saved with valid data", async () => {
			const newMapping: FolderMapping = {
				id: "mapping-123",
				enabled: true,
				sourceFolder: "C:\\Users\\Test\\Documents",
				targetFolder: "imported/docs",
				watchSubfolders: true,
				fileExtensions: [".md", ".pdf"],
				conflictResolution: "keepNewer",
				debounceDelay: 800,
				description: "Test Mapping",
				usePolling: false,
				pollingInterval: 300,
				reconcileOnStart: true,
				syncDirection: "source-only",
			};

			await simulateCreateMappingFlow({
				saved: true,
				mapping: newMapping,
			});

			expect(folderMappings).toHaveLength(1);
			expect(folderMappings[0]).toEqual(newMapping);
			expect(folderMappings[0].description).toBe("Test Mapping");
			expect(folderMappings[0].sourceFolder).toBe("C:\\Users\\Test\\Documents");
			expect(saveSettingsCalled).toBe(true);
		});

		it("should not add mapping when cancelled", async () => {
			await simulateCreateMappingFlow({
				saved: false,
			});

			expect(folderMappings).toHaveLength(0);
			expect(saveSettingsCalled).toBe(true);
		});

		it("should not add mapping when deleted during creation", async () => {
			await simulateCreateMappingFlow({
				saved: false,
				deleted: true,
			});

			expect(folderMappings).toHaveLength(0);
		});

		it("should preserve all mapping properties when saved", async () => {
			const customMapping: FolderMapping = {
				id: "custom-id",
				enabled: false,
				sourceFolder: "/path/to/source",
				targetFolder: "custom/target",
				watchSubfolders: false,
				fileExtensions: [".txt", ".json"],
				conflictResolution: "overwrite",
				debounceDelay: 1500,
				description: "Custom Description",
				usePolling: true,
				pollingInterval: 500,
				reconcileOnStart: false,
				syncDirection: "source-only",
			};

			await simulateCreateMappingFlow({
				saved: true,
				mapping: customMapping,
			});

			const saved = folderMappings[0];
			expect(saved.id).toBe("custom-id");
			expect(saved.enabled).toBe(false);
			expect(saved.watchSubfolders).toBe(false);
			expect(saved.fileExtensions).toEqual([".txt", ".json"]);
			expect(saved.conflictResolution).toBe("overwrite");
			expect(saved.debounceDelay).toBe(1500);
			expect(saved.usePolling).toBe(true);
			expect(saved.pollingInterval).toBe(500);
			expect(saved.reconcileOnStart).toBe(false);
		});
	});

	describe("Mapping edit flow", () => {
		let folderMappings: FolderMapping[];

		beforeEach(() => {
			folderMappings = [
				{
					id: "existing-1",
					enabled: true,
					sourceFolder: "C:\\Original\\Path",
					targetFolder: "original/target",
					watchSubfolders: true,
					fileExtensions: [".md"],
					conflictResolution: "keepNewer",
					debounceDelay: 800,
					description: "Original Mapping",
					usePolling: false,
					pollingInterval: 300,
					reconcileOnStart: true,
					syncDirection: "source-only",
				},
				{
					id: "existing-2",
					enabled: false,
					sourceFolder: "C:\\Another\\Path",
					targetFolder: "another/target",
					watchSubfolders: false,
					fileExtensions: [],
					conflictResolution: "skip",
					debounceDelay: 500,
					description: "Another Mapping",
					usePolling: true,
					pollingInterval: 100,
					reconcileOnStart: false,
					syncDirection: "source-only",
				},
			];
		});

		const simulateEditMappingFlow = async (
			result: MappingModalResult
		): Promise<void> => {
			// This simulates the callback logic from FileWatcherSettingTab.openEditMappingModal
			if (result.deleted) {
				folderMappings = folderMappings.filter(
					(x) => x.id !== result.mapping?.id
				);
			} else if (result.saved && result.mapping) {
				const index = folderMappings.findIndex(
					(x) => x.id === result.mapping!.id
				);
				if (index >= 0) {
					folderMappings[index] = result.mapping;
				}
			}
		};

		it("should update existing mapping when saved", async () => {
			const updatedMapping: FolderMapping = {
				...folderMappings[0],
				description: "Updated Description",
				sourceFolder: "C:\\New\\Path",
				enabled: false,
			};

			await simulateEditMappingFlow({
				saved: true,
				mapping: updatedMapping,
			});

			expect(folderMappings).toHaveLength(2);
			expect(folderMappings[0].description).toBe("Updated Description");
			expect(folderMappings[0].sourceFolder).toBe("C:\\New\\Path");
			expect(folderMappings[0].enabled).toBe(false);
			// Other mapping should be unchanged
			expect(folderMappings[1].description).toBe("Another Mapping");
		});

		it("should delete mapping when deleted", async () => {
			await simulateEditMappingFlow({
				saved: false,
				deleted: true,
				mapping: folderMappings[0],
			});

			expect(folderMappings).toHaveLength(1);
			expect(folderMappings[0].id).toBe("existing-2");
		});

		it("should not change mapping when cancelled", async () => {
			const originalDescription = folderMappings[0].description;

			await simulateEditMappingFlow({
				saved: false,
			});

			expect(folderMappings).toHaveLength(2);
			expect(folderMappings[0].description).toBe(originalDescription);
		});

		it("should preserve other mappings when one is edited", async () => {
			const updatedMapping: FolderMapping = {
				...folderMappings[1],
				description: "Changed Second",
			};

			await simulateEditMappingFlow({
				saved: true,
				mapping: updatedMapping,
			});

			// First mapping unchanged
			expect(folderMappings[0].description).toBe("Original Mapping");
			// Second mapping changed
			expect(folderMappings[1].description).toBe("Changed Second");
		});
	});

	describe("Mapping deletion flow", () => {
		let folderMappings: FolderMapping[];

		beforeEach(() => {
			folderMappings = [
				{
					id: "to-delete",
					enabled: true,
					sourceFolder: "C:\\Delete\\Me",
					targetFolder: "delete/me",
					watchSubfolders: true,
					fileExtensions: [],
					conflictResolution: "keepNewer",
					debounceDelay: 800,
					description: "To Delete",
					usePolling: false,
					pollingInterval: 300,
					reconcileOnStart: true,
					syncDirection: "source-only",
				},
				{
					id: "to-keep",
					enabled: true,
					sourceFolder: "C:\\Keep\\Me",
					targetFolder: "keep/me",
					watchSubfolders: true,
					fileExtensions: [],
					conflictResolution: "keepNewer",
					debounceDelay: 800,
					description: "To Keep",
					usePolling: false,
					pollingInterval: 300,
					reconcileOnStart: true,
					syncDirection: "source-only",
				},
			];
		});

		const simulateDeleteMapping = async (
			mappingId: string,
			confirmed: boolean
		): Promise<void> => {
			// This simulates the deleteMapping logic from FileWatcherSettingTab
			if (confirmed) {
				folderMappings = folderMappings.filter((x) => x.id !== mappingId);
			}
		};

		it("should delete mapping when confirmed", async () => {
			await simulateDeleteMapping("to-delete", true);

			expect(folderMappings).toHaveLength(1);
			expect(folderMappings[0].id).toBe("to-keep");
		});

		it("should not delete mapping when cancelled", async () => {
			await simulateDeleteMapping("to-delete", false);

			expect(folderMappings).toHaveLength(2);
		});

		it("should handle deleting non-existent mapping gracefully", async () => {
			await simulateDeleteMapping("non-existent", true);

			expect(folderMappings).toHaveLength(2);
		});
	});

	describe("Mapping cloning behavior", () => {
		it("should not modify original mapping when cloning", () => {
			const original: FolderMapping = {
				id: "original",
				enabled: true,
				sourceFolder: "C:\\Original",
				targetFolder: "original",
				watchSubfolders: true,
				fileExtensions: [".md"],
				conflictResolution: "keepNewer",
				debounceDelay: 800,
				description: "Original",
				usePolling: false,
				pollingInterval: 300,
				reconcileOnStart: true,
				syncDirection: "source-only",
			};

			// Simulate what FolderMappingModal does
			const cloned = { ...original };
			cloned.description = "Modified";
			cloned.sourceFolder = "C:\\Modified";
			cloned.fileExtensions = [".txt"];

			// Original should be unchanged
			expect(original.description).toBe("Original");
			expect(original.sourceFolder).toBe("C:\\Original");
			expect(original.fileExtensions).toEqual([".md"]);

			// Clone should have new values
			expect(cloned.description).toBe("Modified");
			expect(cloned.sourceFolder).toBe("C:\\Modified");
			expect(cloned.fileExtensions).toEqual([".txt"]);
		});

		it("should handle deep array cloning for fileExtensions", () => {
			const original: FolderMapping = {
				id: "original",
				enabled: true,
				sourceFolder: "C:\\Original",
				targetFolder: "original",
				watchSubfolders: true,
				fileExtensions: [".md", ".pdf"],
				conflictResolution: "keepNewer",
				debounceDelay: 800,
				description: "Original",
				usePolling: false,
				pollingInterval: 300,
				reconcileOnStart: true,
				syncDirection: "source-only",
			};

			// Shallow clone like FolderMappingModal does
			const cloned = { ...original };

			// Note: Shallow clone shares the array reference
			// This test documents the current behavior
			cloned.fileExtensions.push(".docx");

			// Both now have the new extension (shallow clone limitation)
			// In practice, the modal replaces the array when parsing CSV input
			expect(original.fileExtensions).toContain(".docx");
			expect(cloned.fileExtensions).toContain(".docx");
		});
	});

	describe("Mapping validation", () => {
		const validateMapping = (mapping: FolderMapping): string | null => {
			if (!mapping.sourceFolder.trim()) {
				return "Source folder is required";
			}
			if (!mapping.targetFolder.trim()) {
				return "Target folder is required";
			}
			return null;
		};

		it("should reject mapping without source folder", () => {
			const mapping = createDefaultMapping();
			mapping.targetFolder = "valid/target";

			expect(validateMapping(mapping)).toBe("Source folder is required");
		});

		it("should reject mapping without target folder", () => {
			const mapping = createDefaultMapping();
			mapping.sourceFolder = "C:\\valid\\source";

			expect(validateMapping(mapping)).toBe("Target folder is required");
		});

		it("should reject mapping with whitespace-only source folder", () => {
			const mapping = createDefaultMapping();
			mapping.sourceFolder = "   ";
			mapping.targetFolder = "valid/target";

			expect(validateMapping(mapping)).toBe("Source folder is required");
		});

		it("should reject mapping with whitespace-only target folder", () => {
			const mapping = createDefaultMapping();
			mapping.sourceFolder = "C:\\valid\\source";
			mapping.targetFolder = "   ";

			expect(validateMapping(mapping)).toBe("Target folder is required");
		});

		it("should accept valid mapping", () => {
			const mapping = createDefaultMapping();
			mapping.sourceFolder = "C:\\valid\\source";
			mapping.targetFolder = "valid/target";

			expect(validateMapping(mapping)).toBeNull();
		});
	});
});
