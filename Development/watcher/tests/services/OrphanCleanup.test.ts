import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	createMockApp,
	createMockVaultAdapter,
	createMockVault,
	createMockMapping,
} from "../mocks/factories";

vi.mock("../../src/services/LogService", () => ({
	LogService: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { OrphanCleanup } from "../../src/services/OrphanCleanup";

describe("OrphanCleanup", () => {
	let cleanup: OrphanCleanup;
	let mockAdapter: ReturnType<typeof createMockVaultAdapter>;
	let mockVault: ReturnType<typeof createMockVault>;
	let mockApp: ReturnType<typeof createMockApp>;

	beforeEach(() => {
		mockAdapter = createMockVaultAdapter();
		mockVault = createMockVault(mockAdapter);
		mockApp = createMockApp(mockVault);
		cleanup = new OrphanCleanup(mockApp as any);
	});

	it("deletes vault files not in existingSourcePaths", async () => {
		const mapping = createMockMapping({ targetFolder: "vault/imported" });

		// Set up vault files
		mockAdapter.files.set("vault/imported/keep.md", {
			content: new ArrayBuffer(0), mtime: 1000, size: 5,
		});
		mockAdapter.files.set("vault/imported/orphan.md", {
			content: new ArrayBuffer(0), mtime: 1000, size: 5,
		});

		const existingSourcePaths = new Set(["keep.md"]);
		const result = await cleanup.cleanupOrphans(mapping, existingSourcePaths);

		expect(result.deleted).toBe(1);
		expect(result.errors).toBe(0);
		expect(mockVault.trash).toHaveBeenCalledTimes(1);
	});

	it("keeps vault files that exist in existingSourcePaths", async () => {
		const mapping = createMockMapping({ targetFolder: "vault/imported" });

		mockAdapter.files.set("vault/imported/file1.md", {
			content: new ArrayBuffer(0), mtime: 1000, size: 5,
		});
		mockAdapter.files.set("vault/imported/file2.md", {
			content: new ArrayBuffer(0), mtime: 1000, size: 5,
		});

		const existingSourcePaths = new Set(["file1.md", "file2.md"]);
		const result = await cleanup.cleanupOrphans(mapping, existingSourcePaths);

		expect(result.deleted).toBe(0);
		expect(mockVault.trash).not.toHaveBeenCalled();
	});

	it("respects fileExtensions filter (skips non-matching)", async () => {
		const mapping = createMockMapping({
			targetFolder: "vault/imported",
			fileExtensions: [".md"],
		});

		// .txt file is not in source but also not matching extension filter → skip
		mockAdapter.files.set("vault/imported/file.txt", {
			content: new ArrayBuffer(0), mtime: 1000, size: 5,
		});

		const existingSourcePaths = new Set<string>();
		const result = await cleanup.cleanupOrphans(mapping, existingSourcePaths);

		expect(result.deleted).toBe(0);
		expect(mockVault.trash).not.toHaveBeenCalled();
	});

	it("respects excludePatterns filter (skips matching globs)", async () => {
		const mapping = createMockMapping({
			targetFolder: "vault/imported",
			excludePatterns: ["*.log"],
		});

		mockAdapter.files.set("vault/imported/debug.log", {
			content: new ArrayBuffer(0), mtime: 1000, size: 5,
		});

		const existingSourcePaths = new Set<string>();
		const result = await cleanup.cleanupOrphans(mapping, existingSourcePaths);

		expect(result.deleted).toBe(0);
		expect(mockVault.trash).not.toHaveBeenCalled();
	});

	it("handles trash() failures gracefully (increments errors)", async () => {
		const mapping = createMockMapping({ targetFolder: "vault/imported" });

		mockAdapter.files.set("vault/imported/orphan.md", {
			content: new ArrayBuffer(0), mtime: 1000, size: 5,
		});

		mockVault.trash.mockRejectedValue(new Error("trash failed"));

		const existingSourcePaths = new Set<string>();
		const result = await cleanup.cleanupOrphans(mapping, existingSourcePaths);

		expect(result.errors).toBe(1);
		expect(result.deleted).toBe(0);
	});

	it("returns { deleted: 0, errors: 0 } for empty vault folder", async () => {
		const mapping = createMockMapping({ targetFolder: "vault/empty" });
		// No files in vault

		const existingSourcePaths = new Set<string>();
		const result = await cleanup.cleanupOrphans(mapping, existingSourcePaths);

		expect(result).toEqual({ deleted: 0, errors: 0 });
	});

	it("walks nested subdirectories recursively", async () => {
		const mapping = createMockMapping({ targetFolder: "vault/imported" });

		// Override list to return scoped results (immediate children only)
		mockAdapter.list.mockImplementation(async (p: string) => {
			if (p === "vault/imported") {
				return { files: [], folders: ["vault/imported/sub"] };
			}
			if (p === "vault/imported/sub") {
				return { files: ["vault/imported/sub/orphan.md"], folders: [] };
			}
			return { files: [], folders: [] };
		});

		// Ensure getAbstractFileByPath returns a file object for orphan
		mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === "vault/imported/sub/orphan.md") {
				return { path, name: "orphan.md" };
			}
			return null;
		});

		const existingSourcePaths = new Set<string>();
		const result = await cleanup.cleanupOrphans(mapping, existingSourcePaths);

		expect(result.deleted).toBe(1);
	});

	it("handles adapter.list() errors in subdirectories", async () => {
		const mapping = createMockMapping({ targetFolder: "vault/imported" });

		mockAdapter.folders.add("vault/imported/broken");
		// Make list throw for the broken folder
		const originalList = mockAdapter.list.getMockImplementation()!;
		mockAdapter.list.mockImplementation(async (p: string) => {
			if (p === "vault/imported/broken") throw new Error("list failed");
			return originalList(p);
		});

		// File in root should still be processed
		mockAdapter.files.set("vault/imported/orphan.md", {
			content: new ArrayBuffer(0), mtime: 1000, size: 5,
		});

		const existingSourcePaths = new Set<string>();
		const result = await cleanup.cleanupOrphans(mapping, existingSourcePaths);

		expect(result.deleted).toBe(1);
		expect(result.errors).toBe(0);
	});

	it("skips files where getAbstractFileByPath returns null", async () => {
		const mapping = createMockMapping({ targetFolder: "vault/imported" });

		mockAdapter.files.set("vault/imported/orphan.md", {
			content: new ArrayBuffer(0), mtime: 1000, size: 5,
		});

		// Override getAbstractFileByPath to return null
		mockVault.getAbstractFileByPath.mockReturnValue(null);

		const existingSourcePaths = new Set<string>();
		const result = await cleanup.cleanupOrphans(mapping, existingSourcePaths);

		// File was found as orphan but getAbstractFileByPath returned null → not trashed
		expect(result.deleted).toBe(0);
		expect(mockVault.trash).not.toHaveBeenCalled();
	});
});
