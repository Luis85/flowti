import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	createMockApp,
	createMockVaultAdapter,
	createMockVault,
	createMockMapping,
} from "../mocks/factories";

// Mock fs/promises for external file stat/access
const { mockFiles } = vi.hoisted(() => ({
	mockFiles: new Map<string, { mtimeMs: number; size: number }>(),
}));

vi.mock("fs", () => ({
	existsSync: vi.fn(() => false),
	statSync: vi.fn(),
	lstatSync: vi.fn(),
}));

vi.mock("fs/promises", () => ({
	stat: vi.fn(async (p: string) => {
		const f = mockFiles.get(p);
		if (!f) throw new Error(`ENOENT: ${p}`);
		return { mtimeMs: f.mtimeMs, size: f.size, isFile: () => true };
	}),
	access: vi.fn(async (p: string) => {
		if (!mockFiles.has(p)) throw new Error(`ENOENT: ${p}`);
	}),
}));

import { ConflictResolver } from "../../src/services/ConflictResolver";

describe("ConflictResolver", () => {
	let resolver: ConflictResolver;
	let mockAdapter: ReturnType<typeof createMockVaultAdapter>;
	let mockApp: ReturnType<typeof createMockApp>;

	beforeEach(() => {
		mockFiles.clear();
		mockAdapter = createMockVaultAdapter();
		const mockVault = createMockVault(mockAdapter);
		mockApp = createMockApp(mockVault);
		resolver = new ConflictResolver(mockApp as any);
	});

	// ===========================
	// resolveForward (source → vault)
	// ===========================
	describe("resolveForward", () => {
		it("returns overwrite when strategy is overwrite", async () => {
			const mapping = createMockMapping({ conflictResolution: "overwrite" });
			const result = await resolver.resolveForward(mapping, "/src/f.md", "target/f.md");
			expect(result).toEqual({ action: "overwrite", targetPath: "target/f.md" });
		});

		it("returns skip when strategy is skip", async () => {
			const mapping = createMockMapping({ conflictResolution: "skip" });
			const result = await resolver.resolveForward(mapping, "/src/f.md", "target/f.md");
			expect(result).toEqual({ action: "skip", targetPath: "target/f.md" });
		});

		it("keepNewer — overwrite when source is newer", async () => {
			const mapping = createMockMapping({ conflictResolution: "keepNewer" });
			mockFiles.set("/src/f.md", { mtimeMs: 2000, size: 10 });
			// Vault file is older
			mockAdapter.files.set("target/f.md", {
				content: new ArrayBuffer(0),
				mtime: 1000,
				size: 10,
			});

			const result = await resolver.resolveForward(mapping, "/src/f.md", "target/f.md");
			expect(result.action).toBe("overwrite");
		});

		it("keepNewer — skip when target is newer", async () => {
			const mapping = createMockMapping({ conflictResolution: "keepNewer" });
			mockFiles.set("/src/f.md", { mtimeMs: 1000, size: 10 });
			mockAdapter.files.set("target/f.md", {
				content: new ArrayBuffer(0),
				mtime: 2000,
				size: 10,
			});

			const result = await resolver.resolveForward(mapping, "/src/f.md", "target/f.md");
			expect(result.action).toBe("skip");
		});

		it("keepNewer — overwrite when target stat is null", async () => {
			const mapping = createMockMapping({ conflictResolution: "keepNewer" });
			mockFiles.set("/src/f.md", { mtimeMs: 1000, size: 10 });
			// No vault file → stat returns null → default overwrite

			const result = await resolver.resolveForward(mapping, "/src/f.md", "target/f.md");
			expect(result.action).toBe("overwrite");
		});

		it("keepNewer — uses TargetIndex cache when provided", async () => {
			const mapping = createMockMapping({ conflictResolution: "keepNewer" });
			mockFiles.set("/src/f.md", { mtimeMs: 2000, size: 10 });

			const targetIndex = {
				exists: new Set(["target/f.md"]),
				statByPath: new Map([["target/f.md", { mtimeMs: 1000, size: 10 }]]),
			};

			const result = await resolver.resolveForward(mapping, "/src/f.md", "target/f.md", targetIndex);
			expect(result.action).toBe("overwrite");
			// adapter.stat should NOT have been called — cache was used
			expect(mockAdapter.stat).not.toHaveBeenCalled();
		});

		it("rename — returns conflict filename with timestamp", async () => {
			const mapping = createMockMapping({ conflictResolution: "rename" });
			// First candidate won't exist in vault

			const result = await resolver.resolveForward(mapping, "/src/f.md", "target/f.md");
			expect(result.action).toBe("rename");
			expect(result.targetPath).toMatch(/target\/f \(conflict \d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}\)\.md/);
		});

		it("rename — increments suffix when first candidate exists", async () => {
			const mapping = createMockMapping({ conflictResolution: "rename" });

			// Make adapter.exists return true for first candidate, false for second
			let callCount = 0;
			mockAdapter.exists.mockImplementation(async () => {
				callCount++;
				return callCount <= 1; // first call: exists, second: doesn't
			});

			const result = await resolver.resolveForward(mapping, "/src/f.md", "target/f.md");
			expect(result.action).toBe("rename");
			// Should have suffix " 2" because first candidate existed
			expect(result.targetPath).toMatch(/\(conflict .+ 2\)\.md$/);
		});
	});

	// ===========================
	// resolveReverse (vault → source)
	// ===========================
	describe("resolveReverse", () => {
		it("returns overwrite when strategy is overwrite", async () => {
			const mapping = createMockMapping({ conflictResolution: "overwrite" });
			const result = await resolver.resolveReverse(mapping, "vault/f.md", "/ext/f.md");
			expect(result).toEqual({ action: "overwrite", targetPath: "/ext/f.md" });
		});

		it("returns skip when strategy is skip", async () => {
			const mapping = createMockMapping({ conflictResolution: "skip" });
			const result = await resolver.resolveReverse(mapping, "vault/f.md", "/ext/f.md");
			expect(result).toEqual({ action: "skip", targetPath: "/ext/f.md" });
		});

		it("uses reverseConflictResolution when set", async () => {
			const mapping = createMockMapping({
				conflictResolution: "overwrite",
				reverseConflictResolution: "skip",
			});
			const result = await resolver.resolveReverse(mapping, "vault/f.md", "/ext/f.md");
			expect(result.action).toBe("skip");
		});

		it("falls back to conflictResolution when reverse not set", async () => {
			const mapping = createMockMapping({
				conflictResolution: "skip",
				reverseConflictResolution: undefined,
			});
			const result = await resolver.resolveReverse(mapping, "vault/f.md", "/ext/f.md");
			expect(result.action).toBe("skip");
		});

		it("keepNewer — overwrite when vault is newer", async () => {
			const mapping = createMockMapping({ conflictResolution: "keepNewer" });
			// Vault file is newer
			mockAdapter.files.set("vault/f.md", {
				content: new ArrayBuffer(0),
				mtime: 2000,
				size: 10,
			});
			// External file is older
			mockFiles.set("/ext/f.md", { mtimeMs: 1000, size: 10 });

			const result = await resolver.resolveReverse(mapping, "vault/f.md", "/ext/f.md");
			expect(result.action).toBe("overwrite");
		});

		it("keepNewer — skip when external is newer", async () => {
			const mapping = createMockMapping({ conflictResolution: "keepNewer" });
			mockAdapter.files.set("vault/f.md", {
				content: new ArrayBuffer(0),
				mtime: 1000,
				size: 10,
			});
			mockFiles.set("/ext/f.md", { mtimeMs: 2000, size: 10 });

			const result = await resolver.resolveReverse(mapping, "vault/f.md", "/ext/f.md");
			expect(result.action).toBe("skip");
		});

		it("keepNewer — overwrite when external doesn't exist", async () => {
			const mapping = createMockMapping({ conflictResolution: "keepNewer" });
			mockAdapter.files.set("vault/f.md", {
				content: new ArrayBuffer(0),
				mtime: 2000,
				size: 10,
			});
			// No external file → fsp.stat throws → overwrite

			const result = await resolver.resolveReverse(mapping, "vault/f.md", "/ext/f.md");
			expect(result.action).toBe("overwrite");
		});

		it("keepNewer — skip when vault stat is null", async () => {
			const mapping = createMockMapping({ conflictResolution: "keepNewer" });
			// No vault file → adapter.stat returns null → skip
			mockFiles.set("/ext/f.md", { mtimeMs: 1000, size: 10 });

			const result = await resolver.resolveReverse(mapping, "vault/f.md", "/ext/f.md");
			expect(result.action).toBe("skip");
		});

		it("rename — generates unique external conflict filename", async () => {
			const mapping = createMockMapping({ conflictResolution: "rename" });
			// fsp.access will throw for non-existing → candidate is free

			const result = await resolver.resolveReverse(mapping, "vault/f.md", "/ext/f.md");
			expect(result.action).toBe("rename");
			expect(result.targetPath).toContain("(conflict");
			expect(result.targetPath).toMatch(/\.md$/);
		});
	});
});
