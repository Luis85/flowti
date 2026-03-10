import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import path from "node:path";
import {
	hashContent,
	collectSourceHashes,
	aggregateHash,
	createManifest,
	loadManifest,
	saveManifest,
	checkFreshness,
	recordBuild,
	manifestPath,
} from "../../../src/domain/build/build-freshness.js";

function sha256(s: string): string {
	return createHash("sha256").update(s).digest("hex");
}

/** Normalize a path to the OS separator for consistent mock lookups. */
function p(...parts: string[]): string {
	return path.join(...parts);
}

// ── hashContent ──────────────────────────────────────────────────────

describe("hashContent", () => {
	it("returns SHA-256 hex digest", () => {
		expect(hashContent("hello")).toBe(sha256("hello"));
	});

	it("returns different hashes for different input", () => {
		expect(hashContent("a")).not.toBe(hashContent("b"));
	});
});

// ── collectSourceHashes ──────────────────────────────────────────────

describe("collectSourceHashes", () => {
	it("collects .ts files recursively", () => {
		const srcDir = p("/src");
		const files: Record<string, string> = {
			[p("/src", "main.ts")]: "console.log('hi');",
			[p("/src", "lib", "utils.ts")]: "export const x = 1;",
		};
		const dirs: Record<string, { name: string; isDirectory(): boolean; isFile(): boolean }[]> = {
			[srcDir]: [
				{ name: "main.ts", isDirectory: () => false, isFile: () => true },
				{ name: "lib", isDirectory: () => true, isFile: () => false },
			],
			[p("/src", "lib")]: [
				{ name: "utils.ts", isDirectory: () => false, isFile: () => true },
			],
		};
		const fs = {
			existsSync: () => true,
			readFileSync: (fp: string) => files[fp] ?? "",
			readdirSync: (fp: string) => dirs[fp] ?? [],
		};

		const hashes = collectSourceHashes(srcDir, fs as never);
		expect(Object.keys(hashes)).toHaveLength(2);
		expect(hashes["main.ts"]).toBe(sha256("console.log('hi');"));
		// On Windows relative path uses backslash
		const utilsKey = path.join("lib", "utils.ts");
		expect(hashes[utilsKey]).toBe(sha256("export const x = 1;"));
	});

	it("returns empty map when directory does not exist", () => {
		const fs = {
			existsSync: () => false,
			readFileSync: () => "",
			readdirSync: () => [],
		};
		expect(collectSourceHashes("/missing", fs as never)).toEqual({});
	});

	it("skips non-ts files", () => {
		const srcDir = p("/src");
		const dirs: Record<string, { name: string; isDirectory(): boolean; isFile(): boolean }[]> = {
			[srcDir]: [
				{ name: "readme.md", isDirectory: () => false, isFile: () => true },
				{ name: "main.ts", isDirectory: () => false, isFile: () => true },
			],
		};
		const fs = {
			existsSync: () => true,
			readFileSync: () => "content",
			readdirSync: (fp: string) => dirs[fp] ?? [],
		};

		const hashes = collectSourceHashes(srcDir, fs as never);
		expect(Object.keys(hashes)).toHaveLength(1);
		expect(hashes["main.ts"]).toBeDefined();
	});

	it("skips node_modules directory", () => {
		const srcDir = p("/src");
		const dirs: Record<string, { name: string; isDirectory(): boolean; isFile(): boolean }[]> = {
			[srcDir]: [
				{ name: "node_modules", isDirectory: () => true, isFile: () => false },
				{ name: "main.ts", isDirectory: () => false, isFile: () => true },
			],
		};
		const fs = {
			existsSync: () => true,
			readFileSync: () => "content",
			readdirSync: (fp: string) => dirs[fp] ?? [],
		};

		const hashes = collectSourceHashes(srcDir, fs as never);
		expect(Object.keys(hashes)).toHaveLength(1);
	});
});

// ── aggregateHash ────────────────────────────────────────────────────

