/**
 * Tests for bidirectional reconciliation reverse sync.
 *
 * Bug fix: In bidirectional mode with deletion handling enabled,
 * files created in the vault were not being reverse-synced to the
 * source folder during reconciliation. Orphan cleanup then deleted
 * them because they had no source counterpart.
 *
 * The fix adds a reverse reconciliation step before orphan cleanup
 * that syncs vault-only files to the source folder.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	createMockApp,
	createMockSettings,
	createMockMapping,
	createMockVaultAdapter,
	createMockVault,
} from "../mocks/factories";

// Create mock filesystem data using vi.hoisted so mocks can access them
const { mockFiles, mockDirs } = vi.hoisted(() => ({
	mockFiles: new Map<string, { content: Buffer; mtime: number; size: number }>(),
	mockDirs: new Set<string>(),
}));

// Mock the fs module
vi.mock("fs", () => ({
	existsSync: vi.fn((p: string) => mockFiles.has(p) || mockDirs.has(p)),
	statSync: vi.fn((p: string) => {
		const file = mockFiles.get(p);
		if (!file) throw new Error(`ENOENT: no such file: ${p}`);
		return { mtimeMs: file.mtime, size: file.size, isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false };
	}),
	lstatSync: vi.fn((p: string) => {
		const file = mockFiles.get(p);
		if (!file) {
			if (mockDirs.has(p)) return { isSymbolicLink: () => false };
			throw new Error(`ENOENT: no such file: ${p}`);
		}
		return { isSymbolicLink: () => false };
	}),
	readdirSync: vi.fn(() => []),
}));

// Mock fs/promises with proper readdir that returns Dirent-like objects
vi.mock("fs/promises", () => ({
	readFile: vi.fn(async (p: string) => {
		const file = mockFiles.get(p);
		if (!file) throw new Error(`ENOENT: no such file or directory, open '${p}'`);
		return file.content;
	}),
	stat: vi.fn(async (p: string) => {
		const file = mockFiles.get(p);
		if (!file) throw new Error(`ENOENT: no such file or directory, stat '${p}'`);
		return { mtimeMs: file.mtime, size: file.size, isFile: () => true, isDirectory: () => false };
	}),
	access: vi.fn(async (p: string) => {
		if (!mockFiles.has(p) && !mockDirs.has(p)) {
			throw new Error(`ENOENT: no such file or directory, access '${p}'`);
		}
	}),
	writeFile: vi.fn(async () => {}),
	mkdir: vi.fn(async () => {}),
	rename: vi.fn(async () => {}),
	readdir: vi.fn(async (dirPath: string) => {
		const entries: any[] = [];
		const seen = new Set<string>();
		const prefix = dirPath.endsWith("/") || dirPath.endsWith("\\") ? dirPath : dirPath + "/";

		for (const [filePath] of mockFiles) {
			// Normalize to forward slashes for comparison
			const normalizedFile = filePath.replace(/\\/g, "/");
			const normalizedPrefix = prefix.replace(/\\/g, "/");

			if (normalizedFile.startsWith(normalizedPrefix)) {
				const rest = normalizedFile.slice(normalizedPrefix.length);
				const firstPart = rest.split(/[/\\]/)[0];
				if (!seen.has(firstPart)) {
					seen.add(firstPart);
					const isDir = rest.includes("/") || rest.includes("\\");
					if (!isDir) {
						entries.push({
							name: firstPart,
							isFile: () => true,
							isDirectory: () => false,
						});
					}
				}
			}
		}

		for (const dp of mockDirs) {
			const normalizedDir = dp.replace(/\\/g, "/");
			const normalizedPrefix = prefix.replace(/\\/g, "/");

			if (normalizedDir.startsWith(normalizedPrefix)) {
				const rest = normalizedDir.slice(normalizedPrefix.length);
				const firstPart = rest.split(/[/\\]/)[0];
				if (firstPart && !seen.has(firstPart)) {
					seen.add(firstPart);
					entries.push({
						name: firstPart,
						isFile: () => false,
						isDirectory: () => true,
					});
				}
			}
		}

		// Also detect implicit directories from file paths
		for (const [filePath] of mockFiles) {
			const normalizedFile = filePath.replace(/\\/g, "/");
			const normalizedPrefix = prefix.replace(/\\/g, "/");

			if (normalizedFile.startsWith(normalizedPrefix)) {
				const rest = normalizedFile.slice(normalizedPrefix.length);
				if (rest.includes("/")) {
					const firstPart = rest.split("/")[0];
					if (!seen.has(firstPart)) {
						seen.add(firstPart);
						entries.push({
							name: firstPart,
							isFile: () => false,
							isDirectory: () => true,
						});
					}
				}
			}
		}

		return entries;
	}),
}));

// Mock LogService
vi.mock("../../src/services/DebugService", () => ({
	Debug: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), setEnabled: vi.fn() },
}));

import { FileSyncService } from "../../src/services/FileSyncService";
import * as fsp from "fs/promises";

function setupMockFile(p: string, content: string, mtime = Date.now()) {
	const buffer = Buffer.from(content);
	mockFiles.set(p, { content: buffer, mtime, size: buffer.length });
}

function clearMockFs() {
	mockFiles.clear();
	mockDirs.clear();
}

const SOURCE_ROOT = "C:\\source";

describe("FileSyncService — bidirectional reconciliation", () => {
	let service: FileSyncService;
	let mockAdapter: ReturnType<typeof createMockVaultAdapter>;
	let mockVault: ReturnType<typeof createMockVault>;
	let mockApp: ReturnType<typeof createMockApp>;

	beforeEach(() => {
		clearMockFs();

		mockAdapter = createMockVaultAdapter();
		mockVault = createMockVault(mockAdapter);
		mockApp = createMockApp(mockVault);
		const mockSettings = createMockSettings({
			reconcile: {
				parallelism: 1,
				progressThrottleMs: 0,
				fastSkipUnchanged: false,
				disableStabilityCheckDuringReconcile: true,
				notifyOnMappingDone: false,
				incrementalMode: false,
			},
		});

		service = new FileSyncService(mockApp as any, mockSettings as any);
	});

	afterEach(() => {
		service.destroy();
		vi.clearAllMocks();
	});

	it("should reverse-sync vault-only files to source in bidirectional mode", async () => {
		// Source has one file
		mockDirs.add(SOURCE_ROOT);
		setupMockFile("C:\\source\\source-file.md", "from source");

		// Vault has the synced file AND a vault-only file
		const sourceContent = Buffer.from("from source");
		mockAdapter.files.set("vault/imported/source-file.md", {
			content: sourceContent.buffer.slice(0) as ArrayBuffer,
			mtime: Date.now(),
			size: sourceContent.length,
		});

		const vaultOnlyContent = Buffer.from("created in vault");
		mockAdapter.files.set("vault/imported/vault-only.md", {
			content: vaultOnlyContent.buffer.slice(0) as ArrayBuffer,
			mtime: Date.now(),
			size: vaultOnlyContent.length,
		});

		const mapping = createMockMapping({
			sourceFolder: SOURCE_ROOT,
			targetFolder: "vault/imported",
			syncDirection: "bidirectional",
			deletionHandling: "trash",
			watchSubfolders: true,
		});

		const stats = await service.reconcileMapping(mapping as any);

		// vault-only.md should have been reverse-synced (written to external)
		const writeFileCalls = vi.mocked(fsp.writeFile).mock.calls;
		const reverseWritePaths = writeFileCalls.map(c => String(c[0]).replace(/\\/g, "/"));
		expect(reverseWritePaths).toContain("C:/source/vault-only.md");

		// vault-only.md should NOT have been trashed
		expect(mockVault.trash).not.toHaveBeenCalled();

		// Stats should include the reverse-synced file
		expect(stats.processed).toBeGreaterThanOrEqual(1);
		expect(stats.deleted).toBe(0);
	});

	it("should NOT delete vault-only files during orphan cleanup in bidirectional mode", async () => {
		// Source is empty
		mockDirs.add(SOURCE_ROOT);

		// Vault has files that only exist in vault
		const vaultContent = Buffer.from("vault content");
		mockAdapter.files.set("vault/imported/only-in-vault.md", {
			content: vaultContent.buffer.slice(0) as ArrayBuffer,
			mtime: Date.now(),
			size: vaultContent.length,
		});

		const mapping = createMockMapping({
			sourceFolder: SOURCE_ROOT,
			targetFolder: "vault/imported",
			syncDirection: "bidirectional",
			deletionHandling: "trash",
			watchSubfolders: true,
		});

		const stats = await service.reconcileMapping(mapping as any);

		// File should be reverse-synced, NOT trashed
		expect(mockVault.trash).not.toHaveBeenCalled();

		// Should have been written to source
		const writeFileCalls = vi.mocked(fsp.writeFile).mock.calls;
		const reverseWritePaths = writeFileCalls.map(c => String(c[0]).replace(/\\/g, "/"));
		expect(reverseWritePaths).toContain("C:/source/only-in-vault.md");

		expect(stats.deleted).toBe(0);
	});

	it("should still delete genuine orphans in source-only mode", async () => {
		// Source has one file
		mockDirs.add(SOURCE_ROOT);
		setupMockFile("C:\\source\\remaining.md", "still here");

		// Vault has remaining + an orphan whose source was deleted
		const remainingContent = Buffer.from("still here");
		mockAdapter.files.set("vault/imported/remaining.md", {
			content: remainingContent.buffer.slice(0) as ArrayBuffer,
			mtime: Date.now(),
			size: remainingContent.length,
		});

		const orphanContent = Buffer.from("orphaned");
		mockAdapter.files.set("vault/imported/deleted-from-source.md", {
			content: orphanContent.buffer.slice(0) as ArrayBuffer,
			mtime: Date.now(),
			size: orphanContent.length,
		});

		const mapping = createMockMapping({
			sourceFolder: SOURCE_ROOT,
			targetFolder: "vault/imported",
			syncDirection: "source-only",
			deletionHandling: "trash",
			watchSubfolders: true,
		});

		const stats = await service.reconcileMapping(mapping as any);

		// Orphan should have been trashed (source-only mode, no reverse reconciliation)
		expect(mockVault.trash).toHaveBeenCalledTimes(1);
		expect(stats.deleted).toBe(1);
	});

	it("should NOT reverse-sync in source-only mode", async () => {
		// Source is empty
		mockDirs.add(SOURCE_ROOT);

		// Vault has a file
		const vaultContent = Buffer.from("vault content");
		mockAdapter.files.set("vault/imported/file.md", {
			content: vaultContent.buffer.slice(0) as ArrayBuffer,
			mtime: Date.now(),
			size: vaultContent.length,
		});

		const mapping = createMockMapping({
			sourceFolder: SOURCE_ROOT,
			targetFolder: "vault/imported",
			syncDirection: "source-only",
			deletionHandling: "trash",
			watchSubfolders: true,
		});

		await service.reconcileMapping(mapping as any);

		// Should NOT have written anything to external (no reverse sync)
		expect(vi.mocked(fsp.writeFile)).not.toHaveBeenCalled();
	});

	it("should reverse-sync multiple vault-only files", async () => {
		// Source is empty
		mockDirs.add(SOURCE_ROOT);

		// Vault has multiple files
		for (const name of ["a.md", "b.md", "c.md"]) {
			const content = Buffer.from(`Content of ${name}`);
			mockAdapter.files.set(`vault/imported/${name}`, {
				content: content.buffer.slice(0) as ArrayBuffer,
				mtime: Date.now(),
				size: content.length,
			});
		}

		const mapping = createMockMapping({
			sourceFolder: SOURCE_ROOT,
			targetFolder: "vault/imported",
			syncDirection: "bidirectional",
			deletionHandling: "trash",
			watchSubfolders: true,
		});

		const stats = await service.reconcileMapping(mapping as any);

		// All 3 files should have been reverse-synced
		const writeFileCalls = vi.mocked(fsp.writeFile).mock.calls;
		const reverseWritePaths = writeFileCalls.map(c => String(c[0]).replace(/\\/g, "/"));
		expect(reverseWritePaths).toContain("C:/source/a.md");
		expect(reverseWritePaths).toContain("C:/source/b.md");
		expect(reverseWritePaths).toContain("C:/source/c.md");

		// None should have been trashed
		expect(mockVault.trash).not.toHaveBeenCalled();
		expect(stats.deleted).toBe(0);
		expect(stats.processed).toBeGreaterThanOrEqual(3);
	});

	it("should reverse-sync even when deletionHandling is ignore", async () => {
		// Source is empty
		mockDirs.add(SOURCE_ROOT);

		// Vault has a file
		const vaultContent = Buffer.from("vault content");
		mockAdapter.files.set("vault/imported/file.md", {
			content: vaultContent.buffer.slice(0) as ArrayBuffer,
			mtime: Date.now(),
			size: vaultContent.length,
		});

		const mapping = createMockMapping({
			sourceFolder: SOURCE_ROOT,
			targetFolder: "vault/imported",
			syncDirection: "bidirectional",
			deletionHandling: "ignore",
			watchSubfolders: true,
		});

		const stats = await service.reconcileMapping(mapping as any);

		// Should still reverse-sync even without deletion handling
		const writeFileCalls = vi.mocked(fsp.writeFile).mock.calls;
		const reverseWritePaths = writeFileCalls.map(c => String(c[0]).replace(/\\/g, "/"));
		expect(reverseWritePaths).toContain("C:/source/file.md");

		// No orphan cleanup should run (deletionHandling=ignore)
		expect(mockVault.trash).not.toHaveBeenCalled();
		expect(stats.deleted).toBe(0);
	});

	it("should respect file extension filters during reverse reconciliation", async () => {
		// Source is empty
		mockDirs.add(SOURCE_ROOT);

		// Vault has .md and .txt files
		const mdContent = Buffer.from("markdown");
		mockAdapter.files.set("vault/imported/doc.md", {
			content: mdContent.buffer.slice(0) as ArrayBuffer,
			mtime: Date.now(),
			size: mdContent.length,
		});

		const txtContent = Buffer.from("text file");
		mockAdapter.files.set("vault/imported/notes.txt", {
			content: txtContent.buffer.slice(0) as ArrayBuffer,
			mtime: Date.now(),
			size: txtContent.length,
		});

		const mapping = createMockMapping({
			sourceFolder: SOURCE_ROOT,
			targetFolder: "vault/imported",
			syncDirection: "bidirectional",
			deletionHandling: "trash",
			fileExtensions: [".md"],  // Only .md files
			watchSubfolders: true,
		});

		await service.reconcileMapping(mapping as any);

		// Only .md should be reverse-synced
		const writeFileCalls = vi.mocked(fsp.writeFile).mock.calls;
		const reverseWritePaths = writeFileCalls.map(c => String(c[0]).replace(/\\/g, "/"));
		expect(reverseWritePaths).toContain("C:/source/doc.md");
		expect(reverseWritePaths).not.toContain("C:/source/notes.txt");
	});
});
