import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import {
	createStagingArea,
	readManifest,
	approveStaged,
	rejectStaged,
	listPendingReviews,
} from "../../../src/domain/tasks/staging.js";
import type { StagingManifest } from "../../../src/domain/tasks/staging.js";

function makeDeps(files: Record<string, string> = {}) {
	const store: Record<string, string> = { ...files };
	const dirs = new Set<string>();

	function addDirsFor(key: string): void {
		const parts = key.split("/");
		for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
	}
	for (const key of Object.keys(files)) addDirsFor(key);

	return {
		disk: {
			existsSync: vi.fn((p: string) => p in store || dirs.has(p)),
			readFileSync: vi.fn((p: string, _enc?: string) => store[p] ?? ""),
			writeFileSync: vi.fn((p: string, c: string, _enc?: string) => {
				store[p] = c;
				addDirsFor(p);
			}),
			mkdirSync: vi.fn((p: string) => { dirs.add(p); }),
			readdirSync: vi.fn((dir: string) => {
				const prefix = dir.endsWith("/") ? dir : dir + "/";
				const seen = new Set<string>();
				for (const k of Object.keys(store)) {
					if (k.startsWith(prefix)) {
						const rest = k.slice(prefix.length);
						const segment = rest.split("/")[0];
						if (segment) seen.add(segment);
					}
				}
				for (const d of dirs) {
					if (d.startsWith(prefix)) {
						const rest = d.slice(prefix.length);
						const segment = rest.split("/")[0];
						if (segment && !rest.slice(segment.length + 1).includes("/")) seen.add(segment);
					}
				}
				return [...seen];
			}),
			copyFileSync: vi.fn((src: string, dest: string) => {
				store[dest] = store[src] ?? "";
				addDirsFor(dest);
			}),
			rmSync: vi.fn((p: string) => {
				for (const k of Object.keys(store)) {
					if (k.startsWith(p + "/") || k === p) delete store[k];
				}
				for (const d of [...dirs]) {
					if (d.startsWith(p + "/") || d === p) dirs.delete(d);
				}
			}),
		},
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		},
		_store: store,
	};
}

const BASE_MANIFEST: StagingManifest = {
	taskId: "task-001",
	agentName: "auditor",
	operation: "tag-notes",
	files: [
		{
			path: "notes/inbox/note-1.md",
			action: "tag",
			previewPath: ".flowti/var/staging/task-001/previews/note-1.md",
		},
	],
	createdAt: "2026-03-21T10:00:00Z",
	status: "pending",
};

