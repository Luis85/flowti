import { describe, it, expect, vi, beforeEach } from "vitest";
import { runReconcileWorkerPool, ReconcileWorkerPoolConfig } from "../../src/services/ReconcileWorkerPool";
import type { FolderMapping } from "../../src/types";
import type { ReconcileFileEntry, SyncInternalOpts } from "../../src/services/types";
import { createMockMapping } from "../mocks/factories";

describe("ReconcileWorkerPool", () => {
	let mapping: FolderMapping;
	let syncOpts: SyncInternalOpts;

	beforeEach(() => {
		mapping = createMockMapping();
		syncOpts = {
			verifyStability: false,
			skipUnchanged: false,
			ensuredFolders: { ensured: new Set() },
		};
	});

	function makeFiles(count: number): ReconcileFileEntry[] {
		return Array.from({ length: count }, (_, i) => ({
			filePath: `/source/file${i}.md`,
			relativePath: `file${i}.md`,
		}));
	}

	function makeConfig(overrides: Partial<ReconcileWorkerPoolConfig> = {}): ReconcileWorkerPoolConfig {
		return {
			filesToProcess: makeFiles(3),
			initialSkipped: 0,
			mapping,
			concurrency: 2,
			progressThrottleMs: 0,
			syncFile: vi.fn()
				.mockResolvedValue({ ok: true, action: "processed", targetPath: "t" }),
			syncOpts,
			...overrides,
		};
	}

	it("should process all files and return correct stats", async () => {
		const config = makeConfig();
		const stats = await runReconcileWorkerPool(config);

		expect(stats.scanned).toBe(3);
		expect(stats.processed).toBe(3);
		expect(stats.skipped).toBe(0);
		expect(stats.errors).toBe(0);
		expect(config.syncFile).toHaveBeenCalledTimes(3);
	});

	it("should count errors when syncFile returns { ok: false }", async () => {
		const syncFile = vi.fn()
			.mockResolvedValue({ ok: false, error: new Error("fail") });

		const stats = await runReconcileWorkerPool(makeConfig({ syncFile }));

		expect(stats.errors).toBe(3);
		expect(stats.processed).toBe(0);
	});

	it("should count errors when syncFile throws", async () => {
		const syncFile = vi.fn()
			.mockRejectedValue(new Error("boom"));

		const stats = await runReconcileWorkerPool(makeConfig({ syncFile }));

		expect(stats.errors).toBe(3);
		expect(stats.processed).toBe(0);
	});

	it("should correctly handle action: skipped results", async () => {
		const syncFile = vi.fn()
			.mockResolvedValue({ ok: true, action: "skipped", targetPath: "t", reason: "unchanged" });

		const stats = await runReconcileWorkerPool(makeConfig({ syncFile }));

		expect(stats.skipped).toBe(3);
		expect(stats.processed).toBe(0);
	});

	it("should record sync in syncState on success", async () => {
		const files: ReconcileFileEntry[] = [{
			filePath: "/source/file.md",
			relativePath: "file.md",
			stat: { mtimeMs: 1000, size: 42 } as any,
		}];
		const syncState = {
			recordSync: vi.fn(),
		};
		const syncFile = vi.fn()
			.mockResolvedValue({ ok: true, action: "processed", targetPath: "t" });

		await runReconcileWorkerPool(makeConfig({
			filesToProcess: files,
			syncFile,
			syncState: syncState as any,
		}));

		expect(syncState.recordSync).toHaveBeenCalledWith(
			mapping.id,
			mapping.sourceFolder,
			"file.md",
			{ mtimeMs: 1000, size: 42 }
		);
	});

	it("should handle empty filesToProcess array", async () => {
		const syncFile = vi.fn();
		const stats = await runReconcileWorkerPool(makeConfig({
			filesToProcess: [],
			syncFile,
		}));

		expect(stats.scanned).toBe(0);
		expect(stats.processed).toBe(0);
		expect(syncFile).not.toHaveBeenCalled();
	});

	it("should add initialSkipped to stats.skipped", async () => {
		const stats = await runReconcileWorkerPool(makeConfig({
			filesToProcess: [],
			initialSkipped: 10,
		}));

		expect(stats.skipped).toBe(10);
	});

	it("should pass syncOpts through to syncFile", async () => {
		const customOpts: SyncInternalOpts = {
			verifyStability: true,
			skipUnchanged: true,
			ensuredFolders: { ensured: new Set(["a"]) },
		};
		const syncFile = vi.fn()
			.mockResolvedValue({ ok: true, action: "processed", targetPath: "t" });

		await runReconcileWorkerPool(makeConfig({
			filesToProcess: makeFiles(1),
			syncFile,
			syncOpts: customOpts,
		}));

		expect(syncFile).toHaveBeenCalledWith(mapping, "/source/file0.md", customOpts);
	});

	it("should emit progress callbacks", async () => {
		const onProgress = vi.fn();
		const syncFile = vi.fn()
			.mockResolvedValue({ ok: true, action: "processed", targetPath: "t" });

		await runReconcileWorkerPool(makeConfig({
			filesToProcess: makeFiles(2),
			concurrency: 1,
			progressThrottleMs: 0,
			onProgress,
			syncFile,
		}));

		// At minimum: initial (forced) + per-file + final (forced)
		expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(3);
		// First call is forced initial
		expect(onProgress.mock.calls[0][0]).toMatchObject({ total: 2 });
	});

	it("should process files with multiple concurrent workers", async () => {
		const order: number[] = [];
		let fileIndex = 0;
		const syncFile = vi.fn(async () => {
			const idx = fileIndex++;
			order.push(idx);
			// Small delay to allow interleaving
			await new Promise(r => setTimeout(r, 5));
			return { ok: true as const, action: "processed" as const, targetPath: "t" };
		});

		await runReconcileWorkerPool(makeConfig({
			filesToProcess: makeFiles(4),
			concurrency: 2,
			syncFile,
		}));

		expect(syncFile).toHaveBeenCalledTimes(4);
	});
});
