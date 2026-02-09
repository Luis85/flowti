/**
 * Journey 3: Catch Up After a Weekend Away
 *
 * Persona: The Weekend User (Jordan)
 * @see docs/journeys/journey-3-catch-up-after-weekend.md
 */

import { describe, it, expect, vi } from "vitest";

// Mock LogService
vi.mock("../../src/services/LogService", () => ({
	LogService: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

import { SyncStateService } from "../../src/services/SyncStateService";
import { ReconcileService } from "../../src/services/ReconcileService";
import {
	createMockMapping,
	createMockSettings,
	createMockReconcileContext,
	createMockFileSyncService,
	createMockNoticeService,
} from "../mocks/factories";

describe("Journey 3: Catch Up After a Weekend Away", () => {

	it("Happy path: reconcile enabled mappings → skip unchanged → sync modified → concurrent guard → cancel", async () => {
		// --- Step 1: Settings with syncOnStart ---
		const m1 = createMockMapping({
			id: "notes",
			enabled: true,
			reconcileOnStart: true,
			sourceFolder: "/dropbox/notes",
			targetFolder: "vault/notes",
		});
		const m2 = createMockMapping({
			id: "docs",
			enabled: true,
			reconcileOnStart: true,
			sourceFolder: "/dropbox/docs",
			targetFolder: "vault/docs",
		});
		const disabled = createMockMapping({
			id: "disabled-map",
			enabled: false,
			reconcileOnStart: true,
		});

		// --- Step 2: ReconcileService processes only enabled mappings ---
		const ctx = createMockReconcileContext({
			settings: createMockSettings({
				syncOnStart: true,
				folderMappings: [m1, m2, disabled],
			}),
		});
		const fileSync = createMockFileSyncService({
			reconcileMapping: vi.fn().mockResolvedValue({
				scanned: 20,
				processed: 5,
				skipped: 15,
				errors: 0,
				deleted: 0,
			}),
		});

		const service = new ReconcileService(ctx, fileSync);
		await service.reconcileOnStart();

		// Only enabled mappings are reconciled (2 of 3)
		expect(fileSync.reconcileMapping).toHaveBeenCalledTimes(2);
		expect(ctx.applyReconcileStats).toHaveBeenCalledWith("notes", expect.any(Object));
		expect(ctx.applyReconcileStats).toHaveBeenCalledWith("docs", expect.any(Object));

		// --- Steps 3 & 4: SyncStateService differentiates unchanged vs modified ---
		const syncState = new SyncStateService(
			{ vault: { adapter: { basePath: "/tmp" } } } as any,
			"test",
		);

		// Record files from last week
		syncState.recordSync("notes", "/dropbox/notes", "unchanged.md", {
			mtimeMs: 1700000000000,
			size: 500,
		});
		syncState.recordSync("notes", "/dropbox/notes", "modified.md", {
			mtimeMs: 1700000000000,
			size: 500,
		});

		// Step 3: Unchanged file → skip
		expect(
			syncState.needsSync("notes", "/dropbox/notes", "unchanged.md", {
				mtimeMs: 1700000000000,
				size: 500,
			}),
		).toBe(false);

		// Step 4: Modified file → needs sync
		expect(
			syncState.needsSync("notes", "/dropbox/notes", "modified.md", {
				mtimeMs: 1700000086400, // weekend edit
				size: 800,
			}),
		).toBe(true);

		// Step 5: New file → needs sync (no prior state)
		expect(
			syncState.needsSync("notes", "/dropbox/notes", "brand-new.md", {
				mtimeMs: 1700000000000,
				size: 100,
			}),
		).toBe(true);

		// --- Step 6: Concurrent guard ---
		let resolveReconcile: (() => void) | undefined;
		const fileSync2 = createMockFileSyncService({
			reconcileMapping: vi.fn().mockImplementation(
				() =>
					new Promise<any>((resolve) => {
						resolveReconcile = () =>
							resolve({ scanned: 10, processed: 5, skipped: 3, errors: 0, deleted: 0 });
					}),
			),
		});

		const notice = createMockNoticeService();
		const service2 = new ReconcileService(
			createMockReconcileContext({
				settings: createMockSettings({
					syncOnStart: true,
					folderMappings: [m1],
				}),
			}),
			fileSync2,
			notice,
		);

		// Start first reconciliation
		const first = service2.reconcileAll();
		expect(service2.isRunning()).toBe(true);

		// Second attempt is rejected (concurrent guard)
		const second = await service2.reconcileAll();
		expect(second).toBe(false);
		expect(notice.calls.some((c) => c.message.includes("already in progress"))).toBe(true);

		// Complete first
		resolveReconcile!();
		await first;
		expect(service2.isRunning()).toBe(false);

		// --- Step 7: Cancel stops processing ---
		const m3 = createMockMapping({ id: "m3", enabled: true });
		const m4 = createMockMapping({ id: "m4", enabled: true });
		const fileSync3 = createMockFileSyncService({
			reconcileMapping: vi.fn().mockResolvedValue({
				scanned: 10,
				processed: 5,
				skipped: 3,
				errors: 0,
				deleted: 0,
			}),
		});

		const service3 = new ReconcileService(
			createMockReconcileContext({
				settings: createMockSettings({ folderMappings: [m3, m4] }),
			}),
			fileSync3,
		);

		const promise = service3.reconcileMappings([m3, m4], {
			onProgress: (p) => {
				if (p.mappingId === "m3" && p.phase === "done") {
					service3.cancel();
				}
			},
			onMappingDone: vi.fn(),
		});

		await promise;

		// First mapping processed, second cancelled
		expect(fileSync3.reconcileMapping).toHaveBeenCalledTimes(1);
		expect(service3.isRunning()).toBe(false);
	});

	it("Disabled mappings and syncOnStart=false are respected", async () => {
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
});
