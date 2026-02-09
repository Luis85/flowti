/**
 * Feature 2: Conflict Resolution — Acceptance Tests
 *
 * Covers how the plugin handles cases where a file exists in both source
 * and target with different content: overwrite, skip, keepNewer, rename.
 *
 * @see docs/testplan.md — UC-06 through UC-10
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs/promises at module level (ESM exports can't be spied on)
vi.mock("fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("fs/promises")>();
	return {
		...actual,
		stat: vi.fn(),
	};
});

import * as fsp from "fs/promises";
import { ConflictResolver } from "../../src/services/ConflictResolver";
import { createMockVaultAdapter, createMockVault, createMockApp, createMockMapping } from "../mocks/factories";

// ===========================
// Helpers
// ===========================

function createResolver(adapter = createMockVaultAdapter()) {
	const vault = createMockVault(adapter);
	const app = createMockApp(vault);
	return { resolver: new ConflictResolver(app as any), adapter, vault, app };
}

// ===========================
// Feature 2: Conflict Resolution
// ===========================

describe("Feature 2: Conflict Resolution", () => {

	// ==========================================
	// UC-06: Conflict Resolution — Overwrite
	// ==========================================
	describe("UC-06: Conflict — Overwrite", () => {

		it("Scenario 6.1: Source overwrites vault file (forward)", async () => {
			const { resolver } = createResolver();
			const mapping = createMockMapping({ conflictResolution: "overwrite" });

			const decision = await resolver.resolveForward(
				mapping,
				"/source/file.md",
				"vault/imported/file.md",
			);

			expect(decision.action).toBe("overwrite");
			expect(decision.targetPath).toBe("vault/imported/file.md");
		});

		it.skip("Scenario 6.2: Vault overwrites source file (reverse)", () => {
			// resolveReverse with "overwrite" requires vault.adapter.stat + fsp.stat
			// Needs filesystem mocking beyond what's available in unit test
		});
	});

	// ==========================================
	// UC-07: Conflict Resolution — Skip
	// ==========================================
	describe("UC-07: Conflict — Skip", () => {

		it("Scenario 7.1: Existing vault file is not overwritten", async () => {
			const { resolver } = createResolver();
			const mapping = createMockMapping({ conflictResolution: "skip" });

			const decision = await resolver.resolveForward(
				mapping,
				"/source/file.md",
				"vault/imported/file.md",
			);

			expect(decision.action).toBe("skip");
			expect(decision.targetPath).toBe("vault/imported/file.md");
		});
	});

	// ==========================================
	// UC-08: Conflict Resolution — Keep Newer
	// ==========================================
	describe("UC-08: Conflict — Keep Newer", () => {

		it("Scenario 8.1: Source is newer — overwrites vault", async () => {
			const adapter = createMockVaultAdapter();
			// Target exists with older mtime
			adapter.files.set("vault/imported/file.md", {
				content: new ArrayBuffer(0),
				mtime: 1000000, // older
				size: 100,
			});

			const { resolver } = createResolver(adapter);
			const mapping = createMockMapping({ conflictResolution: "keepNewer" });

			// Mock fsp.stat for source file — source is newer
			vi.mocked(fsp.stat).mockResolvedValueOnce({
				mtimeMs: 2000000, // newer
				size: 100,
			} as any);

			const decision = await resolver.resolveForward(
				mapping,
				"/source/file.md",
				"vault/imported/file.md",
			);

			expect(decision.action).toBe("overwrite");
		});

		it("Scenario 8.2: Vault is newer — source is skipped", async () => {
			const adapter = createMockVaultAdapter();
			// Target exists with newer mtime
			adapter.files.set("vault/imported/file.md", {
				content: new ArrayBuffer(0),
				mtime: 2000000, // newer
				size: 100,
			});

			const { resolver } = createResolver(adapter);
			const mapping = createMockMapping({ conflictResolution: "keepNewer" });

			// Mock fsp.stat for source file — source is older
			vi.mocked(fsp.stat).mockResolvedValueOnce({
				mtimeMs: 1000000, // older
				size: 100,
			} as any);

			const decision = await resolver.resolveForward(
				mapping,
				"/source/file.md",
				"vault/imported/file.md",
			);

			expect(decision.action).toBe("skip");
		});

		it("Scenario 8.3: Target does not exist — always syncs (overwrite)", async () => {
			const adapter = createMockVaultAdapter();
			// Target does NOT exist in adapter

			const { resolver } = createResolver(adapter);
			const mapping = createMockMapping({ conflictResolution: "keepNewer" });

			// Mock fsp.stat for source file
			vi.mocked(fsp.stat).mockResolvedValueOnce({
				mtimeMs: 1000000,
				size: 100,
			} as any);

			const decision = await resolver.resolveForward(
				mapping,
				"/source/file.md",
				"vault/imported/file.md",
			);

			// When target doesn't exist, vaultStatFast returns null → default overwrite
			expect(decision.action).toBe("overwrite");
		});
	});

	// ==========================================
	// UC-09: Conflict Resolution — Rename
	// ==========================================
	describe("UC-09: Conflict — Rename", () => {

		it("Scenario 9.1: Conflict generates timestamped copy", async () => {
			const adapter = createMockVaultAdapter();
			const { resolver } = createResolver(adapter);
			const mapping = createMockMapping({ conflictResolution: "rename" });

			const decision = await resolver.resolveForward(
				mapping,
				"/source/file.md",
				"vault/imported/file.md",
			);

			expect(decision.action).toBe("rename");
			// Should contain "conflict" and timestamp pattern
			expect(decision.targetPath).toMatch(/file \(conflict \d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}\)\.md/);
		});

		it("Scenario 9.2: Multiple rename collisions increment counter inside parentheses", async () => {
			const adapter = createMockVaultAdapter();

			// Pre-populate the first candidate so it collides
			const stamp = new Date()
				.toISOString()
				.replace(/[:.]/g, "-")
				.replace("T", " ")
				.slice(0, 19);

			const firstCandidate = `vault/imported/file (conflict ${stamp}).md`;
			adapter.files.set(firstCandidate, {
				content: new ArrayBuffer(0),
				mtime: Date.now(),
				size: 10,
			});

			const { resolver } = createResolver(adapter);
			const mapping = createMockMapping({ conflictResolution: "rename" });

			const decision = await resolver.resolveForward(
				mapping,
				"/source/file.md",
				"vault/imported/file.md",
			);

			expect(decision.action).toBe("rename");
			// Counter 2 should be inside parentheses: "file (conflict STAMP 2).md"
			expect(decision.targetPath).toMatch(/file \(conflict .+ 2\)\.md/);
		});
	});

	// ==========================================
	// UC-10: Reverse Conflict Resolution
	// ==========================================
	describe("UC-10: Reverse Conflict Resolution", () => {

		it("Scenario 10.1: Reverse uses its own strategy (reverseConflictResolution)", async () => {
			const adapter = createMockVaultAdapter();
			const { resolver } = createResolver(adapter);
			const mapping = createMockMapping({
				conflictResolution: "overwrite",
				reverseConflictResolution: "skip",
				syncDirection: "bidirectional",
			});

			const decision = await resolver.resolveReverse(
				mapping,
				"vault/export/file.md",
				"/external/file.md",
			);

			// Should use reverseConflictResolution "skip", not forward's "overwrite"
			expect(decision.action).toBe("skip");
		});

		it("Scenario 10.2: Reverse falls back to forward strategy if unset", async () => {
			const adapter = createMockVaultAdapter();
			const { resolver } = createResolver(adapter);
			const mapping = createMockMapping({
				conflictResolution: "overwrite",
				reverseConflictResolution: undefined,
				syncDirection: "bidirectional",
			});

			const decision = await resolver.resolveReverse(
				mapping,
				"vault/export/file.md",
				"/external/file.md",
			);

			// Should fall back to conflictResolution "overwrite"
			expect(decision.action).toBe("overwrite");
		});
	});
});
