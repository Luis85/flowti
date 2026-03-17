/**
 * Feature 5: Reconciliation — Acceptance Tests
 *
 * Covers bulk catchup sync operations: startup reconciliation,
 * incremental mode, parallelism, cancellation, and concurrent guard.
 *
 * @see docs/testplan.md — UC-20 through UC-24
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock LogService
vi.mock("../../src/services/LogService", () => ({
	LogService: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

import { ReconcileService } from "../../src/services/ReconcileService";
import { SyncStateService } from "../../src/services/SyncStateService";
import {
	createMockReconcileContext,
	createMockFileSyncService,
	createMockMapping,
	createMockSettings,
	createMockNoticeService,
} from "../mocks/factories";

// ===========================
// Feature 5: Reconciliation
// ===========================

describe("Feature 5: Reconciliation", () => {

	// ==========================================
	// UC-20: Reconciliation on Start
	// ==========================================
	describe("UC-20: Reconciliation on Start", () => {

		it("Scenario 20.1: Enabled mappings are reconciled on startup", async () => {
			const mapping = createMockMapping({
				id: "m1",
				enabled: true,
				reconcileOnStart: true,
			});
			const ctx = createMockReconcileContext({
				settings: createMockSettings({
					syncOnStart: true,
					folderMappings: [mapping],
				}),
			});
			const fileSync = createMockFileSyncService();

			const service = new ReconcileService(ctx, fileSync);
			await service.reconcileOnStart();

			expect(fileSync.reconcileMapping).toHaveBeenCalledTimes(1);
			expect(ctx.applyReconcileStats).toHaveBeenCalledWith("m1", expect.any(Object));
		});

		it("Scenario 20.2: Disabled mappings are not reconciled", async () => {
			const mapping = createMockMapping({
				id: "m1",
				enabled: false,
				reconcileOnStart: true,
			});
			const ctx = createMockReconcileContext({
				settings: createMockSettings({
					syncOnStart: true,
					folderMappings: [mapping],
				}),
			});
			const fileSync = createMockFileSyncService();

			const service = new ReconcileService(ctx, fileSync);
			await service.reconcileOnStart();

			expect(fileSync.reconcileMapping).not.toHaveBeenCalled();
		});

		it("Scenario 20.3: Mappings with reconcileOnStart=false are skipped", async () => {
			const mapping = createMockMapping({
				id: "m1",
				enabled: true,
				reconcileOnStart: false,
			});
			const ctx = createMockReconcileContext({
				settings: createMockSettings({
					syncOnStart: true,
					folderMappings: [mapping],
				}),
			});
			const fileSync = createMockFileSyncService();

			const service = new ReconcileService(ctx, fileSync);
			await service.reconcileOnStart();

			expect(fileSync.reconcileMapping).not.toHaveBeenCalled();
		});

		it("Scenario 20: syncOnStart=false skips all reconciliation", async () => {
			const mapping = createMockMapping({
				id: "m1",
				enabled: true,
				reconcileOnStart: true,
			});
			const ctx = createMockReconcileContext({
				settings: createMockSettings({
					syncOnStart: false,
					folderMappings: [mapping],
				}),
			});
			const fileSync = createMockFileSyncService();

			const service = new ReconcileService(ctx, fileSync);
			await service.reconcileOnStart();

			expect(fileSync.reconcileMapping).not.toHaveBeenCalled();
		});

		it.skip("Scenario 20.4: Reconcile blocks watchers during execution (operation lock)", () => {
			// Requires integration test with WatcherManager + AsyncMutex
		});
	});

	// ==========================================
	// UC-21: Incremental Reconciliation
	// ==========================================
	describe("UC-21: Incremental Reconciliation", () => {

		it("Scenario 21.1: Unchanged files return false from needsSync", () => {
			// Test SyncStateService.needsSync directly
			const service = new SyncStateService({ vault: { adapter: { basePath: "/tmp" } } } as any, "test");

			// Record a file sync
			service.recordSync("m1", "/source", "file.md", { mtimeMs: 1000, size: 500 });

			// Same stats → unchanged
			expect(service.needsSync("m1", "/source", "file.md", { mtimeMs: 1000, size: 500 })).toBe(false);
		});

		it("Scenario 21.2: Modified file returns true from needsSync (mtime changed)", () => {
			const service = new SyncStateService({ vault: { adapter: { basePath: "/tmp" } } } as any, "test");
			service.recordSync("m1", "/source", "file.md", { mtimeMs: 1000, size: 500 });

			// Different mtime → needs sync
			expect(service.needsSync("m1", "/source", "file.md", { mtimeMs: 2000, size: 500 })).toBe(true);
		});

		it("Scenario 21.2b: Modified file returns true from needsSync (size changed)", () => {
			const service = new SyncStateService({ vault: { adapter: { basePath: "/tmp" } } } as any, "test");
			service.recordSync("m1", "/source", "file.md", { mtimeMs: 1000, size: 500 });

			// Different size → needs sync
			expect(service.needsSync("m1", "/source", "file.md", { mtimeMs: 1000, size: 600 })).toBe(true);
		});

		it("Scenario 21: Never-synced file returns true from needsSync", () => {
			const service = new SyncStateService({ vault: { adapter: { basePath: "/tmp" } } } as any, "test");

			// No previous state → needs sync
			expect(service.needsSync("m1", "/source", "new-file.md", { mtimeMs: 1000, size: 500 })).toBe(true);
		});

		it.skip("Scenario 21.3: Missing vault target triggers re-sync even if source unchanged", () => {
			// Requires integration with FileSyncService.reconcileFolder checking vault adapter
		});

		it.skip("Scenario 21.4: Sync state is persisted after reconciliation", () => {
			// Requires filesystem write verification
		});
	});

	// ==========================================
	// UC-22: Reconcile Worker Parallelism
	// ==========================================
	describe("UC-22: Reconcile Worker Parallelism", () => {

		it.skip("Scenario 22.1: Multiple files processed concurrently (parallelism=4)", () => {
			// Requires integration with FileSyncService.reconcileMapping + concurrency tracking
		});

		it("Scenario 22.2: Individual file errors don't stop other files", async () => {
			const m1 = createMockMapping({ id: "m1", enabled: true });
			const m2 = createMockMapping({ id: "m2", enabled: true });
			const ctx = createMockReconcileContext({
				settings: createMockSettings({
					syncOnStart: true,
					folderMappings: [m1, m2],
				}),
			});

			let callCount = 0;
			const fileSync = createMockFileSyncService({
				reconcileMapping: vi.fn().mockImplementation(() => {
					callCount++;
					if (callCount === 1) throw new Error("First mapping failed");
					return { scanned: 10, processed: 5, skipped: 3, errors: 0, deleted: 0 };
				}),
			});

			const service = new ReconcileService(ctx, fileSync);
			await service.reconcileMappings([m1, m2], {
				onProgress: vi.fn(),
				onMappingDone: vi.fn(),
			});

			// Both mappings should have been attempted
			expect(fileSync.reconcileMapping).toHaveBeenCalledTimes(2);
			// Second mapping should still get its stats applied
			expect(ctx.applyReconcileStats).toHaveBeenCalledWith("m2", expect.any(Object));
		});
	});

	// ==========================================
	// UC-23: Cancel Reconciliation
	// ==========================================
	describe("UC-23: Cancel Reconciliation", () => {

		it("Scenario 23.1: Cancel stops processing after current file (cooperative)", async () => {
			const m1 = createMockMapping({ id: "m1", enabled: true });
			const m2 = createMockMapping({ id: "m2", enabled: true });
			const ctx = createMockReconcileContext({
				settings: createMockSettings({
					folderMappings: [m1, m2],
				}),
			});

			const fileSync = createMockFileSyncService({
				reconcileMapping: vi.fn().mockResolvedValue({
					scanned: 10, processed: 5, skipped: 3, errors: 0, deleted: 0,
				}),
			});

			const service = new ReconcileService(ctx, fileSync);

			const progressPhases: string[] = [];
			const promise = service.reconcileMappings([m1, m2], {
				onProgress: (p) => {
					progressPhases.push(p.phase);
					// Cancel after first mapping starts syncing
					if (p.mappingId === "m1" && p.phase === "done") {
						service.cancel();
					}
				},
				onMappingDone: vi.fn(),
			});

			await promise;

			// First mapping was fully processed, second was not started
			expect(fileSync.reconcileMapping).toHaveBeenCalledTimes(1);
			expect(service.isRunning()).toBe(false);
		});
	});

	// ==========================================
	// UC-24: Concurrent Reconcile Guard
	// ==========================================
	describe("UC-24: Concurrent Reconcile Guard", () => {

		it("Scenario 24.1: Second reconcile call is ignored while first is running", async () => {
			const mapping = createMockMapping({ id: "m1", enabled: true });
			const ctx = createMockReconcileContext({
				settings: createMockSettings({
					folderMappings: [mapping],
				}),
			});

			let resolveReconcile: (() => void) | undefined;
			const fileSync = createMockFileSyncService({
				reconcileMapping: vi.fn().mockImplementation(() =>
					new Promise<any>((resolve) => {
						resolveReconcile = () => resolve({
							scanned: 10, processed: 5, skipped: 3, errors: 0, deleted: 0,
						});
					})
				),
			});

			const notice = createMockNoticeService();
			const service = new ReconcileService(ctx, fileSync, notice);

			// Start first reconciliation
			const first = service.reconcileAll();
			expect(service.isRunning()).toBe(true);

			// Try second — should be ignored
			const second = await service.reconcileAll();
			expect(second).toBe(false);
			expect(notice.calls.some(c => c.message.includes("already in progress"))).toBe(true);

			// Complete first
			resolveReconcile!();
			await first;

			expect(service.isRunning()).toBe(false);
		});
	});
});