describe("aggregateHash", () => {
	it("returns consistent hash for same input", () => {
		const h = { "a.ts": "hash-a", "b.ts": "hash-b" };
		expect(aggregateHash(h)).toBe(aggregateHash(h));
	});

	it("is order-independent (sorts by key)", () => {
		const h1 = { "b.ts": "hb", "a.ts": "ha" };
		const h2 = { "a.ts": "ha", "b.ts": "hb" };
		expect(aggregateHash(h1)).toBe(aggregateHash(h2));
	});

	it("changes when a file hash changes", () => {
		const h1 = { "a.ts": "hash-v1" };
		const h2 = { "a.ts": "hash-v2" };
		expect(aggregateHash(h1)).not.toBe(aggregateHash(h2));
	});

	it("changes when a file is added", () => {
		const h1 = { "a.ts": "ha" };
		const h2 = { "a.ts": "ha", "b.ts": "hb" };
		expect(aggregateHash(h1)).not.toBe(aggregateHash(h2));
	});
});

// ── manifestPath ─────────────────────────────────────────────────────

describe("manifestPath", () => {
	it("appends .build-manifest.json to binDir", () => {
		const mp = manifestPath("/app/bin");
		expect(mp).toContain(".build-manifest.json");
		expect(mp).toContain("bin");
	});
});

// ── loadManifest / saveManifest ──────────────────────────────────────

describe("loadManifest", () => {
	it("returns null when no manifest exists", () => {
		const fs = { existsSync: () => false, readFileSync: () => "" };
		expect(loadManifest("/bin", fs as never)).toBeNull();
	});

	it("returns parsed manifest", () => {
		const manifest = { builtAt: "2026-01-01", sourceHash: "abc", fileCount: 2, files: {} };
		const fs = {
			existsSync: () => true,
			readFileSync: () => JSON.stringify(manifest),
		};
		expect(loadManifest("/bin", fs as never)).toEqual(manifest);
	});

	it("returns null for invalid JSON", () => {
		const fs = { existsSync: () => true, readFileSync: () => "not json" };
		expect(loadManifest("/bin", fs as never)).toBeNull();
	});
});

describe("saveManifest", () => {
	it("writes manifest as JSON", () => {
		let written = "";
		const fs = {
			mkdirSync: () => {},
			writeFileSync: (_p: string, content: string) => { written = content; },
		};
		const manifest = { builtAt: "2026-01-01", sourceHash: "abc", fileCount: 1, files: { "a.ts": "ha" } };
		saveManifest("/bin", manifest, fs as never);
		expect(JSON.parse(written)).toEqual(manifest);
	});
});

// ── createManifest ───────────────────────────────────────────────────

describe("createManifest", () => {
	it("creates manifest with aggregate hash and file count", () => {
		const hashes = { "a.ts": "ha", "b.ts": "hb" };
		const manifest = createManifest(hashes);
		expect(manifest.fileCount).toBe(2);
		expect(manifest.files).toEqual(hashes);
		expect(manifest.sourceHash).toBe(aggregateHash(hashes));
		expect(manifest.builtAt).toBeTruthy();
	});
});

// ── checkFreshness ───────────────────────────────────────────────────

