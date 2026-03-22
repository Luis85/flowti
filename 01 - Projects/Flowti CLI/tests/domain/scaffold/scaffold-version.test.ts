import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
	hashContent,
	buildFileHashes,
	createManifest,
	diffScaffold,
	markConflict,
	resolveUpdates,
	type ScaffoldManifest,
} from "../../../src/domain/scaffold/scaffold-version.js";
import type { FileEntry } from "../../../src/domain/scaffold/scaffold-types.js";

const testClock = { clock: { iso: () => "2026-03-09", now: () => new Date(), ms: () => 0, safeIso: () => "2026-03-09" } };

function sha256(s: string): string {
	return createHash("sha256").update(s).digest("hex");
}

// ── hashContent ─────────────────────────────────────────────────────

describe("hashContent", () => {
	it("returns SHA-256 hex digest", () => {
		expect(hashContent("hello")).toBe(sha256("hello"));
	});

	it("returns different hashes for different content", () => {
		expect(hashContent("a")).not.toBe(hashContent("b"));
	});

	it("handles empty string", () => {
		expect(hashContent("")).toBe(sha256(""));
	});
});

// ── buildFileHashes ─────────────────────────────────────────────────

describe("buildFileHashes", () => {
	it("builds hash map from file entries", () => {
		const files: FileEntry[] = [
			{ path: "src/main.ts", content: "export default 1;" },
			{ path: "package.json", content: "{}" },
		];
		const hashes = buildFileHashes(files);
		expect(hashes["src/main.ts"]).toBe(sha256("export default 1;"));
		expect(hashes["package.json"]).toBe(sha256("{}"));
	});

	it("returns empty map for no files", () => {
		expect(buildFileHashes([])).toEqual({});
	});
});

// ── createManifest ──────────────────────────────────────────────────

describe("createManifest", () => {
	it("creates manifest with definition ID and file hashes", () => {
		const files: FileEntry[] = [{ path: "a.ts", content: "x" }];
		const manifest = createManifest(testClock, "my-def", files);
		expect(manifest.definitionId).toBe("my-def");
		expect(manifest.fileHashes["a.ts"]).toBe(sha256("x"));
		expect(manifest.createdAt).toBeTruthy();
	});
});

// ── diffScaffold ────────────────────────────────────────────────────

describe("diffScaffold", () => {
	const manifest: ScaffoldManifest = {
		definitionId: "test-def",
		createdAt: "2026-01-01T00:00:00Z",
		fileHashes: {
			"a.ts": sha256("original-a"),
			"b.ts": sha256("original-b"),
			"c.ts": sha256("original-c"),
		},
	};

	it("detects unchanged files", () => {
		const newPlan: FileEntry[] = [
			{ path: "a.ts", content: "original-a" }, // template unchanged
		];
		const currentFiles = { "a.ts": "original-a" };
		const result = diffScaffold(manifest, newPlan, currentFiles);
		expect(result.fileDiffs[0].status).toBe("unchanged");
		expect(result.hasChanges).toBe(true); // b.ts and c.ts are removed
	});

	it("detects modified files (user hasn't changed, template updated)", () => {
		const newPlan: FileEntry[] = [
			{ path: "a.ts", content: "updated-a" }, // template changed
		];
		const currentFiles = { "a.ts": "original-a" }; // user hasn't changed
		const result = diffScaffold(manifest, newPlan, currentFiles);
		const diff = result.fileDiffs.find((d) => d.path === "a.ts");
		expect(diff?.status).toBe("modified");
		expect(diff?.templateContent).toBe("updated-a");
	});

	it("detects conflicts (user changed + template changed)", () => {
		const newPlan: FileEntry[] = [
			{ path: "a.ts", content: "updated-a" },
		];
		const currentFiles = { "a.ts": "user-modified-a" }; // user has changed
		const result = diffScaffold(manifest, newPlan, currentFiles);
		const diff = result.fileDiffs.find((d) => d.path === "a.ts");
		expect(diff?.status).toBe("conflict");
	});

	it("detects added files (new in template)", () => {
		const newPlan: FileEntry[] = [
			{ path: "new.ts", content: "new content" },
		];
		const result = diffScaffold(manifest, newPlan, {});
		const diff = result.fileDiffs.find((d) => d.path === "new.ts");
		expect(diff?.status).toBe("added");
	});

	it("detects removed files (no longer in template)", () => {
		const newPlan: FileEntry[] = []; // all files removed from definition
		const result = diffScaffold(manifest, newPlan, { "a.ts": "x" });
		const removed = result.fileDiffs.filter((d) => d.status === "removed");
		expect(removed).toHaveLength(3); // a.ts, b.ts, c.ts
	});

	it("generates summary string", () => {
		const newPlan: FileEntry[] = [
			{ path: "a.ts", content: "updated-a" },
			{ path: "b.ts", content: "original-b" },
			{ path: "d.ts", content: "new" },
		];
		const currentFiles = { "a.ts": "original-a", "b.ts": "original-b" };
		const result = diffScaffold(manifest, newPlan, currentFiles);
		expect(result.summary).toContain("modified");
		expect(result.summary).toContain("added");
		expect(result.summary).toContain("removed"); // c.ts
	});

	it("returns no changes when plan matches exactly", () => {
		const newPlan: FileEntry[] = [
			{ path: "a.ts", content: "original-a" },
			{ path: "b.ts", content: "original-b" },
			{ path: "c.ts", content: "original-c" },
		];
		const currentFiles = { "a.ts": "original-a", "b.ts": "original-b", "c.ts": "original-c" };
		const result = diffScaffold(manifest, newPlan, currentFiles);
		expect(result.hasChanges).toBe(false);
		expect(result.summary).toBe("No changes detected.");
	});

	it("re-adds file that user deleted but template changed", () => {
		const newPlan: FileEntry[] = [
			{ path: "a.ts", content: "updated-a" },
		];
		// User deleted a.ts (not in currentFiles), and template changed
		const result = diffScaffold(manifest, newPlan, {});
		const diff = result.fileDiffs.find((d) => d.path === "a.ts");
		expect(diff?.status).toBe("added");
	});
});