describe("staging", () => {
	describe("createStagingArea", () => {
		it("writes manifest.json to correct path", () => {
			const deps = makeDeps();
			const dir = createStagingArea(deps, "/vault", BASE_MANIFEST);
			expect(dir).toBe("/vault/.flowti/var/staging/task-001");
			expect(deps.disk.mkdirSync).toHaveBeenCalledWith(
				"/vault/.flowti/var/staging/task-001",
				{ recursive: true },
			);
			expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
				"/vault/.flowti/var/staging/task-001/manifest.json",
				expect.stringContaining('"taskId": "task-001"'),
				"utf-8",
			);
		});

		it("serialises all manifest fields", () => {
			const deps = makeDeps();
			createStagingArea(deps, "/vault", BASE_MANIFEST);
			const written = deps._store["/vault/.flowti/var/staging/task-001/manifest.json"];
			const parsed = JSON.parse(written) as StagingManifest;
			expect(parsed.agentName).toBe("auditor");
			expect(parsed.operation).toBe("tag-notes");
			expect(parsed.status).toBe("pending");
			expect(parsed.files).toHaveLength(1);
		});
	});

	describe("readManifest", () => {
		it("returns null for nonexistent task", () => {
			const deps = makeDeps();
			expect(readManifest(deps, "/vault", "no-such-task")).toBeNull();
		});

		it("parses existing manifest", () => {
			const deps = makeDeps({
				"/vault/.flowti/var/staging/task-001/manifest.json": JSON.stringify(BASE_MANIFEST),
			});
			const result = readManifest(deps, "/vault", "task-001");
			expect(result).not.toBeNull();
			expect(result?.taskId).toBe("task-001");
			expect(result?.agentName).toBe("auditor");
			expect(result?.status).toBe("pending");
		});

		it("returns null when manifest JSON is malformed", () => {
			const deps = makeDeps({
				"/vault/.flowti/var/staging/task-001/manifest.json": "not-valid-json{{{",
			});
			expect(readManifest(deps, "/vault", "task-001")).toBeNull();
		});
	});

	describe("approveStaged", () => {
		it("returns false when task does not exist", () => {
			const deps = makeDeps();
			expect(approveStaged(deps, "/vault", "no-such-task")).toBe(false);
		});

		it("copies preview files to vault paths", () => {
			const deps = makeDeps({
				"/vault/.flowti/var/staging/task-001/manifest.json": JSON.stringify(BASE_MANIFEST),
				"/vault/.flowti/var/staging/task-001/previews/note-1.md": "# Note 1",
			});
			const result = approveStaged(deps, "/vault", "task-001");
			expect(result).toBe(true);
			expect(deps.disk.copyFileSync).toHaveBeenCalledWith(
				"/vault/.flowti/var/staging/task-001/previews/note-1.md",
				"/vault/notes/inbox/note-1.md",
			);
		});

		it("marks status as approved in manifest", () => {
			const deps = makeDeps({
				"/vault/.flowti/var/staging/task-001/manifest.json": JSON.stringify(BASE_MANIFEST),
				"/vault/.flowti/var/staging/task-001/previews/note-1.md": "# Note 1",
			});
			approveStaged(deps, "/vault", "task-001");
			const updated = readManifest(deps, "/vault", "task-001");
			expect(updated?.status).toBe("approved");
		});
	});

	describe("rejectStaged", () => {
		it("returns false when task does not exist", () => {
			const deps = makeDeps();
			expect(rejectStaged(deps, "/vault", "no-such-task")).toBe(false);
		});

		it("marks status as rejected in manifest before cleanup", () => {
			const deps = makeDeps({
				"/vault/.flowti/var/staging/task-001/manifest.json": JSON.stringify(BASE_MANIFEST),
			});
			const result = rejectStaged(deps, "/vault", "task-001");
			expect(result).toBe(true);
			expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
				"/vault/.flowti/var/staging/task-001/manifest.json",
				expect.stringContaining('"status": "rejected"'),
				"utf-8",
			);
		});

		it("removes the staging directory", () => {
			const deps = makeDeps({
				"/vault/.flowti/var/staging/task-001/manifest.json": JSON.stringify(BASE_MANIFEST),
			});
			rejectStaged(deps, "/vault", "task-001");
			expect(deps.disk.rmSync).toHaveBeenCalledWith(
				"/vault/.flowti/var/staging/task-001",
				{ recursive: true, force: true },
			);
		});
	});

	describe("listPendingReviews", () => {
		it("returns empty array when staging dir does not exist", () => {
			const deps = makeDeps();
			expect(listPendingReviews(deps, "/vault")).toEqual([]);
		});

		it("returns only pending manifests", () => {
			const approvedManifest: StagingManifest = { ...BASE_MANIFEST, taskId: "task-002", status: "approved" };
			const rejectedManifest: StagingManifest = { ...BASE_MANIFEST, taskId: "task-003", status: "rejected" };
			const deps = makeDeps({
				"/vault/.flowti/var/staging/task-001/manifest.json": JSON.stringify(BASE_MANIFEST),
				"/vault/.flowti/var/staging/task-002/manifest.json": JSON.stringify(approvedManifest),
				"/vault/.flowti/var/staging/task-003/manifest.json": JSON.stringify(rejectedManifest),
			});
			const results = listPendingReviews(deps, "/vault");
			expect(results).toHaveLength(1);
			expect(results[0].taskId).toBe("task-001");
		});

		it("returns multiple pending manifests", () => {
			const second: StagingManifest = { ...BASE_MANIFEST, taskId: "task-002" };
			const deps = makeDeps({
				"/vault/.flowti/var/staging/task-001/manifest.json": JSON.stringify(BASE_MANIFEST),
				"/vault/.flowti/var/staging/task-002/manifest.json": JSON.stringify(second),
			});
			const results = listPendingReviews(deps, "/vault");
			expect(results).toHaveLength(2);
		});
	});
});