describe("checkFreshness", () => {
	const srcDir = p("/proj", "src");
	const binDir = p("/proj", "bin");

	function makeFsWithFiles(files: Record<string, string>, manifestData?: object) {
		const dirs: Record<string, { name: string; isDirectory(): boolean; isFile(): boolean }[]> = {};
		for (const filePath of Object.keys(files)) {
			const dir = path.dirname(filePath);
			const name = path.basename(filePath);
			if (!dirs[dir]) dirs[dir] = [];
			dirs[dir].push({ name, isDirectory: () => false, isFile: () => true });
		}

		return {
			existsSync: (fp: string) => {
				if (manifestData && fp.includes(".build-manifest.json")) return true;
				if (!manifestData && fp.includes(".build-manifest.json")) return false;
				return fp in files || fp in dirs;
			},
			readFileSync: (fp: string) => {
				if (fp.includes(".build-manifest.json") && manifestData) return JSON.stringify(manifestData);
				return files[fp] ?? "";
			},
			readdirSync: (fp: string) => dirs[fp] ?? [],
		};
	}

	it("reports rebuild needed when no manifest exists", () => {
		const fs = makeFsWithFiles({ [p(srcDir, "main.ts")]: "code" });
		const result = checkFreshness(srcDir, binDir, fs as never);
		expect(result.needsRebuild).toBe(true);
		expect(result.reason).toContain("No build manifest");
		expect(result.added).toContain("main.ts");
	});

	it("reports up to date when hashes match", () => {
		const hashes = { "main.ts": hashContent("code") };
		const manifest = { builtAt: "2026-01-01", sourceHash: aggregateHash(hashes), fileCount: 1, files: hashes };
		const fs = makeFsWithFiles({ [p(srcDir, "main.ts")]: "code" }, manifest);
		const result = checkFreshness(srcDir, binDir, fs as never);
		expect(result.needsRebuild).toBe(false);
		expect(result.reason).toContain("up to date");
	});

	it("detects modified files", () => {
		const hashes = { "main.ts": hashContent("old-code") };
		const manifest = { builtAt: "2026-01-01", sourceHash: aggregateHash(hashes), fileCount: 1, files: hashes };
		const fs = makeFsWithFiles({ [p(srcDir, "main.ts")]: "new-code" }, manifest);
		const result = checkFreshness(srcDir, binDir, fs as never);
		expect(result.needsRebuild).toBe(true);
		expect(result.modified).toContain("main.ts");
	});

	it("detects added files", () => {
		const hashes = { "main.ts": hashContent("code") };
		const manifest = { builtAt: "2026-01-01", sourceHash: aggregateHash(hashes), fileCount: 1, files: hashes };
		const fs = makeFsWithFiles({ [p(srcDir, "main.ts")]: "code", [p(srcDir, "new.ts")]: "new" }, manifest);
		const result = checkFreshness(srcDir, binDir, fs as never);
		expect(result.needsRebuild).toBe(true);
		expect(result.added).toContain("new.ts");
	});

	it("detects removed files", () => {
		const hashes = { "main.ts": hashContent("code"), "old.ts": hashContent("old") };
		const manifest = { builtAt: "2026-01-01", sourceHash: aggregateHash(hashes), fileCount: 2, files: hashes };
		const fs = makeFsWithFiles({ [p(srcDir, "main.ts")]: "code" }, manifest);
		const result = checkFreshness(srcDir, binDir, fs as never);
		expect(result.needsRebuild).toBe(true);
		expect(result.removed).toContain("old.ts");
	});

	it("provides a summary reason with counts", () => {
		const hashes = { "main.ts": hashContent("old"), "dead.ts": hashContent("dead") };
		const manifest = { builtAt: "2026-01-01", sourceHash: aggregateHash(hashes), fileCount: 2, files: hashes };
		const fs = makeFsWithFiles({ [p(srcDir, "main.ts")]: "new", [p(srcDir, "added.ts")]: "x" }, manifest);
		const result = checkFreshness(srcDir, binDir, fs as never);
		expect(result.reason).toContain("1 added");
		expect(result.reason).toContain("1 modified");
		expect(result.reason).toContain("1 removed");
	});
});

// ── recordBuild ──────────────────────────────────────────────────────

describe("recordBuild", () => {
	it("saves manifest after collecting hashes", () => {
		let savedData = "";
		const srcDir = p("/proj", "src");
		const fs = {
			existsSync: (fp: string) => fp === srcDir || fp === p(srcDir, "main.ts"),
			readFileSync: (fp: string) => fp === p(srcDir, "main.ts") ? "code" : "",
			readdirSync: (fp: string) => fp === srcDir
				? [{ name: "main.ts", isDirectory: () => false, isFile: () => true }]
				: [],
			writeFileSync: (_fp: string, content: string) => { savedData = content; },
			mkdirSync: () => {},
		};

		const manifest = recordBuild(srcDir, p("/proj", "bin"), fs as never);
		expect(manifest.fileCount).toBe(1);
		expect(manifest.files["main.ts"]).toBe(hashContent("code"));
		expect(savedData).toBeTruthy();
		expect(JSON.parse(savedData).sourceHash).toBe(manifest.sourceHash);
	});
});
