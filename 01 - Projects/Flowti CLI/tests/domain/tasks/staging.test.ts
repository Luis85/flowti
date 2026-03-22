import { describe, it, expect, vi } from "vitest";
import { createStagingArea, readManifest, listPendingReviews, approveStaged, rejectStaged } from "../../../src/domain/tasks/staging.js";
import type { StagingManifest } from "../../../src/domain/tasks/staging.js";

function makeDeps(files: Record<string, string> = {}) {
	const store: Record<string, string> = { ...files };
	const dirs = new Set<string>();
	for (const key of Object.keys(files)) {
		const parts = key.split("/");
		for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
	}
	return {
		disk: {
			existsSync: vi.fn((p: string) => p in store || dirs.has(p)),
			readFileSync: vi.fn((p: string) => store[p] ?? ""),
			writeFileSync: vi.fn((p: string, c: string) => { store[p] = c; }),
			mkdirSync: vi.fn((p: string) => { dirs.add(p); }),
			readdirSync: vi.fn((dir: string) => {
				const prefix = dir.endsWith("/") ? dir : dir + "/";
				const entries = new Set<string>();
				for (const k of Object.keys(store)) {
					if (k.startsWith(prefix)) {
						const rest = k.slice(prefix.length);
						const first = rest.split("/")[0];
						if (first) entries.add(first);
					}
				}
				return [...entries];
			}),
			unlinkSync: vi.fn((p: string) => { delete store[p]; }),
		},
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			basename: (p: string) => p.split("/").pop()!,
		},
	};
}

const MANIFEST: StagingManifest = {
	taskId: "task-001",
	agentName: "auditor",
	operation: "vault-tag",
	files: [{ path: "notes/inbox/note1.md", action: "tag", previewPath: "preview/note1.md" }],
	createdAt: "2026-03-21T10:00:00Z",
	status: "pending",
};

describe("staging", () => {
	describe("createStagingArea", () => {
		it("writes manifest to staging directory", () => {
			const deps = makeDeps();
			const dir = createStagingArea(deps, "/vault", MANIFEST);
			expect(dir).toContain("task-001");
			expect(deps.disk.writeFileSync).toHaveBeenCalled();
		});
	});

	describe("readManifest", () => {
		it("returns null when staging dir missing", () => {
			const deps = makeDeps();
			expect(readManifest(deps, "/vault", "unknown")).toBeNull();
		});

		it("reads existing manifest", () => {
			const deps = makeDeps({
				"/vault/.flowti/var/staging/task-001/manifest.json": JSON.stringify(MANIFEST),
			});
			const result = readManifest(deps, "/vault", "task-001");
			expect(result).not.toBeNull();
			expect(result!.taskId).toBe("task-001");
			expect(result!.agentName).toBe("auditor");
		});
	});

	describe("listPendingReviews", () => {
		it("returns empty when no staging dir", () => {
			const deps = makeDeps();
			expect(listPendingReviews(deps, "/vault")).toEqual([]);
		});

		it("returns only pending manifests", () => {
			const approved: StagingManifest = { ...MANIFEST, taskId: "task-002", status: "approved" };
			const deps = makeDeps({
				"/vault/.flowti/var/staging/task-001/manifest.json": JSON.stringify(MANIFEST),
				"/vault/.flowti/var/staging/task-002/manifest.json": JSON.stringify(approved),
			});
			const pending = listPendingReviews(deps, "/vault");
			expect(pending).toHaveLength(1);
			expect(pending[0].taskId).toBe("task-001");
		});
	});

	describe("approveStaged", () => {
		it("copies preview files and updates status", () => {
			const deps = makeDeps({
				"/vault/.flowti/var/staging/task-001/manifest.json": JSON.stringify(MANIFEST),
				"/vault/.flowti/var/staging/task-001/preview/note1.md": "tagged content",
			});
			const result = approveStaged(deps, "/vault", "task-001");
			expect(result).not.toBeNull();
			expect(result!.status).toBe("approved");
		});

		it("returns null for non-pending manifest", () => {
			const approved: StagingManifest = { ...MANIFEST, status: "approved" };
			const deps = makeDeps({
				"/vault/.flowti/var/staging/task-001/manifest.json": JSON.stringify(approved),
			});
			expect(approveStaged(deps, "/vault", "task-001")).toBeNull();
		});
	});

	describe("rejectStaged", () => {
		it("updates status to rejected", () => {
			const deps = makeDeps({
				"/vault/.flowti/var/staging/task-001/manifest.json": JSON.stringify(MANIFEST),
			});
			const result = rejectStaged(deps, "/vault", "task-001");
			expect(result).not.toBeNull();
			expect(result!.status).toBe("rejected");
		});

		it("returns null for non-pending manifest", () => {
			const deps = makeDeps({
				"/vault/.flowti/var/staging/task-001/manifest.json": JSON.stringify({ ...MANIFEST, status: "rejected" }),
			});
			expect(rejectStaged(deps, "/vault", "task-001")).toBeNull();
		});
	});
});
