import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";
import { needsRebuild, getNewestMtime, rebuildCli } from "../../../src/domain/devtools/self-update.js";
import type { IFileSystem, DirEntry } from "../../../src/infrastructure/types.js";
import type { IShell } from "../../../src/infrastructure/types.js";
import type fs from "node:fs";

// ── Mock filesystem ──────────────────────────────────────────────────

interface MockFile {
	type: "file";
	name: string;
	mtimeMs: number;
}

interface MockDir {
	type: "dir";
	name: string;
	children: (MockFile | MockDir)[];
}

type MockEntry = MockFile | MockDir;

function buildMockFs(tree: Record<string, MockEntry[]>, existingPaths?: Set<string>): IFileSystem {
	const existing = existingPaths ?? new Set(Object.keys(tree));

	return {
		existsSync: (path: string) => existing.has(path),
		statSync: (path: string) => {
			// Look up file mtimeMs from tree
			for (const [dir, entries] of Object.entries(tree)) {
				for (const entry of entries) {
					const fullPath = join(dir, entry.name);
					if (fullPath === path && entry.type === "file") {
						return { mtimeMs: entry.mtimeMs } as fs.Stats;
					}
				}
			}
			// Fallback for binary path
			if (existing.has(path)) {
				return { mtimeMs: 1000 } as fs.Stats;
			}
			throw new Error(`ENOENT: ${path}`);
		},
		readdirSync: ((path: string, opts?: { withFileTypes: true }) => {
			const entries = tree[path];
			if (!entries) throw new Error(`ENOENT: ${path}`);
			if (opts?.withFileTypes) {
				return entries.map((e): DirEntry => ({
					name: e.name,
					isDirectory: () => e.type === "dir",
					isFile: () => e.type === "file",
				}));
			}
			return entries.map(e => e.name);
		}) as IFileSystem["readdirSync"],
		readFileSync: vi.fn(),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		copyFileSync: vi.fn(),
		rmSync: vi.fn(),
		unlinkSync: vi.fn(),
	};
}

// ── Tests ────────────────────────────────────────────────────────────

describe("getNewestMtime", () => {
	it("returns 0 for empty directory", () => {
		const fs = buildMockFs({ "/src": [] });
		expect(getNewestMtime("/src", ".ts", fs)).toBe(0);
	});

	it("returns 0 for non-existent directory", () => {
		const fs = buildMockFs({});
		expect(getNewestMtime("/missing", ".ts", fs)).toBe(0);
	});

	it("finds the newest .ts file mtime", () => {
		const fs = buildMockFs({
			"/src": [
				{ type: "file", name: "a.ts", mtimeMs: 1000 },
				{ type: "file", name: "b.ts", mtimeMs: 3000 },
				{ type: "file", name: "c.js", mtimeMs: 5000 },
			],
		});
		expect(getNewestMtime("/src", ".ts", fs)).toBe(3000);
	});

	it("ignores non-matching extensions", () => {
		const fs = buildMockFs({
			"/src": [
				{ type: "file", name: "readme.md", mtimeMs: 9000 },
				{ type: "file", name: "index.js", mtimeMs: 8000 },
			],
		});
		expect(getNewestMtime("/src", ".ts", fs)).toBe(0);
	});

	it("recurses into subdirectories", () => {
		const mockFs = buildMockFs({
			[join("/src")]: [
				{ type: "file", name: "main.ts", mtimeMs: 1000 },
				{ type: "dir", name: "utils", children: [] },
			],
			[join("/src", "utils")]: [
				{ type: "file", name: "helper.ts", mtimeMs: 5000 },
			],
		});
		expect(getNewestMtime(join("/src"), ".ts", mockFs)).toBe(5000);
	});
});

describe("needsRebuild", () => {
	it("returns true when binary does not exist", () => {
		const fs = buildMockFs({ "/src": [] }, new Set(["/src"]));
		expect(needsRebuild("/src", "/bin/main.js", fs)).toBe(true);
	});

	it("returns true when source is newer than binary", () => {
		const binaryMtime = 2000;
		const fs = buildMockFs(
			{
				"/src": [
					{ type: "file", name: "main.ts", mtimeMs: 3000 },
				],
			},
			new Set(["/src", "/bin/main.js"]),
		);
		// Override statSync for binary
		const origStat = fs.statSync.bind(fs);
		fs.statSync = (path: string) => {
			if (path === "/bin/main.js") return { mtimeMs: binaryMtime } as fs.Stats;
			return origStat(path);
		};

		expect(needsRebuild("/src", "/bin/main.js", fs)).toBe(true);
	});

	it("returns false when binary is newer than source", () => {
		const binaryMtime = 5000;
		const fs = buildMockFs(
			{
				"/src": [
					{ type: "file", name: "main.ts", mtimeMs: 2000 },
				],
			},
			new Set(["/src", "/bin/main.js"]),
		);
		const origStat = fs.statSync.bind(fs);
		fs.statSync = (path: string) => {
			if (path === "/bin/main.js") return { mtimeMs: binaryMtime } as fs.Stats;
			return origStat(path);
		};

		expect(needsRebuild("/src", "/bin/main.js", fs)).toBe(false);
	});

	it("returns false when source and binary have same mtime", () => {
		const mtime = 3000;
		const fs = buildMockFs(
			{
				"/src": [
					{ type: "file", name: "main.ts", mtimeMs: mtime },
				],
			},
			new Set(["/src", "/bin/main.js"]),
		);
		const origStat = fs.statSync.bind(fs);
		fs.statSync = (path: string) => {
			if (path === "/bin/main.js") return { mtimeMs: mtime } as fs.Stats;
			return origStat(path);
		};

		expect(needsRebuild("/src", "/bin/main.js", fs)).toBe(false);
	});
});

describe("rebuildCli", () => {
	it("runs npm run build in the project directory", () => {
		const calls: Array<{ cmd: string; opts?: Record<string, unknown> }> = [];
		const mockShell: IShell = {
			run(cmd, opts) {
				calls.push({ cmd, opts });
				return 0;
			},
			runSilent: () => null,
			check: () => true,
			execFile: () => null,
			runCapture: () => "",
			runCaptureStatus: () => ({ output: "", exitCode: 0 }),
		};

		const code = rebuildCli("/project", mockShell);

		expect(code).toBe(0);
		expect(calls).toHaveLength(1);
		expect(calls[0].cmd).toBe("npm run build");
		expect(calls[0].opts).toEqual({ cwd: "/project", label: "Rebuilding CLI..." });
	});

	it("returns non-zero exit code on failure", () => {
		const mockShell: IShell = {
			run: () => 1,
			runSilent: () => null,
			check: () => true,
			execFile: () => null,
			runCapture: () => "",
			runCaptureStatus: () => ({ output: "", exitCode: 0 }),
		};

		expect(rebuildCli("/project", mockShell)).toBe(1);
	});
});
