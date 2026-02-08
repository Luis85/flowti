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
		if (!file) throw new Error(`ENOENT: no such file: ${p}`);
		return { isSymbolicLink: () => false };
	}),
	readdirSync: vi.fn(() => []),
}));

// Mock fs/promises
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
	readdir: vi.fn(async () => []),
}));

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

describe("FileSyncService reverse sync", () => {
	let service: FileSyncService;
	let mockAdapter: ReturnType<typeof createMockVaultAdapter>;
	let mockApp: ReturnType<typeof createMockApp>;

	beforeEach(() => {
		clearMockFs();

		mockAdapter = createMockVaultAdapter();
		const mockVault = createMockVault(mockAdapter);
		// Add trash mock
		(mockVault as any).trash = vi.fn().mockResolvedValue(undefined);
		mockApp = createMockApp(mockVault);
		const mockSettings = createMockSettings();

		service = new FileSyncService(mockApp as any, mockSettings as any);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("syncFileReverse", () => {
		it("should write vault content to external path", async () => {
			const mapping = createMockMapping({
				sourceFolder: "C:\\source",
				targetFolder: "vault/imported",
				syncDirection: "vault-only",
			});

			// Set up vault file
			const vaultContent = Buffer.from("# Hello from vault");
			mockAdapter.files.set("vault/imported/file.md", {
				content: vaultContent.buffer.slice(0) as ArrayBuffer,
				mtime: Date.now(),
				size: vaultContent.length,
			});

			const result = await service.syncFileReverse(mapping as any, "vault/imported/file.md");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.action).toBe("processed");
			}
			expect(vi.mocked(fsp.writeFile)).toHaveBeenCalled();
		});

		it("should skip when recently synced (loop prevention)", async () => {
			const mapping = createMockMapping({
				sourceFolder: "C:\\source",
				targetFolder: "vault/imported",
			});

			// Set up vault file
			const vaultContent = Buffer.from("content");
			mockAdapter.files.set("vault/imported/file.md", {
				content: vaultContent.buffer.slice(0) as ArrayBuffer,
				mtime: Date.now(),
				size: vaultContent.length,
			});

			// First sync to record the path
			await service.syncFileReverse(mapping as any, "vault/imported/file.md");

			// Second sync should be skipped
			const result = await service.syncFileReverse(mapping as any, "vault/imported/file.md");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.action).toBe("skipped");
				expect(result.reason).toBe("loop_prevention");
			}
		});

		it("should respect conflict resolution skip", async () => {
			const mapping = createMockMapping({
				sourceFolder: "C:\\source",
				targetFolder: "vault/imported",
				conflictResolution: "skip",
			});

			// Set up vault file
			const vaultContent = Buffer.from("vault content");
			mockAdapter.files.set("vault/imported/file.md", {
				content: vaultContent.buffer.slice(0) as ArrayBuffer,
				mtime: Date.now(),
				size: vaultContent.length,
			});

			// Set up existing external file (creates conflict)
			setupMockFile("C:\\source\\file.md", "existing external content");

			const result = await service.syncFileReverse(mapping as any, "vault/imported/file.md");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.action).toBe("skipped");
				expect(result.reason).toBe("conflict_skip");
			}
		});
	});

	describe("syncDeleteReverse", () => {
		it("should move source file to .sync-trash/", async () => {
			const mapping = createMockMapping({
				sourceFolder: "C:\\source",
				targetFolder: "vault/imported",
				deletionHandling: "trash",
			});

			// Source file exists
			setupMockFile("C:\\source\\file.md", "content to trash");

			const result = await service.syncDeleteReverse(mapping as any, "vault/imported/file.md");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.action).toBe("deleted");
			}
			expect(vi.mocked(fsp.rename)).toHaveBeenCalled();
			expect(vi.mocked(fsp.mkdir)).toHaveBeenCalled();
		});

		it("should skip when source not found", async () => {
			const mapping = createMockMapping({
				sourceFolder: "C:\\source",
				targetFolder: "vault/imported",
			});

			// No source file set up

			const result = await service.syncDeleteReverse(mapping as any, "vault/imported/file.md");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.action).toBe("skipped");
				expect(result.reason).toBe("source_not_found");
			}
		});

		it("should skip when recently synced (loop prevention)", async () => {
			const mapping = createMockMapping({
				sourceFolder: "C:\\source",
				targetFolder: "vault/imported",
			});

			setupMockFile("C:\\source\\file.md", "content");

			// First delete to record the sync
			await service.syncDeleteReverse(mapping as any, "vault/imported/file.md");

			// Re-add the file and try again
			setupMockFile("C:\\source\\file.md", "content");

			const result = await service.syncDeleteReverse(mapping as any, "vault/imported/file.md");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.action).toBe("skipped");
				expect(result.reason).toBe("loop_prevention");
			}
		});

		it("should handle name collision in trash with timestamp suffix", async () => {
			const mapping = createMockMapping({
				sourceFolder: "C:\\source",
				targetFolder: "vault/imported",
			});

			// Source file exists
			setupMockFile("C:\\source\\file.md", "content");

			// Simulate trash file already exists by making access succeed for the trash path
			const mockAccess = vi.mocked(fsp.access);
			const originalImpl = mockAccess.getMockImplementation()!;
			let accessCallCount = 0;
			mockAccess.mockImplementation(async (p: string) => {
				accessCallCount++;
				// First call checks source (should pass), second checks trash (should pass = collision)
				if (typeof p === "string" && p.includes(".sync-trash") && accessCallCount <= 3) {
					return; // Trash file "exists"
				}
				return originalImpl(p as any);
			});

			const result = await service.syncDeleteReverse(mapping as any, "vault/imported/file.md");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.action).toBe("deleted");
			}
		});
	});
});
