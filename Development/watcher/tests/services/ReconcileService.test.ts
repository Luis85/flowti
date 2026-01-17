import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock LogService
vi.mock("../../src/services/LogService", () => ({
	LogService: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		configure: vi.fn(),
		clear: vi.fn(),
	},
}));

import { ReconcileService } from "../../src/services/ReconcileService";
import {
	createMockReconcileContext,
	createMockFileSyncService,
	createMockMapping,
	createMockSettings,
} from "../mocks/factories";
import { createMockNoticeService } from "../../src/services/NoticeService";
import { LogService } from "../../src/services/LogService";
import type { IReconcileContext, IFileSyncService } from "../../src/services/types";

describe("ReconcileService", () => {
	let ctx: IReconcileContext;
	let fileSync: IFileSyncService;
	let service: ReconcileService;
	let noticeService: ReturnType<typeof createMockNoticeService>;

	beforeEach(() => {
		vi.clearAllMocks();
		ctx = createMockReconcileContext();
		fileSync = createMockFileSyncService();
		noticeService = createMockNoticeService();
		service = new ReconcileService(ctx, fileSync, noticeService);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("isRunning", () => {
		it("should return false initially", () => {
			expect(service.isRunning()).toBe(false);
		});

		it("should return true during reconcile", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true });

			ctx = createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			service = new ReconcileService(ctx, fileSync);

			// Start reconcile but don't await
			const promise = service.reconcileMappings([mapping], {});

			// Should be running during execution
			expect(service.isRunning()).toBe(true);

			await promise;

			// Should be done
			expect(service.isRunning()).toBe(false);
		});
	});

	describe("cancel", () => {
		it("should stop reconcile early", async () => {
			const mapping1 = createMockMapping({ id: "m1", enabled: true });
			const mapping2 = createMockMapping({ id: "m2", enabled: true });

			ctx = createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [mapping1, mapping2] }),
			});

			// Make reconcileMapping slow
			let callCount = 0;
			fileSync = createMockFileSyncService({
				reconcileMapping: vi.fn().mockImplementation(async () => {
					callCount++;
					await new Promise((r) => setTimeout(r, 50));
					return { scanned: 10, processed: 5, skipped: 3, errors: 2 };
				}),
			});

			service = new ReconcileService(ctx, fileSync);

			const promise = service.reconcileMappings([mapping1, mapping2], {});

			// Cancel after first mapping starts
			setTimeout(() => service.cancel(), 25);

			await promise;

			// Should have only processed one mapping
			expect(callCount).toBe(1);
		});
	});

	describe("reconcileOnStart", () => {
		it("should reconcile mappings with reconcileOnStart=true", async () => {
			const mapping1 = createMockMapping({ id: "m1", enabled: true, reconcileOnStart: true });
			const mapping2 = createMockMapping({ id: "m2", enabled: true, reconcileOnStart: false });

			ctx = createMockReconcileContext({
				settings: createMockSettings({
					folderMappings: [mapping1, mapping2],
					syncOnStart: true,
				}),
			});
			service = new ReconcileService(ctx, fileSync);

			await service.reconcileOnStart();

			expect(fileSync.reconcileMapping).toHaveBeenCalledTimes(1);
			expect(fileSync.reconcileMapping).toHaveBeenCalledWith(mapping1, expect.any(Function));
		});

		it("should skip if syncOnStart is false", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true, reconcileOnStart: true });

			ctx = createMockReconcileContext({
				settings: createMockSettings({
					folderMappings: [mapping],
					syncOnStart: false,
				}),
			});
			service = new ReconcileService(ctx, fileSync);

			await service.reconcileOnStart();

			expect(fileSync.reconcileMapping).not.toHaveBeenCalled();
		});

		it("should skip disabled mappings", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: false, reconcileOnStart: true });

			ctx = createMockReconcileContext({
				settings: createMockSettings({
					folderMappings: [mapping],
					syncOnStart: true,
				}),
			});
			service = new ReconcileService(ctx, fileSync);

			await service.reconcileOnStart();

			expect(fileSync.reconcileMapping).not.toHaveBeenCalled();
		});
	});

	describe("reconcileMappings", () => {
		it("should reconcile all provided mappings", async () => {
			const mapping1 = createMockMapping({ id: "m1", enabled: true });
			const mapping2 = createMockMapping({ id: "m2", enabled: true });

			ctx = createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [mapping1, mapping2] }),
			});
			service = new ReconcileService(ctx, fileSync);

			await service.reconcileMappings([mapping1, mapping2], {});

			expect(fileSync.reconcileMapping).toHaveBeenCalledTimes(2);
		});

		it("should call onProgress callback", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true });

			ctx = createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			service = new ReconcileService(ctx, fileSync);

			const onProgress = vi.fn();

			await service.reconcileMappings([mapping], { onProgress });

			// Should be called multiple times (scanning, syncing, done)
			expect(onProgress).toHaveBeenCalled();
			expect(onProgress).toHaveBeenCalledWith(
				expect.objectContaining({ phase: "scanning" }),
				expect.objectContaining({ mappingIndex: 1, mappingTotal: 1 })
			);
		});

		it("should call onMappingDone callback", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true });

			fileSync = createMockFileSyncService({
				reconcileMapping: vi.fn().mockResolvedValue({
					scanned: 10,
					processed: 5,
					skipped: 3,
					errors: 2,
				}),
			});

			ctx = createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			service = new ReconcileService(ctx, fileSync);

			const onMappingDone = vi.fn();

			await service.reconcileMappings([mapping], { onMappingDone });

			expect(onMappingDone).toHaveBeenCalledWith(
				mapping,
				{ scanned: 10, processed: 5, skipped: 3, errors: 2 }
			);
		});

		it("should apply stats to context", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true });

			fileSync = createMockFileSyncService({
				reconcileMapping: vi.fn().mockResolvedValue({
					scanned: 10,
					processed: 5,
					skipped: 3,
					errors: 2,
				}),
			});

			ctx = createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			service = new ReconcileService(ctx, fileSync);

			await service.reconcileMappings([mapping], {});

			expect(ctx.applyReconcileStats).toHaveBeenCalledWith("m1", {
				scanned: 10,
				processed: 5,
				skipped: 3,
				errors: 2,
			});
		});

		it("should prevent concurrent reconciles", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true });

			fileSync = createMockFileSyncService({
				reconcileMapping: vi.fn().mockImplementation(async () => {
					await new Promise((r) => setTimeout(r, 50));
					return { scanned: 0, processed: 0, skipped: 0, errors: 0 };
				}),
			});

			ctx = createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			service = new ReconcileService(ctx, fileSync);

			// Start two reconciles simultaneously
			const promise1 = service.reconcileMappings([mapping], {});
			const promise2 = service.reconcileMappings([mapping], {});

			await Promise.all([promise1, promise2]);

			// Second one should have been skipped
			expect(fileSync.reconcileMapping).toHaveBeenCalledTimes(1);
		});

		it("should release operation lock on completion", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true });
			const releaseFn = vi.fn();

			fileSync = createMockFileSyncService({
				getOperationLock: vi.fn().mockReturnValue({
					acquireReconcile: vi.fn().mockResolvedValue(releaseFn),
				}),
			});

			ctx = createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			service = new ReconcileService(ctx, fileSync);

			await service.reconcileMappings([mapping], {});

			expect(releaseFn).toHaveBeenCalled();
		});

		it("should clear statusbar progress on completion", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true });

			ctx = createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			service = new ReconcileService(ctx, fileSync);

			await service.reconcileMappings([mapping], {});

			expect(ctx.statusbar?.clearReconcileProgress).toHaveBeenCalled();
			expect(ctx.statusbar?.onStatsChanged).toHaveBeenCalled();
		});
	});

	describe("reconcileSingleMapping", () => {
		it("should reconcile a single mapping by ID", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true });

			ctx = createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			service = new ReconcileService(ctx, fileSync);

			const result = await service.reconcileSingleMapping("m1");

			expect(result).toBe(true);
			expect(fileSync.reconcileMapping).toHaveBeenCalledWith(mapping, expect.any(Function));
		});

		it("should return false for non-existent mapping", async () => {
			ctx = createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [] }),
			});
			service = new ReconcileService(ctx, fileSync);

			const result = await service.reconcileSingleMapping("nonexistent");

			expect(result).toBe(false);
			expect(LogService.warn).toHaveBeenCalledWith(
				"Reconcile",
				"Mapping not found: nonexistent"
			);
		});

		it("should return false if already running", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true });

			fileSync = createMockFileSyncService({
				reconcileMapping: vi.fn().mockImplementation(async () => {
					await new Promise((r) => setTimeout(r, 100));
					return { scanned: 0, processed: 0, skipped: 0, errors: 0 };
				}),
			});

			ctx = createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			noticeService = createMockNoticeService();
			service = new ReconcileService(ctx, fileSync, noticeService);

			// Start first reconcile
			const promise1 = service.reconcileSingleMapping("m1");

			// Try to start another - should return false since already running
			const result = await service.reconcileSingleMapping("m1");

			expect(result).toBe(false);
			expect(noticeService.calls).toContainEqual({
				method: "show",
				message: "Reconcile already in progress",
				timeout: undefined,
			});

			await promise1;
		});
	});

	describe("reconcileAll", () => {
		it("should reconcile all enabled mappings", async () => {
			const mapping1 = createMockMapping({ id: "m1", enabled: true });
			const mapping2 = createMockMapping({ id: "m2", enabled: true });
			const mapping3 = createMockMapping({ id: "m3", enabled: false });

			ctx = createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [mapping1, mapping2, mapping3] }),
			});
			noticeService = createMockNoticeService();
			service = new ReconcileService(ctx, fileSync, noticeService);

			const result = await service.reconcileAll();

			expect(result).toBe(true);
			expect(fileSync.reconcileMapping).toHaveBeenCalledTimes(2);
		});

		it("should return false if no enabled mappings", async () => {
			ctx = createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [] }),
			});
			noticeService = createMockNoticeService();
			service = new ReconcileService(ctx, fileSync, noticeService);

			const result = await service.reconcileAll();

			expect(result).toBe(false);
			expect(noticeService.calls).toContainEqual({
				method: "show",
				message: "No enabled mappings to reconcile",
				timeout: undefined,
			});
		});

		it("should return false if already running", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true });

			fileSync = createMockFileSyncService({
				reconcileMapping: vi.fn().mockImplementation(async () => {
					await new Promise((r) => setTimeout(r, 100));
					return { scanned: 0, processed: 0, skipped: 0, errors: 0 };
				}),
			});

			ctx = createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			noticeService = createMockNoticeService();
			service = new ReconcileService(ctx, fileSync, noticeService);

			// Start first reconcile
			const promise1 = service.reconcileAll();

			// Try to start another - should return false since already running
			const result = await service.reconcileAll();

			expect(result).toBe(false);
			expect(noticeService.calls).toContainEqual({
				method: "show",
				message: "Reconcile already in progress",
				timeout: undefined,
			});

			await promise1;
		});
	});

	describe("error handling", () => {
		it("should handle callback errors gracefully", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true });

			ctx = createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			service = new ReconcileService(ctx, fileSync);

			const onProgress = vi.fn().mockImplementation(() => {
				throw new Error("Callback error");
			});

			// Should not throw
			await expect(
				service.reconcileMappings([mapping], { onProgress })
			).resolves.not.toThrow();

			// Should log the error
			expect(LogService.error).toHaveBeenCalledWith(
				"Reconcile",
				expect.stringContaining("Callback error"),
				expect.any(Object)
			);
		});

		it("should handle failed lock acquisition", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true });

			fileSync = createMockFileSyncService({
				getOperationLock: vi.fn().mockReturnValue({
					acquireReconcile: vi.fn().mockRejectedValue(new Error("Lock failed")),
				}),
			});

			ctx = createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [mapping] }),
			});
			service = new ReconcileService(ctx, fileSync);

			await service.reconcileMappings([mapping], {});

			expect(LogService.error).toHaveBeenCalledWith(
				"Reconcile",
				"Failed to acquire operation lock",
				expect.any(Object)
			);
			expect(service.isRunning()).toBe(false);
		});
	});
});
