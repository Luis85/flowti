import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { SignalService, type SignalConfigInput } from "../../../src/domain/signal/SignalService";
import type { SignalState, WorkItemMapping } from "../../../src/domain/signal/types";
import type { SignalAdapter, TestConnectionResult, FetchItemsResult } from "../../../src/domain/signal/adapters/SignalAdapter";
import { createMockStorage } from "../../mocks/storage";
import { createMockFileSystem } from "../../mocks/filesystem";

function makeInput(overrides: Partial<SignalConfigInput> = {}): SignalConfigInput {
	return {
		name: "My Project",
		type: "azure-devops",
		orgUrl: "https://dev.azure.com/myorg",
		project: "MyProject",
		pat: "test-pat-token",
		targetFolder: "resources/signals/myproject/items",
		itemTypeFilter: ["Bug", "User Story", "Task"],
		conflictStrategy: "update",
		...overrides,
	};
}

describe("SignalService", () => {
	let service: SignalService;
	let eventBus: IEventBus;
	let getData: () => SignalState | undefined;

	beforeEach(() => {
		const mock = createMockStorage<SignalState>();
		getData = mock.getData;
		eventBus = new EventBus();
		service = new SignalService({ storage: mock.storage, eventBus });
	});

	afterEach(() => {
		service.dispose();
	});

	// ── load ─────────────────────────────────────────────────

	describe("load", () => {
		it("should initialize with empty signals array", async () => {
			await service.load();
			expect(service.getSignals()).toEqual([]);
		});

		it("should load persisted state from storage", async () => {
			const mock = createMockStorage<SignalState>({
				signals: [{
					id: "sig_existing",
					name: "Existing",
					type: "azure-devops",
					orgUrl: "https://dev.azure.com/org",
					project: "Proj",
					pat: "pat",
					targetFolder: "resources/signals/proj/items",
					itemTypeFilter: [],
					conflictStrategy: "skip",
					lastSync: "2026-02-21T10:00:00Z",
					lastSyncItemCount: 42,
					status: "connected",
				}],
			});
			service = new SignalService({ storage: mock.storage, eventBus });

			await service.load();

			expect(service.getSignals()).toHaveLength(1);
			expect(service.getSignals()[0].name).toBe("Existing");
		});

		it("should emit signal.loaded event with signal count", async () => {
			const handler = vi.fn();
			eventBus.on("signal.loaded", handler);

			await service.load();

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { signalCount: 0 },
				}),
			);
		});

		it("should emit correct count when signals exist", async () => {
			const mock = createMockStorage<SignalState>({
				signals: [
					{ id: "s1", name: "A", type: "azure-devops", orgUrl: "", project: "", pat: "", targetFolder: "", itemTypeFilter: [], conflictStrategy: "skip", lastSync: null, lastSyncItemCount: 0, status: "disconnected" },
					{ id: "s2", name: "B", type: "azure-devops", orgUrl: "", project: "", pat: "", targetFolder: "", itemTypeFilter: [], conflictStrategy: "skip", lastSync: null, lastSyncItemCount: 0, status: "disconnected" },
				],
			});
			const handler = vi.fn();
			eventBus.on("signal.loaded", handler);
			service = new SignalService({ storage: mock.storage, eventBus });

			await service.load();

			expect(handler.mock.calls[0][0].payload.signalCount).toBe(2);
		});
	});

	// ── configure ────────────────────────────────────────────

	describe("configure", () => {
		beforeEach(async () => {
			await service.load();
		});

		it("should add a new signal config", async () => {
			await service.configure(makeInput());

			expect(service.getSignals()).toHaveLength(1);
			expect(service.getSignals()[0].name).toBe("My Project");
		});

		it("should persist state after configure", async () => {
			await service.configure(makeInput());

			expect(getData()?.signals).toHaveLength(1);
		});

		it("should emit signal.configured event", async () => {
			const handler = vi.fn();
			eventBus.on("signal.configured", handler);

			await service.configure(makeInput());

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toEqual(
				expect.objectContaining({
					name: "My Project",
					type: "azure-devops",
					project: "MyProject",
				}),
			);
		});

		it("should generate unique IDs", async () => {
			const a = await service.configure(makeInput({ name: "A" }));
			const b = await service.configure(makeInput({ name: "B" }));

			expect(a.id).not.toBe(b.id);
			expect(a.id).toMatch(/^sig_/);
			expect(b.id).toMatch(/^sig_/);
		});

		it("should set default status, lastSync, and lastSyncItemCount", async () => {
			const config = await service.configure(makeInput());

			expect(config.status).toBe("disconnected");
			expect(config.lastSync).toBeNull();
			expect(config.lastSyncItemCount).toBe(0);
		});

		it("should return the created config with id", async () => {
			const config = await service.configure(makeInput());

			expect(config.id).toBeDefined();
			expect(config.name).toBe("My Project");
			expect(config.pat).toBe("test-pat-token");
		});
	});

	// ── update ───────────────────────────────────────────────

	describe("update", () => {
		beforeEach(async () => {
			await service.load();
		});

		it("should update existing signal config fields", async () => {
			const config = await service.configure(makeInput());

			const updated = await service.update(config.id, { name: "Renamed" });

			expect(updated?.name).toBe("Renamed");
			expect(service.getSignal(config.id)?.name).toBe("Renamed");
		});

		it("should persist state after update", async () => {
			const config = await service.configure(makeInput());

			await service.update(config.id, { project: "NewProject" });

			expect(getData()?.signals[0].project).toBe("NewProject");
		});

		it("should emit signal.configured event on update", async () => {
			const config = await service.configure(makeInput());
			const handler = vi.fn();
			eventBus.on("signal.configured", handler);

			await service.update(config.id, { name: "Updated" });

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.name).toBe("Updated");
		});

		it("should return undefined for non-existent signal ID", async () => {
			const result = await service.update("non-existent", { name: "X" });

			expect(result).toBeUndefined();
		});
	});

	// ── remove ───────────────────────────────────────────────

	describe("remove", () => {
		beforeEach(async () => {
			await service.load();
		});

		it("should remove signal from state", async () => {
			const config = await service.configure(makeInput());

			const removed = await service.remove(config.id);

			expect(removed).toBe(true);
			expect(service.getSignals()).toHaveLength(0);
		});

		it("should persist state after remove", async () => {
			const config = await service.configure(makeInput());

			await service.remove(config.id);

			expect(getData()?.signals).toHaveLength(0);
		});

		it("should emit signal.removed event with name", async () => {
			const config = await service.configure(makeInput());
			const handler = vi.fn();
			eventBus.on("signal.removed", handler);

			await service.remove(config.id);

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toEqual({
				signalId: config.id,
				name: "My Project",
			});
		});

		it("should return false for non-existent signal ID", async () => {
			const result = await service.remove("non-existent");

			expect(result).toBe(false);
		});
	});

	// ── getSignals / getSignal ───────────────────────────────

	describe("getSignals / getSignal", () => {
		beforeEach(async () => {
			await service.load();
		});

		it("should return a copy of signals array (not reference)", async () => {
			await service.configure(makeInput());

			const signals = service.getSignals();
			signals.pop();

			expect(service.getSignals()).toHaveLength(1);
		});

		it("should return undefined for non-existent ID", () => {
			expect(service.getSignal("non-existent")).toBeUndefined();
		});

		it("should return signal by ID", async () => {
			const config = await service.configure(makeInput());

			const found = service.getSignal(config.id);

			expect(found?.name).toBe("My Project");
		});
	});

	// ── dispose ──────────────────────────────────────────────

	describe("dispose", () => {
		it("should work without eventBus (optional dependency)", async () => {
			const mock = createMockStorage<SignalState>();
			const serviceNoEvents = new SignalService({ storage: mock.storage });

			await serviceNoEvents.load();
			await serviceNoEvents.configure(makeInput());

			expect(serviceNoEvents.getSignals()).toHaveLength(1);
			serviceNoEvents.dispose();
		});

		it("should not throw when called multiple times", () => {
			service.dispose();
			expect(() => service.dispose()).not.toThrow();
		});
	});

	// ── testConnection ──────────────────────────────────────

	describe("testConnection", () => {
		let adapter: SignalAdapter;
		let serviceWithAdapter: SignalService;

		beforeEach(async () => {
			adapter = {
				testConnection: vi.fn(async (): Promise<TestConnectionResult> => ({ success: true })),
				fetchItems: vi.fn(async (): Promise<FetchItemsResult> => ({ items: [], errors: [] })),
			};
			const mock = createMockStorage<SignalState>();
			serviceWithAdapter = new SignalService({
				storage: mock.storage,
				eventBus,
				adapter,
				fileSystem: createMockFileSystem(),
			});
			await serviceWithAdapter.load();
		});

		afterEach(() => {
			serviceWithAdapter.dispose();
		});

		it("should update status to connected on success", async () => {
			const config = await serviceWithAdapter.configure(makeInput());

			await serviceWithAdapter.testConnection(config.id);

			expect(serviceWithAdapter.getSignal(config.id)?.status).toBe("connected");
		});

		it("should update status to error on failure", async () => {
			(adapter.testConnection as ReturnType<typeof vi.fn>).mockResolvedValue({
				success: false,
				error: "Bad PAT",
			});
			const config = await serviceWithAdapter.configure(makeInput());

			await serviceWithAdapter.testConnection(config.id);

			expect(serviceWithAdapter.getSignal(config.id)?.status).toBe("error");
		});

		it("should emit signal.connection.tested event", async () => {
			const config = await serviceWithAdapter.configure(makeInput());
			const handler = vi.fn();
			eventBus.on("signal.connection.tested", handler);

			await serviceWithAdapter.testConnection(config.id);

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload).toMatchObject({
				signalId: config.id,
				success: true,
			});
		});

		it("should return error for non-existent signal", async () => {
			const result = await serviceWithAdapter.testConnection("non-existent");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Signal not found");
		});
	});

	// ── sync ────────────────────────────────────────────────

	describe("sync", () => {
		let adapter: SignalAdapter;
		let fileSystem: ReturnType<typeof createMockFileSystem>;
		let serviceWithSync: SignalService;

		function makeWorkItem(overrides: Partial<WorkItemMapping> = {}): WorkItemMapping {
			return {
				id: 100,
				rev: 1,
				type: "User Story",
				title: "Test Item",
				state: "Active",
				assignedTo: "Dev",
				areaPath: "Proj\\Area",
				iterationPath: "Proj\\Sprint",
				priority: 2,
				tags: [],
				url: "https://dev.azure.com/org/Proj/_workitems/edit/100",
				description: "<p>desc</p>",
				createdDate: "2026-02-20T10:00:00Z",
				changedDate: "2026-02-21T10:00:00Z",
				...overrides,
			};
		}

		beforeEach(async () => {
			adapter = {
				testConnection: vi.fn(async (): Promise<TestConnectionResult> => ({ success: true })),
				fetchItems: vi.fn(async (): Promise<FetchItemsResult> => ({ items: [], errors: [] })),
			};
			fileSystem = createMockFileSystem();
			const mock = createMockStorage<SignalState>();
			serviceWithSync = new SignalService({
				storage: mock.storage,
				eventBus,
				adapter,
				fileSystem,
			});
			await serviceWithSync.load();
		});

		afterEach(() => {
			serviceWithSync.dispose();
		});

		it("should return correct SyncResult for successful sync", async () => {
			(adapter.fetchItems as ReturnType<typeof vi.fn>).mockResolvedValue({
				items: [makeWorkItem({ id: 1, title: "A" }), makeWorkItem({ id: 2, title: "B" })],
				errors: [],
			});
			const config = await serviceWithSync.configure(makeInput());

			const result = await serviceWithSync.sync(config.id);

			expect(result.itemsCreated).toBe(2);
			expect(result.itemsUpdated).toBe(0);
			expect(result.itemsSkipped).toBe(0);
			expect(result.errors).toHaveLength(0);
			expect(result.duration).toBeGreaterThanOrEqual(0);
		});

		it("should emit sync.failed when adapter throws", async () => {
			(adapter.fetchItems as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
			const config = await serviceWithSync.configure(makeInput());
			const handler = vi.fn();
			eventBus.on("signal.sync.failed", handler);

			await serviceWithSync.sync(config.id);

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.error).toBe("Network error");
		});

		it("should update config lastSync and status after sync", async () => {
			(adapter.fetchItems as ReturnType<typeof vi.fn>).mockResolvedValue({
				items: [makeWorkItem()],
				errors: [],
			});
			const config = await serviceWithSync.configure(makeInput());

			await serviceWithSync.sync(config.id);

			const updated = serviceWithSync.getSignal(config.id)!;
			expect(updated.lastSync).not.toBeNull();
			expect(updated.lastSyncItemCount).toBe(1);
			expect(updated.status).toBe("connected");
		});

		it("should collect per-item errors without aborting", async () => {
			(adapter.fetchItems as ReturnType<typeof vi.fn>).mockResolvedValue({
				items: [makeWorkItem({ id: 1, title: "Good" }), makeWorkItem({ id: 2, title: "Bad" })],
				errors: [],
			});
			let callCount = 0;
			(fileSystem.createFile as ReturnType<typeof vi.fn>).mockImplementation(async () => {
				callCount++;
				if (callCount === 2) throw new Error("Write error");
			});
			const config = await serviceWithSync.configure(makeInput());

			const result = await serviceWithSync.sync(config.id);

			expect(result.itemsCreated).toBe(1);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].workItemId).toBe(2);
		});

		it("should emit sync.completed with result", async () => {
			(adapter.fetchItems as ReturnType<typeof vi.fn>).mockResolvedValue({
				items: [makeWorkItem()],
				errors: [],
			});
			const config = await serviceWithSync.configure(makeInput());
			const handler = vi.fn();
			eventBus.on("signal.sync.completed", handler);

			await serviceWithSync.sync(config.id);

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.result.itemsCreated).toBe(1);
		});
	});
});