// ── markConflict ────────────────────────────────────────────────────

describe("markConflict", () => {
	it("generates conflict markers", () => {
		const result = markConflict("user code", "template code");
		expect(result).toContain("<<<<<<< current");
		expect(result).toContain("user code");
		expect(result).toContain("=======");
		expect(result).toContain("template code");
		expect(result).toContain(">>>>>>> template");
	});
});

// ── resolveUpdates ──────────────────────────────────────────────────

describe("resolveUpdates", () => {
	it("writes modified and added files", () => {
		const diffs = [
			{ path: "a.ts", status: "modified" as const, templateContent: "new-a" },
			{ path: "b.ts", status: "added" as const, templateContent: "new-b" },
			{ path: "c.ts", status: "unchanged" as const, templateContent: null },
		];
		const { toWrite, toDelete } = resolveUpdates(diffs, {}, "skip");
		expect(toWrite).toHaveLength(2);
		expect(toDelete).toEqual([]);
	});

	it("deletes removed files", () => {
		const diffs = [
			{ path: "old.ts", status: "removed" as const, templateContent: null },
		];
		const { toWrite, toDelete } = resolveUpdates(diffs, {}, "skip");
		expect(toWrite).toEqual([]);
		expect(toDelete).toEqual(["old.ts"]);
	});

	it("overwrites conflicts with overwrite strategy", () => {
		const diffs = [
			{ path: "a.ts", status: "conflict" as const, templateContent: "template-a" },
		];
		const { toWrite } = resolveUpdates(diffs, { "a.ts": "user-a" }, "overwrite");
		expect(toWrite).toHaveLength(1);
		expect(toWrite[0].content).toBe("template-a");
	});

	it("skips conflicts with skip strategy", () => {
		const diffs = [
			{ path: "a.ts", status: "conflict" as const, templateContent: "template-a" },
		];
		const { toWrite } = resolveUpdates(diffs, { "a.ts": "user-a" }, "skip");
		expect(toWrite).toEqual([]);
	});

	it("marks conflicts with mark strategy", () => {
		const diffs = [
			{ path: "a.ts", status: "conflict" as const, templateContent: "template-a" },
		];
		const { toWrite } = resolveUpdates(diffs, { "a.ts": "user-a" }, "mark");
		expect(toWrite).toHaveLength(1);
		expect(toWrite[0].content).toContain("<<<<<<<");
		expect(toWrite[0].content).toContain("user-a");
		expect(toWrite[0].content).toContain("template-a");
	});
});
